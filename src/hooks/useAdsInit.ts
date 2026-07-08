/**
 * 起動時に広告の同意フロー（UMP）と AdMob SDK 初期化を実行する。
 *
 * 順序（GLOBAL_STANDARDS §5-3）:
 *   1. UMP で同意情報をリクエストし、必要なら同意フォーム（GDPR / ATT）を表示
 *   2. Mobile Ads SDK を初期化
 *
 * ⚠️ Expo Go（adsSupported=false）では何もしない。
 *    ネイティブ未リンク環境で import するとクラッシュするため、動的 require で読み込む。
 *    ATT ダイアログは AdMob 管理画面のプライバシー＆メッセージングで
 *    「ATT メッセージ」を構成しておくと UMP フロー内で表示される。
 */
import { useEffect } from 'react';
import { adsSupported } from '@/lib/ads';
import { preloadInterstitial } from '@/lib/interstitial';

export function useAdsInit(): void {
  useEffect(() => {
    if (!adsSupported) return;

    let cancelled = false;

    (async () => {
      // 動的 require: Expo Go では adsSupported=false で到達しないため安全。
      // 型は付けつつ実体はランタイムでのみロードする。
      const { AdsConsent, default: mobileAds } =
        require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');

      // 1) UMP 同意。EEA 等で必要ならフォームを出す。失敗しても広告初期化は続行する。
      try {
        await AdsConsent.gatherConsent();
      } catch (e) {
        if (__DEV__) console.warn('[ads] gatherConsent failed', e);
      }

      if (cancelled) return;

      // 2) SDK 初期化。これが済むまでバナーは表示されない。
      try {
        await mobileAds().initialize();
      } catch (e) {
        if (__DEV__) console.warn('[ads] initialize failed', e);
      }

      if (cancelled) return;

      // 3) インタースティシャルを先読み（表示は支出保存時に頻度条件を満たしたとき）。
      preloadInterstitial();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
