/** レシートOCR（端末内） — 画像URI → 端末内OCR → 金額・店名・日付の抽出。 */
import { useMutation } from '@tanstack/react-query';
import { recognizeReceiptText } from '@/lib/ocr';
import { parseReceiptText } from '@/utils';
import type { OcrResult } from '@/types/models';

/**
 * レシート画像(URI)を端末内OCRにかけ、抽出結果を返す。
 * OCR自体はオフライン・無料（ML Kit）。結果はフォームへ自動入力する用途（キャッシュ不要のため useMutation）。
 */
export function useReceiptOcr() {
  return useMutation<OcrResult, Error, string>({
    mutationFn: async (imageUri: string) => {
      const rawText = await recognizeReceiptText(imageUri);
      return parseReceiptText(rawText);
    },
  });
}
