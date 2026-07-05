# Supabase 構築手順書（WeBudget）

このアプリは現在 **モックモード**（`EXPO_PUBLIC_USE_MOCK=true`）で動作する。
本番データで動かすには、以下の手順で Supabase を構築し、`supabaseBackend` を実装する。

設計の正は [design.md](design.md)。本書はそれを実行可能なSQL/設定に落としたもの。

> ✅ **コード側は実装済み**: SQLは `supabase/migrations/0001〜0006.sql` に、Edge Function雛形は `supabase/functions/` に、
> アプリの実データ接続は `src/data/supabaseBackend.ts` に用意済み。`src/data/index.ts` は `EXPO_PUBLIC_USE_MOCK`
> で mock/supabase を自動切替する。**あなたの作業は下記 1〜4（＋8）だけ**。

---

## 0. 全体の流れ（チェックリスト）

あなたがやる作業:
- [ ] 1. Supabase プロジェクト作成（下記の画面ガイド参照）
- [ ] 2. 環境変数（URL / anon key）を `.env` に設定 → `EXPO_PUBLIC_USE_MOCK=false`
- [ ] 3. SQL を実行（SQL Editor に `supabase/migrations/0001→0002→0003` を順に貼って実行）
- [ ] 4. Auth プロバイダ（Email は既定でON。**Apple / Google は §7.1 の手順**でネイティブ有効化＋dev build 再作成）
- [ ] 8.（任意・後で）Edge Functions をデプロイ（OCR / Push / アカウント削除）

実装済み（あなたの作業不要）:
- [x] スキーマ + 制約 + インデックス（0001）
- [x] RLS + `get_my_pair_id()` + トリガー（updated_at / 新規ユーザー / パートナー通知）+ RPC（精算・ペア）（0002）
- [x] Storage バケット + ポリシー（0003）
- [x] アプリ側 `supabaseBackend`（mock/supabase 自動切替）

### プロジェクト作成画面の入力ガイド
- **Project name**: `we-budget`（任意）
- **Database password**: 「Generate a password」で生成し、**安全な場所に保存**（CLI/直接DB接続で必要）
- **Region**: `Northeast Asia (Tokyo)` を選択（日本向けに低遅延）
- **Security**:
  - Enable Data API ✅（supabase-js に必要）
  - Automatically expose new tables ✅のままでOK（全テーブルにRLSを張るので保護される）
  - Enable automatic RLS は任意（SQLで明示的にRLSを有効化するので不要）
- 作成後、**Project Settings > API** で `Project URL` と `anon public` key を取得 → `.env` へ。

---

## 1. プロジェクト作成・環境変数

1. https://dashboard.supabase.com でプロジェクト作成（リージョンは Tokyo 推奨）。
2. Project Settings > API から `Project URL` と `anon public` key を取得。
3. ルートの `.env` に設定（**anon key のみ。service_role key はクライアントに置かない**）:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_USE_MOCK=false
```

---

## 2. スキーマ SQL

SQL Editor で実行する（`supabase/migrations/0001_init.sql` として管理推奨）。
DBは snake_case。アプリ側 camelCase との変換は `supabaseBackend` のマッパーで行う。

```sql
-- 拡張
create extension if not exists "pgcrypto";

