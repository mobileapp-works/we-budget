/**
 * アプリ全体の Provider 群をまとめる。
 * GestureHandler > SafeArea > QueryClient > Toast の順でラップし、
 * 言語設定（preferences）を i18n に同期する。
 */
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { applyLanguage } from '@/lib/i18n';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useAdsInit } from '@/hooks/useAdsInit';
import { ToastProvider } from './ToastProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const language = usePreferencesStore((s) => s.language);

  // 起動時に広告の同意フロー（UMP）と AdMob 初期化を実行（対応環境のみ）
  useAdsInit();

  // 言語設定が変わったら i18n を切り替える
  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
