-- WeBudget: RLS / ヘルパー / トリガー / RPC
-- 出典: docs/design.md / docs/SUPABASE_SETUP.md

-- =========================================================
-- ヘルパー（RLSの無限再帰を避けるため SECURITY DEFINER）
-- =========================================================
create or replace function get_my_pair_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pair_id from profiles where id = auth.uid();
$$;

-- updated_at 自動更新
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger t_pairs_updated before update on pairs for each row execute function touch_updated_at();
create trigger t_profiles_updated before update on profiles for each row execute function touch_updated_at();
create trigger t_expenses_updated before update on expenses for each row execute function touch_updated_at();
create trigger t_fixed_costs_updated before update on fixed_costs for each row execute function touch_updated_at();
create trigger t_shared_updated before update on shared_account for each row execute function touch_updated_at();
create trigger t_budgets_updated before update on budgets for each row execute function touch_updated_at();
create trigger t_rates_updated before update on exchange_rates for each row execute function touch_updated_at();

-- =========================================================
-- 新規ユーザー: profiles + ソロpair + デフォルトカテゴリ + 通知設定
-- =========================================================
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

  -- デフォルトカテゴリ（src/constants/categories.ts と一致させる）
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- RLS 有効化
-- =========================================================
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

-- profiles
create policy profiles_select on profiles for select
  using (id = auth.uid() or pair_id = get_my_pair_id());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- pairs
create policy pairs_select on pairs for select using (id = get_my_pair_id());
create policy pairs_update on pairs for update using (id = get_my_pair_id());

-- categories（デフォルトは削除不可）
create policy categories_select on categories for select using (pair_id = get_my_pair_id());
create policy categories_insert on categories for insert with check (pair_id = get_my_pair_id());
create policy categories_update on categories for update using (pair_id = get_my_pair_id());
create policy categories_delete on categories for delete using (pair_id = get_my_pair_id() and is_default = false);

-- expenses（自分のペア or 自分が記録した分＝解除後も閲覧可。要件7-10）
create policy expenses_select on expenses for select using (pair_id = get_my_pair_id() or recorded_by = auth.uid());
create policy expenses_insert on expenses for insert with check (pair_id = get_my_pair_id());
create policy expenses_update on expenses for update using (pair_id = get_my_pair_id());
create policy expenses_delete on expenses for delete using (pair_id = get_my_pair_id());

-- fixed_costs / shared_account / budgets / exchange_rates（共通: 自分のペア）
create policy fixed_costs_all on fixed_costs for all using (pair_id = get_my_pair_id()) with check (pair_id = get_my_pair_id());
create policy shared_account_all on shared_account for all using (pair_id = get_my_pair_id()) with check (pair_id = get_my_pair_id());
create policy budgets_all on budgets for all using (pair_id = get_my_pair_id()) with check (pair_id = get_my_pair_id());
create policy exchange_rates_all on exchange_rates for all using (pair_id = get_my_pair_id()) with check (pair_id = get_my_pair_id());

-- settlements（参照のみ。作成は RPC=SECURITY DEFINER 経由）
create policy settlements_select on settlements for select using (pair_id = get_my_pair_id());

