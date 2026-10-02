import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Illustration } from "../ui/Illustration";
import { Button, Screen, TopBar } from "../ui/kit";
import { colors, fonts, radius, space } from "../ui/theme";

const BENEFITS = [
  { title: "Examens blancs illimités", text: "Entraîne-toi autant que tu veux" },
  { title: "Correction détaillée", text: "Comprends chacune de tes erreurs" },
  { title: "Valable 90 jours", text: "Un seul paiement, sans abonnement" },
];

/** Écran 23 — Pass Examen (offre). Le paiement mobile money arrive avec l'intégration de la passerelle. */
export default function PremiumScreen() {
  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Pass Examen" />}
      footer={
        <>
          <Button label="Paiement bientôt disponible" chevron={false} disabled variant="soft" />
          <Button label="Continuer gratuitement" variant="outline" chevron={false} onPress={() => router.back()} />
        </>
      }
    >
      <LinearGradient colors={["#1E7FE0", "#1558C0"]} style={styles.hero}>
        <Illustration name="premiumMentor" width={150} style={{ alignSelf: "flex-end" }} />
        <View style={{ flex: 1, paddingVertical: space.md, gap: space.xs }}>
          <Ionicons name="star" size={40} color={colors.accent} />
          <Text style={styles.heroTitle}>Va plus loin, à ton rythme</Text>
          <Text style={styles.heroText}>Plus d'entraînement pour réussir ton examen avec confiance.</Text>
        </View>
      </LinearGradient>
      <View style={{ gap: space.md }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.price}>
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceTitle}>Tarif à définir</Text>
          <Text style={styles.benefitText}>Prix et durée affichés avant achat.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: space.sm, borderRadius: radius.lg, paddingHorizontal: space.md, overflow: "hidden" },
  heroTitle: { fontFamily: fonts.black, fontSize: 25, lineHeight: 29, color: "#fff" },
  heroText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: "#fff" },
  benefit: { flexDirection: "row", alignItems: "center", gap: space.md },
  check: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  benefitTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
  benefitText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  price: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: space.md },
  lock: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#8A97AB", alignItems: "center", justifyContent: "center" },
  priceTitle: { fontFamily: fonts.black, fontSize: 21, color: colors.navy },
});
