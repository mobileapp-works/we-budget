/**
 * プッシュ通知の登録フック。
 * ログイン後に Expo Push Token を取得して profiles に保存し、通知タップで通知一覧へ遷移する。
 * ルート近く（_layout）で1度だけ呼ぶ想定。
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { backend } from '@/data';
import { registerForPushNotificationsAsync } from '@/lib/push';
import { useSession } from './useSession';

export function usePushRegistration() {
  const { data: session } = useSession();
  const router = useRouter();
  const registeredFor = useRef<string | null>(null);

  // ログイン後、そのユーザーでまだ登録していなければトークンを取得・保存する。
  useEffect(() => {
    if (!session) return;
    const userId = session.userId;
    if (registeredFor.current === userId) return;
    registeredFor.current = userId;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token) return; // Expo Go / 権限拒否 / シミュレータ
      if (token === session.profile.expoPushToken) return; // 既に最新なら書き込まない
      try {
        await backend.registerPushToken(token);
      } catch {
        registeredFor.current = null; // 保存失敗は次回起動で再試行
      }
    })();
  }, [session]);

  // 通知をタップしたら通知一覧へ遷移する。
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications');
    });
    return () => sub.remove();
  }, [router]);
}
