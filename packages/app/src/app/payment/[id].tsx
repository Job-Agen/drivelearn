import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api, type Payment } from "../../lib/api";
import { isOffline } from "../../lib/http";
import { useApp } from "../../state/app";
import { Body, Button, Screen, Title, TopBar } from "../../ui/kit";
import { fcfa } from "../../ui/money";
import { colors, fonts, radius, space } from "../../ui/theme";

const FAILURES: Record<string, string> = {
  cancelled: "Le paiement a été annulé sur ton téléphone.",
  expired: "Le délai pour valider le paiement est dépassé.",
  timeout: "Le délai pour valider le paiement est dépassé.",
  invalid_phone: "Numéro ou réseau invalide.",
};

/** Paiement en cours : l'élève valide sur son téléphone ; le Pass n'est activé que sur confirmation du serveur. */
export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useApp();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const p = await api.payment(id);
        if (stop) return;
        setPayment(p);
        setOffline(false);
        if (p.status === "confirmed") {
          refresh();
          router.replace("/pass-confirmed");
          return;
        }
        if (p.status === "failed") return;
      } catch (e) {
        if (isOffline(e)) setOffline(true);
      }
      if (!stop) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [id, refresh]);

  const failed = payment?.status === "failed";
  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Paiement" />}
      footer={
        failed ? (
          <>
            <Button label="Réessayer" onPress={() => router.replace("/premium")} />
            <Button label="Plus tard" variant="soft" chevron={false} onPress={() => router.back()} />
          </>
        ) : (
          <Button label="Continuer en attendant" variant="soft" chevron={false} onPress={() => router.back()} />
        )
      }
    >
      <View style={[styles.icon, failed && { backgroundColor: colors.dangerSoft }]}>
        {failed ? <Ionicons name="close-circle" size={90} color={colors.danger} /> : <Ionicons name="phone-portrait" size={80} color={colors.blue} />}
      </View>
      <Title center>{failed ? "Paiement non abouti" : "Paiement en cours"}</Title>
      <Body muted center>
        {failed
          ? (FAILURES[payment?.failure_reason ?? ""] ?? "Le paiement n'a pas abouti.") + " Si ton compte a quand même été débité, ton Pass s'activera automatiquement."
          : "Valide le paiement sur ton téléphone avec ton code secret Flooz ou T-Money. Ton Pass s'active dès la confirmation."}
      </Body>
      {payment ? (
        <View style={styles.amount}>
          <Text style={styles.amountLabel}>Montant</Text>
          <Text style={styles.amountValue}>{fcfa(payment.amount_xof)}</Text>
        </View>
      ) : null}
      {!failed ? (
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Body muted>{offline ? "Connexion perdue, nouvelle tentative…" : "En attente de confirmation…"}</Body>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { alignSelf: "center", width: 160, height: 160, borderRadius: 80, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  amount: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  amountLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.muted },
  amountValue: { fontFamily: fonts.black, fontSize: 18, color: colors.navy },
});
