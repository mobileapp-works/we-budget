# WeBudget リリース準備 総合チェックリスト

> ## ✅ 2026-07-15 審査提出完了（v1.0.0 / build#21）
> 以降は審査結果待ち。リジェクトされたら §4「リジェクト対策」を参照して対応する。
> **本リリースで得た知見は `.skills`（`794f961`）の 07_monetization / 08_aso / 09_release に反映済み。**

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

## 1. ストア掲載情報（→ **[aso_plan.md](aso_plan.md) に全文作成済。ASCへコピペするだけ**）

| # | 項目 | 上限 | 状態 | メモ |
|---|------|------|------|------|
| 1-1 | アプリ名 | 30字 | ✅ | `WeBudget - ふたりの家計簿・立替精算`(23字)。**競合 "We Budget: カップル家計簿" が既存**のため識別子を付与 |
| 1-2 | サブタイトル | 30字 | ✅ | `レシート撮影で記録、立替は自動精算`(17字) |
| 1-3 | 説明文（概要） | 4000字 | ✅ | 会話フック始まり・機能7ブロック構成 |
| 1-4 | キーワード | 100字 | ✅ | 日96字 / 英97字 |
| 1-5 | プロモーションテキスト | 170字 | ✅ | |
| 1-6 | カテゴリ（プライマリ/セカンダリ） | ✅ | ファイナンス / ライフスタイル |
| 1-7 | 日英ローカライズ | - | ✅ | 全項目 ja/en 作成済 |

## 2. 画像アセット（撮影計画 → [screenshot_plan.md](screenshot_plan.md)）

| # | 項目 | 仕様 | 状態 | メモ |
|---|------|------|------|------|
| 2-1 | アプリアイコン | 1024×1024 透過なし | ✅ | `assets/icon.png` |
| 2-2 | スクショ 6.9" iPhone | 1290×2796 | ✅ | **日英7枚ずつ完成** → `assets/store/out/ja-iphone` `en-iphone`。`scripts/make-store-screenshots.js` で生成（実スクショ無改変＝2.3.3準拠）|
| 2-3 | スクショ 13" iPad | 2064×2752 | ✅ | **日英7枚ずつ完成** → `assets/store/out/ja-ipad` `en-ipad`。元は10.9"iPad(1640×2360)を2064×2752に合成 |
| 2-4 | スクショのキャッチコピー | - | ✅ | 5枚分の日英コピー確定（screenshot_plan.md A章） |
| 2-5 | プレビュー動画 | 任意 | ❓ | 作るなら後回しでOK |

## 3. URL類

| # | 項目 | 要否 | 状態 | メモ |
|---|------|------|------|------|
| 3-1 | プライバシーポリシーURL | **必須** | ✅ | 2026-07-14 main push → Pages反映確認。**最終更新07-12版が公開中**（レシート画像のStorage保管・AdMobのIDFA取得を明記）。監査A-7の不整合は解消 |
| 3-2 | プライバシーポリシー日英 | **必須** | ✅ | `docs/privacy-policy.html`（ja/en同梱、Sentry記述削除済） |
| 3-3 | サポートURL | **必須** | ✅ | `https://mobileapp-works.github.io/we-budget/support.html`（日英FAQ+問い合わせ先 taishirou16@outlook.com）|
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
| 5-2 | Privacy Manifest 網羅 | ✅ | **2026-07-14 build#21 のIPAを実地検証**。本体manifestは4カテゴリ宣言＋Expoが理由コード補完（`C617.1/0A2A.1/3B52.1`, `CA92.1/C56D.1`, `35F9.1`, `E174.1/85F4.1`）。サードSDK27件が各自 `.xcprivacy` 同梱（AdMob/UMP/GoogleSignIn等）。AdMobは `DeviceID` を `Tracking:true` で自己申告。ITMS-91053リスクなし |
| 5-3 | ATT 利用目的文言 | ✅ | `NSUserTrackingUsageDescription` 設定済 |
| 5-4 | AI同意（端末内OCR説明） | ✅ | 端末内処理・外部送信なしで整合 |

## 6. コード・DB反映（監査の残タスク）

| # | 項目 | 状態 | 反映作業 |
|---|------|------|---------|
| 6-1 | migration 0014（精算残高RPCの権限）| ✅ | 適用済（2026-07-14 ユーザー確認） |
| 6-2 | migration 0013（notify_partner権限剥奪）| ✅ | 適用済（2026-07-14 ユーザー確認） |
| 6-3 | send-push-notification 再デプロイ | ✅ | デプロイ済（2026-07-14 ユーザー確認） |
| 6-4 | A-2/A-5/B-1/I-5 | ✅ | build#21 に反映済 |
| 6-5 | migration 0021（精算の排他ロック＋出金メモi18n） | ✅ | 適用済（2026-07-14 ユーザー確認） |
| 6-6 | apple-link デプロイ＋Appleシークレット設定 | ✅ | デプロイ済（2026-07-14 ユーザー確認） |

## 7. 外部管理画面（AdMob / Apple）

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 7-1 | AdMob androidAppId が本番か | ⏸ | app.json のはテストID（`~3347511713`）だが **Android は今回出荷しないため保留でOK**。Android対応時に必須 |
| 7-2 | 広告ユニットID（バナー/インタースティシャル）本番化 | ✅ | eas.json `production` に iOS本番ID設定済（banner `…/5911371023` / interstitial `…/6841309311`）。`ads.ts` は未設定時テストIDへフォールバックする安全設計 |
| 7-3a | AdMob **IDFA説明メッセージ（ATT）** | ✅ | 2026-07-15 **公開済み**（名前:WeBudget ATT / アプリ:WeBudget紐付け済 / 日英2言語）。→ 実機で表示確認は残 |
| 7-3b | AdMob **欧州の規制（GDPR）同意フォーム** | 🔲 | 全世界配信するなら必須。同じ「プライバシーとメッセージング」から作成→公開 |
| 7-3c | 実機でATT/UMPダイアログ表示確認 | 🔲 | TestFlightのアプリを**一度削除**→再インストール→初回起動（ATTは一度答えると再表示されない）|
| 7-4 | Apple Developer Program 登録 | ❓ | 登録済みか確認 |
| 7-5 | App Store Connect にアプリ枠作成 | 🔲 | 新規App作成 |

## 8. ビルド・提出

| # | 項目 | 状態 | メモ |
|---|------|------|------|
| 8-1 | `npx expo-doctor` / 検証ゲート通過 | ✅ | 2026-07-14: expo-doctor **18/18**、typecheck **0**、jest **189 passed / 9 suites**。EASログイン済（taishiro16）|
| 8-2 | `eas build --platform ios --profile production` | ✅ | 2026-07-14 **完了**（build `2c072e53` / **build番号21** / commit `1833ee3` / 所要5分）。IPA取得可 |
| 8-3 | TestFlight で実機確認 | 🔲 | ビルド完了後。**スクショ撮影もこのビルドで行う** |
| 8-4 | `eas submit --platform ios` | ✅ | 2026-07-15 build#21 を ASC へアップロード完了 |
| 8-5 | **審査提出** | ✅ | **2026-07-15 提出済み**（v1.0.0 / build#21 / 日英2ロケール） |

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
