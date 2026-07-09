-- =========================================================
-- 0012: 内部関数の EXECUTE 権限強化（セキュリティ修正）
--
-- 問題:
--   0005 / 0011 は `revoke ... from public` で内部関数を保護したつもりだったが、
--   Supabase は関数作成時に anon / authenticated / service_role へ**個別に**
--   EXECUTE を付与する（ALTER DEFAULT PRIVILEGES）。public からの revoke では
--   この個別付与は残るため、実際には PostgREST の /rpc/ 経由で誰でも実行できた。
--   確認済みの悪用可能性:
--     - notify_user: ユーザーUUIDを知っていれば任意の文言の通知（プッシュ含む）を
--       他人に送れる（ペア解除後の元パートナーはUUIDを知っている）
--     - send_variable_reminders / send_settlement_reminders: リマインド日に
--       連打すると通知を重複送信できる（日内の重複防止なし）
--
-- 修正:
--   内部専用関数（cron / トリガー / SECURITY DEFINER 関数からのみ呼ばれる）から
--   anon / authenticated の EXECUTE を剥奪する。
--   - pg_cron は postgres として実行するため影響なし
--   - SECURITY DEFINER 関数内からの呼び出しは定義者（postgres）権限で
--     権限チェックされるため影響なし（on_expense_change → notify_partner 等）
--   - アプリが直接呼ぶ RPC（calculate_settlement_balance / execute_settlement /
--     request_pair 系 / leave_pair / update_split_ratio / get_my_pair_id）は対象外
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- 確認: anon キーで POST /rest/v1/rpc/notify_user 等が
--       「permission denied for function ...」(42501) になること（test_plan §7-1）。
-- =========================================================

revoke execute on function notify_user(uuid, uuid, text, text, text) from anon, authenticated;
revoke execute on function notify_partner(uuid, uuid, text, text, text) from anon, authenticated;
revoke execute on function post_fixed_expenses() from anon, authenticated;
revoke execute on function send_variable_reminders() from anon, authenticated;
revoke execute on function send_settlement_reminders() from anon, authenticated;
revoke execute on function check_budget_alerts(uuid) from anon, authenticated;
