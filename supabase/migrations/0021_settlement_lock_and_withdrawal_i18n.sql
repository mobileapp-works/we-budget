-- =========================================================
-- 0021: 精算の同時実行ロック + 共同口座出金メモの i18n 対応
--
--   (1) 排他ロック（TOCTOU対策）:
--       execute_settlement / execute_settlement_from_shared / settle_expense は
--       「残高計算 → settlements INSERT → 支出スタンプ」の間にペア単位のロックが
--       なく、2人が同時に精算すると settlements が二重記録され得た（スタンプは
--       `where settlement_id is null` で片方のみ勝つが、settlements 行は両方残る）。
--       月末リマインド直後の同時押しで現実に起こり得るため、各関数の権限チェック
--       直後に `pg_advisory_xact_lock(hashtext(pair_id))` を追加する。
--       トランザクション終了で自動解放・デッドロックなし・他ペアには無影響。
--
--   (2) 出金メモの i18n（0020 の残課題）:
--       execute_settlement_from_shared が挿入する shared_account.description が
--       日本語固定（'立替精算（共同口座から）'）で、英語ユーザーの明細に日本語が
--       出ていた。表示文字列ではなく安定トークン 'settlement_from_shared' を保存し、
--       クライアント（shared-account.tsx）が受信者の言語で翻訳して表示する。
--       既存の日本語メモ行はそのまま残す（クライアントが旧文字列も翻訳にマップ）。
--
-- デグレ防止: 3関数とも 0015/0020 の定義を完全踏襲し、変更は
--   「ロック1行の追加」と「description の文字列」のみ。
--   0014/0015/0020 と同じく CREATE OR REPLACE 後に権限を再適用する。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- (1a) まとめて精算（0015 §3 と同一 + ロック）
-- ---------------------------------------------------------
create or replace function execute_settlement(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements; u1 uuid; u2 uuid; base text;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  -- ペア単位の排他ロック（同時精算の二重記録防止）。トランザクション終了で自動解放。
  perform pg_advisory_xact_lock(hashtext(p_pair_id::text));
  b := calculate_settlement_balance(p_pair_id);
  if (b->>'settlementAmount')::numeric <= 0 then raise exception 'nothing to settle'; end if;
  select user1_id, user2_id, coalesce(base_currency, 'JPY') into u1, u2, base from pairs where id = p_pair_id;
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), (b->>'settlementAmount')::numeric, base, (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  -- calculate_settlement_balance の集計対象と同一条件でスタンプする
  update expenses e set settlement_id = s.id
    where e.pair_id = p_pair_id
      and e.settlement_id is null
      and e.is_shared_payment = false
      and e.deleted_at is null
      and e.payer_user_id in (u1, u2);
  return s;
end; $$;

revoke execute on function execute_settlement(uuid) from public, anon;
grant execute on function execute_settlement(uuid) to authenticated;

-- ---------------------------------------------------------
-- (1b) まとめて共同口座から精算（0020 (1) と同一 + ロック + description トークン化）
-- ---------------------------------------------------------
create or replace function execute_settlement_from_shared(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements; u1 uuid; u2 uuid; base text; v_amount numeric;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  -- ペア単位の排他ロック（同時精算の二重記録防止）。
  perform pg_advisory_xact_lock(hashtext(p_pair_id::text));
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
  -- description は表示文字列ではなく安定トークン（クライアントが言語別に翻訳して表示）。
  insert into shared_account (pair_id, user_id, type, amount, currency, description, transaction_date)
    values (p_pair_id, null, 'withdrawal', v_amount, base, 'settlement_from_shared',
            (now() at time zone 'Asia/Tokyo')::date);
  return s;
end; $$;

revoke execute on function execute_settlement_from_shared(uuid) from public, anon;
grant execute on function execute_settlement_from_shared(uuid) to authenticated;

-- ---------------------------------------------------------
-- (1c) 立替1件の個別精算（0020 (2) と同一 + ロック）
--      ロック取得後に支出行を読み直し、ロック待ちの間に他の精算で
--      スタンプ済みになったケースを 'not settleable' で弾く。
-- ---------------------------------------------------------
create or replace function settle_expense(p_expense_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare
  v_pair uuid; v_payer uuid; v_base numeric; v_shared boolean; v_settlement uuid; v_deleted timestamptz;
  u1 uuid; u2 uuid; r1 int; base text; v_dec int;
  v_counter uuid; v_ratio int; v_amount numeric; s settlements;
begin
  select pair_id into v_pair from expenses where id = p_expense_id;
  if not found then raise exception 'not found'; end if;
  if get_my_pair_id() <> v_pair then raise exception 'forbidden'; end if;

  -- ペア単位の排他ロック（まとめ精算との同時実行で二重精算になるのを防ぐ）。
  perform pg_advisory_xact_lock(hashtext(v_pair::text));

  -- ロック取得後に最新状態を読み直す（待機中に settlement_id が付いた可能性がある）。
  select payer_user_id, base_amount, is_shared_payment, settlement_id, deleted_at
    into v_payer, v_base, v_shared, v_settlement, v_deleted
  from expenses where id = p_expense_id;
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
