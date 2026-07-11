import { calculateSharedBalance, SHARED_NO_USER } from './sharedAccount';
import { makeExpense, makeSharedEntry } from '@/test-utils/factories';

describe('calculateSharedBalance', () => {
  it('入金のみなら残高=入金合計', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', amount: 10000 }),
      makeSharedEntry({ type: 'deposit', amount: 5000 }),
    ];
    const result = calculateSharedBalance(entries, []);
    expect(result.balance).toBe(15000);
    expect(result.totalDeposits).toBe(15000);
    expect(result.totalSpent).toBe(0);
  });

  it('共同口座払いの支出を残高から引く', () => {
    const entries = [makeSharedEntry({ type: 'deposit', amount: 10000 })];
    const sharedExpenses = [
      makeExpense({ isSharedPayment: true, payerUserId: null, amount: 3000 }),
    ];
    const result = calculateSharedBalance(entries, sharedExpenses);
    expect(result.balance).toBe(7000);
    expect(result.totalSpent).toBe(3000);
  });

  it('現金移動(withdrawal)も残高から引く', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', amount: 10000 }),
      makeSharedEntry({ type: 'withdrawal', amount: 2000 }),
    ];
    const result = calculateSharedBalance(entries, []);
    expect(result.balance).toBe(8000);
    expect(result.totalSpent).toBe(2000);
  });

  it('個人払い支出は共同残高に影響しない', () => {
    const entries = [makeSharedEntry({ type: 'deposit', amount: 10000 })];
    const personalExpense = [makeExpense({ isSharedPayment: false, amount: 3000 })];
    const result = calculateSharedBalance(entries, personalExpense);
    expect(result.balance).toBe(10000);
  });

  it('共同口座払いの外貨支出は baseAmount で残高から引く', () => {
    const entries = [makeSharedEntry({ type: 'deposit', amount: 15000 })]; // 基準通貨で入金
    const sharedExpenses = [
      makeExpense({ isSharedPayment: true, payerUserId: null, amount: 20, currency: 'USD', baseAmount: 3000 }),
    ];
    const result = calculateSharedBalance(entries, sharedExpenses);
    expect(result.balance).toBe(12000);
  });

  it('入金を入金者ごとに集計する', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', userId: 'user-1', amount: 30000 }),
      makeSharedEntry({ type: 'deposit', userId: 'user-1', amount: 10000 }),
      makeSharedEntry({ type: 'deposit', userId: 'user-2', amount: 50000 }),
    ];
    const result = calculateSharedBalance(entries, []);
    expect(result.depositsByUser['user-1']).toBe(40000);
    expect(result.depositsByUser['user-2']).toBe(50000);
    expect(result.totalDeposits).toBe(90000);
  });

  it('当事者なし(調整)の入金は SHARED_NO_USER に集約する', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', userId: null, amount: 5000 }),
      makeSharedEntry({ type: 'deposit', userId: 'user-1', amount: 10000 }),
    ];
    const result = calculateSharedBalance(entries, []);
    expect(result.depositsByUser[SHARED_NO_USER]).toBe(5000);
    expect(result.depositsByUser['user-1']).toBe(10000);
  });

  it('出金は入金内訳に含めない', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', userId: 'user-1', amount: 10000 }),
      makeSharedEntry({ type: 'withdrawal', userId: 'user-1', amount: 3000 }),
    ];
    const result = calculateSharedBalance(entries, []);
    expect(result.depositsByUser['user-1']).toBe(10000);
    expect(result.balance).toBe(7000);
  });

  it('基準通貨が USD のとき USD 額で内訳を集計する', () => {
    const entries = [
      makeSharedEntry({ type: 'deposit', userId: 'user-2', amount: 100, currency: 'USD' }),
    ];
    const result = calculateSharedBalance(entries, [], 'USD');
    expect(result.depositsByUser['user-2']).toBe(100);
  });
});
