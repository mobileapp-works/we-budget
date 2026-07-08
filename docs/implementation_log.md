# 実装ログ（WeBudget）

> 最終更新: 2026-07-08（承認制ペアリング実装・0010 適用済み）。スレッド/モデルを切り替えながら開発するため、**このファイルが現状の正**。着手前にここを読むこと。

## 2026-07-08 承認制ペアリング + 同期強化（migration 0010・適用済み）

- **ペアリングを承認制に変更**（従来はコード入力で即成立）: 申請者がコード入力 → `pair_requests` に申請作成 → 招待側に `pair_request` 通知（アプリ内+既存Webhook経由プッシュ）→ 招待側がペアリング画面で **承認/拒否** → 承認で成立・申請者に `pair_approved` 通知。
- **migration `0010_pair_request_approval.sql`（適用済み・2026-07-08 SQL Editor で実行・Success確認）**:
  - テーブル `pair_requests`（status: pending/approved/declined/cancelled。pending は申請者につき1件の部分一意。RLS=当事者SELECTのみ、書き込みはRPC）
  - RPC: `request_pair`（検証+冪等化+通知）/ `list_incoming_pair_requests`（表示名込みJSON。成立済み申請者は除外）/ `respond_pair_request`（行ロックで二重承認防止・承認時は他のpending自動拒否）/ `cancel_pair_request`
  - `notifications.type` CHECK に `pair_request` / `pair_approved` / `pair_declined` を追加
  - **`join_pair` を drop**（即時成立の旧経路を廃止。0009のガード版も含め置き換え）
- **クライアント**: `Backend.requestPair/getOutgoingPairRequest/listIncomingPairRequests/respondPairRequest/cancelPairRequest`（IF/supabase/mock。mockは4秒後自動承認でデモ可能）／`useIncomingPairRequests`（5秒ポーリング・ソロ時のみ）／`useOutgoingPairRequest`（pending中4秒ポーリング）／pairing.tsx 全面改修（届いた申請の承認/拒否カード・申請送信の確認ダイアログ・承認待ちカード+取消・承認/拒否をポーリング検知してセッション更新）／通知一覧タップで pair_request→ペア画面・pair_approved→セッション再取得。
- **同期強化（`useAppStateSync` 新設・_layoutで常時起動）**: フォアグラウンド復帰時に session / notifications / pair-requests を invalidate（パートナーのペア解除・負担割合変更・ペア成立に追従）。あわせて Supabase の `auth.startAutoRefresh/stopAutoRefresh` を AppState 連動に（RN推奨。長時間バックグラウンド後のトークン失効対策）。
- **ペア機能・同期の精査結果**: 金額系（精算残高・立替）はRPCで毎回サーバー計算のため相手の変更に常に正しく追従 ✅／データ取得層は `context()` で毎回 profiles から pair_id を引くため RLS と常に一致 ✅／表示用セッション（パートナー名・成立状態・招待コード・負担割合表示）だけが staleTime∞ で遅延していた → useAppStateSync とポーリングで解消。リアルタイム反映（Supabase Realtime）は将来課題として見送り（フォアグラウンド同期+プッシュで実用十分と判断）。
- 検証: typecheck / jest 75件 / expo export すべてパス。
- [x] **0010 適用済み（2026-07-08）**。適用済みマイグレーション: 0001〜0005・0009・0010（0006 任意・0007 未適用、0008 要確認）。
- **残（ユーザー作業）**: 2アカウント実機で 申請→通知→承認→成立 のE2E確認（RLS検証を兼ねる。docs/test_plan.md 参照）。

## 2026-07-08 総合コードレビュー実施 → バグ修正完了

