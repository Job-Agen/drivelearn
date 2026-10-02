import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";

// Illustrations reprises des maquettes. Pour une version haute définition, remplacer le fichier
// dans assets/illustrations/ en gardant le même nom (et ajuster `ratio` si le cadrage change).

export type IllustrationName = "welcome" | "mentor" | "mentorThumbs" | "studentWave" | "mailLock" | "celebrate";

const FILES: Record<IllustrationName, { source: number; ratio: number }> = {
  welcome: { source: require("../../assets/illustrations/welcome.png"), ratio: 728 / 556 },
  mentor: { source: require("../../assets/illustrations/mentor.png"), ratio: 400 / 300 },
  mentorThumbs: { source: require("../../assets/illustrations/mentor-thumbs.png"), ratio: 526 / 368 },
  studentWave: { source: require("../../assets/illustrations/student-wave.png"), ratio: 500 / 400 },
  mailLock: { source: require("../../assets/illustrations/mail-lock.png"), ratio: 574 / 490 },
  celebrate: { source: require("../../assets/illustrations/celebrate.png"), ratio: 700 / 446 },
};

/** `width` en points, ou "100%" pour occuper toute la largeur disponible. */
export function Illustration({ name, width, style }: { name: IllustrationName; width: number | "100%"; style?: ViewStyle }) {
  const { source, ratio } = FILES[name];
  return (
    <View style={[{ width, aspectRatio: ratio, alignSelf: "center" }, style]}>
      <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}
