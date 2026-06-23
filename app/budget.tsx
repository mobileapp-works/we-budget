/** 予算画面。全体/カテゴリ別の月間予算を設定し、当月使用状況を進捗バーで表示する。 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, ProgressBar, StateView, CategoryIcon, useCategoryName } from '@/components';
import { useBudgets, useBudgetActions, useExpenses, useCategories, useExchangeRates, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { buildRateMap, convertAmount, calculateBudgetUsage, formatCurrency, getMonthKey, parseAmount } from '@/utils';
import type { Category, UUID } from '@/types/models';

interface EditTarget {
  categoryId: UUID | null;
  label: string;
  current: number;
}

export default function BudgetScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();
  const resolveName = useCategoryName();

  const budgetsQuery = useBudgets();
  const { upsertBudget } = useBudgetActions();
  const { data: expenses } = useExpenses(getMonthKey());
  const { data: categories } = useCategories();
  const { data: rates } = useExchangeRates();

  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // カテゴリ別の当月使用額（JPY換算）
  const usageByCategory = useMemo(() => {
    const rateMap = buildRateMap(rates ?? []);
    const map = new Map<string, number>();
    let total = 0;
    for (const e of expenses ?? []) {
      const v = convertAmount(e.amount, e.currency, 'JPY', rateMap);
      if (v === null) continue;
      map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + v);
      total += v;
    }
    return { map, total };
  }, [expenses, rates]);

  const overall = budgetsQuery.data?.find((b) => b.categoryId === null);
  const overallUsage = calculateBudgetUsage(expenses ?? [], overall?.amount ?? 0, rates ?? []);

  const openEditor = (target: EditTarget) => {
    setEdit(target);
    setAmountInput(target.current > 0 ? String(target.current) : '');
  };

  const handleSave = () => {
    if (!edit) return;
    const parsed = parseAmount(amountInput);
    if (parsed === null) {
      toast.show(t('error.amountPositive'), 'error');
      return;
    }
    upsertBudget.mutate(
      { categoryId: edit.categoryId, amount: parsed, currency: 'JPY' },
      {
        onSuccess: () => {
          toast.show(t('expense.saved'), 'success');
          setEdit(null);
        },
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const budgetedCategoryIds = new Set(budgetsQuery.data?.filter((b) => b.categoryId).map((b) => b.categoryId));

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('budget.title')} />
      <StateView isLoading={budgetsQuery.isLoading} isError={budgetsQuery.isError} onRetry={() => budgetsQuery.refetch()}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 全体予算 */}
          <Text style={[typography.footnote, styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('budget.overall').toUpperCase()}
          </Text>
          <Card onPress={() => openEditor({ categoryId: null, label: t('budget.overall'), current: overall?.amount ?? 0 })}>
            {overall ? (
              <BudgetBar
                label={t('budget.overall')}
                used={overallUsage.used}
                limit={overallUsage.limit}
                percent={overallUsage.percent}
                status={overallUsage.status}
                locale={locale}
              />
            ) : (
              <Text style={[typography.body, { color: colors.primary }]}>{t('budget.setBudget')}</Text>
            )}
          </Card>

          {/* カテゴリ別予算 */}
          <Text style={[typography.footnote, styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('budget.byCategory').toUpperCase()}
          </Text>
          <Card style={styles.listCard}>
            {categories?.map((c: Category, idx) => {
              const budget = budgetsQuery.data?.find((b) => b.categoryId === c.id);
              const used = usageByCategory.map.get(c.id) ?? 0;
              const limit = budget?.amount ?? 0;
              const percent = limit > 0 ? (used / limit) * 100 : 0;
              const status = percent >= 100 ? 'exceeded' : percent >= 80 ? 'warning' : 'safe';
              return (
                <Pressable
                  key={c.id}
                  onPress={() => openEditor({ categoryId: c.id, label: resolveName(c), current: limit })}
                  accessibilityRole="button"
                  accessibilityLabel={resolveName(c)}
                  style={[styles.catRow, idx < (categories.length - 1) && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size={32} />
                  <View style={styles.catBody}>
                    <View style={styles.catTop}>
                      <Text style={[typography.body, { color: colors.textPrimary }]}>{resolveName(c)}</Text>
                      <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                        {budgetedCategoryIds.has(c.id)
                          ? `${formatCurrency(used, 'JPY', locale)} / ${formatCurrency(limit, 'JPY', locale)}`
                          : t('budget.setBudget')}
                      </Text>
                    </View>
                    {budgetedCategoryIds.has(c.id) ? <ProgressBar percent={percent} status={status} height={6} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </ScrollView>
      </StateView>

      {/* 予算編集モーダル */}
      <Modal visible={edit !== null} transparent animationType="fade" onRequestClose={() => setEdit(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEdit(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {edit?.label} ・ {t('budget.monthlyBudget')}
            </Text>
            <TextField
              label={t('budget.monthlyBudget')}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="numeric"
              prefix="￥"
              autoFocus
            />
            <Button title={t('common.save')} onPress={handleSave} loading={upsertBudget.isPending} />
            <Button title={t('common.cancel')} variant="text" onPress={() => setEdit(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function BudgetBar({
  used,
  limit,
  percent,
  status,
  locale,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  status: 'safe' | 'warning' | 'exceeded';
  locale: string;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <ProgressBar percent={percent} status={status} />
      <Text style={[typography.footnote, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        {formatCurrency(used, 'JPY', locale)} / {formatCurrency(limit, 'JPY', locale)}（{Math.round(percent)}%）
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.xs },
  sectionTitle: { marginTop: spacing.md, marginLeft: spacing.xs, letterSpacing: 0.5 },
  listCard: { padding: 0, overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  catBody: { flex: 1, marginLeft: spacing.sm },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
});
