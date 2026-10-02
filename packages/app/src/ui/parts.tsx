import { Ionicons } from "@expo/vector-icons";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { IconName } from "./kit";
import { colors, fonts, radius, space } from "./theme";

// Éléments récurrents des maquettes : boutons radio, lignes de réglage, encarts d'information.

export function Radio({ on }: { on: boolean }) {
  return <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>;
}

export function Checkbox({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={styles.checkRow}>
      <View style={[styles.check, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/** Carte sélectionnable avec bouton radio à droite (écran 06). */
export function ChoiceRow({ selected, onPress, disabled, children }: PropsWithChildren<{ selected: boolean; onPress?: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.md }}>{children}</View>
      <Radio on={selected} />
    </Pressable>
  );
}

/** Ligne de liste du profil (écran 21). */
export function ListRow({
  icon,
  iconColor = colors.blue,
  leading,
  label,
  value,
  onPress,
  danger,
  chevron = true,
}: {
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={{ width: 30, alignItems: "center" }}>{leading ?? (icon ? <Ionicons name={icon} size={24} color={iconColor} /> : null)}</View>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {chevron ? <Ionicons name="chevron-forward" size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function Group({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** Encart bleu clair avec icône « i » (écrans 06, 15, 24, 27). */
export function InfoBox({ title, text, icon = "information-circle", tone = "blue" }: { title?: string; text: string; icon?: IconName; tone?: "blue" | "teal" }) {
  const teal = tone === "teal";
  return (
    <View style={[styles.info, teal && { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={icon} size={30} color={teal ? colors.primary : colors.blue} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.infoTitle, teal && { color: colors.navy }]}>{title}</Text> : null}
        <Text style={styles.infoText}>{text}</Text>
      </View>
    </View>
  );
}

export function Chip({ label, icon, tone = "soft" }: { label: string; icon?: IconName; tone?: "soft" | "solid" }) {
  const solid = tone === "solid";
  return (
    <View style={[styles.chip, solid && { backgroundColor: colors.blue }]}>
      {icon ? <Ionicons name={icon} size={18} color={solid ? "#fff" : colors.blue} /> : null}
      <Text style={[styles.chipText, solid && { color: "#fff" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.locked, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.blue },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.blue },
  checkRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.locked, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  checkLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy, flex: 1 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 68,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 13, paddingHorizontal: space.md },
  rowLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  rowValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  group: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  info: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: space.md },
  infoTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.blueDark },
  infoText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.muted },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "center" },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
});
