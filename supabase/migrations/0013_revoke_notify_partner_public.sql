-- =========================================================
-- 0013: notify_partner の public EXECUTE を剥奪（0012 の取りこぼし修正）
--
-- 問題:
--   0012 適用後の REST 再確認で、notify_partner だけが依然 anon から実行できた
--   （POST /rest/v1/rpc/notify_partner が 204 = 実行成功）。
--   原因: notify_partner は 0002 で作成されて以降、一度も `revoke ... from public`
--   されていなかった（notify_user 等は 0005/0011 で public から revoke 済み）。
--   PostgreSQL では public に EXECUTE があると anon/authenticated はそれを**継承**
--   するため、0012 の「anon/authenticated から revoke」だけでは塞げない。
--
-- 修正:
--   内部専用6関数について public / anon / authenticated すべてから EXECUTE を剥奪する
--   （冪等。0012・0005・0011 で既に外れているものへの再 revoke は無害）。
--
-- 確認: anon キーで POST /rest/v1/rpc/notify_partner が
--       「permission denied for function notify_partner」(42501) になること。
-- =========================================================

revoke execute on function notify_partner(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function notify_user(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function post_fixed_expenses() from public, anon, authenticated;
revoke execute on function send_variable_reminders() from public, anon, authenticated;
revoke execute on function send_settlement_reminders() from public, anon, authenticated;
revoke execute on function check_budget_alerts(uuid) from public, anon, authenticated;