- 全画面・データ層・migrations・i18n を要件/設計と突き合わせて総点検。**結果は [docs/review_2026-07-08.md](review_2026-07-08.md) に集約**（重大9件 / 高15件 / 中低20件 + 残作業リスト。冒頭に対応状況を記載）。
- **同日、バグ系はすべて修正済み**（機能未実装系＝為替レートUI・予算アラート・月末精算リマインド・月送りUI・固定費編集UI等は残作業として保留）:
  - **パスワード再設定フロー完成（R-1）**: `reset-password` を request/update の2モード化。リカバリーメールのディープリンク（`webudget://reset-password#access_token=...`）を `useURL` で受け、`Backend.recoverSession`（setSession）→ 新パスワード入力 → `Backend.updatePassword`。`_layout` の認証ガードに reset-password 例外を追加（セッション確立後も追い出さない）。
  - **共同口座残高（R-2）**: `Backend.listSharedExpenses()`（全期間・共同払いのみ）を新設し、当月分のみで計算していた残高を全期間Σに修正。
  - **負担割合の反転（R-4）**: profile で自分が user2 の場合に表示・保存とも user1 基準へ変換。
  - **レシートの Storage 保存（R-5）**: `Backend.uploadReceipt`（receipts バケット、パス保存）+ `getReceiptUrl`（署名URL・60分）+ `useReceiptImageUrl` フック。保存時にアップロードし、詳細/編集プレビューは署名URLで表示。旧データ（file://・http）はそのまま表示（後方互換）。
  - **pair 混入（R-6）**: `listExpenses` に `pair_id` フィルタ追加（RLS の recorded_by 条件による旧pairデータの混入を遮断）。
  - **migration `0009_notification_and_pair_fixes.sql`（R-7 / H-9）**: ①精算スタンプの UPDATE は expense_edited 通知を出さない ②settlements INSERT で両者に settlement 通知（要件7-6） ③join_pair はペア成立済みなら 'already paired' で拒否。**適用済み（2026-07-08、SQL Editor で実行・Success確認）**。
  - UX/文言: 本番ログインのデモ認証情報プリセット除去（IS_MOCK限定）/ 支出詳細の記録者名表示修正・タイトルを「支出の詳細」に / 楽観ロック競合に専用メッセージ `error.conflict` / カメラ・写真権限の専用メッセージ / 精算・支出削除・固定費削除・通知設定・ペア解除・招待生成の無言失敗解消（toast追加）/ ホーム立替カードのロード中「精算済み」誤表示防止 / OAuthボタンの多重押下防止 / `useExpense('')` の空クエリ発行防止（enabled）/ 精算画面の退会ユーザー表示統一 / 言語autoラベルのキー修正 / 固定費の「25日」表記 / 招待共有文・閉じる/戻る・デフォルト表示名・ErrorBoundary の i18n 化。
- 検証: typecheck / jest 75件 / expo export --platform ios すべてパス。
- [x] **0009 適用済み（2026-07-08）**。
- **残（ユーザー作業）**: ①**0007 の適用**（カテゴリ写真の Storage バケット。未適用だと本番でカテゴリ写真アップロードが失敗）と **0008 の適用状態確認** ②パスワード再設定は実機/シミュレータでメールリンク→新パスワード設定のE2E確認を推奨 ③精算を1回実行して「精算が完了しました」通知が両者に届くこと（編集通知が連発しないこと）のスモーク。

## 環境情報
- フレームワーク: React Native（**Expo SDK 54** / RN 0.81.5 / React 19 / **New Architecture 有効** / Expo Router）
  - **マネージド（prebuild/CNG）構成**（`ios/`・`android/` フォルダなし）。ネイティブ追加は config plugin で行う。
- 言語: TypeScript（strict, noUncheckedIndexedAccess 等を有効化）
- バックエンド: Supabase（**構築済み・実接続で動作中**。`EXPO_PUBLIC_USE_MOCK=false`）
  - プロジェクト: `oarbchcwtfxjxvjnuoaw.supabase.co`（URL/anon key は `.env` と `eas.json` に設定済み）
  - マイグレーション 0001〜0005・0009 適用済み（テーブル/RLS/RPC/Storage/精算・ペア解除バグ修正/固定費cron/通知・join_pair修正）。0005 は pg_cron ジョブ2本が active で登録済（2026-07-05 確認）。**0006（任意）・0007 は未適用**、0008 は適用状態要確認
  - Edge Functions: `send-push-notification`・`delete-account` は**デプロイ済**。固定費の自動計上/リマインドは Edge ではなく **pg_cron + DB関数（0005）** で実装
- 状態管理: Zustand（設定の永続化）+ TanStack Query（サーバー状態）
- ビルド: EAS（`eas.json` 設定済み。development / preview / production）
- アセット: アプリアイコン・adaptive icon・スプラッシュ作成済み（円ハート+テールの2トーン。`scripts/generate-icons.js` で生成）
- パッケージマネージャー: npm

## 起動方法
```bash
npm install --legacy-peer-deps   # 依存インストール（TS6とlibのpeer差異のため）
npx expo start                   # 開発サーバー（実Supabaseに接続）
npm run typecheck                # tsc --noEmit
npm test                         # ユニットテスト 75件（お金ロジック・レシート抽出）
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
  migrations/             # 0001_init / 0002_rls / 0003_storage / 0004_fix / 0005_fixed_cost_cron（適用済）/ 0006_oauth_profile_name（未適用・任意）
  functions/              # delete-account / send-push-notification（デプロイ済）
docs/                     # 要件/設計/UI/命名/Supabase手順/テスト計画/プライバシーポリシー
```

## 実装済み機能

