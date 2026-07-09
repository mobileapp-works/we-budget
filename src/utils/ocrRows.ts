/**
 * OCR結果（行＋バウンディングボックス）から「物理的な行」を再構成する純粋関数。
 *
 * レシートは「品名（左）… 金額（右）」の2列組みが多く、ML Kit はこれを
 * 左右別々のブロックとして返すことがある。その場合 `result.text` は
 * 「ラベル全部 → 金額全部」の順になり、行単位のキーワード照合
 * （例:「合計」と「¥302」の紐付け）が全滅する。
 * ここで Y 座標が重なる行を1本に結合し、読み順（上→下、左→右）のテキストに直す。
 */

/** ML Kit の TextLine に相当する最小構造（ネイティブ型に依存しない）。 */
export interface OcrTextLine {
  text: string;
  /** バウンディングボックス。取得できない環境では undefined。 */
  frame?: { top: number; left: number; width: number; height: number };
}

interface PlacedLine {
  text: string;
  left: number;
  top: number;
  bottom: number;
  height: number;
}

interface Row {
  top: number;
  bottom: number;
  items: PlacedLine[];
}

/** 2つの縦区間の重なり量（重ならなければ 0 以下）。 */
function verticalOverlap(aTop: number, aBottom: number, bTop: number, bBottom: number): number {
  return Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
}

/**
 * 行断片を物理行へグルーピングし、読み順のテキスト（行ごとに改行）へ整形する。
 * frame が1つでも欠けている場合は座標に基づく再構成ができないため null を返す
 * （呼び出し側は ML Kit の `result.text` へフォールバックする）。
 */
export function reconstructRows(lines: OcrTextLine[]): string | null {
  const placed: PlacedLine[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    if (!line.frame) return null;
    placed.push({
      text,
      left: line.frame.left,
      top: line.frame.top,
      bottom: line.frame.top + line.frame.height,
      height: line.frame.height,
    });
  }
  if (placed.length === 0) return '';

  // 上から順に走査し、縦方向に十分重なる断片を同じ行へまとめる。
  // 「中心距離」ではなく「重なり率」で判定する（写真の傾きに多少強い）。
  placed.sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: Row[] = [];
  for (const line of placed) {
    const row = rows[rows.length - 1];
    if (row) {
      const overlap = verticalOverlap(row.top, row.bottom, line.top, line.bottom);
      const minH = Math.min(line.height, row.bottom - row.top);
      if (overlap > minH * 0.45) {
        row.items.push(line);
        // 行の縦範囲は広げすぎない（傾きで行が連鎖結合するのを防ぐため交差範囲へ寄せる）。
        row.top = Math.max(row.top, line.top);
        row.bottom = Math.min(row.bottom, line.bottom);
        continue;
      }
    }
    rows.push({ top: line.top, bottom: line.bottom, items: [line] });
  }

  return rows
    .map((row) =>
      row.items
        .sort((a, b) => a.left - b.left)
        .map((i) => i.text)
        .join(' ')
    )
    .join('\n');
}
