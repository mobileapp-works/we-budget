import { parseReceiptText } from './receipt';

// 典型的な日本語レシート（コンビニ想定）
const JP_RECEIPT = `セブンイレブン 渋谷店
東京都渋谷区1-2-3
TEL 03-1234-5678
2026年7月4日 19:32

おにぎり ￥150
お茶 ￥130
小計 ￥280
消費税 ￥22
合計 ￥302
お預り ￥1,000
おつり ￥698`;

// 典型的な英語レシート
const EN_RECEIPT = `WHOLE FOODS MARKET
123 Market St
04/07/2026
Bananas $3.50
Milk $4.20
Subtotal $7.70
Tax $0.62
TOTAL $8.32
Cash $10.00
Change $1.68`;

describe('parseReceiptText - 金額', () => {
  it('日本語レシートで合計を優先して抽出（小計や預り金でない）', () => {
    expect(parseReceiptText(JP_RECEIPT).amount).toBe(302);
  });

  it('英語レシートで TOTAL を抽出（Subtotal/Cash/Change でない）', () => {
    expect(parseReceiptText(EN_RECEIPT).amount).toBe(8.32);
  });

  it('桁区切りありの合計を正しく数値化', () => {
    expect(parseReceiptText('合計 ￥12,800').amount).toBe(12800);
  });

  it('「円」表記の合計も拾う', () => {
    expect(parseReceiptText('ご合計 1,480円').amount).toBe(1480);
  });

  it('合計語が無ければ価格らしい最大額をフォールバック採用', () => {
    const text = 'コーヒー ￥480\nケーキ ￥620';
    expect(parseReceiptText(text).amount).toBe(620);
  });

  it('金額が全く無ければ null', () => {
    expect(parseReceiptText('ありがとうございました').amount).toBeNull();
  });
});

describe('parseReceiptText - 日付', () => {
  it('YYYY年M月D日 を ISO へ', () => {
    expect(parseReceiptText('2026年7月4日').date).toBe('2026-07-04');
  });

  it('スラッシュ区切り YYYY/MM/DD', () => {
    expect(parseReceiptText('日付 2026/12/31').date).toBe('2026-12-31');
  });

  it('ハイフン区切り', () => {
    expect(parseReceiptText('2026-01-09').date).toBe('2026-01-09');
  });

  it('存在しない日付（2月30日）は採用しない', () => {
    expect(parseReceiptText('2026/02/30').date).toBeNull();
  });

  it('範囲外の月は採用しない', () => {
    expect(parseReceiptText('2026/13/01').date).toBeNull();
  });

  it('日付が無ければ null', () => {
    expect(parseReceiptText('合計 ￥500').date).toBeNull();
  });
});

describe('parseReceiptText - 店名', () => {
  it('先頭の意味のある行を店名とする', () => {
    expect(parseReceiptText(JP_RECEIPT).storeName).toBe('セブンイレブン 渋谷店');
  });

  it('価格・日付のみの行は店名にしない', () => {
    const text = '￥1,200\n2026/07/04\nスターバックス';
    expect(parseReceiptText(text).storeName).toBe('スターバックス');
  });
});

describe('parseReceiptText - rawText 保持', () => {
  it('入力テキストをそのまま rawText に保持する', () => {
    expect(parseReceiptText(JP_RECEIPT).rawText).toBe(JP_RECEIPT);
  });

  it('空文字は全項目 null', () => {
    const r = parseReceiptText('');
    expect(r.amount).toBeNull();
    expect(r.storeName).toBeNull();
    expect(r.date).toBeNull();
  });
});
