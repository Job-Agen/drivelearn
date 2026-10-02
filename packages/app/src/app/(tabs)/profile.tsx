import { useState } from "react";
import { Alert, Pressable, Switch, Text } from "react-native";
import { api } from "../../lib/api";
import { useApp } from "../../state/app";
import { Body, Button, Card, ErrorText, Field, Row, Screen, Title } from "../../ui/kit";
import { colors, radius, space } from "../../ui/theme";

const GOALS = [5, 10, 15] as const;

/** Écrans 21, 22, 25, 27 : profil, préférences, code promo, compte. */
export default function ProfileScreen() {
  const { me, updateMe, setMe, signOut, deleteAccount } = useApp();
  const [firstName, setFirstName] = useState(me?.first_name ?? "");
  const [time, setTime] = useState(me?.reminder_time ?? "19:00");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  const save = async (patch: Parameters<typeof updateMe>[0]) => {
    setError(null);
    setMessage(null);
    try {
      await updateMe(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  };

  const applyCode = async () => {
    setError(null);
    setMessage(null);
    try {
      const { driving_school_name } = await api.setPromoCode(code.trim() || null);
      await setMe({ ...me, driving_school_name });
      setMessage(driving_school_name ? `Code accepté : ${driving_school_name}` : "Code retiré.");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code refusé.");
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      "Supprimer mon compte ?",
      "Ta progression, tes examens et ton Pass seront définitivement effacés. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteAccount().catch((e) => setError(e instanceof Error ? e.message : "Suppression impossible.")),
        },
      ],
    );

  return (
    <Screen>
      <Title>Profil</Title>
      <Card>
        <Field
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          maxLength={40}
          onEndEditing={() => firstName.trim() && firstName.trim() !== me.first_name && save({ first_name: firstName.trim() })}
        />
        <Body muted>{me.email}</Body>
      </Card>

      <Card>
        <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>Objectif quotidien</Text>
        <Row>
          {GOALS.map((g) => (
            <Pressable
              key={g}
              onPress={() => save({ daily_goal_minutes: g })}
              style={{
                flex: 1,
                alignItems: "center",
                padding: space.sm,
                borderRadius: radius.sm,
                borderWidth: 2,
                borderColor: me.daily_goal_minutes === g ? colors.primary : colors.border,
                backgroundColor: me.daily_goal_minutes === g ? colors.primarySoft : colors.card,
              }}
            >
              <Text style={{ fontWeight: "800", color: colors.text }}>{g} min</Text>
            </Pressable>
          ))}
        </Row>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>Rappel quotidien</Text>
          <Switch value={me.reminder_enabled} onValueChange={(v) => save({ reminder_enabled: v })} trackColor={{ true: colors.primary }} />
        </Row>
        {me.reminder_enabled ? (
          <Field
            label="Heure du rappel (HH:MM)"
            value={time}
            onChangeText={setTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onEndEditing={() => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? save({ reminder_time: time }) : setError("Heure invalide, par exemple 19:00.")}
          />
        ) : null}
      </Card>

      <Card>
        <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>Auto-école</Text>
        <Body muted>{me.driving_school_name ? `Rattaché à ${me.driving_school_name}` : "Tu as un code promo de ton auto-école ?"}</Body>
        <Field label="Code promo" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={20} />
        <Button label="Appliquer" variant="outline" onPress={applyCode} disabled={!code.trim()} />
      </Card>

      {message ? <Body>{message}</Body> : null}
      <ErrorText>{error}</ErrorText>

      <Button label="Se déconnecter" variant="outline" onPress={signOut} />
      <Button label="Supprimer mon compte" variant="ghost" onPress={confirmDelete} />
    </Screen>
  );
}
