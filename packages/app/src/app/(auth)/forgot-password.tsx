import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { auth } from "../../lib/auth";
import { Body, Button, ErrorText, Field, Screen, Title } from "../../ui/kit";

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Envoyer le lien" onPress={submit} loading={busy} disabled={!email || sent} />}>
      <Title>Mot de passe oublié</Title>
      <Body muted>Nous vous envoyons un lien pour choisir un nouveau mot de passe.</Body>
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {sent ? <Body>Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.</Body> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
