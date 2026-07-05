-- =========================================================
-- 0006: OAuth サインアップ時のプロフィール初期値を改善（任意）
--
-- Apple / Google のネイティブサインイン（signInWithIdToken）で作られる新規ユーザーは
-- raw_user_meta_data に display_name を持たないため、既存の handle_new_user では
-- 表示名が常に 'ユーザー' になっていた。Google の ID トークンには full_name / name /
-- picture が含まれるので、それらを表示名・アバターの初期値に採用する。
-- （Apple は氏名を JWT に含めないため 'ユーザー' にフォールバック。後で本人が変更可能。）
--
-- ※ この 0006 は「磨き込み」。適用しなくても OAuth ログイン自体は動作する
--   （handle_new_user は従来どおりプロフィールを作成する）。
--
-- 実行方法: Supabase Dashboard の SQL Editor に貼り付けて実行。
-- =========================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_pair_id uuid;
  code text;
begin
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into pairs (invite_code, user1_id) values (code, new.id) returning id into new_pair_id;

  insert into profiles (id, display_name, avatar_url, pair_id)
    values (
      new.id,
      coalesce(
        nullif(new.raw_user_meta_data->>'display_name', ''),
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'name', ''),
        'ユーザー'
      ),
      coalesce(
        nullif(new.raw_user_meta_data->>'avatar_url', ''),
        nullif(new.raw_user_meta_data->>'picture', '')
      ),
      new_pair_id
    );

  insert into notification_settings (user_id) values (new.id);

  -- デフォルトカテゴリ（src/constants/categories.ts と一致させる）
  insert into categories (pair_id, name_key, icon, color, is_default, sort_order) values
    (new_pair_id,'category.food','restaurant','#FF7A66',true,0),
    (new_pair_id,'category.daily','cart','#0EA5E9',true,1),
    (new_pair_id,'category.transport','bus','#8B5CF6',true,2),
    (new_pair_id,'category.entertainment','game-controller','#EC4899',true,3),
    (new_pair_id,'category.utilities','flash','#F59E0B',true,4),
    (new_pair_id,'category.rent','home','#14B8A6',true,5),
    (new_pair_id,'category.telecom','wifi','#6366F1',true,6),
    (new_pair_id,'category.medical','medkit','#EF4444',true,7),
    (new_pair_id,'category.other','ellipsis-horizontal','#94A3B8',true,8);
  return new;
end; $$;
