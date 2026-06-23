/**
 * データアクセスのエントリポイント。
 * 画面・フックは `backend` だけを参照する（実体の差し替えを容易にするため）。
 *
 * EXPO_PUBLIC_USE_MOCK=true（またはSupabase未設定）→ モック。
 * false かつ接続情報あり → Supabase 実装。
 */
import { IS_MOCK } from '@/lib/env';
import { mockBackend } from './mockBackend';
import { supabaseBackend } from './supabaseBackend';
import type { Backend } from './backend';

export const backend: Backend = IS_MOCK ? mockBackend : supabaseBackend;

export * from './backend';
