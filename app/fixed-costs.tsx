/** 固定費・変動固定費の一覧と追加。変動で当月未入力ならバッジ表示。 */
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, DayPickerField, EmptyState, StateView, SegmentedControl, useCategoryName } from '@/components';
import { useFixedCosts, useFixedCostActions, useExpenses, useCategories, useRequireSession, useLocale } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';
import { formatCurrency, getMonthKey, parseAmount } from '@/utils';
import type { FixedCostType } from '@/types/models';
import type { FixedCostInput } from '@/data';

export default function FixedCostsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = useLocale();
  const toast = useToast();
  const session = useRequireSession();
  const resolveName = useCategoryName();

  const fixedCostsQuery = useFixedCosts();
  const { addFixedCost, deleteFixedCost } = useFixedCostActions();
  const { data: categories } = useCategories();
  const { data: expenses } = useExpenses(getMonthKey());

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<FixedCostType>('fixed');
  const [amount, setAmount] = useState('');
  const [billingDay, setBillingDay] = useState(1);

  // 当月に計上済みの固定費ID集合（変動の未入力判定に使う）
  const enteredThisMonth = useMemo(() => {
    const set = new Set<string>();
    (expenses ?? []).forEach((e) => {
      if (e.fixedCostId) set.add(e.fixedCostId);
    });
    return set;
  }, [expenses]);

  const handleAdd = () => {
    if (!name.trim()) {
      toast.show(t('error.required'), 'error');
      return;
    }
    if (type === 'fixed' && parseAmount(amount) === null) {
      toast.show(t('error.amountPositive'), 'error');
      return;
    }
    const input: FixedCostInput = {
      categoryId: categories?.[0]?.id ?? '',
      name: name.trim(),
      type,
      amount: type === 'fixed' ? parseAmount(amount) : null,
      currency: 'JPY',
      payerUserId: session.userId,
      isSharedPayment: false,
      billingDay,
      reminderDay: type === 'variable' ? billingDay : null,
      isActive: true,
    };
    addFixedCost.mutate(input, {
      onSuccess: () => {
        toast.show(t('expense.saved'), 'success');
        setOpen(false);
        setName('');
        setAmount('');
        setBillingDay(1);
        setType('fixed');
      },
      onError: () => toast.show(t('error.generic'), 'error'),
    });
  };

  const confirmDelete = (id: string, label: string) => {
    Alert.alert(label, t('fixedCosts.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteFixedCost.mutate(id, { onError: () => toast.show(t('error.generic'), 'error') }),
      },
    ]);
  };

  const items = fixedCostsQuery.data ?? [];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('fixedCosts.title')} />
      <StateView
        isLoading={fixedCostsQuery.isLoading}
        isError={fixedCostsQuery.isError}
        isEmpty={items.length === 0}
        onRetry={() => fixedCostsQuery.refetch()}
        emptyComponent={
          <EmptyState
            icon="repeat-outline"
            title={t('fixedCosts.emptyTitle')}
            body={t('fixedCosts.emptyBody')}
            actionLabel={t('fixedCosts.add')}
            onAction={() => setOpen(true)}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Button
            title={t('fixedCosts.add')}
            left={<Ionicons name="add" size={18} color={colors.primaryText} />}
            onPress={() => setOpen(true)}
          />
          <Card style={styles.listCard}>
            {items.map((fc, idx) => {
              const needsInput = fc.type === 'variable' && !enteredThisMonth.has(fc.id);
              const category = categories?.find((c) => c.id === fc.categoryId);
              const dayLabel = fc.type === 'fixed' ? t('fixedCosts.billingDay') : t('fixedCosts.reminderDay');
              const day = fc.type === 'fixed' ? fc.billingDay : fc.reminderDay ?? fc.billingDay;
              return (
                <Pressable
                  key={fc.id}
                  onLongPress={() => confirmDelete(fc.id, fc.name)}
                  accessibilityRole="button"
                  accessibilityLabel={fc.name}
                  style={[styles.row, idx < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  <View style={styles.rowMain}>
                    <Text style={[typography.body, { color: colors.textPrimary }]}>{fc.name}</Text>
                    <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                      {category ? resolveName(category) : ''} ・ {dayLabel} {t('common.dayOfMonth', { day })}
                      {fc.type === 'fixed' && fc.amount ? ` ・ ${formatCurrency(fc.amount, fc.currency, locale)}` : ''}
                    </Text>
                  </View>
                  {needsInput ? (
                    <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                      <Text style={[typography.caption, { color: '#FFF' }]}>{t('fixedCosts.needsInput')}</Text>
                    </View>
                  ) : (
                    <View style={[styles.typeTag, { backgroundColor: colors.coralSoft }]}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {fc.type === 'fixed' ? t('fixedCosts.shortFixed') : t('fixedCosts.shortVariable')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Card>
        </ScrollView>
      </StateView>

      {/* 追加モーダル */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
                {t('fixedCosts.add')}
              </Text>
              <TextField label={t('fixedCosts.name')} value={name} onChangeText={setName} />
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                {t('fixedCosts.type')}
              </Text>
              <View style={{ marginBottom: spacing.md }}>
                <SegmentedControl<FixedCostType>
                  options={[
                    { value: 'fixed', label: t('fixedCosts.shortFixed') },
                    { value: 'variable', label: t('fixedCosts.shortVariable') },
                  ]}
                  value={type}
                  onChange={setType}
                />
                <Text style={[typography.footnote, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  {type === 'fixed' ? t('fixedCosts.typeFixedDesc') : t('fixedCosts.typeVariableDesc')}
                </Text>
              </View>
              {type === 'fixed' ? (
                <TextField label={t('fixedCosts.amount')} value={amount} onChangeText={setAmount} keyboardType="numeric" prefix="￥" />
              ) : null}
              <DayPickerField
                label={type === 'fixed' ? t('fixedCosts.billingDay') : t('fixedCosts.reminderDay')}
                value={billingDay}
                onChange={setBillingDay}
                helperText={type === 'fixed' ? t('fixedCosts.monthEndNote') : t('fixedCosts.reminderDayNote')}
              />
              <Button title={t('common.save')} onPress={handleAdd} loading={addFixedCost.isPending} />
              <Button title={t('common.cancel')} variant="text" onPress={() => setOpen(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  listCard: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  rowMain: { flex: 1 },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.full },
  typeTag: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.full },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg, maxHeight: '80%' },
});
