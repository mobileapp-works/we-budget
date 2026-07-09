# WeBudget 総合テストケース（リリース前）

作成: 2026-07-09 / 対象: MVP v1.0.0（Expo SDK 54 / 実 Supabase 接続 / iOS 提出）

このドキュメントは **要件定義・設計・実装・デザインのすべて** を対象にした網羅的テストケース集です。
各ケースには検証手段を付けています。既存の `docs/test_plan.md` の手動チェックリストを補完・上位化します。

## 凡例（検証手段）

| タグ | 意味 | 実行方法 |
|------|------|---------|
| **AUTO** | 自動テストで担保済み/追加済み | `npm test`（Jest 131件）・`npm run typecheck`・`npx expo export` |
| **MANUAL** | 実機（dev build / TestFlight）で手動確認が必要 | §5 に集約 |
| **SQL** | Supabase の SQL Editor / REST で確認 | §6 に手順 |
| **REVIEW** | ソース精査で確認済み（本監査で目視検証） | `docs/pre_release_audit.md` 参照 |

## 現在の自動テスト状況（2026-07-09 実行）

- `npm test` → **132 passed / 8 suites**（money 12・settlement 19・budget 16・sharedAccount 5・receipt 16・validation 11・date 5・**mappers 18〔本監査で追加〕**、他）
- `npm run typecheck` → **エラー 0**（tsc strict / noUncheckedIndexedAccess）
- `npx expo export --platform ios` → **成功**（JSバンドル生成・循環参照/未解決 import なし）

---

## 1. 要件カバレッジ（requirements.md §6 MVP機能 1–16）

