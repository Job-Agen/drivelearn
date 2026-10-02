import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { api } from "../lib/api";
import type { ReportReason } from "../lib/types";
import { Body, Button, ErrorText, Field, Option, Screen, Title } from "../ui/kit";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "reponse_incorrecte", label: "La réponse me semble incorrecte" },
  { value: "explication_peu_claire", label: "L'explication n'est pas claire" },
  { value: "probleme_image", label: "Problème avec l'image" },
];

/** Écran 26 : signaler une question. */
export default function ReportScreen() {
  const { questionId } = useLocalSearchParams<{ questionId: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
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
      <Screen footer={<Button label="Fermer" onPress={() => router.back()} />}>
        <Title>Merci !</Title>
        <Body>Ton signalement a été transmis. Notre équipe va vérifier cette question.</Body>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Envoyer" onPress={submit} disabled={!reason} loading={busy} />
          <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <Title>Signaler cette question</Title>
      {REASONS.map((r) => (
        <Option key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
      ))}
      <Field label="Commentaire (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={500} style={{ minHeight: 90, textAlignVertical: "top" }} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
