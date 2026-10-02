import { Image } from "expo-image";
import type { PropsWithChildren, ReactNode } from "react";
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
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, space } from "./theme";

export function Screen({
  children,
  scroll = true,
  footer,
}: PropsWithChildren<{ scroll?: boolean; footer?: ReactNode }>) {
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
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: PropsWithChildren) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({ children, muted, center }: PropsWithChildren<{ muted?: boolean; center?: boolean }>) {
  return <Text style={[styles.body, muted && { color: colors.muted }, center && { textAlign: "center" }]}>{children}</Text>;
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: ButtonProps) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        off && { opacity: 0.5 },
        pressed && !off && { transform: [{ translateY: 2 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
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

export function Option({
  label,
  selected,
  onPress,
  state,
  multiple,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
  state?: "correct" | "wrong" | "missed";
  multiple?: boolean;
}) {
  const tone =
    state === "correct" ? styles.optionCorrect : state === "wrong" ? styles.optionWrong : state === "missed" ? styles.optionMissed : selected ? styles.optionSelected : null;
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, tone]}
    >
      <View
        style={[
          styles.mark,
          multiple ? { borderRadius: 6 } : { borderRadius: 12 },
          selected && styles.markOn,
          selected && state === "wrong" && { backgroundColor: colors.danger, borderColor: colors.danger },
        ]}
      >
        {selected ? <Text style={styles.markText}>✓</Text> : null}
      </View>
      <Text style={styles.optionText}>{label}</Text>
    </Pressable>
  );
}

export function Picture({ uri }: { uri: string | null }) {
  if (!uri) return null;
  return <Image source={{ uri }} style={styles.picture} contentFit="contain" cachePolicy="disk" accessibilityIgnoresInvertColors />;
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
      <Text style={{ color: fg, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.md, gap: space.md, flexGrow: 1 },
  footer: { padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  error: { color: colors.danger, fontSize: 15 },
  label: { fontSize: 14, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: { borderRadius: radius.md, paddingVertical: 15, alignItems: "center", justifyContent: "center", minHeight: 52 },
  button_primary: { backgroundColor: colors.primary, borderBottomWidth: 4, borderBottomColor: colors.primaryDark },
  button_secondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderBottomWidth: 4 },
  button_ghost: { backgroundColor: "transparent" },
  button_danger: { backgroundColor: colors.danger, borderBottomWidth: 4, borderBottomColor: "#B3363A" },
  buttonText: { fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  buttonText_primary: { color: "#fff" },
  buttonText_secondary: { color: colors.text },
  buttonText_ghost: { color: colors.primaryDark },
  buttonText_danger: { color: "#fff" },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionMissed: { borderColor: colors.primary, borderStyle: "dashed" },
  optionText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },
  mark: { width: 24, height: 24, borderWidth: 2, borderColor: colors.locked, alignItems: "center", justifyContent: "center" },
  markOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  markText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  picture: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: colors.card },
});
