/**
 * テスト用のモデル生成ヘルパー。デフォルト値を与え、必要な項目だけ上書きする。
 * （*.test.ts ではないので jest のテスト対象にはならない）
 */
import type { Expense, Pair, SharedAccountEntry, ExchangeRate } from '@/types/models';

let seq = 0;
const nextId = (): string => `id-${++seq}`;

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: nextId(),
    pairId: 'pair-1',
    recordedBy: 'user-1',
    categoryId: 'cat-1',
    amount: 1000,
    currency: 'JPY',
    payerUserId: 'user-1',
    isSharedPayment: false,
    settlementId: null,
    expenseDate: '2026-06-01',
    description: null,
    storeName: null,
    receiptImageUrl: null,
    isFixedCost: false,
    fixedCostId: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

export function makePair(overrides: Partial<Pair> = {}): Pair {
  return {
    id: 'pair-1',
    inviteCode: 'ABCD1234',
    user1Id: 'user-1',
    user2Id: 'user-2',
    splitRatioUser1: 50,
    splitRatioUser2: 50,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

export function makeSharedEntry(overrides: Partial<SharedAccountEntry> = {}): SharedAccountEntry {
  return {
    id: nextId(),
    pairId: 'pair-1',
    type: 'deposit',
    userId: 'user-1',
    amount: 10000,
    currency: 'JPY',
    description: null,
    transactionDate: '2026-06-01',
    ...overrides,
  };
}

export function makeRate(overrides: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: nextId(),
    pairId: 'pair-1',
    fromCurrency: 'USD',
    toCurrency: 'JPY',
    rate: 150,
    ...overrides,
  };
}
