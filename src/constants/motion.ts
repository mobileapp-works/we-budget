/**
 * モーション（アニメーション時間）トークン。
 * 出典: docs/ui/motion.md。過度な動きを避け、自然で素早い体感にする。
 * Reduce Motion 設定時は呼び出し側でフェードのみ/最小化する。
 */
export const duration = {
  instant: 100, // 押下フィードバック
  fast: 200, // トグル・チップ選択
  normal: 300, // 画面遷移・モーダル
  slow: 450, // 大きなレイアウト変化
} as const;

export type DurationToken = keyof typeof duration;
