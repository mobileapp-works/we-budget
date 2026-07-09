# WeBudget リリース前 総合監査レポート

実施: 2026-07-09 / 対象: MVP v1.0.0（iOS 提出前）/ 手法: ソースコード全面精査 + 自動テスト実行 + Apple 審査観点レビュー
更新: 2026-07-09（コードで安全に直せる項目を修正済み。各項目に【修正済】/【残】タグを付与）

> 各項目に **深刻度 / 根拠(ファイル) / 内容 / 推奨対応** を記載。
> 見出しの **【修正済】** = 本対応でコード/設定を修正（要 `git diff` 確認、DBは migration 適用が別途必要）。
> **【残】** = 外部作業（Apple/AdMob 管理画面・実機確認）や仕様判断が必要で未対応。

## 今回の修正サマリー（2026-07-09）

コードとして安全に直せるものを修正しました（自動テスト再実行: **Jest 132 passed / typecheck 0 / expo export 成功**）。

| 項目 | 内容 | 変更ファイル | 追加作業 |
|------|------|------------|---------|
| **F-1** | `calculate_settlement_balance` にメンバーチェック＋anon剥奪 | `supabase/migrations/0014_settlement_balance_membership_check.sql`（新規） | **要: Supabase で 0014 を適用** |
| **I-4** | push関数の予算ゲートを `budget_warning`/`budget_exceeded`→`budget_alert` に | `supabase/functions/send-push-notification/index.ts` | 要: Edge Function 再デプロイ |
| **B-1** | `parseAmount` を NFKC 正規化（全角数字対応）+ テスト追加 | `src/utils/validation.ts` / `validation.test.ts` | なし |
| **I-5** | ログイン時に `profile.ai_consent` をローカルへ引き上げ | `app/_layout.tsx` | なし |
| **A-2** | SKAdNetwork 識別子を1件→46件に拡充 | `app.json` | 次ビルドで反映 |
| **A-5** | 不要な Android `RECORD_AUDIO` 権限を削除 | `app.json` | 次ビルドで反映 |
| **A-1** | Privacy Manifest に定番3種（File timestamp/System boot time/Disk space）を先回り宣言 | `app.json` | ビルド後に集約manifestを目視確認 |
| **I-2** | プライバシーポリシーから未実装の「Sentry」記述を削除（監視はMVP見送り） | `docs/privacy-policy.html` | GitHub Pages は push で更新 |

**残（外部作業・仕様判断が必要）**: A-6 / A-7 / A-8 / A-9（Apple・AdMob 管理画面・実機）、A-1の最終確認（ビルド後 `.xcprivacy` 目視）、I-1 / I-3（ドキュメント/多言語化）、B-2（サーバ側フラグ化が本筋のため見送り）。

## 0. サマリー（結論）

- **自動チェックは全てグリーン**: Jest **131 passed / 8 suites**、`tsc` **エラー0**、`expo export`（iOS）**成功**。
- **リリースを止めるほどの致命バグは検出されず**。ただし **審査で確認/対応すべき項目が数点**、**セキュリティ強化1点（F-1）**、**要件と実装の不整合（ドキュメント側）数点** あり。
- 特に **Apple 審査の「デモアカウント提供」「プライバシー表示の整合」「Privacy Manifest の網羅」** は提出前に必ず確認すること（§2）。

深刻度の内訳:

| 深刻度 | 件数 | 代表項目 |
|--------|------|---------|
| High（提出前に要対応/要確認） | 3 | A-1 Privacy Manifest網羅・A-9 デモアカウント・A-7 プライバシー表示整合 |
| Medium（できれば提出前） | 3 | F-1 精算残高RPCの権限・A-8 バナー配置・A-6 ATT/UMP構成 |
| Low（次版でも可・品質） | 9 | I-1〜I-5 不整合、B-1〜B-4 品質 |

---

## 1. セキュリティ / ロジック検出

