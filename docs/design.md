# 設計書（WeBudget）

> アプリ名: WeBudget / Bundle ID: com.mobileappworks.webudget / scheme: webudget://

## 1. 画面一覧

| No | 画面名 | 画面ID | 役割 | 主な表示要素 |
|----|--------|--------|------|-------------|
| 0 | スプラッシュ | `splash` | 起動時にセッション確認して分岐 | ロゴ、ローディング |
| 1 | ログイン | `login` | メール/Apple/Googleでログイン | ログインフォーム、ソーシャルボタン、「パスワードを忘れた方」 |
| 2 | サインアップ | `signup` | 新規ユーザー登録 | 登録フォーム、ソーシャルボタン |
| 2b | メール確認待ち | `verify-email` | 確認メール送信後の案内 | 説明、再送ボタン |
| 2c | パスワードリセット | `reset-password` | リセットメール送信 / 新パスワード設定 | メール入力 / 新パスワード入力 |
| 3 | AI利用同意 | `ai-consent` | 初回のみ。OCR等のAI利用に同意取得 | 説明テキスト、同意ボタン |
| 3b | トラッキング許可(ATT/UMP) | `att-consent` | 広告のためのATT/UMP同意（iOS必須） | ATTプロンプト、UMP同意フォーム |
| 4 | ペアリング | `pairing` | 招待コード生成/入力でパートナー紐づけ | 招待コード表示、入力フォーム |
| 5 | ホーム | `home` | 今月のサマリー表示 | ヘッダー通知ベル🔔、支出合計、立替残高カード（タップで精算画面）、予算進捗バー（タップで予算設定）、直近の支出 |
| 6 | 支出入力 | `expense-input` | レシート撮影 or 手動で支出記録（モーダル） | 入力方法選択（「レシートで入力」/「手動で入力」）、カメラ、OCR結果プレビュー、入力フォーム |
| 7 | 支出一覧 | `expense-list` | 支出履歴の閲覧 | 日付順リスト、カテゴリフィルタ |
| 8 | 支出詳細 | `expense-detail` | 個別支出の詳細表示・編集・削除 | 金額、カテゴリ、支払い者、レシート画像、編集/削除ボタン |
| 9 | 立替精算 | `settlement` | 精算額確認・精算実行・精算履歴 | 立替残高、精算ボタン、精算履歴リスト |
| 10 | 共同口座 | `shared-account` | 共同口座の入金・残高管理 | 残高、入金リスト＋共同支出（is_shared_payment）の明細、入金ボタン |
| 11 | 固定費管理 | `fixed-costs` | 固定費・変動固定費の設定・一覧 | 固定費リスト、追加ボタン、リマインド状態 |
| 12 | 予算設定 | `budget` | カテゴリ別/全体の月間予算設定 | カテゴリ別予算バー、設定フォーム |
| 13 | レポート | `report` | グラフで支出を見える化 | 円グラフ、棒グラフ、期間切替（月/週/カスタム） |
| 14 | 通知一覧 | `notifications` | 各種通知の閲覧 | 通知リスト（リマインド、パートナー通知、予算アラート等） |
| 15 | カテゴリ管理 | `categories` | カスタムカテゴリの追加・編集・削除 | カテゴリリスト、追加ボタン、並び替え |
| 16 | プロフィール | `profile` | 自分の情報管理 | 名前、アイコン画像変更、メールアドレス、パスワード変更、パートナー情報、ペア解除 |
| 17 | 設定 | `settings` | アプリ設定 | 言語切替、ダークモード、通知ON/OFF、プライバシーポリシー、バージョン、ログアウト、アカウント削除 |

## 2. 画面遷移図

### ナビゲーション方式
- **メイン**: Expo Router タブナビゲーション（5タブ）
- **認証フロー**: スタックナビゲーション（ログイン前のみ）
- **モーダル**: 支出入力、精算確認ダイアログ、削除確認ダイアログ

### タブ構成

```
[🏠 ホーム] [📋 履歴] [➕ 入力] [📊 レポート] [⚙️ 設定]
```

### 画面遷移図

```
── 起動 ──────────────────────────────────────
  スプラッシュ → セッション有効? ─ はい → メインフロー
                          └─ いいえ → 認証フロー

── 認証フロー（スタック）────────────────────────
  ログイン ←→ サインアップ → メール確認待ち
    │              ↓ (確認・認証成功・初回)
    ├→ パスワード   AI利用同意（初回のみ）
    │  リセット         ↓
    │              ATT/UMP同意（iOS初回・広告のため）
    │                  ↓
    │              ※ペアリングはスキップ可（サインアップ時に
    │                ソロpairが自動生成済み。設定からいつでも招待）
    ↓                  ↓
── メインフロー（タブ）──────────────────────────

[🏠 ホーム]  ※ヘッダーに通知ベル🔔（未読バッジ付き）
  ※ソロモードでは立替残高カードを非表示（代わりに「招待」CTA）
  ├→ 通知一覧（ベルアイコンから遷移）
  ├→ 支出詳細（直近の支出リストから遷移）
  ├→ 立替精算（立替残高カードから遷移）
  └→ 予算設定（予算進捗バーから遷移）

[📋 履歴]
  ├→ 支出詳細
  └→ カテゴリフィルタ

[➕ 入力]（モーダル）
  ├→ 入力方法選択（「レシートで入力」/「手動で入力」）
  ├→ レシート撮影 → OCR結果プレビュー → 確認・修正 → 保存
  └→ 手動入力フォーム → 保存

[📊 レポート]
  └→ 期間選択（月/週/カスタム）

[⚙️ 設定]
  ├→ プロフィール
  │    ├→ アイコン変更
  │    ├→ パスワード変更
  │    └→ ペア解除
  ├→ ペアリング（未ペアリングの場合。ソロ→ペアへの切替）
  ├→ カテゴリ管理
  ├→ 固定費管理
  ├→ 共同口座管理
  ├→ 通知設定
  └→ アカウント削除（確認ダイアログ）
```

