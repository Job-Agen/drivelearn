import { router } from "expo-router";
import { useState } from "react";
import { AppError } from "../../lib/http";
import { useApp } from "../../state/app";
import { Body, Button, ErrorText, Field, Screen, Title } from "../../ui/kit";

export default function SignUp() {
  const { signUp } = useApp();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    setError(null);
    try {
      await signUp(email, password, firstName);
    } catch (e) {
      if (e instanceof AppError && e.code === "EMAIL_NOT_VERIFIED") {
        router.replace({ pathname: "/verify-email", params: { email: email.trim() } });
      } else setError(e instanceof Error ? e.message : "Inscription impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Créer mon compte" onPress={submit} loading={busy} disabled={!email || !password || !firstName.trim()} />}>
      <Title>Créer un compte</Title>
      <Body muted>Votre progression est sauvegardée et vous suit sur un nouveau téléphone.</Body>
      <Field label="Prénom" value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={40} />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Mot de passe (8 caractères minimum)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