| 機能 | ステータス | 備考 |
|------|-----------|------|
| 認証フロー（ログイン/登録/メール確認/パスワードリセット） | 完了（実Supabase） | |
| Apple / Google ログイン（ネイティブ signInWithIdToken） | 完了（設定込み） | GCP/Supabase 設定済（2026-07-05）。残りは dev build で実機確認のみ。Expo Go 不可 |
| 認証ガード（未ログイン→認証 / ログイン→タブ） | 完了 | |
| AI利用同意画面 | 完了 | OCR前に同意必須。未同意ならOCR不可 |
| ホーム（支出合計・立替残高・予算進捗・直近の支出） | 完了 | ソロは立替を招待CTAに切替 |
| 支出入力（手動 + レシート撮影/添付、追加・編集） | 完了 | **端末内OCR自動入力**（撮影→ML Kit→金額/店名/日付を自動入力）。dev buildで実動作、Expo Goはサンプル表示 |
| 支出一覧（日付順・カテゴリフィルタ、FlatList） | 完了 | |
| 支出詳細（編集・削除、確認ダイアログ） | 完了 | どちらのユーザーも編集可 |
| 立替精算（残高・精算実行・履歴、確認ダイアログ） | 完了 | settlement_id スタンプ方式 |
| 共同口座（残高・入金記録・明細） | 完了 | 買い物は支出側で一本化 |
| 固定費（一覧・追加、変動の未入力バッジ） | 完了 | 月次自動計上/変動リマインドは pg_cron+DB関数で実装・**適用済**（0005） |
| 予算（全体/カテゴリ別の設定・進捗、80/100%色分け） | 完了 | |
| レポート（カテゴリ別集計・割合バー、月/週切替） | 完了 | 円グラフはバー表現で代替 |
| 通知一覧（既読・全既読）＋プッシュ登録 | 完了 | アプリ内通知＋**プッシュ登録クライアント実装済**（ログイン時にトークン保存・タップで一覧へ）。実配信は Edge Function デプロイ＋Webhook設定後（dev build必須） |
| カテゴリ管理（追加/編集・アイコン/写真・非表示/再表示） | 完了 | デフォルトは削除不可。非表示は確認ダイアログ+再表示可。アイコン選択40種+カスタム写真 |
| プロフィール（名前/アイコン/パスワード/負担割合/ペア解除） | 完了 | |
| ペアリング（招待コード共有・参加） | 完了 | |
| 設定（言語/テーマ/通知/各管理/ログアウト/アカウント削除/プライバシー/版） | 完了 | ※アカウント削除は Edge Function デプロイまで失敗する |
| 多言語（日英）・ダーク/ライト・iPad中央寄せ | 完了 | |
| お金ロジック（換算/立替/予算/共同残高） | 完了 + テスト75件 | バグ防止のため厚めにテスト |
| Supabase バックエンド（supabaseBackend.ts / migrations / RLS / RPC） | 完了 | 実接続で動作中 |
| アプリアイコン・スプラッシュ | 完了 | app.json 設定済み |
| EAS Build 設定（eas.json / .npmrc legacy-peer-deps） | 完了 | |
| AdMob バナー広告（画面下部・UMP同意/初期化） | 完了（クライアント実装・**テストID**） | 本番ID・同意フォームは AdMob 管理画面の作業のみ残。Expo Go 不可（dev build必須） |

## 2026-07-05 バグ修正（精算・ペア解除）

- **外貨精算バグ**: レート未設定の外貨支出は精算額の集計から除外されるのに、精算実行時に精算済みスタンプが押され、立替が請求できないまま消えていた。→ スタンプ条件を集計対象と完全に同一に修正。判定を `isSettleableExpense`（`src/utils/settlement.ts`）に共通化し、mockBackend と SQL（migration 0004）の両方で使用。除外された外貨はレート設定後の次回精算に自動で含まれる。
- **leave_pair**: 設計は「各自に新しいソロpairを発行」だが実行者にしか発行されず、残された側が解散済みpairに残っていた。→ 残された側にもソロpairを発行（migration 0004）。
- **UIガード追加**: ①支出詳細に精算済みバナー（編集・削除しても過去の精算額は変わらない旨）＋精算済み用の削除確認文言。②ペア解除時に未精算残高があれば金額を出して「精算画面へ / 解除する」の3択で精算を促す（要件155対応）。
- [x] **migration 0004 適用済み（2026-07-05、SQL Editor で実行・Success確認）**

## 2026-07-05 固定費 cron（migration 0005）

