/**
 * Supabase クライアント。
 * モックモード時は null。実データ運用時のみ生成する。
 * セッションは AsyncStorage に保存し、自動更新を有効化する。
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV, IS_MOCK } from './env';

function createSupabase(): SupabaseClient | null {
  if (IS_MOCK) return null;
  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient | null = createSupabase();

/** Supabase が必須の箇所で使う。モック時に呼ばれたら明確に失敗させる。 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured (mock mode). See SUPABASE_SETUP.md.');
  }
  return supabase;
}
