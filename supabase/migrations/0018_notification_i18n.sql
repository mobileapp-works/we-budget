-- =========================================================
-- 0018: 通知文の受信者言語別 i18n（ja / en）
--
-- 背景: 通知の title/body が SQL 側で日本語固定だった（英語ユーザーにも日本語）。
-- 方針:
--   - 局所化の頭脳を notify_i18n() に集約する。
--   - 受信者 profiles.language = 'en' のときだけ英語。それ以外（ja / auto）は
--     従来の日本語文字列をそのまま使う＝**日本語パスは現状と完全に同一**（回帰なし）。
--   - 静的な通知（支出追加/編集/削除・精算・ペア承認/拒否）は notify_user を
--     i18n 経由に付け替えるだけで自動的に英語化される（呼び出し側は不変）。
--   - 動的文面を持つ4つ（変動費名 / 予算ラベル / 精算額 / 申請者名）だけ、
--     英語生成に必要な値を jsonb で渡すよう各関数を差し替える。
--     万一 data が無くても英語は日本語文へフォールバックし壊れない。
--
-- プッシュ通知も notifications.title/body を読むため、この置換で自動的に多言語化される。
-- 注: language='auto' はサーバーから端末ロケールを解決できないため日本語にフォールバックする。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- 局所化シンク: 受信者言語に応じて title/body を決めて notifications へ INSERT。
-- 通知設定ゲートは既存 notify_user と同一。
-- ---------------------------------------------------------
create or replace function notify_i18n(
  p_user uuid, p_pair uuid, p_type text,
  p_title_ja text, p_body_ja text, p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  allow boolean;
  lang text;
  v_title text;
  v_body text;
begin
  if p_user is null then return; end if;

  -- 通知設定ゲート（notify_user と同一判定。設定行が無ければ安全側で送らない）
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
  if allow is distinct from true then return; end if;

  select language into lang from profiles where id = p_user;

  if lang = 'en' then
    case p_type
      when 'expense_added'   then v_title := 'New expense';         v_body := 'Your partner added a new expense.';
      when 'expense_edited'  then v_title := 'Expense edited';      v_body := 'An expense was edited.';
      when 'expense_deleted' then v_title := 'Expense deleted';     v_body := 'An expense was deleted.';
      when 'settlement'      then v_title := 'Settled up';          v_body := 'A reimbursement was settled.';
      when 'pair_approved'   then v_title := 'You''re now paired';  v_body := 'Your pair request was approved. Let''s start tracking together!';
      when 'pair_declined'   then v_title := 'Pair request';        v_body := 'Your pair request was not approved.';
      when 'reminder_variable' then
        v_title := 'Variable cost reminder';
        v_body := case when p_data ? 'name'
          then '"' || coalesce(p_data->>'name','') || '" has no entry for this month yet. Please enter the amount.'
          else p_body_ja end;
      when 'pair_request' then
        v_title := 'Pair request';
        v_body := case when p_data ? 'name'
          then coalesce(nullif(p_data->>'name',''), 'Someone') || ' wants to pair with you. Please approve in the app.'
          else p_body_ja end;
      when 'budget_warning' then
        v_title := 'Budget at 80%';
        v_body := case
          when p_data->>'scope' = 'overall'  then 'Your overall budget has reached 80% this month.'
          when p_data->>'scope' = 'category' then 'Your "' || coalesce(p_data->>'label','') || '" budget has reached 80% this month.'
          else p_body_ja end;
      when 'budget_exceeded' then
        v_title := 'Budget exceeded';
        v_body := case
          when p_data->>'scope' = 'overall'  then 'Your overall budget for this month has been exceeded.'
          when p_data->>'scope' = 'category' then 'Your "' || coalesce(p_data->>'label','') || '" budget for this month has been exceeded.'
          else p_body_ja end;
      when 'settlement_reminder' then
        v_title := 'Month-end settlement';
        v_body := case when p_data ? 'amount'
          then 'You have an unsettled balance of ' || coalesce(p_data->>'amount','') || ' ' || coalesce(p_data->>'currency','')
             || '. Time to settle up for this month.'
          else p_body_ja end;
      else
        v_title := p_title_ja; v_body := p_body_ja;
    end case;
  else
    -- ja / auto: 従来どおり（完全に現状維持）
    v_title := p_title_ja; v_body := p_body_ja;
  end if;

  insert into notifications (user_id, pair_id, type, title, body)
    values (p_user, p_pair, p_type, v_title, v_body);
end; $$;

revoke all on function notify_i18n(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------
-- notify_user を i18n 経由に付け替え（シグネチャ不変）。
-- これで notify_partner 経由の静的通知（支出/精算/ペア承認・拒否）が自動英語化される。
-- ---------------------------------------------------------
create or replace function notify_user(p_user uuid, p_pair uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform notify_i18n(p_user, p_pair, p_type, p_title, p_body, '{}'::jsonb);
end; $$;
revoke all on function notify_user(uuid, uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 動的文面①: 変動固定費リマインド（0005 の本体を維持し notify_i18n へ）
-- ---------------------------------------------------------
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
    perform notify_i18n(r.user1_id, r.pair_id, 'reminder_variable',
      '変動固定費の入力期限', '「' || r.name || '」の今月分が未入力です。金額を入力してください。',
      jsonb_build_object('name', r.name));
    perform notify_i18n(r.user2_id, r.pair_id, 'reminder_variable',
      '変動固定費の入力期限', '「' || r.name || '」の今月分が未入力です。金額を入力してください。',
      jsonb_build_object('name', r.name));
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke all on function send_variable_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 動的文面②: 予算アラート（0015 の base_amount 版を維持し notify_i18n へ）
-- ---------------------------------------------------------
create or replace function check_budget_alerts(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
  u1 uuid; u2 uuid;
  b record;
  v_used numeric; v_pct numeric; v_body text; v_inserted int;
  v_scope text; v_data jsonb;
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
    select coalesce(sum(e.base_amount), 0)
      into v_used
    from expenses e
    where e.pair_id = p_pair_id
      and e.deleted_at is null
      and date_trunc('month', e.expense_date)::date = v_month
      and (b.category_id is null or e.category_id = b.category_id);

    v_pct := v_used * 100.0 / b.amount;
    if v_pct < 80 then continue; end if;

    v_scope := case when b.category_id is null then 'overall' else 'category' end;
    v_data := jsonb_build_object('scope', v_scope, 'label', b.label);

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
        perform notify_i18n(u1, p_pair_id, 'budget_exceeded', '予算を超過しました', v_body, v_data);
        perform notify_i18n(u2, p_pair_id, 'budget_exceeded', '予算を超過しました', v_body, v_data);
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
        perform notify_i18n(u1, p_pair_id, 'budget_warning', '予算の80%に達しました', v_body, v_data);
        perform notify_i18n(u2, p_pair_id, 'budget_warning', '予算の80%に達しました', v_body, v_data);
      end if;
    end if;
  end loop;
end; $$;
revoke all on function check_budget_alerts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 動的文面③: 月末精算リマインド（0015 版を維持し notify_i18n へ）
-- ---------------------------------------------------------
create or replace function send_settlement_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last  date := (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date;
  r record; b json; v_amount numeric; v_body text; v_amount_txt text; v_currency text; v_count int := 0;
begin
  if v_today <> v_last then return 0; end if; -- 月末日のみ実行

  for r in
    select id, user1_id, user2_id from pairs
    where deleted_at is null and user1_id is not null and user2_id is not null
  loop
    b := calculate_settlement_balance(r.id);
    v_amount := (b->>'settlementAmount')::numeric;
    if v_amount > 0 then
      v_amount_txt := to_char(v_amount, 'FM999,999,999,999.##');
      v_currency := coalesce(b->>'currency','JPY');
      v_body := '未精算の立替が ' || v_amount_txt || ' ' || v_currency || ' あります。今月分を精算しましょう。';
      perform notify_i18n(r.user1_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body,
        jsonb_build_object('amount', v_amount_txt, 'currency', v_currency));
      perform notify_i18n(r.user2_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body,
        jsonb_build_object('amount', v_amount_txt, 'currency', v_currency));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;
revoke all on function send_settlement_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 動的文面④: ペア申請通知（0010 request_pair の本体を維持し notify_i18n へ）
-- ---------------------------------------------------------
create or replace function request_pair(p_invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  my_pair uuid;
  req_id uuid;
  requester_name text;
begin
  select id into target from pairs
    where invite_code = p_invite_code and user2_id is null and deleted_at is null;
  if target is null then raise exception 'invalid invite code'; end if;

  my_pair := get_my_pair_id();
  if target = my_pair then raise exception 'cannot join own pair'; end if;
  if exists (select 1 from pairs where id = my_pair and user2_id is not null and deleted_at is null) then
    raise exception 'already paired';
  end if;

  select id into req_id from pair_requests
    where requester_id = auth.uid() and status = 'pending' and pair_id = target;
  if req_id is not null then return req_id; end if;

  update pair_requests set status = 'cancelled', responded_at = now()
    where requester_id = auth.uid() and status = 'pending';

  insert into pair_requests (pair_id, requester_id) values (target, auth.uid()) returning id into req_id;

  select display_name into requester_name from profiles where id = auth.uid();
  perform notify_i18n(
    (select user1_id from pairs where id = target), target, 'pair_request',
    'ペア申請が届きました',
    coalesce(requester_name, 'ユーザー') || ' さんがペアを申請しています。アプリで承認してください。',
    jsonb_build_object('name', requester_name));
  return req_id;
end; $$;
