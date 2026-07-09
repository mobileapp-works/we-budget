-- =========================================================
-- 0014: calculate_settlement_balance にペアメンバーチェックを追加（情報漏えい修正）
--
-- 問題（pre_release_audit F-1）:
--   calculate_settlement_balance(p_pair_id) は SECURITY DEFINER だが、
--   呼び出し元が当該ペアの一員かを検証していなかった。default で anon/authenticated に
--   EXECUTE が付くため、PostgREST の /rpc/ 経由で任意の pair_id を渡すと、他ペアの
--   settlementAmount / fromUserId / toUserId / unconvertedCurrencies を取得できた。
--   （とくにペア解除後の元パートナーは旧 pair_id を知っているため継続的に覗ける。）
--   対になる execute_settlement は元々メンバーチェックを持つ（0002/0004）。
--
-- 修正:
--   1) 関数冒頭で「認証ユーザーかつ非メンバー」の呼び出しを forbidden で弾く。
--      - 認証メンバー: get_my_pair_id() = p_pair_id → 通過
--      - 認証非メンバー: is distinct from → 例外
--      - cron/内部の SECURITY DEFINER 呼び出し（send_settlement_reminders /
--        execute_settlement）は auth.uid() が NULL もしくは呼び出しユーザーが
--        当該ペアのため通過する（send_settlement_reminders は postgres 実行で
--        auth.uid() が NULL → 条件 false で通過）。
--   2) anon / public からは EXECUTE を剥奪（authenticated のみ許可）。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- 確認（test_cases.md §6-10）:
--   別ペア/anon のトークンで POST /rest/v1/rpc/calculate_settlement_balance
--   {"p_pair_id":"<他人のpair>"} が、データを返さない（forbidden / permission denied）こと。
-- =========================================================

create or replace function calculate_settlement_balance(p_pair_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  u1 uuid; u2 uuid; r1 int;
  u1_paid numeric := 0; u2_paid numeric := 0; total numeric; bal numeric;
  unconv text[];
begin
  -- メンバーチェック: 認証ユーザーは自分のペアのみ照会可。
  -- （cron/内部 definer 呼び出しは auth.uid() が NULL のため通過する）
  if auth.uid() is not null and get_my_pair_id() is distinct from p_pair_id then
    raise exception 'forbidden';
  end if;

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

-- anon / public からは実行不可（authenticated と内部 definer/cron のみ）。
revoke execute on function calculate_settlement_balance(uuid) from public, anon;
grant execute on function calculate_settlement_balance(uuid) to authenticated;
