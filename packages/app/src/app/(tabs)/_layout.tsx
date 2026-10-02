import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../ui/theme";

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Parcours", tabBarIcon: icon("🛣️") }} />
      <Tabs.Screen name="review" options={{ title: "Réviser", tabBarIcon: icon("🔁") }} />
      <Tabs.Screen name="exams" options={{ title: "Examens", tabBarIcon: icon("📝") }} />
      <Tabs.Screen name="progress" options={{ title: "Progrès", tabBarIcon: icon("📈") }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
