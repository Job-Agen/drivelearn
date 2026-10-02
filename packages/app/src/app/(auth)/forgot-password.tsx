import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { auth } from "../../lib/auth";
import { Illustration } from "../../ui/Illustration";
import { Body, Button, ErrorText, Field, Link, Screen, Title, TopBar } from "../../ui/kit";
import { space } from "../../ui/theme";

/** Écran 04 — Récupérer mon accès. */
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
    <Screen header={<TopBar onBack={() => router.back()} />}>
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Illustration name="mailLock" size={200} />
        <Title center>Mot de passe oublié ?</Title>
        <Body muted center>
          Reçois un lien pour choisir un nouveau mot de passe.
        </Body>
      </View>
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {sent ? <Body center>Si un compte existe pour cette adresse, le lien vient de partir. Pense à regarder dans les courriers indésirables.</Body> : null}
      <ErrorText>{error}</ErrorText>
      <Button label={sent ? "Lien envoyé" : "Envoyer le lien"} onPress={submit} loading={busy} disabled={!email || sent} />
      <Link label="Retour à la connexion" onPress={() => router.replace("/sign-in")} />
    </Screen>
  );
}
