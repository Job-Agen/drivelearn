import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { auth } from "../../lib/auth";
import { Body, Button, ErrorText, Screen, Title } from "../../ui/kit";

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setError(null);
    try {
      await auth.sendVerificationEmail(email);
      setInfo("E-mail renvoyé. Pensez à regarder dans les courriers indésirables.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button label="J'ai confirmé, me connecter" onPress={() => router.replace("/sign-in")} />
          <Button label="Renvoyer l'e-mail" variant="ghost" onPress={resend} />
        </>
      }
    >
      <Text style={{ fontSize: 64, textAlign: "center" }}>📬</Text>
      <Title>Vérifiez votre e-mail</Title>
      <Body>
        Nous avons envoyé un lien de confirmation à <Text style={{ fontWeight: "700" }}>{email}</Text>. Ouvrez-le, puis revenez vous
        connecter.
      </Body>
      {info ? <Body muted>{info}</Body> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
