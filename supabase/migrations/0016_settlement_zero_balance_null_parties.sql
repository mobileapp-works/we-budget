-- =========================================================
-- 0016: calculate_settlement_balance の「丸め後0」で from/to を null に揃える
--
-- 問題（TS版とのズレ）:
--   クライアント calculateSettlementBalance（src/utils/settlement.ts）は、丸めた
--   精算額が 0 のとき empty（fromUserId/toUserId を null）を返す。一方 0015 の
--   SQL版は、round(abs(bal)) が 0 でも `bal > 0` の三項評価で from/to に u1/u2 を
--   入れて返していた（例: JPY で差額 0.3 → round=0 だが from/to が付く。完全に
--   釣り合う bal=0 も同様）。
--
--   現時点では実害はない（呼び出し側は全て settlementAmount > 0 でガード:
--   execute_settlement / settlement.tsx / send_settlement_reminders）。ただし
--   TS版とSQL版はミラー実装で揃える方針のため、防御的に一致させる。
--
-- 修正:
--   丸め後の額を v_amount に取り、0 なら from/to=null の empty を返す（TS版と同一）。
--   それ以外は従来どおり。0014 のメンバーチェック / 0015 の base_amount 集計・
--   unconvertedCurrencies='[]' は維持。
--
-- クライアント変更: 不要（TS版は既に正しい）。
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

create or replace function calculate_settlement_balance(p_pair_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  u1 uuid; u2 uuid; r1 int; base text; v_dec int;
  u1_paid numeric := 0; u2_paid numeric := 0; total numeric; bal numeric; v_amount numeric;
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
  v_amount := round(abs(bal), v_dec);
  -- 丸め後 0 は「精算なし」。TS版 calculateSettlementBalance と同一に from/to を null で返す。
  if v_amount = 0 then
    return json_build_object('settlementAmount',0,'fromUserId',null,'toUserId',null,'currency',base,'unconvertedCurrencies','[]'::json);
  end if;

  return json_build_object(
    'settlementAmount', v_amount,
    'fromUserId', case when bal > 0 then u2 else u1 end,
    'toUserId',   case when bal > 0 then u1 else u2 end,
    'currency', base,
    'unconvertedCurrencies', '[]'::json);
end; $$;

-- CREATE OR REPLACE で default 付与が復活しうるため、0014/0015 と同じ権限を再適用。
revoke execute on function calculate_settlement_balance(uuid) from public, anon;
grant execute on function calculate_settlement_balance(uuid) to authenticated;
