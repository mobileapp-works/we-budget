/**
 * レシートOCRの生テキスト解析（純粋関数・副作用なし）。
 * 端末内OCR（ML Kit）が返した全文テキストから、合計金額・店名・日付を
 * ヒューリスティックで抽出する。日本語／英語レシート対応。
 *
 * 品質の考え方:
 * - 正規化: 全角数字・全角￥・和暦などOCRが返しがちな表記ゆれを吸収する。
 * - ノイズ除去: 電話番号・日付・レジ番号・バーコード等の「金額でない数字」を
 *   金額抽出の前に行から取り除く（誤読の主因）。
 * - 行分類: 各行を 合計/小計/税/預り/釣り/支払手段/値引き/内訳/明細 に分類し、
 *   信頼度の高い順（合計行 → 預り−釣りの恒等式 → 小計+税 → 支払手段 → 明細価格）で採用する。
 *
 * 完璧な抽出は不可能なので「よくある形式を拾い、外したら null」に倒す。
 * ユーザーが必ず確認・補正する前提（画面側で `expense.ocrReview` を表示）。
 * バグると金額を誤入力するため、ここは receipt.test.ts で厚くテストする。
 */
import dayjs from 'dayjs';
import type { OcrResult, ISODate } from '@/types/models';

// ---------------------------------------------------------------------------
// 正規化
// ---------------------------------------------------------------------------

/** 全角英数・記号を半角へ寄せる（OCRは全角/半角を混在して返す）。 */
function normalizeLine(line: string): string {
  return (
    line
      .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/￥/g, '¥')
      .replace(/[：]/g, ':')
      .replace(/[．]/g, '.')
      .replace(/[，、]/g, ',')
      .replace(/[／]/g, '/')
      .replace(/　/g, ' ')
      // 数字に挟まれた長音・ダッシュ類はハイフンへ（電話番号などの除去パターンを効かせる）
      .replace(/(\d)[ー―‐−–—](?=\d)/g, '$1-')
  );
}

/** 通貨記号つきトークン内の数字誤読（O→0, l/I→1 等）を補正する。 */
function fixCurrencyMisreads(line: string): string {
  return line.replace(/¥\s*[\dOoIl|,]+/g, (token) =>
    token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
  );
}

// ---------------------------------------------------------------------------
// ノイズ除去（金額でない数字を金額抽出の前に消す）
// ---------------------------------------------------------------------------

/** 電話番号・日付・時刻・各種番号・数量など「金額でない数字」を行から取り除く。 */
function stripNonAmountDigits(line: string): string {
  return (
    line
      // 日付（西暦4桁・和暦・年が末尾の順・2桁年）と時刻
      .replace(/20\d{2}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}\s*日?/g, ' ')
      .replace(/(?:令和|平成|[RH])\s*\d{1,2}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}\s*日?/g, ' ')
      .replace(/\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*20\d{2}/g, ' ')
      .replace(/(^|[^\d/.-])\d{2}[/.-]\d{1,2}[/.-]\d{1,2}(?![\d/.-])/g, '$1 ')
      .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
      // 郵便番号・電話番号・インボイス登録番号・バーコード等の長い数字列
      .replace(/〒\s*\d{3}-?\d{4}/g, ' ')
      .replace(/\d{2,4}-\d{2,4}-\d{3,4}/g, ' ')
      .replace(/\bT\d{13}\b/gi, ' ')
      .replace(/\d{8,}/g, ' ')
      // レジ・伝票・会員などの番号
      .replace(/(?:レジ|№|#)\s*[:]?\s*\d+/gi, ' ')
      .replace(/\b(?:no|reg)\.?\s*[:]?\s*\d+/gi, ' ')
      .replace(/(?:番号|伝票|会員|お客様)[^\d]{0,3}\d+/g, ' ')
      // 単価（@150）・数量（×2 / 3点 / 2個）
      .replace(/[@＠]\s*[\d,]+/g, ' ')
      .replace(/[x×]\s*\d+\b/gi, ' ')
      .replace(/\d+\s*[点個](?![\d])/g, ' ')
      // マイナス金額（値引き明細）は合計候補にしない
      .replace(/[-−▲]\s*¥?\s*[\d,]+(?:\.\d{1,2})?/g, ' ')
  );
}

