/** カテゴリの取得・追加・更新フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { CategoryInput, ImageUpload } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Category, UUID } from '@/types/models';

/**
 * カテゴリ一覧を取得する。
 * includeHidden=true で非表示カテゴリも含める（カテゴリ管理画面の再表示用）。
 * 無効化は queryKeys.categories プレフィックスで両方に効く。
 */
export function useCategories(includeHidden = false) {
  const session = useRequireSession();
  return useQuery<Category[]>({
    queryKey: includeHidden
      ? [...queryKeys.categories(session.pair.id), 'all']
      : queryKeys.categories(session.pair.id),
    queryFn: () => backend.listCategories(includeHidden),
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

  // カスタム写真を Storage にアップロードして公開URLを返す（保存時に icon へ入れる）。
  const uploadIcon = useMutation({
    mutationFn: (image: ImageUpload) => backend.uploadCategoryIcon(image),
  });

  return { addCategory, updateCategory, uploadIcon };
}
