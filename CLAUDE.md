# WE BUDGET - カップル家計簿アプリ

## プロジェクト概要
カップル（2人）で共有する家計簿アプリ。支出・収入を記録し、2人で家計を管理する。

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
# 開発サーバー起動
npx expo start

# 型チェック
npx tsc --noEmit

# テスト
npx jest

# ビルド (iOS)
eas build --platform ios
```

## ディレクトリ構成 (予定)
```
src/
  app/          # Expo Router 画面
  components/   # 共通コンポーネント
  hooks/        # カスタムフック
  lib/          # Supabase クライアント等
  store/        # Zustand ストア
  types/        # 型定義
  locales/      # 翻訳ファイル (ja.json / en.json)
docs/           # 各フェーズの成果物
```

## ルール
- `.skills/GLOBAL_STANDARDS.md` の基準に従う
- UI文字列は直書き禁止 (`t('key')` を使う)
- 固定幅 (px直書き) 禁止。flex / % / useWindowDimensions で組む
- 全テーブルで RLS 有効化
- 4状態 (Loading / Empty / Error / Success) を必ず実装
- SafeAreaView でノッチ・ホームインジケータを回避
- タップ領域は最低 44x44pt
