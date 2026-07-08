/**
 * 日にち（毎月1〜31日）選択フィールド。タップでリストを開くプルダウン型。
 * 固定費の計上日・リマインド日など「月の何日か」の入力に使う。
 */
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { spacing, radius, typography } from '@/constants';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const ITEM_HEIGHT = 48;

interface DayPickerFieldProps {
  label: string;
  /** 選択中の日（1〜31） */
  value: number;
  onChange: (day: number) => void;
  /** フィールド下に出す補足説明 */
  helperText?: string;
}

export function DayPickerField({ label, value, onChange, helperText }: DayPickerFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[typography.subhead, styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${t('common.dayOfMonth', { day: value })}`}
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
      >
        <Text style={[typography.body, styles.value, { color: colors.textPrimary }]}>
          {t('common.dayOfMonth', { day: value })}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      {helperText ? (
        <Text style={[typography.footnote, styles.helper, { color: colors.textSecondary }]}>{helperText}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.subhead, styles.sheetTitle, { color: colors.textSecondary }]}>{label}</Text>
            <FlatList
              data={DAYS}
              keyExtractor={(day) => String(day)}
              getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
              initialScrollIndex={value - 1}
              renderItem={({ item: day }) => {
                const selected = day === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('common.dayOfMonth', { day })}
                    style={styles.item}
                  >
                    <Text
                      style={[
                        typography.body,
                        { color: selected ? colors.primary : colors.textPrimary },
                        selected && styles.itemSelected,
                      ]}
                    >
                      {t('common.dayOfMonth', { day })}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  value: { flex: 1, paddingVertical: spacing.xs },
  helper: { marginTop: spacing.xxs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, paddingVertical: spacing.sm, maxHeight: '60%' },
  sheetTitle: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: ITEM_HEIGHT,
    paddingHorizontal: spacing.md,
  },
  itemSelected: { fontWeight: '600' },
});
