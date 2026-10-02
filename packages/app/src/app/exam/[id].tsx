import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { toggleChoice } from "../../domain/grading";
import { api } from "../../lib/api";
import type { Exam } from "../../lib/types";
import { useApp } from "../../state/app";
import { imageUrl } from "../../ui/images";
import { Badge, Body, Button, Card, ErrorText, Loading, Option, Picture, ProgressBar, Row, Screen, Subtitle, Title } from "../../ui/kit";
import { colors, space } from "../../ui/theme";

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
      else setError(err instanceof Error ? err.message : "Réponse non enregistrée. Vérifiez votre connexion.");
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

  return (
    <Screen
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button label={index + 1 === exam.questions.length ? "Terminer l'examen" : "Question suivante"} onPress={advance} loading={busy} />
        </>
      }
    >
      <Row style={{ justifyContent: "space-between" }}>
        <Button label="Quitter" variant="ghost" onPress={quit} />
        <Text style={{ fontWeight: "800", color: colors.muted }}>
          Question {index + 1}/{exam.total}
        </Text>
        <Text style={{ fontWeight: "900", fontSize: 18, color: left <= 5 ? colors.danger : colors.text }}>⏱ {left}s</Text>
      </Row>
      <ProgressBar value={left / exam.seconds_per_question} color={left <= 5 ? colors.danger : colors.accent} />
      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, textTransform: "uppercase" }}>
        {question.multiple ? "Plusieurs réponses possibles" : "Une seule réponse"}
      </Text>
      <Subtitle>{question.prompt}</Subtitle>
      <ExamImage path={question.image_path} />
      <View style={{ gap: space.sm }}>
        {question.choices.map((c) => (
          <Option
            key={c.id}
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
          {exam.passed ? "Bravo, vous avez atteint le seuil de réussite." : `Il faut au moins ${exam.pass_mark}/${exam.total}. Révisez vos erreurs et réessayez.`}
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
          {q.choices.map((c) => {
            const picked = q.selected?.includes(c.id) ?? false;
            return (
              <Option
                key={c.id}
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
