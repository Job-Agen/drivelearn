import { router } from "expo-router";
import { useState } from "react";
import { AppError } from "../../lib/http";
import { useApp } from "../../state/app";
import { Button, ErrorText, Field, Screen, Title } from "../../ui/kit";

export default function SignIn() {
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      if (e instanceof AppError && e.code === "EMAIL_NOT_VERIFIED") {
        router.push({ pathname: "/verify-email", params: { email: email.trim() } });
      } else setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Se connecter" onPress={submit} loading={busy} disabled={!email || !password} />
          <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => router.push({ pathname: "/forgot-password", params: { email } })} />
        </>
      }
    >
      <Title>Connexion</Title>
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
