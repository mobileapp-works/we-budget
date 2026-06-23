/** 入力フィールド。出典: docs/ui/components.md（ラベル常時表示・フォーカス/エラー表示）。 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/constants';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  /** 金額入力などで前置する記号（例: ￥） */
  prefix?: string;
}

export function TextField({ label, error, prefix, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrapper}>
      <Text style={[typography.subhead, styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor, backgroundColor: colors.surfaceElevated }]}>
        {prefix ? (
          <Text style={[typography.body, { color: colors.textSecondary, marginRight: spacing.xxs }]}>{prefix}</Text>
        ) : null}
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={colors.textPlaceholder}
          style={[typography.body, styles.input, { color: colors.textPrimary }]}
        />
      </View>
      {error ? <Text style={[typography.footnote, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xxs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  input: { flex: 1, paddingVertical: spacing.xs },
});