### F-1【Medium】【修正済】`calculate_settlement_balance` にペアメンバーチェックが無い（情報漏えい / IDOR）
- **修正**: `supabase/migrations/0014_settlement_balance_membership_check.sql` を追加。関数冒頭に `if auth.uid() is not null and get_my_pair_id() is distinct from p_pair_id then raise exception 'forbidden'` を追加し、anon/public から EXECUTE を剥奪（authenticated のみ）。cron/内部 definer 呼び出し（`send_settlement_reminders`/`execute_settlement`）は通過するよう `auth.uid() is not null` 条件で保護。**→ Supabase の SQL Editor で 0014 を適用すること。**
- **根拠**: `supabase/migrations/0002_rls_functions.sql:115-161`（`security definer`・冒頭にメンバーチェック無し）。`0012_function_execute_hardening.sql:21-22` のコメントが本関数を意図的に「対象外（authenticated から実行可）」としている。
- **内容**: 本関数は `SECURITY DEFINER` で、任意の `p_pair_id` を受け取り `settlementAmount / fromUserId / toUserId / unconvertedCurrencies` を返す。**呼び出し元が当該ペアの一員かを検証していない**。対になる `execute_settlement` は `if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'` を持つが、こちらには無い。
  - 実害の程度: `pair_id` はランダム UUID で UI 非露出のため外部からの推測は困難。ただし **ペア解除後の元パートナーは旧 pair_id を知っている** → 旧ペアの精算残高・両者の user_id を継続的に取得できる（凍結された立替額の覗き見）。
- **推奨対応**: 関数冒頭に `if get_my_pair_id() <> p_pair_id then raise exception 'forbidden'; end if;` を追加（`execute_settlement` と同様）。1行で塞げる。cron/`send_settlement_reminders` は `SECURITY DEFINER` 内から呼ぶため定義者権限で影響なし。※内部呼び出し箇所（`send_settlement_reminders`）は各ペアを走査して呼ぶので、その経路は `get_my_pair_id()` に依存しない実装に留意（現状は別関数のためOK。修正時は内部呼び出しを新しい無チェック版に分けるか、`send_settlement_reminders` 側で直接計算する）。

### 検証済みで問題なし（セキュリティ）
- 内部関数（`notify_user/notify_partner/post_fixed_expenses/send_variable_reminders/send_settlement_reminders/check_budget_alerts`）は **0012+0013 で public/anon/authenticated から EXECUTE 剥奪済み**（`0013` 要適用）。
- RLS は全テーブル pair_id スコープ、`get_my_pair_id()`（SECURITY DEFINER）で再帰回避。notifications は自分宛のみ、書き込みはサーバのみ。
- Storage: receipts は private・`{pair_id}/` 単位、avatars は public read/own write（`0003`）。
- `execute_settlement` はメンバーチェック＋サーバ再計算（クライアント値を信用しない）。スタンプ対象は集計対象と同一条件（`0004` でレート未設定外貨の取りこぼし修正済み）。
- 精算スタンプ UPDATE で `expense_edited` 通知が連発しないよう `0009` で `settlement_id` 変更を通知除外済み。

## 2. Apple App Store 審査レディネス

### A-1【High】【一部修正済 / 要確認】Privacy Manifest（`app.json`）の宣言が UserDefaults(CA92.1) のみ
- **修正**: `app.json` の `privacyManifests` に RN/Expo が使う定番3種を先回り宣言 — File timestamp(`C617.1`) / System boot time(`35F9.1`) / Disk space(`E174.1`)。ITMS-91053 リスクを低減。
- **残（要確認）**: サードSDK（Google Mobile Ads / Google Sign-In / Supabase）は自前 `.xcprivacy` を同梱するため、**EAS ビルド後の集約 `PrivacyInfo.xcprivacy`（またはビルドログ）で最終的な網羅を目視確認**すること（reason コードの過不足含む）。
- **根拠**: `app.json`（旧: `NSPrivacyAccessedAPITypes` に CA92.1 のみ）。

### A-7【High / 要確認】App Store Connect のプライバシー表示（Nutrition Label）と実装の整合
- **根拠**: 実装＝OCRは端末内（`src/lib/ocr.ts`）で外部送信なし。広告＝AdMob（IDFA/トラッキング）。バックエンド＝Supabase（メール・プロフィール・支出）。
- **内容**: プライバシー表示が実態と食い違うと 5.1 系リジェクト対象。
  - レシート画像/OCR: **外部AIに送信していない**（端末内）。ただし画像自体は **Supabase Storage に保存**する → "User Content" として収集扱い。
  - 広告: AdMob は **Identifiers / Usage Data / Device ID** を収集し得る → "Data Used to Track You" に該当（ATT前提）。
  - 認証: Email、（Apple/Google）ユーザーID、表示名。