- **固定費の月次自動計上／変動固定費リマインド**を `supabase/migrations/0005_fixed_cost_cron.sql` に実装（pg_cron + DB関数、Edge Function 不使用）。
- 追加関数: `post_fixed_expenses()` / `send_variable_reminders()` / 通知ゲート一本化の `notify_user()`。`notify_partner` を `notify_user` 経由に付け替え、`on_expense_change` は自動計上（`is_fixed_cost=true`）INSERT の「パートナーが記録」通知をスキップ。
- 冪等性: 当月既存 expenses があれば生成スキップ（`expenses_fixed_month` 部分一意がバックストップ）。月末超過の billing/reminder day は月末に丸め、日付判定は JST 基準。
- 一般ユーザーからの直接実行を `revoke ... from public` で禁止（cron=postgres と関数オーナーのみ）。
- typecheck / jest 75件パス（SQLのみでTS無変更）。**適用済み（2026-07-05）**: SQL Editor で 0005 実行、`cron.job` に `webudget_post_fixed_expenses`(jobid 1) / `webudget_variable_reminders`(jobid 2) が active で登録済み。残りは実データでの動作スモークのみ（`select post_fixed_expenses();` 手動実行 or billing_day を当日JSTに一時変更して確認。手順は SUPABASE_SETUP.md 8.5）。

## 2026-07-05 Apple / Google ログイン（クライアント実装）

- **ネイティブ `signInWithIdToken` 方式**で実装。Apple=`expo-apple-authentication`(~8.0.8)／Google=`@react-native-google-signin/google-signin`(^16.1.2) を `npx expo install`（`.npmrc` の legacy-peer-deps 適用）。
- 新規/変更: `src/lib/oauth.ts`（トークン取得・キャンセルは `OAuthCancelledError`・Google は遅延 import で Expo Go クラッシュ回避）／`backend.ts`＋`supabaseBackend`＋`mockBackend` に `signInWithIdToken`／`useAuthActions.signInWithProvider`／`app/(auth)/login.tsx` のボタン配線（Apple は `isAppleAuthAvailable()`＝iOS のみ表示・モックは常時表示でデモログイン・多重押下防止）。
- app.json: `expo-apple-authentication` プラグイン＋`ios.usesAppleSignIn:true`／google-signin プラグイン（`iosUrlScheme` は**プレースホルダ**＝ユーザーが reversed iOS client ID に置換）。env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`/`_IOS_CLIENT_ID` を追加（`src/lib/env.ts`・`env.d.ts`）。
- 任意の migration `0006_oauth_profile_name`（OAuth新規の表示名/アバターを full_name/name/picture から採用）。**未適用でもログインは動作**。
- signup 画面は変更なし（OAuth はログイン画面が単一入口。`signInWithIdToken` は未登録なら自動でアカウント作成）。
- 検証: typecheck / jest 75件 / `expo export --platform ios`（バンドル生成成功＝新依存の Metro 解決OK）すべてパス。
- **外部設定 完了（同日）**: Supabase Apple 有効化（Client IDs=Bundle ID）／GCP プロジェクト WeBudget で iOS・Web OAuth クライアント作成／app.json `iosUrlScheme` を実値に置換／`.env` に Google client id 2つ／Supabase Google 有効化（Client IDs=iOS+Web, Secret=Web）。**残は dev build で実機確認のみ**。

## 2026-07-05 カテゴリ管理の改善 + 画像 Storage アップロード

- **非表示の破壊性を解消**: 非表示は元々 `is_hidden=true`（論理・非破壊）だが、管理画面が表示中しか出さず「消えて戻せない」体験だった。→ ①非表示前に確認ダイアログ（記録は残る/再表示可の旨）②「非表示のカテゴリ」セクション＋**表示する**で再表示。管理画面のみ `useCategories(true)`（=`listCategories(includeHidden)`）で非表示も取得。他画面は従来どおり表示中のみ。無効化は `queryKeys.categories` プレフィックスで両キーに効く。
- **アイコン選択 + カスタム写真**: 追加は色のみ→アイコン固定だったのを、**40種の Ionicons グリッド**（デフォルトのアイコンも含む）から選択可能に。行タップで**編集シート**（既存カテゴリ＝デフォルト含めアイコン/写真/色を選び直せる）。`CATEGORY_ICON_CHOICES`（`constants/categories.ts`）。
- **画像 Storage アップロード**（プロフィール画像 + カテゴリ写真）: 従来はローカルURI(`file://`)を DB に直保存で、同期も永続化もされなかった。→ `backend.uploadAvatar` / `uploadCategoryIcon` を追加。ImagePicker の `base64:true` を Uint8Array に変換（`atob`非依存の自前デコーダ）して `storage.upload` → 公開URLを保存。モックはローカルURIをそのまま返す。カテゴリ写真はキャンセル時の孤児防止のため**保存時にまとめてアップロード**（`pendingPhoto`）。
- `CategoryIcon` は URI を検知して `<Image>`、それ以外は Ionicons を表示（`isCategoryImage`）。
- **migration `0007_category_icons_storage.sql`**（新規 public バケット `category-icons`、書き込みは `{pair_id}/` のみ／読み取り public）。**未適用**（要 SQL Editor 実行）。avatars は既存 `0003_storage.sql` のポリシーで動作。
- 検証: typecheck / jest 75件パス。**残**: ①0007 適用 ②dev build で写真アップロード実機確認（Storage は Expo Go でも動くが実機確認推奨）。

