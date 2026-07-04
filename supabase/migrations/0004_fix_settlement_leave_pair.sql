-- =========================================================
-- 0004: 精算・ペア解除のバグ修正
--
-- 1) execute_settlement:
--    従来は「未精算・個人払い」を全件スタンプしていたため、
--    レート未設定の外貨支出（精算額の集計から除外されている）まで
--    精算済みになり、立替が請求できないまま消えていた。
--    → calculate_settlement_balance の集計対象と完全に同一条件のみスタンプする。
--      （除外された外貨はレート設定後の次回精算に自動的に含まれる）
--
-- 2) leave_pair:
--    設計（design.md）は「各自に新しいソロpairを発行」だが、
--    従来は実行者にしか発行されず、残された側が解散済み（deleted_at付き）の
--    pair にぶら下がったままになっていた。
--    → 残された側にも新しいソロpairを発行する。
--    ※未精算チェックは要件どおり「促す」のみ（クライアントの確認ダイアログで対応）。
-- =========================================================

create or replace function execute_settlement(p_pair_id uuid)
returns settlements language plpgsql security definer set search_path = public as $$
declare b json; s settlements; u1 uuid; u2 uuid;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  b := calculate_settlement_balance(p_pair_id);
  if (b->>'settlementAmount')::numeric <= 0 then raise exception 'nothing to settle'; end if;
  select user1_id, user2_id into u1, u2 from pairs where id = p_pair_id;
  insert into settlements (pair_id, settled_by, amount, currency, from_user_id, to_user_id)
    values (p_pair_id, auth.uid(), (b->>'settlementAmount')::numeric, 'JPY', (b->>'fromUserId')::uuid, (b->>'toUserId')::uuid)
    returning * into s;
  -- calculate_settlement_balance の集計対象と同一条件でスタンプする
  -- （集計に含まれていない支出をスタンプしない: 未換算外貨・ペア外の支払者）
  update expenses e set settlement_id = s.id
    where e.pair_id = p_pair_id
      and e.settlement_id is null
      and e.is_shared_payment = false
      and e.deleted_at is null
      and e.payer_user_id in (u1, u2)
      and (e.currency = 'JPY' or exists (
        select 1 from exchange_rates r
        where r.pair_id = p_pair_id and r.from_currency = e.currency and r.to_currency = 'JPY'));
  return s;
end; $$;

create or replace function leave_pair(p_pair_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare u1 uuid; u2 uuid; partner uuid; my_pair uuid; partner_pair uuid;
begin
  if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;
  select user1_id, user2_id into u1, u2 from pairs where id = p_pair_id;
  partner := case when u1 = auth.uid() then u2 else u1 end;

  -- 元pairは解散せず deleted_at を立てて残す（履歴保持）
  update pairs set deleted_at = now() where id = p_pair_id;

  -- 実行者に新しいソロpairを発行
  insert into pairs (invite_code, user1_id)
    values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), auth.uid())
    returning id into my_pair;
  update profiles set pair_id = my_pair where id = auth.uid();

  -- 残された側にも新しいソロpairを発行（解散済みpairに残さない）
  if partner is not null then
    insert into pairs (invite_code, user1_id)
      values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), partner)
      returning id into partner_pair;
    update profiles set pair_id = partner_pair where id = partner;
  end if;
end; $$;
