-- =========================================================
-- 0015: 多通貨対応（基準通貨 + 支出ごとレート）
--
-- 目的（海外利用）:
--   ペアごとに「基準通貨(base_currency)」を持ち、レポート・予算・精算をすべて
--   その通貨で集計・表示する。各支出は記録時に基準通貨へ換算した base_amount を
--   保持するため、集計は exchange_rates を引かずに base_amount を合計するだけでよい。
--
-- 後方互換（デグレ防止）:
--   既存データはすべて JPY。base_currency は default 'JPY'、expenses は
--   exchange_rate=1 / base_amount=amount を backfill するため、集計・精算・予算
--   アラートの戻り値は現行と完全一致する（sum(base_amount) = sum(amount)）。
--
-- 基準通貨の変更:
--   set_base_currency(通貨, レート) で、旧→新レートにより過去の
--   expenses / budgets / fixed_costs / shared_account を一括再換算する。
--   確定済み settlements は当時の通貨で凍結（再換算しない）。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- 1) カラム追加 + backfill（非破壊）
-- ---------------------------------------------------------
alter table pairs    add column if not exists base_currency text not null default 'JPY';
alter table expenses add column if not exists exchange_rate numeric(18,8) not null default 1;
alter table expenses add column if not exists base_amount   numeric not null default 0;

-- 既存行は全て JPY・レート1想定。base_amount を amount で埋める（冪等）。
update expenses set base_amount = amount where base_amount = 0;