| ID | 要件 | テストケース | 手段 |
|----|------|------------|------|
| R1-1 | 認証: メール登録 | 新規登録→確認メール送信画面→リンク確認後にログイン可 | MANUAL |
| R1-2 | 認証: メールログイン/ログアウト | 正しい資格情報でホーム遷移／誤り時 `error.invalidCredentials`／ログアウトでログイン画面へ | MANUAL |
| R1-3 | 認証: Apple Sign-In | iOS実機でAppleボタン表示→サインイン→profiles生成（名前非公開時 `display_name='ユーザー'`） | MANUAL |
| R1-4 | 認証: Google Sign-In | Googleサインイン→ID token→Supabase認証成功 | MANUAL |
| R1-5 | 認証: パスワードリセット | ログイン画面「お忘れの方」→メール→`webudget://reset-password` ディープリンク→新パスワード設定 | MANUAL |
| R1-6 | 認証: アカウント削除 | 設定→削除確認→`delete-account` 呼出→ログアウト。個人払い支出の payer が NULL 化（匿名化）で行は残る | MANUAL + SQL(§6-8) |
| R2-1 | ペアリング: 招待コード生成/共有 | 招待コード表示・Shareシート起動 | MANUAL |
| R2-2 | ペアリング: 承認制フロー | 申請→招待側に `pair_request` 通知→承認→成立→申請者に `pair_approved`／拒否で `pair_declined` | MANUAL(2端末) + SQL(§6-7) |
| R2-3 | ペアリング: 二重ペア防止 | 成立済みユーザーが別コードで申請→`already paired`（`pairing.alreadyPaired` 表示） | REVIEW(0009/0010) + MANUAL |
| R3-1 | レシートOCR: 抽出 | 金額/店名/日付の抽出（座標ベース行再構成） | **AUTO**(receipt.test 16件) |
| R3-2 | レシートOCR: 実機読み取り | dev build でカメラ→ML Kit→フォーム自動入力。Expo Go はサンプル表示 | MANUAL |
| R3-3 | レシートOCR: 画像保存 | 保存時に receipts バケット（private, `{pair_id}/`）へアップロード→署名URLで閲覧 | MANUAL + SQL(§6-9) |
| R4-1 | 支出記録: 手動入力 | 金額・カテゴリ・支払者・通貨・日付・店名・メモを保存→一覧/ホーム/レポート反映 | MANUAL |
| R4-2 | 支出記録: 支払者選択 | 自分/パートナー/共同口座。ソロ時は自分のみ（`payerOptions`） | REVIEW(expense-input) + MANUAL |
| R4-3 | 支出: 編集/削除（双方可） | どちらのユーザーでも編集/削除。削除は確認ダイアログ。楽観ロック競合検知 | **AUTO**(mappers/衝突ロジック) + MANUAL |
| R5-1 | 立替精算: 残高計算 | 50:50/カスタム割合/共同払い除外/未精算のみ/外貨換算/レート未設定除外/端数丸め | **AUTO**(settlement.test 19件) |
| R5-2 | 立替精算: 実行 | 精算確認ダイアログ→RPC 再計算→settlements作成→対象expensesにsettlement_idスタンプ→残高0 | MANUAL + SQL(§6-4) |
| R5-3 | 立替精算: 履歴 | settlements が「誰→誰・金額・日付」で残る | MANUAL |
| R5-4 | 月末精算リマインド | 月末日(JST)に未精算残高があれば両者へ `settlement_reminder` | SQL(§6-6) |
| R6-1 | 共同口座: 残高 | Σ入金 − Σ現金移動 − Σ共同払い支出（全期間・外貨換算） | **AUTO**(sharedAccount.test 5件) |
| R6-2 | 共同口座: 入金記録 | 入金→残高反映。共同買い物は支出入力の「共同口座」で計上（二重入力回避） | MANUAL |
| R7-1 | 固定費: 自動計上 | billing_day(JST) に type=fixed を expenses へ生成。冪等（重複生成なし）。自動計上は「記録」通知を出さない | SQL(§6-5) |
| R7-2 | 変動固定費: リマインド | reminder_day 当日・当月未入力なら両者へ `reminder_variable` | SQL(§6-6) |
| R8/R9 | 予算: 設定・アラート | 80%警告/100%超過（境界79/80/100）・外貨換算・月+種別で重複1回・80と100同時跨ぎは超過のみ | **AUTO**(budget.test 16件) + SQL(§6-6) |
| R10 | カテゴリ管理 | デフォルト9種の複製・並び替え・非表示・カスタム追加/写真。デフォルトは削除不可（非表示のみ） | MANUAL + SQL(§6-3) |
| R11 | レポート/グラフ | 月/週/カスタム切替・カテゴリ別集計 | MANUAL |
| R12 | 複数通貨 | JPY以外の記録・レポート/精算はJPY換算（レート手入力） | **AUTO**(money.test) + MANUAL |
| R13 | 設定 | 言語/テーマ/通知/プライバシー/バージョン/ログアウト/削除 | MANUAL |
| R14 | バナー広告 | 各画面下部に AdMob バナー（SafeArea・コンテンツと非重複） | MANUAL（§Apple） |
| R15 | 外部AI同意 | OCR前に同意画面。※実装は端末内OCRのため「外部送信なし」と正しく明記 | REVIEW + MANUAL |
| R16 | パートナー通知 | 支出記録/編集/削除/精算をパートナー/両者へ通知。設定でON/OFF | SQL(§6-4/§6-7) + MANUAL |

## 2. 設計カバレッジ（design.md）

### 2-1. 画面（18画面）と4状態

各画面で Loading / Empty / Error / Success を確認（design.md §8）。**MANUAL**。
`StateView` / `EmptyState` コンポーネント経由で実装済み（REVIEW）。重点:

- ホーム: Empty=「最初の支出を記録」CTA／取得前に立替残高を誤表示しない（`balanceQuery.data` がある時のみ描画：REVIEW済）
- 立替精算: ソロ=招待CTA／ペア=「精算はありません」／Error=再試行
- レポート: データ不足時「データが足りません」

### 2-2. データモデル / 変換層

- snake_case ⇔ camelCase の全テーブル変換 → **AUTO**（mappers.test 18件、numeric→Number 強制も検証）
- 楽観的ロック（updated_at 一致で更新、不一致で `conflict`） → REVIEW（supabaseBackend.updateExpense）+ MANUAL(2端末)
- 論理削除（deleted_at IS NULL でSELECT） → REVIEW + SQL

### 2-3. RLS / ペア分離

- 各テーブル pair_id スコープ / notifications 自分宛のみ / settlements 参照のみ → SQL(§6-2, §6-7)
- Storage: receipts private（ペア外の署名URL不可）/ avatars public read → SQL(§6-9)