### ソロモード（ペアリング前）
- ペアリングをスキップした場合、以下の機能は制限される:
  - 立替精算（パートナーがいないため非表示）
  - 共同口座（非表示）
  - パートナー通知（非表示）
  - 負担割合設定（非表示）
- 支出記録・予算・レポート・固定費は1人でも利用可能
- 設定画面に「パートナーを招待」ボタンを常時表示し、いつでもペアリング可能

### モーダル使用箇所
| 画面 | トリガー | 内容 |
|------|---------|------|
| 支出入力 | タブ中央の「＋」ボタン | フルスクリーンモーダル |
| 精算確認 | 精算画面の「精算する」ボタン | 確認ダイアログ（金額表示＋確定/キャンセル） |
| 削除確認 | 支出詳細の「削除」ボタン | 確認ダイアログ（破壊的操作） |
| アカウント削除確認 | 設定画面の「アカウント削除」 | 確認ダイアログ（テキスト入力で確認） |
| ペア解除確認 | プロフィールの「ペア解除」 | 確認ダイアログ（未精算チェック付き） |

## 3. データモデル

### テーブル: profiles（ユーザープロフィール）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | ユーザーID | PK, FK → auth.users ON DELETE CASCADE |
| display_name | text | 表示名 | NOT NULL, default: 'ユーザー'（Apple名前非公開時のフォールバック） |
| avatar_url | text | アイコン画像URL | NULL許容 |
| pair_id | uuid | ペアID | FK → pairs, NOT NULL（サインアップ時に自動生成） |
| expo_push_token | text | プッシュ通知トークン | NULL許容 |
| language | text | 言語設定 | NOT NULL, default: 'auto' |
| theme | text | テーマ設定 | NOT NULL, default: 'system', CHECK: 'light','dark','system' |
| ai_consent | boolean | AI利用同意済みか | NOT NULL, default: false |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**運用**: サインアップ時に DBトリガー `handle_new_user`（SECURITY DEFINER）で「profiles 行作成 + ソロ pair 作成 + デフォルトカテゴリの複製」を原子的に実行する。これにより全ユーザーが必ず pair_id を持ち、`expenses.pair_id NOT NULL` と矛盾しない。

### テーブル: pairs（カップルペア）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | ペアID | PK, default: gen_random_uuid() |
| invite_code | text | 招待コード | UNIQUE, NOT NULL |
| user1_id | uuid | ユーザー1（pair作成者） | FK → auth.users ON DELETE SET NULL, NULL許容 |
| user2_id | uuid | ユーザー2（参加者） | FK → auth.users ON DELETE SET NULL, NULL許容 |
| split_ratio_user1 | integer | ユーザー1の負担割合（%） | NOT NULL, default: 50, CHECK: 1-99 |
| split_ratio_user2 | integer | ユーザー2の負担割合（%） | NOT NULL, default: 50, CHECK: 1-99 |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**制約**: `CHECK(split_ratio_user1 + split_ratio_user2 = 100)` — 合計が常に100%
**運用**: サインアップ時に本人のみの pair を自動生成（user1_id=本人, user2_id=NULL）= ソロモード。ペアリングは既存 pair への参加（user2_id を埋める）。user1_id/user2_id を NULL 許容にしているのは、退会時に匿名化（SET NULL）して共有データを残すため。

### テーブル: categories（カテゴリ）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | カテゴリID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| name | text | カテゴリ名（カスタムカテゴリ用） | NULL許容 |
| name_key | text | 翻訳キー（デフォルトカテゴリ用。例: 'category.food'） | NULL許容 |
| icon | text | アイコン名 | NOT NULL |
| color | text | カラーコード | NOT NULL |
| is_default | boolean | デフォルト由来か（削除不可・名前は翻訳キー） | NOT NULL, default: false |
| is_hidden | boolean | 非表示にしたか | NOT NULL, default: false |
| sort_order | integer | 並び順 | NOT NULL, default: 0 |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**運用**: デフォルトカテゴリ（食費/日用品/交通費/娯楽/光熱費/家賃/通信費/医療/その他）は **pair 作成時に各ペアへ複製**（`is_default=true`, `name_key` 設定）。これによりペアごとに並び替え・非表示・カスタム追加が独立する。`is_default=true` の行は削除不可（`is_hidden` で非表示のみ可）。
**制約**: `CHECK(name IS NOT NULL OR name_key IS NOT NULL)` — 名前か翻訳キーのどちらかは必須

