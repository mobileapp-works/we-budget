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