-- ペア
create table pairs (
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

-- プロフィール
create table profiles (
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

-- カテゴリ（pair作成時に複製）
create table categories (
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

-- 精算（先に作る: expenses が参照するため）
create table settlements (
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

-- 固定費
create table fixed_costs (
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

-- 支出
create table expenses (
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

-- 共同口座
create table shared_account (
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

-- 予算
create table budgets (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'JPY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 全体予算(category_id null)は1件に制限
create unique index budgets_overall_uniq on budgets (pair_id) where category_id is null;
create unique index budgets_category_uniq on budgets (pair_id, category_id) where category_id is not null;

-- 為替レート
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  from_currency text not null,
  to_currency text not null default 'JPY',
  rate numeric(12,6) not null check (rate > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pair_id, from_currency, to_currency)
);

-- 通知
create table notifications (
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

-- 通知設定
create table notification_settings (
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
create index expenses_pair_date on expenses (pair_id, expense_date desc) where deleted_at is null;
create index expenses_pair_settlement on expenses (pair_id, settlement_id) where deleted_at is null;
create unique index expenses_fixed_month
  on expenses (fixed_cost_id, (date_trunc('month', expense_date::timestamp)))
  where fixed_cost_id is not null and deleted_at is null;
create index fixed_costs_pair on fixed_costs (pair_id) where deleted_at is null;
create index notifications_user on notifications (user_id, created_at desc);
```

---

## 3. RLS（Row Level Security）

```sql
-- 自分の pair_id を返すヘルパー（RLSの無限再帰回避のため SECURITY DEFINER）
create or replace function get_my_pair_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pair_id from profiles where id = auth.uid();
$$;

-- 全テーブルで RLS 有効化
alter table pairs enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table fixed_costs enable row level security;
alter table settlements enable row level security;
alter table shared_account enable row level security;
alter table budgets enable row level security;
alter table exchange_rates enable row level security;
alter table notifications enable row level security;
alter table notification_settings enable row level security;

-- profiles: 自分 + 同じペアのパートナー閲覧可
create policy profiles_select on profiles for select
  using (id = auth.uid() or pair_id = get_my_pair_id());
create policy profiles_update on profiles for update using (id = auth.uid());

-- pairs: 自分が属するペア
create policy pairs_select on pairs for select
  using (id = get_my_pair_id());
create policy pairs_update on pairs for update using (id = get_my_pair_id());

-- pair配下テーブル共通パターン（categories/expenses/fixed_costs/shared_account/budgets/exchange_rates/settlements）
-- 例: expenses（SELECTは自分のペア「または自分が記録した分」＝解除後も閲覧可、要件7-10）
create policy expenses_select on expenses for select
  using (pair_id = get_my_pair_id() or recorded_by = auth.uid());
create policy expenses_insert on expenses for insert
  with check (pair_id = get_my_pair_id());
create policy expenses_update on expenses for update
  using (pair_id = get_my_pair_id());
create policy expenses_delete on expenses for delete
  using (pair_id = get_my_pair_id());

-- 他の pair配下テーブルは pair_id = get_my_pair_id() で select/insert/update/delete を作成
-- categories は is_default=true の DELETE を禁止（is_hidden で対応）:
create policy categories_select on categories for select using (pair_id = get_my_pair_id());
create policy categories_insert on categories for insert with check (pair_id = get_my_pair_id());
create policy categories_update on categories for update using (pair_id = get_my_pair_id());
create policy categories_delete on categories for delete using (pair_id = get_my_pair_id() and is_default = false);

-- settlements は INSERT/SELECT のみ（更新・削除なし）。INSERTはRPC(SECURITY DEFINER)経由を推奨。
create policy settlements_select on settlements for select using (pair_id = get_my_pair_id());

-- notifications: 自分宛のみ。INSERTはサーバー（service_role / SECURITY DEFINER）のみ。
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid());

create policy notif_settings_all on notification_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

> 残りの pair配下テーブル（fixed_costs / shared_account / budgets / exchange_rates）も
> expenses と同じ4ポリシー（select/insert/update/delete を `pair_id = get_my_pair_id()`）を作成する。

---

## 4. トリガー

```sql
-- updated_at 自動更新
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger t_expenses_updated before update on expenses
  for each row execute function touch_updated_at();
-- 同様に fixed_costs / shared_account / pairs / profiles / budgets / exchange_rates にも設定

-- 新規ユーザー: profiles + ソロpair + デフォルトカテゴリ複製を原子的に作成
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_pair_id uuid;
  code text;
begin
  code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  insert into pairs (invite_code, user1_id) values (code, new.id) returning id into new_pair_id;

  insert into profiles (id, display_name, pair_id)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name','ユーザー'), new_pair_id);

  insert into notification_settings (user_id) values (new.id);

  -- デフォルトカテゴリ（icon/color/name_key は constants/categories.ts と一致させる）
  insert into categories (pair_id, name_key, icon, color, is_default, sort_order) values
    (new_pair_id,'category.food','restaurant','#FF7A66',true,0),
    (new_pair_id,'category.daily','cart','#0EA5E9',true,1),
    (new_pair_id,'category.transport','bus','#8B5CF6',true,2),
    (new_pair_id,'category.entertainment','game-controller','#EC4899',true,3),
    (new_pair_id,'category.utilities','flash','#F59E0B',true,4),
    (new_pair_id,'category.rent','home','#14B8A6',true,5),
    (new_pair_id,'category.telecom','wifi','#6366F1',true,6),
    (new_pair_id,'category.medical','medkit','#EF4444',true,7),
    (new_pair_id,'category.other','ellipsis-horizontal','#94A3B8',true,8);
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

> **通知生成トリガー**（expenses/settlements 変更時にパートナーへ notifications 行を作成し、
> Edge Function `send-push-notification` を呼ぶ）と **予算閾値トリガー**（`check_budget_threshold`）は
> design.md の「通知生成パイプライン」に従い別途作成する。受信者の notification_settings を参照しOFFならスキップ。

---

## 5. RPC（精算・ペア操作）

```sql
-- 立替残高の計算（未精算・個人払いを集計、外貨はレート換算）
create or replace function calculate_settlement_balance(p_pair_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  u1 uuid; u2 uuid; r1 int;
  u1_paid numeric := 0; u2_paid numeric := 0; total numeric; bal numeric;
begin
  select user1_id, user2_id, split_ratio_user1 into u1, u2, r1 from pairs where id = p_pair_id;
  if u2 is null then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency','JPY','unconvertedCurrencies', '[]'::json);
  end if;

  select
    coalesce(sum(case when payer_user_id = u1 then amount_jpy else 0 end),0),
    coalesce(sum(case when payer_user_id = u2 then amount_jpy else 0 end),0)
  into u1_paid, u2_paid
  from (
    select e.payer_user_id,
           e.amount * coalesce(
             case when e.currency='JPY' then 1 else (select rate from exchange_rates r
               where r.pair_id=p_pair_id and r.from_currency=e.currency and r.to_currency='JPY') end, 0) as amount_jpy
    from expenses e
    where e.pair_id = p_pair_id and e.settlement_id is null
      and e.is_shared_payment = false and e.deleted_at is null
      and e.payer_user_id in (u1,u2)
  ) t;

  total := u1_paid + u2_paid;
  bal := u1_paid - (total * r1 / 100.0);
  return json_build_object(
    'settlementAmount', round(abs(bal)),
    'fromUserId', case when bal > 0 then u2 else u1 end,
    'toUserId',   case when bal > 0 then u1 else u2 end,
    'currency','JPY','unconvertedCurrencies','[]'::json);
end; $$;

-- 精算実行（settlement作成 + expensesにスタンプ）をトランザクションで
create or replace function execute_settlement(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements;
begin
  b := calculate_settlement_balance(p_pair_id);
  if (b->>'settlementAmount')::numeric <= 0 then raise exception 'nothing to settle'; end if;
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), (b->>'settlementAmount')::numeric, 'JPY',
            (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  update expenses set settlement_id = s.id
    where pair_id = p_pair_id and settlement_id is null and is_shared_payment = false and deleted_at is null;
  return s;
end; $$;

-- ペア参加（RLSを跨ぐため SECURITY DEFINER 必須）
create or replace function join_pair(p_invite_code text)
returns void language plpgsql security definer set search_path = public as $$
declare target_pair uuid;
begin
  select id into target_pair from pairs where invite_code = p_invite_code and user2_id is null and deleted_at is null;
  if target_pair is null then raise exception 'invalid invite code'; end if;
  update pairs set user2_id = auth.uid(), updated_at = now() where id = target_pair;
  update profiles set pair_id = target_pair, updated_at = now() where id = auth.uid();
  -- 参加者のソロ時代データは持ち込まない（MVP方針 / design.md）
end; $$;

-- ペア解除（元pairは読み取り専用化、各自に新ソロpair発行）
create or replace function leave_pair(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare new_pair uuid; code text;
begin
  update pairs set deleted_at = now() where id = p_pair_id;
  code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  insert into pairs (invite_code, user1_id) values (code, auth.uid()) returning id into new_pair;
  update profiles set pair_id = new_pair, updated_at = now() where id = auth.uid();
end; $$;
```

---

## 6. Storage

```sql
-- バケット作成（Dashboard or SQL）
insert into storage.buckets (id, name, public) values ('receipts','receipts',false);
insert into storage.buckets (id, name, public) values ('avatars','avatars',true);
```

- `receipts`（private）: ペアのユーザーのみ読み書き。パスは `{pair_id}/{expense_id}.jpg` 等にし、ポリシーで `pair_id = get_my_pair_id()` を判定。
- `avatars`（public）: 読み取りは public、書き込みは本人のみ（パス `{user_id}.jpg`）。

---

## 7. Auth プロバイダ

- **Email**: 有効化。Confirm email を ON（メール確認フロー）。
- パスワードリセット / メール確認のリダイレクトに `webudget://` を許可リストへ追加。

### 7.1 Apple / Google ログイン（ネイティブ・`signInWithIdToken` 方式）

クライアントはネイティブ SDK で **ID トークン**を取得し、Supabase の `signInWithIdToken` に渡す（Webリダイレクト不要）。
コードは実装済み（`src/lib/oauth.ts` / ログイン画面のボタン）。**dev build 必須**（Expo Go 不可。モックでは押すとデモユーザーでログイン）。

**Apple（iOS）**:
1. Apple Developer の App ID `com.mobileappworks.webudget` で **Sign in with Apple** capability を有効化（app.json は `usesAppleSignIn: true` + `expo-apple-authentication` プラグイン設定済み）。
2. Supabase → Authentication → Providers → **Apple を Enable**。**Authorized Client IDs** に Bundle ID `com.mobileappworks.webudget` を追加（ネイティブはこの値でトークンの aud を検証。Service ID/Secret は web フロー用で今回は不要）。

**Google**:
1. GCP → APIs & Services → Credentials で OAuth クライアントIDを作成:
   - **iOS**（Bundle ID = `com.mobileappworks.webudget`）→ iOS クライアントID と reversed client ID を取得。
   - **Web application** → Web クライアントID/Secret を取得（`webClientId` として使用。Supabase 側の検証にも使う）。
   - （Android 配信するなら Android クライアント: パッケージ名 + SHA-1 も作成）。
2. `app.json` の `@react-native-google-signin/google-signin` プラグインの **`iosUrlScheme`** を reversed iOS client ID（`com.googleusercontent.apps.xxxx`）に置換（現状プレースホルダ `REPLACE_WITH_REVERSED_IOS_CLIENT_ID`）。
3. `.env` に設定: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`（Webクライアント）/ `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`（iOSクライアント）。
4. Supabase → Authentication → Providers → **Google を Enable**。Client ID/Secret に **Web クライアント**を入力し、**Authorized Client IDs** に Web と iOS のクライアントIDを追加。
5. **dev build を再作成**（ネイティブ設定を変えたため）。`eas build --profile development` など。

> まとめ（ユーザー作業）: ①Apple capability + Supabase Apple 有効化 ②GCP で iOS/Web クライアント作成 ③app.json の iosUrlScheme 置換 ④.env に web/ios client id ⑤Supabase Google 有効化 + Authorized Client IDs ⑥dev build 再作成。

---

## 8. Edge Functions（`supabase/functions/`）

| 関数 | 役割 | 備考 |
|------|------|------|
| `send-push-notification` | Expo Push API を呼ぶ | `profiles.expo_push_token` 宛。`notifications` INSERT の Database Webhook から起動（デプロイ済） |
| `delete-account` | `auth.admin.deleteUser` で本人削除 | 共有データは ON DELETE SET NULL で匿名化保持（デプロイ済） |

> レシートOCR用 `ocr-receipt` は端末内OCR（ML Kit）採用により廃止。
> 固定費の月次自動計上・変動固定費リマインドは Edge Function ではなく **pg_cron + DB関数**で実装した（下記 8.5）。

---

## 8.5 固定費 cron（`supabase/migrations/0005_fixed_cost_cron.sql`）

固定費の月次自動計上・変動固定費リマインドは HTTP を挟まず **DB内の plpgsql 関数を pg_cron で日次実行**する。
通知は `notifications` への INSERT がそのまま既存の Database Webhook（→ `send-push-notification`）に乗るため、
アプリ内通知とプッシュ配信が自動で行われる。

- `post_fixed_expenses()`: `type='fixed'` の固定費を、その月の計上日（`billing_day`、月末超過は月末に丸め）に `expenses` へ1件生成。当月既存があればスキップ（`expenses_fixed_month` 部分一意インデックスがバックストップ）。自動計上分は「パートナーが記録」通知を出さない。
- `send_variable_reminders()`: `type='variable'` で当月未入力のものを、リマインド日（`reminder_day`、月末超過は月末丸め）にペア両者へ `reminder_variable` 通知。
- pg_cron ジョブ `webudget_post_fixed_expenses`（UTC 15:00 = JST 00:00）/ `webudget_variable_reminders`（UTC 15:15）を登録。

**やること**:
- [x] SQL Editor で `0005_fixed_cost_cron.sql` を実行（2026-07-05 適用済み。`cron.job` に jobid 1/2 が active で登録済み）。

**動作確認（cronを待たずに手動実行）**:
```sql
-- 登録されたジョブを確認
select jobname, schedule, active from cron.job where jobname like 'webudget_%';

-- その日の計上日/リマインド日に該当する固定費があれば処理される（冪等）
select post_fixed_expenses();     -- 生成した expenses 件数を返す
select send_variable_reminders(); -- 通知した変動固定費 件数を返す

-- 実行履歴（cronが動いた後）
select jobname, status, return_message, start_time
from cron.job_run_details order by start_time desc limit 10;
```
※ `billing_day`/`reminder_day` を「今日（JST）」に一時変更して手動実行すると、当月分の生成/通知を即確認できる。

---

## 9. アプリ側の実装（Phase 4）

1. `supabase gen types typescript --project-id <id> > src/types/database.types.ts` で型生成。
2. `src/data/supabaseBackend.ts` を作成し、`Backend` インターフェースを実装:
   - 各 `list*` は `supabase.from('table').select(...)` + snake→camel マッパー。
   - `addExpense` 等は camel→snake で `insert/update`。`updateExpense` は `.eq('updated_at', expectedUpdatedAt)` で楽観ロック（0件更新なら競合）。
   - `getSettlementBalance` / `executeSettlement` / `joinPair` / `leavePair` は `supabase.rpc(...)`。
   - 認証は `supabase.auth.signInWithPassword` / `signUp` / `signInWithOAuth` / `resetPasswordForEmail`。
3. `src/data/index.ts` を以下に差し替え:

```ts
import { IS_MOCK } from '@/lib/env';
import { mockBackend } from './mockBackend';
import { supabaseBackend } from './supabaseBackend';
export const backend: Backend = IS_MOCK ? mockBackend : supabaseBackend;
```

4. `.env` の `EXPO_PUBLIC_USE_MOCK=false` にして実データで動作確認。

---

## 注意

- service_role key は **絶対にアプリに含めない**（Edge Function の Secret のみ）。
- 金額の計算ロジックはクライアント（`src/utils/settlement.ts`）とサーバー（RPC）の**両方**に存在する。
  表示はクライアント、確定はサーバーRPCで再計算（クライアント値を信用しない）。
- マイグレーションは `supabase/migrations/` でバージョン管理し、`supabase db push` で適用する。
