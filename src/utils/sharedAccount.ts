/**
 * 共同口座の残高計算（純粋関数）。
 * 出典: design.md
 *   残高 = Σ(入金) − Σ(現金移動withdrawal) − Σ(共同口座払いの支出)
 * 共同口座での買い物は expenses(isSharedPayment=true) に一本化して記録される。
 */
import type { Expense, SharedAccountEntry, ExchangeRate } from '@/types/models';
import { buildRateMap, convertAmount, roundMoney, type RateMap } from './money';

const BASE_CURRENCY = 'JPY';

export interface SharedBalanceResult {
  balance: number;
  totalDeposits: number;
  totalSpent: number; // withdrawal + 共同口座払い支出
  unconvertedCurrencies: string[];
}

export function calculateSharedBalance(
  entries: readonly SharedAccountEntry[],
  sharedExpenses: readonly Expense[],
  rates: readonly ExchangeRate[] = []
): SharedBalanceResult {
  const rateMap: RateMap = buildRateMap(rates);
  const unconverted = new Set<string>();

  let deposits = 0;
  let withdrawals = 0;

  for (const entry of entries) {
    const converted = convertAmount(entry.amount, entry.currency, BASE_CURRENCY, rateMap);
    if (converted === null) {
      unconverted.add(entry.currency);
      continue;
    }
    if (entry.type === 'deposit') deposits += converted;
    else withdrawals += converted;
  }

  let sharedSpent = 0;
  for (const e of sharedExpenses) {
    if (!e.isSharedPayment) continue; // 念のため共同口座払いのみ
    const converted = convertAmount(e.amount, e.currency, BASE_CURRENCY, rateMap);
    if (converted === null) {
      unconverted.add(e.currency);
      continue;
    }
    sharedSpent += converted;
  }

  const totalSpent = roundMoney(withdrawals + sharedSpent, BASE_CURRENCY);
  const totalDeposits = roundMoney(deposits, BASE_CURRENCY);
  const balance = roundMoney(totalDeposits - totalSpent, BASE_CURRENCY);

  return {
    balance,
    totalDeposits,
    totalSpent,
    unconvertedCurrencies: [...unconverted],
  };
}
