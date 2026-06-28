import { calculateSettlementBalance } from './settlement';
import { makeExpense, makePair, makeRate } from '@/test-utils/factories';

describe('calculateSettlementBalance', () => {
  it('支出が無ければ精算0', () => {
    const result = calculateSettlementBalance([], makePair());
    expect(result.settlementAmount).toBe(0);
    expect(result.fromUserId).toBeNull();
  });

  it('50:50で user1 だけが3000払ったら user2 が1500払う', () => {
    const expenses = [makeExpense({ payerUserId: 'user-1', amount: 3000 })];
    const result = calculateSettlementBalance(expenses, makePair());
    expect(result.settlementAmount).toBe(1500);
    expect(result.fromUserId).toBe('user-2'); // 払う側
    expect(result.toUserId).toBe('user-1'); // 受け取る側
  });

  it('双方が同額払えば精算不要', () => {
    const expenses = [
      makeExpense({ payerUserId: 'user-1', amount: 2000 }),
      makeExpense({ payerUserId: 'user-2', amount: 2000 }),
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    expect(result.settlementAmount).toBe(0);
  });

  it('負担割合 70:30 を反映する', () => {
    // 合計10000、user1が全額立替。user1負担=7000なので user1Balance=+3000 → user2が3000払う
    const expenses = [makeExpense({ payerUserId: 'user-1', amount: 10000 })];
    const pair = makePair({ splitRatioUser1: 70, splitRatioUser2: 30 });
    const result = calculateSettlementBalance(expenses, pair);
    expect(result.settlementAmount).toBe(3000);
    expect(result.fromUserId).toBe('user-2');
    expect(result.toUserId).toBe('user-1');
  });

  it('精算済み(settlementId!=null)は集計しない', () => {
    const expenses = [
      makeExpense({ payerUserId: 'user-1', amount: 3000, settlementId: 'settled-1' }),
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    expect(result.settlementAmount).toBe(0);
  });

  it('共同口座払い(isSharedPayment)は精算対象外', () => {
    const expenses = [
      makeExpense({ payerUserId: null, isSharedPayment: true, amount: 5000 }),
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    expect(result.settlementAmount).toBe(0);
  });

  it('ソロモード(user2未設定)は精算0', () => {
    const expenses = [makeExpense({ payerUserId: 'user-1', amount: 3000 })];
    const result = calculateSettlementBalance(expenses, makePair({ user2Id: null }));
    expect(result.settlementAmount).toBe(0);
  });

  it('外貨はレートで換算して集計する', () => {
    // user2 が $20 (=3000円) 立替、50:50 → user1 が1500円払う
    const expenses = [makeExpense({ payerUserId: 'user-2', amount: 20, currency: 'USD' })];
    const rates = [makeRate({ fromCurrency: 'USD', toCurrency: 'JPY', rate: 150 })];
    const result = calculateSettlementBalance(expenses, makePair(), rates);
    expect(result.settlementAmount).toBe(1500);
    expect(result.fromUserId).toBe('user-1');
    expect(result.toUserId).toBe('user-2');
  });

  it('レート未設定の通貨は集計から除外し unconverted に報告する', () => {
    const expenses = [
      makeExpense({ payerUserId: 'user-1', amount: 3000, currency: 'JPY' }),
      makeExpense({ payerUserId: 'user-2', amount: 20, currency: 'USD' }), // レートなし
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    // USD は除外され、JPY3000のみ → user2が1500払う
    expect(result.settlementAmount).toBe(1500);
    expect(result.unconvertedCurrencies).toContain('USD');
  });

  it('複数支出が混在しても正しく集計する', () => {
    // user1: 1000+2000=3000, user2: 4000 → 合計7000, 50:50なら各3500
    // user1 は3500負担すべきだが3000しか払ってない → user1が500払う
    const expenses = [
      makeExpense({ payerUserId: 'user-1', amount: 1000 }),
      makeExpense({ payerUserId: 'user-1', amount: 2000 }),
      makeExpense({ payerUserId: 'user-2', amount: 4000 }),
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    expect(result.settlementAmount).toBe(500);
    expect(result.fromUserId).toBe('user-1');
    expect(result.toUserId).toBe('user-2');
  });

  it('退会した支払い者(payerUserId=null かつ個人払い)は集計対象外', () => {
    const expenses = [
      makeExpense({ payerUserId: 'user-1', amount: 2000 }),
      makeExpense({ payerUserId: null, isSharedPayment: false, amount: 5000 }), // 匿名化済み
    ];
    const result = calculateSettlementBalance(expenses, makePair());
    // null payer は除外 → user1の2000のみ → user2が1000払う
    expect(result.settlementAmount).toBe(1000);
    expect(result.fromUserId).toBe('user-2');
  });

  it('割合60:40で端数が出ても整数に丸める', () => {
    // 合計999をuser1全額立替、60:40 → user1負担=599.4 → balance=399.6 → 400に丸め
    const expenses = [makeExpense({ payerUserId: 'user-1', amount: 999 })];
    const pair = makePair({ splitRatioUser1: 60, splitRatioUser2: 40 });
    const result = calculateSettlementBalance(expenses, pair);
    expect(result.settlementAmount).toBe(400);
    expect(result.fromUserId).toBe('user-2');
  });
});
