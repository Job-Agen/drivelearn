import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../state/app";
import { Loading } from "../ui/kit";
import { colors } from "../ui/theme";

function Navigator() {
  const { status, me } = useApp();
  if (status === "loading") return <Loading />;
  const signedIn = status === "signedIn";
  const onboarded = Boolean(me?.program_id);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lesson/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="practice" options={{ gestureEnabled: false }} />
        <Stack.Screen name="exam/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="report" />
        <Stack.Screen name="exams" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="premium" />
        <Stack.Screen name="pass" />
        <Stack.Screen name="pass-confirmed" />
        <Stack.Screen name="delete-account" />
      </Stack.Protected>
      {/* Ouvert depuis le lien de réinitialisation reçu par e-mail, connecté ou non.
          Déclaré en dernier : après une connexion, le routeur ouvre le premier écran accessible. */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

// Navigateur (développement) : pas de contour bleu/noir autour des champs, le cadre du champ suffit.
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = "input, textarea { outline: none !important; }";
  document.head.appendChild(style);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  if (!fontsLoaded) return <Loading />;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
