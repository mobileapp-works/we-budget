# 実装ログ（WeBudget）

## 環境情報
- フレームワーク: React Native（Expo SDK 56 / Expo Router）
- 言語: TypeScript（strict, noUncheckedIndexedAccess 等を有効化）
- バックエンド: Supabase（**未構築。現在はモックモードで動作**。手順は SUPABASE_SETUP.md）
- 状態管理: Zustand（設定の永続化）+ TanStack Query（サーバー状態）
- パッケージマネージャー: npm

## 起動方法
```bash
npm install --legacy-peer-deps   # 依存インストール（TS6とlibのpeer差異のため）
npx expo start                   # 開発サーバー（.env の EXPO_PUBLIC_USE_MOCK=true でモック動作）
npm run typecheck                # tsc --noEmit
npm test                         # ユニットテスト（お金ロジック）
```
- 初回ログイン: 任意のメール/パスワードでOK（モックなので何でも通る。デモデータが入っている）。

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
  data/                   # backend(IF) / mockBackend / index（差し替え点）
  hooks/                  # useSession / useExpenses / useSettlement / ... 各ドメイン + useTheme/useResponsive
  lib/                    # supabase / env / i18n / queryClient
  locales/                # ja.json / en.json
  providers/              # AppProviders / ToastProvider
  store/                  # preferencesStore（テーマ・言語・AI同意・永続化）
  types/                  # models.ts / env.d.ts
  utils/                  # money / settlement / budget / sharedAccount / date / validation（+ *.test.ts）
docs/                     # 要件/設計/UI/命名/Supabase手順/プライバシーポリシー
```

## 実装済み機能

| 機能 | ステータス | 備考 |
|------|-----------|------|
| 認証フロー（ログイン/登録/メール確認/パスワードリセット） | 完了（モック） | Supabase Auth は SUPABASE_SETUP 参照 |
| 認証ガード（未ログイン→認証 / ログイン→タブ） | 完了 | |
| AI利用同意画面 | 完了 | OCR前に同意必須。未同意ならOCR不可 |
| ホーム（支出合計・立替残高・予算進捗・直近の支出） | 完了 | ソロは立替を招待CTAに切替 |
| 支出入力（手動 + レシート撮影/添付、追加・編集） | 完了 | OCR本処理は Edge Function（Phase4） |
| 支出一覧（日付順・カテゴリフィルタ、FlatList） | 完了 | |
| 支出詳細（編集・削除、確認ダイアログ） | 完了 | どちらのユーザーも編集可 |
| 立替精算（残高・精算実行・履歴、確認ダイアログ） | 完了 | settlement_id スタンプ方式 |
| 共同口座（残高・入金記録・明細） | 完了 | 買い物は支出側で一本化 |
| 固定費（一覧・追加、変動の未入力バッジ） | 完了 | |
| 予算（全体/カテゴリ別の設定・進捗、80/100%色分け） | 完了 | |
| レポート（カテゴリ別集計・割合バー、月/週切替） | 完了 | 円グラフはバー表現で代替 |
| 通知一覧（既読・全既読） | 完了 | |
| カテゴリ管理（追加・非表示） | 完了 | デフォルトは削除不可 |
| プロフィール（名前/アイコン/パスワード/負担割合/ペア解除） | 完了 | |
| ペアリング（招待コード共有・参加） | 完了 | |
| 設定（言語/テーマ/通知/各管理/ログアウト/アカウント削除/プライバシー/版） | 完了 | |
| 多言語（日英）・ダーク/ライト・iPad中央寄せ | 完了 | |
| お金ロジック（換算/立替/予算/共同残高） | 完了 + テスト36件 | バグ防止のため厚めにテスト |

## 使用パッケージ（主要）
| パッケージ | 用途 |
|-----------|------|
| expo / expo-router | フレームワーク・ルーティング |
| @supabase/supabase-js | バックエンド（接続は後で） |
| @tanstack/react-query | サーバー状態 |
| zustand | 設定の永続化 |
| i18next / react-i18next / expo-localization | 多言語 |
| react-native-reanimated / react-native-worklets | アニメーション |
| react-native-gesture-handler / safe-area-context / screens | ナビ基盤 |
| expo-image-picker / @react-native-community/datetimepicker | 入力 |
| @expo/vector-icons | アイコン |
| dayjs | 日付 |

## 手動対応が必要な項目（後日）
- [ ] **Supabase 構築**（docs/SUPABASE_SETUP.md に全SQL/RLS/RPC/トリガー/Storage/Auth/Edge記載）
- [ ] `supabaseBackend.ts` の実装 + `EXPO_PUBLIC_USE_MOCK=false`
- [ ] Sentry プロジェクト作成・DSN設定（`src/lib/sentry` 初期化は Phase4。ErrorBoundary に TODO あり）
- [ ] AdMob アプリ登録・広告ユニット作成（BannerAdSlot を実広告に差し替え）
- [ ] ATT/UMP 同意フロー実装（att-consent 画面の枠は確保済み）
- [ ] アプリアイコン・スプラッシュ画像（assets/）の用意と app.json 設定
- [ ] EAS Build 設定（eas.json）

## 審査コンプライアンス対応状況
- [x] プライバシーマニフェスト（app.json privacyManifests, CA92.1）
- [x] 権限の利用目的（カメラ/写真/ATT の infoPlist 説明文）
- [x] ログアウト・アカウント削除（設定画面に実装。削除はモック→Phase4でEdge Function）
- [x] プライバシーポリシー（docs/privacy-policy.html、設定からリンク）
- [ ] ATT/UMP 同意フロー（広告実装時に対応）

## 既知の制限事項
- 現在はモックデータで動作（インメモリ、再起動で初期化）。実データは Supabase 構築後。
- レシートOCRは画像添付までで、自動読み取りは Edge Function 実装後に有効化。
- レポートは円グラフではなく割合バーで表示（チャートライブラリ未導入。MVP範囲）。
- 為替レートは最新1件方式（支出日時点の履歴は持たない）。
- 二重レシート登録防止は未実装（将来課題）。
