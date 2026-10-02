import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";
import { useApp } from "../../state/app";
import { Flag, Illustration } from "../../ui/Illustration";
import { Screen } from "../../ui/kit";
import { Group, ListRow } from "../../ui/parts";
import { colors, fonts, radius, space } from "../../ui/theme";
import { PRIVACY_URL } from "../(auth)/sign-up";

/** Écran 21 — Mon profil. */
export default function ProfileScreen() {
  const { me, bundle, signOut } = useApp();
  const [hasPass, setHasPass] = useState(false);
  useFocusEffect(
    useCallback(() => {
      api
        .examStatus()
        .then((s) => setHasPass(s.has_pass))
        .catch(() => {});
    }, []),
  );
  if (!me) return null;
  const country = bundle?.content.program.name ?? "Togo";

  return (
    <Screen tabs>
      <View style={styles.head}>
        <Text style={styles.title}>Mon profil</Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={10} accessibilityLabel="Réglages">
          <Ionicons name="settings-sharp" size={28} color={colors.navy} />
        </Pressable>
      </View>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Illustration name="avatarStudent" width={124} round />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.name} numberOfLines={1}>
            {me.first_name ?? "Élève"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Flag country="TG" width={30} />
            <Text style={styles.country}>{country}</Text>
          </View>
          <View style={styles.offer}>
            <Text style={styles.offerText}>{hasPass ? "Pass Examen actif" : "Offre gratuite"}</Text>
          </View>
        </View>
      </View>

      <Group>
        <ListRow icon="locate" iconColor={colors.primary} label="Mon objectif" value={`${me.daily_goal_minutes} min / jour`} onPress={() => router.push("/settings")} />
        <ListRow leading={<Flag country="TG" width={28} />} label="Mon pays" value={country} onPress={() => router.push("/settings")} />
        <ListRow
          icon="notifications"
          label="Rappel quotidien"
          value={me.reminder_enabled ? me.reminder_time : "Désactivé"}
          onPress={() => router.push("/settings")}
        />
      </Group>
      <Group>
        <ListRow icon="ribbon" iconColor={colors.accent} label="Mon Pass Examen" onPress={() => router.push("/pass")} />
        <ListRow icon="school" label="Code auto-école" value={me.driving_school_name ?? undefined} onPress={() => router.push("/settings")} />
        <ListRow icon="shield" iconColor={colors.blueDark} label="Confidentialité" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <ListRow icon="trash-outline" iconColor={colors.danger} label="Supprimer mon compte" onPress={() => router.push("/delete-account")} />
      </Group>
      <Group>
        <ListRow icon="log-out-outline" iconColor={colors.danger} label="Se déconnecter" danger chevron={false} onPress={signOut} />
      </Group>

      {!hasPass ? (
        <Pressable onPress={() => router.push("/premium")} accessibilityRole="button">
          <LinearGradient colors={["#1E7FE0", "#1558C0"]} style={styles.promo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Ionicons name="star" size={52} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>Passe au Pass Examen</Text>
                <Text style={styles.promoText}>Va plus loin, à ton rythme.</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </View>
            <View style={styles.promoButton}>
              <Text style={styles.promoButtonText}>Découvrir le Pass</Text>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.black, fontSize: 30, color: colors.navy },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { borderRadius: 999, borderWidth: 4, borderColor: colors.blueSoft },
  name: { fontFamily: fonts.black, fontSize: 26, color: colors.navy },
  country: { fontFamily: fonts.semibold, fontSize: 17, color: colors.navy },
  offer: { alignSelf: "flex-start", backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  offerText: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  promo: { borderRadius: radius.md, padding: space.md, gap: space.sm },
  promoTitle: { fontFamily: fonts.black, fontSize: 20, color: "#fff" },
  promoText: { fontFamily: fonts.semibold, fontSize: 15, color: "#fff" },
  promoButton: { backgroundColor: "#fff", borderRadius: radius.pill, paddingVertical: 10, alignItems: "center", marginHorizontal: space.xl },
  promoButtonText: { fontFamily: fonts.black, fontSize: 18, color: colors.blueDark },
});
