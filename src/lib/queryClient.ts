/**
 * TanStack Query のクライアント設定。
 * サーバー状態のキャッシュ・リトライ・ローディング/エラーを共通化する。
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 既定30秒（個別フックで上書き）
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** クエリキーを一元管理する（タイプミス・無効化漏れを防ぐ）。 */
export const queryKeys = {
  session: ['session'] as const,
  categories: (pairId: string) => ['categories', pairId] as const,
  expenses: (pairId: string, monthKey: string) => ['expenses', pairId, monthKey] as const,
  expense: (id: string) => ['expense', id] as const,
  settlementBalance: (pairId: string) => ['settlement-balance', pairId] as const,
  settlements: (pairId: string) => ['settlements', pairId] as const,
  shared: (pairId: string) => ['shared-account', pairId] as const,
  fixedCosts: (pairId: string) => ['fixed-costs', pairId] as const,
  budgets: (pairId: string) => ['budgets', pairId] as const,
  rates: (pairId: string) => ['exchange-rates', pairId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationSettings: (userId: string) => ['notification-settings', userId] as const,
};
