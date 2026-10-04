import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Illustration } from "../ui/Illustration";
import { Body, Button, Screen, Title } from "../ui/kit";
import { Chip, Group, ListRow } from "../ui/parts";
import { colors, space } from "../ui/theme";

/** Écran 28 — Confirmation du Pass Examen, affiché après un paiement réussi. */
export default function PassConfirmed() {
  return (
    <Screen
      footer={
        <>
          <Button label="Reprendre mon parcours" onPress={() => router.replace("/")} />
          <Button label="Voir mon Pass Examen" variant="soft" chevron={false} onPress={() => router.replace("/pass")} />
        </>
      }
    >
      <Chip label="Paiement confirmé" />
      <Illustration name="premiumOk" width="100%" />
      <View style={{ gap: space.xs }}>
        <Title center>Ton Pass Examen est activé</Title>
        <Body muted center>
          Tu profites maintenant des examens blancs illimités.
        </Body>
      </View>
      <Group>
        <ListRow leading={<Dot icon="document-text" />} label="Examens blancs illimités" onPress={() => router.replace("/exams")} />
        <ListRow leading={<Dot icon="checkmark-done" />} label="Correction détaillée" onPress={() => router.replace("/exams")} />
        <ListRow leading={<Dot icon="bar-chart" />} label="Mes progrès" onPress={() => router.replace("/progress")} />
      </Group>
    </Screen>
  );
}

function Dot({ icon }: { icon: "document-text" | "checkmark-done" | "bar-chart" }) {
  return (
    <View style={styles.dot}>
      <Ionicons name={icon} size={18} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
});
