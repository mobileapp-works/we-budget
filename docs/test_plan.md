# テスト計画書・結果（WeBudget）

最終更新: 2026-07-09（単体テスト75件に更新・「7. DB / migration 検証」追加・状況の棚卸し） / 対象: MVP（Expo SDK 54 / 実Supabase接続）

## 1. テスト対象機能

| 機能名 | 重要度 | テスト手法 | 結果 |
|--------|--------|-----------|------|
| お金の計算（換算/立替/予算/共同残高） | 高 | 単体テスト | ✅ Pass（75件中） |
| レシートOCRの抽出（金額/店名/日付） | 高 | 単体テスト | ✅ Pass（16件） |
| DB / migration の適用・動作（SQL） | 高 | SQL Editor（§7） | 要確認 |
| 入力バリデーション（金額/メール/パスワード） | 高 | 単体テスト | ✅ Pass |
| ユーザー認証（登録/ログイン/ログアウト） | 高 | 手動（実機） | 要確認 |
| 立替精算（残高計算/精算実行/履歴） | 高 | 単体＋手動 | ロジック✅ / フロー要確認 |
| 支出記録（手動/レシート/編集/削除） | 高 | 手動 | 要確認 |
| 共同口座 / 固定費 / 予算 / レポート | 中 | 手動 | 要確認 |
| ペアリング（招待コード） | 中 | 手動（2端末） | 要確認 |
| 設定（言語/テーマ/通知/アカウント削除） | 中 | 手動 | 要確認 |

## 2. 単体テスト結果

| テストファイル | テスト数 | Pass | Fail |
|--------------|---------|------|------|
| settlement.test.ts | 19 | 19 | 0 |
| receipt.test.ts | 16 | 16 | 0 |
| money.test.ts | 12 | 12 | 0 |
| budget.test.ts | 10 | 10 | 0 |
| validation.test.ts | 8 | 8 | 0 |
| sharedAccount.test.ts | 5 | 5 | 0 |
| date.test.ts | 5 | 5 | 0 |
| **合計** | **75** | **75** | **0** |

実行: `npm test` / 型チェック: `npm run typecheck`（エラー0）※件数は 2026-07-09 実行結果

### カバーしている重要ケース
- 立替: 50:50 / カスタム割合 / 双方同額で精算不要 / 精算済み除外 / 共同口座払い除外 / ソロモード / 複数支出混在 / 退会者(null)除外 / 外貨換算 / レート未設定の警告 / 端数の整数丸め
- 予算: 79%(safe)/80%(warning)/100%(exceeded) 境界 / 予算0 / 外貨換算 / 換算不可の除外
- 共同残高: 入金のみ / 共同支出を引く / 現金移動を引く / 個人払いは無関係 / 外貨換算
- 金額: 通貨別の丸め桁 / 符号付き表示(＋/−) / 同一通貨そのまま / 直接・逆レート換算 / レートなしnull

## 3. コード整合性監査（結果）

| 観点 | 結果 |
|------|------|
| mock ↔ Supabase バックエンドの挙動一致 | ✅ 一致（一覧/作成/更新/削除/精算RPC） |
| クライアント精算ロジック ↔ SQL RPC | ✅ フィルタ・割合・丸め・from/to判定が一致 |
| 楽観的ロック（updated_at一致で更新） | ✅ mock/Supabase 双方で競合検知 |
| RLS 前提（自分のペアのみ） | ✅ 各クエリは pair_id スコープ（RLSで担保） |
| snake_case ↔ camelCase 変換 | ✅ mappers に集約・全テーブル網羅 |
| 型（tsc strict / noUncheckedIndexedAccess） | ✅ エラー0 |

## 4. UI手動確認チェックリスト（実機/Expo Go・TestFlight）

### 認証フロー
- [ ] 新規登録 → ホームに入れる
- [ ] ログアウト → ログイン画面に戻る → 再ログインできる
- [ ] パスワードを忘れた → リセットメール送信の導線が動く
- [ ] 未ログインで起動 → ログイン画面が出る（保護画面に入れない）

### 支出
- [ ] 手動入力で支出を追加 → ホーム/履歴/レポートに反映
- [ ] レシート撮影 → 画像添付 → 保存（OCR自動入力は今後）
- [ ] 支出の編集・削除（確認ダイアログ）→ 反映
- [ ] カテゴリフィルタで絞り込める
- [ ] 支払い者（自分/相手/共同口座）が選べる（ソロ時は自分のみ）

### 立替精算
- [ ] 立替残高が「誰が誰にいくら」で表示される
- [ ] 精算する → 確認ダイアログ → 残高が0になる
- [ ] 精算履歴が残る
- [ ] ソロモードでは招待CTAが出る

