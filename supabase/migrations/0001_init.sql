-- WeBudget 初期マイグレーション
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行、
--           または `supabase db push`（CLIで link 済みの場合）。
-- 出典: docs/design.md / docs/SUPABASE_SETUP.md

create extension if not exists "pgcrypto";

-- =========================================================
-- テーブル
-- =========================================================

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  user1_id uuid references auth.users(id) on delete set null,
  user2_id uuid references auth.users(id) on delete set null,
  split_ratio_user1 integer not null default 50 check (split_ratio_user1 between 1 and 99),
  split_ratio_user2 integer not null default 50 check (split_ratio_user2 between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint split_sum_100 check (split_ratio_user1 + split_ratio_user2 = 100)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ユーザー',
  avatar_url text,
  pair_id uuid not null references pairs(id),
  expo_push_token text,
  language text not null default 'auto',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  ai_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  name text,
  name_key text,
  icon text not null,
  color text not null,
  is_default boolean not null default false,
  is_hidden boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint name_or_key check (name is not null or name_key is not null)
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  settled_by uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'JPY',
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists fixed_costs (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  type text not null check (type in ('fixed','variable')),
  amount numeric(12,2) check (amount > 0),
  currency text not null default 'JPY',
  payer_user_id uuid references auth.users(id) on delete set null,
  is_shared_payment boolean not null default false,
  billing_day integer not null check (billing_day between 1 and 31),
  reminder_day integer check (reminder_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fixed_needs_amount check (type <> 'fixed' or amount is not null)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  recorded_by uuid references auth.users(id) on delete set null,
  category_id uuid not null references categories(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'JPY',
  payer_user_id uuid references auth.users(id) on delete set null,
  is_shared_payment boolean not null default false,
  settlement_id uuid references settlements(id) on delete set null,
  expense_date date not null,
  description text,
  store_name text,
  receipt_image_url text,
  is_fixed_cost boolean not null default false,
  fixed_cost_id uuid references fixed_costs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payer_xor_shared check (
    (is_shared_payment = true and payer_user_id is null) or
    (is_shared_payment = false and payer_user_id is not null)
  )
);

create table if not exists shared_account (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal')),
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'JPY',
  description text,
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'JPY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists budgets_overall_uniq on budgets (pair_id) where category_id is null;
create unique index if not exists budgets_category_uniq on budgets (pair_id, category_id) where category_id is not null;

create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  from_currency text not null,
  to_currency text not null default 'JPY',
  rate numeric(12,6) not null check (rate > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, from_currency, to_currency)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pair_id uuid not null references pairs(id) on delete cascade,
  type text not null check (type in (
    'expense_added','expense_edited','expense_deleted','settlement',
    'reminder_variable','budget_warning','budget_exceeded','settlement_reminder')),
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  expense_added boolean not null default true,
  expense_edited boolean not null default true,
  expense_deleted boolean not null default true,
  settlement boolean not null default true,
  reminder_variable boolean not null default true,
  budget_alert boolean not null default true,
  settlement_reminder boolean not null default true
);

-- インデックス
create index if not exists expenses_pair_date on expenses (pair_id, expense_date desc) where deleted_at is null;
create index if not exists expenses_pair_settlement on expenses (pair_id, settlement_id) where deleted_at is null;
create unique index if not exists expenses_fixed_month
  on expenses (fixed_cost_id, (date_trunc('month', expense_date::timestamp)))
  where fixed_cost_id is not null and deleted_at is null;
create index if not exists fixed_costs_pair on fixed_costs (pair_id) where deleted_at is null;
create index if not exists notifications_user on notifications (user_id, created_at desc);
