import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { questionIndex, sample, unitQuestions } from "../domain/path";
import { score } from "../domain/quiz";
import { api } from "../lib/api";
import { REVIEW_BATCH } from "../lib/config";
import type { Question } from "../lib/types";
import { useApp } from "../state/app";
import { Body, Button, Loading, Screen } from "../ui/kit";
import { Quiz } from "../ui/Quiz";
import { Results } from "../ui/Results";

type Result = { correct: number; total: number; mistakes: number };

/** Écrans 13 et 14 : révision de mes erreurs, ou d'un thème. */
export default function PracticeScreen() {
  const { mode, unit: unitId, ids } = useLocalSearchParams<{ mode: "erreurs" | "theme"; unit?: string; ids?: string }>();
  const { bundle, finishSession, localReview } = useApp();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const again = () => {
    setResult(null);
    setQuestions(null);
    setRound(round + 1);
  };
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!bundle) return;
    const index = questionIndex(bundle.content);
    if (mode === "theme") {
      const unit = bundle.content.units.find((u) => u.id === unitId);
      setQuestions(unit ? sample(unitQuestions(unit), REVIEW_BATCH) : []);
      return;
    }
    const pick = (list: string[]) => setQuestions(list.map((id) => index.get(id)).filter((q) => q !== undefined));
    // « Revoir mon erreur » en fin de leçon : exactement les questions ratées, sans attendre le serveur.
    if (ids && round === 0) return pick(ids.split(","));
    // Mes erreurs : la liste du serveur fait foi ; hors ligne, on se sert du suivi local.
    api
      .review(REVIEW_BATCH)
      .then((r) => pick(r.question_ids))
      .catch(() => pick(sample(localReview(), REVIEW_BATCH)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.version, mode, unitId, ids, round]);

  if (!questions) return <Loading />;

  if (result) {
    return (
      <Results
        title="Révision terminée !"
        xpLabel="Révision"
        correct={result.correct}
        total={result.total}
        mistakes={result.mistakes}
        onReview={mode === "erreurs" ? again : undefined}
        next={mode === "theme" ? { label: "Encore une\nsérie", onPress: again } : undefined}
        primary={{ label: "Terminer", onPress: () => router.back() }}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <Screen footer={<Button label="Retour" onPress={() => router.back()} />}>
        <Body center>
          {mode === "erreurs" ? "🎉 Aucune erreur à revoir pour le moment. Continue le parcours !" : "Pas encore de questions pour ce thème."}
        </Body>
      </Screen>
    );
  }

  return (
    <Quiz
      key={round}
      questions={questions}
      onClose={() => router.back()}
      onFinish={(state, startedAt) => {
        finishSession({ kind: mode === "theme" ? "theme" : "erreurs", unitId: mode === "theme" ? unitId : null, startedAt, answers: state.answers });
        const s = score(state);
        setResult({ correct: s.correct, total: s.total, mistakes: s.mistakes.length });
      }}
    />
  );
}
