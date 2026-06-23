/**
 * 画面共通レイアウト。
 * SafeArea でノッチ/ホームインジケータを回避し、iPad ではコンテンツを中央寄せ。
 * 下部にバナー広告枠を確保する（コンテンツと重ならない）。
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { spacing } from '@/constants';
import { BannerAdSlot } from './BannerAdSlot';

interface ScreenProps {
  children: React.ReactNode;
  /** 下部にバナー広告枠を表示するか（モーダル等では false） */
  withBanner?: boolean;
  /** コンテンツ左右に標準パディングを付けるか */
  padded?: boolean;
  style?: ViewStyle;
  /** SafeArea の上端を無効化したい場合（独自ヘッダー時など） */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({
  children,
  withBanner = true,
  padded = true,
  style,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const { colors } = useTheme();
  const { isTablet, contentMaxWidth } = useResponsive();

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.fill}>
        <View
          style={[
            styles.content,
            padded && styles.padded,
            isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
            style,
          ]}
        >
          {children}
        </View>
      </View>
      {withBanner ? <BannerAdSlot /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: spacing.md },
});
