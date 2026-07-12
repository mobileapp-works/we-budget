// WeBudget: Sign in with Apple のトークン連携 Edge Function（Deno）
// サインイン直後にクライアントから authorization_code を受け取り、
// refresh_token へ交換して apple_tokens に保管する（後日のアカウント削除時に revoke するため）。
//
// Apple シークレット（_shared/apple.ts 参照）が未設定なら { skipped: true } を返して no-op。
// クライアントは fire-and-forget で呼ぶため、失敗してもログインには影響しない。
//
// デプロイ: supabase functions deploy apple-link
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appleConfigured, exchangeAuthCode } from '../_shared/apple.ts';

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const url = Deno.env.get('SUPABASE_URL')!;

    // 呼び出しユーザーを特定
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response('Unauthorized', { status: 401 });

    // Apple 未設定なら何もしない（現状維持）。
    if (!appleConfigured()) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { authorizationCode } = await req.json().catch(() => ({ authorizationCode: null }));
    if (!authorizationCode || typeof authorizationCode !== 'string') {
      return new Response(JSON.stringify({ error: 'authorizationCode required' }), { status: 400 });
    }

    const refreshToken = await exchangeAuthCode(authorizationCode);
    if (!refreshToken) {
      // 交換できなくても致命的ではない（削除時 revoke ができないだけ）。
      return new Response(JSON.stringify({ ok: true, stored: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin
      .from('apple_tokens')
      .upsert({ user_id: userData.user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ ok: true, stored: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
