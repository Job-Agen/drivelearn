import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../lib/api";
import type { Program } from "../../lib/types";
import { useApp } from "../../state/app";
import { Flag, Illustration } from "../../ui/Illustration";
import { Badge, Body, Button, ErrorText, Loading, Screen, Title, TopBar } from "../../ui/kit";
import { ChoiceRow, InfoBox, Radio } from "../../ui/parts";
import { colors, fonts, radius, space } from "../../ui/theme";

const GOALS = [
  { minutes: 5 as const, label: "En douceur" },
  { minutes: 10 as const, label: "Régulier" },
  { minutes: 15 as const, label: "Motivé" },
];

/** Écrans 06 (Choisir mon pays) et 07 (Mon objectif). */
export default function Onboarding() {
  const { me, updateMe, signOut } = useApp();
  const [step, setStep] = useState<0 | 1>(0);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [programId, setProgramId] = useState<string | null>(me?.program_id ?? null);
  const [firstName, setFirstName] = useState(me?.first_name ?? "");
  const [goal, setGoal] = useState<5 | 10 | 15>(me?.daily_goal_minutes ?? 5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPrograms = () => {
    setError(null);
    api
      .programs()
      .then((list) => {
        setPrograms([...list].sort((a, b) => Number(b.available) - Number(a.available)));
        const open = list.filter((p) => p.available);
        if (open.length === 1) setProgramId((current) => current ?? open[0].id);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(loadPrograms, []);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateMe({ program_id: programId, first_name: firstName.trim() || null, daily_goal_minutes: goal });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!programs && !error) return <Loading />;

  if (step === 0) {
    return (
      <Screen
        header={<TopBar onBack={signOut} title="Choisir mon pays" />}
        footer={<Button label="Continuer" disabled={!programId} onPress={() => setStep(1)} />}
      >
        <View style={{ gap: 2 }}>
          <Title center size={24}>
            Où prépares-tu ton permis ?
          </Title>
          <Body muted center>
            Ton parcours dépend de ton pays.
          </Body>
        </View>
        {(programs ?? []).map((p) => (
          <ChoiceRow key={p.id} selected={programId === p.id} disabled={!p.available} onPress={() => setProgramId(p.id)}>
            <Flag country={p.country_code} width={52} />
            <Text style={styles.choiceTitle}>{p.name}</Text>
            {!p.available ? <Badge label="Bientôt" tone="muted" /> : null}
          </ChoiceRow>
        ))}
        {!programs ? <Button label="Réessayer" variant="outline" onPress={loadPrograms} /> : null}
        <InfoBox title="Catalogue de démonstration" text="Certains contenus seront bientôt disponibles dans d'autres pays." />
        <Text style={styles.section}>Quel permis prépares-tu ?</Text>
        <ChoiceRow selected>
          <Ionicons name="car" size={30} color={colors.blue} />
          <Text style={styles.choiceTitle}>Permis voiture</Text>
        </ChoiceRow>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen header={<TopBar onBack={() => setStep(0)} title="Mon objectif" />} footer={<Button label="C'est parti" loading={busy} onPress={finish} />}>
      <Illustration name="goalMentor" width="100%" style={{ borderRadius: radius.lg, overflow: "hidden" }} />
      <View style={{ gap: 2 }}>
        <Title center size={30}>
          Un peu chaque jour
        </Title>
        <Body muted center>
          Reste motivé et progresse à ton rythme.
        </Body>
      </View>
      <View style={styles.floating}>
        <Text style={styles.floatingLabel}>Ton prénom (facultatif)</Text>
        <TextInput value={firstName} onChangeText={setFirstName} maxLength={40} style={styles.floatingInput} accessibilityLabel="Ton prénom (facultatif)" />
      </View>
      <Text style={styles.section}>Combien de temps par jour ?</Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {GOALS.map((g) => {
          const on = goal === g.minutes;
          return (
            <Pressable
              key={g.minutes}
              onPress={() => setGoal(g.minutes)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.goal, on && styles.goalOn]}
            >
              <Ionicons name="time" size={24} color={on ? colors.primary : colors.muted} />
              <Text style={styles.goalMin}>{g.minutes} min</Text>
              <Text style={styles.goalLabel}>{g.label}</Text>
              <Radio on={on} />
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choiceTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 19, color: colors.navy },
  section: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.navy, marginTop: space.xs },
  floating: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: space.sm },
  floatingLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  floatingInput: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy, paddingVertical: 6 },
  goal: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  goalOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  goalMin: { fontFamily: fonts.black, fontSize: 19, color: colors.navy, marginTop: 4 },
  goalLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy, marginBottom: 6 },
});
