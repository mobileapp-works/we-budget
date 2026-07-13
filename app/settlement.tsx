/** 立替精算画面。残高表示・精算実行（確認ダイアログ）・精算履歴。 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, EmptyState, StateView, SplitRatioField } from '@/components';
import {
  useRequireSession,
  useSettlementBalance,
  useSettlements,
  useSettlementActions,
  useSplitRatio,
  useLocale,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography } from '@/constants';
import { formatCurrency, formatDate } from '@/utils';
import type { UUID } from '@/types/models';

export default function SettlementScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();
  const session = useRequireSession();

  const balanceQuery = useSettlementBalance();
  const settlementsQuery = useSettlements();
  const { settle, settleFromShared } = useSettlementActions();
  const { myPercent, save: saveSplitRatio, saving: savingRatio } = useSplitRatio();

  const isPaired = session.pair.user2Id !== null;
  const balance = balanceQuery.data;

  const handleSaveRatio = (mine: number) => {
    saveSplitRatio(mine, {
      onSuccess: () => toast.show(t('common.saved'), 'success'),
      onError: () => toast.show(t('error.generic'), 'error'),
    });
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

  // まとめて共同口座から精算（ネット残高ぶんを共同口座から立替者へ払い戻す）。
  const confirmSettleFromShared = () => {
    if (!balance || balance.settlementAmount <= 0) return;
    Alert.alert(
      t('settlement.fromSharedConfirmTitle'),
      t('settlement.fromSharedConfirmBody', {
        to: nameOf(balance.toUserId),
        amount: formatCurrency(balance.settlementAmount, balance.currency, locale),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settlement.settleFromSharedButton'),
          onPress: () =>
            settleFromShared.mutate(undefined, {
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
                <Button title={t('settlement.settleButton')} onPress={confirmSettle} loading={settle.isPending} />
                <View style={{ height: spacing.sm }} />
                <Button
                  title={t('settlement.settleFromSharedButton')}
                  variant="secondary"
                  left={<Ionicons name="wallet-outline" size={18} color={colors.textPrimary} />}
                  onPress={confirmSettleFromShared}
                  loading={settleFromShared.isPending}
                />
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

            {/* 負担割合（残高計算に使われる）。ここで変えると上の残高が再計算される。 */}
            <Card>
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xxs }]}>
                {t('settlement.splitRatioTitle')}
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                {t('settlement.splitRatioHint')}
              </Text>
              <SplitRatioField
                myLabel={t('expense.payerSelf')}
                partnerLabel={session.partner?.displayName ?? t('expense.payerPartner')}
                myPercent={myPercent}
                onSave={handleSaveRatio}
                saving={savingRatio}
              />
            </Card>

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
