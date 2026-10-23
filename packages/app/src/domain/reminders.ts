// Rappels quotidiens programmés sur le téléphone (pas de serveur ni de compte de notifications).
// On programme les 14 prochains jours un par un plutôt qu'un rappel répétitif : on peut ainsi sauter
// la journée quand l'élève a déjà fait sa séance et varier les messages. Le plan est recalculé à chaque
// ouverture de l'app et après chaque séance ; sans ouverture pendant 14 jours, les rappels s'arrêtent.

export const REMINDER_DAYS = 14;

export type ReminderInput = {
  enabled: boolean;
  /** « HH:MM » ou « HH:MM:SS » (colonne time de la base). */
  time: string;
  now: Date;
  practicedToday: boolean;
  streak: number;
  firstName: string | null;
};

export type Reminder = { date: Date; title: string; body: string };

const MESSAGES: { title: string; body: string }[] = [
  { title: "C'est l'heure du code", body: "Quelques minutes aujourd'hui suffisent pour avancer." },
  { title: "Une petite séance ?", body: "Ta prochaine leçon t'attend dans DriveLearn." },
  { title: "Prêt pour l'examen ?", body: "Chaque séance te rapproche du permis." },
  { title: "Révise tes panneaux", body: "Cinq minutes de quiz, et c'est fait pour aujourd'hui." },
  { title: "On continue ?", body: "Garde le rythme : un peu chaque jour, c'est la clé." },
];

export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Rappels à programmer, dans l'ordre : vide si désactivés ou heure illisible. */
export function reminderPlan(input: ReminderInput): Reminder[] {
  if (!input.enabled) return [];
  const at = parseTime(input.time);
  if (!at) return [];
  const hello = input.firstName?.trim() ? `${input.firstName.trim()}, ` : "";
  const plan: Reminder[] = [];
  for (let day = 0; day < REMINDER_DAYS; day++) {
    const date = new Date(input.now);
    date.setDate(date.getDate() + day);
    date.setHours(at.hour, at.minute, 0, 0);
    if (date <= input.now) continue;
    if (day === 0 && input.practicedToday) continue;
    // Aujourd'hui, une série en cours est l'argument le plus fort.
    if (day === 0 && input.streak > 0) {
      plan.push({
        date,
        title: `Ta série de ${input.streak} jour${input.streak > 1 ? "s" : ""} t'attend`,
        body: `${hello}fais ta séance du jour pour ne pas la perdre.`,
      });
      continue;
    }
    const message = MESSAGES[(date.getDate() + date.getMonth()) % MESSAGES.length];
    plan.push({ date, title: message.title, body: hello ? `${hello}${lowerFirst(message.body)}` : message.body });
  }
  return plan;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
