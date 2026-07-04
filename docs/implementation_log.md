# 実装ログ（WeBudget）

> 最終更新: 2026-07-04。スレッド/モデルを切り替えながら開発するため、**このファイルが現状の正**。着手前にここを読むこと。

## 環境情報
- フレームワーク: React Native（**Expo SDK 54** / RN 0.81.5 / React 19 / **New Architecture 有効** / Expo Router）
  - **マネージド（prebuild/CNG）構成**（`ios/`・`android/` フォルダなし）。ネイティブ追加は config plugin で行う。
- 言語: TypeScript（strict, noUncheckedIndexedAccess 等を有効化）
- バックエンド: Supabase（**構築済み・実接続で動作中**。`EXPO_PUBLIC_USE_MOCK=false`）
  - プロジェクト: `oarbchcwtfxjxvjnuoaw.supabase.co`（URL/anon key は `.env` と `eas.json` に設定済み）
  - マイグレーション 0001〜0003 適用済み（テーブル/RLS/RPC/Storage）
  - **Edge Functions は未デプロイ**（`supabase/functions/` にコードあり。下記ロードマップ参照）
- 状態管理: Zustand（設定の永続化）+ TanStack Query（サーバー状態）
- ビルド: EAS（`eas.json` 設定済み。development / preview / production）
- アセット: アプリアイコン・adaptive icon・スプラッシュ作成済み（円ハート+テールの2トーン。`scripts/generate-icons.js` で生成）
- パッケージマネージャー: npm

## 起動方法
```bash
npm install --legacy-peer-deps   # 依存インストール（TS6とlibのpeer差異のため）
npx expo start                   # 開発サーバー（実Supabaseに接続）
npm run typecheck                # tsc --noEmit
npm test                         # ユニットテスト 52件（お金ロジック）
```
- ログインは実際のサインアップが必要（Supabase Auth）。モックに戻す場合は `.env` で `EXPO_PUBLIC_USE_MOCK=true`。
- 検証コマンド: `npm run typecheck` / `npm test` / `npx expo export --platform ios`（2026-07-04 時点すべてパス）

## ディレクトリ構成
```
app/                      # Expo Router（画面）
  _layout.tsx             # Provider群 + 認証ガード
  (auth)/                 # login / signup / verify-email / reset-password
  (tabs)/                 # index(home) / history / input / report / settings
  ai-consent / pairing / expense-input / settlement / shared-account /
  fixed-costs / budget / notifications / categories / profile /
  notification-settings / expense/[id]
src/
  components/             # Button, Card, TextField, Screen, StateView, EmptyState,
                          # SegmentedControl, ProgressBar, CategoryBadge, ExpenseRow,
                          # ScreenHeader, BannerAdSlot, ErrorBoundary
  constants/              # colors / spacing / typography / motion / categories（docs/ui由来）
  data/                   # backend(IF) / mockBackend / supabaseBackend / index（差し替え点）
  hooks/                  # useSession / useExpenses / useSettlement / ... 各ドメイン + useTheme/useResponsive
  lib/                    # supabase / env / i18n / queryClient
  locales/                # ja.json / en.json
  providers/              # AppProviders / ToastProvider
  store/                  # preferencesStore（テーマ・言語・AI同意・永続化）
  types/                  # models.ts / env.d.ts
  utils/                  # money / settlement / budget / sharedAccount / date / validation（+ *.test.ts）
supabase/
  migrations/             # 0001_init / 0002_rls_functions / 0003_storage（適用済み）
  functions/              # ocr-receipt / delete-account / send-push-notification（未デプロイ）
docs/                     # 要件/設計/UI/命名/Supabase手順/テスト計画/プライバシーポリシー
```

## 実装済み機能