- **推奨対応**: 上記に沿って App Privacy を設定。特に AdMob の収集項目は Google の開示表に合わせる。プライバシーポリシー本文も「OCRは端末内処理・画像はStorage保存・広告はAdMob」で整合させる（現行ポリシーの記述を確認）。

### A-9【High】App Review 用のデモ/動作環境
- **内容**: メール登録は確認メール必須（Supabase）。**Apple 審査員が新規メール登録すると確認できずログイン不可**になり得る。また空アプリは「機能不足」リジェクトの原因。
- **推奨対応**:
  1. **確認済みのデモアカウント**（メール/パスワード）を用意し、**支出・ペア・精算などのシードデータ入り**にして App Review メモに記載。
  2. もしくは **Sign in with Apple**（確認メール不要）で入れることを明記。ただしデータが空だと弱いので、デモアカウント推奨。
  3. 審査メモに「広告は AdMob テスト/本番」「ATTの意図」も一言。

### A-6【Medium / 要確認】ATT / UMP 構成
- **根拠**: `app.json:22`（`NSUserTrackingUsageDescription` あり）、`src/hooks/useAdsInit.ts`（`AdsConsent.gatherConsent()` → `initialize`）。
- **内容**: クライアント実装は済。ただし **AdMob 管理画面の「プライバシーとメッセージング」で ATT メッセージ / GDPR 同意フォームの構成が必要**（`docs/test_plan.md` でも「残」）。未構成だと ATT プロンプトが出ない/UMP が空振り。
- **推奨対応**: AdMob コンソールで ATT メッセージ + EU 同意フォームを作成・公開。実機で初回起動時に ATT ダイアログが出ることを確認（§5-E 40）。

### A-8【Medium / 要確認】バナー広告の配置（下端 SafeArea / ホームインジケータ）
- **根拠**: `src/components/Screen.tsx:30`（`edges = ['top','left','right']` で **bottom を含めない**）+ `Screen.tsx:49`（`BannerAdSlot` を SafeAreaView 内下端に配置）。
- **内容**: タブ画面はタブバーが下端 SafeArea を処理するため問題になりにくいが、**スタック画面（精算・プロフィール・予算・共同口座・固定費・カテゴリ・通知設定など `withBanner=true`）ではバナーが画面最下端にフラッシュ**し、ホームインジケータ帯に重なる懸念。Apple ガイドライン的にも広告が操作要素/システムUIと干渉しないことが必要。
- **推奨対応**: バナー枠の下に bottom safe-area 分の余白を確保（`SafeAreaView` の edges に 'bottom' を足す or `useSafeAreaInsets().bottom` をバナー下パディングに）。実機（iPhone 15 等ノッチ機）で目視確認。

### A-2【Low】【修正済】SKAdNetwork の登録が1件のみ
- **修正**: `app.json` の `skAdNetworkItems` を **46件**に拡充（AdMob/主要メディエーションの公開ID）。次ビルドで反映。
- **注意**: SKAdNetwork ID は時々更新されるため、提出前に **Google AdMob 公式の最新一覧**と付き合わせて過不足を確認すること。

### A-5【Low】【修正済】Android の `RECORD_AUDIO` 権限（将来 Android 向け）
- **修正**: `app.json` の `android.permissions` から `RECORD_AUDIO` を削除（本アプリに録音機能なし）。`READ_EXTERNAL_STORAGE` は image-picker 互換のため残置（Android SDK33+ では将来見直し）。

### 検証済みで良好（Apple）
- **Sign in with Apple 実装済み**（`app.json:18` `usesAppleSignIn`、`src/lib/oauth.ts`）→ 3rdパーティログイン提供時の Guideline 4.8 要件を満たす。
- **アカウント削除の導線あり**（設定→`delete-account`、`app/(tabs)/settings.tsx:100`）→ Guideline 5.1.1(v) を満たす。
- **権限文言（日本語）**: カメラ/フォト/トラッキングの Usage Description を宣言（`app.json:20-22`）。
- **`ITSAppUsesNonExemptEncryption: false`** 設定済み（標準HTTPSのみ）。
- **プライバシーポリシーURL 公開**（`src/constants/index.ts:18`、200確認済み）。

## 3. 要件・設計と実装の不整合（主にドキュメント側の陳腐化）

