import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors, fonts } from "../../ui/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? on : off} size={26} color={color as string} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12 },
        tabBarStyle: { height: 64, paddingTop: 6, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Parcours", tabBarIcon: icon("book", "book-outline") }} />
      <Tabs.Screen name="review" options={{ title: "Réviser", tabBarIcon: icon("document-text", "document-text-outline") }} />
      <Tabs.Screen name="progress" options={{ title: "Progrès", tabBarIcon: icon("bar-chart", "bar-chart-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: icon("person", "person-outline") }} />
    </Tabs>
  );
}
