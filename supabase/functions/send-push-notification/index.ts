// WeBudget: プッシュ通知送信 Edge Function（Deno）
// notifications 行の INSERT を Supabase Database Webhook で受け、対象ユーザーの
// expo_push_token 宛に Expo Push を送る。直接呼び出し（{ userId, title, body }）も可。
//
// デプロイ:  supabase functions deploy send-push-notification
// 必要な Secret: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（自動注入）
// 任意の Secret: PUSH_WEBHOOK_SECRET（設定時は x-webhook-secret ヘッダ一致を必須にする）
//
// Webhook 設定（ダッシュボード）: Database > Webhooks > table=notifications / event=INSERT
//   → HTTP Request でこの関数の URL を指定し、header x-webhook-secret を付ける。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** notifications.type → notification_settings の該当カラム。false なら送らない。 */
const SETTING_COLUMN: Record<string, string> = {
  expense_added: 'expense_added',
  expense_edited: 'expense_edited',
  expense_deleted: 'expense_deleted',
  settlement: 'settlement',
  reminder_variable: 'reminder_variable',
  budget_alert: 'budget_alert',
  settlement_reminder: 'settlement_reminder',
};

Deno.serve(async (req: Request) => {
  try {
    // 任意: Webhook シークレット検証（設定されている場合のみ）。
    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return json({ error: 'unauthorized' }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    // Supabase Webhook 形式（record）と直接呼び出し形式の両対応。
    const record = payload?.record ?? null;
    const userId: string | undefined = record?.user_id ?? payload?.userId;
    const title: string | undefined = record?.title ?? payload?.title;
    const body: string | undefined = record?.body ?? payload?.body;
    const type: string | null = record?.type ?? payload?.type ?? null;
    const notificationId: string | null = record?.id ?? null;

    if (!userId || !title) return json({ error: 'userId/title required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 受信者の設定で該当種別が OFF なら送らない（アプリ内通知は残る）。
    if (type && SETTING_COLUMN[type]) {
      const { data: settings } = await admin
        .from('notification_settings')
        .select(SETTING_COLUMN[type])
        .eq('user_id', userId)
        .maybeSingle();
      if (settings && (settings as Record<string, boolean>)[SETTING_COLUMN[type]] === false) {
        return json({ skipped: 'setting off' });
      }
    }

    const { data: profile } = await admin.from('profiles').select('expo_push_token').eq('id', userId).single();
    const token = profile?.expo_push_token;
    if (!token) return json({ skipped: 'no token' });

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        data: { type, notificationId },
      }),
    });
    const result = await res.json();
    return json({ sent: true, result });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
