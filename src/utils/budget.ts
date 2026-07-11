/**
 * 予算の集計・状態判定（純粋関数）。
 * 出典: design.md（予算80%で警告 / 100%超で超過）。
 * 多通貨: 各支出は基準通貨換算済みの baseAmount を持つため、それを合計する。
 */
import type { Expense } from '@/types/models';
import { APP_CONFIG } from '@/constants';
import { roundMoney } from './money';

const DEFAULT_BASE_CURRENCY = 'JPY';

export type BudgetStatus = 'safe' | 'warning' | 'exceeded';

export interface BudgetUsage {
  used: number; // 使用額（基準通貨）
  limit: number; // 予算額（基準通貨）
  percent: number; // 使用率（%）。limit=0 のときは 0
  status: BudgetStatus;
}

/** 使用率から状態を判定する。 */
export function getBudgetStatus(percent: number): BudgetStatus {
  if (percent >= APP_CONFIG.budgetExceededPercent) return 'exceeded';
  if (percent >= APP_CONFIG.budgetWarningPercent) return 'warning';
  return 'safe';
}

/** 予算アラートの閾値（要件7-3: 80%で警告 / 100%で超過）。昇順。 */
export const BUDGET_ALERT_THRESHOLDS: readonly number[] = [
  APP_CONFIG.budgetWarningPercent,
  APP_CONFIG.budgetExceededPercent,
];

/**
 * 新たに到達した予算アラート閾値を返す（送信済みは除外・昇順）。
 * 80%と100%を同時に跨いだ場合は [80, 100] を返し、呼び出し側は最大値の
 * アラートだけを通知する（DB側 check_budget_alerts と同じ挙動）。
 */
export function newlyReachedBudgetThresholds(
  percent: number,
  sentThresholds: readonly number[]
): number[] {
  return BUDGET_ALERT_THRESHOLDS.filter((th) => percent >= th && !sentThresholds.includes(th));
}

/**
 * 支出リストと予算上限から使用状況を計算する。
 * expenses は「予算スコープ（対象カテゴリ・対象月）」で絞り込み済みのものを渡す。
 * 予算額(limit)・支出(baseAmount)とも基準通貨で表現されている前提。
 */
export function calculateBudgetUsage(
  expenses: readonly Expense[],
  limit: number,
  baseCurrency: string = DEFAULT_BASE_CURRENCY
): BudgetUsage {
  let used = 0;
  for (const e of expenses) {
    used += e.baseAmount;
  }

  used = roundMoney(used, baseCurrency);
  const safeLimit = limit > 0 ? limit : 0;
  // percent は表示・閾値判定用に小数2桁まで保持（通貨に依らない）
  const percent = safeLimit > 0 ? roundMoney((used / safeLimit) * 100, 'USD') : 0;

  return {
    used,
    limit: safeLimit,
    percent,
    status: getBudgetStatus(percent),
  };
}
