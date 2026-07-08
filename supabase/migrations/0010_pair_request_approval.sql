-- =========================================================
-- 0010: 承認制ペアリング（申請 → 相手に通知 → 承認で成立）
--
-- 従来は招待コードを入力した瞬間に join_pair で即成立していた。
-- これを「pair_requests に申請を作成 → 招待側に通知 → 招待側が承認/拒否」に変更する。
--
-- 追加:
--   - テーブル pair_requests（RLS: 当事者のみ SELECT。書き込みは RPC 経由のみ）
--   - RPC request_pair / list_incoming_pair_requests / respond_pair_request / cancel_pair_request
--   - notifications.type に 'pair_request' / 'pair_approved' / 'pair_declined' を追加
-- 削除:
--   - join_pair（即時成立の旧経路。承認フローに置き換え）
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

-- ---------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------
create table if not exists pair_requests (
  id uuid primary key default gen_random_uuid(),
  -- 申請先（招待コードの持ち主）のペア
  pair_id uuid not null references pairs(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- 申請者は同時に1件しか pending を持てない
create unique index if not exists pair_requests_pending_requester
  on pair_requests (requester_id) where status = 'pending';
create index if not exists pair_requests_pair_pending
  on pair_requests (pair_id) where status = 'pending';

alter table pair_requests enable row level security;

-- 閲覧は当事者のみ（申請者本人 or 申請先ペアのメンバー）。書き込みは RPC（SECURITY DEFINER）のみ。
create policy pair_requests_select on pair_requests for select
  using (requester_id = auth.uid() or pair_id = get_my_pair_id());

-- ---------------------------------------------------------
-- notifications.type にペア申請系を追加
-- ---------------------------------------------------------
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'expense_added','expense_edited','expense_deleted','settlement',
  'reminder_variable','budget_warning','budget_exceeded','settlement_reminder',
  'pair_request','pair_approved','pair_declined'));

-- ---------------------------------------------------------
-- RPC: ペア申請を送る
-- ---------------------------------------------------------
create or replace function request_pair(p_invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  my_pair uuid;
  req_id uuid;
  requester_name text;
begin
  select id into target from pairs
    where invite_code = p_invite_code and user2_id is null and deleted_at is null;
  if target is null then raise exception 'invalid invite code'; end if;

  my_pair := get_my_pair_id();
  if target = my_pair then raise exception 'cannot join own pair'; end if;
  if exists (select 1 from pairs where id = my_pair and user2_id is not null and deleted_at is null) then
    raise exception 'already paired';
  end if;

  -- 同じ相手への pending が既にあればそれを返す（連打・再入力の冪等化）
  select id into req_id from pair_requests
    where requester_id = auth.uid() and status = 'pending' and pair_id = target;
  if req_id is not null then return req_id; end if;

  -- 別の相手への pending は取り消して出し直す（pending は同時に1件まで）
  update pair_requests set status = 'cancelled', responded_at = now()
    where requester_id = auth.uid() and status = 'pending';

  insert into pair_requests (pair_id, requester_id) values (target, auth.uid()) returning id into req_id;

  -- 招待コードの持ち主へ通知（アプリ内 + 既存 Webhook 経由でプッシュ）
  select display_name into requester_name from profiles where id = auth.uid();
  perform notify_user(
    (select user1_id from pairs where id = target), target, 'pair_request',
    'ペア申請が届きました',
    coalesce(requester_name, 'ユーザー') || ' さんがペアを申請しています。アプリで承認してください。');
  return req_id;
end; $$;

-- ---------------------------------------------------------
-- RPC: 自分のペア宛ての pending 申請一覧（申請者の表示名込み）
-- RLS では申請者のプロフィールを読めないため SECURITY DEFINER で解決する。
-- 申請後に別ペアと成立してしまった申請者の行は除外する。
-- ---------------------------------------------------------
create or replace function list_incoming_pair_requests()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', r.id,
      'pair_id', r.pair_id,
      'requester_id', r.requester_id,
      'requester_name', coalesce(p.display_name, 'ユーザー'),
      'status', r.status,
      'created_at', r.created_at
    ) order by r.created_at desc), '[]'::json)
  from pair_requests r
  left join profiles p on p.id = r.requester_id
  where r.pair_id = get_my_pair_id()
    and r.status = 'pending'
    and exists (
      select 1 from profiles pr join pairs pp on pp.id = pr.pair_id
      where pr.id = r.requester_id and pp.user2_id is null and pp.deleted_at is null
    );
$$;

-- ---------------------------------------------------------
-- RPC: 申請を承認/拒否する（承認で成立）
-- ---------------------------------------------------------
create or replace function respond_pair_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r pair_requests;
  my_pair uuid;
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

  update pairs set user2_id = r.requester_id where id = my_pair;
  update profiles set pair_id = my_pair where id = r.requester_id;
  update pair_requests set status = 'approved', responded_at = now() where id = r.id;

  -- 同じペア宛ての他の pending 申請は自動で拒否して通知する
  update pair_requests set status = 'declined', responded_at = now()
    where pair_id = my_pair and status = 'pending' and id <> r.id;

  perform notify_user(r.requester_id, my_pair, 'pair_approved',
    'ペアになりました', 'ペア申請が承認されました。今日から一緒に記録を始めましょう！');
end; $$;

-- ---------------------------------------------------------
-- RPC: 自分の pending 申請を取り消す
-- ---------------------------------------------------------
create or replace function cancel_pair_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update pair_requests set status = 'cancelled', responded_at = now()
    where id = p_request_id and requester_id = auth.uid() and status = 'pending';
end; $$;

-- ---------------------------------------------------------
-- 旧・即時成立の join_pair は廃止（承認フローに一本化）
-- ---------------------------------------------------------
drop function if exists join_pair(text);
