/**
 * 端末内OCR（Google ML Kit / オンデバイス）。
 * レシート写真から文字を読み取る。オフラインで動作し、画像は端末外に送信されない・無料・iOS/Android両対応。
 *
 * 日本語スクリプトモデルはラテン文字（数字・英字）も同時に認識するため、
 * 日本語レシートも英語レシートも Japanese 指定ひとつでカバーできる。
 *
 * ネイティブモジュールは development / production ビルド（EAS または prebuild）でのみ有効。
 * Expo Go では未リンクのため、開発時に限りサンプルテキストへフォールバックして UI を確認できるようにする。
 */
import dayjs from 'dayjs';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

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
 * 画像URI（file://...）を端末内OCRにかけ、認識した全文テキストを返す。
 * 抽出（金額/店名/日付）は呼び出し側の parseReceiptText が担う。
 */
export async function recognizeReceiptText(imageUri: string): Promise<string> {
  try {
    // Japanese モデルは和文＋ラテン文字の両方を認識する。
    const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.JAPANESE);
    return result.text ?? '';
  } catch (e) {
    // Expo Go 等でネイティブ未リンクの場合、開発時のみサンプルで動かす（本番ビルドでは実際に読み取る）。
    if (__DEV__) return sampleReceiptText();
    throw e;
  }
}
