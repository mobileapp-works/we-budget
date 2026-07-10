# 実装ログ（WeBudget）

> 最終更新: 2026-07-09（0011・0012 適用済み・**0013（notify_partner の public 剥奪）要適用**・レシートOCR品質強化）。スレッド/モデルを切り替えながら開発するため、**このファイルが現状の正**。着手前にここを読むこと。

## 2026-07-09 内部関数の EXECUTE 権限修正（migration 0012・**要適用**）

- 0011 の適用確認を anon キー（REST /rpc/）で行った際に発見: **`revoke ... from public` では Supabase の関数保護にならない**。Supabase は関数作成時に anon / authenticated へ**個別に** EXECUTE を付与するため、0005・0011 の内部関数が実際には誰でも実行可能だった。
- 実害の可能性（確認済み）: `notify_user` はユーザーUUIDを知っていれば**任意文言の通知（プッシュ含む）を他人に送れる**（ペア解除後の元パートナーはUUIDを知っている）／`send_variable_reminders` 等はリマインド日に連打で通知の重複送信が可能。
- **`0012_function_execute_hardening.sql`（適用済み 2026-07-09）**: 内部専用6関数（notify_user / notify_partner / post_fixed_expenses / send_variable_reminders / send_settlement_reminders / check_budget_alerts）から anon・authenticated の EXECUTE を revoke。pg_cron（postgres実行）と SECURITY DEFINER 関数内からの呼び出し（定義者権限で権限チェック）には影響なし。
- **`0013_revoke_notify_partner_public.sql`（要 SQL Editor 実行）**: 0012 適用後の REST 再確認で **notify_partner だけまだ anon から実行できた（204）**。原因＝notify_partner は 0002 以降一度も `revoke from public` されておらず、public の EXECUTE を anon が**継承**していた（0012 は anon/authenticated 直接付与しか外していない）。→ 6関数を **public / anon / authenticated すべてから** revoke（冪等）。
- REST での確認結果（0012 適用後）: notify_user / post_fixed_expenses / send_variable_reminders / send_settlement_reminders / check_budget_alerts は **42501 permission denied** ✅・notify_partner のみ 204（→0013 で修正）・アプリ用 calculate_settlement_balance は 200 で無影響 ✅。
- 適用後の確認SQL・REST確認は test_plan §7-1 に追記。**今後の教訓: 内部関数は必ず `revoke ... from public, anon, authenticated`（public だけ、または anon/authenticated だけ、では塞げない）。**

## 2026-07-09 レシートOCR品質強化（端末内OCRのまま精度を最大化・DB変更なし）

「読み取れない・別の数字を拾う」対策。原因は ①ML Kit の `result.text` が2列組みレシートで「ラベル全部→金額全部」の順になり合計と金額の紐付けが全滅する（列分断）②撮影 quality 0.6 のJPEG圧縮ノイズが細字を潰す ③電話番号・日付・レジ番号などの「金額でない数字」の混入、の3つ。

- **`src/utils/ocrRows.ts`（新規・純粋関数）**: 行バウンディングボックスの縦の重なりで「物理行」を再構成（上→下・左→右）。frame が取れない環境では null → `result.text` にフォールバック
- **`src/lib/ocr.ts`**: `result.text` をやめ、blocks/lines の frame から `reconstructRows` で読み順テキストを生成
- **`src/utils/receipt.ts` 全面強化**:
  - 正規化: 全角数字/￥/カンマ→半角、¥トークン内の誤読補正（O→0・l/I→1）
  - ノイズ除去: 電話・郵便・日付時刻・レジ/伝票/会員番号・インボイスT番号・バーコード（8桁以上）・単価@・数量（×n/点/個）・マイナス値引きを金額抽出前に行から除去
  - 行分類（合計/小計/税/預り/釣り/支払手段/割引/税率内訳/ポイント）→ 信頼度順に採用: 合計行（**小計+税と一致する候補を優先**して誤読の最大値を回避）→ **預り−釣りで復元** → 小計+税で復元 → 支払手段行 → 価格らしい明細の最大
  - 合計語だけの行の直後の「金額のみ行」を救済（列分断がすり抜けた時の保険）
  - 日付: 令和/R・平成/H・2桁年（YY/MM/DD）・年末尾（MM/DD/YYYY、不正ならDD/MM再解釈）・全角に対応。複数日付はテキスト先頭側を優先（ポイント有効期限の誤採用防止）
  - 店名: 挨拶・住所（都道府県はじまり）・「領収書」ヘッダ・レジ/担当行をスキップ、走査を先頭8行に拡大
