import { parseReceiptText } from './receipt';
import { reconstructRows } from './ocrRows';

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

describe('parseReceiptText - 金額（表記ゆれ・誤読補正）', () => {
  it('全角数字・全角￥・全角カンマを正規化して抽出', () => {
    expect(parseReceiptText('合計 ￥１，２００').amount).toBe(1200);
  });

  it('¥トークン内の O/l を数字に補正（¥1O0 → ¥100）', () => {
    expect(parseReceiptText('合計 ¥1O0').amount).toBe(100);
  });

  it('¥トークン内の l を 1 に補正（¥l,200 → ¥1,200）', () => {
    expect(parseReceiptText('合計 ¥l,200').amount).toBe(1200);
  });
});

describe('parseReceiptText - 金額（ノイズ除去）', () => {
  it('電話番号を金額と誤認しない', () => {
    expect(parseReceiptText('TEL 03-1234-5678\nパン ¥240').amount).toBe(240);
  });

  it('日付・時刻・レジ番号・バーコードを金額と誤認しない', () => {
    const text = '2026/07/04 19:32\nレジ0012 No.345\n4901234567890\n合計 ¥500';
    expect(parseReceiptText(text).amount).toBe(500);
  });

  it('郵便番号を金額と誤認しない', () => {
    expect(parseReceiptText('〒150-0002\nおにぎり ¥150').amount).toBe(150);
  });

  it('数量（×2）や単価（@150）を金額と誤認しない', () => {
    expect(parseReceiptText('お茶 @150 ×2 ¥300\n合計 ¥300').amount).toBe(300);
  });

  it('割引行のマイナス金額は候補にしない', () => {
    expect(parseReceiptText('クーポン割引 -¥500\n食パン ¥240').amount).toBe(240);
  });

  it('ポイント残高を金額と誤認しない', () => {
    expect(parseReceiptText('ポイント残高 12,345P\nコーヒー ¥480').amount).toBe(480);
  });

  it('税率内訳（8%対象など）の部分和を合計と誤認しない', () => {
    const text = '8%対象 ¥216\n10%対象 ¥1,080\n合計 ¥1,296';
    expect(parseReceiptText(text).amount).toBe(1296);
  });

  it('お預り金額をフォールバックで拾わない（合計行が無い場合）', () => {
    expect(parseReceiptText('コーヒー ¥480\nお預り ¥10,000').amount).toBe(480);
  });
});

describe('parseReceiptText - 金額（クロス検証・復元）', () => {
  it('合計行が複数あるとき小計+税と一致する候補を優先（誤読の最大値を避ける）', () => {
    const text = '小計 ¥280\n消費税 ¥22\n合計 ¥802\n合計 ¥302';
    expect(parseReceiptText(text).amount).toBe(302);
  });

  it('合計行が読めなくても 預り−釣り で復元する', () => {
    expect(parseReceiptText('お預り ¥1,000\nおつり ¥698').amount).toBe(302);
  });

  it('合計行が読めなくても 小計+税 で復元する', () => {
    expect(parseReceiptText('小計 ¥280\n消費税 ¥22').amount).toBe(302);
  });

  it('合計語だけの行の直後にある金額のみの行を救済する（列分断の保険）', () => {
    expect(parseReceiptText('合計\n¥302').amount).toBe(302);
  });

  it('支払手段行（クレジット等）は合計が無いときの候補になる', () => {
    expect(parseReceiptText('クレジットカード ¥1,540').amount).toBe(1540);
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

  it('令和表記（令和8年7月4日）を西暦へ', () => {
    expect(parseReceiptText('令和8年7月4日').date).toBe('2026-07-04');
  });

  it('R表記（R8.7.4）を西暦へ', () => {
    expect(parseReceiptText('R8.7.4').date).toBe('2026-07-04');
  });

  it('2桁年（26/07/04 = YY/MM/DD）を西暦へ', () => {
    expect(parseReceiptText('26/07/04').date).toBe('2026-07-04');
  });

  it('年が末尾の形式（04/07/2026）は MM/DD として解釈', () => {
    expect(parseReceiptText('04/07/2026').date).toBe('2026-04-07');
  });

  it('MM/DD として不正なら DD/MM で再解釈（25/12/2026）', () => {
    expect(parseReceiptText('25/12/2026').date).toBe('2026-12-25');
  });

  it('全角数字の日付も認識する', () => {
    expect(parseReceiptText('２０２６年７月４日').date).toBe('2026-07-04');
  });

  it('複数の日付があればテキスト先頭に近いほう（取引日）を採用', () => {
    const text = '2026年7月4日\nポイント有効期限 2027年7月31日';
    expect(parseReceiptText(text).date).toBe('2026-07-04');
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

  it('挨拶・住所の行をスキップして店名を拾う', () => {
    const text = 'いらっしゃいませ\n東京都新宿区西新宿1-1-1\nマルエツ 新宿店';
    expect(parseReceiptText(text).storeName).toBe('マルエツ 新宿店');
  });

  it('「領収書」ヘッダをスキップして店名を拾う', () => {
    expect(parseReceiptText('領収書\nカフェ・ド・パリ').storeName).toBe('カフェ・ド・パリ');
  });

  it('レジ番号・担当者の行は店名にしない', () => {
    const text = 'レジ#0012\n担当: 田中\nローソン 目黒店';
    expect(parseReceiptText(text).storeName).toBe('ローソン 目黒店');
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

describe('reconstructRows - 物理行の再構成', () => {
  const frame = (top: number, left: number, width = 100, height = 20) => ({
    top,
    left,
    width,
    height,
  });

  it('同じ高さにある左右のブロック断片を1行に結合する（左→右の順）', () => {
    // ML Kit が「ラベル列」と「金額列」を別ブロックで返したケース
    const lines = [
      { text: '小計', frame: frame(100, 10) },
      { text: '合計', frame: frame(130, 10) },
      { text: '¥280', frame: frame(101, 300) },
      { text: '¥302', frame: frame(131, 300) },
    ];
    expect(reconstructRows(lines)).toBe('小計 ¥280\n合計 ¥302');
  });

  it('縦に離れた行は別の行のままにする', () => {
    const lines = [
      { text: 'おにぎり ¥150', frame: frame(50, 10) },
      { text: 'お茶 ¥130', frame: frame(80, 10) },
    ];
    expect(reconstructRows(lines)).toBe('おにぎり ¥150\nお茶 ¥130');
  });

  it('少しずれた（傾いた）同一行も重なりが十分なら結合する', () => {
    const lines = [
      { text: '合計', frame: frame(100, 10) },
      { text: '¥302', frame: frame(108, 300) },
    ];
    expect(reconstructRows(lines)).toBe('合計 ¥302');
  });

  it('frame が欠けている行があれば null（呼び出し側でフォールバック）', () => {
    const lines = [{ text: '合計', frame: frame(100, 10) }, { text: '¥302' }];
    expect(reconstructRows(lines)).toBeNull();
  });

  it('空入力は空文字', () => {
    expect(reconstructRows([])).toBe('');
  });

  it('空白のみの断片は無視する', () => {
    const lines = [
      { text: '  ', frame: frame(100, 10) },
      { text: '合計 ¥302', frame: frame(130, 10) },
    ];
    expect(reconstructRows(lines)).toBe('合計 ¥302');
  });
});
