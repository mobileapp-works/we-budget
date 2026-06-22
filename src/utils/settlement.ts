/**
 * 立替精算の計算ロジック（純粋関数）。
 * design.md の RPC `calculate_settlement_balance` のクライアント版。
 * 表示用にこの関数で残高を見せ、実際の精算確定はサーバーRPCで再計算する。
 */
import type { Expense, Pair, ExchangeRate, SettlementBalance } from '@/types/models';
import { buildRateMap, convertAmount, roundMoney, type RateMap } from './money';

const BASE_CURRENCY = 'JPY';

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
  rates: readonly ExchangeRate[] = []
): SettlementBalance {
  const empty: SettlementBalance = {
    settlementAmount: 0,
    fromUserId: null,
    toUserId: null,
    currency: BASE_CURRENCY,
    unconvertedCurrencies: [],
  };

  const { user1Id, user2Id, splitRatioUser1 } = pair;
  // ソロモード（相手未設定）や匿名化済みでは精算は発生しない
  if (!user1Id || !user2Id) return empty;

  const rateMap: RateMap = buildRateMap(rates);
  const unconverted = new Set<string>();

  let user1Paid = 0;
  let user2Paid = 0;

  for (const e of expenses) {
    // 未精算・個人払いのみ対象（共同口座払いは精算対象外）
    if (e.settlementId !== null) continue;
    if (e.isSharedPayment) continue;
    if (e.payerUserId !== user1Id && e.payerUserId !== user2Id) continue; // 攻撃的防御: 攻撃者/匿名は除外

    const converted = convertAmount(e.amount, e.currency, BASE_CURRENCY, rateMap);
    if (converted === null) {
      unconverted.add(e.currency);
      continue; // 換算できない支出は集計から除外し、UIで設定を促す
    }

    if (e.payerUserId === user1Id) user1Paid += converted;
    else user2Paid += converted;
  }

  const total = user1Paid + user2Paid;
  if (total === 0) {
    return { ...empty, unconvertedCurrencies: [...unconverted] };
  }

  // user1 の本来の負担額と、実際に払った額の差
  const user1Should = (total * splitRatioUser1) / 100;
  const user1Balance = user1Paid - user1Should;
  const amount = roundMoney(Math.abs(user1Balance), BASE_CURRENCY);

  if (amount === 0) {
    return { ...empty, unconvertedCurrencies: [...unconverted] };
  }

  // user1Balance > 0: user1 が多く払った → user2 が user1 に支払う
  const fromUserId = user1Balance > 0 ? user2Id : user1Id;
  const toUserId = user1Balance > 0 ? user1Id : user2Id;

  return {
    settlementAmount: amount,
    fromUserId,
    toUserId,
    currency: BASE_CURRENCY,
    unconvertedCurrencies: [...unconverted],
  };
}
