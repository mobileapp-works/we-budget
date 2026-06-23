// WeBudget: プッシュ通知送信 Edge Function（Deno）— 雛形
// notifications 行作成時などに呼び出し、対象ユーザーの expo_push_token 宛に Expo Push を送る。
// デプロイ: supabase functions deploy send-push-notification
//
// 注: Deno ランタイム。アプリの tsc 対象外。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const { userId, title, body, data } = await req.json();
    if (!userId || !title) return new Response(JSON.stringify({ error: 'userId/title required' }), { status: 400 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await admin.from('profiles').select('expo_push_token').eq('id', userId).single();
    const token = profile?.expo_push_token;
    if (!token) return new Response(JSON.stringify({ skipped: 'no token' }), { headers: { 'Content-Type': 'application/json' } });

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data }),
    });
    const json = await res.json();
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
