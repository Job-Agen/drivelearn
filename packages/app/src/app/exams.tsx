import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import { useApp } from "../state/app";
import { Illustration } from "../ui/Illustration";
import { Badge, Body, Button, ErrorText, Row, Screen, Title, TopBar } from "../ui/kit";
import { Chip, InfoBox } from "../ui/parts";
import { colors, fonts, radius, space } from "../ui/theme";

type Status = Awaited<ReturnType<typeof api.examStatus>>;
type History = Awaited<ReturnType<typeof api.examHistory>>;

/** Écran 15 — Avant l'examen (et historique des examens). Connexion requise. */
export default function ExamsScreen() {
  const { bundle } = useApp();
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<History>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.examStatus(), api.examHistory()])
      .then(([s, h]) => {
        setStatus(s);
        setHistory(h);
      })
      .catch((e) => setError(e.message));
  }, []);
  useFocusEffect(load);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const exam = await api.startExam();
      router.push(`/exam/${exam.attempt_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer l'examen.");
    } finally {
      setBusy(false);
    }
  };

  const program = bundle?.content.program;
  const count = program?.exam_question_count ?? 20;
  const minutes = Math.round((count * (program?.exam_seconds_per_question ?? 30)) / 60);
  const open = history.find((h) => !h.submitted_at);
  const canStart = status ? status.has_pass || status.free_exam_available || Boolean(open) : false;
  const badge = status?.has_pass ? "Pass Examen" : status?.free_exam_available ? "Examen découverte" : "Examen blanc";

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Ton examen blanc" />}
      footer={
        canStart || !status ? (
          <Button label={open ? "Reprendre l'examen" : "Commencer l'examen"} onPress={start} loading={busy} disabled={!canStart} />
        ) : (
          <Button label="Obtenir le Pass Examen" onPress={() => router.push("/premium")} />
        )
      }
    >
      <View style={{ alignItems: "center" }}>
        <Illustration name="clipboard" width={220} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>
      <Title center size={26}>
        Teste tes connaissances
      </Title>
      <Row style={{ justifyContent: "center" }}>
        <Chip icon="document-text" label={`${count} questions`} />
        <Chip icon="time" label={`${minutes} minutes`} />
      </Row>
      <Body muted center>
        Format officiel : admis à partir de {program?.exam_pass_mark ?? 13}/{count}.
      </Body>
      <View style={styles.rules}>
        <Rule icon="checkmark-circle" text="Correction à la fin" />
        <Rule icon="document-text" text="Une réponse par question" />
        <Rule icon="time" text="Le temps continue en arrière-plan" />
      </View>
      <InfoBox text="Les réponses doivent être enregistrées avant la fin du temps." />
      {status?.free_exam_available ? (
        <InfoBox tone="teal" icon="gift" text="Ton examen découverte est disponible" />
      ) : status?.has_pass ? (
        <InfoBox tone="teal" icon="ribbon" text={`Pass Examen actif jusqu'au ${new Date(status.pass_ends_at!).toLocaleDateString("fr-FR")}`} />
      ) : status && !open ? (
        <InfoBox text="Ton examen découverte a été utilisé. Le Pass Examen permet d'en passer autant que tu veux." />
      ) : null}
      <ErrorText>{error}</ErrorText>

      {history.filter((h) => h.submitted_at).length > 0 ? (
        <>
          <Text style={styles.section}>Mes examens</Text>
          {status ? (
            <Body muted>
              Prêt pour l'examen : {status.consecutive_passes}/{status.required_passes} réussites d'affilée {status.ready ? "✅" : ""}
            </Body>
          ) : null}
          {history
            .filter((h) => h.submitted_at)
            .map((h) => (
              <Pressable key={h.attempt_id} style={styles.history} onPress={() => router.push(`/exam/${h.attempt_id}`)}>
                <Text style={styles.historyDate}>
                  {new Date(h.submitted_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </Text>
                <Badge label={`${h.score}/${h.total} · ${h.passed ? "Admis" : "Ajourné"}`} tone={h.passed ? "primary" : "danger"} />
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
        </>
      ) : null}
    </Screen>
  );
}

function Rule({ icon, text }: { icon: "checkmark-circle" | "document-text" | "time"; text: string }) {
  return (
    <Row>
      <Ionicons name={icon} size={24} color={colors.blue} />
      <Text style={styles.ruleText}>{text}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 6, marginTop: -18 },
  badgeText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
  rules: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm },
  ruleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  section: { fontFamily: fonts.black, fontSize: 20, color: colors.navy, marginTop: space.sm },
  history: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  historyDate: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
});
