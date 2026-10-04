import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import { useApp } from "../state/app";
import { Flag } from "../ui/Illustration";
import { Body, Button, ErrorText, Screen, TopBar } from "../ui/kit";
import { colors, fonts, radius, space } from "../ui/theme";

const GOALS = [5, 10, 15] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Écran 22 — Mes préférences. */
export default function SettingsScreen() {
  const { me, bundle, updateMe, setMe } = useApp();
  const [firstName, setFirstName] = useState(me?.first_name ?? "");
  const [goal, setGoal] = useState<5 | 10 | 15>(me?.daily_goal_minutes ?? 5);
  const [reminder, setReminder] = useState(me?.reminder_enabled ?? false);
  const [time, setTime] = useState(me?.reminder_time ?? "19:00");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  const save = async () => {
    if (reminder && !TIME.test(time)) return setError("Heure invalide, par exemple 19:00.");
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await updateMe({
        first_name: firstName.trim() || null,
        daily_goal_minutes: goal,
        reminder_enabled: reminder,
        ...(reminder ? { reminder_time: time } : {}),
      });
      if (code.trim()) {
        const { driving_school_name } = await api.setPromoCode(code.trim());
        await setMe({ ...me, first_name: firstName.trim() || null, daily_goal_minutes: goal, reminder_enabled: reminder, driving_school_name });
        setCode("");
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<TopBar onBack={() => router.back()} title="Mes préférences" />} footer={<Button label="Enregistrer" chevron={false} onPress={save} loading={busy} />}>
      <Label>Ton prénom</Label>
      <TextInput value={firstName} onChangeText={setFirstName} maxLength={40} style={styles.input} accessibilityLabel="Ton prénom" />

      <Label>Mon objectif d'apprentissage</Label>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {GOALS.map((g) => (
          <Pressable key={g} onPress={() => setGoal(g)} style={[styles.segment, goal === g && styles.segmentOn]} accessibilityRole="radio" accessibilityState={{ checked: goal === g }}>
            <Text style={[styles.segmentText, goal === g && { color: "#fff" }]}>{g} min</Text>
          </Pressable>
        ))}
      </View>

      <Label>Mon pays</Label>
      <View style={styles.select}>
        <Flag country="TG" width={32} />
        <Text style={styles.selectText}>{bundle?.content.program.name ?? "Togo"}</Text>
        <Ionicons name="chevron-down" size={20} color={colors.navy} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Label>Rappel quotidien</Label>
        <Switch value={reminder} onValueChange={setReminder} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
      </View>
      <View style={[styles.input, styles.time, !reminder && { opacity: 0.6 }]}>
        <Ionicons name="time-outline" size={22} color={colors.muted} />
        <TextInput
          value={time}
          onChangeText={setTime}
          editable={reminder}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          style={styles.timeInput}
          accessibilityLabel="Heure du rappel"
        />
      </View>
      {!reminder ? <Body muted>Active le rappel pour choisir une heure.</Body> : null}

      <Label>Fuseau horaire</Label>
      <View style={styles.select}>
        <Text style={styles.selectText}>Lomé</Text>
        <Ionicons name="chevron-down" size={20} color={colors.navy} />
      </View>

      <Label>Code promo de ton auto-école</Label>
      {me.driving_school_name ? <Body muted>Rattaché à {me.driving_school_name}</Body> : null}
      <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={20} placeholder="Ex. AUTOECOLE10" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Code promo" />
      {info ? <Body>{info}</Body> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, marginTop: space.xs },
  input: {
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.navy,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  selectText: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.navy },
  time: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 4 },
  timeInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.navy, paddingVertical: 10 },
});
