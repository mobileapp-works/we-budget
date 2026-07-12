-- =========================================================
-- 0019: Sign in with Apple のリフレッシュトークン保管
--
-- Apple のアカウント削除要件: Sign in with Apple を使うアプリは、アカウント削除時に
-- Apple の revoke エンドポイントでトークンを失効させる必要がある。
-- そのためにサインイン時に取得した authorization_code を refresh_token へ交換して
-- ここに保管し、delete-account Edge Function から revoke に使う。
--
-- このテーブルは service_role（Edge Function）専用。RLS 有効＋ポリシー無しで
-- 一般クライアント（anon/authenticated）からは一切アクセスできない。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================
create table if not exists apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table apple_tokens enable row level security;
-- ポリシーを作らない = service_role 以外は RLS で全拒否。クライアントは触らせない。
revoke all on table apple_tokens from anon, authenticated;
