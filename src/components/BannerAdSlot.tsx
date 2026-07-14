/**
 * バナー広告の表示枠。
 * 出典: GLOBAL_STANDARDS §10 / docs/ui。全画面の下部に常時表示する。
 *
 * - 広告対応環境（development / production ビルド）では実 AdMob バナーを表示。
 * - Expo Go 等の非対応環境ではプレースホルダー（高さ確保のみ）を表示し、
 *   ネイティブ未リンクによるクラッシュを避ける（AdBanner は動的 require）。
 * - 下端の安全域: タブ画面はタブバーが bottom inset を吸収するので余白不要。
 *   スタック画面（精算・共同口座等）ではホームインジケータに重ならないよう
 *   inset ぶんの余白を足す。タブ内かどうかは BottomTabBarHeightContext で判別する
 *   （タブ外では undefined になる）。
 *
 * 課金ユーザーには非表示にする（将来 v1.1）。
 */
import React, { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/hooks/useTheme';
import { layout, typography } from '@/constants';
import { adsSupported } from '@/lib/ads';

export function BannerAdSlot() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // タブナビゲーター内ではタブバーが下端の安全域を確保するため 0。
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const bottomPad = tabBarHeight !== undefined ? 0 : insets.bottom;

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: bottomPad },
  ];

  // Expo Go / 非対応環境: 高さだけ確保したプレースホルダー。
  if (!adsSupported) {
    return (
      <View
        style={[containerStyle, { height: layout.bannerHeight + bottomPad }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[typography.caption, { color: colors.textPlaceholder }]}>Advertisement</Text>
      </View>
    );
  }

  // 対応環境でのみネイティブ実装を読み込む（Expo Go では到達しない）。
  const { AdBanner } = require('./AdBanner') as typeof import('./AdBanner');
  return (
    <View style={[containerStyle, { minHeight: layout.bannerHeight + bottomPad }]}>
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
