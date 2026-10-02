import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { api } from "../../lib/api";
import { useApp } from "../../state/app";
import { Badge, Body, Button, Card, ErrorText, Row, Screen, Title } from "../../ui/kit";
import { colors } from "../../ui/theme";

type Status = Awaited<ReturnType<typeof api.examStatus>>;
type History = Awaited<ReturnType<typeof api.examHistory>>;

/** Écrans 15, 18, 20 : accès aux examens blancs et historique. Connexion requise. */
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
  const canStart = status ? status.has_pass || status.free_exam_available || history.some((h) => !h.submitted_at) : false;

  return (
    <Screen>
      <Title>Examens blancs</Title>
      {program ? (
        <Body muted>
          Comme le jour J : {program.exam_question_count} questions, {program.exam_seconds_per_question} s par question, pas de retour
          en arrière. Admis à partir de {program.exam_pass_mark}/{program.exam_question_count}.
        </Body>
      ) : null}

      {status ? (
        <Card>
          {status.has_pass ? (
            <>
              <Badge label="Pass Examen actif" />
              <Body>Examens illimités jusqu'au {new Date(status.pass_ends_at!).toLocaleDateString("fr-FR")}.</Body>
            </>
          ) : status.free_exam_available ? (
            <>
              <Badge label="1 examen offert" tone="accent" />
              <Body>Votre premier examen blanc est gratuit.</Body>
            </>
          ) : (
            <>
              <Badge label="Pass Examen" tone="muted" />
              <Body>Le Pass Examen (90 jours, examens illimités) sera bientôt disponible au paiement par Flooz et T-Money.</Body>
            </>
          )}
          {status.exams_taken > 0 ? (
            <Body muted>
              Prêt pour l'examen : {status.consecutive_passes}/{status.required_passes} réussites d'affilée {status.ready ? "✅" : ""}
            </Body>
          ) : null}
        </Card>
      ) : null}

      <Button label="Passer un examen blanc" onPress={start} loading={busy} disabled={!canStart} />
      <ErrorText>{error}</ErrorText>
      {error && !status ? <Button label="Réessayer" variant="secondary" onPress={load} /> : null}

      {history.length > 0 ? <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Historique</Text> : null}
      {history.map((h) => (
        <Pressable key={h.attempt_id} onPress={() => router.push(`/exam/${h.attempt_id}`)}>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {h.submitted_at ? new Date(h.submitted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "En cours"}
              </Text>
              {h.submitted_at ? (
                <Badge label={`${h.score}/${h.total} · ${h.passed ? "Admis" : "Ajourné"}`} tone={h.passed ? "primary" : "danger"} />
              ) : (
                <Badge label="Reprendre" tone="accent" />
              )}
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
