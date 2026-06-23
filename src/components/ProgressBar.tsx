/**
 * 予算進捗バー。使用率に応じて色を変える（safe/warning/exceeded）。
 * 色だけに頼らないよう、呼び出し側でパーセント・金額テキストを併記する。
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/constants';
import type { BudgetStatus } from '@/utils/budget';

interface ProgressBarProps {
  /** 0〜100（超過時は100でクリップ） */
  percent: number;
  status: BudgetStatus;
  height?: number;
}

export function ProgressBar({ percent, status, height = 10 }: ProgressBarProps) {
  const { colors } = useTheme();
  const fillColor =
    status === 'exceeded' ? colors.error : status === 'warning' ? colors.warning : colors.success;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View
      style={[styles.track, { height, borderRadius: radius.full, backgroundColor: colors.coralSoft }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped), min: 0, max: 100 }}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: fillColor, borderRadius: radius.full }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
