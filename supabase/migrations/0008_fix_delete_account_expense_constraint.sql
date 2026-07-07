-- =========================================================
-- 0008: アカウント削除が失敗するバグ修正
--
-- 症状:
--   設定→アカウント削除で「問題が発生しました。もう一度お試しください。」。
--
-- 原因:
--   delete-account Edge Function が auth.users を物理削除すると、
--   expenses.payer_user_id は ON DELETE SET NULL で NULL 化される（＝匿名化して履歴保持が設計意図）。
--   しかし CHECK 制約 payer_xor_shared が「個人払い(is_shared_payment=false)は payer 必須」を
--   要求しているため、個人払い支出を持つユーザーの削除時に NULL 化が制約違反となり、
--   deleteUser のトランザクション全体がロールバック → Edge Function 500 → 汎用エラー。
--
-- 修正:
--   「個人払い＋payer NULL」= 支払者アカウント削除後の匿名化状態を許容する。
--   「共有払いなのに個人支払者が入っている」不整合は引き続き禁止。
--   読み取り側（calculate_settlement_balance は payer_user_id = u1/u2 で集計）は
--   NULL payer を 0 として自然に除外するため影響なし。
--   通常挿入時の「個人払いは payer 必須」はアプリ側で担保する。
-- =========================================================

alter table expenses drop constraint if exists payer_xor_shared;
alter table expenses add constraint payer_xor_shared check (
  -- 共有払い: 個人の支払者を持たない
  (is_shared_payment = true and payer_user_id is null) or
  -- 個人払い: 通常は payer あり／削除で匿名化された NULL（ON DELETE SET NULL の結果）も許容
  (is_shared_payment = false)
);