### I-1【Low】OCR の実装方式がドキュメントと異なる
- **根拠**: `docs/requirements.md:45`・`docs/design.md:449` は「Google Cloud Vision API を Edge Function `ocr-receipt` 経由」。実装は **端末内 ML Kit**（`src/lib/ocr.ts`、`@react-native-ml-kit/text-recognition`）で、`supabase/functions/ocr-receipt` は**存在しない**。
- **評価**: アプリ挙動・同意文言（`aiConsent.body`＝「端末内で処理・外部送信しない」）は**正直で問題なし**。むしろプライバシー的に良い。ドキュメントのみ未更新。
- **推奨対応**: requirements/design の OCR 記述を「端末内 ML Kit・外部送信なし」に更新。要件#15「外部AI利用同意」は実態に合わせ「端末内OCRの説明画面」と読み替え。

### I-2【Low】【一部修正済】Sentry が未導入（要件・設計・プライバシーポリシーに記載あり）
- **修正**: ユーザー判断により **MVPは監視なしで提出**する方針。実態と食い違っていた **プライバシーポリシーの「エラー監視: Sentry / Error monitoring: Sentry」記述を削除**（`docs/privacy-policy.html` ja/en 両方）。掲載ポリシー（GitHub Pages）は push で更新される。
- **残**: `docs/design.md §10`・`requirements.md` の Sentry 記述は「監視は v1.1」に更新するのが望ましい（仕様ドキュメントのため今回は保留）。導入する場合は `@sentry/react-native` 追加＋ErrorBoundary/グローバルハンドラ配線。
- **根拠**: `package.json` に `@sentry/*` 無し。`src/components/ErrorBoundary.tsx:25` は TODO のみ。

### I-3【Low】サーバ生成通知が日本語固定（英語ユーザーにも日本語）
- **根拠**: `0005/0009/0010/0011` の通知文言がSQL内日本語固定（例 `0011:117` 「予算の80%に達しました」）。英語ユーザーのプッシュ/アプリ内通知が日本語になる。マイグレーションのコメントも「多言語化は H-12 で別途」と既知。
- **推奨対応**: 通知の多言語化（受信者 `profiles.language` で分岐 or キーで送りクライアント側翻訳）。審査ブロックではないが、英語表示品質の観点で認識しておく。

### I-4【Low】【修正済】`send-push-notification` の設定ゲートが予算タイプ名と不一致（無害）
- **修正**: `SETTING_COLUMN` に `budget_warning`/`budget_exceeded` → `budget_alert` を追加（`send-push-notification/index.ts`）。**→ Edge Function の再デプロイが必要。**
- **根拠**: `supabase/functions/send-push-notification/index.ts:17-25` の `SETTING_COLUMN` は `budget_alert` キー。実際の通知 `type` は `budget_warning`/`budget_exceeded`。
- **評価**: 該当タイプが `SETTING_COLUMN` に無いためプッシュ側ゲートは素通り。だが **DB の `notify_user` が既に `budget_alert` 設定で行INSERT自体を止める**ため、OFF時は通知行が作られず Webhook も発火しない。**実害なし（デッドコード）**。
- **推奨対応**: 可読性のため `budget_warning`/`budget_exceeded` を `SETTING_COLUMN` に追記（→ `budget_alert` カラム）。

### I-5【Low】【修正済】AI同意の状態がローカル Zustand のみでプロフィールと非同期
- **修正**: `app/_layout.tsx` でログイン時に `profile.ai_consent` が true ならローカルストアへ引き上げ（アップグレードのみ・ローカルの取り消しはしない）。別端末/再インストールでの再同意を回避。
- **根拠**: `src/store/preferencesStore.ts`（AsyncStorage 永続）で `aiConsent` を保持。`app/ai-consent.tsx:24-27` は store と profile 両方に書くが、**ログイン時に `profile.ai_consent` を store へ読み戻さない**。
- **内容**: 別端末/再インストールで、既に同意済みのユーザーが再度同意を求められる（初回OCR時）。機能不具合ではないが一貫性の欠如。
- **推奨対応**: セッション確立時に `profile.aiConsent` を store に同期。

## 4. 品質・堅牢性（Low）