### テーブル: expenses（支出）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 支出ID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| recorded_by | uuid | 記録者 | FK → auth.users ON DELETE SET NULL, NULL許容 |
| category_id | uuid | カテゴリ | FK → categories ON DELETE RESTRICT, NOT NULL |
| amount | numeric(12,2) | 金額 | NOT NULL, CHECK: > 0 |
| currency | text | 通貨コード | NOT NULL, default: 'JPY' |
| payer_user_id | uuid | 支払いユーザーID（個人負担の場合） | FK → auth.users ON DELETE SET NULL, NULL許容 |
| is_shared_payment | boolean | 共同口座からの支払いか | NOT NULL, default: false |
| settlement_id | uuid | 精算済みスタンプ（NULL=未精算） | FK → settlements ON DELETE SET NULL, NULL許容 |
| expense_date | date | 支出日 | NOT NULL |
| description | text | メモ・説明 | NULL許容 |
| store_name | text | 店名 | NULL許容 |
| receipt_image_url | text | レシート画像URL | NULL許容 |
| is_fixed_cost | boolean | 固定費から自動生成されたか | NOT NULL, default: false |
| fixed_cost_id | uuid | 元の固定費ID | FK → fixed_costs ON DELETE SET NULL, NULL許容 |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**制約**:
- `CHECK((is_shared_payment = true AND payer_user_id IS NULL) OR (is_shared_payment = false AND payer_user_id IS NOT NULL))` — 共同口座払いと個人払いの排他を保証
- `UNIQUE(fixed_cost_id, (date_trunc('month', expense_date)))`（部分インデックス, `fixed_cost_id IS NOT NULL` のみ）— 固定費の同月二重計上を防止（冪等性）
- 精算は `settlement_id IS NULL`（未精算）のみを対象に集計。精算実行時に対象 expenses へ settlement_id をスタンプ → 過去日付の後追い入力も取りこぼさない

### テーブル: fixed_costs（固定費・変動固定費）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 固定費ID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| category_id | uuid | カテゴリ | FK → categories ON DELETE RESTRICT, NOT NULL |
| name | text | 名称（家賃、電気代等） | NOT NULL |
| type | text | 種別 | NOT NULL, CHECK: 'fixed','variable' |
| amount | numeric(12,2) | 金額（fixedの場合の固定額） | NULL許容, CHECK: > 0 |
| currency | text | 通貨コード | NOT NULL, default: 'JPY' |
| payer_user_id | uuid | 支払いユーザーID（個人負担の場合） | FK → auth.users ON DELETE SET NULL, NULL許容 |
| is_shared_payment | boolean | 共同口座からの支払いか | NOT NULL, default: false |
| billing_day | integer | 計上日（毎月X日） | NOT NULL, CHECK: 1-31 |
| reminder_day | integer | リマインド日（変動固定費の入力期限） | NULL許容, CHECK: 1-31 |
| is_active | boolean | 有効か | NOT NULL, default: true |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**制約**: `CHECK(type = 'fixed' AND amount IS NOT NULL OR type = 'variable')` — 固定費は金額必須、変動固定費は任意
**変動固定費の未入力判定**: 当月に `expenses WHERE fixed_cost_id = X AND date_trunc('month', expense_date) = 当月` が無ければ未入力 →`reminder_day` にリマインド送信

### テーブル: settlements（精算）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 精算ID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| settled_by | uuid | 精算実行者 | FK → auth.users ON DELETE SET NULL, NULL許容 |
| amount | numeric(12,2) | 精算金額 | NOT NULL |
| currency | text | 通貨コード | NOT NULL, default: 'JPY' |
| from_user_id | uuid | 支払う側 | FK → auth.users ON DELETE SET NULL, NULL許容 |
| to_user_id | uuid | 受け取る側 | FK → auth.users ON DELETE SET NULL, NULL許容 |
| settled_at | timestamptz | 精算日時 | NOT NULL, default: now() |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |

### テーブル: shared_account（共同口座）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | レコードID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| type | text | 種別 | NOT NULL, CHECK: 'deposit','withdrawal' |
| user_id | uuid | 入金者/記録者 | FK → auth.users ON DELETE SET NULL, NULL許容 |
| amount | numeric(12,2) | 金額 | NOT NULL, CHECK: > 0 |
| currency | text | 通貨コード | NOT NULL, default: 'JPY' |
| description | text | 説明 | NULL許容 |
| transaction_date | date | 取引日 | NOT NULL |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |
| deleted_at | timestamptz | 論理削除日時 | NULL許容 |

**役割**: このテーブルは **入金（deposit）と、支出計上しない現金移動（withdrawal: ATM引き出し等）専用**。共同口座での**買い物は expenses（is_shared_payment=true）に一本化**して記録する（レポート・予算にも反映され、二重入力を避ける）。
**共同口座残高の計算**:
```
残高 = Σ(deposit) − Σ(withdrawal) − Σ(expenses WHERE is_shared_payment=true AND deleted_at IS NULL)
       （いずれも exchange_rates でJPY換算）
```

### テーブル: budgets（予算）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 予算ID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| category_id | uuid | カテゴリ（NULLなら全体予算） | FK → categories ON DELETE CASCADE, NULL許容 |
| amount | numeric(12,2) | 月間予算額 | NOT NULL, CHECK: > 0 |
| currency | text | 通貨コード | NOT NULL, default: 'JPY' |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |

