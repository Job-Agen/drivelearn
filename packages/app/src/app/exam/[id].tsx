import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, Text, View } from "react-native";
import { toggleChoice } from "../../domain/grading";
import { api } from "../../lib/api";
import type { Exam } from "../../lib/types";
import { useApp } from "../../state/app";
import { imageUrl } from "../../ui/images";
import { Badge, Body, Button, Card, ErrorText, Loading, Option, Picture, Row, Screen, Segments, Subtitle, Title, TopBar } from "../../ui/kit";
import { colors, fonts, radius, space } from "../../ui/theme";

/** Écrans 16 et 17 : examen chronométré question par question, puis résultat et correction. */
export default function ExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const advancing = useRef(false);

  const load = useCallback(async () => {
    try {
      const e = await api.exam(id);
      setExam(e);
      // Reprise : pas de retour en arrière, on repart de la première question sans réponse.
      const first = e.questions.findIndex((q) => q.selected === null);
      setIndex(first === -1 ? e.questions.length : first);
      setLeft(e.seconds_per_question);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Examen introuvable.");
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      setExam(await api.submitExam(id));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }, [id, refresh]);

  const advance = useCallback(async () => {
    if (!exam || advancing.current) return;
    advancing.current = true;
    setBusy(true);
    const question = exam.questions[index];
    try {
      await api.saveExamAnswer(id, { question_id: question.id, choice_ids: selected });
      setSelected([]);
      setLeft(exam.seconds_per_question);
      if (index + 1 >= exam.questions.length) await submit();
      setIndex(index + 1);
      setError(null);
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "exam_closed") await submit();
      else setError(err instanceof Error ? err.message : "Réponse non enregistrée. Vérifie ta connexion.");
    } finally {
      advancing.current = false;
      setBusy(false);
    }
  }, [exam, index, id, selected, submit]);

  const running = exam && !exam.submitted && index < exam.questions.length;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [running, index]);
  useEffect(() => {
    if (running && left === 0) advance();
  }, [running, left, advance]);

  if (!exam) {
    return error ? (
      <Screen footer={<Button label="Retour" onPress={() => router.back()} />}>
        <ErrorText>{error}</ErrorText>
      </Screen>
    ) : (
      <Loading />
    );
  }

  if (exam.submitted) return <Correction exam={exam} />;
  if (!running) return <Loading />;

  const question = exam.questions[index];
  const quit = () =>
    Alert.alert("Quitter l'examen ?", "Le chrono continue : les questions non répondues compteront comme fausses.", [
      { text: "Continuer l'examen", style: "cancel" },
      { text: "Quitter", style: "destructive", onPress: () => router.back() },
    ]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const last = index + 1 === exam.questions.length;

  return (
    <Screen
      header={
        <>
          <TopBar onBack={quit} title="Examen blanc" onClose={quit} />
          <View style={styles.timerRow}>
            <View style={styles.timer}>
              <Ionicons name="time-outline" size={28} color={left <= 5 ? colors.danger : colors.blue} />
              <Text style={[styles.timerText, left <= 5 && { color: colors.danger }]}>
                {mm}:{ss}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.counter}>
                Question {index + 1} sur {exam.total}
              </Text>
              <Segments total={exam.total} done={index + 1} />
            </View>
          </View>
        </>
      }
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button label={last ? "Terminer" : "Suivant"} onPress={advance} loading={busy} />
          <Row style={{ justifyContent: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.saved}>Réponses enregistrées</Text>
          </Row>
        </>
      }
    >
      <ExamImage path={question.image_path} />
      <View style={{ gap: 2 }}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        {question.multiple ? (
          <Text style={styles.hint}>Plusieurs réponses possibles</Text>
        ) : null}
      </View>
      <View style={{ gap: space.sm }}>
        {question.choices.map((c, i) => (
          <Option
            key={c.id}
            index={i}
            label={c.label}
            multiple={question.multiple}
            selected={selected.includes(c.id)}
            onPress={() => setSelected(toggleChoice(question, selected, c.id))}
          />
        ))}
      </View>
    </Screen>
  );
}

function ExamImage({ path }: { path: string | null }) {
  const { bundle } = useApp();
  return <Picture uri={imageUrl(bundle, path)} />;
}

function Correction({ exam }: { exam: Exam }) {
  return (
    <Screen footer={<Button label="Retour aux examens" onPress={() => router.back()} />}>
      <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.lg }}>
        <Text style={{ fontSize: 64 }}>{exam.passed ? "🎓" : "📚"}</Text>
        <Title>{exam.passed ? "Admis !" : "Ajourné"}</Title>
        <Text style={{ fontSize: 40, fontWeight: "900", color: exam.passed ? colors.primaryDark : colors.danger }}>
          {exam.score}/{exam.total}
        </Text>
        <Body muted center>
          {exam.passed ? "Bravo, tu as atteint le seuil de réussite." : `Il faut au moins ${exam.pass_mark}/${exam.total}. Révise tes erreurs et réessaie.`}
        </Body>
      </View>
      <Subtitle>Correction</Subtitle>
      {exam.questions.map((q, i) => (
        <Card key={q.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800", color: colors.muted }}>Question {i + 1}</Text>
            <Badge label={q.is_correct ? "Juste" : "Faux"} tone={q.is_correct ? "primary" : "danger"} />
          </Row>
          <Body>{q.prompt}</Body>
          {q.choices.map((c, i) => {
            const picked = q.selected?.includes(c.id) ?? false;
            return (
              <Option
                key={c.id}
                index={i}
                label={c.label}
                multiple={q.multiple}
                selected={picked}
                state={c.is_correct ? (picked ? "correct" : "missed") : picked ? "wrong" : undefined}
              />
            );
          })}
          {q.explanation ? <Body muted>{q.explanation}</Body> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  timerText: { fontFamily: fonts.black, fontSize: 26, color: colors.navy },
  counter: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  prompt: { fontFamily: fonts.black, fontSize: 23, lineHeight: 29, color: colors.navy, textAlign: "center" },
  hint: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, textAlign: "center" },
  saved: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
});
