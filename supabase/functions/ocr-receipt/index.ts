// WeBudget: レシートOCR Edge Function（Deno）— 雛形
// レシート画像(base64)を受け取り、Google Cloud Vision で金額/店名/日付を抽出して返す。
// デプロイ: supabase functions deploy ocr-receipt
// 必要な Secret: GOOGLE_VISION_API_KEY（クライアントには出さない）
//
// 注: 実運用では Vision のレスポンス解析（正規表現で合計金額・日付抽出）を実装する。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface OcrResult {
  amount: number | null;
  storeName: string | null;
  date: string | null;
  rawText: string;
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    // 認証チェック
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return new Response('Unauthorized', { status: 401 });

    const { imageBase64 } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: 'imageBase64 required' }), { status: 400 });

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')!;
    const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION' }] }],
      }),
    });
    const visionJson = await visionRes.json();
    const rawText: string = visionJson?.responses?.[0]?.fullTextAnnotation?.text ?? '';

    // TODO: rawText から合計金額・店名・日付を抽出（言語別の正規表現）
    const result: OcrResult = { amount: null, storeName: null, date: null, rawText };
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
