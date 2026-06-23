// WeBudget: アカウント削除 Edge Function（Deno）
// 認証ユーザー本人を削除する。共有データは ON DELETE SET NULL で匿名化保持される。
// デプロイ: supabase functions deploy delete-account
// 必要な Secret: SERVICE_ROLE_KEY（自動注入される SUPABASE_SERVICE_ROLE_KEY を使用）
//
// 注: このファイルは Deno ランタイム。アプリの tsc 対象外（tsconfig で supabase/ を除外）。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // service_role で本人を削除（profiles は CASCADE、共有データは SET NULL で匿名化）
    const admin = createClient(url, serviceKey);
    const { error } = await admin.auth.admin.deleteUser(userData.user.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
