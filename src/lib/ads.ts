/**
 * AdMob（広告）の環境判定と広告ユニットIDの解決。
 *
 * ⚠️ このファイルは常にロードされる（アプリ起動時）ため、
 *    ネイティブモジュール（react-native-google-mobile-ads）を **import しない**。
 *    ライブラリは TurboModuleRegistry.getEnforcing を使うため、
 *    ネイティブが無い Expo Go で import すると即クラッシュする。
 *    実際の広告 API は adsSupported が true のときだけ動的 require する。
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ENV, IS_MOCK } from './env';

/**
 * 広告（ネイティブSDK）が使える実行環境か。
 * Expo Go（storeClient）ではネイティブモジュールが未リンクのため false。
 * development / production ビルドでは true。
 */
export const adsSupported =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/**
 * Google 公式のテスト用バナー広告ユニットID。
 * 開発中・本番IDが未設定のときに使う（本番IDでの自己表示/自己クリックはBANリスク）。
 * https://developers.google.com/admob/ios/test-ads
 */
const TEST_BANNER_UNIT_ID =
  Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/2934735716'
    : 'ca-app-pub-3940256099942544/6300978111';

const TEST_INTERSTITIAL_UNIT_ID =
  Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/4411468910'
    : 'ca-app-pub-3940256099942544/1033173712';

/**
 * 表示するバナー広告ユニットIDを返す。
 * - 開発ビルド（__DEV__）またはモック時は常にテストID
 * - 本番ビルドでは env の本番ID。未設定ならテストIDにフォールバック（誤課金・クラッシュ回避）
 */
export function getBannerAdUnitId(): string {
  if (__DEV__ || IS_MOCK) return TEST_BANNER_UNIT_ID;
  const prodUnitId = Platform.OS === 'ios' ? ENV.admobBannerIos : ENV.admobBannerAndroid;
  return prodUnitId || TEST_BANNER_UNIT_ID;
}

/**
 * インタースティシャル（全画面）広告ユニットIDを返す。方針はバナーと同じ。
 */
export function getInterstitialAdUnitId(): string {
  if (__DEV__ || IS_MOCK) return TEST_INTERSTITIAL_UNIT_ID;
  const prodUnitId = Platform.OS === 'ios' ? ENV.admobInterstitialIos : ENV.admobInterstitialAndroid;
  return prodUnitId || TEST_INTERSTITIAL_UNIT_ID;
}

/**
 * インタースティシャル（全画面）広告を「出さない」ユーザーのメールアドレス除外リスト。
 * ここにメールアドレスを追加すると、そのユーザーには全画面広告を表示しない。
 * ※バナー広告には影響しない（バナーは全ユーザーに表示）。
 * 用途例: 自分/家族のアカウント、ベータ協力者など。
 * 比較は大文字小文字を無視（小文字で保持）。
 */
export const INTERSTITIAL_AD_EXCLUDED_EMAILS: readonly string[] = [
  'taishirou16@gmail.com',
  'kanaho-s.twins_213@docomo.ne.jp',
];

/** 指定メールアドレスのユーザーがインタースティシャル除外対象かを返す。 */
export function isInterstitialSuppressedFor(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERSTITIAL_AD_EXCLUDED_EMAILS.includes(email.trim().toLowerCase());
}
