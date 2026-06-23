/**
 * セッション（ログイン状態）と認証アクションのフック。
 * セッションは TanStack Query でキャッシュし、画面はこれを購読する。
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import type { SessionContext } from '@/data';

/** 現在のセッションを取得する。null なら未ログイン。 */
export function useSession() {
  return useQuery<SessionContext | null>({
    queryKey: queryKeys.session,
    queryFn: () => backend.getSession(),
    staleTime: Infinity, // セッションは明示的な操作でのみ更新する
  });
}

/**
 * ログイン済み前提でセッションを返すヘルパー。
 * 認証ガード済みの画面から使う（未ログイン時は呼ばれない設計）。
 */
export function useRequireSession(): SessionContext {
  const { data } = useSession();
  if (!data) {
    // ルーティングで未ログインは弾く前提。保険として例外。
    throw new Error('session required but not authenticated');
  }
  return data;
}

export function useAuthActions() {
  const qc = useQueryClient();

  const signIn = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      backend.signIn(email, password),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session, session);
    },
  });

  const signUp = useMutation({
    mutationFn: ({ email, password, displayName }: { email: string; password: string; displayName: string }) =>
      backend.signUp(email, password, displayName),
  });

  const signOut = useMutation({
    mutationFn: () => backend.signOut(),
    onSuccess: () => {
      qc.setQueryData(queryKeys.session, null);
      qc.clear(); // 別ユーザーのキャッシュが残らないようにする
    },
  });

  const sendPasswordReset = useMutation({
    mutationFn: (email: string) => backend.sendPasswordReset(email),
  });

  const deleteAccount = useMutation({
    mutationFn: () => backend.deleteAccount(),
    onSuccess: () => {
      qc.setQueryData(queryKeys.session, null);
      qc.clear();
    },
  });

  return { signIn, signUp, signOut, sendPasswordReset, deleteAccount };
}