## 2026-07-07 AdMob バナー広告（クライアント実装・テストID運用）

- **バナー広告を実装**（要件14 / GLOBAL_STANDARDS §5-3・§10）。`react-native-google-mobile-ads`(16.4.0) を `npx expo install` で導入。**現状はテストID運用**（本番 AdMob 設定はユーザーがあとで実施）。
- **クラッシュ回避が肝**: このライブラリの native は `TurboModuleRegistry.getEnforcing` を使うため、**常時ロードされる場所で静的 import すると Expo Go で起動即クラッシュ**する。→ 広告APIは `adsSupported`（＝Expo Go 以外）が true のときだけ**動的 require** する設計にした。
- 新規/変更ファイル:
  - `src/lib/ads.ts`（新）: `adsSupported`（`Constants.executionEnvironment !== StoreClient`）／テストバナーID定数／`getBannerAdUnitId()`（`__DEV__`・`IS_MOCK` はテストID・本番ビルドは `EXPO_PUBLIC_ADMOB_BANNER_*`、未設定はテストIDにフォールバック）。**native を import しない**。
  - `src/hooks/useAdsInit.ts`（新）: 起動時に**動的 require** で `AdsConsent.gatherConsent()`（UMP同意）→ `mobileAds().initialize()`。失敗は握りつぶしてアプリ継続。`AppProviders` で1回実行。
  - `src/components/AdBanner.tsx`（新）: 実 `BannerAd`（`ANCHORED_ADAPTIVE_BANNER`）。native を静的 import するため adsSupported 環境でのみ require されること前提。
  - `src/components/BannerAdSlot.tsx`: adsSupported 時のみ `require('./AdBanner')`、非対応（Expo Go）はプレースホルダーで高さ確保（従来の枠は維持）。
  - `app.json`: `react-native-google-mobile-ads` プラグインを配列形式に修正（`expo install` が素の文字列で追記し App ID 未指定＝native 起動時クラッシュ状態だった）。**テスト App ID**（iOS `ca-app-pub-3940256099942544~1458002511` / Android `~3347511713`）＋`skAdNetworkItems`。ATT 文言（`NSUserTrackingUsageDescription`）は既存 infoPlist を流用。
  - `.env.example`: AdMob バナー ID の説明を追記（App ID は env でなく app.json、の注記）。
- 検証: `npm run typecheck` パス。`npx expo config --type introspect` で iOS `GADApplicationIdentifier`・`SKAdNetworkItems`・`NSUserTrackingUsageDescription` が解決されることを確認（Android manifest の meta-data は prebuild 時適用でintrospectには出ない＝正常）。
- **残（ユーザー作業＝AdMob 管理画面のみ）**: ①本番アプリ登録→App ID を app.json `androidAppId`/`iosAppId` に、バナーユニットID を `EXPO_PUBLIC_ADMOB_BANNER_*`（eas.json `production.env`）に設定 ②プライバシー＆メッセージングで **GDPR 同意フォーム＋ATT メッセージ**を構成（ATT は UMP フロー内で発火）③dev build で実機のテストバナー表示確認。※本番IDでの自己表示/自己クリックは BAN リスク（テストデバイス登録推奨）。
- 課金による広告非表示は要件どおり **v1.1**（`BannerAdSlot` に将来非表示にする旨のコメントを残置）。

## 2026-07-08 AdMob インタースティシャル（全画面）追加

