/** 共同口座の取得・入金記録フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { SharedEntryInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { SharedAccountEntry } from '@/types/models';

export function useSharedEntries() {
  const session = useRequireSession();
  return useQuery<SharedAccountEntry[]>({
    queryKey: queryKeys.shared(session.pair.id),
    queryFn: () => backend.listSharedEntries(),
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
