import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";
import type { Program } from "../../lib/types";
import { useApp } from "../../state/app";
import { Badge, Body, Button, ErrorText, Field, Loading, ProgressBar, Screen, Title } from "../../ui/kit";
import { colors, radius, space } from "../../ui/theme";

const FLAGS: Record<string, string> = { TG: "🇹🇬", BJ: "🇧🇯", CI: "🇨🇮" };
const GOALS = [
  { minutes: 5 as const, label: "Tranquille", detail: "5 min par jour" },
  { minutes: 10 as const, label: "Régulier", detail: "10 min par jour" },
  { minutes: 15 as const, label: "Intensif", detail: "15 min par jour" },
];

/** Configuration en trois étapes : programme (pays + permis), prénom, objectif quotidien. */
export default function Onboarding() {
  const { me, updateMe, signOut } = useApp();
  const [step, setStep] = useState(0);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [programId, setProgramId] = useState<string | null>(me?.program_id ?? null);
  const [firstName, setFirstName] = useState(me?.first_name ?? "");
  const [goal, setGoal] = useState<5 | 10 | 15>(me?.daily_goal_minutes ?? 10);
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
      await updateMe({ program_id: programId, first_name: firstName.trim(), daily_goal_minutes: goal });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!programs && !error) return <Loading />;

  const steps = [
    {
      ok: Boolean(programId),
      body: (
        <>
          <Title>Où passes-tu ton permis ?</Title>
          {(programs ?? []).map((p) => (
            <Pressable
              key={p.id}
              disabled={!p.available}
              onPress={() => setProgramId(p.id)}
              style={[styles.choice, programId === p.id && styles.choiceOn, !p.available && { opacity: 0.55 }]}
            >
              <Text style={{ fontSize: 32 }}>{FLAGS[p.country_code] ?? "🏳️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>{p.name}</Text>
                <Text style={styles.choiceDetail}>Permis {["B", "voiture"].includes(p.license_type) ? "voiture" : p.license_type}</Text>
              </View>
              {!p.available ? <Badge label="Bientôt" tone="muted" /> : null}
            </Pressable>
          ))}
          {!programs ? <Button label="Réessayer" variant="outline" onPress={loadPrograms} /> : null}
        </>
      ),
    },
    {
      ok: firstName.trim().length > 0,
      body: (
        <>
          <Title>Comment t'appelles-tu ?</Title>
          <Body muted>Ton moniteur t'encouragera par ton prénom.</Body>
          <Field label="Prénom" value={firstName} onChangeText={setFirstName} maxLength={40} autoFocus />
        </>
      ),
    },
    {
      ok: true,
      body: (
        <>
          <Title>Quel est ton objectif quotidien ?</Title>
          <Body muted>Un peu chaque jour vaut mieux que beaucoup une fois par semaine.</Body>
          {GOALS.map((g) => (
            <Pressable key={g.minutes} onPress={() => setGoal(g.minutes)} style={[styles.choice, goal === g.minutes && styles.choiceOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>{g.label}</Text>
                <Text style={styles.choiceDetail}>{g.detail}</Text>
              </View>
            </Pressable>
          ))}
        </>
      ),
    },
  ];
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <Screen
      footer={
        <>
          <Button
            label={last ? "C'est parti !" : "Continuer"}
            disabled={!current.ok}
            loading={busy}
            onPress={last ? finish : () => setStep(step + 1)}
          />
          <Button label={step === 0 ? "Se déconnecter" : "Retour"} variant="ghost" onPress={step === 0 ? signOut : () => setStep(step - 1)} />
        </>
      }
    >
      <ProgressBar value={(step + 1) / steps.length} />
      {current.body}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  choiceDetail: { color: colors.muted },
});
