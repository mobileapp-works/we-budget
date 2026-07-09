/** 立替精算画面。残高表示・精算実行（確認ダイアログ）・為替レート入力・精算履歴。 */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, EmptyState, StateView, TextField } from '@/components';
import {
  useRequireSession,
  useSettlementBalance,
  useSettlements,
  useSettlementActions,
  useExchangeRates,
  useExchangeRateActions,
  useLocale,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import { formatCurrency, formatDate, parseAmount } from '@/utils';
import type { UUID } from '@/types/models';

export default function SettlementScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();
  const session = useRequireSession();

  const balanceQuery = useSettlementBalance();
  const settlementsQuery = useSettlements();
  const { settle } = useSettlementActions();
  const ratesQuery = useExchangeRates();
  const { upsertRate } = useExchangeRateActions();

  const isPaired = session.pair.user2Id !== null;
  const balance = balanceQuery.data;

  // --- 為替レート入力（要件7-9: レート未設定の外貨は精算に含まれないため、ここで補完する） ---
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [savingRates, setSavingRates] = useState(false);
  const existingRates = ratesQuery.data ?? [];
  const rateCurrencies = [
    ...new Set([...(balance?.unconvertedCurrencies ?? []), ...existingRates.map((r) => r.fromCurrency)]),
  ];

  /** 表示値: ユーザー入力があればそれを、なければ設定済みレートを出す。 */
  const rateValueOf = (currency: string): string => {
    const typed = rateInputs[currency];
    if (typed !== undefined) return typed;
    const existing = existingRates.find((r) => r.fromCurrency === currency);
    return existing ? String(existing.rate) : '';
  };

  const handleSaveRates = async () => {
    // 触られた通貨だけを検証・保存する（未入力のまま残した通貨は対象外）
    const changed: Array<{ currency: string; rate: number }> = [];
    for (const [currency, text] of Object.entries(rateInputs)) {
      if (text.trim() === '') continue;
      const rate = parseAmount(text);
      if (rate === null) {
        toast.show(t('error.amountPositive'), 'error');
        return;
      }
      changed.push({ currency, rate });
    }
    if (changed.length === 0) return;
    setSavingRates(true);
    try {
      for (const { currency, rate } of changed) {
        await upsertRate.mutateAsync({ fromCurrency: currency, rate });
      }
      setRateInputs({});
      toast.show(t('settlement.ratesSaved'), 'success');
    } catch {
      toast.show(t('error.generic'), 'error');
    } finally {
      setSavingRates(false);
    }
  };

  /** ユーザーIDを表示名へ（null は退会で匿名化されたユーザー）。 */
  const nameOf = (userId: UUID | null): string => {
    if (userId === null) return t('expense.retiredUser');
    if (userId === session.userId) return t('expense.payerSelf');
    if (session.partner && userId === session.partner.id) return session.partner.displayName;
    return t('expense.payerPartner');
  };

  const confirmSettle = () => {
    if (!balance || balance.settlementAmount <= 0) return;
    Alert.alert(
      t('settlement.confirmTitle'),
      t('settlement.confirmBody', {
        from: nameOf(balance.fromUserId),
        to: nameOf(balance.toUserId),
        amount: formatCurrency(balance.settlementAmount, balance.currency, locale),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settlement.settleButton'),
          onPress: () =>
            settle.mutate(undefined, {
              onSuccess: () => toast.show(t('settlement.settled'), 'success'),
              onError: () => toast.show(t('error.generic'), 'error'),
            }),
        },
      ]
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('settlement.title')} />

      {!isPaired ? (
        <EmptyState icon="people-outline" title={t('settlement.soloEmptyTitle')} body={t('settlement.soloEmptyBody')} />
      ) : (
        <StateView isLoading={balanceQuery.isLoading} isError={balanceQuery.isError} onRetry={() => balanceQuery.refetch()}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* 残高カード */}
            {balance && balance.settlementAmount > 0 ? (
              <Card style={styles.balanceCard}>
                <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('settlement.balance')}</Text>
                <View style={styles.flow}>
                  <Text style={[typography.title3, { color: colors.textPrimary }]}>{nameOf(balance.fromUserId)}</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} style={{ marginHorizontal: spacing.sm }} />
                  <Text style={[typography.title3, { color: colors.textPrimary }]}>{nameOf(balance.toUserId)}</Text>
                </View>
                <Text style={[typography.display, { color: colors.primary, marginVertical: spacing.xs }]}>
                  {formatCurrency(balance.settlementAmount, balance.currency, locale)}
                </Text>
                {balance.unconvertedCurrencies.length > 0 ? (
                  <Text style={[typography.footnote, { color: colors.warning, marginBottom: spacing.sm }]}>
                    {t('settlement.unconvertedWarning', { currencies: balance.unconvertedCurrencies.join(', ') })}
                  </Text>
                ) : null}
                <Button title={t('settlement.settleButton')} onPress={confirmSettle} loading={settle.isPending} />
              </Card>
            ) : (
              <Card style={styles.balanceCard}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={[typography.title3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {t('settlement.noBalanceTitle')}
                </Text>
                <Text style={[typography.callout, { color: colors.textSecondary }]}>{t('settlement.noBalanceBody')}</Text>
                {balance && balance.unconvertedCurrencies.length > 0 ? (
                  <Text style={[typography.footnote, { color: colors.warning, marginTop: spacing.sm }]}>
                    {t('settlement.unconvertedWarning', { currencies: balance.unconvertedCurrencies.join(', ') })}
                  </Text>
                ) : null}
              </Card>
            )}

            {/* 為替レート入力（未設定の外貨がある/設定済みレートの修正） */}
            {rateCurrencies.length > 0 ? (
              <Card>
                <Text style={[typography.title3, { color: colors.textPrimary }]}>
                  {t('settlement.enterRatesTitle')}
                </Text>
                <Text style={[typography.footnote, { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm }]}>
                  {t('settlement.enterRatesBody')}
                </Text>
                <View style={styles.rateFields}>
                  {rateCurrencies.map((currency) => (
                    <TextField
                      key={currency}
                      label={t('settlement.rateLabel', { currency })}
                      value={rateValueOf(currency)}
                      onChangeText={(text) => setRateInputs((prev) => ({ ...prev, [currency]: text }))}
                      keyboardType="numeric"
                      placeholder={t('settlement.ratePlaceholder')}
                    />
                  ))}
                </View>
                <Button title={t('settlement.saveRates')} onPress={handleSaveRates} loading={savingRates} />
              </Card>
            ) : null}

            {/* 精算履歴 */}
            <Text style={[typography.title3, styles.historyTitle, { color: colors.textPrimary }]}>
              {t('settlement.historyTitle')}
            </Text>
            {settlementsQuery.data && settlementsQuery.data.length > 0 ? (
              <Card style={styles.historyCard}>
                {settlementsQuery.data.map((s) => (
                  <View key={s.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                    <View>
                      <Text style={[typography.body, { color: colors.textPrimary }]}>
                        {nameOf(s.fromUserId)} → {nameOf(s.toUserId)}
                      </Text>
                      <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                        {formatDate(s.settledAt, i18n.language)}
                      </Text>
                    </View>
                    <Text style={[typography.body, { color: colors.textPrimary }]}>
                      {formatCurrency(s.amount, s.currency, locale)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Text style={[typography.callout, { color: colors.textSecondary, paddingHorizontal: spacing.md }]}>
                {t('settlement.noHistory')}
              </Text>
            )}
          </ScrollView>
        </StateView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  balanceCard: { alignItems: 'center' },
  rateFields: { gap: spacing.sm, marginBottom: spacing.md },
  flow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  historyTitle: { marginTop: spacing.xs },
  historyCard: { padding: 0, overflow: 'hidden' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
