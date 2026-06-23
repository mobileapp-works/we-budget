/** 予算の取得・設定フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { BudgetInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Budget } from '@/types/models';

export function useBudgets() {
  const session = useRequireSession();
  return useQuery<Budget[]>({
    queryKey: queryKeys.budgets(session.pair.id),
    queryFn: () => backend.listBudgets(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBudgetActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  const upsertBudget = useMutation({
    mutationFn: (input: BudgetInput) => backend.upsertBudget(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.budgets(session.pair.id) }),
  });

  return { upsertBudget };
}