### 2-4. RPC / トリガー

- `calculate_settlement_balance` / `execute_settlement` のロジックがクライアント純関数と一致 → **AUTO**（settlement.test）+ SQL(§6-4)
- `handle_new_user`（profiles+ソロpair+カテゴリ9種+通知設定を原子生成） → SQL(§6-1)
- `post_fixed_expenses` / `send_variable_reminders` / `send_settlement_reminders` / `check_budget_alerts` → SQL(§6-5/6-6)

## 3. 実装/ロジック（純関数ユニットテスト＝AUTO）

| モジュール | 主なケース | 件数 |
|-----------|----------|------|
| `utils/money` | 通貨別丸め桁・符号付き表示(＋/−)・直接/逆レート換算・レートなしnull | 12 |
| `utils/settlement` | 50:50/カスタム/共同払い除外/精算済み除外/ソロ/退会null/外貨/レート未設定警告/端数・isSettleableExpense | 19 |
| `utils/budget` | 79/80/100境界・予算0・外貨換算・換算不可除外・閾値重複防止 | 16 |
| `utils/sharedAccount` | 入金のみ/共同支出減算/現金移動減算/個人払い無関係/外貨 | 5 |
| `utils/receipt`(+ocrRows) | 金額/店名/日付抽出・行再構成・ノイズ除去 | 16 |
| `utils/validation` | メール形式・パスワード6文字・金額パース | 8 |
| `utils/date` | 月キー・月範囲・同月判定・整形 | 5 |
| `data/mappers` | 全行→ドメイン変換・numeric→Number・null正規化 | 18〔追加〕 |

## 4. UI / デザインカバレッジ（docs/ui, design.md §7-9）

| ID | 項目 | 手段 |
|----|------|------|
| U-1 | ダークモードで全画面崩れなし（色トークン経由） | MANUAL |
| U-2 | iPhone SE（〜374px）で崩れない・固定幅なし | MANUAL |
| U-3 | iPad（≥768px）で中央寄せ/最大幅（`useResponsive`） | MANUAL |
| U-4 | Dynamic Type 最大でレイアウト維持 | MANUAL |
| U-5 | タップ領域 44pt 以上（`layout.minTapSize`） | REVIEW + MANUAL |
| U-6 | 損益を色だけで伝えない（＋/− 記号・チェックアイコン併用） | REVIEW(home BalanceCard) + MANUAL |
| U-7 | VoiceOver で支出入力→精算が操作可（accessibilityLabel/Role） | MANUAL |
| U-8 | バナー広告がコンテンツ・ホームインジケータと重ならない | MANUAL（§audit 参照・要確認） |
| U-9 | i18n: ja/en 全キー対応・直書きなし | **AUTO**(typecheck) + REVIEW（locales 完全一致） |
| U-10 | 通知テキストの言語（サーバー生成は日本語固定） | REVIEW（既知の未対応・audit参照） |

---

## 5. 手動テスト専用リスト（実機 dev build / TestFlight）

> AI では検証不可。実機で順に確認してください。§ごとに区切り。

### 5-A. 認証フロー
1. メール新規登録 → 確認メール受信 → リンク確認 → ログイン → ホーム
2. ログアウト → ログイン画面 → 再ログイン
3. パスワード忘れ → リセットメール → ディープリンクで新パスワード設定 → 新パスワードでログイン
4. Apple Sign-In（実機必須）→ 初回で profiles/ソロpair/カテゴリ生成
5. Google Sign-In → 同上
6. 未ログイン起動 → ログイン画面（保護画面に入れない）
7. アカウント削除（**捨てアカウント**）→ 実削除・ログアウト（本番アカウントでは実行しない）

### 5-B. 支出
8. 手動入力で支出追加 → ホーム/履歴/レポート反映
9. レシート撮影 → OCR自動入力 → 確認・修正 → 保存（画像も保存）
10. OCR失敗3種の案内（文字なし/金額なし/エラー）
11. 支出編集・削除（確認ダイアログ）→ 反映
12. カテゴリフィルタ絞り込み（履歴）
13. 支払者（自分/相手/共同口座）選択・ソロ時は自分のみ
14. 保存ボタン連打で二重登録されない
15. 2端末で同じ支出を編集 → 競合検知（後勝ち上書きしない・`error.conflict`）

