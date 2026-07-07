/**
 * Supabase 認証エラー → i18n キー変換。
 * Supabase の生メッセージ（英語）を直接表示せず、翻訳済みメッセージを出すために使う。
 * 未知のエラーは 'error.auth'（汎用の認証失敗）にフォールバックする。
 * 呼び出し側で t(authErrorKey(e)) として使う。
 */
export function authErrorKey(e: unknown): string {
  const code = typeof (e as { code?: unknown })?.code === 'string' ? (e as { code: string }).code : '';
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();

  // 通信エラー
  if (code === 'network_error' || msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return 'error.network';
  }
  // メール/パスワード不一致
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'error.invalidCredentials';
  }
  // メール未確認
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'error.emailNotConfirmed';
  }
  // 既に登録済み
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already registered')
  ) {
    return 'error.emailTaken';
  }
  // 弱いパスワード（既存キーを流用）
  if (code === 'weak_password' || msg.includes('password should be at least') || msg.includes('weak password')) {
    return 'error.weakPassword';
  }
  // レート制限
  if (code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'error.rateLimit';
  }
  return 'error.auth';
}
