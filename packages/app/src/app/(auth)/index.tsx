import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Illustration } from "../../ui/Illustration";
import { Button, Logo } from "../../ui/kit";
import { colors, fonts, radius, space } from "../../ui/theme";

/** Écran 01 — Bienvenue. */
export default function Welcome() {
  return (
    <LinearGradient colors={["#1565C0", "#2E8BE6", "#7DBDF2"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.hero}>
          <Logo size={52} light />
          <Text style={styles.tagline}>Apprends à conduire{"\n"}avec confiance</Text>
          <Illustration name="welcome" size={220} style={{ backgroundColor: "#ffffff33", marginTop: space.lg }} />
        </View>
        <View style={styles.sheet}>
          <Text style={styles.title}>Ton permis{"\n"}commence ici</Text>
          <Text style={styles.text}>Un peu chaque jour.{"\n"}Plus de confiance au volant.</Text>
          <View style={{ gap: space.sm, alignSelf: "stretch", marginTop: space.sm }}>
            <Button label="Commencer" onPress={() => router.push("/sign-up")} />
            <Button label="J'ai déjà un compte" variant="outline" onPress={() => router.push("/sign-in")} />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: space.lg, gap: space.sm },
  tagline: { color: "#fff", fontFamily: fonts.bold, fontSize: 20, textAlign: "center", lineHeight: 26 },
  sheet: {
    backgroundColor: colors.card,
    marginHorizontal: space.sm,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  title: { fontFamily: fonts.black, fontSize: 32, lineHeight: 36, color: colors.navy, textAlign: "center" },
  text: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: colors.text, textAlign: "center" },
});
