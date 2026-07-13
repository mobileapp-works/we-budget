/** プロフィール更新・ペア操作（承認制ペアリング含む）のフック。 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { ImageUpload, SessionContext } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { PairRequest, Profile, UUID } from '@/types/models';

export function useProfileActions() {
  const qc = useQueryClient();
  const session = useRequireSession();

  const updateProfile = useMutation({
    mutationFn: (patch: Partial<Pick<Profile, 'displayName' | 'avatarUrl' | 'aiConsent'>>) =>
      backend.updateProfile(patch),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.session, { ...session, profile });
    },
  });

  // 画像を Storage にアップロード → 返ってきた公開URLを avatar_url に保存する。
  const changeAvatar = useMutation({
    mutationFn: async (image: ImageUpload) => {
      const url = await backend.uploadAvatar(image);
      return backend.updateProfile({ avatarUrl: url });
    },
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.session, { ...session, profile });
    },
  });

  return { updateProfile, changeAvatar };
}

export function usePairActions() {
  const qc = useQueryClient();
  const invalidateRequests = () => qc.invalidateQueries({ queryKey: ['pair-requests'] });

  const createInvite = useMutation({
    mutationFn: () => backend.createInvite(),
  });

  // 招待コードの持ち主へペア申請を送る（成立は相手の承認後）。
  const requestPair = useMutation({
    mutationFn: (inviteCode: string) => backend.requestPair(inviteCode),
    onSuccess: invalidateRequests,
  });

  // 届いた申請を承認/拒否する。承認すると自分のペアに相手が合流する。
  const respondRequest = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: UUID; approve: boolean }) =>
      backend.respondPairRequest(requestId, approve),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session, session);
      invalidateRequests();
    },
  });

  const cancelRequest = useMutation({
    mutationFn: (requestId: UUID) => backend.cancelPairRequest(requestId),
    onSuccess: invalidateRequests,
  });

  const leavePair = useMutation({
    mutationFn: () => backend.leavePair(),
    onSuccess: (session) => qc.setQueryData(queryKeys.session, session),
  });

  // 基準通貨の変更。再換算で全金額が変わるため、セッションの pair を更新しつつ全クエリを無効化する。
  const setBaseCurrency = useMutation({
    mutationFn: ({ currency, rate }: { currency: string; rate: number }) =>
      backend.setBaseCurrency(currency, rate),
    onSuccess: (pair) => {
      const current = qc.getQueryData<SessionContext>(queryKeys.session);
      if (current) qc.setQueryData(queryKeys.session, { ...current, pair });
      void qc.invalidateQueries();
    },
  });

  return { createInvite, requestPair, respondRequest, cancelRequest, leavePair, setBaseCurrency };
}

/**
 * 負担割合（「自分」基準の 1〜99）の取得と保存。
 * pairs は user1 基準で持つため、自分が user2 のときは 100- で変換して読み書きする。
 * 割合は精算残高（RPC で split_ratio を参照）に効くので、保存後は精算残高クエリも無効化する。
 */
export function useSplitRatio() {
  const qc = useQueryClient();
  const session = useRequireSession();
  const isUser1 = session.pair.user1Id === session.userId;
  const myPercent = isUser1 ? session.pair.splitRatioUser1 : session.pair.splitRatioUser2;

  const mutation = useMutation({
    mutationFn: (mine: number) => backend.updateSplitRatio(isUser1 ? mine : 100 - mine),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.session });
      qc.invalidateQueries({ queryKey: queryKeys.settlementBalance(session.pair.id) });
    },
  });

  return { myPercent, save: mutation.mutate, saving: mutation.isPending };
}

/**
 * 自分のペア宛てに届いている pending のペア申請（承認/拒否用）。
 * ペアリング画面でのみマウントされる前提で、画面表示中は軽くポーリングして
 * 「申請が来たのに気づかない」を防ぐ。成立済み（user2 あり）なら発行しない。
 */
export function useIncomingPairRequests() {
  const session = useRequireSession();
  return useQuery<PairRequest[]>({
    queryKey: queryKeys.incomingPairRequests(session.pair.id),
    queryFn: () => backend.listIncomingPairRequests(),
    enabled: session.pair.user2Id === null,
    staleTime: 5 * 1000,
    refetchInterval: 5000,
  });
}

/**
 * 自分が送った最新のペア申請。pending の間だけポーリングし、
 * approved / declined への遷移を検知して画面側で後続処理を行う。
 */
export function useOutgoingPairRequest() {
  const session = useRequireSession();
  return useQuery<PairRequest | null>({
    queryKey: queryKeys.outgoingPairRequest(session.userId),
    queryFn: () => backend.getOutgoingPairRequest(),
    staleTime: 3 * 1000,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 4000 : false),
  });
}
