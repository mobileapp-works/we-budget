/**
 * ルートレイアウト。Provider 群で全体を包み、セッションに応じて認証/メインを出し分ける。
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { ErrorBoundary } from '@/components';
import { useSession } from '@/hooks';
import { useTheme } from '@/hooks/useTheme';
import '@/lib/i18n'; // i18n の初期化（副作用）

function RootNavigator() {
  const { data: session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  // セッション状態に応じてリダイレクト（未ログイン→認証 / ログイン済み→メイン）
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
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