**制約**: `UNIQUE(pair_id, category_id)` — 同じペア・同じカテゴリに予算は1つだけ（全体予算は category_id IS NULL の部分一意インデックスで1件に制限）
**多通貨**: 予算進捗の集計時、支出の通貨を exchange_rates で予算通貨（既定JPY）に換算してから合計する

### テーブル: exchange_rates（為替レート）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | レートID | PK, default: gen_random_uuid() |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| from_currency | text | 元通貨 | NOT NULL |
| to_currency | text | 先通貨 | NOT NULL, default: 'JPY' |
| rate | numeric(12,6) | レート（1元通貨 = X先通貨） | NOT NULL, CHECK: > 0 |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |
| updated_at | timestamptz | 更新日時 | NOT NULL, default: now() |

**制約**: `UNIQUE(pair_id, from_currency, to_currency)` — 同じ通貨ペアにつき1レコード（upsertで更新）
**注意**: MVPではレートは「最新の1件」を使う簡易方式（支出日時点のレート履歴は持たない）。外貨支出時にレート未設定なら入力を促す。

### テーブル: notifications（通知）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 通知ID | PK, default: gen_random_uuid() |
| user_id | uuid | 通知先ユーザー | FK → auth.users ON DELETE CASCADE, NOT NULL |
| pair_id | uuid | ペアID | FK → pairs ON DELETE CASCADE, NOT NULL |
| type | text | 通知種別 | NOT NULL, CHECK: 'expense_added','expense_edited','expense_deleted','settlement','reminder_variable','budget_warning','budget_exceeded','settlement_reminder' |
| title | text | 通知タイトル | NOT NULL |
| body | text | 通知本文 | NOT NULL |
| data | jsonb | 追加データ（遷移先等） | NULL許容 |
| is_read | boolean | 既読フラグ | NOT NULL, default: false |
| created_at | timestamptz | 作成日時 | NOT NULL, default: now() |

### テーブル: notification_settings（通知設定）
| カラム名 | 型 | 説明 | 制約 |
|---------|-----|------|------|
| id | uuid | 設定ID | PK, default: gen_random_uuid() |
| user_id | uuid | ユーザーID | FK → auth.users ON DELETE CASCADE, NOT NULL |
| expense_added | boolean | 支出追加通知 | NOT NULL, default: true |
| expense_edited | boolean | 支出編集通知 | NOT NULL, default: true |
| expense_deleted | boolean | 支出削除通知 | NOT NULL, default: true |
| settlement | boolean | 精算通知 | NOT NULL, default: true |
| reminder_variable | boolean | 変動固定費リマインド | NOT NULL, default: true |
| budget_alert | boolean | 予算アラート | NOT NULL, default: true |
| settlement_reminder | boolean | 月末精算リマインド | NOT NULL, default: true |

**制約**: UNIQUE(user_id) — 1ユーザー1レコード

### リレーション
```
auth.users 1:1 profiles
profiles N:1 pairs
pairs 1:N expenses
pairs 1:N fixed_costs
pairs 1:N settlements
pairs 1:N shared_account
pairs 1:N budgets
pairs 1:N categories (デフォルト複製 + カスタム)
expenses N:1 categories
fixed_costs N:1 categories
fixed_costs 1:N expenses (自動生成分)
pairs 1:N exchange_rates
auth.users 1:N notifications
auth.users 1:1 notification_settings
```

### RLS（Row Level Security）方針
| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| profiles | 自分 + 同じペアのパートナー | 自分のみ | 自分のみ | 自分のみ |
| pairs | 自分が属するペア | 認証ユーザー | 自分が属するペア | 自分が属するペア |
| categories | 自分のペアのみ（デフォルトも複製済み） | 自分のペアのみ | 自分のペアのみ | 自分のペアのみ（is_default=trueは削除不可、is_hiddenのみ） |
| expenses | 自分のペアのデータ **または recorded_by=自分**（解除済みpairの自分の記録も閲覧可。要件7-10） | 自分のペアのみ | 自分のペア かつ deleted_at IS NULL（解除済みpairは読み取り専用） | 自分のペアのデータ |
| fixed_costs | 自分のペアのデータ | 自分のペアのみ | 自分のペアのデータ | 自分のペアのデータ |
| settlements | 自分のペアのデータ | 自分のペアのみ | — | — |
| shared_account | 自分のペアのデータ | 自分のペアのみ | 自分のペアのデータ | 自分のペアのデータ |
| budgets | 自分のペアのデータ | 自分のペアのみ | 自分のペアのデータ | 自分のペアのデータ |
| exchange_rates | 自分のペアのデータ | 自分のペアのみ | 自分のペアのデータ | 自分のペアのデータ |
| notifications | 自分宛のみ | サーバーのみ（service_role/SECURITY DEFINER。クライアント直INSERT不可） | 自分宛のみ（既読更新） | — |
| notification_settings | 自分のみ | 自分のみ | 自分のみ | — |

