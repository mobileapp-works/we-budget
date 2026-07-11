/**
 * 基準通貨の変更画面。
 * 新しい通貨を選ぶと「1 旧 = ? 新」のレート入力と警告を表示し、
 * 確定すると過去の支出・予算・固定費・共同口座を新基準へ再換算する（確定済み精算は凍結）。
 */
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField } from '@/components';
import { useRequireSession, usePairActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius, layout, SUPPORTED_CURRENCIES } from '@/constants';
import { parseAmount } from '@/utils';

export default function BaseCurrencyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const session = useRequireSession();
  const { setBaseCurrency } = usePairActions();

  const currentBase = session.pair.baseCurrency;
  const [selected, setSelected] = useState<string>(currentBase);
  const [rate, setRate] = useState('');

  const changing = selected !== currentBase;

  const handleApply = () => {
    const parsedRate = parseAmount(rate);
    if (parsedRate === null) {
      toast.show(t('settings.baseCurrencyRateInvalid'), 'error');
      return;
    }
    // 再換算は一方向・近似のため、破壊的操作として確認する。
    Alert.alert(
      t('settings.baseCurrency'),
      t('settings.baseCurrencyChangeConfirm', { from: currentBase, to: selected, rate }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.baseCurrencyChangeApply'),
          style: 'destructive',
          onPress: () =>
            setBaseCurrency.mutate(
              { currency: selected, rate: parsedRate },
              {
                onSuccess: () => {
                  toast.show(t('settings.baseCurrencyChanged'), 'success');
                  router.back();
                },
                onError: () => toast.show(t('error.generic'), 'error'),
              }
            ),
        },
      ]
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('settings.baseCurrency')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.currentRow}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('settings.baseCurrencyCurrent')}</Text>
            <Text style={[typography.title3, { color: colors.textPrimary }]}>{currentBase}</Text>
          </View>
        </Card>

        <Card>
          <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            {t('settings.baseCurrencySelect')}
          </Text>
          <View style={styles.chipRow}>
            {SUPPORTED_CURRENCIES.map((c) => {
              const active = c === selected;
              return (
                <Pressable
                  key={c}
                  onPress={() => setSelected(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.surface }]}
                >
                  <Text style={[typography.subhead, { color: active ? colors.primaryText : colors.textSecondary }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {changing ? (
          <>
            <Card backgroundColor={colors.coralSoft} style={styles.warnCard}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={[typography.footnote, styles.warnText, { color: colors.textPrimary }]}>
                {t('settings.baseCurrencyChangeWarning')}
              </Text>
            </Card>

            <Card>
              <TextField
                label={t('settings.baseCurrencyChangeRate', { from: currentBase, to: selected })}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
                placeholder="0"
              />
            </Card>

            <Button
              title={t('settings.baseCurrencyChangeApply')}
              variant="destructive"
              onPress={handleApply}
              loading={setBaseCurrency.isPending}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: layout.minTapSize, // タップ領域 44pt 以上（CLAUDE.md）
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  warnText: { flex: 1 },
});
