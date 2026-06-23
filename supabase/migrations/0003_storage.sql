-- WeBudget: Storage バケットとポリシー
-- 出典: docs/design.md（receipts=private / avatars=public）

-- バケット作成
insert into storage.buckets (id, name, public)
  values ('receipts','receipts', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('avatars','avatars', true)
  on conflict (id) do nothing;

-- レシート画像: パスを `{pair_id}/{file}` とし、自分のペアのみ読み書き可
-- （アップロード時のパス先頭フォルダを pair_id にすること）
create policy "receipts read own pair" on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = get_my_pair_id()::text);
create policy "receipts insert own pair" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = get_my_pair_id()::text);
create policy "receipts delete own pair" on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = get_my_pair_id()::text);

-- アバター: 読み取りは public、書き込みはパス先頭が自分の user_id のときのみ
create policy "avatars public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars write own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
