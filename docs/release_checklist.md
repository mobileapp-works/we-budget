# WeBudget リリース準備 総合チェックリスト

作成: 2026-07-12 / 対象: App Store 初回リリース v1.0.0（iOS 先行）
関連: [pre_release_audit.md](pre_release_audit.md)（監査） / [.skills/08_aso/SKILL.md](../.skills/08_aso/SKILL.md) / [.skills/09_release/SKILL.md](../.skills/09_release/SKILL.md)

> このファイルが**リリース準備の唯一の進捗表**。このスレッドで1項目ずつ精査 → 状態を更新していく。
> 状態凡例: ✅ 済 / 🟨 コード済・反映待ち / 🔲 未着手（要作業） / ⏳ ビルド後に確認 / ❓要判断

## 進め方 & ナレッジ還元ルール

- 1項目ずつ会話形式で確定 → この表の状態を更新。
- **作業中に得た汎用的な学び**（他アプリでも効くもの）は:
  1. まず [docs/learnings.md](learnings.md) に追記
  2. リリース完了後に `.skills/`（該当は `08_aso` / `09_release` / `GLOBAL_STANDARDS.md §5`）へ反映
- WeBudget固有の判断はこのファイルに残す。

---

## 1. ストア掲載情報（→ 08_aso / 成果物 `docs/aso_plan.md`）

| # | 項目 | 上限 | 状態 | メモ |
|---|------|------|------|------|
| 1-1 | アプリ名 | 30字 | 🔲 | ストア表示名は "WeBudget" 確定。副題キーワードを付けるか |
| 1-2 | サブタイトル | 30字 | 🔲 | 主要価値提案を一文で |
| 1-3 | 説明文（概要） | 4000字 | 🔲 | 1行目フックが最重要 |
| 1-4 | キーワード | 100字 | 🔲 | 100字フル活用。日英で別 |
| 1-5 | プロモーションテキスト | 170字 | 🔲 | 後から差し替え可 |
| 1-6 | カテゴリ（プライマリ/セカンダリ） | - | 🔲 | 「ファイナンス」想定 |
| 1-7 | 日英ローカライズ | - | 🔲 | 全項目を ja/en 両方 |

## 2. 画像アセット（撮影計画 → [screenshot_plan.md](screenshot_plan.md)）

| # | 項目 | 仕様 | 状態 | メモ |
|---|------|------|------|------|
| 2-1 | アプリアイコン | 1024×1024 透過なし | ✅ | `assets/icon.png` |
| 2-2 | スクショ 6.9" iPhone | 1290×2796 | 🔲 | **必須**。撮る画面5枚＋ChatGPTプロンプト確定済 → 実機で撮影 |
| 2-3 | スクショ 13" iPad | 2064×2752 | 🔲 | **必須**（iPad対応）。**13"iPad実機の確保が前提**（無ければ要相談） |
| 2-4 | スクショのキャッチコピー | - | ✅ | 5枚分の日英コピー確定（screenshot_plan.md A章） |
| 2-5 | プレビュー動画 | 任意 | ❓ | 作るなら後回しでOK |

## 3. URL類

| # | 項目 | 要否 | 状態 | メモ |
|---|------|------|------|------|
| 3-1 | プライバシーポリシーURL | **必須** | 🟨 | `https://mobileapp-works.github.io/we-budget/privacy-policy.html`。GitHub Pages 有効化＆200到達を最終確認 |
| 3-2 | プライバシーポリシー日英 | **必須** | ✅ | `docs/privacy-policy.html`（ja/en同梱、Sentry記述削除済） |
| 3-3 | サポートURL | **必須** | 🔲 | 問い合わせ先が分かるページ。専用サイト不要（要作成 or GitHub Pages流用） |
| 3-4 | マーケティングURL | 任意 | ❓ | 宣伝LP。審査には不要。集客したければ後日 |

