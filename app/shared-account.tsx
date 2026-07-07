/** 共同口座画面。残高サマリー・入金記録・明細表示。買い物は支出入力側で記録。 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, EmptyState, StateView } from '@/components';
import { useSharedEntries, useSharedAccountActions, useSharedExpenses, useExchangeRates, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { calculateSharedBalance, formatCurrency, parseAmount, today } from '@/utils';

export default function SharedAccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();

  const entriesQuery = useSharedEntries();
  const { addEntry } = useSharedAccountActions();
  // 残高は全期間のΣで計算する（当月分だけだと月替わりで過去の共同支出が消えて残高が狂う）。
  const { data: sharedExpenses } = useSharedExpenses();
  const { data: rates } = useExchangeRates();

  const [depositOpen, setDepositOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');

  const balance = useMemo(
    () => calculateSharedBalance(entriesQuery.data ?? [], sharedExpenses ?? [], rates ?? []),
    [entriesQuery.data, sharedExpenses, rates]
  );

  const handleDeposit = () => {
    const parsed = parseAmount(amountInput);
    if (parsed === null) {
      toast.show(t('error.amountPositive'), 'error');
      return;
    }
    addEntry.mutate(
      { type: 'deposit', amount: parsed, currency: 'JPY', description: null, transactionDate: today() },
      {
        onSuccess: () => {
          toast.show(t('expense.saved'), 'success');
          setDepositOpen(false);
          setAmountInput('');
        },
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const entries = entriesQuery.data ?? [];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('sharedAccount.title')} />
      <StateView
        isLoading={entriesQuery.isLoading}
        isError={entriesQuery.isError}
        isEmpty={entries.length === 0 && (sharedExpenses ?? []).length === 0}
        onRetry={() => entriesQuery.refetch()}
        emptyComponent={
          <EmptyState
            icon="people-circle-outline"
            title={t('sharedAccount.emptyTitle')}
            body={t('sharedAccount.emptyBody')}
            actionLabel={t('sharedAccount.depositButton')}
            onAction={() => setDepositOpen(true)}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card backgroundColor={colors.coralSoft} style={styles.balanceCard}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('sharedAccount.balance')}</Text>
            <Text style={[typography.display, { color: colors.textPrimary }]}>
              {formatCurrency(balance.balance, 'JPY', locale)}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {t('sharedAccount.totalDeposits')}: {formatCurrency(balance.totalDeposits, 'JPY', locale)}
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {t('sharedAccount.totalSpent')}: {formatCurrency(balance.totalSpent, 'JPY', locale)}
              </Text>
            </View>
          </Card>

          <Button
            title={t('sharedAccount.depositButton')}
            left={<Ionicons name="add" size={18} color={colors.primaryText} />}
            onPress={() => setDepositOpen(true)}
          />

          <Text style={[typography.footnote, { color: colors.textPlaceholder }]}>{t('sharedAccount.note')}</Text>

          <Text style={[typography.title3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {t('sharedAccount.transactions')}
          </Text>
          <Card style={styles.listCard}>
            {entries.map((entry) => (
              <View key={entry.id} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Ionicons
                  name={entry.type === 'deposit' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={24}
                  color={entry.type === 'deposit' ? colors.success : colors.textSecondary}
                />
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                  {entry.type === 'deposit' ? t('sharedAccount.deposit') : t('sharedAccount.totalSpent')}
                </Text>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {formatCurrency(entry.amount, entry.currency, locale)}
                </Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      </StateView>

      <Modal visible={depositOpen} transparent animationType="fade" onRequestClose={() => setDepositOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDepositOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {t('sharedAccount.depositButton')}
            </Text>
            <TextField
              label={t('sharedAccount.amount')}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="numeric"
              prefix="￥"
              autoFocus
            />
            <Button title={t('common.save')} onPress={handleDeposit} loading={addEntry.isPending} />
            <Button title={t('common.cancel')} variant="text" onPress={() => setDepositOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  balanceCard: { alignItems: 'flex-start' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.xs },
  listCard: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
});
