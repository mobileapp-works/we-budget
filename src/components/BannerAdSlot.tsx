/**
 * バナー広告の表示枠。
 * 出典: GLOBAL_STANDARDS §10 / docs/ui。現状はプレースホルダー（高さ確保）。
 * Phase(収益化)で react-native-google-mobile-ads の BannerAd に差し替える。
 * 課金ユーザーには非表示にする（将来）。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { layout, typography } from '@/constants';

export function BannerAdSlot() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { height: layout.bannerHeight, backgroundColor: colors.surface, borderTopColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* TODO(収益化): AdMob BannerAd に差し替え */}
      <Text style={[typography.caption, { color: colors.textPlaceholder }]}>Advertisement</Text>
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
