import { router } from "expo-router";
import { useReducer, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { isFinished, lastAnswerCorrect, quizReducer, startQuiz, type QuizState } from "../domain/quiz";
import type { Question } from "../lib/types";
import { useApp } from "../state/app";
import { Illustration } from "./Illustration";
import { imageUrl } from "./images";
import { Body, Button, Link, Mentor, Option, Picture, Screen, Segments, TopBar } from "./kit";
import { Chip } from "./parts";
import { colors, fonts, space } from "./theme";

/** Écrans 10 (question) et 11 (correction), communs aux leçons et aux révisions. */
export function Quiz({
  questions,
  onClose,
  onFinish,
  title,
  chipFor,
}: {
  questions: Question[];
  /** Titre de l'en-tête (écran 14 « Mes erreurs ») : retour à gauche, compteur à droite. */
  title?: string;
  /** Étiquette du thème affichée au-dessus de l'image (écran 14). */
  chipFor?: (question: Question) => string | null;
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
  const total = state.questions.length;

  const next = () => {
    const after = quizReducer(state, { type: "next" });
    if (isFinished(after)) onFinish(after, startedAt);
    else dispatch({ type: "next" });
  };

  const chip = chipFor?.(question);
  const header = (
    <>
      {title ? <TopBar onBack={onClose} title={title} right={`${state.index + 1} / ${total}`} /> : <TopBar onClose={onClose} />}
      <Segments total={total} done={state.index + 1} />
    </>
  );

  const choices = (
    <View style={{ gap: space.sm }}>
      {question.choices.map((choice, i) => {
        const selected = state.selected.includes(choice.id);
        let mark: "correct" | "wrong" | "missed" | undefined;
        if (state.checked) {
          if (correctIds.has(choice.id)) mark = selected ? "correct" : "missed";
          else if (selected) mark = "wrong";
        }
        return (
          <Option
            key={choice.id}
            index={i}
            label={choice.label}
            selected={selected}
            multiple={question.multiple}
            state={mark}
            onPress={() => dispatch({ type: "toggle", choiceId: choice.id })}
          />
        );
      })}
    </View>
  );

  if (state.checked) {
    return (
      <Screen
        header={header}
        footer={
          <>
            <Button label="Continuer" onPress={next} />
            <Link icon="flag" label="Signaler cette question" onPress={() => router.push({ pathname: "/report", params: { questionId: question.id } })} />
          </>
        }
      >
        <View style={styles.cheer}>
          <Text style={styles.confetti}>{ok ? "✦" : ""}</Text>
          <Text style={[styles.cheerText, !ok && { color: colors.danger }]}>{ok ? "Bien joué !" : "Pas tout à fait…"}</Text>
          <Text style={styles.confetti}>{ok ? "✦" : ""}</Text>
        </View>
        <Picture uri={imageUrl(bundle, question.image_path)} />
        {choices}
        <Mentor text={question.explanation ?? (ok ? "C'est la bonne réponse, continue comme ça !" : "Regarde bien la bonne réponse en vert.")}>
          <Illustration name="mentor" width={120} />
        </Mentor>
      </Screen>
    );
  }

  return (
    <Screen header={header} footer={<Button label="Valider" onPress={() => dispatch({ type: "check" })} disabled={state.selected.length === 0} />}>
      {title ? null : (
        <Body muted>
          Question {state.index + 1} sur {total}
        </Body>
      )}
      {chip ? <Chip label={chip} icon="warning-outline" /> : null}
      <Picture uri={imageUrl(bundle, question.image_path)} />
      <View style={{ gap: 2 }}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Body muted center>
          {question.multiple ? "Plusieurs réponses possibles" : "Une seule réponse"}
        </Body>
      </View>
      {choices}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prompt: { fontFamily: fonts.black, fontSize: 23, lineHeight: 29, color: colors.navy, textAlign: "center" },
  cheer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.md },
  cheerText: { fontFamily: fonts.black, fontSize: 34, color: colors.navy },
  confetti: { fontSize: 22, color: colors.primary },
});