// ---------------------------------------------------------------------------
// 金額抽出
// ---------------------------------------------------------------------------

/** レシートとしてありえない桁の値（バーコード断片など）を弾く上限。 */
const MAX_PLAUSIBLE_AMOUNT = 9_999_999;

/** 金額らしき数値（¥/$ や桁区切り、小数に対応）を全て抜き出す。 */
function extractAmounts(line: string): number[] {
  const out: number[] = [];
  // 例: ¥1,200 / ¥1200 / $12.34 / 1,200円 / 1200
  const re = /(?:[¥$]\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const intPart = m[1]!.replace(/,/g, '');
    const decPart = m[2];
    const value = Number(decPart ? `${intPart}.${decPart}` : intPart);
    if (Number.isFinite(value) && value > 0 && value <= MAX_PLAUSIBLE_AMOUNT) out.push(value);
  }
  return out;
}

/** 桁区切り・通貨記号を伴う「いかにも価格」な数値か（フォールバック時の絞り込み用）。 */
function looksLikePrice(line: string): boolean {
  return /[¥￥$]\s*\d|\d,\d{3}|\d+\s*円|\d\.\d{2}\b/.test(line);
}

// ---------------------------------------------------------------------------
// 行分類
// ---------------------------------------------------------------------------

type LineKind =
  | 'total' // 合計・お会計・税込 など（最有力）
  | 'subtotal' // 小計・税抜合計
  | 'tax' // 消費税・内税・外税
  | 'deposit' // お預り
  | 'change' // おつり
  | 'tender' // 現金・カード・ポイント等の支払手段
  | 'discount' // 割引・値引き（金額は負なので候補にしない）
  | 'breakdown' // 8%対象/10%対象 等の税率内訳（部分和なので候補にしない）
  | 'ignore' // ポイント残高など金額と無関係な行
  | 'item'; // 上記以外（明細行など）

/** 行の役割を分類する（先に判定したものが勝つ。順序に意味がある）。 */
function classifyLine(lower: string): LineKind {
  if (/割引|値引|割戻|クーポン|discount|\boff\b/.test(lower)) return 'discount';
  if (/[%％]\s*対象|課税対象|対象額|対象計/.test(lower)) return 'breakdown';
  if (/ポイント|\bpoints?\b|残高/.test(lower)) return 'ignore';
  if (/お?預か?り|預り/.test(lower)) return 'deposit';
  if (/おつり|お?釣り?|\bchange\b/.test(lower)) return 'change';
  if (/小\s*計|sub\s*total|税抜/.test(lower)) return 'subtotal';
  if (/合\s*計|会計|買\s*上|総額|請求|現計|税込|\btotal\b|amount\s+due|balance\s+due/.test(lower)) {
    return 'total';
  }
  if (/消費税|内税|外税|税額|\btax\b/.test(lower)) return 'tax';
  if (/現金|クレジット|カード|電子マネー|\bcash\b|\bcard\b|paypay|ペイペイ/.test(lower)) {
    return 'tender';
  }
  return 'item';
}

/** 小数の丸め誤差を吸収して比較する（$レシートのセント計算用）。 */
const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 「金額だけの行」か（キーワード行と金額行が分断された場合の次行救済用）。 */
function isAmountOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!/^[¥$]?\s*\d[\d,]*(?:\.\d{1,2})?\s*円?$/.test(t)) return false;
  // 通貨記号・桁区切り・円が無い裸の数字は6桁までに制限（番号類の誤採用を防ぐ）
  if (looksLikePrice(t)) return true;
  return t.replace(/\D/g, '').length <= 6;
}

