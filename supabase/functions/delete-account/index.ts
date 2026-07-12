// WeBudget: アカウント削除 Edge Function（Deno）
// 認証ユーザー本人を削除する。共有データは ON DELETE SET NULL で匿名化保持される。
// 併せて、本人固有のアバター画像（avatars/{user_id}/…）を Storage から物理削除する。
// レシート画像（receipts/{pair_id}/…）はペア共有データのため、パートナー側に残す設計。
//
// デプロイ: supabase functions deploy delete-account
// 必要な Secret: SERVICE_ROLE_KEY（自動注入される SUPABASE_SERVICE_ROLE_KEY を使用）
//
// Sign in with Apple 利用者は、Apple の要件によりアカウント削除時にトークンを失効(revoke)する。
// 保管済み refresh_token（apple_tokens）と Apple シークレットが揃うときのみ実行し、未設定なら skip。
//
// 注: このファイルは Deno ランタイム。アプリの tsc 対象外（tsconfig で supabase/ を除外）。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appleConfigured, revokeToken } from '../_shared/apple.ts';

/** avatars バケットから user_id 配下のオブジェクトを削除する（失敗しても削除処理は続行）。 */
async function deleteUserAvatars(admin: ReturnType<typeof createClient>, userId: string): Promise<void> {
  try {
    const { data: files, error } = await admin.storage.from('avatars').list(userId, { limit: 100 });
    if (error || !files || files.length === 0) return;
    const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
    await admin.storage.from('avatars').remove(paths);
  } catch {
    // Storage の後始末はベストエフォート。ここでの失敗でアカウント削除自体は止めない。
  }
}

/** Sign in with Apple のトークンを失効する（保管済み refresh_token がある場合のみ）。 */
async function revokeAppleIfLinked(admin: ReturnType<typeof createClient>, userId: string): Promise<void> {
  if (!appleConfigured()) return;
  try {
    const { data } = await admin.from('apple_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
    const token = (data as { refresh_token?: string } | null)?.refresh_token;
    if (token) await revokeToken(token);
  } catch {
    // revoke 失敗でアカウント削除自体は止めない。
  }
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 呼び出しユーザーを特定（anon clientでトークンからユーザー取得）
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response('Unauthorized', { status: 401 });

    const admin = createClient(url, serviceKey);

    // Sign in with Apple のトークンを失効（Apple の削除要件）。apple_tokens は user 削除で CASCADE。
    await revokeAppleIfLinked(admin, userData.user.id);

    // 本人固有のアバター画像を先に削除（auth ユーザー削除では Storage は消えないため）。
    await deleteUserAvatars(admin, userData.user.id);

    // service_role で本人を削除（profiles は CASCADE、共有データは SET NULL で匿名化）
    const { error } = await admin.auth.admin.deleteUser(userData.user.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
