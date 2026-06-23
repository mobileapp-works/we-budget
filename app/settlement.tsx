/** 立替精算画面。残高表示・精算実行（確認ダイアログ）・精算履歴。 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, EmptyState, StateView } from '@/components';
import {
  useRequireSession,
  useSettlementBalance,
  useSettlements,
  useSettlementActions,
  useLocale,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { formatCurrency, formatDate } from '@/utils';
import type { UUID } from '@/types/models';

export default function SettlementScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const session = useRequireSession();

  const balanceQuery = useSettlementBalance();
  const settlementsQuery = useSettlements();
  const { settle } = useSettlementActions();

  const isPaired = session.pair.user2Id !== null;
  const balance = balanceQuery.data;

  /** ユーザーIDを表示名へ。 */
  const nameOf = (userId: UUID | null): string => {
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
          onPress: () => settle.mutate(),
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
              </Card>
            )}

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
