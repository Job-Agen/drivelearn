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
    <LinearGradient colors={["#1258B8", "#2E7FE0"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.hero}>
          <Logo size={54} light />
          <Text style={styles.tagline}>Apprends à conduire{"\n"}avec confiance</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={{ marginBottom: -space.xl }}>
            <Illustration name="welcome" width="100%" />
            {/* Fondu entre le bleu du haut et la scène, comme sur la maquette */}
            <LinearGradient colors={["#2E7FE0", "#2E7FE000"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70 }} />
          </View>
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
  hero: { alignItems: "center", paddingTop: space.xl, gap: space.xs },
  tagline: { color: "#fff", fontFamily: fonts.bold, fontSize: 20, textAlign: "center", lineHeight: 26 },
  sheet: {
    backgroundColor: colors.card,
    marginHorizontal: space.sm,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  title: { fontFamily: fonts.black, fontSize: 34, lineHeight: 37, color: colors.navy, textAlign: "center" },
  text: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: colors.text, textAlign: "center" },
});
