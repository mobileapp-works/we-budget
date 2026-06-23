/** 通知一覧・既読・通知設定のフック。 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backend } from '@/data';
import { queryKeys } from '@/lib/queryClient';
import { useRequireSession } from './useSession';
import type { AppNotification, NotificationSettings, UUID } from '@/types/models';

export function useNotifications() {
  const session = useRequireSession();
  return useQuery<AppNotification[]>({
    queryKey: queryKeys.notifications(session.userId),
    queryFn: () => backend.listNotifications(),
    staleTime: 30 * 1000,
  });
}

/** 未読件数（ベルのバッジ用）。 */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data ? data.filter((n) => !n.isRead).length : 0;
}

export function useNotificationActions() {
  const session = useRequireSession();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.notifications(session.userId) });

  const markRead = useMutation({
    mutationFn: (id: UUID) => backend.markNotificationRead(id),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => backend.markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  return { markRead, markAllRead };
}

export function useNotificationSettings() {
  const session = useRequireSession();
  return useQuery<NotificationSettings>({
    queryKey: queryKeys.notificationSettings(session.userId),
    queryFn: () => backend.getNotificationSettings(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotificationSettingsActions() {
  const session = useRequireSession();
  const qc = useQueryClient();

  const updateSettings = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => backend.updateNotificationSettings(patch),
    onSuccess: (settings) => qc.setQueryData(queryKeys.notificationSettings(session.userId), settings),
  });

  return { updateSettings };
}
