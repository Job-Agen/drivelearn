import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";

// Illustrations reprises des maquettes. Pour une version haute définition, remplacer le fichier
// dans assets/illustrations/ en gardant le même nom (et ajuster `ratio` si le cadrage change).

const FILES = {
  welcome: { source: require("../../assets/illustrations/welcome.png"), ratio: 728 / 556 },
  mentor: { source: require("../../assets/illustrations/mentor.png"), ratio: 400 / 300 },
  mentorThumbs: { source: require("../../assets/illustrations/mentor-thumbs.png"), ratio: 526 / 368 },
  studentWave: { source: require("../../assets/illustrations/student-wave.png"), ratio: 500 / 400 },
  mailLock: { source: require("../../assets/illustrations/mail-lock.png"), ratio: 574 / 490 },
  celebrate: { source: require("../../assets/illustrations/celebrate.png"), ratio: 700 / 446 },
  avatarStudent: { source: require("../../assets/illustrations/avatar-student.png"), ratio: 248 / 252 },
  avatarMentor: { source: require("../../assets/illustrations/avatar-mentor.png"), ratio: 108 / 104 },
  premiumMentor: { source: require("../../assets/illustrations/premium-mentor.png"), ratio: 320 / 346 },
  lock: { source: require("../../assets/illustrations/lock.png"), ratio: 540 / 376 },
  deleteUser: { source: require("../../assets/illustrations/delete-user.png"), ratio: 288 / 272 },
  premiumOk: { source: require("../../assets/illustrations/premium-ok.png"), ratio: 720 / 394 },
  mailCheck: { source: require("../../assets/illustrations/mail-check.png"), ratio: 686 / 526 },
  flagTG: { source: require("../../assets/illustrations/flag-tg.png"), ratio: 120 / 100 },
  flagBJ: { source: require("../../assets/illustrations/flag-bj.png"), ratio: 120 / 100 },
  flagCI: { source: require("../../assets/illustrations/flag-ci.png"), ratio: 120 / 100 },
  goalMentor: { source: require("../../assets/illustrations/goal-mentor.png"), ratio: 684 / 390 },
  flame: { source: require("../../assets/illustrations/flame.png"), ratio: 92 / 100 },
  star: { source: require("../../assets/illustrations/star.png"), ratio: 104 / 100 },
  reviewMentor: { source: require("../../assets/illustrations/review-mentor.png"), ratio: 362 / 306 },
  themeDanger: { source: require("../../assets/illustrations/theme-danger.png"), ratio: 140 / 128 },
  themePriority: { source: require("../../assets/illustrations/theme-priority.png"), ratio: 140 / 128 },
  clipboard: { source: require("../../assets/illustrations/clipboard.png"), ratio: 466 / 316 },
} satisfies Record<string, { source: number; ratio: number }>;

export type IllustrationName = keyof typeof FILES;

/** `width` en points, ou "100%" pour occuper toute la largeur disponible. */
export function Illustration({ name, width, style, round }: { name: IllustrationName; width: number | "100%"; style?: ViewStyle; round?: boolean }) {
  const { source, ratio } = FILES[name];
  return (
    <View style={[{ width, aspectRatio: ratio, alignSelf: "center" }, round && { borderRadius: 999, overflow: "hidden" }, style]}>
      <Image source={source} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

/** Drapeau d'un pays (images des maquettes, identiques sur tous les téléphones). */
export function Flag({ country, width = 32 }: { country: string; width?: number }) {
  const name = ({ TG: "flagTG", BJ: "flagBJ", CI: "flagCI" } as Record<string, IllustrationName>)[country];
  return name ? <Illustration name={name} width={width} style={{ borderRadius: 4, overflow: "hidden" }} /> : null;
}
