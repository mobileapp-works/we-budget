/** 支出履歴画面。日付順リスト + カテゴリフィルタ。FlatList で仮想化。 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, EmptyState, StateView, ExpenseRow, useCategoryName } from '@/components';
import { useExpenses, useCategories, useExpenseHelpers, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency, formatMonth, getMonthKey } from '@/utils';
import type { Expense, UUID } from '@/types/models';

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const locale = useLocale();

  const expensesQuery = useExpenses(getMonthKey());
  const { data: categories } = useCategories();
  const { getCategory, getCategoryName, getPayerLabel } = useExpenseHelpers();
  const resolveName = useCategoryName();

  const [filter, setFilter] = useState<UUID | 'all'>('all');

  const expenses = expensesQuery.data ?? [];
  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.categoryId === filter)),
    [expenses, filter]
  );

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => (
      <ExpenseRow
        expense={item}
        category={getCategory(item.categoryId)}
        categoryName={getCategoryName(item.categoryId)}
        payerLabel={getPayerLabel(item)}
        amountText={formatCurrency(item.amount, item.currency, locale)}
        onPress={(id) => router.push(`/expense/${id}`)}
      />
    ),
    [getCategory, getCategoryName, getPayerLabel, locale, router]
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[typography.title1, { color: colors.textPrimary }]}>{t('expense.historyTitle')}</Text>
        {/* 表示範囲が当月であることを明示（過去月が消えたと誤解されないように）。 */}
        <Text style={[typography.footnote, { color: colors.textSecondary }]}>{formatMonth(new Date(), i18n.language)}</Text>
      </View>

      {/* カテゴリフィルタ（横スクロールのチップ） */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'all' as const }, ...(categories ?? [])]}
        keyExtractor={(item) => ('id' in item ? item.id : 'all')}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const id = item.id;
          const selected = filter === id;
          const label = id === 'all' ? t('expense.allCategories') : resolveName(item as never);
          return (
            <Pressable
              onPress={() => setFilter(id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: selected ? colors.primary : colors.surface },
              ]}
            >
              <Text style={[typography.subhead, { color: selected ? colors.primaryText : colors.textSecondary }]}>
                {label}
              </Text>
            </Pressable>
          );
        }}
        style={styles.filterList}
      />

      <StateView
        isLoading={expensesQuery.isLoading}
        isError={expensesQuery.isError}
        isEmpty={filtered.length === 0}
        onRetry={() => expensesQuery.refetch()}
        emptyComponent={
          <EmptyState
            icon="receipt-outline"
            title={t('expense.emptyTitle')}
            body={t('expense.emptyBody')}
            actionLabel={t('home.record')}
            onAction={() => router.push('/expense-input')}
          />
        }
      >
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </StateView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterList: { flexGrow: 0 },
  filterRow: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.md },
});
