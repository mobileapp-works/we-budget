/** 支出詳細。表示・編集・削除（どちらのユーザーでも可。削除は確認ダイアログ）。 */
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, StateView, CategoryIcon, useCategoryName } from '@/components';
import { useExpense, useExpenseActions, useExpenseHelpers, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency, formatDate } from '@/utils';

export default function ExpenseDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();

  const expenseQuery = useExpense(id);
  const { deleteExpense } = useExpenseActions();
  const { getCategory, getCategoryName, getPayerLabel } = useExpenseHelpers();
  const resolveName = useCategoryName();

  const expense = expenseQuery.data;

  const confirmDelete = () => {
    if (!expense) return;
    Alert.alert(t('expense.editTitle'), t('expense.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteExpense.mutate(expense.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('expense.editTitle')} />
      <StateView
        isLoading={expenseQuery.isLoading}
        isError={expenseQuery.isError || !expense}
        onRetry={() => expenseQuery.refetch()}
      >
        {expense ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* 金額 */}
            <Card backgroundColor={colors.coralSoft} style={styles.amountCard}>
              <CategoryIcon icon={getCategory(expense.categoryId)?.icon ?? 'pricetag'} color={getCategory(expense.categoryId)?.color ?? colors.primary} size={48} />
              <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                {formatCurrency(expense.amount, expense.currency, locale)}
              </Text>
              <Text style={[typography.callout, { color: colors.textSecondary }]}>
                {getCategoryName(expense.categoryId)}
              </Text>
            </Card>

            <Card>
              <DetailRow label={t('expense.payer')} value={getPayerLabel(expense)} />
              <DetailRow label={t('expense.date')} value={formatDate(expense.expenseDate, i18n.language)} />
              {expense.storeName ? <DetailRow label={t('expense.store')} value={expense.storeName} /> : null}
              {expense.description ? <DetailRow label={t('expense.memo')} value={expense.description} /> : null}
              <DetailRow
                label={t('expense.recordedBy')}
                value={expense.recordedBy ? '' : t('expense.retiredUser')}
                last
              />
            </Card>

            {expense.receiptImageUrl ? (
              <Image source={{ uri: expense.receiptImageUrl }} style={styles.receipt} accessibilityLabel="receipt" />
            ) : null}

            <View style={styles.actions}>
              <Button title={t('common.edit')} onPress={() => router.push(`/expense-input?id=${expense.id}`)} />
              <View style={{ height: spacing.sm }} />
              <Button title={t('common.delete')} variant="destructive" onPress={confirmDelete} loading={deleteExpense.isPending} />
            </View>
          </ScrollView>
        ) : null}
      </StateView>
    </Screen>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  amountCard: { alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  receipt: { width: '100%', height: 200, borderRadius: radius.md, resizeMode: 'cover' },
  actions: { marginTop: spacing.xs },
});
