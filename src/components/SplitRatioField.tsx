/**
 * 負担割合の入力フィールド。「自分の％」を 1〜99 の整数で自由入力し、
 * 相手側は 100- で自動表示する。変更があり、かつ妥当な値のときだけ保存できる。
 * 割合は精算残高の計算にのみ使われる（design.md / settlement.ts）。
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { TextField } from './TextField';
import { Button } from './Button';

interface SplitRatioFieldProps {
  /** 自分の表示名（サマリー用） */
  myLabel: string;
  /** 相手の表示名（サマリー用） */
  partnerLabel: string;
  /** 現在保存されている「自分の負担割合」（1〜99） */
  myPercent: number;
  onSave: (myPercent: number) => void;
  saving?: boolean;
}

/** 1〜99 の整数のみ許容。妥当なら数値、そうでなければ null。 */
function parseRatio(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= 1 && n <= 99 ? n : null;
}

export function SplitRatioField({ myLabel, partnerLabel, myPercent, onSave, saving }: SplitRatioFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState(String(myPercent));

  // 保存後にセッションが更新され myPercent が変わったら入力欄も追従させる。
  useEffect(() => {
    setText(String(myPercent));
  }, [myPercent]);

  const parsed = parseRatio(text);
  const invalid = text.trim().length > 0 && parsed === null;
  const partnerPercent = parsed !== null ? 100 - parsed : 100 - myPercent;
  const canSave = parsed !== null && parsed !== myPercent;

  return (
    <View>
      <TextField
        label={t('profile.splitRatioSelf')}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        maxLength={2}
        error={invalid ? t('profile.splitRatioError') : null}
      />
      <Text style={[typography.subhead, styles.summary, { color: colors.textSecondary }]}>
        {t('profile.splitRatioSummary', {
          me: myLabel,
          myPct: parsed ?? myPercent,
          partner: partnerLabel,
          partnerPct: partnerPercent,
        })}
      </Text>
      <Button title={t('common.save')} onPress={() => parsed !== null && onSave(parsed)} disabled={!canSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: spacing.sm },
});