- **撮影とアップロードの分離**: 撮影は quality 1 のままOCRへ（圧縮ノイズ回避）。アップロード用は `src/lib/receiptImage.ts`（新規）で**長辺1600px・JPEG 0.7 に縮小して base64 化**（通信量はむしろ削減）。依存追加: `expo-image-manipulator` ~14.0.8（Expo Go 内蔵モジュールなので dev build 不要層）
- **エラーメッセージ段階化**（ja/en）: `expense.ocrNoText`（文字ゼロ→明るさ/真上からの撮り方を案内）/ `expense.ocrNoAmount`（金額だけ失敗→ピント案内）/ `ocrFailed`（例外時）に分割
- 検証: typecheck / **jest 113件**（receipt+ocrRows 48件に拡充）すべてパス。実機での改善確認は dev build で（残）
- **次リリース案（ユーザー発案・未着手）**: 端末内OCRで失敗した時に「リワード広告を見てクラウド高精度OCR（Vision等）を1回試す」フォールバック。解析層 `parseReceiptText` はそのまま共通流用できる設計

## 2026-07-09 予算アラート・月末精算リマインド・為替レート入力UI（migration 0011・**適用済み**）

レビュー（review_2026-07-08.md）で未実装だった MVP 要件 R-8 / R-9 / R-3 をまとめて実装。

- **migration `0011_budget_alerts_settlement_reminder.sql`（適用済み・2026-07-09。cron jobid=3 登録確認・RESTで budget_alerts / check_budget_alerts / send_settlement_reminders の存在と「月末日以外は0」動作を確認）**:
  - **予算アラート（要件#9・7-3）**: `budget_alerts` テーブル（予算×月×閾値で一意＝同月の重複送信防止。RLS=ペアの SELECT のみ・書き込みはトリガー）+ `check_budget_alerts(pair_id)`（当月JSTの支出を JPY 換算で集計＝クライアント `calculateBudgetUsage` と同一条件（全支出対象・レート未設定外貨は除外）。80%で `budget_warning`・100%で `budget_exceeded` を**両ユーザー**へ `notify_user` 経由で送信＝設定ゲート `budget_alert` + 既存プッシュWebhookに自動で乗る。80/100を同時に跨いだ場合は超過のみ通知）。`on_expense_change` に配線（INSERT / 編集UPDATE で評価。**0009 の精算スタンプ抑止・自動計上の記録通知スキップは維持**。自動計上 INSERT も予算チェックは行う＝家賃で予算超過も検知）
  - **月末精算リマインド（要件#5・7-1・7-6）**: `send_settlement_reminders()`（**JSTの月末日のみ**実行。`calculate_settlement_balance` > 0 のペア両者へ `settlement_reminder` 通知・金額入り）+ pg_cron ジョブ3本目 `webudget_settlement_reminders`（毎日 UTC 11:00 = **JST 20:00**）
  - notifications.type の CHECK / notification_settings（`budget_alert`・`settlement_reminder` 列）は 0001 で定義済みのため変更なし。通知文言はサーバー側日本語固定（多言語化は H-12 で別途）
- **為替レート入力UI（要件7-9 / R-3）**: 精算画面に「為替レートの設定」カードを追加（レート未設定の外貨 + 設定済みレートの修正が同カードで可能。`1 {通貨} あたりの円` を入力→`parseAmount` 検証→保存）。保存で rates と settlementBalance を invalidate → 外貨立替が精算残高に即反映。未設定警告は残高0のカードにも表示するよう追加。`useExchangeRateActions.upsertRate` の onSuccess に settlementBalance 無効化を追加
- **通知タップ遷移（H-14 の主要分）**: budget_warning / budget_exceeded → 予算画面、settlement / settlement_reminder → 精算画面、reminder_variable → 固定費画面
- **mockパリティ**: mockBackend の支出追加/編集でも予算アラートを発火（Expo Go・モックでデモ可能）。閾値判定は純粋関数 `newlyReachedBudgetThresholds`（`src/utils/budget.ts`）に切り出し
- 検証: typecheck / **jest 81件**（+6: 閾値判定の境界・重複防止・同時跨ぎ） / expo export --platform ios すべてパス
- [x] **0011 適用済み（2026-07-09）**。動作スモーク（80%跨ぎ・レート入力E2E等）は総合テスト時に [test_plan.md](test_plan.md) §7 で実施
- [ ] **残: 0012（関数権限強化）の適用**（上のセクション参照。0011 の確認中に見つけたセキュリティ修正）

## 2026-07-09 GitHub Pages 404 解消（プライバシーポリシー公開完了）

