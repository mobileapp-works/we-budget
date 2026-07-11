/** 共同口座画面。残高サマリー・個人別入金・入金/出金/調整の記録・明細（共同口座払いの支出も表示）。 */
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, EmptyState, StateView, CategoryIcon } from '@/components';
import {
  useSharedEntries,
  useSharedAccountActions,
  useSharedExpenses,
  useLocale,
  useRequireSession,
  useExpenseHelpers,
} from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { calculateSharedBalance, SHARED_NO_USER, formatCurrency, parseAmount } from '@/utils';
import type { UUID } from '@/types/models';

type RecordType = 'deposit' | 'withdrawal';
type PayerChoice = 'self' | 'partner';

/** 明細の1行（入金/出金 or 共同口座払いの支出）を統一表現にしたもの。 */
type LedgerRow =
  | { key: string; date: string; kind: 'deposit'; amount: number; currency: string; userId: UUID | null; memo: string | null }
  | { key: string; date: string; kind: 'withdrawal'; amount: number; currency: string; memo: string | null }
  | { key: string; date: string; kind: 'expense'; amount: number; currency: string; categoryId: UUID; store: string | null; memo: string | null };

export default function SharedAccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();
  const session = useRequireSession();
  const baseCurrency = session.pair.baseCurrency;
  const { getCategory, getCategoryName } = useExpenseHelpers();

  const entriesQuery = useSharedEntries();
  const { addEntry } = useSharedAccountActions();
  // 残高は全期間のΣで計算する（当月分だけだと月替わりで過去の共同支出が消えて残高が狂う）。
  const { data: sharedExpenses } = useSharedExpenses();

  const isPaired = session.pair.user2Id !== null;

  const [modalOpen, setModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<RecordType>('deposit');
  const [payer, setPayer] = useState<PayerChoice>('self');
  const [amountInput, setAmountInput] = useState('');
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const entries = entriesQuery.data ?? [];
  const expenses = sharedExpenses ?? [];

  const balance = useMemo(
    () => calculateSharedBalance(entries, expenses, baseCurrency),
    [entries, expenses, baseCurrency]
  );

  const myDeposits = balance.depositsByUser[session.userId] ?? 0;
  const partnerDeposits = session.partner ? balance.depositsByUser[session.partner.id] ?? 0 : 0;
  const adjustDeposits = balance.depositsByUser[SHARED_NO_USER] ?? 0;

  /** 入金者の表示名（自分 / パートナー名 / 退会済み）。 */
  const personName = (userId: UUID | null): string => {
    if (userId === null) return t('sharedAccount.adjustment');
    if (userId === session.userId) return t('expense.payerSelf');
    if (session.partner && userId === session.partner.id) return session.partner.displayName;
    return t('expense.payerPartner');
  };

  /** 入金/出金 と 共同口座払い支出 を1本の明細に統合し、日付降順で並べる。 */
  const ledger = useMemo<LedgerRow[]>(() => {
    const rows: LedgerRow[] = [];
    for (const e of entries) {
      if (e.type === 'deposit') {
        rows.push({ key: e.id, date: e.transactionDate, kind: 'deposit', amount: e.amount, currency: e.currency, userId: e.userId, memo: e.description });
      } else {
        rows.push({ key: e.id, date: e.transactionDate, kind: 'withdrawal', amount: e.amount, currency: e.currency, memo: e.description });
      }
    }
    for (const x of expenses) {
      if (!x.isSharedPayment) continue;
      rows.push({ key: x.id, date: x.expenseDate, kind: 'expense', amount: x.amount, currency: x.currency, categoryId: x.categoryId, store: x.storeName, memo: x.description });
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [entries, expenses]);

  const openModal = (type: RecordType) => {
    setRecordType(type);
    setPayer('self');
    setAmountInput('');
    setMemo('');
    setDate(new Date());
    setModalOpen(true);
  };

  const handleSave = () => {
    const parsed = parseAmount(amountInput);
    if (parsed === null) {
      toast.show(t('error.amountPositive'), 'error');
      return;
    }
    // 入金は当事者を紐づける。出金/調整は特定の個人に紐づけない（共同）。
    const userId: UUID | null =
      recordType === 'deposit'
        ? payer === 'self'
          ? session.userId
          : session.partner?.id ?? null
        : null;
    addEntry.mutate(
      {
        type: recordType,
        amount: parsed,
        currency: baseCurrency,
        description: memo.trim() || null,
        transactionDate: dayjs(date).format('YYYY-MM-DD'),
        userId,
      },
      {
        onSuccess: () => {
          toast.show(t('sharedAccount.saved'), 'success');
          setModalOpen(false);
        },
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('sharedAccount.title')} />
      <StateView
        isLoading={entriesQuery.isLoading}
        isError={entriesQuery.isError}
        isEmpty={entries.length === 0 && ledger.length === 0}
        onRetry={() => entriesQuery.refetch()}
        emptyComponent={
          <EmptyState
            icon="people-circle-outline"
            title={t('sharedAccount.emptyTitle')}
            body={t('sharedAccount.emptyBody')}
            actionLabel={t('sharedAccount.depositButton')}
            onAction={() => openModal('deposit')}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 残高サマリー */}
          <Card backgroundColor={colors.coralSoft} style={styles.balanceCard}>
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{t('sharedAccount.balance')}</Text>
            <Text style={[typography.display, { color: colors.textPrimary }]}>
              {formatCurrency(balance.balance, baseCurrency, locale)}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {t('sharedAccount.totalDeposits')}: {formatCurrency(balance.totalDeposits, baseCurrency, locale)}
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {t('sharedAccount.totalSpent')}: {formatCurrency(balance.totalSpent, baseCurrency, locale)}
              </Text>
            </View>
          </Card>

          {/* 個人別の入金内訳 */}
          <Card style={styles.breakdownCard}>
            <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              {t('sharedAccount.depositBreakdown')}
            </Text>
            <BreakdownRow label={t('expense.payerSelf')} value={formatCurrency(myDeposits, baseCurrency, locale)} colors={colors} />
            {isPaired ? (
              <BreakdownRow
                label={session.partner?.displayName ?? t('expense.payerPartner')}
                value={formatCurrency(partnerDeposits, baseCurrency, locale)}
                colors={colors}
              />
            ) : null}
            {adjustDeposits !== 0 ? (
              <BreakdownRow label={t('sharedAccount.adjustment')} value={formatCurrency(adjustDeposits, baseCurrency, locale)} colors={colors} />
            ) : null}
          </Card>

          {/* 記録ボタン（入金 / 出金・調整） */}
          <View style={styles.actionRow}>
            <View style={styles.actionItem}>
              <Button
                title={t('sharedAccount.depositButton')}
                left={<Ionicons name="arrow-down" size={18} color={colors.primaryText} />}
                onPress={() => openModal('deposit')}
              />
            </View>
            <View style={styles.actionItem}>
              <Button
                title={t('sharedAccount.withdrawButton')}
                variant="secondary"
                left={<Ionicons name="arrow-up" size={18} color={colors.textPrimary} />}
                onPress={() => openModal('withdrawal')}
              />
            </View>
          </View>

          <Text style={[typography.footnote, { color: colors.textPlaceholder }]}>{t('sharedAccount.note')}</Text>

          {/* 明細（入金/出金/共同口座払いの支出） */}
          <Text style={[typography.title3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {t('sharedAccount.transactions')}
          </Text>
          <Card style={styles.listCard}>
            {ledger.map((row) => (
              <LedgerItem
                key={row.key}
                row={row}
                colors={colors}
                locale={locale}
                personName={personName}
                getCategory={getCategory}
                getCategoryName={getCategoryName}
              />
            ))}
          </Card>
        </ScrollView>
      </StateView>

      {/* 記録モーダル */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {recordType === 'deposit' ? t('sharedAccount.depositButton') : t('sharedAccount.withdrawButton')}
            </Text>

            {/* 種別 */}
            <ChipRow
              items={[
                { key: 'deposit', label: t('sharedAccount.deposit') },
                { key: 'withdrawal', label: t('sharedAccount.withdraw') },
              ]}
              selectedKey={recordType}
              onSelect={(k) => setRecordType(k as RecordType)}
              colors={colors}
            />

            {/* 入金者（入金かつペア時のみ） */}
            {recordType === 'deposit' && isPaired ? (
              <ChipRow
                items={[
                  { key: 'self', label: t('expense.payerSelf') },
                  { key: 'partner', label: session.partner?.displayName ?? t('expense.payerPartner') },
                ]}
                selectedKey={payer}
                onSelect={(k) => setPayer(k as PayerChoice)}
                colors={colors}
              />
            ) : null}

            <TextField
              label={t('sharedAccount.amount')}
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="numeric"
              prefix={baseCurrency === 'JPY' ? '￥' : baseCurrency}
              autoFocus
            />

            <TextField label={t('sharedAccount.memo')} value={memo} onChangeText={setMemo} placeholder="" />

            {/* 日付 */}
            <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              {t('sharedAccount.date')}
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={t('sharedAccount.date')}
              style={[styles.dateField, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                {dayjs(date).format('YYYY/MM/DD')}
              </Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={date}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setDate(selected);
                }}
              />
            ) : null}

            <Button title={t('common.save')} onPress={handleSave} loading={addEntry.isPending} />
            <Button title={t('common.cancel')} variant="text" onPress={() => setModalOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function BreakdownRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function LedgerItem({
  row,
  colors,
  locale,
  personName,
  getCategory,
  getCategoryName,
}: {
  row: LedgerRow;
  colors: ReturnType<typeof useTheme>['colors'];
  locale: string;
  personName: (userId: UUID | null) => string;
  getCategory: ReturnType<typeof useExpenseHelpers>['getCategory'];
  getCategoryName: ReturnType<typeof useExpenseHelpers>['getCategoryName'];
}) {
  const { t } = useTranslation();
  let icon: React.ReactNode;
  let title: string;
  let subtitle: string | null = row.memo;
  let amountText: string;
  let amountColor: string;

  if (row.kind === 'deposit') {
    icon = <Ionicons name="arrow-down-circle" size={26} color={colors.success} />;
    title = t('sharedAccount.depositBy', { name: personName(row.userId) });
    amountText = `＋${formatCurrency(row.amount, row.currency, locale)}`;
    amountColor = colors.success;
  } else if (row.kind === 'withdrawal') {
    icon = <Ionicons name="arrow-up-circle" size={26} color={colors.textSecondary} />;
    title = t('sharedAccount.withdraw');
    amountText = `−${formatCurrency(row.amount, row.currency, locale)}`;
    amountColor = colors.textPrimary;
  } else {
    const category = getCategory(row.categoryId);
    icon = category ? (
      <CategoryIcon icon={category.icon} color={category.color} size={26} />
    ) : (
      <Ionicons name="cart-outline" size={26} color={colors.textSecondary} />
    );
    title = getCategoryName(row.categoryId) || t('sharedAccount.spent');
    subtitle = row.store ?? row.memo;
    amountText = `−${formatCurrency(row.amount, row.currency, locale)}`;
    amountColor = colors.textPrimary;
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {icon}
      <View style={styles.rowBody}>
        <Text style={[typography.body, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[typography.body, { color: amountColor }]}>{amountText}</Text>
    </View>
  );
}

function ChipRow({
  items,
  selectedKey,
  onSelect,
  colors,
}: {
  items: { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: selected ? colors.primary : colors.surface }]}
          >
            <Text style={[typography.subhead, { color: selected ? colors.primaryText : colors.textSecondary }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  balanceCard: { alignItems: 'flex-start' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: spacing.xs },
  breakdownCard: { gap: spacing.xs },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionItem: { flex: 1 },
  listCard: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
});
