import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Reminder } from "../domain/reminders";

// Rappels locaux (voir domain/reminders.ts). Rien sur le web : l'app web ne sert qu'au développement.

const NATIVE = Platform.OS !== "web";
export const remindersSupported = NATIVE;
const CHANNEL = "rappels";
let lastPlan: string | null = null;

async function granted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/** Affiche la demande d'autorisation du système si elle n'a pas encore été accordée. */
export async function askReminderPermission(): Promise<boolean> {
  if (!NATIVE) return false;
  try {
    if (await granted()) return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** Remplace les rappels programmés par ce plan. Sans autorisation, ne fait rien (et ne demande rien). */
export async function scheduleReminders(plan: Reminder[]): Promise<void> {
  if (!NATIVE) return;
  const signature = JSON.stringify(plan);
  if (signature === lastPlan) return;
  try {
    if (plan.length > 0 && !(await granted())) return;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Rappels quotidiens",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
      });
    }
    lastPlan = signature;
  } catch {
    // Un rappel manqué n'empêche pas d'utiliser l'app ; on réessaiera au prochain calcul.
    lastPlan = null;
  }
}

/** À la déconnexion ou à la suppression du compte. */
export async function clearReminders(): Promise<void> {
  await scheduleReminders([]);
}