> **RLS実装の注意（再帰回避）**: 「同じペアのパートナー」「自分のペアのデータ」を判定するポリシーが `profiles`/`pairs` を直接サブクエリすると**無限再帰**を起こす。`get_my_pair_id()` のような **SECURITY DEFINER ヘルパー関数**で自分の pair_id を取得し、各ポリシーは `pair_id = get_my_pair_id()` で判定する。

### データ整合性（制約・並行性）

| 項目 | 方針 |
|------|------|
| NOT NULL | 必須カラムに付与 |
| 外部キー | 全リレーションに付与（参照整合性） |
| UNIQUE | invite_code, (pair_id, category_id) on budgets, user_id on notification_settings, (pair_id, from_currency, to_currency) on exchange_rates, (fixed_cost_id, 月) on expenses(部分) |
| CHECK | amount > 0, split_ratio 1-99, split合計=100, billing_day 1-31, rate > 0, expenses の payer排他, categories の name/name_key 必須 |
| インデックス | (pair_id, expense_date) on expenses, (pair_id, settlement_id) on expenses, pair_id on fixed_costs, user_id on notifications, category_id |
| 楽観的ロック | expenses, fixed_costs, shared_account は updated_at で衝突検知 |
| トランザクション | 精算実行（settlement作成 + 関連更新）はPostgres関数（RPC）で原子的に実行 |
| 冪等性 | 固定費の月次自動計上は `UNIQUE(fixed_cost_id, date_trunc('month', expense_date))` 部分インデックス + upsert |
| 削除方針 | 論理削除（deleted_at）。全テーブルのSELECTで `deleted_at IS NULL` を条件に含める |
| ON DELETE | pair配下データは CASCADE / ユーザー参照（recorded_by等）は SET NULL で匿名化 / category参照は RESTRICT（使用中カテゴリは削除不可、is_hiddenで非表示） |

### アカウント退会時のデータ方針
- **共有データ（expenses / settlements / shared_account 等）は pair の資産として保持**する
- 退会ユーザーへの参照（recorded_by, payer_user_id, user1/2_id 等）は `ON DELETE SET NULL` で匿名化 → UI では NULL を「退会したユーザー」と表示
- `profiles` は `auth.users` の CASCADE で削除されるが、pair と共有データは残るため、残ったパートナーは履歴を引き続き閲覧できる
- 退会者の未精算残高は凍結（新たな精算は発生しない）

### ペア解除時のデータ方針（要件7-10）
- 解除時に元 pair へ `deleted_at` を立てて**解散扱い（読み取り専用）**にする。データは物理削除しない
- 各ユーザーには新しいソロ pair を発行し、profiles.pair_id を更新（新規記録はソロpairへ）
- 解除後も `recorded_by = 自分` の支出は閲覧可能（expenses RLS の追加条件）→「自分が記録した分は見られる」を満たす
- 解除前に未精算残高があれば確認ダイアログで精算を促す（ペア解除確認モーダル）

### 立替残高の計算ロジック（RPC: calculate_settlement_balance）

```sql
-- 精算残高を計算するPostgres関数
-- 未精算（settlement_id IS NULL）の支出から各ユーザーの立替額を算出

-- 1. 未精算かつ個人払いの支出を取得:
--    WHERE pair_id = $1 AND settlement_id IS NULL
--      AND is_shared_payment = false AND deleted_at IS NULL
--    （共同口座支払いは対象外。時刻cutoffは使わず settlement_id で判定するため
--     過去日付の後追い入力も取りこぼさない）
-- 2. 外貨の支出は exchange_rates のレートでJPYに換算（レート未設定なら警告）
-- 3. 各ユーザーの支払い合計:
--    user1_paid = SUM(amount_jpy) WHERE payer_user_id = user1_id
--    user2_paid = SUM(amount_jpy) WHERE payer_user_id = user2_id
-- 4. 本来の負担額:
--    total = user1_paid + user2_paid
--    user1_should_pay = total * split_ratio_user1 / 100
-- 5. 精算額:
--    user1_balance = user1_paid - user1_should_pay
--    settlement_amount = ABS(user1_balance)
--    from_user = user1_balance < 0 ? user1 : user2  -- 払う側
--    to_user   = user1_balance < 0 ? user2 : user1  -- 受け取る側
```

**返り値**: `{ settlement_amount, from_user_id, to_user_id, currency: 'JPY', unconverted_currencies: [] }`
（`unconverted_currencies` にレート未設定の通貨を返し、UIで設定を促す）

### 精算実行のロジック（RPC: execute_settlement）
```sql
-- トランザクション内で原子的に実行:
-- 1. calculate_settlement_balance で金額を再計算（クライアントの値を信用しない）
-- 2. settlements に1件INSERT（amount, from_user_id, to_user_id）
-- 3. 対象の expenses（settlement_id IS NULL の個人払い）に
--    今作った settlement.id をUPDATEでスタンプ
-- → 以降その支出は集計対象外になり「残高リセット」が実現する
```

## 4. API設計（Supabase）

