import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, type Payment } from "../lib/api";
import { fcfa } from "../ui/money";
import { Button, ErrorText, Screen, TopBar } from "../ui/kit";
import { InfoBox } from "../ui/parts";
import { colors, fonts, radius, space } from "../ui/theme";

type Status = Awaited<ReturnType<typeof api.examStatus>>;

/** Écran 24 — Mon Pass Examen. */
export default function PassScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      Promise.all([api.examStatus(), api.payments()])
        .then(([s, p]) => {
          setStatus(s);
          setPayments(p);
        })
        .catch((e) => setError(e.message));
    }, []),
  );
  const active = status?.has_pass ?? false;
  const expired = !active && payments.some((p) => p.status === "confirmed");
  const end = status?.pass_ends_at ? new Date(status.pass_ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Mon Pass Examen" />}
      footer={active ? null : <Button label="Obtenir le Pass Examen" onPress={() => router.push("/premium")} />}
    >
      <View style={styles.banner}>
        <View style={styles.crown}>
          <Text style={{ fontSize: 28 }}>👑</Text>
        </View>
        <Text style={styles.bannerText}>{active ? "Pass Examen actif" : expired ? "Pass Examen expiré" : "Offre gratuite"}</Text>
      </View>
      <View style={styles.card}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Ionicons name="globe-outline" size={50} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{active ? "Examens blancs illimités" : "Leçons et révisions gratuites"}</Text>
            <Text style={styles.cardText}>
              {active ? "Profite de tous les examens blancs jusqu'à l'échéance." : "Ton premier examen blanc est offert. Le Pass débloque les suivants."}
            </Text>
          </View>
        </View>
        <Line icon="calendar" label="Échéance :" value={end ?? "—"} />
        <Line icon="card" label="Paiement :" value="Flooz ou T-Money" />
      </View>
      <InfoBox text="Tes résultats restent conservés après l'expiration du Pass." />
      {payments.length > 0 ? <Text style={styles.section}>Mes paiements</Text> : null}
      {payments.map((p) => (
        <View key={p.id} style={styles.line}>
          <Text style={[styles.lineLabel, { flex: 1 }]}>{new Date(p.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
          <Text style={styles.lineValue}>{fcfa(p.amount_xof)}</Text>
          <Text style={[styles.state, { color: p.status === "confirmed" ? colors.primaryDark : p.status === "failed" ? colors.danger : colors.muted }]}>
            {p.status === "confirmed" ? "Payé" : p.status === "failed" ? "Échoué" : "En cours"}
          </Text>
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function Line({ icon, label, value }: { icon: "calendar" | "card"; label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={24} color={colors.blue} />
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md },
  crown: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bannerText: { fontFamily: fonts.black, fontSize: 20, color: colors.navy },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.md },
  cardTitle: { fontFamily: fonts.black, fontSize: 20, color: colors.navy },
  cardText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  lineLabel: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.navy },
  lineValue: { flex: 1, textAlign: "right", fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  section: { fontFamily: fonts.black, fontSize: 19, color: colors.navy, marginTop: space.sm },
  state: { fontFamily: fonts.extrabold, fontSize: 14, minWidth: 64, textAlign: "right" },
});
