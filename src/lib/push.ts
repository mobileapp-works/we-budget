/**
 * プッシュ通知（Expo Push）。トークン取得・通知チャンネル・前面表示ハンドラ。
 *
 * 実機の development / production ビルドでのみ動作する。
 * Expo Go（SDK53+ はリモートpush非対応）・シミュレータ・権限拒否時は null を返し、
 * アプリ内通知のみ（プッシュ配信なし）で動作する。
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// アプリ前面でも通知を表示する（バナー＋リスト＋サウンド）。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** getExpoPushTokenAsync に必要な EAS projectId を取得する。 */
function getProjectId(): string | undefined {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  // 古い経路（easConfig）も一応フォールバック
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromConfig ?? fromEas ?? undefined;
}

/**
 * プッシュ許可を要求し、Expo Push Token を取得する。
 * - 実機以外（シミュレータ）・権限拒否・Expo Go 等では null。
 * - Android は通知チャンネルを用意する（未作成だと通知が表示されない）。
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // シミュレータはトークン取得不可

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = getProjectId();
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data ?? null;
  } catch {
    // Expo Go・ネイティブ未リンク・ネットワーク不通など。致命的でないので握りつぶす。
    return null;
  }
}
