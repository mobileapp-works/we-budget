import { calculateSharedBalance } from './sharedAccount';
import { makeExpense, makeSharedEntry, makeRate } from '@/test-utils/factories';

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

  it('外貨の入金/支出を換算する', () => {
    const entries = [makeSharedEntry({ type: 'deposit', amount: 100, currency: 'USD' })]; // 15000円
    const sharedExpenses = [
      makeExpense({ isSharedPayment: true, payerUserId: null, amount: 20, currency: 'USD' }), // 3000円
    ];
    const rates = [makeRate({ fromCurrency: 'USD', toCurrency: 'JPY', rate: 150 })];
    const result = calculateSharedBalance(entries, sharedExpenses, rates);
    expect(result.balance).toBe(12000);
  });
});
