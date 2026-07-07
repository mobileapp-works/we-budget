/**
 * バナー広告の表示枠。
 * 出典: GLOBAL_STANDARDS §10 / docs/ui。全画面の下部に常時表示する。
 *
 * - 広告対応環境（development / production ビルド）では実 AdMob バナーを表示。
 * - Expo Go 等の非対応環境ではプレースホルダー（高さ確保のみ）を表示し、
 *   ネイティブ未リンクによるクラッシュを避ける（AdBanner は動的 require）。
 *
 * 課金ユーザーには非表示にする（将来 v1.1）。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { layout, typography } from '@/constants';
import { adsSupported } from '@/lib/ads';

export function BannerAdSlot() {
  const { colors } = useTheme();
  const containerStyle = [
    styles.container,
    { backgroundColor: colors.surface, borderTopColor: colors.border },
  ];

  // Expo Go / 非対応環境: 高さだけ確保したプレースホルダー。
  if (!adsSupported) {
    return (
      <View
        style={[containerStyle, { height: layout.bannerHeight }]}
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
    <View style={[containerStyle, { minHeight: layout.bannerHeight }]}>
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
