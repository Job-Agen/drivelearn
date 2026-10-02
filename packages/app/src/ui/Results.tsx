import { StyleSheet, Text, View } from "react-native";
import { percent, sessionXp } from "../domain/grading";
import { Badge, Body, Button, Card, Row, Screen, Title } from "./kit";
import { colors, space } from "./theme";

export function Results({
  title,
  correct,
  total,
  mistakes,
  primary,
  secondary,
}: {
  title: string;
  correct: number;
  total: number;
  mistakes: number;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  const rate = percent(correct, total);
  return (
    <Screen
      footer={
        <>
          <Button label={primary.label} onPress={primary.onPress} />
          {secondary ? <Button label={secondary.label} onPress={secondary.onPress} variant="ghost" /> : null}
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.xl }}>
        <Text style={{ fontSize: 64 }}>{rate === 100 ? "🏆" : rate >= 65 ? "🎉" : "💪"}</Text>
        <Title>{title}</Title>
        <Body muted center>
          {rate === 100 ? "Sans-faute, bravo !" : rate >= 65 ? "Beau travail, continuez comme ça." : "Chaque erreur est une leçon. On révise et on recommence !"}
        </Body>
      </View>
      <Row style={{ justifyContent: "space-between" }}>
        <Stat label="Score" value={`${correct}/${total}`} />
        <Stat label="Réussite" value={`${rate} %`} />
        <Stat label="XP" value={`+${sessionXp(correct, total)}`} />
      </Row>
      {mistakes > 0 ? (
        <Card>
          <Badge label="À revoir" tone="accent" />
          <Body>
            {mistakes} {mistakes > 1 ? "questions ajoutées" : "question ajoutée"} à « Mes erreurs ».
          </Body>
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 22, fontWeight: "800", color: colors.text },
  label: { color: colors.muted, fontWeight: "600" },
});
