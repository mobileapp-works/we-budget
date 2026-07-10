/**
 * authErrorKey のテスト。
 * Supabase の実際のエラー形状（AuthApiError: code + message）を模して、
 * ユーザーに正しい文言キーが返ることを固定する。
 */
import { authErrorKey } from './authErrors';

/** Supabase AuthApiError 相当のオブジェクトを作る。 */
function authApiError(code: string, message: string): Error {
  const e = new Error(message) as Error & { code: string; status: number };
  e.name = 'AuthApiError';
  e.code = code;
  e.status = 400;
  return e;
}

describe('authErrorKey', () => {
  it('パスワード再設定で現在と同じパスワード → samePassword', () => {
    // supabase-js が updateUser({ password }) で返す実際の形（422 / same_password）
    expect(
      authErrorKey(authApiError('same_password', 'New password should be different from the old password.'))
    ).toBe('error.samePassword');
    // code が無い旧バージョンでもメッセージで判定できる
    expect(authErrorKey(new Error('New password should be different from the old password.'))).toBe(
      'error.samePassword'
    );
  });

  it('セッション欠落（リカバリーセッション期限切れ等） → sessionExpired', () => {
    const e = new Error('Auth session missing!');
    e.name = 'AuthSessionMissingError';
    expect(authErrorKey(e)).toBe('error.sessionExpired');
    expect(authErrorKey(authApiError('session_missing', 'Session missing'))).toBe('error.sessionExpired');
  });

  it('弱いパスワードは samePassword と混同しない', () => {
    expect(authErrorKey(authApiError('weak_password', 'Password should be at least 6 characters.'))).toBe(
      'error.weakPassword'
    );
  });

  it('ログイン失敗・メール未確認・登録済み・レート制限', () => {
    expect(authErrorKey(authApiError('invalid_credentials', 'Invalid login credentials'))).toBe(
      'error.invalidCredentials'
    );
    expect(authErrorKey(authApiError('email_not_confirmed', 'Email not confirmed'))).toBe(
      'error.emailNotConfirmed'
    );
    expect(authErrorKey(authApiError('user_already_exists', 'User already registered'))).toBe('error.emailTaken');
    expect(authErrorKey(authApiError('over_email_send_rate_limit', 'Email rate limit exceeded'))).toBe(
      'error.rateLimit'
    );
  });

  it('通信エラー → network、未知のエラー → auth にフォールバック', () => {
    expect(authErrorKey(new TypeError('Network request failed'))).toBe('error.network');
    expect(authErrorKey(new Error('something unexpected'))).toBe('error.auth');
    expect(authErrorKey(undefined)).toBe('error.auth');
  });
});
