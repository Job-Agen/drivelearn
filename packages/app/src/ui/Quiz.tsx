import { router } from "expo-router";
import { useReducer, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isFinished, lastAnswerCorrect, quizReducer, startQuiz, type QuizState } from "../domain/quiz";
import type { Question } from "../lib/types";
import { useApp } from "../state/app";
import { imageUrl } from "./images";
import { Body, Button, Option, Picture, ProgressBar, Row, Screen, Subtitle } from "./kit";
import { colors, radius, space } from "./theme";

/** Quiz commun aux leçons et aux révisions : une question à la fois, correction immédiate. */
export function Quiz({
  questions,
  onClose,
  onFinish,
}: {
  questions: Question[];
  onClose: () => void;
  onFinish: (state: QuizState, startedAt: number) => void;
}) {
  const { bundle } = useApp();
  const [state, dispatch] = useReducer(quizReducer, questions, startQuiz);
  const startedAt = useRef(Date.now()).current;
  const question = state.questions[state.index];

  if (!question || isFinished(state)) return null;
  const correctIds = new Set(question.choices.filter((c) => c.is_correct).map((c) => c.id));
  const ok = state.checked && lastAnswerCorrect(state);

  const next = () => {
    const after = quizReducer(state, { type: "next" });
    if (isFinished(after)) onFinish(after, startedAt);
    else dispatch({ type: "next" });
  };

  const footer = state.checked ? (
    <View style={{ gap: space.sm }}>
      <View style={[styles.feedback, ok ? styles.good : styles.bad]}>
        <Text style={[styles.feedbackTitle, { color: ok ? colors.primaryDark : colors.danger }]}>
          {ok ? "Bonne réponse !" : "Pas tout à fait…"}
        </Text>
        {question.explanation ? <Body>{question.explanation}</Body> : null}
        <Pressable onPress={() => router.push({ pathname: "/report", params: { questionId: question.id } })} hitSlop={8}>
          <Text style={styles.report}>Signaler cette question</Text>
        </Pressable>
      </View>
      <Button label="Continuer" onPress={next} variant={ok ? "primary" : "danger"} />
    </View>
  ) : (
    <Button label="Valider" onPress={() => dispatch({ type: "check" })} disabled={state.selected.length === 0} />
  );

  return (
    <Screen footer={footer}>
      <Row>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Quitter">
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={state.index / state.questions.length} />
        </View>
        <Text style={styles.counter}>
          {state.index + 1}/{state.questions.length}
        </Text>
      </Row>
      <Text style={styles.hint}>{question.multiple ? "Plusieurs réponses possibles" : "Une seule réponse"}</Text>
      <Subtitle>{question.prompt}</Subtitle>
      <Picture uri={imageUrl(bundle, question.image_path)} />
      <View style={{ gap: space.sm }}>
        {question.choices.map((choice) => {
          const selected = state.selected.includes(choice.id);
          let mark: "correct" | "wrong" | "missed" | undefined;
          if (state.checked) {
            if (correctIds.has(choice.id)) mark = selected ? "correct" : "missed";
            else if (selected) mark = "wrong";
          }
          return (
            <Option
              key={choice.id}
              label={choice.label}
              selected={selected}
              multiple={question.multiple}
              state={mark}
              onPress={() => dispatch({ type: "toggle", choiceId: choice.id })}
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { fontSize: 22, color: colors.muted, paddingRight: space.xs },
  counter: { color: colors.muted, fontWeight: "700" },
  hint: { color: colors.muted, fontWeight: "700", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.6 },
  feedback: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  good: { backgroundColor: colors.primarySoft },
  bad: { backgroundColor: colors.dangerSoft },
  feedbackTitle: { fontSize: 18, fontWeight: "800" },
  report: { color: colors.muted, textDecorationLine: "underline", marginTop: space.xs },
});