- **トリガー＝支出の新規保存後**（編集時は出さない）。頻度は「控えめ」: **5回保存ごと／前回表示から3分以上／1セッション最大2回**。バナーと同様 native は動的 require（Expo Go クラッシュ回避）。
- 新規/変更ファイル:
  - `src/lib/interstitial.ts`（新）: 頻度制御つきコントローラ。`preloadInterstitial()`（起動時に先読み）／`recordSaveAndMaybeShowInterstitial(userId)`（保存時に呼ぶ・条件を満たし在庫があれば `InterstitialAd.show()`・CLOSED で次を先読み）。定数 `SHOW_EVERY_N_SAVES=5`・`MIN_INTERVAL_MS=3分`・`MAX_PER_SESSION=2`。
  - `src/lib/ads.ts`: `getInterstitialAdUnitId()`（テストID iOS `/4411468910`・Android `/1033173712`、本番は `EXPO_PUBLIC_ADMOB_INTERSTITIAL_*`）／**`INTERSTITIAL_AD_EXCLUDED_EMAILS`（除外メールアドレス配列・大小無視）** ＋ `isInterstitialSuppressedFor(email)`。ここにメールを足すと**そのユーザーだけ全画面広告を出さない**（バナーは全員に表示）。現状 `taishirou16@gmail.com` / `kanaho-s.twins_213@docomo.ne.jp` を登録済み。
  - `src/hooks/useAdsInit.ts`: SDK 初期化後に `preloadInterstitial()`。
  - `app/expense-input.tsx`: 新規保存の `router.back()` 後に `recordSaveAndMaybeShowInterstitial(session.email)`（`SessionContext.email` を使用）。
  - env: `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS`/`_ANDROID` を `env.ts`・`env.d.ts`・`.env.example` に追加。
- 検証: `npm run typecheck` パス。
- **残（ユーザー作業）**: 本番運用時に AdMob でインタースティシャル広告ユニットを作成→`EXPO_PUBLIC_ADMOB_INTERSTITIAL_*`（eas.json `production.env`）に設定。除外したいアカウントは `INTERSTITIAL_AD_EXCLUDED_EMAILS` にメールアドレスを追記。

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
- [~] **プッシュ通知の実配信**: **クライアント実装＋Supabase側デプロイ/Webhook完了（2026-07-05）**。残りは dev build を実機に入れての受信確認のみ。
  - 完了ファイル: `src/lib/push.ts`（許可要求→Expo Push Token取得・Androidチャンネル・前面表示ハンドラ。実機dev/prod buildのみ動作、Expo Go/シミュレータは null で no-op）／`usePushRegistration` フック（ログイン時にトークン取得→`profiles.expo_push_token` 保存、通知タップで `/notifications` へ遷移。`_layout.tsx` の RootNavigator で常時起動）／`Backend.registerPushToken`（supabase=profiles更新, mock=保持）。
  - Edge Function `send-push-notification` 更新: **Supabase Database Webhook 形式（record）と直接呼び出しの両対応**・受信者の `notification_settings` で該当種別OFFなら送信スキップ・任意の `PUSH_WEBHOOK_SECRET`（`x-webhook-secret` 一致）で保護。アプリ内通知は従来どおり DBトリガー `notify_partner` が `notifications` に INSERT する。
  - 依存追加: `expo-notifications` / `expo-device`（app.json に `expo-notifications` プラグイン追加、accent color のみ指定）。**push には dev build 必須**（Expo Go 不可）。
  - **完了済み（ユーザー作業・2026-07-05）**: ①`send-push-notification` をダッシュボードのEditorでデプロイ済 ✅ / ②Edge Function Secret `PUSH_WEBHOOK_SECRET` 設定済＋**Verify JWT を OFF**（＝anon keyでなく独自シークレットで保護）✅ / ③Database Webhook `on_notification_insert_push`（table=`notifications` / INSERT / HTTP Request / URL=関数 / header `x-webhook-secret`）作成済 ✅ / ④iOS dev build で **APNsキーを生成**（`eas build` の push設定でYes）✅。※シークレット値は公開リポのため記録しない（Supabaseダッシュボードに保管）。
  - **残（ユーザー作業）**: dev build を実機にインストール → ログイン＆プッシュ許可 → `profiles.expo_push_token` に値が入るのを確認 → 受信テスト（expo.dev/notifications にトークンを貼る or パートナーが支出追加）。※配線チェックはビルド前でも可: SQLで `notifications` に1行INSERT → 関数Logsに `skipped: no token` が出れば webhook→関数 は正常。※Androidで配信するなら別途 FCM(V1) サービスアカウント登録が必要。
  - 設計判断: 「トークン保存はクライアント／配信はDB Webhook→Edge Function」。DBトリガー(pg_net直呼び)でなくWebhookにしたのは設定がダッシュボードで完結し、将来の予算アラート等サーバー起点の通知も同じ経路に載せられるため。
