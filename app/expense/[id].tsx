/** 支出詳細。表示・編集・削除（どちらのユーザーでも可。削除は確認ダイアログ）。 */
import React, { useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, StateView, CategoryIcon, useCategoryName } from '@/components';
import { useExpense, useExpenseActions, useExpenseHelpers, useLocale, useReceiptImageUrl, useRequireSession, useSettlementActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency, formatDate, calculateExpenseSettlement } from '@/utils';
import type { UUID } from '@/types/models';

export default function ExpenseDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const locale = useLocale();
  const toast = useToast();
  const session = useRequireSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const expenseQuery = useExpense(id);
  const { deleteExpense, updateExpense } = useExpenseActions();
  const { settleExpense } = useSettlementActions();
  const { getCategory, getCategoryName, getPayerLabel } = useExpenseHelpers();
  const resolveName = useCategoryName();

  const expense = expenseQuery.data;
  // レシートは private バケットの Storage パスで保存されるため、表示用に署名URLへ解決する。
  const receiptUrl = useReceiptImageUrl(expense?.receiptImageUrl ?? null);

  const isSettled = expense?.settlementId !== null && expense?.settlementId !== undefined;

  /** 記録者の表示名（自分 / パートナー名 / 退会したユーザー）。 */
  const recorderName = (userId: UUID | null): string => {
    if (userId === null) return t('expense.retiredUser');
    if (userId === session.userId) return t('expense.payerSelf');
    if (session.partner && userId === session.partner.id) return session.partner.displayName;
    return t('expense.payerPartner');
  };

  const confirmDelete = () => {
    if (!expense) return;
    // 精算済みの支出は削除しても過去の精算額に反映されないことを明示する
    Alert.alert(t('common.delete'), isSettled ? t('expense.deleteConfirmSettled') : t('expense.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          deleteExpense.mutate(expense.id, {
            onSuccess: () => {
              toast.show(t('expense.deleted'), 'success');
              router.back();
            },
            onError: () => toast.show(t('error.generic'), 'error'),
          }),
      },
    ]);
  };

  // 個別精算の対象は「未精算の個人立替」のみ（共同口座払い・精算済みは対象外）。
  const canSettleFromShared =
    !!expense && !isSettled && !expense.isSharedPayment && expense.payerUserId !== null;

  // この立替を共同口座払いに切り替える＝立替者へ共同口座から払い戻し、貸し借りから外す。
  const confirmSettleFromShared = () => {
    if (!expense) return;
    const amount = formatCurrency(expense.amount, expense.currency, locale);
    Alert.alert(t('expense.settleFromSharedConfirmTitle'), t('expense.settleFromSharedConfirmBody', { amount }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('expense.settleFromShared'),
        onPress: () =>
          updateExpense.mutate(
            {
              id: expense.id,
              expectedUpdatedAt: expense.updatedAt,
              input: {
                categoryId: expense.categoryId,
                amount: expense.amount,
                currency: expense.currency,
                exchangeRate: expense.exchangeRate,
                baseAmount: expense.baseAmount,
                payerUserId: null,
                isSharedPayment: true,
                expenseDate: expense.expenseDate,
                description: expense.description,
                storeName: expense.storeName,
                receiptImageUrl: expense.receiptImageUrl,
              },
            },
            {
              onSuccess: () => toast.show(t('expense.settledFromShared'), 'success'),
              onError: () => toast.show(t('error.generic'), 'error'),
            }
          ),
      },
    ]);
  };

  // 個別精算(person-to-person): 分担比率での相手負担分。支払者が受け取る側。
  const individual = useMemo(
    () => (expense ? calculateExpenseSettlement(expense, session.pair, session.pair.baseCurrency) : null),
    [expense, session.pair]
  );

  const canSettleWithPartner = individual !== null;

  // 立替1件を相手と個別精算する（金額・方向は individual に従う）。
  const confirmSettleWithPartner = () => {
    if (!expense || !individual) return;
    Alert.alert(
      t('settlement.confirmTitle'),
      t('settlement.confirmBody', {
        from: recorderName(individual.fromUserId),
        to: recorderName(individual.toUserId),
        amount: formatCurrency(individual.amount, individual.currency, locale),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settlement.settleButton'),
          onPress: () =>
            settleExpense.mutate(expense.id, {
              onSuccess: () => toast.show(t('expense.settledWithPartner'), 'success'),
              onError: () => toast.show(t('error.generic'), 'error'),
            }),
        },
      ]
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('expense.detailTitle')} />
      <StateView
        isLoading={expenseQuery.isLoading}
        isError={expenseQuery.isError || !expense}
        onRetry={() => expenseQuery.refetch()}
      >
        {expense ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* 精算済み注意（編集・削除しても過去の精算額は変わらない） */}
            {isSettled ? (
              <Card style={styles.noticeCard}>
                <Ionicons name="information-circle" size={20} color={colors.warning} />
                <Text style={[typography.footnote, styles.noticeText, { color: colors.textSecondary }]}>
                  {t('expense.settledNotice')}
                </Text>
              </Card>
            ) : null}

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
              <DetailRow label={t('expense.recordedBy')} value={recorderName(expense.recordedBy)} last />
            </Card>

            {receiptUrl ? (
              <Image source={{ uri: receiptUrl }} style={styles.receipt} accessibilityLabel={t('expense.scanReceipt')} />
            ) : null}

            <View style={styles.actions}>
              {canSettleWithPartner ? (
                <>
                  <Button
                    title={t('expense.settleWithPartner')}
                    left={<Ionicons name="swap-horizontal-outline" size={18} color={colors.primaryText} />}
                    onPress={confirmSettleWithPartner}
                    loading={settleExpense.isPending}
                  />
                  <Text style={[typography.footnote, styles.settleHint, { color: colors.textPlaceholder }]}>
                    {t('expense.settleWithPartnerHint')}
                  </Text>
                </>
              ) : null}
              {canSettleFromShared ? (
                <>
                  <Button
                    title={t('expense.settleFromShared')}
                    variant="secondary"
                    left={<Ionicons name="wallet-outline" size={18} color={colors.textPrimary} />}
                    onPress={confirmSettleFromShared}
                    loading={updateExpense.isPending}
                  />
                  <Text style={[typography.footnote, styles.settleHint, { color: colors.textPlaceholder }]}>
                    {t('expense.settleFromSharedHint')}
                  </Text>
                </>
              ) : null}
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
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeText: { flex: 1 },
  amountCard: { alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  receipt: { width: '100%', height: 200, borderRadius: radius.md, resizeMode: 'cover' },
  actions: { marginTop: spacing.xs },
  settleHint: { marginTop: spacing.xs, marginBottom: spacing.sm, textAlign: 'center' },
});