### B-1【Low】【修正済】`parseAmount` が全角数字を弾く
- **修正**: `src/utils/validation.ts` で `input.normalize('NFKC')` を適用し全角数字/記号を半角化。`validation.test.ts` に全角ケース3件追加（全132テスト green）。
- **根拠**: `src/utils/validation.ts`（旧: `Number('１２３')` → `NaN` → `null`）。

### B-2【Low】【残・仕様判断】個人メールアドレスがソースにハードコードされ配布物に載る
- **根拠**: `src/lib/ads.ts:64-67`（`INTERSTITIAL_AD_EXCLUDED_EMAILS` に実在の gmail / docomo アドレス）。
- **内容**: JSバンドル（`dist/_expo/static/js/ios/*.hbc`）に平文で含まれ、抽出可能。機能上は問題ないがプライバシー的に望ましくない。
- **今回見送りの理由**: クライアント側リストである限り、env/eas.json に移しても結局バンドルに載るため本質的解決にならない。**本筋は「サーバ側フラグ（例: `profiles.ad_free` 相当）で除外」**であり、これは MVP スコープを超える設計変更のため今回は見送り。当面はローカルに残置。
- **暫定対応（任意）**: 第三者（パートナー）のアドレスだけでも除去したい場合は該当行を削除（そのユーザーには全画面広告が表示されるようになる点に留意）。

### B-3【情報】ペア解除後、当該ユーザーからは精算履歴が見えなくなる
- **根拠**: `settlements` は RLS で `get_my_pair_id()` スコープ。解除で新ソロpairに切替わるため旧 settlements は非表示（expenses は `recorded_by=自分` で閲覧可の追加条件あり、settlements には無い）。
- **評価**: 設計（履歴はペアの資産）に沿う挙動。要件7-10は「自分が記録した支出」の閲覧を保証しており精算履歴は対象外。**仕様として認識でOK**。

### B-4【Low / 提出時確認】バージョン/ビルド番号運用
- **根拠**: `app.json:7` `version:"1.0.0"` / `app.json:17` `buildNumber:"1"`。`eas.json` は `appVersionSource:"remote"` + production `autoIncrement:true`。
- **推奨対応**: 提出時に App Store Connect 側のビルド番号と齟齬が出ないこと（remote 管理なので基本OK）を確認。

## 5. 実行した自動チェックの記録（再現手順）

```bash
npm test            # 131 passed / 8 suites（money/settlement/budget/sharedAccount/receipt/validation/date/mappers）
npm run typecheck   # tsc --noEmit：エラー 0
npx expo export --platform ios   # JSバンドル生成成功（未解決import・循環なし）
```

- 本監査で **`src/data/mappers.test.ts`（18件）を追加**（未テストだった行→ドメイン変換層。numeric→Number 強制と null 正規化を固定＝金額の文字列連結バグ回帰防止）。
- 追加は既存挙動の検証のみ（プロダクションコード変更なし）。

## 6. 提出前チェックリスト（優先度順・抜粋）

**コード修正済み → 反映作業が残るも:**
- [ ] **F-1** Supabase SQL Editor で `0014_settlement_balance_membership_check.sql` を適用
- [ ] **I-4** `send-push-notification` を再デプロイ（`supabase functions deploy send-push-notification`）
- [ ] **0013 適用**（`notify_partner` public 剥奪）＋ §6 SQL 検証一式（`docs/test_cases.md §6`）
- [ ] **A-2 / A-5 / B-1 / I-5** は次の EAS ビルドで自動反映（追加作業なし）

**外部作業・実機確認が必要なもの:**
- [ ] **A-9** 確認済みデモアカウント（シードデータ入り）を用意し App Review メモへ
- [ ] **A-1** EAS ビルド後の集約 `PrivacyInfo.xcprivacy` で Required Reason API の網羅を確認
- [ ] **A-7** App Privacy 表示（特に AdMob のトラッキング/収集）とプライバシーポリシーを実装と整合
- [ ] **A-6** AdMob コンソールで ATT メッセージ + GDPR 同意フォームを構成 → 実機で ATT 表示確認
- [ ] **A-8** ノッチ機でバナーがホームインジケータ/コンテンツに重ならないか目視
- [ ] 実機手動テスト §5（認証/支出/精算/通知/UI）一巡

**仕様判断（次版でも可）:**
- [ ] **I-1**（OCRドキュメント整合）/ **I-2**（Sentry採否）/ **I-3**（通知多言語化）/ **B-2**（広告除外のサーバ側化）
