import { router } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { AppError } from "../../lib/http";
import { useApp } from "../../state/app";
import { Illustration } from "../../ui/Illustration";
import { Body, Button, Divider, ErrorText, Field, Link, Row, Screen, Title } from "../../ui/kit";
import { colors, fonts, space } from "../../ui/theme";

export const TERMS_URL = "https://drivelearn.tg/conditions";
export const PRIVACY_URL = "https://drivelearn.tg/confidentialite";

/** Écran 02 — Créer un compte. Le prénom est demandé ensuite, à la configuration. */
export default function SignUp() {
  const { signUp } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    setError(null);
    try {
      await signUp(email, password);
    } catch (e) {
      if (e instanceof AppError && e.code === "EMAIL_NOT_VERIFIED") {
        router.replace({ pathname: "/verify-email", params: { email: email.trim() } });
      } else setError(e instanceof Error ? e.message : "Inscription impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Créer mon compte" onPress={submit} loading={busy} disabled={!email || !password} />
          <Divider />
          <Row style={{ justifyContent: "center", gap: 4 }}>
            <Body>Déjà inscrit ?</Body>
            <Link label="Se connecter" onPress={() => router.replace("/sign-in")} />
          </Row>
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Illustration name="mentorThumbs" size={180} />
        <Title center>Bienvenue chez{"\n"}DriveLearn</Title>
        <Body muted center>
          Crée ton compte pour commencer ton apprentissage.
        </Body>
      </View>
      <Field icon="mail-outline" placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field icon="lock-closed-outline" placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      <Body muted center>
        En continuant, tu acceptes les conditions d'utilisation.
      </Body>
      <Row style={{ justifyContent: "center" }}>
        <Link label="Conditions" onPress={() => Linking.openURL(TERMS_URL)} />
        <Text style={{ color: colors.blueDark, fontFamily: fonts.bold }}>•</Text>
        <Link label="Confidentialité" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Row>
    </Screen>
  );
}
