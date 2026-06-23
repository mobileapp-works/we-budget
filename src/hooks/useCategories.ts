/** カテゴリの取得・追加・更新フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { CategoryInput } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Category, UUID } from '@/types/models';

export function useCategories() {
  const session = useRequireSession();
  return useQuery<Category[]>({
    queryKey: queryKeys.categories(session.pair.id),
    queryFn: () => backend.listCategories(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCategoryActions() {
  const session = useRequireSession();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.categories(session.pair.id) });

  const addCategory = useMutation({
    mutationFn: (input: CategoryInput) => backend.addCategory(input),
    onSuccess: invalidate,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, patch }: { id: UUID; patch: Parameters<typeof backend.updateCategory>[1] }) =>
      backend.updateCategory(id, patch),
    onSuccess: invalidate,
  });

  return { addCategory, updateCategory };
}
