/**
 * アプリのフォアグラウンド復帰時にサーバー状態を同期するフック。
 *
 * セッション（ペア成立/解除・負担割合など相手側の操作で変わる情報）は
 * staleTime: Infinity のため、放置するとパートナーの変更が反映されない。
 * 復帰のたびにセッション・通知・ペア申請を invalidate して追従させる。
 *
 * あわせて Supabase のトークン自動更新を AppState に連動させる
 * （バックグラウンド中はタイマーを止め、復帰時に再開＝RN 推奨構成）。
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

export function useAppStateSync(): void {
  const qc = useQueryClient();

  useEffect(() => {
    // 起動時にも自動更新を開始しておく（AppState は起動直後 'active' イベントを発火しないため）。
    supabase?.auth.startAutoRefresh();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase?.auth.startAutoRefresh();
        qc.invalidateQueries({ queryKey: queryKeys.session });
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['pair-requests'] });
      } else {
        supabase?.auth.stopAutoRefresh();
      }
    });

    return () => {
      sub.remove();
      supabase?.auth.stopAutoRefresh();
    };
  }, [qc]);
}
