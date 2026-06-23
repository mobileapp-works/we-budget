/**
 * 支出リストの1行。FlatList の renderItem 用に React.memo で最適化。
 * カテゴリ・支払い者ラベルは親から渡す（このコンポーネントは純粋表示）。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography } from '@/constants';
import { CategoryIcon } from './CategoryBadge';
import type { Category, Expense } from '@/types/models';

interface ExpenseRowProps {
  expense: Expense;
  category: Pick<Category, 'icon' | 'color'> | undefined;
  categoryName: string;
  payerLabel: string;
  amountText: string;
  onPress: (id: string) => void;
}

function ExpenseRowComponent({ expense, category, categoryName, payerLabel, amountText, onPress }: ExpenseRowProps) {
  const { colors } = useTheme();
  const title = expense.storeName || categoryName;

  return (
    <Pressable
      onPress={() => onPress(expense.id)}
      accessibilityRole="button"
      accessibilityLabel={`${title} ${amountText} ${payerLabel}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <CategoryIcon icon={category?.icon ?? 'pricetag'} color={category?.color ?? colors.textPlaceholder} size={40} />
      <View style={styles.center}>
        <Text style={[typography.body, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[typography.footnote, { color: colors.textSecondary }]} numberOfLines={1}>
          {categoryName} ・ {payerLabel}
        </Text>
      </View>
      <Text style={[typography.body, styles.amount, { color: colors.textPrimary }]}>{amountText}</Text>
    </Pressable>
  );
}

export const ExpenseRow = React.memo(ExpenseRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, marginHorizontal: spacing.sm },
  amount: { fontWeight: '600' },
});