-- ---------------------------------------------------------
-- 2) 立替残高（base_amount 合計・通貨は pairs.base_currency）
--    0014 のメンバーチェックは維持。unconvertedCurrencies は廃止（常に []）。
-- ---------------------------------------------------------
create or replace function calculate_settlement_balance(p_pair_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  u1 uuid; u2 uuid; r1 int; base text; v_dec int;
  u1_paid numeric := 0; u2_paid numeric := 0; total numeric; bal numeric;
begin
  -- 認証ユーザーは自分のペアのみ照会可（cron/内部 definer 呼び出しは auth.uid() が NULL で通過）
  if auth.uid() is not null and get_my_pair_id() is distinct from p_pair_id then
    raise exception 'forbidden';
  end if;

  select user1_id, user2_id, split_ratio_user1, coalesce(base_currency, 'JPY')
    into u1, u2, r1, base
  from pairs where id = p_pair_id;
  v_dec := case when base in ('JPY', 'KRW') then 0 else 2 end;

  if u2 is null then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency',base,'unconvertedCurrencies','[]'::json);
  end if;

  select
    coalesce(sum(case when payer_user_id = u1 then base_amount else 0 end),0),
    coalesce(sum(case when payer_user_id = u2 then base_amount else 0 end),0)
  into u1_paid, u2_paid
  from expenses e
  where e.pair_id = p_pair_id and e.settlement_id is null and e.is_shared_payment = false
    and e.deleted_at is null and e.payer_user_id in (u1, u2);

  total := u1_paid + u2_paid;
  if total = 0 then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency',base,'unconvertedCurrencies','[]'::json);
  end if;
  bal := u1_paid - (total * r1 / 100.0);
  return json_build_object(
    'settlementAmount', round(abs(bal), v_dec),
    'fromUserId', case when bal > 0 then u2 else u1 end,
    'toUserId',   case when bal > 0 then u1 else u2 end,
    'currency', base,
    'unconvertedCurrencies', '[]'::json);
end; $$;

-- 0014 と同じく anon/public からは実行不可（CREATE OR REPLACE で付与が復活しうるため再適用）。
revoke execute on function calculate_settlement_balance(uuid) from public, anon;
grant execute on function calculate_settlement_balance(uuid) to authenticated;

-- ---------------------------------------------------------
-- 3) 精算確定（base_amount 合計・通貨は base_currency）
--    全支出が base_amount を持つため、旧「レート未設定は除外」条件は不要。
-- ---------------------------------------------------------
create or replace function execute_settlement(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements; u1 uuid; u2 uuid; base text;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  b := calculate_settlement_balance(p_pair_id);
  if (b->>'settlementAmount')::numeric <= 0 then raise exception 'nothing to settle'; end if;
  select user1_id, user2_id, coalesce(base_currency, 'JPY') into u1, u2, base from pairs where id = p_pair_id;
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), (b->>'settlementAmount')::numeric, base, (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  -- calculate_settlement_balance の集計対象と同一条件でスタンプする
  update expenses e set settlement_id = s.id
    where e.pair_id = p_pair_id
      and e.settlement_id is null
      and e.is_shared_payment = false
      and e.deleted_at is null
      and e.payer_user_id in (u1, u2);
  return s;
end; $$;

-- ---------------------------------------------------------
-- 4) 予算アラート（当月の base_amount 合計で使用率を評価）
--    0011 の挙動を踏襲し、換算部分のみ base_amount に置換。
-- ---------------------------------------------------------
create or replace function check_budget_alerts(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
  u1 uuid; u2 uuid;
  b record;
  v_used numeric; v_pct numeric; v_body text; v_inserted int;
begin
  select user1_id, user2_id into u1, u2 from pairs where id = p_pair_id and deleted_at is null;
  if u1 is null and u2 is null then return; end if;

  for b in
    select bg.id, bg.category_id, bg.amount,
           coalesce(
             c.name,
             case c.name_key
               when 'category.food'          then '食費'
               when 'category.daily'         then '日用品'
               when 'category.transport'     then '交通費'
               when 'category.entertainment' then '娯楽'
               when 'category.utilities'     then '光熱費'
               when 'category.rent'          then '家賃'
               when 'category.telecom'       then '通信費'
               when 'category.medical'       then '医療'
               when 'category.other'         then 'その他'
               else c.name_key
             end
           ) as label
    from budgets bg
    left join categories c on c.id = bg.category_id
    where bg.pair_id = p_pair_id and bg.amount > 0
  loop
    -- 当月支出の base_amount 合計（クライアント calculateBudgetUsage と同一条件）
    select coalesce(sum(e.base_amount), 0)
      into v_used
    from expenses e
    where e.pair_id = p_pair_id
      and e.deleted_at is null
      and date_trunc('month', e.expense_date)::date = v_month
      and (b.category_id is null or e.category_id = b.category_id);

    v_pct := v_used * 100.0 / b.amount;
    if v_pct < 80 then continue; end if;

    if v_pct >= 100 then
      insert into budget_alerts (pair_id, budget_id, month, threshold)
        values (p_pair_id, b.id, v_month, 80)
        on conflict (budget_id, month, threshold) do nothing;
      insert into budget_alerts (pair_id, budget_id, month, threshold)
        values (p_pair_id, b.id, v_month, 100)
        on conflict (budget_id, month, threshold) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        v_body := case when b.category_id is null
          then '今月の全体予算を超過しました。'
          else '「' || b.label || '」の今月の予算を超過しました。' end;
        perform notify_user(u1, p_pair_id, 'budget_exceeded', '予算を超過しました', v_body);
        perform notify_user(u2, p_pair_id, 'budget_exceeded', '予算を超過しました', v_body);
      end if;
    else
      insert into budget_alerts (pair_id, budget_id, month, threshold)
        values (p_pair_id, b.id, v_month, 80)
        on conflict (budget_id, month, threshold) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        v_body := case when b.category_id is null
          then '今月の全体予算の80%に達しました。'
          else '「' || b.label || '」の今月の予算が80%に達しました。' end;
        perform notify_user(u1, p_pair_id, 'budget_warning', '予算の80%に達しました', v_body);
        perform notify_user(u2, p_pair_id, 'budget_warning', '予算の80%に達しました', v_body);
      end if;
    end if;
  end loop;
end; $$;

-- ---------------------------------------------------------
-- 5) 月末精算リマインド（通貨記号 ¥ 固定を外し、金額のみに）
-- ---------------------------------------------------------
create or replace function send_settlement_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last  date := (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date;
  r record; b json; v_amount numeric; v_body text; v_count int := 0;
begin
  if v_today <> v_last then return 0; end if; -- 月末日のみ実行

  for r in
    select id, user1_id, user2_id from pairs
    where deleted_at is null and user1_id is not null and user2_id is not null
  loop
    b := calculate_settlement_balance(r.id);
    v_amount := (b->>'settlementAmount')::numeric;
    if v_amount > 0 then
      v_body := '未精算の立替が ' || to_char(v_amount, 'FM999,999,999,999.##') || ' ' || coalesce(b->>'currency','JPY')
             || ' あります。今月分を精算しましょう。';
      perform notify_user(r.user1_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body);
      perform notify_user(r.user2_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;

-- ---------------------------------------------------------
-- 6) 固定費の月次自動計上（exchange_rate=1 / base_amount=amount を付与）
--    固定費は基準通貨で登録される前提（外貨固定費は非対応）。
-- ---------------------------------------------------------
create or replace function post_fixed_expenses()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last  int  := extract(day from (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day'))::int;
  v_dom   int  := extract(day from v_today)::int;
  v_count int;
begin
  insert into expenses (
    pair_id, recorded_by, category_id, amount, currency, exchange_rate, base_amount,
    payer_user_id, is_shared_payment, expense_date, description,
    is_fixed_cost, fixed_cost_id
  )
  select
    fc.pair_id, null, fc.category_id, fc.amount, fc.currency, 1, fc.amount,
    case when fc.is_shared_payment then null else fc.payer_user_id end,
    fc.is_shared_payment, v_today, fc.name,
    true, fc.id
  from fixed_costs fc
  join pairs p on p.id = fc.pair_id and p.deleted_at is null
  where fc.deleted_at is null
    and fc.is_active = true
    and fc.type = 'fixed'
    and fc.amount is not null and fc.amount > 0
    and (fc.is_shared_payment = true or fc.payer_user_id is not null)
    and v_dom = least(fc.billing_day, v_last)
    and not exists (
      select 1 from expenses e
      where e.fixed_cost_id = fc.id
        and e.deleted_at is null
        and date_trunc('month', e.expense_date) = date_trunc('month', v_today)
    );
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- 内部専用関数の EXECUTE 権限を再剥奪（0012 と同方針。CREATE OR REPLACE で復活しうるため）。
revoke execute on function check_budget_alerts(uuid) from public, anon, authenticated;
revoke execute on function send_settlement_reminders() from public, anon, authenticated;
revoke execute on function post_fixed_expenses() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 7) 基準通貨の変更 + 全履歴の再換算
--    p_rate = 「1 旧基準 = p_rate 新基準」。確定済み settlements は凍結。
-- ---------------------------------------------------------
create or replace function set_base_currency(p_currency text, p_rate numeric)
returns pairs language plpgsql security definer set search_path = public as $$
declare
  v_pair uuid := get_my_pair_id();
  v_old text;
  v_dec int := case when p_currency in ('JPY', 'KRW') then 0 else 2 end;
  p pairs;
begin
  if v_pair is null then raise exception 'forbidden'; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'invalid rate'; end if;
  select base_currency into v_old from pairs where id = v_pair;

  if v_old is distinct from p_currency then
    -- 支出: base_amount と exchange_rate を新基準へ。amount / currency（原取引）は不変。
    update expenses set
      base_amount = round(base_amount * p_rate, v_dec),
      exchange_rate = exchange_rate * p_rate
    where pair_id = v_pair and deleted_at is null;

    -- 予算 / 固定費 / 共同口座は基準通貨建て。金額を換算し通貨コードも更新。
    update budgets set amount = round(amount * p_rate, v_dec), currency = p_currency
    where pair_id = v_pair;

    update fixed_costs set
      amount = case when amount is null then null else round(amount * p_rate, v_dec) end,
      currency = p_currency
    where pair_id = v_pair and deleted_at is null;

    update shared_account set amount = round(amount * p_rate, v_dec), currency = p_currency
    where pair_id = v_pair and deleted_at is null;
  end if;

  update pairs set base_currency = p_currency, updated_at = now() where id = v_pair
    returning * into p;
  return p;
end; $$;

revoke execute on function set_base_currency(text, numeric) from public, anon;
grant execute on function set_base_currency(text, numeric) to authenticated;
