import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { auth } from "../lib/auth";
import { AppError } from "../lib/http";
import { useApp } from "../state/app";
import { Illustration } from "../ui/Illustration";
import { Body, Button, ErrorText, Field, Screen, Title, TopBar } from "../ui/kit";
import { Checkbox, InfoBox } from "../ui/parts";
import { colors, fonts, space } from "../ui/theme";

/** Écran 27 — Supprimer mon compte. */
export default function DeleteAccount() {
  const { me, deleteAccount } = useApp();
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!me?.email) return;
    setBusy(true);
    setError(null);
    try {
      await auth.checkPassword(me.email, password);
      await deleteAccount();
    } catch (e) {
      setError(e instanceof AppError && e.status === 401 ? "Mot de passe incorrect." : e instanceof Error ? e.message : "Suppression impossible.");
      setBusy(false);
    }
  };

  return (
    <Screen header={<TopBar onBack={() => router.back()} title="Supprimer mon compte" />}>
      <Illustration name="deleteUser" width={150} />
      <View style={{ gap: space.xs }}>
        <Title center>Supprimer ton compte ?</Title>
        <Body muted center>
          Ton compte et ta progression seront supprimés.
        </Body>
      </View>
      <InfoBox text="Un Pass Examen en cours sera perdu, sans remboursement." />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.navy }}>Confirme ton mot de passe</Text>
      <Field icon="lock-closed-outline" placeholder="Ton mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Checkbox on={understood} onPress={() => setUnderstood(!understood)} label="Je comprends les conséquences" />
      <ErrorText>{error}</ErrorText>
      <Button label="Conserver mon compte" variant="blue" chevron onPress={() => router.back()} />
      <Button label="Supprimer définitivement" variant="dangerOutline" chevron onPress={remove} loading={busy} disabled={!password || !understood} />
    </Screen>
  );
}
