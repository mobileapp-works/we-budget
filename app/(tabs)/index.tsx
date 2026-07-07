/**
 * ホーム画面。今月の支出サマリー・立替残高・予算進捗・直近の支出を表示する。
 * 立替残高/予算バーはタップで各画面へ遷移。ソロモードでは立替を招待CTAに切替。
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, ProgressBar, EmptyState, StateView, ExpenseRow } from '@/components';
import {
  useRequireSession,
  useExpenses,
  useBudgets,
  useExchangeRates,
  useSettlementBalance,
  useUnreadCount,
  useExpenseHelpers,
  useLocale,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, layout } from '@/constants';
import { calculateBudgetUsage, formatCurrency, getMonthKey } from '@/utils';
import type { Expense } from '@/types/models';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const locale = useLocale();
  const session = useRequireSession();

  const monthKey = getMonthKey();
  const expensesQuery = useExpenses(monthKey);
  const { data: budgets } = useBudgets();
  const { data: rates } = useExchangeRates();
  const balanceQuery = useSettlementBalance();
  const unread = useUnreadCount();
  const { getCategory, getCategoryName, getPayerLabel } = useExpenseHelpers();

  const expenses = expensesQuery.data ?? [];
  const overallBudget = budgets?.find((b) => b.categoryId === null);

  // 今月の支出合計（予算ユーティリティを流用して通貨換算込みで集計）
  const usage = useMemo(
    () => calculateBudgetUsage(expenses, overallBudget?.amount ?? 0, rates ?? []),
    [expenses, overallBudget, rates]
  );

  const recent = expenses.slice(0, 5);
  const isPaired = session.pair.user2Id !== null;

  return (
    <Screen padded={false}>
      {/* ヘッダー: タイトル + 通知ベル */}
      <View style={styles.header}>
        <Text style={[typography.title1, { color: colors.textPrimary }]}>{t('home.title')}</Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.title') + (unread > 0 ? ` (${unread})` : '')}
          hitSlop={8}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={26} color={colors.textPrimary} />
          {unread > 0 ? <View style={[styles.badge, { backgroundColor: colors.error }]} /> : null}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <StateView
          isLoading={expensesQuery.isLoading}
          isError={expensesQuery.isError}
          isEmpty={expenses.length === 0}
          onRetry={() => expensesQuery.refetch()}
          emptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="receipt-outline"
                title={t('home.emptyTitle')}
                body={t('home.emptyBody')}
                actionLabel={t('home.record')}
                onAction={() => router.push('/expense-input')}
              />
            </View>
          }
        >
          {/* 今月の支出 */}
          <Card backgroundColor={colors.coralSoft} style={styles.summaryCard}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('home.totalSpending')}</Text>
            <Text style={[typography.display, { color: colors.textPrimary }]}>
              {formatCurrency(usage.used, 'JPY', locale)}
            </Text>
          </Card>

          {/* 立替残高 / ソロなら招待CTA（取得前に「精算済み」と誤表示しないよう data がある時のみ描画） */}
          {isPaired ? (
            balanceQuery.data ? (
              <BalanceCard
                onPress={() => router.push('/settlement')}
                amount={balanceQuery.data.settlementAmount}
                meReceives={balanceQuery.data.toUserId === session.userId}
                partnerName={session.partner?.displayName ?? t('expense.payerPartner')}
              />
            ) : null
          ) : (
            <Card onPress={() => router.push('/pairing')} accessibilityLabel={t('pairing.invitePartner')}>
              <View style={styles.row}>
                <Ionicons name="person-add-outline" size={22} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                  {t('home.invitePartnerCta')}
                </Text>
              </View>
            </Card>
          )}

          {/* 予算進捗 */}
          {overallBudget ? (
            <Card onPress={() => router.push('/budget')} accessibilityLabel={t('home.budgetProgress')}>
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('home.budgetProgress')}
              </Text>
              <ProgressBar percent={usage.percent} status={usage.status} />
              <Text style={[typography.footnote, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                {formatCurrency(usage.used, 'JPY', locale)} / {formatCurrency(usage.limit, 'JPY', locale)}（
                {Math.round(usage.percent)}%）
              </Text>
            </Card>
          ) : null}

          {/* 直近の支出 */}
          <View style={styles.sectionHeader}>
            <Text style={[typography.title3, { color: colors.textPrimary }]}>{t('home.recentExpenses')}</Text>
          </View>
          <Card style={styles.listCard}>
            {recent.map((e: Expense) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                category={getCategory(e.categoryId)}
                categoryName={getCategoryName(e.categoryId)}
                payerLabel={getPayerLabel(e)}
                amountText={formatCurrency(e.amount, e.currency, locale)}
                onPress={(id) => router.push(`/expense/${id}`)}
              />
            ))}
          </Card>
        </StateView>
      </ScrollView>
    </Screen>
  );
}

/** 立替残高カード。受け取り＝success色＋記号で色だけに頼らない。 */
function BalanceCard({
  amount,
  meReceives,
  partnerName,
  onPress,
}: {
  amount: number;
  meReceives: boolean;
  partnerName: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();

  const settled = amount <= 0;
  const label = settled
    ? t('home.allSettled')
    : meReceives
      ? t('home.owesYou', { name: partnerName })
      : t('home.youOwe', { name: partnerName });
  const color = settled ? colors.textSecondary : meReceives ? colors.success : colors.textPrimary;
  const sign = settled ? '' : meReceives ? '＋' : '−';

  return (
    <Card onPress={onPress} accessibilityLabel={`${label} ${formatCurrency(amount, 'JPY', locale)}`}>
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('home.balanceTitle')}</Text>
      <View style={[styles.row, { marginTop: spacing.xxs, justifyContent: 'space-between' }]}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
        {!settled ? (
          <Text style={[typography.title2, { color }]}>
            {sign}
            {formatCurrency(amount, 'JPY', locale)}
          </Text>
        ) : (
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bell: { width: layout.minTapSize, height: layout.minTapSize, alignItems: 'flex-end', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 2, width: 10, height: 10, borderRadius: 5 },
  scroll: { padding: spacing.md, gap: spacing.md },
  summaryCard: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionHeader: { marginTop: spacing.xs },
  listCard: { padding: 0, overflow: 'hidden' },
  emptyWrap: { minHeight: 360 },
});