### 5-C. 立替精算
16. 残高が「誰が誰にいくら」で表示
17. 精算実行 → 確認ダイアログ → 残高0
18. 精算履歴が残る
19. 外貨（USD等）支出 → 精算画面に警告＋レート入力カード → レート保存 → 残高再計算・警告消滅
20. ソロモードで招待CTA表示

### 5-D. その他機能
21. 共同口座: 入金記録 → 残高反映／共同買い物は支出入力から
22. 固定費: 追加/編集/削除・変動費の未入力バッジ
23. 予算: 設定 → ホーム進捗バー色分け（〜79緑/80黄/100赤）
24. レポート: 月/週/カスタム切替・カテゴリ別
25. 通知一覧: 既読/全既読・未読バッジ
26. プロフィール: 表示名/アイコン変更・負担割合（50:50/60:40/40:60）
27. ペアリング: 招待→2端末目で申請→承認→立替が見える
28. ペア解除: 未精算あり→精算を促すダイアログ／解除後も自分の記録は閲覧可
29. 設定: 言語切替（ja/en/auto）・テーマ（light/dark/system）即時反映

### 5-E. 通知（実機プッシュ）
30. パートナーが支出記録 → 相手にプッシュ＋アプリ内通知
31. 精算実行 → 両者に `settlement` 通知（`expense_edited` が連発しない）
32. 予算80%/100%跨ぎ → `budget_warning`/`budget_exceeded` が各1回
33. 通知タップ → 該当画面へ遷移
34. 通知設定で種別OFF → その種別のプッシュ/アプリ内が来ない

### 5-F. UI/デザイン/A11y
35. ダークモード全画面
36. iPhone SE / 標準 / Plus / iPad
37. Dynamic Type 最大
38. VoiceOver 操作
39. バナー広告の位置（コンテンツ・タブバー・ホームインジケータと重ならないか）→ §audit U-8

### 5-G. 広告 / ATT
40. 初回起動で UMP/ATT フロー（AdMob 管理画面のメッセージ構成が前提）
41. バナー表示（本番ビルドで本番ID・テスト中はテストID）
42. 支出保存5回ごと等の頻度でインタースティシャル（除外メールは非表示）

---

## 6. Supabase 確認事項（SQL Editor / REST での確認手順）

> Supabase ダッシュボード → SQL Editor で実行。REST 確認は anon キーで `POST /rest/v1/rpc/...`。
> 前提: migration **0001–0014 適用済み**（0013 = notify_partner public 剥奪、0014 = 精算残高RPCの権限修正＝いずれも要適用）。

### 6-0. 適用の棚卸し（オブジェクト存在）
`docs/test_plan.md §7-1` の SQL 一式を実行:
- テーブル13件（pairs/profiles/categories/expenses/fixed_costs/settlements/shared_account/budgets/exchange_rates/notifications/notification_settings/pair_requests/budget_alerts）
- 全テーブル `relrowsecurity = true`
- 関数一覧に `calculate_settlement_balance / execute_settlement / handle_new_user / notify_user / notify_partner / post_fixed_expenses / send_variable_reminders / send_settlement_reminders / check_budget_alerts / request_pair / respond_pair_request / cancel_pair_request / list_incoming_pair_requests / leave_pair / update_split_ratio / get_my_pair_id` が含まれ、`join_pair` が**含まれない**
- Storage バケット `receipts`(非public)/`avatars`(public)/`category-icons`(public)
- pg_cron 3本 active（post_fixed_expenses `0 15 * * *` / variable_reminders `15 15 * * *` / settlement_reminders `0 11 * * *`）

### 6-1. サインアップ・トリガー（handle_new_user）
捨てアカウントで新規登録後:
```sql
select p.pair_id, pr.user1_id, pr.user2_id,
  (select count(*) from categories c where c.pair_id = p.pair_id) as cat_count,
  (select count(*) from notification_settings n where n.user_id = p.id) as ns_count
from profiles p join pairs pr on pr.id = p.pair_id
where p.id = '<新規user_id>';
```
期待: `cat_count = 9`・`ns_count = 1`・`user2_id IS NULL`（ソロ）

