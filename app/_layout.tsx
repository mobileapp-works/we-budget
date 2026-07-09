/**
 * ルートレイアウト。Provider 群で全体を包み、セッションに応じて認証/メインを出し分ける。
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { ErrorBoundary } from '@/components';
import { useSession, usePushRegistration, useAppStateSync } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import { usePreferencesStore } from '@/store/preferencesStore';
import '@/lib/i18n'; // i18n の初期化（副作用）

function RootNavigator() {
  const { data: session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();
  const aiConsentLocal = usePreferencesStore((s) => s.aiConsent);
  const setAiConsent = usePreferencesStore((s) => s.setAiConsent);

  // ログイン時にプッシュ通知トークンを登録し、通知タップの遷移を有効化する。
  usePushRegistration();
  // フォアグラウンド復帰時にセッション・通知・ペア申請を同期する（パートナー側の変更に追従）。
  useAppStateSync();

  // AI同意はサーバ（profiles.ai_consent）が正。別端末/再インストールで同意済みなら
  // ローカルストアへ引き上げて再同意を求めない（アップグレードのみ・ローカルの取り消しはしない）。
  useEffect(() => {
    if (session?.profile.aiConsent && !aiConsentLocal) {
      setAiConsent(true);
    }
  }, [session, aiConsentLocal, setAiConsent]);

  // セッション状態に応じてリダイレクト（未ログイン→認証 / ログイン済み→メイン）
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    // パスワード再設定はリカバリーセッション確立後（=ログイン状態）に新パスワードを入力するため、
    // セッションがあってもこの画面からは追い出さない。
    const onResetPassword = inAuthGroup && segments[1] === 'reset-password';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup && !onResetPassword) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  // セッション確認中はスプラッシュ相当のローディング
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="expense-input" options={{ presentation: 'modal' }} />
      <Stack.Screen name="pairing" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <StatusBar style="auto" />
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