### その他機能
- [ ] 共同口座: 入金記録 → 残高反映
- [ ] 固定費: 追加 → 一覧表示 / 変動費の未入力バッジ
- [ ] 予算: 設定 → ホームの進捗バーが色分け（〜79緑/80黄/100赤）
- [ ] レポート: 月/週でカテゴリ別が切り替わる
- [ ] 通知一覧: 既読/全既読
- [ ] プロフィール: 表示名・アイコン変更 / 負担割合
- [ ] ペアリング: 招待コード共有 → 2端末目で参加 → 立替が見える

### 画面状態・表示
- [ ] 各画面の4状態（Loading / Empty / Error / Success）
- [ ] ダークモードで表示崩れがない
- [ ] iPhone SE（小画面）で崩れない
- [ ] iPad でレイアウトが広がる（中央寄せ/2カラム）
- [ ] バナー広告枠がコンテンツと重ならない

### アクセシビリティ
- [ ] VoiceOverで支出入力→精算が操作できる
- [ ] 文字サイズ最大でレイアウトが崩れない
- [ ] タップ領域44pt以上
- [ ] 損益が色だけでなく記号（＋/−）でも分かる

### データ整合性
- [ ] 2端末で同じ支出を編集 → 競合が検知される（後勝ちで上書きしない）
- [ ] 保存ボタン連打で二重登録されない
- [ ] 相手のペア外データにアクセスできない（RLS）

## 5. リリース前チェックリスト

### 機能面
- [ ] 全MVP機能が動作 / クラッシュする操作がない
- [ ] アカウント削除が実際に動く（Edge Function デプロイ済。**捨てアカウント**で実削除を確認 → §7-2）

### ストア提出面
- [x] アプリアイコン（1024×1024）設定（アイコン・スプラッシュ作成済み・app.json 設定済み）
- [ ] スクリーンショット（6.9インチiPhone必須 / iPad）
- [x] プライバシーポリシーURL 公開（**2026-07-09 200確認済み**。提出時に App Store Connect へ URL 設定）
- [x] プライバシーマニフェスト（app.json）
- [~] ATT/UMP同意（クライアント実装済み。AdMob 管理画面での GDPR フォーム＋ATTメッセージ構成が残）
- [x] ログアウト・アカウント削除の導線（delete-account デプロイ済）

### パフォーマンス
- [ ] 起動時間が許容範囲
- [ ] 履歴の大量データでスクロールがカクつかない（FlatList仮想化済み）
- [ ] 画面往復でメモリが増え続けない

## 6. 既知の制限事項（MVP）
- 共同口座残高は当月スコープ → **2026-07-08 に全期間Σへ修正済み**（`listSharedExpenses`。§7-2 で残高整合を確認）。
- **レシートOCR**は端末内OCR（ML Kit）で実装済み。**dev build でのみ実動作**（Expo Go はサンプル表示）。
- **プッシュ通知**は Edge Function デプロイ・Webhook 設定済み。実機 dev build での受信確認が残（§7-2 で配線確認可）。
- **AdMob** はバナー＋インタースティシャル実装済み（iOS 本番ID設定済み・Android はテストID）。**Sentry** は枠のみ。
- 為替レートは最新1件方式（支出日時点の履歴なし）。入力UIは精算画面に実装済み（2026-07-09）。
- 二重レシート登録防止は未実装（将来課題）。

## 7. DB / migration 検証（総合テスト時に SQL Editor で実行）

適用済み前提: **0001〜0005・0007〜0012**（0006 は任意。0011・0012 は 2026-07-09 適用済み）+ **0013（notify_partner の public 剥奪）= 要適用**。Supabase ダッシュボードの SQL Editor で以下を実行し、期待結果と一致することを確認する。

### 7-1. オブジェクトの存在確認（適用の棚卸し）

- [ ] **テーブル**（0001・0010）
  ```sql
  select table_name from information_schema.tables
  where table_schema = 'public' order by 1;
  ```
  期待: `budget_alerts / budgets / categories / exchange_rates / expenses / fixed_costs / notification_settings / notifications / pair_requests / pairs / profiles / settlements / shared_account` の13件（`pair_requests` がなければ 0010 未適用、`budget_alerts` がなければ 0011 未適用）

- [ ] **RLS が全テーブルで有効**（0002）
  ```sql
  select relname, relrowsecurity from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
  ```
  期待: 全行 `relrowsecurity = true`

- [ ] **関数（RPC・トリガー関数）**（0002/0004/0005/0009/0010）
  ```sql
  select proname from pg_proc
  where pronamespace = 'public'::regnamespace order by 1;
  ```
  期待に含まれる: `calculate_settlement_balance / cancel_pair_request / check_budget_alerts / execute_settlement / get_my_pair_id / handle_new_user / leave_pair / list_incoming_pair_requests / notify_partner / notify_user / on_expense_change / on_settlement_insert / post_fixed_expenses / request_pair / respond_pair_request / send_settlement_reminders / send_variable_reminders / touch_updated_at / update_split_ratio`（`check_budget_alerts` / `send_settlement_reminders` がなければ 0011 未適用）
  期待に**含まれない**: `join_pair`（0010 で drop 済み。残っていれば 0010 未適用）