- 症状: `https://mobileapp-works.github.io/we-budget/privacy-policy.html` が 404 のまま。原因は 2026-07-05 の Pages 設定（main / `/docs`）以降、**レガシー（Jekyll）ビルドが毎 push「Page build failed」（duration 0・エラー詳細なし）で即失敗**し、再ビルド要求もスタックして一度も公開されていなかったこと。
- 対処: ①`docs/.nojekyll` 追加（7aa2490）→ それでもレガシービルドがハングしたため ②**GitHub Actions 方式に移行**: `.github/workflows/pages.yml`（docs/** の push で `actions/deploy-pages` により docs/ を静的配信。`workflow_dispatch` で手動実行も可）+ Pages の `build_type` を API で `workflow` に変更（76b585e）。
- **公開確認済み（2026-07-09）**: デプロイ成功・URL が **200**・タイトル「プライバシーポリシー / Privacy Policy — WeBudget」を確認。以後 docs/ 配下を push すれば自動で再デプロイ（Actions タブ「Deploy GitHub Pages」）。
- 残: App Store Connect 提出時に「Privacy Policy URL」へ同 URL を設定するのみ。

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
- [x] **0010 適用済み（2026-07-08）**。適用済みマイグレーション: **0001〜0005・0007〜0010**（0006 は任意・未適用でも可。0007・0008 は 2026-07-09 適用確認）。
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
- **残（ユーザー作業）**: ①パスワード再設定は実機/シミュレータでメールリンク→新パスワード設定のE2E確認を推奨 ②精算を1回実行して「精算が完了しました」通知が両者に届くこと（編集通知が連発しないこと）のスモーク。※0007・0008 は適用済み（2026-07-09 確認。検証SQLは docs/test_plan.md「7. DB / migration 検証」）。

## 環境情報
- フレームワーク: React Native（**Expo SDK 54** / RN 0.81.5 / React 19 / **New Architecture 有効** / Expo Router）
  - **マネージド（prebuild/CNG）構成**（`ios/`・`android/` フォルダなし）。ネイティブ追加は config plugin で行う。
- 言語: TypeScript（strict, noUncheckedIndexedAccess 等を有効化）
- バックエンド: Supabase（**構築済み・実接続で動作中**。`EXPO_PUBLIC_USE_MOCK=false`）
  - プロジェクト: `oarbchcwtfxjxvjnuoaw.supabase.co`（URL/anon key は `.env` と `eas.json` に設定済み）
  - マイグレーション **0001〜0005・0007〜0010 適用済み**（0006 は任意・未適用でも可）。0005 は pg_cron ジョブ2本が active で登録済（2026-07-05 確認）。適用状態を確認する検証SQLは [docs/test_plan.md](test_plan.md)「7. DB / migration 検証」参照
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
- **migration `0007_category_icons_storage.sql`**（新規 public バケット `category-icons`、書き込みは `{pair_id}/` のみ／読み取り public）。**適用済み（2026-07-09 確認）**。avatars は既存 `0003_storage.sql` のポリシーで動作。
- 検証: typecheck / jest 75件パス。**残**: dev build で写真アップロード実機確認（Storage は Expo Go でも動くが実機確認推奨）。

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

## 2026-07-10 パスワードリセットのメールリンクが localhost に飛ぶ問題

- **症状**: リセットメールのリンクを開くと `http://localhost:3000` に遷移してアプリに戻れない。
- **原因**: クライアントは `redirectTo: 'webudget://reset-password'` を渡しているが、Supabase の Redirect URLs 許可リストは**完全一致（またはワイルドカード）**。手順書どおり `webudget://` だけを登録していると不一致となり、**Site URL（デフォルト `http://localhost:3000`）へフォールバック**していた。クライアント実装（フラグメントのトークン→`setSession`→新パスワード入力）自体は正常。
- **対応**:
  - `SUPABASE_SETUP.md` §7 を訂正（Redirect URLs に `webudget://**`、Site URL を `webudget://login` に変更する手順を明記）。
  - `supabaseBackend.signUp` に `emailRedirectTo: 'webudget://login'` を追加（**サインアップ確認メールも同じ原因で localhost に飛ぶ**穴の修正。未指定だと Site URL に飛ぶ）。
- **残（ユーザー作業）**: Supabase ダッシュボード → Authentication → URL Configuration で ①**Redirect URLs に `webudget://**` を追加** ②**Site URL を `webudget://login` に変更** → リセットメールを再送して実機で確認（メールのリンクは1回限り・有効期限ありのため古いメールは使えない）。

## 2026-07-10 パスワードリセットのエラーメッセージ整備・フロー堅牢化

- **エラーメッセージを文脈別に整備**（従来はほぼ `error.generic` 一律）:
  - `authErrors.ts` に追加: `same_password`（新パスワードが現在と同じ）→ 新キー `error.samePassword` ／ `session_missing`・`AuthSessionMissingError` → 新キー `error.sessionExpired`（ja/en 追加）。
  - リセット画面の3箇所を `authErrorKey` ベースに: メール送信失敗（ネットワーク/レート制限を区別）・トークン検証失敗（**通信エラーはリンク無効と区別**して再送を促さない）・パスワード更新失敗（同一パスワード/弱いパスワード/セッション切れを区別）。`error.auth` フォールバックは資格情報向け文言のため、この画面では `error.generic` に差し替え（`showAuthError` ヘルパー）。
- **リンク無効時のUX**: トースト（3秒で消える）だけだったのを、request フォーム上部に**消えないインライン警告**（`⚠ auth.resetLinkInvalid`・`accessibilityRole="alert"`）を常時表示に。
- **セッション切れで新パスワード設定に失敗**したら自動で**メール再送フォームへ戻す**（従来は「問題が発生しました」で行き止まり）。
- **リセット後フローの堅牢化**: `recoverSession` 成功時に `qc.clear()` を追加（signOut と同様）。端末共有で直前に別ユーザー（パートナー等）がログインしていた場合、リカバリーリンクでセッションが差し替わっても旧ユーザーのキャッシュ（支出等）が残る漏れを防止。
- **リセット後の挙動（確認済み・仕様）**: リンクを開いた時点でリカバリーセッション＝ログイン状態になり、新パスワード設定後はそのまま `/(tabs)` へ（再ログイン不要）。新パスワードを設定せずアプリを閉じてもログインは維持される（パスワードは旧のまま。メールへのアクセス自体が本人証明なので Supabase 標準挙動どおり許容）。他端末のセッションはパスワード変更で強制ログアウトされない（Supabase デフォルト）。
- `src/lib/authErrors.test.ts` 新規（同一パスワード/セッション欠落/既存マッピングの回帰テスト5件）。
- 検証: typecheck / jest **141件**パス。実機のディープリンク確認は上記ダッシュボード設定後。

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
- [x] **プライバシーポリシー公開**（**2026-07-09 完了・200 確認済み**）: レガシー Jekyll ビルドが恒常失敗していたため **GitHub Actions 方式に移行**（`.github/workflows/pages.yml`・build_type=workflow）。アプリのリンク先 `APP_CONFIG.privacyPolicyUrl`（[constants/index.ts:18](../src/constants/index.ts#L18)）は公開URLを指す。
  - **2026-07-05 修正**: `docs/privacy-policy.html` の OCR 記述が旧仕様（Google Cloud Vision に画像送信）のままだったので、**端末内OCR（画像は外部送信なし）**に日英とも修正（AI同意画面の文言・実装と整合）。最終更新日も 2026-07-05 に更新。※AdMob/Sentry は導入予定サービスとして記載を残置。
  - **公開URL**: `https://mobileapp-works.github.io/we-budget/privacy-policy.html`（owner=mobileapp-works で確定）。
  - **残**: App Store Connect の「Privacy Policy URL」に同URLを設定（提出時）のみ。※URL 200 は 2026-07-09 確認済み。
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
- [x] プライバシーポリシーの公開URL（**2026-07-09 公開完了・200 確認済み**。Actions 方式でデプロイ。残りは提出時に App Store Connect へ URL 設定のみ）
- [ ] ATT/UMP 同意フロー（AdMob 導入時に対応）

## 既知の制限事項
- レシートOCRは端末内OCR（ML Kit）方式。**dev build でのみ実動作**し、Expo Go では `__DEV__` フォールバックのサンプルが出るだけ（実画像は読まない）。
- プッシュ通知はクライアント登録・Edge Function 更新まで完了。**実配信は `send-push-notification` デプロイ＋Database Webhook 設定後**（dev build 必須。Expo Go/シミュレータではトークン取得できず登録スキップ）。アプリ内通知は従来どおり動作。
- Apple / Google ログインはネイティブ方式のため **dev build でのみ実動作**（Expo Go/モックでは押すとデモユーザーでログイン）。GCP クライアント・Supabase プロバイダ・app.json の `iosUrlScheme`・`.env` は設定済み（2026-07-05）。Web client secret は Supabase のみに保管（リポジトリには置かない）。
- レポートは円グラフではなく割合バーで表示（チャートライブラリ未導入。MVP範囲）。
- 為替レートは最新1件方式（支出日時点の履歴は持たない）。
- 二重レシート登録防止は未実装（将来課題）。
- リポジトリは Public のため、eas.json の Supabase URL / anon key は公開状態（anon key は公開前提だが、防壁はRLSのみ。RLS検証を必ず行うこと）。
