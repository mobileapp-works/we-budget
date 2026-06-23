# WeBudget - カップル家計簿アプリ

## プロジェクト概要
カップル（2人）で共有する家計簿アプリ。支出を記録し、レシートOCR・立替精算・固定費自動計上・予算アラートで2人の家計を管理する。

- アプリ名（ストア表示名）: **WeBudget**
- Bundle ID: **com.mobileappworks.webudget**（変更不可）
- URL scheme: **webudget://**

## 技術スタック
- **フレームワーク**: React Native (Expo / Expo Router)
- **言語**: TypeScript (strict モード)
- **バックエンド**: Supabase (Auth / Database / Storage)
- **状態管理**: useState / Zustand / TanStack Query
- **広告**: Google AdMob
- **多言語**: i18next (日本語・英語)
- **エラー監視**: Sentry
- **ビルド・配信**: EAS Build / EAS Submit

## 開発フロー
`.skills/` にフェーズごとのSKILLを格納。番号順に進める。
すべてのSKILLは `.skills/GLOBAL_STANDARDS.md` を前提とする。

## コマンド
```bash
# 依存インストール（TS6とlibのpeer差異のため --legacy-peer-deps）
npm install --legacy-peer-deps

# 開発サーバー起動（.env の EXPO_PUBLIC_USE_MOCK=true でモック動作）
npx expo start

# 型チェック
npm run typecheck   # = tsc --noEmit

# テスト（お金ロジックのユニットテスト）
npm test            # = jest

# JSバンドル検証
npx expo export --platform ios

# ビルド (iOS)
eas build --platform ios
```

## 現在の状態
- モックモードで全画面動作（`src/data/mockBackend.ts`）。Supabaseは未構築。
- DB構築手順は [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)、実装状況は [docs/implementation_log.md](docs/implementation_log.md)。

## ディレクトリ構成 (予定。詳細は docs/naming_convention.md)
```
src/
  app/          # Expo Router 画面 ((auth)/ (tabs)/)
  components/   # 共通コンポーネント
  hooks/        # カスタムフック
  lib/          # Supabase クライアント等
  store/        # Zustand ストア
  constants/    # colors / spacing / typography (docs/ui 由来)
  types/        # 型定義
  utils/        # ユーティリティ
  locales/      # 翻訳ファイル (ja.json / en.json)
docs/           # 各フェーズの成果物
```

## 成果物（docs/）
- `requirements.md` 要件定義 / `design.md` 設計 / `naming_convention.md` 命名規則 / `ui/` デザインルール

## ルール
- `.skills/GLOBAL_STANDARDS.md` の基準に従う
- DBは snake_case、クライアント型は camelCase（変換層でマッピング）
- UI文字列は直書き禁止 (`t('key')` を使う)
- 固定幅 (px直書き) 禁止。flex / % / useWindowDimensions で組む
- 色・余白・文字は constants/ のトークン経由（直値禁止）
- 全テーブルで RLS 有効化（再帰回避に get_my_pair_id() ヘルパー）
- 4状態 (Loading / Empty / Error / Success) を必ず実装
- SafeAreaView でノッチ・ホームインジケータを回避
- タップ領域は最低 44x44pt
- 色だけで損益を伝えない（記号・アイコン併用）
