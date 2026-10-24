import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { Illustration } from "./Illustration";
import { colors, fonts, radius, space } from "./theme";

const BENEFITS = [
  { title: "Examens blancs illimités", text: "Entraîne-toi autant que tu veux" },
  { title: "Correction détaillée", text: "Comprends chacune de tes erreurs" },
  { title: "Indicateur « prêt pour l'examen »", text: "Sache quand tu es prêt le jour J" },
];

/** Bandeau et avantages du Pass Examen (écran 23), communs à l'achat et à l'activation par code. */
export function PassBenefits() {
  return (
    <>
      <LinearGradient colors={["#1E7FE0", "#1558C0"]} style={styles.hero}>
        <Illustration name="premiumMentor" width={130} style={{ alignSelf: "flex-end" }} />
        <View style={{ flex: 1, paddingVertical: space.md, gap: space.xs }}>
          <Ionicons name="star" size={34} color={colors.accent} />
          <Text style={styles.heroTitle}>Va plus loin, à ton rythme</Text>
          <Text style={styles.heroText}>Plus d'entraînement pour réussir ton examen avec confiance.</Text>
        </View>
      </LinearGradient>

      <View style={{ gap: space.sm }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: space.sm, borderRadius: radius.lg, paddingHorizontal: space.md, overflow: "hidden" },
  heroTitle: { fontFamily: fonts.black, fontSize: 23, lineHeight: 27, color: "#fff" },
  heroText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: "#fff" },
  benefit: { flexDirection: "row", alignItems: "center", gap: space.md },
  check: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  benefitTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.navy },
  benefitText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
});
