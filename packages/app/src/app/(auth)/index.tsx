import { router } from "expo-router";
import { Text, View } from "react-native";
import { Body, Button, Screen, Title } from "../../ui/kit";
import { colors, space } from "../../ui/theme";

export default function Welcome() {
  return (
    <Screen
      footer={
        <>
          <Button label="Commencer" onPress={() => router.push("/sign-up")} />
          <Button label="J'ai déjà un compte" variant="secondary" onPress={() => router.push("/sign-in")} />
        </>
      }
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md }}>
        <Text style={{ fontSize: 88 }}>🚦</Text>
        <Title>DriveLearn</Title>
        <Text style={{ fontSize: 18, color: colors.primaryDark, fontWeight: "700", textAlign: "center" }}>
          Le code de la route, quelques minutes par jour.
        </Text>
        <Body muted center>
          Des leçons courtes, des révisions ciblées et des examens blancs conformes à l'examen officiel.
        </Body>
      </View>
    </Screen>
  );
}
