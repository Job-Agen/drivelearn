import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { buildPath, findLesson, nextLesson, questionIndex, sample } from "../../domain/path";
import { score } from "../../domain/quiz";
import { useApp } from "../../state/app";
import { imageUrl } from "../../ui/images";
import { Badge, Body, Button, Card, Picture, Screen, Title } from "../../ui/kit";
import { Quiz } from "../../ui/Quiz";
import { Results } from "../../ui/Results";
import { colors, space } from "../../ui/theme";

type Phase = { name: "intro" } | { name: "quiz" } | { name: "done"; correct: number; total: number; mistakes: number };

/** Écrans 09 à 12 : explication, quiz, fin de leçon. */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bundle, completed, finishSession, localReview } = useApp();
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const found = bundle ? findLesson(bundle.content, id) : null;

  // Quelques erreurs passées sont glissées dans la leçon pour les revoir au bon moment.
  const questions = useMemo(() => {
    if (!bundle || !found) return [];
    const own = new Set(found.lesson.questions.map((q) => q.id));
    const index = questionIndex(bundle.content);
    const extra = sample(localReview().filter((qid) => !own.has(qid)), bundle.max_review_per_lesson)
      .map((qid) => index.get(qid))
      .filter((q) => q !== undefined);
    return [...found.lesson.questions, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.version, id]);

  if (!bundle || !found) {
    return (
      <Screen footer={<Button label="Retour" onPress={() => router.back()} />}>
        <Body>Cette leçon n'est plus disponible.</Body>
      </Screen>
    );
  }
  const { lesson, unit } = found;

  if (phase.name === "quiz") {
    return (
      <Quiz
        questions={questions}
        onClose={() => router.back()}
        onFinish={(state, startedAt) => {
          finishSession({ kind: "lecon", lessonId: lesson.id, startedAt, answers: state.answers });
          const s = score(state);
          setPhase({ name: "done", correct: s.correct, total: s.total, mistakes: s.mistakes.length });
        }}
      />
    );
  }

  if (phase.name === "done") {
    const next = nextLesson(buildPath(bundle.content, new Set([...completed, lesson.id])));
    return (
      <Results
        title="Leçon terminée !"
        correct={phase.correct}
        total={phase.total}
        mistakes={phase.mistakes}
        primary={
          next
            ? { label: `Leçon suivante : ${next.lesson.title}`, onPress: () => router.replace(`/lesson/${next.lesson.id}`) }
            : { label: "Retour au parcours", onPress: () => router.back() }
        }
        secondary={next ? { label: "Retour au parcours", onPress: () => router.back() } : undefined}
      />
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Commencer le quiz" onPress={() => setPhase({ name: "quiz" })} />
          <Button label="Plus tard" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Badge label={unit.title} />
      <Title>{lesson.intro_title ?? lesson.title}</Title>
      <Picture uri={imageUrl(bundle, lesson.intro_image_path)} />
      {lesson.intro_text ? <Body>{lesson.intro_text}</Body> : null}
      {lesson.mentor_tip ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Text style={{ fontSize: 28 }}>🧑‍🏫</Text>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={{ fontWeight: "800", color: "#8A5A00" }}>Le conseil du moniteur</Text>
              <Body>{lesson.mentor_tip}</Body>
            </View>
          </View>
        </Card>
      ) : null}
      <Body muted>
        {questions.length} questions · environ {Math.max(1, Math.round(questions.length * 0.5))} min
      </Body>
    </Screen>
  );
}
