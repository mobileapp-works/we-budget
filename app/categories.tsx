/** カテゴリ管理。一覧 + 表示/非表示切替 + カスタム追加。デフォルトは削除不可。 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, StateView, CategoryIcon, useCategoryName } from '@/components';
import { useCategories, useCategoryActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius } from '@/constants';

// カスタムカテゴリの色候補
const COLOR_CHOICES = ['#FF7A66', '#0EA5E9', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1', '#EF4444'];

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const resolveName = useCategoryName();

  // 非表示も含めて取得したいが、listは非表示除外。MVPでは表示中のみ操作可能とする。
  const categoriesQuery = useCategories();
  const { addCategory, updateCategory } = useCategoryActions();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_CHOICES[0]!);

  const handleAdd = () => {
    if (!name.trim()) {
      toast.show(t('error.required'), 'error');
      return;
    }
    addCategory.mutate(
      { name: name.trim(), icon: 'pricetag', color },
      {
        onSuccess: () => {
          toast.show(t('expense.saved'), 'success');
          setOpen(false);
          setName('');
        },
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  const items = categoriesQuery.data ?? [];

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('categories.title')} />
      <StateView isLoading={categoriesQuery.isLoading} isError={categoriesQuery.isError} onRetry={() => categoriesQuery.refetch()}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Button
            title={t('categories.add')}
            left={<Ionicons name="add" size={18} color={colors.primaryText} />}
            onPress={() => setOpen(true)}
          />
          <Card style={styles.listCard}>
            {items.map((c, idx) => (
              <View
                key={c.id}
                style={[styles.row, idx < items.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <CategoryIcon icon={c.icon} color={c.color} size={36} />
                <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                  {resolveName(c)}
                </Text>
                <Pressable
                  onPress={() => updateCategory.mutate({ id: c.id, patch: { isHidden: true } })}
                  accessibilityRole="button"
                  accessibilityLabel={t('categories.hide')}
                  hitSlop={8}
                >
                  <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </Card>
          <Text style={[typography.caption, { color: colors.textPlaceholder }]}>{t('categories.cannotDeleteDefault')}</Text>
        </ScrollView>
      </StateView>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>{t('categories.add')}</Text>
            <TextField label={t('categories.name')} value={name} onChangeText={setName} autoFocus />
            <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{t('categories.color')}</Text>
            <View style={styles.colorRow}>
              {COLOR_CHOICES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: color === c }}
                  style={[styles.colorDot, { backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' }]}
                />
              ))}
            </View>
            <Button title={t('common.save')} onPress={handleAdd} loading={addCategory.isPending} />
            <Button title={t('common.cancel')} variant="text" onPress={() => setOpen(false)} />
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  colorDot: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 2 },
});
