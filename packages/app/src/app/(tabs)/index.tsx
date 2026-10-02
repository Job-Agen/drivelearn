import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildPath, nextLesson, type PathLesson } from "../../domain/path";
import { useApp } from "../../state/app";
import { Body, Button, Card, Loading, ProgressBar, Row } from "../../ui/kit";
import { colors, radius, space } from "../../ui/theme";

/** Écran 08 : le chemin des unités et de leurs leçons. */
export default function PathScreen() {
  const { me, bundle, completed, progress, syncing, refresh, pendingCount, lastError } = useApp();

  if (!bundle) {
    return syncing ? (
      <Loading />
    ) : (
      <SafeAreaView style={{ flex: 1, padding: space.md, gap: space.md, justifyContent: "center" }}>
        <Body center>{lastError ?? "Connecte-toi à internet pour télécharger les leçons (une seule fois)."}</Body>
        <Button label="Réessayer" onPress={refresh} />
      </SafeAreaView>
    );
  }

  const path = buildPath(bundle.content, completed);
  const next = nextLesson(path);
  const goal = progress?.daily_goal_minutes ?? me?.daily_goal_minutes ?? 10;
  const today = progress?.today_minutes ?? 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={styles.hello}>Bonjour {me?.first_name ?? ""} 👋</Text>
          <Row>
            <Text style={styles.stat}>🔥 {progress?.current_streak ?? 0}</Text>
            <Text style={styles.stat}>⭐ {progress?.total_xp ?? 0}</Text>
          </Row>
        </Row>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Text style={styles.cardTitle}>Objectif du jour</Text>
            <Text style={styles.muted}>
              {Math.min(today, goal)}/{goal} min
            </Text>
          </Row>
          <ProgressBar value={today / goal} color={colors.accent} />
          {pendingCount > 0 ? <Text style={styles.muted}>⏳ {pendingCount} séance(s) à synchroniser</Text> : null}
        </Card>
        {next ? (
          <Button label={`Continuer : ${next.lesson.title}`} onPress={() => router.push(`/lesson/${next.lesson.id}`)} />
        ) : path.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>🎓 Parcours terminé !</Text>
            <Body muted>Entraîne-toi maintenant avec les examens blancs.</Body>
          </Card>
        ) : (
          <Body muted center>
            Les leçons arrivent bientôt.
          </Body>
        )}

        {path.map(({ unit, done, lessons }, u) => (
          <View key={unit.id} style={{ gap: space.sm }}>
            <View style={[styles.unit, done && { backgroundColor: colors.primaryDark }]}>
              <Text style={styles.unitLabel}>Unité {u + 1}{done ? " · Terminée" : ""}</Text>
              <Text style={styles.unitTitle}>{unit.title}</Text>
            </View>
            {lessons.map((l, i) => (
              <LessonNode key={l.lesson.id} item={l} offset={[0, 1, 0, -1][i % 4]} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LessonNode({ item, offset }: { item: PathLesson; offset: number }) {
  const { lesson, state } = item;
  const color = state === "done" ? colors.accent : state === "current" ? colors.primary : colors.locked;
  return (
    <Pressable
      disabled={state === "locked"}
      onPress={() => router.push(`/lesson/${lesson.id}`)}
      style={{ alignItems: "center", transform: [{ translateX: offset * 56 }] }}
      accessibilityLabel={`${lesson.title}, ${state === "done" ? "terminée" : state === "current" ? "à faire" : "verrouillée"}`}
    >
      <View style={[styles.node, { backgroundColor: color }]}>
        <Text style={{ fontSize: 28 }}>{state === "done" ? "✓" : state === "current" ? "★" : "🔒"}</Text>
      </View>
      <Text style={[styles.nodeLabel, state === "locked" && { color: colors.muted }]} numberOfLines={2}>
        {lesson.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 22, fontWeight: "800", color: colors.text, flexShrink: 1 },
  stat: { fontSize: 17, fontWeight: "800", color: colors.text },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  muted: { color: colors.muted, fontWeight: "600" },
  unit: { backgroundColor: colors.primary, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  unitLabel: { color: "#ffffffcc", fontWeight: "700", textTransform: "uppercase", fontSize: 12 },
  unitTitle: { color: "#fff", fontWeight: "800", fontSize: 19 },
  node: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 5,
    borderBottomColor: "#00000026",
  },
  nodeLabel: { marginTop: space.xs, fontWeight: "700", color: colors.text, maxWidth: 160, textAlign: "center" },
});
