/**
 * カテゴリのアイコン円 + 名前表示。
 * デフォルトカテゴリは name_key を翻訳、カスタムは name をそのまま表示する。
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, radius } from '@/constants';
import type { Category } from '@/types/models';

/** カテゴリの表示名を解決する（name_key 優先で翻訳、なければ name）。 */
export function useCategoryName(): (category: Pick<Category, 'name' | 'nameKey'>) => string {
  const { t } = useTranslation();
  return (category) => {
    if (category.nameKey) return t(category.nameKey);
    return category.name ?? '';
  };
}

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: number;
}

/** icon がIonicons名ではなく画像URI（カスタム写真）かどうか。 */
export function isCategoryImage(icon: string): boolean {
  return /^(file|https?|content|data|ph|assets-library):/i.test(icon);
}

/** カテゴリの丸アイコン。カスタム写真（URI）なら画像、それ以外は Ionicons を表示。 */
export function CategoryIcon({ icon, color, size = 40 }: CategoryIconProps) {
  const isImage = isCategoryImage(icon);
  return (
    <View
      style={[
        styles.iconCircle,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: isImage ? undefined : color,
          overflow: 'hidden',
        },
      ]}
    >
      {isImage ? (
        <Image source={{ uri: icon }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Ionicons name={(icon as keyof typeof Ionicons.glyphMap) ?? 'pricetag'} size={size * 0.5} color="#FFFFFF" />
      )}
    </View>
  );
}

interface CategoryChipProps {
  category: Pick<Category, 'name' | 'nameKey' | 'icon' | 'color'>;
  selected?: boolean;
  onPress?: () => void;
}

/** カテゴリ名つきの横並び表示（フィルタ等で使用）。 */
export function CategoryLabel({ category }: { category: Pick<Category, 'name' | 'nameKey' | 'icon' | 'color'> }) {
  const { colors } = useTheme();
  const resolveName = useCategoryName();
  return (
    <View style={styles.labelRow}>
      <CategoryIcon icon={category.icon} color={category.color} size={32} />
      <Text style={[typography.body, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
        {resolveName(category)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
});
