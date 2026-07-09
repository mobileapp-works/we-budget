/** 入力バリデーション（純粋関数）。 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/** 金額文字列を数値に変換する。不正なら null。 */
export function parseAmount(input: string): number | null {
  // 全角数字・全角記号（１２３．，）を半角へ正規化してからパースする。
  const normalized = input.normalize('NFKC').replace(/[,\s]/g, '');
  if (normalized === '') return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
