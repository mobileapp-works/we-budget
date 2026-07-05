/**
 * 環境変数（EXPO_PUBLIC_*）の型宣言。
 * Expo はビルド時に process.env.EXPO_PUBLIC_* をインライン化する。
 */
declare global {
  // eslint-disable-next-line no-var
  var process: {
    env: {
      EXPO_PUBLIC_SUPABASE_URL?: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
      EXPO_PUBLIC_USE_MOCK?: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
      EXPO_PUBLIC_ADMOB_BANNER_IOS?: string;
      EXPO_PUBLIC_ADMOB_BANNER_ANDROID?: string;
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
      [key: string]: string | undefined;
    };
  };
}

export {};
