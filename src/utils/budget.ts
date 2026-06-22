/**
 * 予算の集計・状態判定（純粋関数）。
 * 出典: design.md（予算80%で警告 / 100%超で超過。多通貨は換算して合計）。
 */
import type { Expense, ExchangeRate } from '@/types/models';
import { APP_CONFIG } from '@/constants';
import { buildRateMap, convertAmount, roundMoney, type RateMap } from './money';

const BASE_CURRENCY = 'JPY';

export type BudgetStatus = 'safe' | 'warning' | 'exceeded';

export interface BudgetUsage {
  used: number; // 使用額（基準通貨）
  limit: number; // 予算額（基準通貨）
  percent: number; // 使用率（%）。limit=0 のときは 0
  status: BudgetStatus;
  unconvertedCurrencies: string[];
}

/** 使用率から状態を判定する。 */
export function getBudgetStatus(percent: number): BudgetStatus {
  if (percent >= APP_CONFIG.budgetExceededPercent) return 'exceeded';
  if (percent >= APP_CONFIG.budgetWarningPercent) return 'warning';
  return 'safe';
}

/**
 * 支出リストと予算上限から使用状況を計算する。
 * expenses は「予算スコープ（対象カテゴリ・対象月）」で絞り込み済みのものを渡す。
 */
export function calculateBudgetUsage(
  expenses: readonly Expense[],
  limit: number,
  rates: readonly ExchangeRate[] = []
): BudgetUsage {
  const rateMap: RateMap = buildRateMap(rates);
  const unconverted = new Set<string>();
  let used = 0;

  for (const e of expenses) {
    const converted = convertAmount(e.amount, e.currency, BASE_CURRENCY, rateMap);
    if (converted === null) {
      unconverted.add(e.currency);
      continue;
    }
    used += converted;
  }

  used = roundMoney(used, BASE_CURRENCY);
  const safeLimit = limit > 0 ? limit : 0;
  const percent = safeLimit > 0 ? roundMoney((used / safeLimit) * 100, 'USD') : 0;

  return {
    used,
    limit: safeLimit,
    percent,
    status: getBudgetStatus(percent),
    unconvertedCurrencies: [...unconverted],
  };
}
