import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../../state/app";
import { Body, Card, ProgressBar, Row, Title } from "../../ui/kit";
import { colors, space } from "../../ui/theme";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MILESTONES = [
  { key: "first_lesson", label: "Première leçon", icon: "🌱" },
  { key: "streak_3", label: "3 jours de suite", icon: "🔥" },
  { key: "streak_7", label: "7 jours de suite", icon: "⚡" },
  { key: "streak_30", label: "30 jours de suite", icon: "🏅" },
  { key: "first_exam_passed", label: "Premier examen blanc réussi", icon: "🎓" },
] as const;

/** Écran 19 : série, XP, avancement, régularité, réussite par thème, jalons. */
export default function ProgressScreen() {
  const { progress, syncing, refresh } = useApp();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}
      >
        <Title>Mes progrès</Title>
        {!progress ? (
          <Body muted>Connectez-vous à internet pour voir vos progrès.</Body>
        ) : (
          <>
            <Row>
              <Stat value={`🔥 ${progress.current_streak}`} label="jours de suite" />
              <Stat value={`⭐ ${progress.total_xp}`} label="XP" />
            </Row>
            <Card>
              <Text style={styles.h}>Cette semaine</Text>
              <Row style={{ justifyContent: "space-between" }}>
                {progress.week_days.map((done, i) => (
                  <View key={i} style={[styles.day, done && styles.dayOn]}>
                    <Text style={[styles.dayText, done && { color: "#fff" }]}>{DAYS[i]}</Text>
                  </View>
                ))}
              </Row>
              <Body muted>
                Aujourd'hui : {progress.today_minutes}/{progress.daily_goal_minutes} min
              </Body>
            </Card>
            <Card>
              <Text style={styles.h}>Parcours</Text>
              <ProgressBar value={progress.lessons_total ? progress.lessons_completed / progress.lessons_total : 0} />
              <Body muted>
                {progress.lessons_completed} leçon(s) terminée(s) sur {progress.lessons_total}
              </Body>
            </Card>
            {progress.themes.length > 0 ? (
              <Card>
                <Text style={styles.h}>Réussite par thème</Text>
                {progress.themes.map((t) => (
                  <View key={t.unit_id} style={{ gap: 4 }}>
                    <Row style={{ justifyContent: "space-between" }}>
                      <Text style={{ flex: 1, color: colors.text }}>{t.title}</Text>
                      <Text style={{ fontWeight: "700", color: t.correct_rate >= 65 ? colors.primaryDark : colors.danger }}>{t.correct_rate} %</Text>
                    </Row>
                    <ProgressBar value={t.correct_rate / 100} color={t.correct_rate >= 65 ? colors.primary : colors.danger} />
                  </View>
                ))}
              </Card>
            ) : null}
            <Card>
              <Text style={styles.h}>Jalons</Text>
              {MILESTONES.map((m) => (
                <Row key={m.key} style={{ opacity: progress.milestones[m.key] ? 1 : 0.4 }}>
                  <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                  <Text style={{ color: colors.text, flex: 1 }}>{m.label}</Text>
                  <Text>{progress.milestones[m.key] ? "✓" : ""}</Text>
                </Row>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{value}</Text>
      <Text style={{ color: colors.muted, fontWeight: "600" }}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: "800", color: colors.text },
  day: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: colors.accent },
  dayText: { fontWeight: "800", color: colors.muted },
});