- [x] **固定費の月次自動計上/リマインド**: **実装＋適用完了（`0005_fixed_cost_cron.sql`・2026-07-05）**。pg_cron ジョブ2本 active 登録済み。残りは実データでの動作スモークのみ。
  - 方式: Edge Function ではなく **pg_cron + DB関数**（HTTP不要・通知は既存 `notifications` INSERT→Webhook→`send-push-notification` 経路に自動で乗る）。
  - `post_fixed_expenses()`（`type='fixed'` を billing_day に expenses 生成・当月既存はスキップ・自動計上分は通知しない）／`send_variable_reminders()`（`type='variable'` 当月未入力を reminder_day にペア両者へ `reminder_variable` 通知）／両者を **月末超過は月末に丸め**・**JST基準**で判定。pg_cron ジョブ 2本（UTC15:00 / 15:15 = JST 00:00 / 00:15）。
  - 付随: `notify_user()` ヘルパー新設で通知設定ゲートを一本化し `notify_partner` を付け替え。`on_expense_change` は自動計上（`is_fixed_cost=true`）の INSERT で「パートナーが記録」通知をスキップするよう修正。
  - **残（ユーザー作業）**: SQL Editor で `0005` を実行（`create extension pg_cron` 含む。権限エラー時は Database>Extensions で pg_cron 有効化後に再実行）。確認は `select post_fixed_expenses();` / `select send_variable_reminders();` を手動実行、または `billing_day`/`reminder_day` を今日(JST)に一時変更して即確認（手順は SUPABASE_SETUP.md 8.5）。
- [~] **Apple / Google ログイン**: **クライアント実装完了（2026-07-05・ネイティブ `signInWithIdToken` 方式）**。残りはユーザーの外部設定＋dev build。
  - 方式: Apple=`expo-apple-authentication`／Google=`@react-native-google-signin/google-signin` で ID トークンを取得 → `supabase.auth.signInWithIdToken`（Webリダイレクト無し・UX最良）。
  - 完了ファイル: `src/lib/oauth.ts`（Apple/Google のトークン取得。Google は Expo Go 非対応のため遅延 import、キャンセルは `OAuthCancelledError` で無音処理）／`Backend.signInWithIdToken`（IF・supabase・mock）／`useAuthActions.signInWithProvider`／ログイン画面のボタン配線（Apple は iOS/モックのみ表示・多重押下防止）。app.json に `expo-apple-authentication` プラグイン＋`usesAppleSignIn` ＋ google-signin プラグイン（`iosUrlScheme` は**プレースホルダ**）。env に `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`/`_IOS_CLIENT_ID` 追加。
  - 任意: migration `0006_oauth_profile_name`（OAuth新規の表示名/アバターを full_name/name/picture から採用。未適用でもログインは動く）。
  - **外部設定 完了（2026-07-05）**: ①Supabase Apple 有効化（Client IDs=Bundle ID `com.mobileappworks.webudget`・Secret空で保存）✅ ②GCP プロジェクト WeBudget で iOS/Web OAuthクライアント作成✅ ③app.json の `iosUrlScheme` を実値（`com.googleusercontent.apps.604611415530-kpeeq0km44le9rt1veka4g9kqp6pfdfr`）に置換✅ ④.env に `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`/`_WEB_CLIENT_ID` 設定✅ ⑤Supabase Google 有効化（Client IDs=iOS+Web、Secret=Web secret）✅
  - **残（ユーザー作業）**: **dev build を作成して実機で Apple/Google ログインを確認するだけ**（`eas build --profile development` 等。Expo Go 不可）。※Google/iOS の client ID は公開値。Web client **secret** は Supabase のみに保管（リポジトリには置かない）。

