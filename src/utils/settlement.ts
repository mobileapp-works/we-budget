/**
 * 立替精算の計算ロジック（純粋関数）。
 * design.md の RPC `calculate_settlement_balance` のクライアント版。
 * 表示用にこの関数で残高を見せ、実際の精算確定はサーバーRPCで再計算する。
 *
 * 多通貨: 各支出は記録時に基準通貨へ換算した baseAmount を持つ。集計はこの
 * baseAmount を合計するだけでよい（旧: exchange_rates でその都度換算していた）。
 */
import type { Expense, Pair, SettlementBalance } from '@/types/models';
import { roundMoney } from './money';

const DEFAULT_BASE_CURRENCY = 'JPY';

/** 未精算・個人払い・ペアのどちらかが支払者の支出か（精算の集計候補）。 */
function isUnsettledPersonalPayment(
  e: Expense,
  pair: Pick<Pair, 'user1Id' | 'user2Id'>
): boolean {
  if (e.settlementId !== null) return false;
  if (e.isSharedPayment) return false;
  return e.payerUserId === pair.user1Id || e.payerUserId === pair.user2Id;
}

/**
 * 支出が「今回の精算で確定（settlement_id スタンプ）してよい」対象かを判定する。
 * calculateSettlementBalance の集計対象と完全に同一条件であること。
 * 全支出が baseAmount を持つため、集計対象＝スタンプ対象で齟齬は生じない。
 */
export function isSettleableExpense(
  e: Expense,
  pair: Pick<Pair, 'user1Id' | 'user2Id'>
): boolean {
  return isUnsettledPersonalPayment(e, pair);
}

/**
 * 未精算・個人払いの支出から立替残高を計算する。
 *
 * 前提: 渡す expenses は「論理削除されていない」ものだけ（データ層で除外済み）。
 * この関数内で「未精算(settlementId=null)」「個人払い(isSharedPayment=false)」を絞り込む。
 *
 * @returns 誰が誰にいくら払えば精算されるか。精算不要なら settlementAmount=0。
 */
export function calculateSettlementBalance(
  expenses: readonly Expense[],
  pair: Pick<Pair, 'user1Id' | 'user2Id' | 'splitRatioUser1' | 'splitRatioUser2'>,
  baseCurrency: string = DEFAULT_BASE_CURRENCY
): SettlementBalance {
  const empty: SettlementBalance = {
    settlementAmount: 0,
    fromUserId: null,
    toUserId: null,
    currency: baseCurrency,
  };

  const { user1Id, user2Id, splitRatioUser1 } = pair;
  // ソロモード（相手未設定）や匿名化済みでは精算は発生しない
  if (!user1Id || !user2Id) return empty;

  let user1Paid = 0;
  let user2Paid = 0;

  for (const e of expenses) {
    // 未精算・個人払い・ペア支払者のみ対象（共同口座払いは精算対象外）
    if (!isUnsettledPersonalPayment(e, pair)) continue;

    if (e.payerUserId === user1Id) user1Paid += e.baseAmount;
    else user2Paid += e.baseAmount;
  }

  const total = user1Paid + user2Paid;
  if (total === 0) return empty;

  // user1 の本来の負担額と、実際に払った額の差
  const user1Should = (total * splitRatioUser1) / 100;
  const user1Balance = user1Paid - user1Should;
  const amount = roundMoney(Math.abs(user1Balance), baseCurrency);

  if (amount === 0) return empty;

  // user1Balance > 0: user1 が多く払った → user2 が user1 に支払う
  const fromUserId = user1Balance > 0 ? user2Id : user1Id;
  const toUserId = user1Balance > 0 ? user1Id : user2Id;

  return {
    settlementAmount: amount,
    fromUserId,
    toUserId,
    currency: baseCurrency,
  };
}
