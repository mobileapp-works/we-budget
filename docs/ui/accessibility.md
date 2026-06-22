# アクセシビリティ定義（WE BUDGET）

`_defaults`（全アプリ共通）を踏襲。一定水準を必ず満たす。ユーザビリティ向上であると同時に App Store の品質評価にも効く。

## 必須ルール
| 項目 | 基準 |
|------|------|
| ラベル | すべての操作可能要素に `accessibilityLabel` |
| ロール | `accessibilityRole`（button / link / header / image / switch など）を正しく指定 |
| ヒント | 複雑な操作には `accessibilityHint`（例: 立替残高カード「精算画面を開く」） |
| 状態 | `accessibilityState`（selected / disabled / checked / busy）を反映 |
| タップ領域 | 最低 **44×44pt** |
| コントラスト | **WCAG AA**（通常 4.5:1 / 大きい文字 3:1）以上 |
| 文字拡大 | Dynamic Type に追従（`allowFontScaling`） |
| 動きの軽減 | Reduce Motion 設定に追従 |

## 本アプリで特に注意する点
- **お金の損益を色だけで伝えない**: プラス/マイナスは「＋ / −」記号やアイコンを併用（コーラル/グリーンが見分けにくい色覚特性に配慮）。
- **予算の状態**（安全/警告/超過）も色＋アイコン＋パーセント表記の3点で伝える。
- **金額の読み上げ**: 「3,200円、あなたが受け取り」のように、数値＋意味をまとめて読み上げる（`accessibilityLabel` を組み立てる）。
- **支払い者セグメント**: 選択中を `accessibilityState={{ selected }}` で反映。

## アイコンボタンの例
```tsx
<Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')}>
  <TrashIcon />
</Pressable>
```

## 動的コンテンツの読み上げ
- 支出保存・精算完了・エラーなど画面変化は読み上げに通知する。
```tsx
import { AccessibilityInfo } from 'react-native';
AccessibilityInfo.announceForAccessibility(t('home.saved'));
```

## グルーピング
- 関連要素（カテゴリアイコン + 店名 + 金額）は `accessible={true}` でまとめ、1つの読み上げにする。
- 装飾画像は `accessibilityElementsHidden` / `importantForAccessibility="no"` で読み上げ対象から外す。

## 検証
- リリース前に **VoiceOver を実機で有効化**し、支出入力→精算の主要フローを耳だけで操作できるか確認。
- 文字サイズ最大でレイアウト崩れがないか確認（特に金額サマリー）。
- 色覚特性シミュレーションで「色だけ依存」がないか確認。