| 機能 | ステータス | 備考 |
|------|-----------|------|
| 認証フロー（ログイン/登録/メール確認/パスワードリセット） | 完了（実Supabase） | |
| 認証ガード（未ログイン→認証 / ログイン→タブ） | 完了 | |
| AI利用同意画面 | 完了 | OCR前に同意必須。未同意ならOCR不可 |
| ホーム（支出合計・立替残高・予算進捗・直近の支出） | 完了 | ソロは立替を招待CTAに切替 |
| 支出入力（手動 + レシート撮影/添付、追加・編集） | 完了 | **端末内OCR自動入力**（撮影→ML Kit→金額/店名/日付を自動入力）。dev buildで実動作、Expo Goはサンプル表示 |
| 支出一覧（日付順・カテゴリフィルタ、FlatList） | 完了 | |
| 支出詳細（編集・削除、確認ダイアログ） | 完了 | どちらのユーザーも編集可 |
| 立替精算（残高・精算実行・履歴、確認ダイアログ） | 完了 | settlement_id スタンプ方式 |
| 共同口座（残高・入金記録・明細） | 完了 | 買い物は支出側で一本化 |
| 固定費（一覧・追加、変動の未入力バッジ） | 完了 | 月次自動計上は未実装（pg_cron 予定） |
| 予算（全体/カテゴリ別の設定・進捗、80/100%色分け） | 完了 | |
| レポート（カテゴリ別集計・割合バー、月/週切替） | 完了 | 円グラフはバー表現で代替 |
| 通知一覧（既読・全既読） | 完了 | アプリ内通知のみ。プッシュ実配信は未実装 |
| カテゴリ管理（追加・非表示） | 完了 | デフォルトは削除不可 |
| プロフィール（名前/アイコン/パスワード/負担割合/ペア解除） | 完了 | |
| ペアリング（招待コード共有・参加） | 完了 | |
| 設定（言語/テーマ/通知/各管理/ログアウト/アカウント削除/プライバシー/版） | 完了 | ※アカウント削除は Edge Function デプロイまで失敗する |
| 多言語（日英）・ダーク/ライト・iPad中央寄せ | 完了 | |
| お金ロジック（換算/立替/予算/共同残高） | 完了 + テスト52件 | バグ防止のため厚めにテスト |
| Supabase バックエンド（supabaseBackend.ts / migrations / RLS / RPC） | 完了 | 実接続で動作中 |
| アプリアイコン・スプラッシュ | 完了 | app.json 設定済み |
| EAS Build 設定（eas.json / .npmrc legacy-peer-deps） | 完了 | |

## ロードマップ（残作業）

**方針: 🟠機能の作り込みを先にやる → 🔴審査ブロッカーは軽いので後でまとめて → 💰収益化は最後。**

### 🟠 機能の作り込み（先にやる・優先順）
- [~] **レシートOCR**（目玉機能）: **端末内OCR方式で実装完了**。残りは dev build を作って実機確認するだけ（クラウド費用なし）。
  - **方式決定（2026-07-04）**: Google Cloud Vision（クラウド課金・利用者数に比例してコスト増）を廃し、**端末内OCR（Google ML Kit / オンデバイス）に変更**。理由=①コストがユーザー数に依存せず**永久無料**、②**画像が端末外に出ない**（プライバシー◎・審査有利）、③オフライン動作。トレードオフ=精度はVisionよりやや劣る・**Expo Go 不可（dev build 必須）**。※精度改善が必要になれば「サブスク限定でVision高精度モード」を後付け可能（解析層は共通）。
  - ライブラリ: **`@react-native-ml-kit/text-recognition`**（iOS/Android両対応）。`TextRecognitionScript.JAPANESE` は和文＋ラテン文字を同時認識するので日本語・英語レシート両対応。iOSのML Kit pod要件のため `expo-build-properties` で iOS deploymentTarget=15.5 に引き上げ済み（app.json）。
  - 完了ファイル: `src/lib/ocr.ts`（ML Kitラッパー。Expo Go等ネイティブ未リンク時は `__DEV__` のみサンプルにフォールバック）／`src/utils/receipt.ts` 純粋関数 `parseReceiptText`（金額/店名/日付抽出・日英・**テスト16件**）／`useReceiptOcr` フック（画像URI→OCR→抽出）／`expense-input.tsx` の撮影→端末内OCR→自動入力フロー（読取中オーバーレイ・成功/失敗トースト）／AI同意画面の文言を「端末内処理・外部送信なし」に修正（ja/en）。
  - 撤去: Vision用 Edge Function `supabase/functions/ocr-receipt/` を削除、`Backend.scanReceipt` をIF・mock・supabaseから撤去（OCRはデータ層ではなく端末処理に移動）。
  - **残（ユーザー作業）**: `eas build --profile development`（または `npx expo run:ios` / `run:android`）で dev build を作成 → 実機/シミュレータでレシート撮影を確認。Expo Go では動かない（`__DEV__` フォールバックのサンプルが出るだけ）。**iOSビルドが pod のフレームワーク衝突で失敗する場合の対処**: expo-build-properties に `ios.useFrameworks: "static"` を追加。
  - 抽出ロジック: 日付=YYYY年M月D日/YYYY/MM/DD等、金額=合計語優先→価格らしい最大額→全体最大額のフォールバック（`receipt.test.ts` 参照）。
