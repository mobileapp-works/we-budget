-- WeBudget: カテゴリアイコン用の Storage バケットとポリシー
-- カスタムのカテゴリ写真をペアで共有表示するため、public 読み取り + pair 単位の書き込み。
-- パスは `{pair_id}/{file}` とし、ポリシーで pair_id = get_my_pair_id() を判定する。

insert into storage.buckets (id, name, public)
  values ('category-icons','category-icons', true)
  on conflict (id) do nothing;

-- 読み取りは public（アプリ表示・パートナー共有のため）
create policy "category-icons public read" on storage.objects for select
  using (bucket_id = 'category-icons');

-- 書き込み・更新・削除はパス先頭フォルダが自分のペアのときのみ
create policy "category-icons insert own pair" on storage.objects for insert
  with check (bucket_id = 'category-icons' and (storage.foldername(name))[1] = get_my_pair_id()::text);
create policy "category-icons update own pair" on storage.objects for update
  using (bucket_id = 'category-icons' and (storage.foldername(name))[1] = get_my_pair_id()::text);
create policy "category-icons delete own pair" on storage.objects for delete
  using (bucket_id = 'category-icons' and (storage.foldername(name))[1] = get_my_pair_id()::text);
