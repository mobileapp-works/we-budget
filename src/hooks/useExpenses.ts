/** 支出の取得・追加・更新・削除フック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { ExpenseInput, ImageUpload } from '@/data';
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
    enabled: id.length > 0, // 新規追加モーダル（id なし）では発行しない
  });
}

/**
 * レシート画像の表示用URLを解決する。
 * - `file://` 等のスキーム付き（ローカルURI・旧データの公開URL）はそのまま返す
 * - スキームなし（receipts バケットの Storage パス）は署名URLに解決する
 */
export function useReceiptImageUrl(value: string | null): string | null {
  const isStoragePath = value !== null && value.length > 0 && !/^[a-z][a-z0-9+.-]*:/i.test(value);
  const query = useQuery<string>({
    queryKey: ['receipt-url', value],
    queryFn: () => backend.getReceiptUrl(value!),
    enabled: isStoragePath,
    staleTime: 50 * 60 * 1000, // 署名URLの期限（60分）より短く保つ
  });
  if (!value) return null;
  return isStoragePath ? (query.data ?? null) : value;
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

  // レシート画像を private バケットにアップロードし、保存用の Storage パスを返す。
  const uploadReceipt = useMutation({
    mutationFn: (image: ImageUpload) => backend.uploadReceipt(image),
  });

  return { addExpense, updateExpense, deleteExpense, uploadReceipt };
}
