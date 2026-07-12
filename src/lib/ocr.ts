/**
 * 端末内OCR（Google ML Kit / オンデバイス）。
 * レシート写真から文字を読み取る。オフラインで動作し、画像は端末外に送信されない・無料・iOS/Android両対応。
 *
 * 日本語スクリプトモデルはラテン文字（数字・英字）も同時に認識するため、
 * 日本語レシートも英語レシートも Japanese 指定ひとつでカバーできる。
 *
 * 品質のポイント: `result.text` をそのまま使わず、行のバウンディングボックスから
 * 「物理的な行」を再構成する（reconstructRows）。レシートは品名（左）と金額（右）の
 * 2列組みが多く、ML Kit は列ごとに別ブロックで返すことがある。その場合 `result.text` は
 * 「ラベル全部 → 金額全部」の順になり、「合計」と金額の紐付けに失敗するため。
 *
 * ネイティブモジュールは development / production ビルド（EAS または prebuild）でのみ有効。
 * Expo Go では未リンクのため、開発時に限りサンプルテキストへフォールバックして UI を確認できるようにする。
 */
import dayjs from 'dayjs';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { reconstructRows } from '@/utils/ocrRows';
import type { OcrTextLine } from '@/utils/ocrRows';

/** Expo Go 等でネイティブが無い時に、自動入力フローを確認するためのサンプルレシート。 */
function sampleReceiptText(): string {
  return [
    'セブンイレブン 渋谷店',
    `${dayjs().format('YYYY年M月D日')} 19:32`,
    'おにぎり ￥150',
    'お茶 ￥130',
    '小計 ￥280',
    '消費税 ￥22',
    '合計 ￥302',
    'お預り ￥1,000',
    'おつり ￥698',
  ].join('\n');
}

/**
 * 画像URI（file://...）を端末内OCRにかけ、テキスト候補の配列を返す。
 * 「座標から再構成した物理行」版と「ML Kit の並び順」版の両方を返し、
 * 抽出（parseReceiptCandidates）側が合計の確度が高い方を選ぶ。
 * レシートによって座標再構成が効くもの・標準の読み順が正しいものが分かれるため、両にらみにする。
 */
export async function recognizeReceiptText(imageUri: string): Promise<string[]> {
  try {
    // Japanese モデルは和文＋ラテン文字の両方を認識する。
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.JAPANESE);
    const lines: OcrTextLine[] = result.blocks.flatMap((block) =>
      block.lines.map((line) => ({ text: line.text, frame: line.frame }))
    );
    // 座標が取れないとき（環境差）は reconstructRows が null を返すので標準テキストのみになる。
    const reconstructed = reconstructRows(lines) ?? '';
    const plain = result.text ?? '';
    const candidates = [reconstructed, plain].map((t) => t.trim()).filter((t) => t.length > 0);
    return Array.from(new Set(candidates)); // 同一テキストは重複除去
  } catch (e) {
    // Expo Go 等でネイティブ未リンクの場合、開発時のみサンプルで動かす（本番ビルドでは実際に読み取る）。
    if (__DEV__) return [sampleReceiptText()];
    throw e;
  }
}