-- notifications（自分宛のみ閲覧・既読更新。作成はサーバー側トリガー/関数）
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_settings（自分のみ）
create policy notif_settings_all on notification_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 立替精算 RPC
-- =========================================================
create or replace function calculate_settlement_balance(p_pair_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  u1 uuid; u2 uuid; r1 int;
  u1_paid numeric := 0; u2_paid numeric := 0; total numeric; bal numeric;
  unconv text[];
begin
  select user1_id, user2_id, split_ratio_user1 into u1, u2, r1 from pairs where id = p_pair_id;
  if u2 is null then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency','JPY','unconvertedCurrencies','[]'::json);
  end if;

  -- レート未設定の外貨を収集（警告用）
  select coalesce(array_agg(distinct e.currency),'{}') into unconv
  from expenses e
  where e.pair_id = p_pair_id and e.settlement_id is null and e.is_shared_payment = false and e.deleted_at is null
    and e.currency <> 'JPY'
    and not exists (select 1 from exchange_rates r where r.pair_id = p_pair_id and r.from_currency = e.currency and r.to_currency = 'JPY');

  select
    coalesce(sum(case when payer_user_id = u1 then amount_jpy else 0 end),0),
    coalesce(sum(case when payer_user_id = u2 then amount_jpy else 0 end),0)
  into u1_paid, u2_paid
  from (
    select e.payer_user_id,
      case when e.currency = 'JPY' then e.amount
           else e.amount * (select rate from exchange_rates r
                            where r.pair_id = p_pair_id and r.from_currency = e.currency and r.to_currency = 'JPY')
      end as amount_jpy
    from expenses e
    where e.pair_id = p_pair_id and e.settlement_id is null and e.is_shared_payment = false
      and e.deleted_at is null and e.payer_user_id in (u1,u2)
  ) t
  where amount_jpy is not null;

  total := u1_paid + u2_paid;
  if total = 0 then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency','JPY','unconvertedCurrencies', to_json(unconv));
  end if;
  bal := u1_paid - (total * r1 / 100.0);
  return json_build_object(
    'settlementAmount', round(abs(bal)),
    'fromUserId', case when bal > 0 then u2 else u1 end,
    'toUserId',   case when bal > 0 then u1 else u2 end,
    'currency','JPY',
    'unconvertedCurrencies', to_json(unconv));
end; $$;

create or replace function execute_settlement(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  b := calculate_settlement_balance(p_pair_id);
  if (b->>'settlementAmount')::numeric <= 0 then raise exception 'nothing to settle'; end if;
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), (b->>'settlementAmount')::numeric, 'JPY', (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  update expenses set settlement_id = s.id
    where pair_id = p_pair_id and settlement_id is null and is_shared_payment = false and deleted_at is null;
  return s;
end; $$;

-- =========================================================
-- ペア操作 RPC
-- =========================================================
create or replace function join_pair(p_invite_code text)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from pairs where invite_code = p_invite_code and user2_id is null and deleted_at is null;
  if target is null then raise exception 'invalid invite code'; end if;
  if target = get_my_pair_id() then raise exception 'cannot join own pair'; end if;
  update pairs set user2_id = auth.uid() where id = target;
  update profiles set pair_id = target where id = auth.uid();
end; $$;

create or replace function leave_pair(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare new_pair uuid; code text;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  update pairs set deleted_at = now() where id = p_pair_id;
  code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  insert into pairs (invite_code, user1_id) values (code, auth.uid()) returning id into new_pair;
  update profiles set pair_id = new_pair where id = auth.uid();
end; $$;

create or replace function update_split_ratio(p_user1_percent int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user1_percent < 1 or p_user1_percent > 99 then raise exception 'invalid ratio'; end if;
  update pairs set split_ratio_user1 = p_user1_percent, split_ratio_user2 = 100 - p_user1_percent
    where id = get_my_pair_id();
end; $$;

-- =========================================================
-- パートナー通知（アプリ内通知。プッシュ配信は Edge Function 側で実装）
-- =========================================================
create or replace function notify_partner(p_pair_id uuid, p_actor uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare partner uuid; allow boolean;
begin
  select case when user1_id = p_actor then user2_id else user1_id end into partner from pairs where id = p_pair_id;
  if partner is null then return; end if;
  -- 受信者の通知設定を尊重
  select case p_type
    when 'expense_added' then expense_added
    when 'expense_edited' then expense_edited
    when 'expense_deleted' then expense_deleted
    when 'settlement' then settlement
    else true end into allow
  from notification_settings where user_id = partner;
  if allow is distinct from true then return; end if;
  insert into notifications (user_id, pair_id, type, title, body) values (partner, p_pair_id, p_type, p_title, p_body);
end; $$;

create or replace function on_expense_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    perform notify_partner(new.pair_id, new.recorded_by, 'expense_added', 'パートナーが支出を記録', '新しい支出が記録されました');
  elsif (tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null) then
    perform notify_partner(new.pair_id, auth.uid(), 'expense_deleted', '支出が削除されました', '支出が削除されました');
  elsif (tg_op = 'UPDATE') then
    perform notify_partner(new.pair_id, auth.uid(), 'expense_edited', '支出が編集されました', '支出が編集されました');
  end if;
  return new;
end; $$;

create trigger t_expense_notify after insert or update on expenses
  for each row execute function on_expense_change();
