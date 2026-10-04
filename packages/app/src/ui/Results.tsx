import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { percent, sessionXp } from "../domain/grading";
import { Illustration } from "./Illustration";
import { Button, Card, ProgressBar, Screen, Title } from "./kit";
import { colors, fonts, radius, space } from "./theme";

type Action = { label: string; onPress: () => void };

/** Écran 12 : résultat d'une leçon ou d'une révision. */
export function Results({
  title,
  xpLabel,
  correct,
  total,
  mistakes,
  onReview,
  next,
  primary,
}: {
  title: string;
  xpLabel: string;
  correct: number;
  total: number;
  mistakes: number;
  onReview?: () => void;
  next?: Action;
  primary: Action;
}) {
  return (
    <Screen
      footer={
        <>
          <Button label={primary.label} onPress={primary.onPress} />
          {mistakes > 0 && onReview ? (
            <Button label={mistakes > 1 ? "Revoir mes erreurs" : "Revoir mon erreur"} variant="outline" chevron onPress={onReview} />
          ) : null}
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space.sm }}>
        <Illustration name="celebrate" width="100%" />
        <Title center size={34}>
          {title}
        </Title>
      </View>
      <Card style={{ alignItems: "center", gap: space.sm }}>
        <Text style={styles.score}>
          {correct} / {total}
        </Text>
        <View style={{ alignSelf: "stretch" }}>
          <ProgressBar value={total ? correct / total : 0} />
        </View>
        <Text style={styles.rate}>{percent(correct, total)} % de bonnes réponses</Text>
      </Card>
      <View style={styles.xp}>
        <Text style={{ fontSize: 26 }}>⭐</Text>
        <Text style={styles.xpText}>
          {xpLabel} : +{sessionXp(correct, total)} XP
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {mistakes > 0 && onReview ? (
          <Tile icon="document-text" tint={colors.danger} label={`${mistakes} erreur${mistakes > 1 ? "s" : ""}\nà revoir`} onPress={onReview} />
        ) : null}
        {next ? <Tile icon="lock-open" tint={colors.primary} label={next.label} onPress={next.onPress} /> : null}
      </View>
    </Screen>
  );
}

function Tile({ icon, tint, label, onPress }: { icon: "document-text" | "lock-open"; tint: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tile} accessibilityRole="button">
      <View style={[styles.tileIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.tileText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  score: { fontFamily: fonts.black, fontSize: 52, color: colors.navy },
  rate: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  xp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.md,
    padding: space.sm,
  },
  xpText: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.navy },
  tile: {
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
  tileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.navy },
});