/**
 * 合計金額を推定する。信頼度の高い順に:
 * 1) 合計行の金額（小計+税と一致する候補があればそれを優先）
 * 2) 預り − 釣り（レシートの恒等式。合計行が読めなくても復元できる）
 * 3) 小計 + 税
 * 4) 支払手段行（現金・カード等には合計額が載ることが多い）
 * 5) 価格らしい明細の最大額 → 明細中の最大値
 */
function parseAmount(lines: string[]): number | null {
  const totals: number[] = [];
  const tenders: number[] = [];
  const prices: number[] = [];
  const items: number[] = [];
  const taxes: number[] = [];
  let subtotal: number | null = null;
  let deposit: number | null = null;
  let change: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const kind = classifyLine(line.toLowerCase());
    if (kind === 'discount' || kind === 'breakdown' || kind === 'ignore') continue;

    const amounts = extractAmounts(stripNonAmountDigits(line));

    // 合計キーワード行に金額が無い場合、直後の「金額だけの行」を救済する
    // （2列組みレシートで座標復元が効かなかったときの保険）。
    if (amounts.length === 0) {
      if (kind === 'total' && !/\d/.test(stripNonAmountDigits(line))) {
        const next = lines[i + 1];
        if (next && isAmountOnlyLine(next)) {
          const rescued = extractAmounts(stripNonAmountDigits(next));
          if (rescued.length > 0) totals.push(Math.max(...rescued));
        }
      }
      continue;
    }

    const maxOnLine = Math.max(...amounts);
    switch (kind) {
      case 'total':
        totals.push(maxOnLine);
        break;
      case 'subtotal':
        subtotal = Math.max(subtotal ?? 0, maxOnLine);
        break;
      case 'tax':
        taxes.push(maxOnLine);
        break;
      case 'deposit':
        deposit = Math.max(deposit ?? 0, maxOnLine);
        break;
      case 'change':
        change = Math.max(change ?? 0, maxOnLine);
        break;
      case 'tender':
        tenders.push(maxOnLine);
        break;
      default:
        items.push(maxOnLine);
        if (looksLikePrice(line)) prices.push(maxOnLine);
    }
  }

  // 小計+税の期待値（税行が複数=軽減税率のときは各値と合算の両方を試す）
  const expectedTotals: number[] = [];
  if (subtotal !== null && taxes.length > 0) {
    for (const tax of taxes) expectedTotals.push(round2(subtotal + tax));
    if (taxes.length > 1) expectedTotals.push(round2(subtotal + taxes.reduce((a, b) => a + b, 0)));
  }

  if (totals.length > 0) {
    // 合計行の候補のうち、小計+税と一致するものがあれば最優先（誤読の最大値を避ける）
    for (const expected of expectedTotals) {
      if (totals.some((t) => nearlyEqual(t, expected))) return expected;
    }
    return Math.max(...totals);
  }
  if (deposit !== null && change !== null && deposit > change) return round2(deposit - change);
  if (expectedTotals.length === 1) return expectedTotals[0]!;
  if (tenders.length > 0) return Math.max(...tenders);
  if (prices.length > 0) return Math.max(...prices);
  if (items.length > 0) return Math.max(...items);
  return null;
}

// ---------------------------------------------------------------------------
// 日付
// ---------------------------------------------------------------------------

interface DateHit {
  index: number;
  priority: number;
  iso: string;
}

/** 妥当な暦日なら ISO 文字列を返す（2月30日などは弾く）。 */
function toValidIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return dayjs(iso).format('YYYY-MM-DD') === iso ? iso : null;
}

/**
 * 日付を 'YYYY-MM-DD' で推定する。
 * 対応: 2026/07/04・2026年7月4日・令和8年7月4日・R8.7.4・04/07/2026・26/07/04（YY/MM/DD）。
 * テキスト先頭に近い日付を優先する（レシート下部のポイント有効期限などを避ける）。
 */