### 6-2. RLS / ペア分離（要2アカウント）
- アカウントBの JWT で アカウントAの pair の expenses を SELECT → **0行**（RLSで遮断）
- REST: `GET /rest/v1/expenses?pair_id=eq.<A_pair>`（Bのトークン）→ 空配列
- `pair_requests` は当事者のみ SELECT（第三者トークンで空）

### 6-3. カテゴリ
```sql
select is_default, count(*) from categories where pair_id = get_my_pair_id() group by 1;
```
デフォルト削除不可の確認: `delete from categories where is_default = true;` → 0行削除（RLS `is_default=false` 条件）

### 6-4. 精算（execute_settlement）
未精算の個人払い支出を数件作った状態で:
```sql
select calculate_settlement_balance(get_my_pair_id());   -- 残高プレビュー
-- アプリから精算実行後:
select * from settlements order by settled_at desc limit 1;              -- from/to/amount
select count(*) from expenses where settlement_id is null
  and is_shared_payment = false and deleted_at is null
  and pair_id = get_my_pair_id();                                        -- 期待: 0（全件スタンプ済）
```
- 精算後に `calculate_settlement_balance` が `settlementAmount = 0` を返すこと
- notifications に両者ぶんの `settlement` が1件ずつ・`expense_edited` が連発**しない**こと

### 6-5. 固定費 自動計上（冪等）
```sql
-- billing_day を当日(JST)にした type=fixed の固定費を用意して:
select post_fixed_expenses();   -- 生成件数
select post_fixed_expenses();   -- 期待: 0（同月二重生成しない＝冪等）
select * from expenses where is_fixed_cost = true and fixed_cost_id = '<fc_id>'
  and date_trunc('month', expense_date) = date_trunc('month', now() at time zone 'Asia/Tokyo');
```
自動計上分に「パートナーが記録」通知が**出ない**こと（is_fixed_cost=true は notify スキップ）

### 6-6. リマインド・予算アラート
- 変動費: `select send_variable_reminders();` → reminder_day 当日・未入力に `reminder_variable`
- 予算: 予算設定後 80%/100% を跨ぐ支出を追加 → `select * from budget_alerts;` に (budget,month,threshold) が記録・通知が各1回
- 月末精算: `select send_settlement_reminders();` を月末日以外に実行 → **0**（何も送らない）

### 6-7. 承認制ペアリング E2E
```sql
select request_pair('<Bの招待コード>');           -- Aで実行。req_id 返る
-- Bで:
select list_incoming_pair_requests();             -- requester_name 込みで見える
select respond_pair_request('<req_id>', true);    -- 承認
select user1_id, user2_id from pairs where id = '<Bのpair>';   -- user2_id = A
```
notifications に A宛 `pair_approved`（拒否なら `pair_declined`）

### 6-8. アカウント削除（0008 制約）
捨てアカウントで個人払い支出を作成 → アプリで削除:
```sql
select id, payer_user_id, is_shared_payment from expenses where id = '<expense_id>';
-- 期待: payer_user_id IS NULL（匿名化）・行は残る（0008 未適用だと制約違反で500）
```

### 6-9. Storage（receipts private）
- アカウントBのトークンで A の receipt パスに `createSignedUrl` → エラー/不可
- REST: `GET /storage/v1/object/sign/receipts/<A_pair>/xxx.jpg`（Bのトークン）→ 403

### 6-10. 内部関数の EXECUTE 剥奪（0012/0013）
anon キーで:
```
POST /rest/v1/rpc/notify_user      → 42501 permission denied
POST /rest/v1/rpc/notify_partner   → 42501 permission denied
POST /rest/v1/rpc/post_fixed_expenses / send_variable_reminders /
     send_settlement_reminders / check_budget_alerts → 42501
```
> ✅ `calculate_settlement_balance` のメンバーチェックは **0014 で修正済み**（`docs/pre_release_audit.md` F-1）。
> **0014 適用後**に、anon/別ペアのトークンで `POST /rest/v1/rpc/calculate_settlement_balance {"p_pair_id":"<他人のpair>"}` を投げ、
> `forbidden` / permission denied となり **他ペアの残高・user_id が返らない**ことを検証する（自分のペアでは正常に返ること）。
