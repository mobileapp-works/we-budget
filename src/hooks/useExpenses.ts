/** 支出の取得・追加・更新・削除フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { ExpenseInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { getMonthKey } from '@/utils';
import { useRequireSession } from './useSession';
import type { Expense, UUID } from '@/types/models';

/** 指定月（既定は今月）の支出一覧を取得する。 */
export function useExpenses(monthKey: string = getMonthKey()) {
  const session = useRequireSession();
  return useQuery<Expense[]>({
    queryKey: queryKeys.expenses(session.pair.id, monthKey),
    queryFn: () => backend.listExpenses(monthKey),
    staleTime: 30 * 1000,
  });
}

export function useExpense(id: UUID) {
  return useQuery<Expense | null>({
    queryKey: queryKeys.expense(id),
    queryFn: () => backend.getExpense(id),
    staleTime: 30 * 1000,
  });
}

export function useExpenseActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  /** 支出変更後に関連クエリ（残高・予算・一覧）をまとめて無効化する。 */
  const invalidateRelated = () => {
    qc.invalidateQueries({ queryKey: ['expenses', session.pair.id] });
    qc.invalidateQueries({ queryKey: queryKeys.settlementBalance(session.pair.id) });
    qc.invalidateQueries({ queryKey: queryKeys.budgets(session.pair.id) });
    qc.invalidateQueries({ queryKey: queryKeys.shared(session.pair.id) });
  };

  const addExpense = useMutation({
    mutationFn: (input: ExpenseInput) => backend.addExpense(input),
    onSuccess: invalidateRelated,
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, expectedUpdatedAt, input }: { id: UUID; expectedUpdatedAt: string; input: ExpenseInput }) =>
      backend.updateExpense(id, expectedUpdatedAt, input),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.expense(updated.id), updated);
      invalidateRelated();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: UUID) => backend.deleteExpense(id),
    onSuccess: invalidateRelated,
  });

  return { addExpense, updateExpense, deleteExpense };
}
