import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "../state/app";
import { Loading } from "../ui/kit";
import { colors } from "../ui/theme";

function Navigator() {
  const { status, me } = useApp();
  if (status === "loading") return <Loading />;
  const signedIn = status === "signedIn";
  const onboarded = Boolean(me?.program_id && me.first_name);

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
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Navigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
