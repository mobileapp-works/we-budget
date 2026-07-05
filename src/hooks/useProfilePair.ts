/** プロフィール更新・ペア操作のフック（セッションを更新する）。 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import type { ImageUpload } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { Profile } from '@/types/models';

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

  const createInvite = useMutation({
    mutationFn: () => backend.createInvite(),
  });

  const joinPair = useMutation({
    mutationFn: (inviteCode: string) => backend.joinPair(inviteCode),
    onSuccess: (session) => qc.setQueryData(queryKeys.session, session),
  });

  const leavePair = useMutation({
    mutationFn: () => backend.leavePair(),
    onSuccess: (session) => qc.setQueryData(queryKeys.session, session),
  });

  const updateSplitRatio = useMutation({
    mutationFn: (user1Percent: number) => backend.updateSplitRatio(user1Percent),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });

  return { createInvite, joinPair, leavePair, updateSplitRatio };
}
