/** 立替残高・精算履歴・精算実行のフック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Settlement, SettlementBalance } from '@/types/models';

export function useSettlementBalance() {
  const session = useRequireSession();
  return useQuery<SettlementBalance>({
    queryKey: queryKeys.settlementBalance(session.pair.id),
    queryFn: () => backend.getSettlementBalance(),
    staleTime: 30 * 1000,
  });
}

export function useSettlements() {
  const session = useRequireSession();
  return useQuery<Settlement[]>({
    queryKey: queryKeys.settlements(session.pair.id),
    queryFn: () => backend.listSettlements(),
    staleTime: 60 * 1000,
  });
}

export function useSettlementActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  const settle = useMutation({
    mutationFn: () => backend.executeSettlement(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settlementBalance(session.pair.id) });
      qc.invalidateQueries({ queryKey: queryKeys.settlements(session.pair.id) });
      qc.invalidateQueries({ queryKey: ['expenses', session.pair.id] });
    },
  });

  return { settle };
}
