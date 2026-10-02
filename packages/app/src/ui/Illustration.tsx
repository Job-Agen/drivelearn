import { Image } from "expo-image";
import { Text, View, type ViewStyle } from "react-native";
import { colors } from "./theme";

// Illustrations des maquettes (moniteur, élève, enveloppe…). En attendant les fichiers PNG définitifs,
// un pictogramme sur disque bleu clair tient la place. Pour brancher une image : la déposer dans
// assets/illustrations/ et l'ajouter à FILES, par exemple `mentor: require("../../assets/illustrations/mentor.png")`.

export type IllustrationName = "welcome" | "mentor" | "mentorThumbs" | "studentWave" | "mailLock" | "celebrate";

const FILES: Partial<Record<IllustrationName, number>> = {};

const PLACEHOLDERS: Record<IllustrationName, string> = {
  welcome: "🚗",
  mentor: "👨🏾‍🏫",
  mentorThumbs: "👍🏾",
  studentWave: "👋🏾",
  mailLock: "🔐",
  celebrate: "🎉",
};

export function Illustration({ name, size = 200, style, disc = true }: { name: IllustrationName; size?: number; style?: ViewStyle; disc?: boolean }) {
  const file = FILES[name];
  if (file) {
    return (
      <View style={style}>
        <Image source={file} style={{ width: size, height: size }} contentFit="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" },
        disc && { backgroundColor: colors.blueSoft },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.45 }}>{PLACEHOLDERS[name]}</Text>
    </View>
  );
}
