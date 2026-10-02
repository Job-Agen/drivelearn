import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { auth } from "../../lib/auth";
import { Illustration } from "../../ui/Illustration";
import { Body, Button, ErrorText, Link, Screen, Title } from "../../ui/kit";
import { fonts, space } from "../../ui/theme";

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
    <Screen
      footer={
        <>
          <Button label="J'ai confirmé, me connecter" onPress={() => router.replace("/sign-in")} />
          <Link label="Renvoyer l'e-mail" onPress={resend} />
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Illustration name="mailLock" size={200} />
        <Title center>Vérifie ton e-mail</Title>
        <Body center>
          Nous avons envoyé un lien de confirmation à <Text style={{ fontFamily: fonts.extrabold }}>{email}</Text>. Ouvre-le, puis
          reviens te connecter.
        </Body>
      </View>
      {info ? <Body muted center>{info}</Body> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