function parseDate(text: string): ISODate | null {
  const hits: DateHit[] = [];

  // 西暦4桁: 2026/07/04・2026年7月4日・2026-7-4・2026.07.04
  const seireki = /(20\d{2})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = seireki.exec(text)) !== null) {
    const iso = toValidIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) hits.push({ index: m.index, priority: 0, iso });
  }

  // 和暦: 令和8年7月4日・R8.7.4・平成31年4月30日・H31.4.30
  const wareki = /(令和|平成|[RH])\s*(\d{1,2})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/g;
  while ((m = wareki.exec(text)) !== null) {
    const era = m[1] === '令和' || m[1] === 'R' ? 2018 : 1988;
    const iso = toValidIso(era + Number(m[2]), Number(m[3]), Number(m[4]));
    if (iso) hits.push({ index: m.index, priority: 1, iso });
  }

  // 年が末尾: 04/07/2026（MM/DD を優先し、暦日でなければ DD/MM で再解釈）
  const yearLast = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(20\d{2})/g;
  while ((m = yearLast.exec(text)) !== null) {
    const iso =
      toValidIso(Number(m[3]), Number(m[1]), Number(m[2])) ??
      toValidIso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (iso) hits.push({ index: m.index, priority: 2, iso });
  }

  // 2桁年: 26/07/04（YY/MM/DD）。妥当な近過去〜翌年の範囲のみ採用する。
  const shortYear = /(^|[^\d/.-])(\d{2})[/.-](\d{1,2})[/.-](\d{1,2})(?![\d/.-])/g;
  const maxYear = dayjs().year() + 1;
  while ((m = shortYear.exec(text)) !== null) {
    const year = 2000 + Number(m[2]);
    if (year < 2015 || year > maxYear) continue;
    const iso = toValidIso(year, Number(m[3]), Number(m[4]));
    if (iso) hits.push({ index: m.index + m[1]!.length, priority: 3, iso });
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => a.index - b.index || a.priority - b.priority);
  return hits[0]!.iso;
}

// ---------------------------------------------------------------------------
// 店名
// ---------------------------------------------------------------------------

/** 店名候補から除外する行のパターン（住所・挨拶・帳票名・番号類など）。 */
const STORE_SKIP_PATTERNS: RegExp[] = [
  /^[\d\s./年月日:ー―‐−-]+$/, // 数字・日付のみの行
  /^(tel|fax|電話|℡|〒|http|www)/i,
  /^\d{3}-\d{4}/, // 郵便番号
  /^(東京都|北海道|大阪府|京都府|[一-龠]{2,3}県)/, // 住所（都道府県はじまり)
  /^(領収書|領収証|レシート|明細|お買上票|御買上票|calculation|receipt|invoice)/i,
  /いらっしゃいませ|ありがとうございま|またのご来店|ご来店|ご利用/,
  /^[*=\-_#☆★♪~〜]+$/, // 飾り罫線
  /営業時間|定休日|\bopen\b/i,
  /登録番号|レジ\s*[:#№]?\s*\d|責任者|担当/,
];

/** 店名を推定する（先頭付近の、住所・挨拶・数字類でない最初の意味のある行）。 */
function parseStoreName(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;
    if (looksLikePrice(trimmed)) continue;
    if (STORE_SKIP_PATTERNS.some((re) => re.test(trimmed))) continue;
    return trimmed.slice(0, 40);
  }
  return null;
}

// ---------------------------------------------------------------------------
// エントリポイント
// ---------------------------------------------------------------------------

/**
 * レシート全文テキストを解析して構造化する。
 * 抽出できない項目は null。rawText はそのまま保持する。
 */
export function parseReceiptText(rawText: string): OcrResult {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const normLines = rawLines.map((l) => fixCurrencyMisreads(normalizeLine(l)));
  return {
    amount: parseAmount(normLines),
    storeName: parseStoreName(rawLines),
    date: parseDate(normLines.join('\n')),
    rawText,
  };
}
