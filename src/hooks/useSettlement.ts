/** 立替残高・精算履歴・精算実行のフック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Settlement, SettlementBalance, UUID } from '@/types/models';

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

  /** 精算後に残高・履歴・支出一覧を無効化する。 */
  const invalidateSettlement = () => {
    qc.invalidateQueries({ queryKey: queryKeys.settlementBalance(session.pair.id) });
    qc.invalidateQueries({ queryKey: queryKeys.settlements(session.pair.id) });
    qc.invalidateQueries({ queryKey: ['expenses', session.pair.id] });
  };

  const settle = useMutation({
    mutationFn: () => backend.executeSettlement(),
    onSuccess: invalidateSettlement,
  });

  // まとめて共同口座から精算（共同口座残高も動くので shared も無効化）。
  const settleFromShared = useMutation({
    mutationFn: () => backend.executeSettlementFromShared(),
    onSuccess: () => {
      invalidateSettlement();
      qc.invalidateQueries({ queryKey: queryKeys.shared(session.pair.id) });
    },
  });

  // 立替1件の個別精算（該当支出のキャッシュも無効化）。
  const settleExpense = useMutation({
    mutationFn: (expenseId: UUID) => backend.settleExpense(expenseId),
    onSuccess: (_data, expenseId) => {
      invalidateSettlement();
      qc.invalidateQueries({ queryKey: queryKeys.expense(expenseId) });
    },
  });

  return { settle, settleFromShared, settleExpense };
}
