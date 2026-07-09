import { calculateBudgetUsage, getBudgetStatus, newlyReachedBudgetThresholds } from './budget';
import { makeExpense, makeRate } from '@/test-utils/factories';

describe('getBudgetStatus', () => {
  it('79%は safe', () => expect(getBudgetStatus(79)).toBe('safe'));
  it('80%は warning', () => expect(getBudgetStatus(80)).toBe('warning'));
  it('99.9%は warning', () => expect(getBudgetStatus(99.9)).toBe('warning'));
  it('100%は exceeded', () => expect(getBudgetStatus(100)).toBe('exceeded'));
  it('120%は exceeded', () => expect(getBudgetStatus(120)).toBe('exceeded'));
});

describe('calculateBudgetUsage', () => {
  it('使用額と使用率を計算する', () => {
    const expenses = [
      makeExpense({ amount: 3000 }),
      makeExpense({ amount: 5000 }),
    ];
    const usage = calculateBudgetUsage(expenses, 10000);
    expect(usage.used).toBe(8000);
    expect(usage.limit).toBe(10000);
    expect(usage.percent).toBe(80);
    expect(usage.status).toBe('warning');
  });

  it('予算0なら percent 0・safe', () => {
    const usage = calculateBudgetUsage([makeExpense({ amount: 1000 })], 0);
    expect(usage.percent).toBe(0);
    expect(usage.status).toBe('safe');
  });

  it('超過を検知する', () => {
    const usage = calculateBudgetUsage([makeExpense({ amount: 12000 })], 10000);
    expect(usage.status).toBe('exceeded');
    expect(usage.percent).toBe(120);
  });

  it('外貨を換算して合計する', () => {
    const expenses = [
      makeExpense({ amount: 5000, currency: 'JPY' }),
      makeExpense({ amount: 20, currency: 'USD' }), // 150円/$ → 3000円
    ];
    const rates = [makeRate({ fromCurrency: 'USD', toCurrency: 'JPY', rate: 150 })];
    const usage = calculateBudgetUsage(expenses, 10000, rates);
    expect(usage.used).toBe(8000);
  });

  it('換算不可の通貨は除外して報告する', () => {
    const expenses = [
      makeExpense({ amount: 5000, currency: 'JPY' }),
      makeExpense({ amount: 20, currency: 'USD' }),
    ];
    const usage = calculateBudgetUsage(expenses, 10000);
    expect(usage.used).toBe(5000);
    expect(usage.unconvertedCurrencies).toContain('USD');
  });
});

describe('newlyReachedBudgetThresholds', () => {
  it('79%では何も返さない', () => {
    expect(newlyReachedBudgetThresholds(79, [])).toEqual([]);
  });

  it('80%到達で [80] を返す', () => {
    expect(newlyReachedBudgetThresholds(80, [])).toEqual([80]);
  });

  it('80%送信済みなら85%でも何も返さない（重複防止）', () => {
    expect(newlyReachedBudgetThresholds(85, [80])).toEqual([]);
  });

  it('80%送信済みから100%超過で [100] を返す', () => {
    expect(newlyReachedBudgetThresholds(105, [80])).toEqual([100]);
  });

  it('一気に100%を跨いだら [80, 100] を返す（通知は最大値のみが呼び出し側の責務）', () => {
    expect(newlyReachedBudgetThresholds(120, [])).toEqual([80, 100]);
  });

  it('両方送信済みなら何も返さない', () => {
    expect(newlyReachedBudgetThresholds(150, [80, 100])).toEqual([]);
  });
});
