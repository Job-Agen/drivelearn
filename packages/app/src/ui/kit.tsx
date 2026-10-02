import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, type ComponentProps, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, space } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export { Ionicons as Icon };

export function Screen({
  children,
  scroll = true,
  footer,
  header,
}: PropsWithChildren<{ scroll?: boolean; footer?: ReactNode; header?: ReactNode }>) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header ? <View style={styles.header}>{header}</View> : null}
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** En-tête d'écran : retour ou fermeture à gauche/droite, titre centré, compteur. */
export function TopBar({
  onBack,
  onClose,
  title,
  right,
}: {
  onBack?: () => void;
  onClose?: () => void;
  title?: string;
  right?: string;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={26} color={colors.navy} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.topTitle} numberOfLines={1}>
        {title ?? ""}
      </Text>
      <View style={[styles.topSide, { alignItems: "flex-end" }]}>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Quitter">
            <Ionicons name="close" size={28} color={colors.navy} />
          </Pressable>
        ) : right ? (
          <Text style={styles.topRight}>{right}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function Title({ children, center, size = 28 }: PropsWithChildren<{ center?: boolean; size?: number }>) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.15 }, center && { textAlign: "center" }]}>{children}</Text>;
}

export function Subtitle({ children, center }: PropsWithChildren<{ center?: boolean }>) {
  return <Text style={[styles.subtitle, center && { textAlign: "center" }]}>{children}</Text>;
}

export function Body({ children, muted, center, style }: PropsWithChildren<{ muted?: boolean; center?: boolean; style?: TextStyle }>) {
  return (
    <Text style={[styles.body, muted && { color: colors.muted }, center && { textAlign: "center" }, style]}>{children}</Text>
  );
}

export function Link({
  label,
  onPress,
  icon,
  align = "center",
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  align?: "center" | "flex-end" | "flex-start";
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={[styles.link, { alignSelf: align }]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.blueDark} /> : null}
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  chevron?: boolean;
};