- [ ] **Storage バケット**（0003・0007）
  ```sql
  select id, public from storage.buckets order by 1;
  ```
  期待: `avatars`(public) / `category-icons`(public) / `receipts`(非public) の3件（`category-icons` がなければ 0007 未適用）

- [ ] **pg_cron ジョブ**（0005）
  ```sql
  select jobname, schedule, active from cron.job order by jobname;
  ```
  期待: `webudget_post_fixed_expenses`（`0 15 * * *`）・`webudget_variable_reminders`（`15 15 * * *`）・`webudget_settlement_reminders`（`0 11 * * *`＝JST 20:00、0011）の3本が **active = true**

- [ ] **0008 の CHECK 制約**（アカウント削除後の匿名化を許容）
  ```sql
  select pg_get_constraintdef(oid) from pg_constraint
  where conname = 'payer_xor_shared';
  ```
  期待: 個人払い側の条件が `(is_shared_payment = false)` のみ（`payer_user_id IS NOT NULL` の必須条件が残っていれば 0008 未適用）

- [ ] **内部関数の EXECUTE 権限**（0012。anon/authenticated から実行できないこと）
  ```sql
  select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_ok,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_ok
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('notify_user','notify_partner','post_fixed_expenses',
                      'send_variable_reminders','send_settlement_reminders','check_budget_alerts');
  ```
  期待: 6行すべて `anon_ok = false` かつ `auth_ok = false`（true が残っていれば 0012 未適用。REST で `POST /rest/v1/rpc/notify_user` が 42501 permission denied になることでも確認可）

- [ ] **notifications.type の CHECK**（0009/0010 で追加した種別）
  ```sql
  select pg_get_constraintdef(oid) from pg_constraint
  where conrelid = 'notifications'::regclass and contype = 'c';
  ```
  期待: `settlement` / `pair_request` / `pair_approved` / `pair_declined` を含む

### 7-2. 動作スモーク（SQL 起点）

- [ ] **固定費の自動計上（0005）**: `select post_fixed_expenses();` がエラーなく完了 → `billing_day` を当日(JST)にした type=fixed の固定費が expenses に生成される。**もう一度実行しても重複生成されない**（冪等）。自動計上分の「パートナーが記録」通知が出ないこと
- [ ] **変動費リマインド（0005）**: `select send_variable_reminders();` がエラーなく完了 → `reminder_day` 当日・当月未入力の変動費についてペア両者に `reminder_variable` 通知
- [ ] **プッシュ配線**: `notifications` に1行 INSERT → Edge Function `send-push-notification` の Logs に処理ログが出る（トークン未登録なら `skipped: no token` でOK＝Webhook→関数の配線は正常）
- [ ] **精算通知（0009）**: アプリから精算を1回実行 → 両者に `settlement` 通知が届く・`expense_edited` 通知が連発**しない**・精算後の立替残高が0
- [ ] **予算アラート（0011）**: 予算を設定し 80% を跨ぐ支出を追加 → 両者に `budget_warning` 通知が**1回だけ**届く（同月内でさらに支出を足しても再送されない）→ 100% を跨ぐ → `budget_exceeded` が1回。budget_alerts に行が記録される（`select * from budget_alerts;`）。80%と100%を一気に跨いだ場合は超過通知のみ
- [ ] **月末精算リマインド（0011）**: `select send_settlement_reminders();` を月末日以外に実行すると **0** が返る（何も送られない）。動作確認は未精算残高がある状態で月末日に実行（またはテスト時のみ関数内の日付判定を確認）→ 両者に `settlement_reminder` 通知・金額入り
- [ ] **為替レート入力（R-3）**: 外貨（例: USD）の立替支出を作る → 精算画面に「精算に含まれていません」警告とレート設定カードが出る → レートを入力して保存 → 残高が外貨込みで再計算される・警告が消える
- [ ] **アカウント削除（0008）**: **捨てアカウント**に個人払い支出を作成 → 設定→アカウント削除が成功しログアウトされる（0008 未適用だと制約違反で500）→ 該当支出の `payer_user_id` が NULL（匿名化）で行自体は残る ※本番アカウントでは絶対にやらない
- [ ] **カテゴリ写真（0007）**: カテゴリ管理で写真を設定 → `category-icons` バケットに `{pair_id}/` 配下でオブジェクトが作成され、他画面でも表示される

### 7-3. RLS / ペア分離（2アカウント・test_plan §4 と併走）

- [ ] ペア外ユーザーの支出・通知・レシート画像（署名URL）にアクセスできない
- [ ] `pair_requests` は当事者のみ SELECT できる（第三者アカウントには見えない）
- [ ] 承認制ペアリングのE2E: 申請 → 招待側に `pair_request` 通知 → 承認 → 成立・申請者に `pair_approved` 通知（0010）