### クライアント操作一覧
| 操作 | テーブル | メソッド | フィルタ | 認証 |
|------|---------|---------|---------|------|
| 支出一覧取得 | expenses | `select('*, categories(*)')` | `.eq('pair_id', pairId).is('deleted_at', null).order('expense_date', { ascending: false })` | 必要 |
| 支出作成 | expenses | `insert({...})` | — | 必要 |
| 支出更新 | expenses | `update({...})` | `.eq('id', id).eq('updated_at', prevUpdatedAt)` | 必要 |
| 支出論理削除 | expenses | `update({ deleted_at: now() })` | `.eq('id', id)` | 必要 |
| 固定費一覧 | fixed_costs | `select('*, categories(*)')` | `.eq('pair_id', pairId).is('deleted_at', null)` | 必要 |
| ペア参加 | — | `rpc('join_pair', { invite_code })` | — | 必要 |
| ペア解除 | — | `rpc('leave_pair', { pair_id })` | — | 必要 |
| 精算実行 | — | `rpc('execute_settlement', { pair_id })` | — | 必要 |
| 精算履歴 | settlements | `select('*')` | `.eq('pair_id', pairId).order('settled_at', { ascending: false })` | 必要 |
| 共同口座一覧 | shared_account | `select('*')` | `.eq('pair_id', pairId).is('deleted_at', null)` | 必要 |
| 予算取得 | budgets | `select('*, categories(*)')` | `.eq('pair_id', pairId)` | 必要 |
| 予算設定 | budgets | `upsert({...})` | — | 必要 |
| 通知一覧 | notifications | `select('*')` | `.eq('user_id', userId).order('created_at', { ascending: false })` | 必要 |
| 通知既読 | notifications | `update({ is_read: true })` | `.eq('id', id)` | 必要 |
| カテゴリ一覧 | categories | `select('*')` | `.eq('pair_id', pairId).is('deleted_at', null).eq('is_hidden', false).order('sort_order')` | 必要 |
| 為替レート取得 | exchange_rates | `select('*')` | `.eq('pair_id', pairId)` | 必要 |
| 為替レート設定 | exchange_rates | `upsert({...})` | — | 必要 |
| 立替残高計算 | — | `rpc('calculate_settlement_balance', { pair_id })` | — | 必要 |
| プロフィール更新 | profiles | `update({...})` | `.eq('id', userId)` | 必要 |

### Supabase Auth
- 認証方式: メール + Apple Sign-In + Google Sign-In
- セッション管理: Supabase Auth のデフォルト（JWTベース）。`AsyncStorage` に永続化
- **セッション復元**: 起動時にスプラッシュ画面でセッション確認 → 有効ならホーム、無効ならログインへ分岐
- **メール確認**: メール登録は確認メール必須（Supabaseデフォルト）。サインアップ後は「確認メール送信済み」画面を表示し、確認完了後にログイン可能
- **パスワードリセット（ログイン前）**: ログイン画面に「パスワードを忘れた方」→ リセットメール送信 → ディープリンクでリセット画面へ
- **Apple Sign-In のフォールバック**: 名前非公開時は `display_name` を 'ユーザー' で初期化（後からプロフィールで変更可）。メール非公開（privaterelay）も許容
- アカウント削除: Edge Function `delete-account` で `auth.users` を削除（profilesはCASCADE削除、共有データはSET NULLで匿名化して残す）

### Supabase Storage
| バケット名 | 用途 | アクセス制御 |
|-----------|------|------------|
| receipts | レシート画像 | private（ペアのユーザーのみ読み取り可） |
| avatars | プロフィールアイコン | public（URLで誰でも閲覧可） |

### 外部API
| API | 用途 | 呼び出し方 |
|-----|------|-----------|
| Google Cloud Vision API | レシートOCR | Supabase Edge Function経由（APIキーをサーバー側で管理） |

### Supabase Edge Functions
| 関数名 | 用途 |
|--------|------|
| `ocr-receipt` | レシート画像をCloud Vision APIに送信し、金額・店名・日付を返す |
| `auto-generate-fixed-expenses` | 月次の固定費自動計上（pg_cron）。同月二重計上は部分一意制約で防止 |
| `check-variable-reminders` | 変動固定費の未入力チェック → リマインド送信（pg_cron, 日次） |
| `send-push-notification` | Expo Push Notification APIを呼び出し（profiles.expo_push_token宛） |
| `delete-account` | auth.users削除（共有データはSET NULLで匿名化保持） |

### Postgres RPC（SECURITY DEFINER）
| 関数名 | 用途 |
|--------|------|
| `handle_new_user` | サインアップ時トリガー: profiles作成 + ソロpair作成 + デフォルトカテゴリ複製 |
| `join_pair(invite_code)` | 招待コードで既存pairに参加（user2_id埋め）。**RLSを跨ぐためSECURITY DEFINER必須**（参加者はまだpair所属でないためUPDATEポリシーで弾かれる問題を回避）。参加時に両者の支出データをどう統合するかは下記参照 |
| `calculate_settlement_balance(pair_id)` | 立替残高の計算 |
| `execute_settlement(pair_id)` | 精算実行（settlement作成 + expensesスタンプ） |
| `leave_pair(pair_id)` | ペア解除（未精算チェック付き）。**元pairは解散せず deleted_at を立てて残す**（履歴保持のため）。各自に**新しいソロpairを発行**して新規記録はそちらへ。解除後も `recorded_by = 自分` の支出は閲覧可能（下記RLS） |

