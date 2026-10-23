import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, type Network, type Quote } from "../lib/api";
import { PASS_SALES_IN_APP } from "../lib/config";
import { useApp } from "../state/app";
import { Button, ErrorText, Screen, TopBar } from "../ui/kit";
import { fcfa } from "../ui/money";
import { PassActivation } from "../ui/PassActivation";
import { PassBenefits } from "../ui/PassBenefits";
import { colors, fonts, radius, space } from "../ui/theme";

const NETWORKS: { value: Network; label: string; color: string }[] = [
  { value: "FLOOZ", label: "Flooz", color: "#0A5BB5" },
  { value: "TMONEY", label: "T-Money", color: "#E2A400" },
];

/** Écran 23 — Pass Examen : activation par code, ou achat dans l'app si PASS_SALES_IN_APP. */
export default function PremiumScreen() {
  return PASS_SALES_IN_APP ? <PurchaseScreen /> : <PassActivation />;
}

/** Avantages, prix, code promo, paiement Flooz / T-Money. */
function PurchaseScreen() {
  const { me, setMe } = useApp();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [network, setNetwork] = useState<Network>("FLOOZ");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .quote()
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, []);
  useFocusEffect(load);

  const applyCode = async () => {
    setError(null);
    try {
      const { driving_school_name } = await api.setPromoCode(code.trim());
      if (me) await setMe({ ...me, driving_school_name });
      setCode("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code refusé.");
    }
  };

  const digits = phone.replace(/\D/g, "");
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const payment = await api.pay(network, digits);
      router.replace({ pathname: "/payment/[id]", params: { id: payment.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le paiement n'a pas pu être lancé.");
    } finally {
      setBusy(false);
    }
  };

  const label = NETWORKS.find((n) => n.value === network)!.label;
  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Pass Examen" />}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button label={`Payer avec ${label}`} onPress={pay} loading={busy} disabled={!quote || !/^[79]\d{7}$/.test(digits)} />
          <Button label="Continuer gratuitement" variant="outline" chevron={false} onPress={() => router.back()} />
        </>
      }
    >
      <PassBenefits />

      <View style={styles.price}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceValue}>{quote ? fcfa(quote.amount) : "…"}</Text>
          <Text style={styles.benefitText}>
            Paiement unique · {quote?.duration_days ?? 90} jours, sans abonnement
          </Text>
          {quote && quote.discount > 0 ? (
            <Text style={styles.discount}>
              −{fcfa(quote.discount)} grâce à {quote.school} <Text style={styles.strike}>{fcfa(quote.base)}</Text>
            </Text>
          ) : null}
        </View>
        <Ionicons name="pricetag" size={30} color={colors.primary} />
      </View>

      {!quote?.school ? (
        <View style={styles.inline}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Code promo auto-école"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            maxLength={20}
            style={styles.inlineInput}
            accessibilityLabel="Code promo"
          />
          <Pressable onPress={applyCode} disabled={!code.trim()} style={[styles.apply, !code.trim() && { opacity: 0.5 }]}>
            <Text style={styles.applyText}>Appliquer</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Payer avec</Text>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {NETWORKS.map((n) => (
          <Pressable
            key={n.value}
            onPress={() => setNetwork(n.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: network === n.value }}
            style={[styles.network, network === n.value && styles.networkOn]}
          >
            <View style={[styles.networkDot, { backgroundColor: n.color }]} />
            <Text style={styles.networkText}>{n.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inline}>
        <Text style={styles.prefix}>+228</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder={network === "FLOOZ" ? "96 12 34 56" : "90 12 34 56"}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          maxLength={11}
          style={styles.inlineInput}
          accessibilityLabel={`Numéro ${label}`}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  benefitText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  price: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: space.md },
  priceValue: { fontFamily: fonts.black, fontSize: 26, color: colors.navy },
  discount: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryDark, marginTop: 2 },
  strike: { textDecorationLine: "line-through", color: colors.muted },
  section: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: space.md,
    paddingRight: 6,
    minHeight: 56,
  },
  inlineInput: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.navy, paddingVertical: 12 },
  prefix: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  apply: { backgroundColor: colors.blueSoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  applyText: { fontFamily: fonts.bold, fontSize: 15, color: colors.blueDark },
  network: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  networkOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  networkDot: { width: 18, height: 18, borderRadius: 9 },
  networkText: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
});
