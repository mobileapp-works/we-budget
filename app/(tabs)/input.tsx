import { Redirect } from 'expo-router';

/**
 * 中央タブの実体。通常は tabBarButton がモーダルを開くため表示されないが、
 * 直接遷移された場合の保険として入力モーダルへリダイレクトする。
 */
export default function InputTab() {
  return <Redirect href="/expense-input" />;
}
