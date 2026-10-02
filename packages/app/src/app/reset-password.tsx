import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { auth } from "../lib/auth";
import { useApp } from "../state/app";
import { Illustration } from "../ui/Illustration";
import { Body, Button, ErrorText, Field, Screen, Title, TopBar } from "../ui/kit";
import { space } from "../ui/theme";

/** Écran 25 — Nouveau mot de passe (ouvert depuis le lien reçu par e-mail). */
export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { status, signOut } = useApp();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toSignIn = async () => {
    if (status === "signedIn") await signOut();
    router.replace("/sign-in");
  };

  const submit = async () => {
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    if (!token) return setError("Ce lien n'est plus valable. Demande un nouveau lien.");
    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<TopBar onBack={toSignIn} title="Nouveau mot de passe" />}>
      <Illustration name="lock" width={250} />
      <View style={{ gap: space.xs }}>
        <Title center>Sécurise ton compte</Title>
        <Body muted center>
          {done
            ? "Ton mot de passe a été changé. Tu peux te connecter."
            : "Choisis un nouveau mot de passe pour continuer à utiliser DriveLearn en toute sécurité."}
        </Body>
      </View>
      {!done ? (
        <>
          <Field icon="lock-closed-outline" placeholder="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Field icon="lock-closed-outline" placeholder="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
          <ErrorText>{error}</ErrorText>
          <Button label="Enregistrer le mot de passe" onPress={submit} loading={busy} disabled={!password || !confirm} />
        </>
      ) : null}
      <Button label={done ? "Se connecter" : "Retour à la connexion"} variant={done ? "primary" : "soft"} chevron={done} onPress={toSignIn} />
    </Screen>
  );
}
