-- =========================================================
-- 0009: 通知・ペアリングのバグ修正（2026-07-08 コードレビュー R-7 / H-9 対応）
--
-- 1) on_expense_change:
--    execute_settlement の settlement_id スタンプ（UPDATE）が支出の行数ぶん
--    「支出が編集されました」通知を発火し、精算のたびにパートナーへ通知が
--    大量に届いていた。→ settlement_id が変わる UPDATE は通知しない。
--
-- 2) settlements INSERT トリガー（新規）:
--    要件7-6「精算が実行されたら両者にプッシュ通知」が未実装だった。
--    → notify_user 経由で from/to 両ユーザーへ type='settlement' を通知する
--      （notification_settings の settlement ゲートを尊重。プッシュは既存の
--       notifications INSERT → Database Webhook → send-push-notification 経路に乗る）。
--
-- 3) join_pair:
--    既にペア成立済み（user2_id あり）のユーザーが別の招待コードで参加できてしまい、
--    旧ペアに leave_pair を経ない「幽霊メンバー」が残る問題を修正。
--    → 参加前に現在のペアが成立済みなら 'already paired' で拒否する
--      （クライアントは pairing.alreadyPaired の文言を表示する）。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- 1) 精算スタンプの UPDATE では編集通知を出さない
create or replace function on_expense_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    if new.is_fixed_cost then return new; end if;  -- 自動計上は通知しない
    perform notify_partner(new.pair_id, new.recorded_by, 'expense_added', 'パートナーが支出を記録', '新しい支出が記録されました');
  elsif (tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null) then
    perform notify_partner(new.pair_id, auth.uid(), 'expense_deleted', '支出が削除されました', '支出が削除されました');
  elsif (tg_op = 'UPDATE') then
    -- 精算スタンプ（settlement_id の変更）はユーザーによる編集ではないため通知しない。
    -- 精算そのものの通知は t_settlement_notify（下記）が担う。
    if new.settlement_id is distinct from old.settlement_id then return new; end if;
    perform notify_partner(new.pair_id, auth.uid(), 'expense_edited', '支出が編集されました', '支出が編集されました');
  end if;
  return new;
end; $$;

-- 2) 精算実行を両者に通知する
create or replace function on_settlement_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare u1 uuid; u2 uuid;
begin
  select user1_id, user2_id into u1, u2 from pairs where id = new.pair_id;
  perform notify_user(u1, new.pair_id, 'settlement', '精算が完了しました', '立替の精算が実行されました。');
  perform notify_user(u2, new.pair_id, 'settlement', '精算が完了しました', '立替の精算が実行されました。');
  return new;
end; $$;

drop trigger if exists t_settlement_notify on settlements;
create trigger t_settlement_notify after insert on settlements
  for each row execute function on_settlement_insert();

-- 3) ペア成立済みユーザーの join を拒否する
create or replace function join_pair(p_invite_code text)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid; my_pair uuid;
begin
  select id into target from pairs where invite_code = p_invite_code and user2_id is null and deleted_at is null;
  if target is null then raise exception 'invalid invite code'; end if;
  my_pair := get_my_pair_id();
  if target = my_pair then raise exception 'cannot join own pair'; end if;
  -- 既にペア成立済みなら参加不可（先にペア解除が必要。旧ペアに幽霊メンバーを残さない）
  if exists (select 1 from pairs where id = my_pair and user2_id is not null and deleted_at is null) then
    raise exception 'already paired';
  end if;
  update pairs set user2_id = auth.uid() where id = target;
  update profiles set pair_id = target where id = auth.uid();
end; $$;
