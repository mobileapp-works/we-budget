/**
 * 環境変数の集約。EXPO_PUBLIC_ 接頭辞の変数はビルド時にインライン化される。
 * 秘密情報（service_role key 等）はここに置かない。anon key のみ。
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const useMockFlag = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

/**
 * モックモード判定。
 * 明示フラグが true、または Supabase 接続情報が無い場合はモックで動かす。
 */
export const IS_MOCK = useMockFlag || !supabaseUrl || !supabaseAnonKey;

export const ENV = {
  supabaseUrl,
  supabaseAnonKey,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  admobBannerIos: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? '',
  admobBannerAndroid: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID ?? '',
  // Google Sign-In（ネイティブ）。GCP の OAuth クライアントID。
  // webClientId は Supabase の Google プロバイダに登録した「承認済みクライアントID」と一致させる。
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
} as const;
