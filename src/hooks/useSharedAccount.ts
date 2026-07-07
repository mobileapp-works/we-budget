/** 共同口座の取得・入金記録フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { SharedEntryInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Expense, SharedAccountEntry } from '@/types/models';

export function useSharedEntries() {
  const session = useRequireSession();
  return useQuery<SharedAccountEntry[]>({
    queryKey: queryKeys.shared(session.pair.id),
    queryFn: () => backend.listSharedEntries(),
    staleTime: 60 * 1000,
  });
}

/**
 * 共同口座払いの支出（全期間）。共同口座残高の計算に使う。
 * 残高は「Σ入金 − Σ出金 − Σ共同口座払い支出（全期間）」のため、当月分だけでは足りない。
 * キーを ['expenses', pairId, ...] 配下に置き、支出変更時の invalidate（プレフィックス）を共有する。
 */
export function useSharedExpenses() {
  const session = useRequireSession();
  return useQuery<Expense[]>({
    queryKey: queryKeys.expenses(session.pair.id, 'shared-all'),
    queryFn: () => backend.listSharedExpenses(),
    staleTime: 60 * 1000,
  });
}

export function useSharedAccountActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  const addEntry = useMutation({
    mutationFn: (input: SharedEntryInput) => backend.addSharedEntry(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shared(session.pair.id) }),
  });

  return { addEntry };
}
