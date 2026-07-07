/**
 * 実 AdMob バナー。
 * ⚠️ このファイルは react-native-google-mobile-ads を静的 import するため、
 *    ネイティブが存在する環境でのみロードすること（BannerAdSlot が adsSupported を見て
 *    動的 require する）。Expo Go で直接 import しないこと。
 */
import React from 'react';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId } from '@/lib/ads';

export function AdBanner() {
  return (
    <BannerAd
      unitId={getBannerAdUnitId()}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
    />
  );
}
