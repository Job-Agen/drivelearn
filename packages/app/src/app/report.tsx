import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { unitQuestions } from "../domain/path";
import { api } from "../lib/api";
import type { ReportReason } from "../lib/types";
import { useApp } from "../state/app";
import { imageUrl } from "../ui/images";
import { Body, Button, ErrorText, Picture, Screen, Title, TopBar } from "../ui/kit";
import { Radio } from "../ui/parts";
import { colors, fonts, radius, space } from "../ui/theme";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "reponse_incorrecte", label: "Réponse incorrecte" },
  { value: "explication_peu_claire", label: "Explication peu claire" },
  { value: "probleme_image", label: "Problème d'image" },
];

/** Écran 26 — Signaler une question. */
export default function ReportScreen() {
  const { questionId } = useLocalSearchParams<{ questionId: string }>();
  const { bundle } = useApp();
  const [reason, setReason] = useState<ReportReason>("reponse_incorrecte");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  let found: { unit: string; number: number; prompt: string; image: string | null } | null = null;
  for (const unit of bundle?.content.units ?? []) {
    const list = unitQuestions(unit);
    const i = list.findIndex((q) => q.id === questionId);
    if (i >= 0) found = { unit: unit.title, number: i + 1, prompt: list[i].prompt, image: list[i].image_path };
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.report(questionId, reason, comment.trim() || null);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen header={<TopBar onBack={() => router.back()} title="Signaler une question" />} footer={<Button label="Fermer" onPress={() => router.back()} />}>
        <Title center>Merci !</Title>
        <Body center>Ton signalement a été transmis. Notre équipe va vérifier cette question.</Body>
      </Screen>
    );
  }

  const uri = imageUrl(bundle, found?.image ?? null);
  return (
    <Screen header={<TopBar onBack={() => router.back()} title="Signaler une question" />}>
      <View style={{ gap: space.xs }}>
        <Title center size={26}>
          Aide-nous à améliorer le cours
        </Title>
        <Body muted center>
          Ton retour nous aide à proposer des contenus de meilleure qualité.
        </Body>
      </View>
      {found ? (
        <View style={styles.question}>
          <View style={styles.thumb}>{uri ? <Picture uri={uri} /> : <Ionicons name="warning" size={40} color={colors.danger} />}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.questionTitle}>
              {found.unit} · Question {found.number}
            </Text>
            <Text style={styles.questionText} numberOfLines={2}>
              {found.prompt}
            </Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.label}>Raison du signalement</Text>
      {REASONS.map((r) => (
        <Pressable key={r.value} style={styles.reason} onPress={() => setReason(r.value)} accessibilityRole="radio" accessibilityState={{ checked: reason === r.value }}>
          <Radio on={reason === r.value} />
          <Text style={styles.reasonText}>{r.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.label}>Ton commentaire (facultatif)</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={500}
        placeholder="Écris ici ton commentaire…"
        placeholderTextColor={colors.muted}
        style={styles.comment}
        accessibilityLabel="Ton commentaire"
      />
      <ErrorText>{error}</ErrorText>
      <Button label="Envoyer le signalement" onPress={submit} loading={busy} />
      <Button label="Annuler" variant="soft" chevron={false} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  thumb: { width: 90, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, overflow: "hidden" },
  questionTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.navy },
  questionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  label: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
  reason: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 4 },
  reasonText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.navy },
  comment: {
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
});
