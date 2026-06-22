# タイポグラフィ定義（WE BUDGET）

`_defaults` を踏襲。iOS標準に馴染むサイズ設計で、**Dynamic Type に追従**させる。
ポップな世界観に合わせ、見出しは Bold をしっかり効かせて親しみとメリハリを出す。

## フォントファミリー
- 既定はシステムフォント（iOS: San Francisco / Android: Roboto）。日本語はシステム日本語フォントに自動フォールバック。
- カスタムフォントは必要時のみ（ロゴ・スプラッシュなど局所）。

## タイプスケール
| トークン | サイズ | ウェイト | 行間 | 用途 |
|---------|--------|---------|------|------|
| `display` | 34px | Bold | 1.2 | ホームの金額サマリー等の大表示 |
| `title1` | 28px | Bold | 1.25 | 主要見出し |
| `title2` | 22px | Semibold | 1.3 | セクション見出し |
| `title3` | 20px | Semibold | 1.3 | 小見出し・カード見出し |
| `body` | 17px | Regular | 1.5 | 本文（iOS標準） |
| `callout` | 16px | Regular | 1.5 | 補助本文 |
| `subhead` | 15px | Regular | 1.4 | リストのサブテキスト |
| `footnote` | 13px | Regular | 1.4 | 補足・注釈 |
| `caption` | 12px | Regular | 1.3 | キャプション・ラベル |

## 金額表示（家計簿固有）
- 金額は `display` / `title1` を Bold で使い、視認性を最優先。
- 数値が拡大で崩れる箇所（サマリーカード等）は `maxFontSizeMultiplier`（例 1.4）で上限を設ける。
- 通貨記号・桁区切りを必ず付ける（`Intl.NumberFormat`）。多通貨はコードも併記（例: ¥1,200 / $12.00）。

## 実装方針
- 直値の `fontSize` を禁止。`constants/typography.ts` のトークンを参照する。
- `allowFontScaling`（デフォルトtrue）を維持し、Dynamic Type に追従。
- 行間は `lineHeight` で明示し、日本語の詰まりを防ぐ。
- 1画面で使うスタイルは3〜4種類までに絞り、情報階層を明確にする。
