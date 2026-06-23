/** 画面ヘッダー（タイトル＋任意の戻るボタン＋右アクション）。 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { spacing, typography, layout } from '@/constants';

interface ScreenHeaderProps {
  title: string;
  /** 戻るボタンを表示するか（既定: 表示） */
  showBack?: boolean;
  /** 右側に置く要素 */
  right?: React.ReactNode;
}

export function ScreenHeader({ title, showBack = true, right }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={8}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[typography.title3, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.xs,
  },
  side: { width: 56, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  iconButton: {
    width: layout.minTapSize,
    height: layout.minTapSize,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
