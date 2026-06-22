# 命名規則書（WeBudget）

`04_implementation` の前提となるプロジェクト共通の命名規則。GLOBAL_STANDARDS（TypeScript strict / Expo）に準拠。

## 1. アプリ・ブランド名

| 項目 | 値 | 備考 |
|------|-----|------|
| 正式名称（ストア表示名） | WeBudget | 1語・PascalCase |
| 通称 | WeBudget | コンセプトは「2人(We)の家計簿」 |
| リポジトリ名 | we-budget | kebab-case（GitHub: mobileapp-works/we-budget） |
| Bundle ID (iOS) | `com.mobileappworks.webudget` | App Storeで一意・**変更不可** |
| パッケージ名 (Android) | `com.mobileappworks.webudget` | 将来Android対応時 |
| URL scheme（ディープリンク） | `webudget://` | 例: `webudget://pair/CODE` |
| Expo slug | `we-budget` | app.json の slug |

### 複数アプリの命名パターン（量産時）
```
com.mobileappworks.webudget
com.mobileappworks.<appname>   # 小文字・記号なし
```

## 2. コード命名規則

### TypeScript / React Native
| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `BalanceCard`, `ExpenseListItem` |
| 型・インターフェース | PascalCase | `Expense`, `PairProps` |
| 関数名 | camelCase | `calculateBalance()` |
| 変数名 | camelCase | `pairId`, `totalAmount` |
| 定数名 | UPPER_SNAKE_CASE | `MAX_RECEIPT_WIDTH`, `DEFAULT_CURRENCY` |
| カスタムフック | use + PascalCase | `useExpenses`, `useSettlement` |
| Bool変数 | is/has/can + 名詞 | `isLoading`, `hasPartner`, `isSharedPayment` |
| 列挙的なUnion型 | PascalCase（型）/ 値はsnake小文字でDBと一致 | `PayerType = 'self' \| 'partner' \| 'shared'` |
| Zustandストア | use + 名詞 + Store | `useAuthStore`, `usePairStore` |
| TanStack Query キー | kebab/camel配列 | `['expenses', pairId, month]` |

### 略語の扱い（プロジェクト統一）
| 略語 | 表記 | 例 |
|------|------|-----|
| URL | camelは `url` | `avatarUrl`, `receiptImageUrl` |
| ID | camelは `id` / `Id` | `pairId`, `userId`, `categoryId` |
| API | `api` | `apiClient` |
| OCR | `ocr` | `ocrResult`, `useOCR`（フック名のみ大文字許容） |
| AI | `ai` | `aiConsent` |

> DBのカラム名は `snake_case`（例 `pair_id`, `is_shared_payment`）。クライアントの型は `camelCase`（例 `pairId`, `isSharedPayment`）。Supabaseの結果は変換層でマッピングする。

## 3. ファイル・フォルダ命名規則

### ファイル名
| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase.tsx | `BalanceCard.tsx` |
| 画面（Expo Router） | kebab-case.tsx | `expense-detail.tsx`, `shared-account.tsx` |
| カスタムフック | camelCase.ts | `useExpenses.ts` |
| 型定義 | camelCase.ts | `expense.ts`, `database.ts` |
| ユーティリティ | camelCase.ts | `formatCurrency.ts`, `calculateSplit.ts` |
| 定数 | camelCase.ts | `colors.ts`, `spacing.ts` |
| Supabase関連 | camelCase.ts | `supabaseClient.ts` |
| テスト | 同名 + .test | `calculateSplit.test.ts` |

### フォルダ構成（design.md と一致）
```
src/
  app/            # Expo Router 画面（kebab-case）
    (auth)/       # 認証フロー
    (tabs)/       # メインタブ
  components/     # 共通コンポーネント
  hooks/          # カスタムフック
  lib/            # supabaseClient 等
  store/          # Zustand ストア
  constants/      # colors / spacing / typography（rules由来）
  types/          # 型定義
  utils/          # ユーティリティ
  locales/        # ja.json / en.json
```

## 4. リソース・アセット命名規則

### 画像（assets/）
| 種類 | プレフィックス | 例 |
|------|-------------|-----|
| アイコン | `ic_` | `ic_home`, `ic_settlement` |
| イラスト | `img_` | `img_empty_expenses`, `img_invite` |
| 背景 | `bg_` | `bg_splash` |
| ロゴ | `logo_` | `logo_webudget` |

### 色・トークン（constants/）
| 用途 | 命名 | 例 |
|------|------|-----|
| ブランド/セマンティック | rules準拠のトークン名 | `primary`, `accent`, `textPrimary`, `coralSoft` |

### ローカライゼーションキー（locales/）
| パターン | 例 |
|---------|-----|
| 画面.要素 | `home.title`, `settlement.settleButton` |
| 共通 | `common.save`, `common.cancel`, `common.delete` |
| カテゴリ | `category.food`, `category.rent`（DBの name_key と一致） |
| エラー | `error.network`, `error.auth` |
| 通知 | `notification.expenseAdded`, `notification.budgetExceeded` |

## 5. Git関連の命名規則

### ブランチ名
| 種類 | パターン | 例 |
|------|---------|-----|
| 機能追加 | feature/機能名 | `feature/expense-input` |
| バグ修正 | fix/内容 | `fix/settlement-rounding` |
| リリース | release/バージョン | `release/1.0.0` |

### コミットメッセージ
英語・命令形を基本（既存コミットに合わせる）。プレフィックスは任意で以下を使用可。
| プレフィックス | 用途 |
|--------------|------|
| feat: | 新機能 |
| fix: | バグ修正 |
| docs: | ドキュメント |
| refactor: | リファクタリング |
| chore: | 雑務・設定 |

末尾に `Co-Authored-By: Claude ...` を付与（既存運用通り）。