- [ ] **プッシュ通知の実配信**: クライアントで Expo push token 登録 → `send-push-notification` Edge Function デプロイ → 配信トリガー接続（アプリ内通知は動作済み）
- [ ] **固定費の月次自動計上/リマインド**: pg_cron でスケジュール実行（SQL追加 + Supabase で pg_cron 有効化）
- [ ] **Apple / Google ログイン**: Supabase Auth のプロバイダ設定 + expo-apple-authentication / Google Sign-In 導入（AppleログインはApp Store審査上、他社ログインを入れるなら必須）

### 🔴 審査ブロッカー（リリース必須・軽い順）
- [ ] **プライバシーポリシー公開**: GitHub Pages を ON にするだけ（docs/privacy-policy.html 準備済み）★5分
- [ ] **delete-account Edge Function デプロイ**: 現状アカウント削除ボタンが失敗する ★短時間
- [ ] **スクリーンショット**: 6.9インチ iPhone + iPad（実機/シミュレータで撮影）

### 💰 収益化
- [ ] **AdMob**: アプリ登録 → `react-native-google-mobile-ads` 導入（app.json プラグイン追加）→ BannerAdSlot 差し替え → **ATT/UMP 同意フロー**。※導入後は Expo Go 不可、development build 必須になる
- [ ] **サブスク課金**: 広告非表示 + AI機能（RevenueCat 等の選定から）

### その他（時期未定）
- [ ] Sentry セットアップ（DSN発行 → `@sentry/react-native` 導入 → ErrorBoundary の TODO 解消）
- [ ] EAS Build 実機ビルド → TestFlight → ストア提出物（説明文・App Privacy 申告）
- [ ] 2アカウントでのペア共有 E2E 確認（RLS検証。docs/test_plan.md 参照）

## 審査コンプライアンス対応状況
- [x] プライバシーマニフェスト（app.json privacyManifests, CA92.1）
- [x] 権限の利用目的（カメラ/写真/ATT の infoPlist 説明文）
- [x] ログアウト（設定画面）
- [ ] アカウント削除（UIあり。**delete-account デプロイまで動作しない**）
- [ ] プライバシーポリシーの公開URL（html準備済み、GitHub Pages 未ON）
- [ ] ATT/UMP 同意フロー（AdMob 導入時に対応）

## 既知の制限事項
- レシートOCRは端末内OCR（ML Kit）方式。**dev build でのみ実動作**し、Expo Go では `__DEV__` フォールバックのサンプルが出るだけ（実画像は読まない）。
- 通知はアプリ内のみ（プッシュ実配信は未実装）。
- レポートは円グラフではなく割合バーで表示（チャートライブラリ未導入。MVP範囲）。
- 為替レートは最新1件方式（支出日時点の履歴は持たない）。
- 二重レシート登録防止は未実装（将来課題）。
- リポジトリは Public のため、eas.json の Supabase URL / anon key は公開状態（anon key は公開前提だが、防壁はRLSのみ。RLS検証を必ず行うこと）。
