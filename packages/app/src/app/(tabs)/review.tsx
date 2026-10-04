import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { unitQuestions } from "../../domain/path";
import { useApp } from "../../state/app";
import { Illustration, type IllustrationName } from "../../ui/Illustration";
import { Screen, Title } from "../../ui/kit";
import { colors, fonts, radius, space } from "../../ui/theme";

const THEME_ICONS: IllustrationName[] = ["themeDanger", "themePriority"];

/** Écran 13 — Réviser. */
export default function ReviewScreen() {
  const { bundle, localReview } = useApp();
  const mistakes = localReview().length;
  const units = bundle?.content.units ?? [];

  return (
    <Screen tabs>
      <Title center size={28}>
        On progresse ensemble
      </Title>
      <View style={styles.mentorRow}>
        <Illustration name="reviewMentor" width={170} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>Chaque erreur est une occasion d'apprendre !</Text>
        </View>
      </View>

      <LinearGradient colors={["#1E7FE0", "#1558C0"]} style={styles.mistakes}>
        <Pressable style={styles.mistakesHead} onPress={() => router.push({ pathname: "/practice", params: { mode: "erreurs" } })}>
          <View style={styles.mistakesIcon}>
            <Ionicons name="document-text" size={32} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mistakesTitle}>Mes erreurs</Text>
            <Text style={styles.mistakesCount}>
              {mistakes} question{mistakes > 1 ? "s" : ""} à revoir
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color="#fff" />
        </Pressable>
        <Pressable style={styles.mistakesButton} onPress={() => router.push({ pathname: "/practice", params: { mode: "erreurs" } })} accessibilityRole="button">
          <Text style={styles.mistakesButtonText}>Réviser mes erreurs</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.navy} style={{ position: "absolute", right: 20 }} />
        </Pressable>
      </LinearGradient>

      <Text style={styles.section}>Réviser par thème</Text>
      <View style={styles.grid}>
        {units.map((unit, i) => {
          const count = unitQuestions(unit).length;
          return (
            <Pressable
              key={unit.id}
              style={styles.theme}
              onPress={() => router.push({ pathname: "/practice", params: { mode: "theme", unit: unit.id } })}
              accessibilityRole="button"
            >
              {THEME_ICONS[i] ? (
                <Illustration name={THEME_ICONS[i]} width={56} style={{ alignSelf: "flex-start" }} />
              ) : (
                <Ionicons name="school" size={44} color={colors.blue} />
              )}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.themeTitle} numberOfLines={2}>
                    {unit.title}
                  </Text>
                  <Text style={styles.themeCount}>
                    {count} question{count > 1 ? "s" : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.navy} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.exams} onPress={() => router.push("/exams")} accessibilityRole="button">
        <View style={styles.examsIcon}>
          <Ionicons name="stopwatch-outline" size={34} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.examsTitle}>Examens blancs</Text>
          <Text style={styles.examsText}>Entraîne-toi en conditions chronométrées</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.navy} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mentorRow: { flexDirection: "row", alignItems: "center", marginBottom: -space.xl, zIndex: 0 },
  bubble: { flex: 1, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: space.md, marginLeft: -space.sm },
  bubbleText: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.navy },
  mistakes: { borderRadius: radius.lg, padding: space.md, gap: space.md, zIndex: 1 },
  mistakesHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  mistakesIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#E6F1FC", alignItems: "center", justifyContent: "center" },
  mistakesTitle: { fontFamily: fonts.black, fontSize: 26, color: "#fff" },
  mistakesCount: { fontFamily: fonts.semibold, fontSize: 18, color: "#fff" },
  mistakesButton: { backgroundColor: "#fff", borderRadius: radius.pill, minHeight: 52, alignItems: "center", justifyContent: "center" },
  mistakesButtonText: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.navy },
  section: { fontFamily: fonts.black, fontSize: 20, color: colors.navy },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  theme: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  themeTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
  themeCount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  exams: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  examsIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  examsTitle: { fontFamily: fonts.black, fontSize: 20, color: colors.navy },
  examsText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
});
