/**
 * スペーシング・角丸トークン。
 * 出典: docs/ui/spacing.md（8ptグリッド / ポップな世界観のため角丸やや大きめ）。
 * 直値の余白・角丸を書かず、必ずこのトークンを参照する。
 */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radius = {
  sm: 10, // ボタン・入力欄
  md: 16, // カード
  lg: 20, // モーダル・シート
  full: 9999, // カプセル・チップ・アバター
} as const;

export type RadiusToken = keyof typeof radius;

/** レイアウト基準値 */
export const layout = {
  screenMargin: spacing.md, // 画面左右マージン
  minTapSize: 44, // タップ可能要素の最小サイズ（pt）
  tabletMaxWidth: 700, // iPad でのコンテンツ最大幅
  bannerHeight: 60, // バナー広告の確保高さ
  tabletBreakpoint: 768, // phone / tablet の境界
} as const;
