import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useApp } from "../../state/app";
import { Body, Card, ProgressBar, Row, Screen, Title } from "../../ui/kit";
import { colors } from "../../ui/theme";

/** Écran 13 : mes erreurs et révision par thème. */
export default function ReviewScreen() {
  const { bundle, progress, localReview } = useApp();
  const mistakes = localReview().length;
  const rates = new Map(progress?.themes.map((t) => [t.unit_id, t.correct_rate]) ?? []);

  return (
    <Screen>
      <Title>Réviser</Title>
      <Pressable onPress={() => router.push({ pathname: "/practice", params: { mode: "erreurs" } })}>
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>🎯 Mes erreurs</Text>
          <Body muted>
            {mistakes > 0
              ? `${mistakes} question${mistakes > 1 ? "s" : ""} à revoir. Deux bonnes réponses d'affilée et elle disparaît.`
              : "Les questions ratées arrivent ici pour être revues."}
          </Body>
        </Card>
      </Pressable>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Par thème</Text>
      {(bundle?.content.units ?? []).map((unit) => {
        const rate = rates.get(unit.id);
        return (
          <Pressable key={unit.id} onPress={() => router.push({ pathname: "/practice", params: { mode: "theme", unit: unit.id } })}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 }}>{unit.title}</Text>
                <Text style={{ color: colors.muted, fontWeight: "700" }}>{rate === undefined ? "—" : `${rate} %`}</Text>
              </Row>
              <ProgressBar value={(rate ?? 0) / 100} />
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