### ペアリング時のデータ統合方針
- サインアップで全員がソロpairを持つため、ペアリングは「2つのソロpairをどう扱うか」が論点
- **MVP方針**: 招待した側（user1）のpairに参加する側（user2）が合流する。**参加者(user2)のソロ時代の支出は本人のソロpairに残し、新pairには持ち込まない**（統合の複雑さ・取り違えを回避）。新pair参加後の支出から共有が始まる
- 招待者(user1)のソロpairがそのまま共有pairになるため、user1の過去データは継続表示される
- この非対称性はオンボーディングで明示（「招待した人の家計簿に合流します」）

### 通知生成パイプライン（要件#16・7-6・7-7）
通知は「アプリ内記録(notifications)」と「プッシュ送信」の2段で生成する。**生成は全てサーバー側**（DBトリガー or Edge Function、service_role）で行い、クライアントからの notifications INSERT は許可しない。

| トリガー元 | イベント | 通知先 | type |
|-----------|---------|--------|------|
| expenses INSERT | 支出記録 | パートナー | expense_added |
| expenses UPDATE | 支出編集 | パートナー（記録者以外） | expense_edited |
| expenses 論理削除 | 支出削除 | パートナー | expense_deleted |
| settlements INSERT | 精算実行 | 両者 | settlement |
| check-variable-reminders | 変動固定費未入力 | 担当者/両者 | reminder_variable |
| budget判定（下記） | 予算80%/100% | 両者 | budget_warning / budget_exceeded |
| 月末cron | 未精算あり | 両者 | settlement_reminder |

- 各トリガーは送信前に**受信者の `notification_settings` を参照**し、OFFならスキップ
- notifications 行作成後、受信者の `profiles.expo_push_token` 宛に `send-push-notification` を呼ぶ
- ソロモード（user2_id IS NULL）ではパートナー系通知は生成しない

### 予算アラート判定（要件#9・7-3）
- 支出の INSERT/UPDATE 後に DBトリガー `check_budget_threshold` を発火
- 当月の該当カテゴリ（および全体予算）の使用率を集計（多通貨はexchange_ratesで換算）
- 80%到達で `budget_warning`、100%超過で `budget_exceeded` を生成
- 同一予算・同一閾値・同一月の通知は**1回だけ**（重複防止のため notifications を月+type+budgetで重複チェック）

## 5. 状態管理

### グローバル状態（Zustand）
| 状態名 | 型 | 用途 |
|--------|-----|------|
| user | User \| null | ログインユーザー情報 |
| profile | Profile \| null | プロフィール情報 |
| pair | Pair \| null | ペア情報（パートナー含む） |
| theme | 'light' \| 'dark' \| 'system' | テーマ設定 |
| language | 'ja' \| 'en' \| 'auto' | 言語設定 |

### サーバー状態（TanStack Query）
| キー | データ | staleTime |
|------|--------|-----------|
| `['expenses', pairId, month]` | 月別支出一覧 | 30秒 |
| `['expense', id]` | 支出詳細 | 30秒 |
| `['fixed-costs', pairId]` | 固定費一覧 | 5分 |
| `['settlements', pairId]` | 精算履歴 | 1分 |
| `['shared-account', pairId]` | 共同口座一覧 | 1分 |
| `['budgets', pairId]` | 予算一覧 | 5分 |
| `['categories', pairId]` | カテゴリ一覧 | 10分 |
| `['notifications', userId]` | 通知一覧 | 30秒 |
| `['settlement-balance', pairId]` | 立替残高（RPC経由） | 30秒 |
| `['exchange-rates', pairId]` | 為替レート | 10分 |

### ローカル状態（useState）
- フォーム入力値（支出入力、固定費設定、予算設定等）
- ローディング状態
- モーダルの開閉
- カメラ/OCR処理の状態
- フィルタ・期間選択の状態

### カスタムフック
| フック名 | 用途 | 返り値 |
|---------|------|--------|
| useAuth | 認証状態の管理 | { user, signIn, signUp, signOut, deleteAccount } |
| useProfile | プロフィールの取得・更新 | { profile, updateProfile, uploadAvatar } |
| usePair | ペア情報の管理 | { pair, partner, createInvite, joinPair, leavePair } |
| useExpenses | 支出の取得・操作 | { expenses, addExpense, updateExpense, deleteExpense } |
| useFixedCosts | 固定費の管理 | { fixedCosts, add, update, remove } |
| useSettlement | 精算の管理 | { balance, history, settle } |
| useSharedAccount | 共同口座の管理 | { transactions, balance, deposit, withdraw } |
| useBudgets | 予算の管理 | { budgets, setBudget, getProgress } |
| useCategories | カテゴリの管理 | { categories, add, update, remove, reorder } |
| useNotifications | 通知の管理 | { notifications, unreadCount, markAsRead } |
| useOCR | レシートOCR | { scan, result, isProcessing } |
| useResponsive | デバイスサイズ判定 | { isPhone, isTablet, screenWidth } |

## 6. 多言語対応（全アプリ共通）
- 対応言語: 日本語 / 英語
- デフォルト言語: 端末の言語設定に従う（expo-localization）
- 切替方法: 設定画面のトグルで切り替え
- 翻訳管理: `locales/ja.json` / `locales/en.json`
- 翻訳フック: `useTranslation`（react-i18next）

