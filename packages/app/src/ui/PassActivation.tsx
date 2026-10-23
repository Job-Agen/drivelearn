import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import { Body, Button, ErrorText, Screen, TopBar } from "./kit";
import { PassBenefits } from "./PassBenefits";
import { colors, fonts, radius, space } from "./theme";

/**
 * Écran 23 sans achat : l'application publiée sur le Play Store ne vend pas le Pass (règles de paiement de
 * Google Play). L'élève saisit le code d'activation obtenu ailleurs ; aucun prix ni lien d'achat n'est affiché.
 */
export function PassActivation() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = code.replace(/[^a-z0-9]/gi, "").length === 12;

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.redeemPassCode(code);
      router.replace("/pass-confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<TopBar onBack={() => router.back()} title="Pass Examen" />}
      footer={
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Activer mon Pass" onPress={activate} loading={busy} disabled={!ready} />
          <Button label="Continuer gratuitement" variant="outline" chevron={false} onPress={() => router.back()} />
        </>
      }
    >
      <PassBenefits />
      <View style={{ gap: space.sm }}>
        <Text style={styles.section}>Code d'activation</Text>
        <Body muted>Saisis le code de ton Pass Examen (12 lettres et chiffres).</Body>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          style={styles.input}
          accessibilityLabel="Code d'activation"
          onSubmitEditing={() => ready && activate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 56,
    fontFamily: fonts.extrabold,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: "center",
    color: colors.navy,
  },
});
