import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildPath, nextLesson, type PathUnit } from "../../domain/path";
import { useApp } from "../../state/app";
import { Flag, Illustration } from "../../ui/Illustration";
import { Body, Button, Loading } from "../../ui/kit";
import { colors, fonts, radius, space } from "../../ui/theme";

/** Écran 08 — Mon parcours. */
export default function PathScreen() {
  const { me, bundle, completed, progress, syncing, refresh, pendingCount, lastError } = useApp();

  if (!bundle) {
    return syncing ? (
      <Loading />
    ) : (
      <SafeAreaView style={{ flex: 1, padding: space.md, gap: space.md, justifyContent: "center", backgroundColor: colors.bg }}>
        <Body center>{lastError ?? "Connecte-toi à internet pour télécharger les leçons (une seule fois)."}</Body>
        <Button label="Réessayer" onPress={refresh} />
      </SafeAreaView>
    );
  }

  const path = buildPath(bundle.content, completed);
  const next = nextLesson(path);
  const goal = progress?.daily_goal_minutes ?? me?.daily_goal_minutes ?? 5;
  const today = Math.min(progress?.today_minutes ?? 0, goal);
  const country = bundle.content.program.name;

  const openUnit = (u: PathUnit) => {
    const target = u.lessons.find((l) => l.state === "current") ?? u.lessons[0];
    if (target && target.state !== "locked") router.push(`/lesson/${target.lesson.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <Illustration name="avatarMentor" width={46} round />
          <Text style={styles.hello} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            Bonjour{me?.first_name ? `, ${me.first_name}` : ""} !
          </Text>
          <Pressable style={styles.country} onPress={() => router.push("/settings")} accessibilityLabel={`Pays : ${country}`}>
            <Flag country="TG" width={26} />
            <Text style={styles.countryText}>{country}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.navy} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={styles.stat}>
            <Illustration name="flame" width={36} />
            <View>
              <Text style={styles.statValue}>
                {progress?.current_streak ?? 0} jour{(progress?.current_streak ?? 0) > 1 ? "s" : ""}
              </Text>
              <Text style={styles.statLabel}>Série d'apprentissage</Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Illustration name="star" width={38} />
            <View>
              <Text style={styles.statValue}>{progress?.total_xp ?? 0} XP</Text>
              <Text style={styles.statLabel}>Points gagnés</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push("/progress")} accessibilityRole="button">
          <LinearGradient colors={["#1E7FE0", "#1558C0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goal}>
            <View style={styles.goalIcon}>
              <MaterialCommunityIcons name="bullseye-arrow" size={36} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>Objectif du jour</Text>
              <Text style={styles.goalValue}>
                {today} / {goal} <Text style={{ fontFamily: fonts.semibold, fontSize: 18 }}>min</Text>
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </Pressable>
        {pendingCount > 0 ? <Text style={styles.pending}>⏳ {pendingCount} séance(s) en attente de connexion</Text> : null}

        <View>
          {path.map((u, i) => {
            const current = !u.done && u.lessons.some((l) => l.state === "current");
            const locked = !u.done && !current;
            const last = i === path.length - 1;
            return (
              <Pressable key={u.unit.id} onPress={() => openUnit(u)} disabled={locked} style={styles.unitRow} accessibilityRole="button">
                <View style={styles.rail}>
                  <View style={[styles.dot, current && styles.dotCurrent, locked && styles.dotLocked]}>
                    {current ? (
                      <MaterialCommunityIcons name="steering" size={40} color="#fff" />
                    ) : (
                      <Ionicons name={u.done ? "checkmark" : "lock-closed"} size={28} color="#fff" />
                    )}
                  </View>
                  {!last ? <View style={[styles.line, locked && { backgroundColor: colors.locked }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingTop: current ? 10 : 4, paddingBottom: space.lg, gap: 2 }}>
                  <Text style={[styles.unitNumber, current && { color: colors.blue }]}>Unité {i + 1}</Text>
                  <Text style={styles.unitTitle}>{u.unit.title}</Text>
                  {u.done ? (
                    <View style={styles.status}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      <Text style={[styles.statusText, { color: colors.primaryDark }]}>Terminée</Text>
                    </View>
                  ) : current ? (
                    <View style={styles.inProgress}>
                      <Text style={styles.inProgressText}>En cours</Text>
                    </View>
                  ) : (
                    <View style={styles.status}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.locked} />
                      <Text style={styles.statusText}>Termine la leçon précédente</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {next ? (
          <Button label="Continuer" onPress={() => router.push(`/lesson/${next.lesson.id}`)} />
        ) : path.length > 0 ? (
          <Button label="Passer un examen blanc" onPress={() => router.push("/exams")} />
        ) : (
          <Body muted center>
            Les leçons arrivent bientôt.
          </Body>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hello: { flex: 1, fontFamily: fonts.black, fontSize: 21, color: colors.navy },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
  },
  statValue: { fontFamily: fonts.black, fontSize: 21, color: colors.navy },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  goal: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.md, padding: space.md },
  goalIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, borderWidth: 3, borderColor: "#ffffff66", alignItems: "center", justifyContent: "center" },
  goalTitle: { fontFamily: fonts.bold, fontSize: 18, color: "#fff" },
  goalValue: { fontFamily: fonts.black, fontSize: 26, color: "#fff" },
  pending: { fontFamily: fonts.semibold, color: colors.muted, textAlign: "center" },
  unitRow: { flexDirection: "row", gap: space.md },
  rail: { width: 76, alignItems: "center" },
  dot: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  dotCurrent: { width: 76, height: 76, borderRadius: 38, borderWidth: 6, borderColor: "#BFE9E5" },
  dotLocked: { backgroundColor: "#8A97AB", borderColor: colors.border },
  line: { flex: 1, width: 5, backgroundColor: colors.blue, marginVertical: -2, borderRadius: 3 },
  unitNumber: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
  unitTitle: { fontFamily: fonts.black, fontSize: 19, color: colors.navy },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  inProgress: { alignSelf: "flex-start", backgroundColor: colors.blueSoft, borderRadius: radius.sm, paddingHorizontal: 18, paddingVertical: 5, marginTop: 2 },
  inProgressText: { fontFamily: fonts.bold, fontSize: 15, color: colors.blueDark },
});
