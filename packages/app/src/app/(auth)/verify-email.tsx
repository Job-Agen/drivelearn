import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { auth } from "../../lib/auth";
import { Illustration } from "../../ui/Illustration";
import { Body, Button, ErrorText, Screen, Title, TopBar } from "../../ui/kit";
import { colors, fonts, space } from "../../ui/theme";

/** Écran 05 — Vérifier mon e-mail. */
export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setError(null);
    try {
      await auth.sendVerificationEmail(email);
      setInfo("E-mail renvoyé. Pense à regarder dans les courriers indésirables.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    }
  };

  return (
    <Screen header={<TopBar onBack={() => router.back()} title="Vérifier mon e-mail" />}>
      <Illustration name="mailCheck" width="100%" style={{ borderRadius: 24, overflow: "hidden" }} />
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Title center size={32}>
          Vérifie ton adresse
        </Title>
        <Body muted center>
          Ouvre le lien reçu par e-mail,{"\n"}puis reviens ici.
        </Body>
      </View>
      <Button label="J'ai vérifié mon adresse" onPress={() => router.replace("/sign-in")} />
      <Button label="Renvoyer l'e-mail" variant="outline" icon="refresh" onPress={resend} />
      {info ? <Body muted center>{info}</Body> : null}
      <ErrorText>{error}</ErrorText>
      <Pressable onPress={() => router.replace("/sign-up")} style={{ alignSelf: "center" }} accessibilityRole="link">
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.blueDark, textDecorationLine: "underline" }}>Modifier mon adresse</Text>
      </Pressable>
    </Screen>
  );
}
