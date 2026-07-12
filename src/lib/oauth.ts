/**
 * ネイティブ OAuth（Apple / Google）。ID トークンを取得し、呼び出し側で
 * Supabase の signInWithIdToken に渡す。実機の dev/prod build でのみ動作する。
 * - Apple:  expo-apple-authentication（iOS のみ。Expo Go にバンドル済みで import は安全）。
 * - Google: @react-native-google-signin/google-signin（Expo Go 非対応のため呼び出し時に遅延 import）。
 * ユーザーがキャンセルした場合は OAuthCancelledError を投げ、UI 側はトーストを出さない。
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ENV } from './env';

/** ユーザーがネイティブのサインインを途中で閉じた（＝失敗ではない）。 */
export class OAuthCancelledError extends Error {
  constructor() {
    super('oauth cancelled');
    this.name = 'OAuthCancelledError';
  }
}

/** iOS かつ Sign in with Apple が利用可能か。 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Apple でサインインし identityToken を返す。
 * authorizationCode はアカウント削除時のトークン失効（revoke）用に控える（任意・単発）。
 */
export async function signInWithApple(): Promise<{ token: string; authorizationCode: string | null }> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple: identityToken missing');
    return { token: credential.identityToken, authorizationCode: credential.authorizationCode ?? null };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new OAuthCancelledError();
    throw e;
  }
}

/** Google でサインインし idToken を返す。 */
export async function signInWithGoogle(): Promise<{ token: string }> {
  // Expo Go ではネイティブ未リンク。遅延 import で「読み込み時クラッシュ」を避ける。
  let mod: typeof import('@react-native-google-signin/google-signin');
  try {
    mod = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new Error('Google Sign-In is unavailable (dev build required)');
  }
  const { GoogleSignin, statusCodes } = mod;
  GoogleSignin.configure({
    // webClientId は Supabase の Google プロバイダに登録した承認済みクライアントIDと一致させる。
    webClientId: ENV.googleWebClientId || undefined,
    iosClientId: ENV.googleIosClientId || undefined,
  });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    // v13+ は { type, data: { idToken } }、旧版は { idToken } を返す。
    const idToken =
      (response as { data?: { idToken?: string | null } }).data?.idToken ??
      (response as unknown as { idToken?: string | null }).idToken ??
      null;
    if (!idToken) throw new Error('Google: idToken missing');
    return { token: idToken };
  } catch (e) {
    if ((e as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) throw new OAuthCancelledError();
    throw e;
  }
}
