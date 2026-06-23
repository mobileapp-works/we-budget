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
  const normalized = input.replace(/[,\s]/g, '');
  if (normalized === '') return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
