/** 固定費・変動固定費の取得・編集フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { FixedCostInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { FixedCost, UUID } from '@/types/models';

export function useFixedCosts() {
  const session = useRequireSession();
  return useQuery<FixedCost[]>({
    queryKey: queryKeys.fixedCosts(session.pair.id),
    queryFn: () => backend.listFixedCosts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFixedCostActions() {
  const session = useRequireSession();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.fixedCosts(session.pair.id) });

  const addFixedCost = useMutation({
    mutationFn: (input: FixedCostInput) => backend.addFixedCost(input),
    onSuccess: invalidate,
  });

  const updateFixedCost = useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: Partial<FixedCostInput> }) => backend.updateFixedCost(id, input),
    onSuccess: invalidate,
  });

  const deleteFixedCost = useMutation({
    mutationFn: (id: UUID) => backend.deleteFixedCost(id),
    onSuccess: invalidate,
  });

  return { addFixedCost, updateFixedCost, deleteFixedCost };
}