## 4. 審査情報（App Store Connect）

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 4-1 | 年齢制限レーティング | 🔲 | 2025/7〜の新カテゴリで回答 |
| 4-2 | 価格・配信地域 | 🔲 | 無料想定 / 配信地域 |
| 4-3 | **審査用デモアカウント** | 🔲 | **確認済みメール+シードデータ入り**を用意し審査メモへ（監査 A-9 High） |
| 4-4 | 審査メモ（補足） | 🔲 | 広告=AdMob/ATTの意図、デモ手順を記載 |
| 4-5 | 輸出コンプライアンス | ✅ | `ITSAppUsesNonExemptEncryption:false` 設定済 |
| 4-6 | バージョン/ビルド番号 | ✅ | app.json 1.0.0 / build 1、eas remote+autoIncrement |

## 5. App Privacy（データ収集表示）／プライバシー

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 5-1 | App Privacy 入力（Nutrition Label） | 🔲 | 実装と整合（監査 A-7 High）。OCRは端末内/画像はStorage保存/広告AdMobはIdentifiers・Usage Data・Device ID=Trackingに該当 |
| 5-2 | Privacy Manifest 網羅 | ⏳ | app.json に4種宣言済。**ビルド後の集約 `PrivacyInfo.xcprivacy` を目視**（監査 A-1 High） |
| 5-3 | ATT 利用目的文言 | ✅ | `NSUserTrackingUsageDescription` 設定済 |
| 5-4 | AI同意（端末内OCR説明） | ✅ | 端末内処理・外部送信なしで整合 |

## 6. コード・DB反映（監査の残タスク）

| # | 項目 | 状態 | 反映作業 |
|---|------|------|---------|
| 6-1 | migration 0014（精算残高RPCの権限）| 🟨 | Supabase SQL Editor で適用（監査 F-1） |
| 6-2 | migration 0013（notify_partner権限剥奪）| 🟨 | 適用＋`docs/test_cases.md §6` の検証 |
| 6-3 | send-push-notification 再デプロイ | 🟨 | `supabase functions deploy send-push-notification`（監査 I-4） |
| 6-4 | A-2/A-5/B-1/I-5 | 🟨 | 次のEASビルドで自動反映（追加作業なし） |

## 7. 外部管理画面（AdMob / Apple）

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 7-1 | **AdMob androidAppId が本番か** | 🔲 | app.json のは**テストID**（`~3347511713`）。iOSは独自値だが本番か要確認。iOS先行なら iOS優先で確定 |
| 7-2 | 広告ユニットID（バナー/インタースティシャル）本番化 | 🔲 | `src/lib/ads.ts` を確認。テストIDのままにしない |
| 7-3 | AdMob ATTメッセージ + GDPR同意フォーム構成 | 🔲 | AdMobコンソールで作成・公開（監査 A-6）。実機でATT表示確認 |
| 7-4 | Apple Developer Program 登録 | ❓ | 登録済みか確認 |
| 7-5 | App Store Connect にアプリ枠作成 | 🔲 | 新規App作成 |

## 8. ビルド・提出

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 8-1 | `npx expo-doctor` / `expo export` 通過 | 🔲 | ビルド前ゲート |
| 8-2 | `eas build --platform ios --profile production` | 🔲 | |
| 8-3 | TestFlight で実機確認 | 🔲 | |
| 8-4 | `eas submit --platform ios` | 🔲 | |
| 8-5 | 審査提出 | 🔲 | |

## 9. 実機手動テスト（提出前）

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 9-1 | 認証/支出/精算/通知の一巡 | 🔲 | `docs/test_plan.md` §5 |
| 9-2 | バナーがノッチ機でホームインジケータに重ならない | 🔲 | 監査 A-8（`Screen.tsx` の bottom safe-area） |
| 9-3 | ネットワークエラー時のメッセージ | 🔲 | 4状態のError |
| 9-4 | ダークモード目視 | 🔲 | |

## 10. リリース後

- [ ] 初週はDL数・クラッシュを毎日確認
- [ ] レビュー返信
- [ ] ASO指標の確認（08_aso）