### 翻訳キー設計方針
- 画面単位でグルーピング（例: `home.title`, `settings.language`）
- 共通テキストは `common.` プレフィックス（例: `common.save`, `common.cancel`）
- デフォルトカテゴリは `category.` プレフィックス（例: `category.food`, `category.daily`）。DB に `name_key` として格納し、表示時に `t(name_key)` で翻訳。カスタムカテゴリは `name` をそのまま表示
- エラーメッセージは `error.` プレフィックス（例: `error.network`, `error.auth`）
- 通知テキストは `notification.` プレフィックス

## 7. レスポンシブ・iPad対応（全アプリ共通）

### ブレークポイント
| デバイス | 幅 | レイアウト方針 |
|---------|-----|--------------|
| iPhone SE | 〜374px | 1カラム、コンパクト |
| iPhone 標準 | 375〜413px | 1カラム、標準 |
| iPhone Plus/Max | 414〜767px | 1カラム、ゆったり |
| iPad | 768px〜 | 2カラム or グリッド拡張 |

### レスポンシブルール
- 固定幅（px指定）は使わない。`flex` / `%` / `useWindowDimensions` で組む
- `useResponsive` カスタムフックでデバイス種別を判定する
- リスト画面: iPadではグリッド表示（2〜3カラム）に切り替え
- レポート画面: iPadではグラフを横並び表示
- バナー広告の下に配置する要素はバナー高さ分の余白を確保

## 8. 画面状態設計（全画面共通）

| 画面 | Loading | Empty（0件） | Error | Success |
|------|---------|-------------|-------|---------|
| ホーム | スケルトン | 「支出を記録しましょう」＋入力ボタン | 再試行導線 | サマリー表示 |
| 支出一覧 | スケルトン | 「まだ支出がありません」＋入力ボタン | 再試行導線 | リスト表示 |
| 支出詳細 | スピナー | — | 再試行導線 | 詳細表示 |
| 立替精算 | スケルトン | ソロモード:「パートナーを招待しましょう」＋招待ボタン / ペアモード:「精算はありません」 | 再試行導線 | 残高＋履歴 |
| 共同口座 | スケルトン | 「入金を記録しましょう」＋入金ボタン | 再試行導線 | 取引リスト |
| 固定費管理 | スケルトン | 「固定費を登録しましょう」＋追加ボタン | 再試行導線 | リスト表示 |
| レポート | スケルトン | 「データが足りません」 | 再試行導線 | グラフ表示 |
| 通知一覧 | スケルトン | 「通知はありません」 | 再試行導線 | リスト表示 |
| カテゴリ管理 | スケルトン | （0件なし。デフォルトが常に複製済み） | 再試行導線 | リスト表示 |

## 9. アクセシビリティ方針（全アプリ共通）
- コントラスト WCAG AA（テキスト 4.5:1、大きい文字 3:1）
- タップ領域44×44pt以上
- Dynamic Type追従
- 全操作要素に `accessibilityLabel` / `accessibilityRole`
- 状態変化は `AccessibilityInfo.announceForAccessibility` で通知
- 色だけで情報を伝えない（アイコン・テキスト併用）

### 主要なaccessibilityLabel
| 要素 | label |
|------|-------|
| 支出入力FAB | 「支出を追加」 |
| 精算ボタン | 「精算する」 |
| カテゴリフィルタ | 「カテゴリで絞り込み」 |
| 通知ベル | 「通知（未読X件）」 |
| 削除ボタン | 「この支出を削除」 |

## 10. 監視・エラー検知
- Sentry を導入し、クラッシュ・JSエラー・DBクエリエラーを収集
- Supabase クライアントをSentry連携し、DBクエリの遅延・エラーもトレース
- リリースごとに `release` / `dist` をSentryにひもづけ
- 重大エラーのアラート通知先: メール（開発者）

## 11. 非機能要件
- オフライン対応: しない（オンライン接続必須）
- キャッシュ戦略: TanStack Query（staleTime設定でAPI呼び出しを最適化）
- エラーハンドリング: Toast通知（軽微）/ エラー画面＋再試行ボタン（重大）。無言で失敗させない
- ディープリンク: 招待コードのシェア時にディープリンクを使用（`webudget://pair/CODE`）
- パフォーマンス: 支出一覧は FlatList で仮想化（ScrollViewで全件描画しない）
- 画像最適化: レシート画像はアップロード前にリサイズ・圧縮（最大1200px幅）
- App Store審査対応: `app.json` に privacyManifests（Required Reason API: AsyncStorage の CA92.1 等）、ATT用 `NSUserTrackingUsageDescription`、カメラ `NSCameraUsageDescription`、フォトライブラリ `NSPhotoLibraryUsageDescription` を宣言
- 広告: AdMobバナーは各タブ画面下部に表示（SafeArea内、コンテンツと重ならない高さを確保）。課金での非表示は将来

### 将来の検討事項（MVP対象外）
- **同一レシートの二重登録防止**: 同額・同日・近接時刻の支出を検知して「重複かも？」警告（#9。MVPでは実装せず、運用状況を見て追加）
- 支出日時点の為替レート履歴（MVPは最新レートのみ）
- 部分精算（一部だけ精算する）