### 🔴 審査ブロッカー（リリース必須・軽い順）
- [x] **delete-account Edge Function デプロイ**（2026-07-05 完了）: ダッシュボードの Via Editor でデプロイ済。**Verify JWT は ON**（アプリが本人JWTを付けて呼ぶため。push関数のOFFとは逆）。Secret `SUPABASE_SERVICE_ROLE_KEY` は自動注入。
  - 配線確認済み: `curl -s -o /dev/null -w "%{http_code}" -X POST https://oarbchcwtfxjxvjnuoaw.supabase.co/functions/v1/delete-account` → **401**（デプロイ前は 404 だった）＝JWTなしで弾かれる正常動作。アプリ呼び出し（[supabaseBackend.ts:94](../src/data/supabaseBackend.ts#L94) の `sb.functions.invoke('delete-account')`、本人セッションJWT付き）と整合確認済み。
  - **残（軽い・任意）**: ⚠️実削除スモークテスト＝**使い捨てアカウント**でログイン → 設定 → アカウントを削除 → 成功してログアウトされるか確認（本番アカウントでは絶対にやらない）。未実施。
- [~] **プライバシーポリシー公開**: **GitHub Pages 設定完了（main / `/docs`）・初回ビルド中**（2026-07-05）。アプリのリンク先 `APP_CONFIG.privacyPolicyUrl`（[constants/index.ts:18](../src/constants/index.ts#L18)）は既に公開URLを指す。
  - **2026-07-05 修正**: `docs/privacy-policy.html` の OCR 記述が旧仕様（Google Cloud Vision に画像送信）のままだったので、**端末内OCR（画像は外部送信なし）**に日英とも修正（AI同意画面の文言・実装と整合）。最終更新日も 2026-07-05 に更新。※AdMob/Sentry は導入予定サービスとして記載を残置。
  - **公開URL**: `https://mobileapp-works.github.io/we-budget/privacy-policy.html`（owner=mobileapp-works で確定）。
  - **残（次スレで確認）**: ①`curl -s -o /dev/null -w "%{http_code}" <URL>` が **`200`** を返すか（2026-07-05 のハンドオフ時点はビルド中で **404**。初回ビルドは数分〜10分）。GitHub の Actions タブ「pages build and deployment」が緑✓なら完了。②`200` 確認後、App Store Connect の「Privacy Policy URL」に同URLを設定（提出時）。
- [ ] **スクリーンショット**: 6.9インチ iPhone + iPad（実機/シミュレータで撮影）

### 💰 収益化
- [~] **AdMob バナー**: `react-native-google-mobile-ads`(16.4.0) 導入・app.json プラグイン設定・`BannerAdSlot`→実`BannerAd`差し替え・UMP同意→SDK初期化(`useAdsInit`)まで実装済み。**現状はテストID**（app.json の App ID = Google公式テスト値 / バナーは `src/lib/ads.ts` の `getBannerAdUnitId()` が dev・IS_MOCK でテストID）。
  - **残**: ①AdMob管理画面で本番アプリ登録→App ID を app.json の `androidAppId`/`iosAppId` に、バナーユニットIDを `EXPO_PUBLIC_ADMOB_BANNER_*`(eas.json production.env) に設定。②AdMob プライバシー＆メッセージングで **GDPR同意フォーム + ATTメッセージ** を構成（ATTはUMPフロー内で発火）。③development build で実機動作確認。※導入済みのため **Expo Go 不可**、development build 必須。
- [ ] **サブスク課金**: 広告非表示 + AI機能（RevenueCat 等の選定から）

### その他（時期未定）
- [ ] Sentry セットアップ（DSN発行 → `@sentry/react-native` 導入 → ErrorBoundary の TODO 解消）
- [ ] EAS Build 実機ビルド → TestFlight → ストア提出物（説明文・App Privacy 申告）
- [ ] 2アカウントでのペア共有 E2E 確認（RLS検証。docs/test_plan.md 参照）

## 審査コンプライアンス対応状況
- [x] プライバシーマニフェスト（app.json privacyManifests, CA92.1）
- [x] 権限の利用目的（カメラ/写真/ATT の infoPlist 説明文）
- [x] ログアウト（設定画面）
- [x] アカウント削除（UIあり・呼び出し整合確認済み。**delete-account デプロイ済（2026-07-05、エンドポイント 401 確認）**。残りは捨てアカウントでの実削除スモークテストのみ）
- [~] プライバシーポリシーの公開URL（html準備済み・**2026-07-05 に OCR記述を端末内OCRへ修正**、アプリのリンク先も設定済み。**GitHub Pages 設定完了・初回ビルド中／URL 200 は次スレで確認**）
- [ ] ATT/UMP 同意フロー（AdMob 導入時に対応）

## 既知の制限事項
- レシートOCRは端末内OCR（ML Kit）方式。**dev build でのみ実動作**し、Expo Go では `__DEV__` フォールバックのサンプルが出るだけ（実画像は読まない）。
- プッシュ通知はクライアント登録・Edge Function 更新まで完了。**実配信は `send-push-notification` デプロイ＋Database Webhook 設定後**（dev build 必須。Expo Go/シミュレータではトークン取得できず登録スキップ）。アプリ内通知は従来どおり動作。
- Apple / Google ログインはネイティブ方式のため **dev build でのみ実動作**（Expo Go/モックでは押すとデモユーザーでログイン）。GCP クライアント・Supabase プロバイダ・app.json の `iosUrlScheme`・`.env` は設定済み（2026-07-05）。Web client secret は Supabase のみに保管（リポジトリには置かない）。
- レポートは円グラフではなく割合バーで表示（チャートライブラリ未導入。MVP範囲）。
- 為替レートは最新1件方式（支出日時点の履歴は持たない）。
- 二重レシート登録防止は未実装（将来課題）。
- リポジトリは Public のため、eas.json の Supabase URL / anon key は公開状態（anon key は公開前提だが、防壁はRLSのみ。RLS検証を必ず行うこと）。
