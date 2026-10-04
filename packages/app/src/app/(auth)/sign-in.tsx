import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppError } from "../../lib/http";
import { useApp } from "../../state/app";
import { Illustration } from "../../ui/Illustration";
import { Body, Button, ErrorText, Field, Link, Logo, Screen, Title } from "../../ui/kit";
import { space } from "../../ui/theme";

/** Écran 03 — Se connecter. */
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
          <Button label="Créer un compte" variant="outline" onPress={() => router.replace("/sign-up")} />
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Logo size={40} />
        <Title center>Heureux de te revoir !</Title>
        <Body muted center>
          Connecte-toi pour reprendre ton parcours.
        </Body>
        <Illustration name="studentWave" width={240} />
      </View>
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Link align="flex-end" label="Mot de passe oublié ?" onPress={() => router.push({ pathname: "/forgot-password", params: { email } })} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
