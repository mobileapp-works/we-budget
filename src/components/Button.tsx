/**
 * 汎用ボタン。出典: docs/ui/components.md。
 * variant で見た目を切り替え、loading/disabled を安全に扱う（多重押下防止）。
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography, layout } from '@/constants';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** 左に表示する要素（アイコン等） */
  left?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  left,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: colors.surface, fg: colors.textPrimary, border: colors.border },
    accent: { bg: colors.accent, fg: colors.accentText },
    destructive: { bg: colors.error, fg: '#FFFFFF' },
    text: { bg: 'transparent', fg: colors.primary },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'text' ? styles.textVariant : null,
        {
          backgroundColor: p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.content}>
          {left ? <View style={styles.left}>{left}</View> : null}
          <Text style={[typography.callout, styles.label, { color: p.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textVariant: {
    minHeight: layout.minTapSize,
    paddingHorizontal: spacing.sm,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  left: { marginRight: spacing.xs },
  label: { fontWeight: '600' },
});
