import { Redirect } from 'expo-router';

/** エントリ。実際の振り分けは _layout のセッションガードが行う。 */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
