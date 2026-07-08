/**
 * インタースティシャル（全画面）広告の頻度制御つきコントローラ。
 *
 * トリガー: 支出の保存後（`recordSaveAndMaybeShowInterstitial`）。
 * 頻度ルール（控えめ・審査/離脱対策）:
 *   - 保存 5 回ごとに 1 回
 *   - 前回表示から 3 分以上
 *   - 1 セッション最大 2 回
 *
 * ⚠️ ads.ts と同様、native ライブラリを **静的 import しない**（Expo Go クラッシュ回避）。
 *    adsSupported が true のときだけ動的 require する。広告は事前ロードしておき、
 *    条件を満たした瞬間に即表示（読み込み待ちで固まらせない）。
 */
import { adsSupported, getInterstitialAdUnitId, isInterstitialSuppressedFor } from './ads';

const SHOW_EVERY_N_SAVES = 5;
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_PER_SESSION = 2;

let saveCount = 0;
let lastShownAt = 0;
let sessionShownCount = 0;

type Ads = typeof import('react-native-google-mobile-ads');
type InterstitialInstance = ReturnType<Ads['InterstitialAd']['createForAdRequest']>;

let ad: InterstitialInstance | null = null;
let loaded = false;
let loading = false;

/** 広告インスタンスを用意し、次の在庫を先読みする（多重ロードはガード）。 */
function createAndLoad(): void {
  if (!adsSupported || loading || loaded) return;
  try {
    const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads') as Ads;
    if (!ad) {
      ad = InterstitialAd.createForAdRequest(getInterstitialAdUnitId());
      ad.addAdEventListener(AdEventType.LOADED, () => {
        loaded = true;
        loading = false;
      });
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        // 表示が閉じたら在庫が尽きるので次を先読み
        loaded = false;
        createAndLoad();
      });
      ad.addAdEventListener(AdEventType.ERROR, () => {
        loaded = false;
        loading = false;
      });
    }
    loading = true;
    ad.load();
  } catch (e) {
    loading = false;
    if (__DEV__) console.warn('[ads] interstitial load failed', e);
  }
}

/** 起動時に一度呼び、最初の在庫を先読みする。 */
export function preloadInterstitial(): void {
  createAndLoad();
}

/**
 * 支出の保存など「区切り」で呼ぶ。頻度条件を満たし在庫があれば全画面広告を表示する。
 * 条件を満たさない／在庫が無いときは表示せず、次の機会に備えて先読みだけ行う。
 *
 * @param email 現在のユーザーのメールアドレス。除外リスト（ads.ts）に含まれる場合は表示しない。
 */
export function recordSaveAndMaybeShowInterstitial(email?: string | null): void {
  if (!adsSupported) return;
  // 特定ユーザー（メールアドレス）は全画面広告の対象外（カウンタも進めない）。
  if (isInterstitialSuppressedFor(email)) return;
  saveCount += 1;

  const now = Date.now();
  const eligible =
    saveCount % SHOW_EVERY_N_SAVES === 0 &&
    now - lastShownAt >= MIN_INTERVAL_MS &&
    sessionShownCount < MAX_PER_SESSION;

  if (!eligible) {
    createAndLoad();
    return;
  }

  if (loaded && ad) {
    lastShownAt = now;
    sessionShownCount += 1;
    loaded = false;
    try {
      ad.show();
    } catch (e) {
      if (__DEV__) console.warn('[ads] interstitial show failed', e);
    }
    // 表示後は CLOSED リスナーが次を先読みする
  } else {
    createAndLoad();
  }
}
