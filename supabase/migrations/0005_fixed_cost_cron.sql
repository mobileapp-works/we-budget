-- =========================================================
-- 0005: 固定費の月次自動計上 / 変動固定費リマインド（pg_cron）
--
-- 設計（docs/design.md）の Edge Function 案 auto-generate-fixed-expenses /
-- check-variable-reminders を、HTTP を挟まず DB 内の plpgsql 関数 + pg_cron で実装する。
-- 通知は notifications への INSERT がそのまま既存の Database Webhook
-- （on_notification_insert_push → send-push-notification）に乗るため、
-- アプリ内通知とプッシュ配信の両方が自動で行われる。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
--   pg_cron は postgres データベースでのみ動く（SQL Editor は既定で postgres 接続）。
--   `create extension pg_cron` が権限で失敗する場合は
--   Dashboard > Database > Extensions で pg_cron を有効化してから再実行する。
-- =========================================================

-- =========================================================
-- 通知ヘルパー: 受信者の notification_settings を尊重して1件INSERTする。
-- notify_partner の設定ゲートを一本化し、cron 経由の通知でも同じ判定を使う。
-- =========================================================
create or replace function notify_user(p_user uuid, p_pair uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare allow boolean;
begin
  if p_user is null then return; end if;
  select case p_type
    when 'expense_added'       then expense_added
    when 'expense_edited'      then expense_edited
    when 'expense_deleted'     then expense_deleted
    when 'settlement'          then settlement
    when 'reminder_variable'   then reminder_variable
    when 'budget_warning'      then budget_alert
    when 'budget_exceeded'     then budget_alert
    when 'settlement_reminder' then settlement_reminder
    else true end into allow
  from notification_settings where user_id = p_user;
  -- 設定行が無い場合（allow が NULL）は安全側で送らない（既存 notify_partner と同挙動）。
  if allow is distinct from true then return; end if;
  insert into notifications (user_id, pair_id, type, title, body)
    values (p_user, p_pair, p_type, p_title, p_body);
end; $$;

-- 既存 notify_partner を notify_user 経由に付け替え（設定ゲートの二重定義を解消）。
-- シグネチャ・呼び出し側（on_expense_change）は不変。
create or replace function notify_partner(p_pair_id uuid, p_actor uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare partner uuid;
begin
  select case when user1_id = p_actor then user2_id else user1_id end into partner
  from pairs where id = p_pair_id;
  perform notify_user(partner, p_pair_id, p_type, p_title, p_body);
end; $$;

-- 自動計上された固定費（is_fixed_cost=true）の INSERT では
-- 「パートナーが支出を記録」通知を出さない（recorded_by が無く誤解を招くため）。
create or replace function on_expense_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if new.is_fixed_cost then return new; end if;  -- 自動計上は通知しない
    perform notify_partner(new.pair_id, new.recorded_by, 'expense_added', 'パートナーが支出を記録', '新しい支出が記録されました');
  elsif (tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null) then
    perform notify_partner(new.pair_id, auth.uid(), 'expense_deleted', '支出が削除されました', '支出が削除されました');
  elsif (tg_op = 'UPDATE') then
    perform notify_partner(new.pair_id, auth.uid(), 'expense_edited', '支出が編集されました', '支出が編集されました');
  end if;
  return new;
end; $$;

-- =========================================================
-- 固定費の月次自動計上（type='fixed'）。日次実行。
-- その月の計上日（billing_day、月末超過は月末に丸め）に expenses を1件生成する。
-- 冪等性: 当月に同じ fixed_cost の expense が無いときだけ INSERT
--          （expenses_fixed_month 部分一意インデックスがバックストップ）。
-- =========================================================
create or replace function post_fixed_expenses()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last  int  := extract(day from (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day'))::int;
  v_dom   int  := extract(day from v_today)::int;
  v_count int;
begin
  insert into expenses (
    pair_id, recorded_by, category_id, amount, currency,
    payer_user_id, is_shared_payment, expense_date, description,
    is_fixed_cost, fixed_cost_id
  )
  select
    fc.pair_id, null, fc.category_id, fc.amount, fc.currency,
    case when fc.is_shared_payment then null else fc.payer_user_id end,
    fc.is_shared_payment, v_today, fc.name,
    true, fc.id
  from fixed_costs fc
  join pairs p on p.id = fc.pair_id and p.deleted_at is null
  where fc.deleted_at is null
    and fc.is_active = true
    and fc.type = 'fixed'
    and fc.amount is not null and fc.amount > 0
    -- payer_xor_shared を満たせる行だけ（個人払いなのに支払者が居ない＝退会でNULL化 は除外）
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

-- =========================================================
-- 変動固定費リマインド（type='variable'）。日次実行。
-- リマインド日（reminder_day、月末超過は月末に丸め）に当月未入力なら
-- ペアの両者へ reminder_variable 通知を送る（notify_user が設定を尊重）。
-- =========================================================
create or replace function send_variable_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last  int  := extract(day from (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day'))::int;
  v_dom   int  := extract(day from v_today)::int;
  r record;
  v_count int := 0;
begin
  for r in
    select fc.id, fc.name, fc.pair_id, p.user1_id, p.user2_id
    from fixed_costs fc
    join pairs p on p.id = fc.pair_id and p.deleted_at is null
    where fc.deleted_at is null
      and fc.is_active = true
      and fc.type = 'variable'
      and fc.reminder_day is not null
      and v_dom = least(fc.reminder_day, v_last)
      and not exists (
        select 1 from expenses e
        where e.fixed_cost_id = fc.id
          and e.deleted_at is null
          and date_trunc('month', e.expense_date) = date_trunc('month', v_today)
      )
  loop
    perform notify_user(r.user1_id, r.pair_id, 'reminder_variable',
      '変動固定費の入力期限', '「' || r.name || '」の今月分が未入力です。金額を入力してください。');
    perform notify_user(r.user2_id, r.pair_id, 'reminder_variable',
      '変動固定費の入力期限', '「' || r.name || '」の今月分が未入力です。金額を入力してください。');
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

-- 一般ユーザーからの直接実行を禁止（cron=postgres と関数オーナーのみ実行可）。
revoke all on function notify_user(uuid, uuid, text, text, text) from public;
revoke all on function post_fixed_expenses() from public;
revoke all on function send_variable_reminders() from public;

-- =========================================================
-- pg_cron スケジュール登録（毎日 JST 00:00 / 00:15 = UTC 15:00 / 15:15）。
-- 再実行時に重複しないよう、既存ジョブを解除してから登録する。
-- =========================================================
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('webudget_post_fixed_expenses');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('webudget_variable_reminders');
exception when others then null;
end $$;

select cron.schedule('webudget_post_fixed_expenses', '0 15 * * *', $$select public.post_fixed_expenses();$$);
select cron.schedule('webudget_variable_reminders', '15 15 * * *', $$select public.send_variable_reminders();$$);