/** Bouton des maquettes : pilule pleine sarcelle avec chevron, ou contour bleu. */
export function Button({ label, onPress, variant = "primary", disabled, loading, chevron = variant === "primary" }: ButtonProps) {
  const off = disabled || loading;
  const filled = variant === "primary" || variant === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        off && { opacity: 0.5 },
        pressed && !off && { transform: [{ translateY: 2 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? "#fff" : colors.blue} />
      ) : (
        <>
          <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
          {chevron ? (
            <Ionicons name="chevron-forward" size={22} color={filled ? "#fff" : colors.blueDark} style={styles.chevron} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Champ des maquettes : icône à gauche, texte d'exemple, œil pour afficher le mot de passe. */
export function Field(props: TextInputProps & { icon?: IconName; label?: string }) {
  const { icon, label, style, secureTextEntry, ...rest } = props;
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.input}>
        {icon ? <Ionicons name={icon} size={22} color={colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.inputText, style]}
          secureTextEntry={hidden}
          accessibilityLabel={label ?? rest.placeholder}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityLabel={hidden ? "Afficher le mot de passe" : "Masquer le mot de passe"}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Barre de progression en segments (une case par étape). */
export function Segments({ total, done }: { total: number; done: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel={`${done} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, i < done && { backgroundColor: colors.blue }]} />
      ))}
    </View>
  );
}

const LETTERS = "ABCDEFGH";

/** Choix de réponse avec sa lettre (A, B, C…), comme sur les écrans 10 et 11. */
export function Option({
  label,
  index,
  selected,
  onPress,
  state,
  multiple,
}: {
  label: string;
  index?: number;
  selected: boolean;
  onPress?: () => void;
  state?: "correct" | "wrong" | "missed";
  multiple?: boolean;
}) {
  const tone =
    state === "correct"
      ? styles.optionCorrect
      : state === "wrong"
        ? styles.optionWrong
        : state === "missed"
          ? styles.optionMissed
          : selected
            ? styles.optionSelected
            : null;
  const badgeOn = state === "wrong" ? colors.danger : selected || state === "correct" ? colors.primary : null;
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, tone]}
    >
      <View style={[styles.letter, badgeOn ? { backgroundColor: badgeOn } : null]}>
        <Text style={[styles.letterText, badgeOn ? { color: "#fff" } : null]}>
          {index === undefined ? (selected ? "✓" : "") : LETTERS[index]}
        </Text>
      </View>
      <Text style={styles.optionText}>{label}</Text>
      {state === "correct" || state === "missed" ? (
        <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
      ) : state === "wrong" ? (
        <Ionicons name="close-circle" size={28} color={colors.danger} />
      ) : multiple && selected ? (
        <Ionicons name="checkbox" size={24} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

export function Picture({ uri }: { uri: string | null }) {
  if (!uri) return null;
  return <Image source={{ uri }} style={styles.picture} contentFit="cover" cachePolicy="disk" accessibilityIgnoresInvertColors />;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function Row({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: space.sm }, style]}>{children}</View>;
}

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "accent" | "muted" | "danger" }) {
  const bg = { primary: colors.primarySoft, accent: colors.accentSoft, muted: colors.border, danger: colors.dangerSoft }[tone];
  const fg = { primary: colors.primaryDark, accent: "#8A5A00", muted: colors.muted, danger: colors.danger }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontFamily: fonts.extrabold, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/** Logo texte « DriveLearn » : Drive en bleu nuit, Learn en sarcelle, petite route dessous. */
export function Logo({ size = 40, light }: { size?: number; light?: boolean }) {
  return (
    <View style={{ alignItems: "center" }} accessibilityRole="header" accessibilityLabel="DriveLearn">
      <Text style={{ fontFamily: fonts.black, fontSize: size, lineHeight: size * 1.15, letterSpacing: -0.5 }}>
        <Text style={{ color: light ? "#fff" : colors.navy }}>Drive</Text>
        <Text style={{ color: light ? "#fff" : colors.primary }}>Learn</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 4, marginTop: -size * 0.08, transform: [{ skewX: "-30deg" }] }}>
        <View style={{ width: size * 0.9, height: size * 0.13, borderRadius: 4, backgroundColor: light ? "#fff" : colors.navy }} />
        <View style={{ width: size * 0.5, height: size * 0.13, borderRadius: 4, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}

/** Bulle du moniteur (écrans 09 et 11). */
export function Mentor({ text, children, plain }: PropsWithChildren<{ text: string; plain?: boolean }>) {
  return (
    <View style={[styles.mentor, plain && { backgroundColor: "transparent", paddingHorizontal: 0 }]}>
      {children}
      <View style={[styles.bubble, plain && { backgroundColor: colors.blueSoft }]}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.md },
  scroll: { padding: space.md, gap: space.md, flexGrow: 1 },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
  topBar: { flexDirection: "row", alignItems: "center", minHeight: 40 },
  topSide: { width: 48 },
  topTitle: { flex: 1, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 20, color: colors.navy },
  topRight: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  title: { fontFamily: fonts.black, color: colors.navy },
  subtitle: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26, color: colors.navy },
  body: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, color: colors.text },
  error: { color: colors.danger, fontSize: 15, fontFamily: fonts.semibold },
  label: { fontSize: 14, fontFamily: fonts.bold, color: colors.muted },
  link: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: { fontFamily: fonts.bold, fontSize: 16, color: colors.blueDark },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 56,
  },
  // Sur le web, pas de contour du navigateur : le cadre du champ suffit.
  inputText: { flex: 1, fontSize: 16, fontFamily: fonts.semibold, color: colors.text, paddingVertical: 14, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  button: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 48,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  button_primary: { backgroundColor: colors.primary, borderBottomWidth: 4, borderBottomColor: colors.primaryDark },
  button_outline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: "#B9D7F5" },
  button_ghost: { backgroundColor: "transparent", minHeight: 44, paddingVertical: 8 },
  button_danger: { backgroundColor: colors.danger, borderBottomWidth: 4, borderBottomColor: "#B3363A" },
  buttonText: { fontSize: 19, fontFamily: fonts.extrabold },
  buttonText_primary: { color: "#fff" },
  buttonText_outline: { color: colors.blueDark },
  buttonText_ghost: { color: colors.blueDark, fontSize: 16 },
  buttonText_danger: { color: "#fff" },
  chevron: { position: "absolute", right: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  segment: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    minHeight: 60,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionMissed: { borderColor: colors.primary, borderStyle: "dashed" },
  optionText: { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.navy, lineHeight: 23 },
  letter: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  letterText: { fontFamily: fonts.black, fontSize: 17, color: colors.navy },
  picture: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: colors.blueSoft },
  mentor: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: space.md,
    paddingBottom: 0,
    overflow: "hidden",
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    alignSelf: "center",
  },
  bubbleText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.navy },
});
