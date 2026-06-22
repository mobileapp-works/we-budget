/**
 * お金に関する純粋関数（フォーマット・丸め・通貨換算）。
 * 副作用なし・テスト容易。金額のバグは致命的なのでここを厚くテストする。
 */
import type { ExchangeRate } from '@/types/models';

/** 小数を持たない通貨（円・ウォン等）。丸め桁数の判定に使う。 */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW']);

/** 通貨の小数桁数を返す。 */
export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
}

/** 通貨の精度に合わせて金額を丸める（浮動小数の誤差を抑える）。 */
export function roundMoney(amount: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  // Number.EPSILON を足して 0.005 等の境界を安定させる
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/**
 * 金額を通貨記号付きでフォーマットする。
 * 例: formatCurrency(1200, 'JPY') => "￥1,200"
 */
export function formatCurrency(amount: number, currency: string, locale = 'ja-JP'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currencyDecimals(currency),
      maximumFractionDigits: currencyDecimals(currency),
    }).format(amount);
  } catch {
    // 未知の通貨コードでも落とさない（コード併記でフォールバック）
    return `${roundMoney(amount, currency).toLocaleString(locale)} ${currency}`;
  }
}

/** 符号付き表示（収支用）。プラスは「＋」を明示する（色だけに頼らないため）。 */
export function formatSignedCurrency(amount: number, currency: string, locale = 'ja-JP'): string {
  const formatted = formatCurrency(Math.abs(amount), currency, locale);
  if (amount > 0) return `＋${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

/** 為替レートを高速参照するためのマップ。キーは `${from}->${to}`。 */
export type RateMap = ReadonlyMap<string, number>;

export function buildRateMap(rates: readonly ExchangeRate[]): RateMap {
  const map = new Map<string, number>();
  for (const r of rates) {
    map.set(`${r.fromCurrency}->${r.toCurrency}`, r.rate);
  }
  return map;
}

/**
 * 金額を基準通貨へ換算する。
 * 同一通貨ならそのまま。レートが見つからなければ null（換算不可）を返す。
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rateMap: RateMap
): number | null {
  if (fromCurrency === baseCurrency) return amount;
  const direct = rateMap.get(`${fromCurrency}->${baseCurrency}`);
  if (direct !== undefined) return amount * direct;
  // 逆レートがあれば利用（1/rate）
  const inverse = rateMap.get(`${baseCurrency}->${fromCurrency}`);
  if (inverse !== undefined && inverse !== 0) return amount / inverse;
  return null;
}
