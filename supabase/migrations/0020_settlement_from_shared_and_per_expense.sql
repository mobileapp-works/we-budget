-- =========================================================
-- 0020: 精算の追加導線（既存 execute_settlement は変更せず新関数を追加）
--
--   (1) execute_settlement_from_shared(p_pair_id):
--       まとめ精算を「共同口座から」実行する。ネット残高ぶんを共同口座から
--       出金（立替者へ払い戻し）し、通常の精算と同じく settlements を1件記録
--       して対象支出に settlement_id をスタンプする。
--       ＝ execute_settlement と同じ確定処理 ＋ 共同口座の withdrawal を1件追加。
--
--   (2) settle_expense(p_expense_id):
--       立替1件だけを個別に person-to-person 精算する。金額は分担比率での
--       「相手負担分」（= base_amount × 相手の比率）。方向は支払者が受け取る側。
--       settlements を1件記録し、その支出にだけ settlement_id をスタンプする。
--       calculate_settlement_balance は settlement_id 付きを除外するため、
--       個別精算した分はネット残高から自動的に外れる（二重計上なし）。
--
-- デグレ防止: 既存の execute_settlement / calculate_settlement_balance は
--   一切変更していない。0014 のメンバーチェック方針・権限付与に合わせる。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- (1) まとめて共同口座から精算
-- ---------------------------------------------------------
create or replace function execute_settlement_from_shared(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements; u1 uuid; u2 uuid; base text; v_amount numeric;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  b := calculate_settlement_balance(p_pair_id);
  v_amount := (b->>'settlementAmount')::numeric;
  if v_amount <= 0 then raise exception 'nothing to settle'; end if;
  select user1_id, user2_id, coalesce(base_currency, 'JPY') into u1, u2, base from pairs where id = p_pair_id;

  -- 通常の精算と同じく settlements を記録し、対象支出をスタンプ（同一条件）。
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), v_amount, base, (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  update expenses e set settlement_id = s.id
    where e.pair_id = p_pair_id
      and e.settlement_id is null
      and e.is_shared_payment = false
      and e.deleted_at is null
      and e.payer_user_id in (u1, u2);

  -- 共同口座から精算額を出金（立替者へ払い戻し）。当事者は付けない（共同扱い）。
  insert into shared_account (pair_id, user_id, type, amount, currency, description, transaction_date)
    values (p_pair_id, null, 'withdrawal', v_amount, base, '立替精算（共同口座から）',
            (now() at time zone 'Asia/Tokyo')::date);
  return s;
end; $$;

revoke execute on function execute_settlement_from_shared(uuid) from public, anon;
grant execute on function execute_settlement_from_shared(uuid) to authenticated;

-- ---------------------------------------------------------
-- (2) 立替1件の個別精算（分担比率での相手負担分）
-- ---------------------------------------------------------
create or replace function settle_expense(p_expense_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare
  v_pair uuid; v_payer uuid; v_base numeric; v_shared boolean; v_settlement uuid; v_deleted timestamptz;
  u1 uuid; u2 uuid; r1 int; base text; v_dec int;
  v_counter uuid; v_ratio int; v_amount numeric; s settlements;
begin
  select pair_id, payer_user_id, base_amount, is_shared_payment, settlement_id, deleted_at
    into v_pair, v_payer, v_base, v_shared, v_settlement, v_deleted
  from expenses where id = p_expense_id;
  if not found then raise exception 'not found'; end if;
  if get_my_pair_id() <> v_pair then raise exception 'forbidden'; end if;
  if v_settlement is not null or v_shared or v_deleted is not null then raise exception 'not settleable'; end if;

  select user1_id, user2_id, split_ratio_user1, coalesce(base_currency, 'JPY')
    into u1, u2, r1, base
  from pairs where id = v_pair;
  if u2 is null then raise exception 'solo'; end if;
  if v_payer is null or v_payer not in (u1, u2) then raise exception 'not settleable'; end if;
  v_dec := case when base in ('JPY', 'KRW') then 0 else 2 end;

  -- 相手＝支払者でない方。相手の負担比率で金額を出す。支払者が受け取る側。
  if v_payer = u1 then v_counter := u2; v_ratio := 100 - r1; else v_counter := u1; v_ratio := r1; end if;
  v_amount := round(v_base * v_ratio / 100.0, v_dec);
  if v_amount <= 0 then raise exception 'nothing to settle'; end if;

  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (v_pair, auth.uid(), v_amount, base, v_counter, v_payer)
    returning * into s;
  update expenses set settlement_id = s.id where id = p_expense_id;
  return s;
end; $$;

revoke execute on function settle_expense(uuid) from public, anon;
grant execute on function settle_expense(uuid) to authenticated;
