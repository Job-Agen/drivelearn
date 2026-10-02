import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { buildPath, findLesson, nextLesson, questionIndex, sample } from "../../domain/path";
import { score } from "../../domain/quiz";
import { useApp } from "../../state/app";
import { Illustration } from "../../ui/Illustration";
import { imageUrl } from "../../ui/images";
import { Body, Button, Mentor, Picture, Screen, Segments, Title, TopBar } from "../../ui/kit";
import { Quiz } from "../../ui/Quiz";
import { Results } from "../../ui/Results";
import { colors, fonts, space } from "../../ui/theme";

type Phase = { name: "intro" } | { name: "quiz" } | { name: "done"; correct: number; total: number; mistakes: string[] };

/** Écrans 09 à 12 : leçon, question, correction, résultat. */
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
  const position = unit.lessons.findIndex((l) => l.id === lesson.id) + 1;

  if (phase.name === "quiz") {
    return (
      <Quiz
        questions={questions}
        onClose={() => router.back()}
        onFinish={(state, startedAt) => {
          finishSession({ kind: "lecon", lessonId: lesson.id, startedAt, answers: state.answers });
          const s = score(state);
          setPhase({ name: "done", correct: s.correct, total: s.total, mistakes: s.mistakes });
        }}
      />
    );
  }

  if (phase.name === "done") {
    const next = nextLesson(buildPath(bundle.content, new Set([...completed, lesson.id])));
    const openNext = next ? () => router.replace(`/lesson/${next.lesson.id}`) : undefined;
    return (
      <Results
        title="Leçon validée !"
        xpLabel="Leçon"
        correct={phase.correct}
        total={phase.total}
        mistakes={phase.mistakes.length}
        onReview={() => router.replace({ pathname: "/practice", params: { mode: "erreurs", ids: phase.mistakes.join(",") } })}
        next={openNext ? { label: "Prochaine leçon\ndébloquée", onPress: openNext } : undefined}
        primary={{ label: "Continuer le parcours", onPress: () => router.back() }}
      />
    );
  }

  return (
    <Screen
      header={
        <>
          <TopBar onBack={() => router.back()} title={unit.title} right={`${position}/${unit.lessons.length}`} />
          <Segments total={unit.lessons.length} done={position} />
        </>
      }
      footer={<Button label="Passer au quiz" onPress={() => setPhase({ name: "quiz" })} />}
    >
      <Picture uri={imageUrl(bundle, lesson.intro_image_path)} />
      <View style={{ gap: space.xs }}>
        <Title center>{lesson.intro_title ?? lesson.title}</Title>
        {lesson.intro_text ? <Body center>{lesson.intro_text}</Body> : null}
      </View>
      {lesson.mentor_tip ? (
        <Mentor text={lesson.mentor_tip}>
          <Illustration name="mentor" size={96} disc={false} />
        </Mentor>
      ) : null}
      <Text style={{ fontFamily: fonts.bold, color: colors.muted, textAlign: "center" }}>
        {questions.length} questions · environ {Math.max(1, Math.round(questions.length * 0.5))} min
      </Text>
    </Screen>
  );
}
