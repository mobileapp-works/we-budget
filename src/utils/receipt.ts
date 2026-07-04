/**
 * レシートOCRの生テキスト解析（純粋関数・副作用なし）。
 * Edge Function `ocr-receipt` が Google Cloud Vision から得た全文テキストを受け取り、
 * 合計金額・店名・日付をヒューリスティックで抽出する。日本語／英語レシート対応。
 *
 * 完璧な抽出は不可能なので「よくある形式を拾い、外したら null」に倒す。
 * ユーザーが必ず確認・補正する前提（画面側で `expense.ocrReview` を表示）。
 * バグると金額を誤入力するため、ここは receipt.test.ts で厚くテストする。
 */
import dayjs from 'dayjs';
import type { OcrResult, ISODate } from '@/types/models';

/** 合計金額を示す見出し語（優先度高。小計/subtotal はここに入れない）。 */
const TOTAL_KEYWORDS = [
  '合計',
  '合 計',
  'ご合計',
  'お会計',
  'お買上',
  'お買い上げ',
  '総計',
  '総額',
  '請求',
  '現計',
  'total',
  'amount due',
  'balance due',
  'grand total',
];

/** 合計行の候補から除外したい語（預り金・釣り銭・税・ポイント等）。 */
const EXCLUDE_KEYWORDS = [
  '小計',
  'subtotal',
  'sub total',
  'お預',
  'お預り',
  'お預かり',
  '預り',
  'おつり',
  'お釣',
  '釣り',
  'change',
  '現金',
  'cash',
  'ポイント',
  'point',
  'カード',
  'card',
  '消費税',
  '内税',
  '外税',
  'tax',
];

/** 金額らしき数値（￥/¥/$ や桁区切り、小数に対応）を全て抜き出す。 */
function extractAmounts(line: string): number[] {
  const out: number[] = [];
  // 例: ￥1,200 / ¥1200 / $12.34 / 1,200円 / 1200
  const re = /(?:[¥￥$]\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const intPart = m[1]!.replace(/,/g, '');
    const decPart = m[2];
    const value = Number(decPart ? `${intPart}.${decPart}` : intPart);
    if (Number.isFinite(value) && value > 0) out.push(value);
  }
  return out;
}

/** 桁区切り・通貨記号を伴う「いかにも価格」な数値か（フォールバック時の絞り込み用）。 */
function looksLikePrice(line: string): boolean {
  return /[¥￥$]\s*\d|\d,\d{3}|\d円|\d\.\d{2}\b/.test(line);
}

const hasKeyword = (lower: string, words: string[]): boolean => words.some((w) => lower.includes(w));

/**
 * 合計金額を推定する。
 * 1) 合計見出し語を含み・除外語を含まない行の最大額を採用。
 * 2) 無ければ「価格らしい」行の最大額。
 * 3) それも無ければ全行の最大額。
 */
function parseAmount(lines: string[]): number | null {
  const totalCandidates: number[] = [];
  const priceCandidates: number[] = [];
  const allCandidates: number[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;
    const maxOnLine = Math.max(...amounts);
    allCandidates.push(maxOnLine);
    if (looksLikePrice(line)) priceCandidates.push(maxOnLine);
    if (hasKeyword(lower, TOTAL_KEYWORDS) && !hasKeyword(lower, EXCLUDE_KEYWORDS)) {
      totalCandidates.push(maxOnLine);
    }
  }

  if (totalCandidates.length > 0) return Math.max(...totalCandidates);
  if (priceCandidates.length > 0) return Math.max(...priceCandidates);
  if (allCandidates.length > 0) return Math.max(...allCandidates);
  return null;
}

/**
 * 日付を 'YYYY-MM-DD' で推定する。
 * 対応: 2026/07/04・2026-7-4・2026.07.04・2026年7月4日。
 * 妥当な暦日のみ返す（dayjs で検証）。複数あれば最初の妥当な日付。
 */
function parseDate(text: string): ISODate | null {
  const re = /(20\d{2})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, y, mo, d] = m;
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const iso = `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
    // 2月30日等の存在しない日を弾く（往復一致で検証）。customParseFormat 非依存。
    if (dayjs(iso).format('YYYY-MM-DD') === iso) return iso;
  }
  return null;
}

/** 店名を推定する（先頭付近の、日付でも金額でもない最初の意味のある行）。 */
function parseStoreName(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;
    if (looksLikePrice(trimmed)) continue;
    if (/^\d[\d\s./年月日:-]*$/.test(trimmed)) continue; // 日付・数字のみの行
    if (/^(tel|電話|fax|〒|http)/i.test(trimmed)) continue;
    return trimmed.slice(0, 40);
  }
  return null;
}

/**
 * レシート全文テキストを解析して構造化する。
 * 抽出できない項目は null。rawText はそのまま保持する。
 */
export function parseReceiptText(rawText: string): OcrResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return {
    amount: parseAmount(lines),
    storeName: parseStoreName(lines),
    date: parseDate(rawText),
    rawText,
  };
}
