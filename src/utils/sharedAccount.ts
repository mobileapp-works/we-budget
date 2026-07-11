/**
 * 共同口座の残高計算（純粋関数）。
 * 出典: design.md
 *   残高 = Σ(入金) − Σ(現金移動withdrawal) − Σ(共同口座払いの支出)
 * 共同口座での買い物は expenses(isSharedPayment=true) に一本化して記録される。
 *
 * 多通貨: 入金/出金は基準通貨で記録される（entry.amount がそのまま基準通貨）。
 * 共同口座払いの支出は基準通貨換算済みの baseAmount を使う。
 */
import type { Expense, SharedAccountEntry } from '@/types/models';
import { roundMoney } from './money';

const DEFAULT_BASE_CURRENCY = 'JPY';

/** 当事者が紐づかない入金/出金（残高調整）のキー。userId は UUID なので衝突しない。 */
export const SHARED_NO_USER = '__none__';

export interface SharedBalanceResult {
  balance: number;
  totalDeposits: number;
  totalSpent: number; // withdrawal + 共同口座払い支出
  /** 入金者ごとの入金合計（基準通貨）。userId が null の分は SHARED_NO_USER に集約。 */
  depositsByUser: Record<string, number>;
}

export function calculateSharedBalance(
  entries: readonly SharedAccountEntry[],
  sharedExpenses: readonly Expense[],
  baseCurrency: string = DEFAULT_BASE_CURRENCY
): SharedBalanceResult {
  let deposits = 0;
  let withdrawals = 0;
  const depositsByUserRaw: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.type === 'deposit') {
      deposits += entry.amount;
      const key = entry.userId ?? SHARED_NO_USER;
      depositsByUserRaw[key] = (depositsByUserRaw[key] ?? 0) + entry.amount;
    } else {
      withdrawals += entry.amount;
    }
  }

  const depositsByUser: Record<string, number> = {};
  for (const [key, value] of Object.entries(depositsByUserRaw)) {
    depositsByUser[key] = roundMoney(value, baseCurrency);
  }

  let sharedSpent = 0;
  for (const e of sharedExpenses) {
    if (!e.isSharedPayment) continue; // 念のため共同口座払いのみ
    sharedSpent += e.baseAmount;
  }

  const totalSpent = roundMoney(withdrawals + sharedSpent, baseCurrency);
  const totalDeposits = roundMoney(deposits, baseCurrency);
  const balance = roundMoney(totalDeposits - totalSpent, baseCurrency);

  return {
    balance,
    totalDeposits,
    totalSpent,
    depositsByUser,
  };
}
