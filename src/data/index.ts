/**
 * データアクセスのエントリポイント。
 * 画面・フックは `backend` だけを参照する（実体の差し替えを容易にするため）。
 *
 * 現在: モック実装（インメモリ）。Supabase 構築（Phase 4 / SUPABASE_SETUP.md）後に
 *       supabaseBackend を実装し、IS_MOCK で分岐する。
 */
import { mockBackend } from './mockBackend';
import type { Backend } from './backend';

// TODO(Phase4): Supabase 構築後に下記へ差し替える
//   import { IS_MOCK } from '@/lib/env';
//   import { supabaseBackend } from './supabaseBackend';
//   export const backend: Backend = IS_MOCK ? mockBackend : supabaseBackend;
export const backend: Backend = mockBackend;

export * from './backend';
