-- =========================================================
-- 0017: ペア承認時に、申請者の古いソロペアを無効化する
--
-- 背景（0010 承認フローの穴）:
--   respond_pair_request で承認すると、申請者の profiles.pair_id は
--   承認側ペア（my_pair）へ移るが、申請者が元々持っていたソロペア
--   （user1_id=申請者 / user2_id=null）はそのまま残っていた。
--   その旧ペアの invite_code は生き続けるため、
--   ・第三者が古い招待コードで宛先のないペア申請を出せてしまう
--   ・旧ペアに来ていた pending 申請が宙に浮く
--   といった混乱が起きうる。
--
--   本マイグレーションは承認処理に「申請者の旧ソロペアを soft-delete
--   （deleted_at 設定）し、その旧ペア宛ての pending 申請を declined にする」
--   を追加する。データは物理削除せず deleted_at で隠すだけ（可逆・安全）。
--   申請者の旧ソロの記録は元々持ち込まれない仕様（pairing.confirmSend）なので
--   契約と整合する。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

create or replace function respond_pair_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r pair_requests;
  my_pair uuid;
  old_pair uuid;
begin
  my_pair := get_my_pair_id();

  select * into r from pair_requests where id = p_request_id for update;
  if r.id is null or r.pair_id <> my_pair then raise exception 'not found'; end if;
  if r.status <> 'pending' then raise exception 'already handled'; end if;

  if not p_approve then
    update pair_requests set status = 'declined', responded_at = now() where id = r.id;
    perform notify_user(r.requester_id, r.pair_id, 'pair_declined',
      'ペア申請の結果', 'ペア申請は承認されませんでした。');
    return;
  end if;

  -- 承認: 自分のペアが未成立のままであることを行ロック付きで確認（二重承認・競合を防ぐ）
  perform 1 from pairs where id = my_pair and user2_id is null and deleted_at is null for update;
  if not found then raise exception 'pair not available'; end if;

  -- 申請者が別ペアと成立済みなら承認できない
  if exists (
    select 1 from profiles pr join pairs pp on pp.id = pr.pair_id
    where pr.id = r.requester_id and pp.user2_id is not null and pp.deleted_at is null
  ) then
    raise exception 'requester already paired';
  end if;

  -- 申請者の現在（＝ソロ）のペアを控えてから合流させる
  select pair_id into old_pair from profiles where id = r.requester_id;

  update pairs set user2_id = r.requester_id where id = my_pair;
  update profiles set pair_id = my_pair where id = r.requester_id;
  update pair_requests set status = 'approved', responded_at = now() where id = r.id;

  -- 申請者の旧ソロペアを無効化（招待コードの生き残り・宛先のない申請を防ぐ）。
  -- ソロ（user2_id が無い）かつ別ペアのときだけ soft-delete する。
  if old_pair is not null and old_pair <> my_pair then
    update pairs set deleted_at = now()
      where id = old_pair and user2_id is null and deleted_at is null;
    -- 旧ペア宛ての pending 申請は宛先が消えるため declined にする（同ペア他申請の扱いと同じく通知なし）。
    update pair_requests set status = 'declined', responded_at = now()
      where pair_id = old_pair and status = 'pending';
  end if;

  -- 同じペア宛ての他の pending 申請は自動で拒否する
  update pair_requests set status = 'declined', responded_at = now()
    where pair_id = my_pair and status = 'pending' and id <> r.id;

  perform notify_user(r.requester_id, my_pair, 'pair_approved',
    'ペアになりました', 'ペア申請が承認されました。今日から一緒に記録を始めましょう！');
end; $$;
