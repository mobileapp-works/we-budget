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
          // 数字（TextInput）とメトリクスを揃えるため prefix も lineHeight を無効化する。
          <Text style={[typography.body, styles.prefix, { color: colors.textSecondary, lineHeight: undefined }]}>
            {prefix}
          </Text>
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
          // 縦位置ズレの根本原因対策:
          // iOS の単一行 TextInput は lineHeight が指定されると文字が下寄せになるため、
          // フォントサイズ/太さは typography.body を使いつつ lineHeight だけ無効化して縦中央にする
          // （Android は styles.input の textAlignVertical / includeFontPadding で中央化）。
          style={[typography.body, styles.input, { color: colors.textPrimary, lineHeight: undefined }]}
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
  // includeFontPadding=false（Android）で上下の余分な行間を除去し、中央化のブレを無くす。
  prefix: { marginRight: spacing.xxs, includeFontPadding: false },
  input: {
    flex: 1,
    paddingVertical: 0,
    // Android の縦中央化。iOS では無視される（iOS は lineHeight 無効化で中央になる）。
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
