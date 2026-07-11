/**
 * レポート画面。カテゴリ別の支出を集計し、割合バーで可視化する。
 * 期間は「月 / 週」を切替（カスタムは将来。MVPは当月データを基に集計）。
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Screen, Card, EmptyState, StateView, SegmentedControl, CategoryIcon, useCategoryName } from '@/components';
import { useExpenses, useCategories, useLocale, useRequireSession } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency, getMonthKey, roundMoney } from '@/utils';
import type { Category } from '@/types/models';

type Period = 'month' | 'week';

export default function ReportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const resolveName = useCategoryName();
  const session = useRequireSession();
  const baseCurrency = session.pair.baseCurrency;

  const [period, setPeriod] = useState<Period>('month');
  const expensesQuery = useExpenses(getMonthKey());
  const { data: categories } = useCategories();

  const expenses = expensesQuery.data ?? [];

  // 期間で絞り込み（週は直近7日）
  const scoped = useMemo(() => {
    if (period === 'month') return expenses;
    const weekAgo = dayjs().subtract(7, 'day');
    return expenses.filter((e) => dayjs(e.expenseDate).isAfter(weekAgo));
  }, [expenses, period]);

  // カテゴリ別合計（基準通貨換算済みの baseAmount を合計）
  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0;
    for (const e of scoped) {
      totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.baseAmount);
      total += e.baseAmount;
    }
    const categoryMap = new Map<string, Category>();
    categories?.forEach((c) => categoryMap.set(c.id, c));
    const rows = [...totals.entries()]
      .map(([categoryId, amount]) => ({
        category: categoryMap.get(categoryId),
        amount: roundMoney(amount, baseCurrency),
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, total: roundMoney(total, baseCurrency) };
  }, [scoped, categories, baseCurrency]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[typography.title1, { color: colors.textPrimary }]}>{t('report.title')}</Text>
      </View>

      <View style={styles.segment}>
        <SegmentedControl<Period>
          options={[
            { value: 'month', label: t('report.periodMonth') },
            { value: 'week', label: t('report.periodWeek') },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </View>

      <StateView
        isLoading={expensesQuery.isLoading}
        isError={expensesQuery.isError}
        isEmpty={breakdown.rows.length === 0}
        onRetry={() => expensesQuery.refetch()}
        emptyComponent={<EmptyState icon="bar-chart-outline" title={t('report.emptyTitle')} body={t('report.emptyBody')} />}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card backgroundColor={colors.coralSoft} style={styles.totalCard}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('report.total')}</Text>
            <Text style={[typography.title1, { color: colors.textPrimary }]}>
              {formatCurrency(breakdown.total, baseCurrency, locale)}
            </Text>
          </Card>

          <Card>
            {breakdown.rows.map((row) => (
              <View key={row.category?.id ?? 'unknown'} style={styles.row}>
                <CategoryIcon icon={row.category?.icon ?? 'pricetag'} color={row.category?.color ?? colors.textPlaceholder} size={36} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[typography.body, { color: colors.textPrimary }]}>
                      {row.category ? resolveName(row.category) : '-'}
                    </Text>
                    <Text style={[typography.body, { color: colors.textPrimary }]}>
                      {formatCurrency(row.amount, baseCurrency, locale)}
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: colors.coralSoft }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round(row.percent)}%`, backgroundColor: row.category?.color ?? colors.primary },
                      ]}
                    />
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{Math.round(row.percent)}%</Text>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  segment: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  scroll: { padding: spacing.md, gap: spacing.md },
  totalCard: { alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBody: { flex: 1, marginLeft: spacing.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs },
  barTrack: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },
});
