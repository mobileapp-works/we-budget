/** カテゴリ管理。一覧 + 追加/編集（アイコン・写真・色） + 表示/非表示切替。デフォルトは削除不可。 */
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader, Card, Button, TextField, StateView, CategoryIcon, isCategoryImage, useCategoryName } from '@/components';
import { useCategories, useCategoryActions } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/providers/ToastProvider';
import { spacing, typography, radius, layout, CATEGORY_ICON_CHOICES } from '@/constants';
import type { ImageUpload } from '@/data';
import type { Category } from '@/types/models';

// カスタムカテゴリの色候補
const COLOR_CHOICES = ['#FF7A66', '#0EA5E9', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1', '#EF4444'];

type EditTarget = { mode: 'add' } | { mode: 'edit'; category: Category };

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toast = useToast();
  const resolveName = useCategoryName();

  // 非表示も含めて取得し、再表示（復活）できるようにする。
  const categoriesQuery = useCategories(true);
  const { addCategory, updateCategory, uploadIcon } = useCategoryActions();

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_CHOICES[0]!);
  const [color, setColor] = useState(COLOR_CHOICES[0]!);
  // 選択したカスタム写真（保存時にアップロード。キャンセル時は破棄して孤児ファイルを作らない）。
  const [pendingPhoto, setPendingPhoto] = useState<ImageUpload | null>(null);
  const [saving, setSaving] = useState(false);

  const all = categoriesQuery.data ?? [];
  const visible = all.filter((c) => !c.isHidden);
  const hidden = all.filter((c) => c.isHidden);

  // 名前を編集できるのは追加時とカスタムカテゴリ（デフォルトは name_key を翻訳表示するため不可）。
  const nameEditable = editing?.mode === 'add' || (editing?.mode === 'edit' && !editing.category.isDefault);

  const openAdd = () => {
    setName('');
    setIcon(CATEGORY_ICON_CHOICES[0]!);
    setColor(COLOR_CHOICES[0]!);
    setPendingPhoto(null);
    setEditing({ mode: 'add' });
  };

  const openEdit = (c: Category) => {
    setName(c.name ?? '');
    setIcon(c.icon);
    setColor(c.color);
    setPendingPhoto(null);
    setEditing({ mode: 'edit', category: c });
  };

  const close = () => {
    setEditing(null);
    setPendingPhoto(null);
  };

  const selectIcon = (iconName: string) => {
    setIcon(iconName);
    setPendingPhoto(null);
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show(t('error.photoPermission'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    // プレビューはローカルURIで即表示。実アップロードは保存時にまとめて行う。
    setIcon(asset.uri);
    setPendingPhoto({ uri: asset.uri, base64: asset.base64!, contentType: asset.mimeType ?? 'image/jpeg' });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (nameEditable && !name.trim()) {
      toast.show(t('error.required'), 'error');
      return;
    }
    setSaving(true);
    try {
      // カスタム写真が選ばれていれば Storage にアップロードし、公開URLを icon に使う。
      const finalIcon = pendingPhoto ? await uploadIcon.mutateAsync(pendingPhoto) : icon;
      if (editing.mode === 'add') {
        await addCategory.mutateAsync({ name: name.trim(), icon: finalIcon, color });
      } else {
        const c = editing.category;
        const patch: { name?: string; icon: string; color: string } = { icon: finalIcon, color };
        if (!c.isDefault) patch.name = name.trim();
        await updateCategory.mutateAsync({ id: c.id, patch });
      }
      toast.show(t('expense.saved'), 'success');
      close();
    } catch {
      toast.show(t('error.generic'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmHide = (c: Category) => {
    Alert.alert(t('categories.hideConfirmTitle'), t('categories.hideConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('categories.hide'),
        onPress: () =>
          updateCategory.mutate(
            { id: c.id, patch: { isHidden: true } },
            { onError: () => toast.show(t('error.generic'), 'error') }
          ),
      },
    ]);
  };

  const restore = (c: Category) => {
    updateCategory.mutate(
      { id: c.id, patch: { isHidden: false } },
      {
        onSuccess: () => toast.show(t('categories.shown'), 'success'),
        onError: () => toast.show(t('error.generic'), 'error'),
      }
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('categories.title')} />
      <StateView isLoading={categoriesQuery.isLoading} isError={categoriesQuery.isError} onRetry={() => categoriesQuery.refetch()}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Button
            title={t('categories.add')}
            left={<Ionicons name="add" size={18} color={colors.primaryText} />}
            onPress={openAdd}
          />

          <Card style={styles.listCard}>
            {visible.map((c, idx) => (
              <View
                key={c.id}
                style={[styles.row, idx < visible.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <Pressable
                  onPress={() => openEdit(c)}
                  accessibilityRole="button"
                  accessibilityLabel={t('categories.edit')}
                  style={styles.rowMain}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size={36} />
                  <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                    {resolveName(c)}
                  </Text>
                  <Ionicons name="pencil-outline" size={16} color={colors.textPlaceholder} />
                </Pressable>
                <Pressable
                  onPress={() => confirmHide(c)}
                  accessibilityRole="button"
                  accessibilityLabel={t('categories.hide')}
                  hitSlop={8}
                  style={styles.rowAction}
                >
                  <Ionicons name="eye-off-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </Card>
          <Text style={[typography.caption, { color: colors.textPlaceholder }]}>{t('categories.cannotDeleteDefault')}</Text>

          {hidden.length > 0 && (
            <>
              <Text style={[typography.footnote, styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('categories.hiddenSection').toUpperCase()}
              </Text>
              <Card style={styles.listCard}>
                {hidden.map((c, idx) => (
                  <View
                    key={c.id}
                    style={[styles.row, idx < hidden.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  >
                    <View style={[styles.rowMain, { opacity: 0.5 }]}>
                      <CategoryIcon icon={c.icon} color={c.color} size={36} />
                      <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                        {resolveName(c)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => restore(c)}
                      accessibilityRole="button"
                      accessibilityLabel={t('categories.show')}
                      hitSlop={8}
                      style={styles.rowAction}
                    >
                      <Ionicons name="eye-outline" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      </StateView>

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[typography.title3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {editing?.mode === 'edit' ? t('categories.edit') : t('categories.add')}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* プレビュー */}
              <View style={styles.previewWrap}>
                <CategoryIcon icon={icon} color={color} size={64} />
              </View>

              {nameEditable ? (
                <TextField label={t('categories.name')} value={name} onChangeText={setName} />
              ) : editing?.mode === 'edit' ? (
                <Text style={[typography.title3, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md }]}>
                  {resolveName(editing.category)}
                </Text>
              ) : null}

              {/* アイコン選択 */}
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{t('categories.icon')}</Text>
              <View style={styles.iconGrid}>
                {CATEGORY_ICON_CHOICES.map((iconName) => {
                  const selected = icon === iconName;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => selectIcon(iconName)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.iconTile,
                        { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
                      ]}
                    >
                      <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={22} color={selected ? colors.primary : colors.textSecondary} />
                    </Pressable>
                  );
                })}
                {/* カスタム写真 */}
                <Pressable
                  onPress={handlePickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t('categories.choosePhoto')}
                  accessibilityState={{ selected: isCategoryImage(icon) }}
                  style={[
                    styles.iconTile,
                    { backgroundColor: colors.surface, borderColor: isCategoryImage(icon) ? colors.primary : colors.border },
                  ]}
                >
                  <Ionicons name="image-outline" size={22} color={isCategoryImage(icon) ? colors.primary : colors.textSecondary} />
                </Pressable>
              </View>
              <Button title={t('categories.choosePhoto')} variant="text" fullWidth={false} onPress={handlePickPhoto} />

              {/* 色選択 */}
              <Text style={[typography.subhead, { color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm }]}>{t('categories.color')}</Text>
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
            </ScrollView>

            <Button title={t('common.save')} onPress={handleSave} loading={saving} />
            <Button title={t('common.cancel')} variant="text" onPress={close} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  listCard: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.md },
  rowMain: { flexDirection: 'row', alignItems: 'center', flex: 1, padding: spacing.md },
  rowAction: { minWidth: layout.minTapSize, minHeight: layout.minTapSize, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { marginLeft: spacing.xs, letterSpacing: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.lg, padding: spacing.lg, maxHeight: '85%' },
  previewWrap: { alignItems: 'center', marginBottom: spacing.md },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  iconTile: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  colorDot: { width: 36, height: 36, borderRadius: radius.full, borderWidth: 2 },
});
