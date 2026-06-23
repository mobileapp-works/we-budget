import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '@/hooks';

/** エントリ。セッション有無で振り分ける（未ログインは認証フローへ）。 */
export default function Index() {
  const { data: session, isLoading } = useSession();
  if (isLoading) return <View style={{ flex: 1 }} />;
  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />;
}
