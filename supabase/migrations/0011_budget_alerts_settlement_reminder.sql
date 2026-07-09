-- =========================================================
-- 0011: 予算アラート（80%/100%）+ 月末精算リマインド
--
-- 要件#9・7-3: カテゴリ別/全体の月間予算の 80% 到達で警告・100% 超過で
--   超過アラートを、プッシュ＋アプリ内通知の両方で両ユーザーへ送る。
--   （notifications INSERT → Database Webhook → send-push-notification で
--    プッシュにも自動で乗る。notification_settings.budget_alert を尊重。）
-- 要件#5・7-1・7-6: 月末に未精算の立替があれば両者にリマインド通知。
--
-- 方式:
--   - budget_alerts テーブルで「予算×月×閾値」の送信済みを記録し、
--     同じ月に同じアラートを重複送信しない（支出の追加・編集のたびに評価）。
--   - 集計はクライアント（src/utils/budget.ts calculateBudgetUsage）と同一:
--     当月(JST)の全支出を JPY 換算して合計。レート未設定の外貨は除外。
--   - 月末リマインドは pg_cron 日次（JST 20:00）+ 関数内で「月末日か」を判定。
--
-- 通知文言は既存トリガーと同じくサーバー側日本語固定（多言語化は H-12 で別途）。
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- 送信済みアラートの記録（予算×月×閾値で一意）
-- ---------------------------------------------------------
create table if not exists budget_alerts (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs(id) on delete cascade,
  budget_id uuid not null references budgets(id) on delete cascade,
  month date not null, -- 対象月の月初日（JST基準）
  threshold integer not null check (threshold in (80, 100)),
  created_at timestamptz not null default now(),
  unique (budget_id, month, threshold)
);

alter table budget_alerts enable row level security;
create policy budget_alerts_select on budget_alerts for select using (pair_id = get_my_pair_id());
-- 書き込みはトリガー（SECURITY DEFINER）のみ。クライアントからの INSERT/UPDATE は不可。

-- ---------------------------------------------------------
-- 予算アラート評価: 当月(JST)の使用率を予算ごとに計算し、
-- 未送信の閾値を超えていれば両ユーザーへ通知する。
-- 80%と100%を同時に跨いだ場合は超過通知のみ（80%分は送信済み扱いで埋める）。
-- ---------------------------------------------------------
create or replace function check_budget_alerts(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
  u1 uuid; u2 uuid;
  b record;
  v_used numeric; v_pct numeric; v_label text; v_body text; v_inserted int;
begin
  select user1_id, user2_id into u1, u2 from pairs where id = p_pair_id and deleted_at is null;
  if u1 is null and u2 is null then return; end if;

  for b in
    select bg.id, bg.category_id, bg.amount,
           coalesce(
             c.name,
             -- デフォルトカテゴリ（name_key）はシード時の和名に対応させる
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
    -- 当月支出の JPY 換算合計（クライアント calculateBudgetUsage と同一条件:
    -- 全支出が対象・レート未設定の外貨は除外）
    select coalesce(sum(case when e.currency = 'JPY' then e.amount else e.amount * r.rate end), 0)
      into v_used
    from expenses e
    left join exchange_rates r
      on r.pair_id = e.pair_id and r.from_currency = e.currency and r.to_currency = 'JPY'
    where e.pair_id = p_pair_id
      and e.deleted_at is null
      and date_trunc('month', e.expense_date)::date = v_month
      and (b.category_id is null or e.category_id = b.category_id)
      and (e.currency = 'JPY' or r.rate is not null);

    v_pct := v_used * 100.0 / b.amount;
    if v_pct < 80 then continue; end if;

    if v_pct >= 100 then
      -- 80%行も埋めてから 100% を評価（後から80%警告が出る取りこぼしを防ぐ）
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
-- on_expense_change に予算チェックを配線する。
-- 0009 の挙動（精算スタンプの UPDATE は編集通知を出さない）は維持。
-- 自動計上（is_fixed_cost=true）の INSERT は「記録」通知こそ出さないが、
-- 家賃などで予算を跨ぐことはあるため予算チェックは行う。
-- ---------------------------------------------------------
create or replace function on_expense_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
begin
  if (tg_op = 'INSERT') then
    if not new.is_fixed_cost then
      perform notify_partner(new.pair_id, new.recorded_by, 'expense_added', 'パートナーが支出を記録', '新しい支出が記録されました');
    end if;
    if date_trunc('month', new.expense_date)::date = v_month then
      perform check_budget_alerts(new.pair_id);
    end if;
  elsif (tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null) then
    -- 削除は使用率が下がる方向なので予算チェック不要
    perform notify_partner(new.pair_id, auth.uid(), 'expense_deleted', '支出が削除されました', '支出が削除されました');
  elsif (tg_op = 'UPDATE') then
    -- 精算スタンプ（settlement_id の変更）はユーザーによる編集ではないため通知しない。
    if new.settlement_id is distinct from old.settlement_id then return new; end if;
    perform notify_partner(new.pair_id, auth.uid(), 'expense_edited', '支出が編集されました', '支出が編集されました');
    if date_trunc('month', new.expense_date)::date = v_month then
      perform check_budget_alerts(new.pair_id);
    end if;
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------
-- 月末精算リマインド: 月末日(JST)のみ、未精算残高のあるペア両者へ通知。
-- pg_cron から日次で呼ばれ、月末日以外は何もしない。
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
      v_body := '未精算の立替が ¥' || to_char(v_amount, 'FM999,999,999,999') || ' あります。今月分を精算しましょう。';
      perform notify_user(r.user1_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body);
      perform notify_user(r.user2_id, r.id, 'settlement_reminder', '月末の精算リマインド', v_body);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;

-- 一般ユーザーからの直接実行を禁止（0005 と同方針）
revoke all on function check_budget_alerts(uuid) from public;
revoke all on function send_settlement_reminders() from public;

-- ---------------------------------------------------------
-- pg_cron: 毎日 JST 20:00（= UTC 11:00）に月末判定つきで実行。
-- 再実行時に重複しないよう、既存ジョブを解除してから登録する。
-- ---------------------------------------------------------
do $$
begin
  perform cron.unschedule('webudget_settlement_reminders');
exception when others then null;
end $$;

select cron.schedule('webudget_settlement_reminders', '0 11 * * *', $$select public.send_settlement_reminders();$$);
