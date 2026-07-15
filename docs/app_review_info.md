# WeBudget App Store Connect 入力シート（審査情報）

作成: 2026-07-14 / 対象: v1.0.0 build#21
関連: [release_checklist.md](release_checklist.md) 4・5章 / [pre_release_audit.md](pre_release_audit.md)

> ASC の各画面に**そのまま入力・コピペする内容**。実装を実地確認して作成（監査 A-7 の整合対応）。

---

## 1. App Privacy（Appのプライバシー）

「データを収集していますか？」→ **はい**

実装の事実（2026-07-14 検証済み）:
- OCR は端末内 ML Kit（外部送信なし）→ `src/lib/ocr.ts`
- レシート画像は Supabase Storage に保存 → **User Content として収集扱い**
- AdMob SDK は自身の `.xcprivacy` で **DeviceID を `Tracking: true`** と申告（IPAで確認済み）

### 入力する収集データ

> **出典**: 下段7種は **build#21 の IPA 内 `GoogleMobileAdsResources.bundle/PrivacyInfo.xcprivacy` を実読して転記**（2026-07-15）。
> ASC の申告が SDK の自己申告とズレると 5.1 系リジェクト要因になるため、**推測せず SDK の申告に合わせる**こと。

| データ種別 | 用途（ASCでチェックする項目） | **リンク** | **トラッキング** |
|-----------|------------------------------|:---:|:---:|
| **連絡先情報 > メールアドレス** | アプリの機能 | ✓ | |
| **金融情報 > その他の金融情報**（支出額・予算・精算額・共同口座残高） | アプリの機能 | ✓ | |
| **ユーザーコンテンツ > 写真またはビデオ**（レシート画像・プロフィール画像） | アプリの機能 | ✓ | |
| **ユーザーコンテンツ > その他のユーザーコンテンツ**（メモ・店名） | アプリの機能 | ✓ | |
| **識別子 > ユーザーID** | アプリの機能 | ✓ | |
| **識別子 > デバイスID** | 第三者広告 / 開発者広告 / アナリティクス | ✓ | **✓** |
| **使用状況データ > 広告データ** | 第三者広告 / 開発者広告 / アナリティクス | ✓ | |
| **使用状況データ > 製品の操作** | 第三者広告 / 開発者広告 / アナリティクス | ✓ | |
| **位置情報 > 大まかな位置情報** | 第三者広告 / 開発者広告 / アナリティクス | ✓ | |
| **診断 > クラッシュデータ** | アナリティクス | | |
| **診断 > パフォーマンスデータ** | 第三者広告 / 開発者広告 / アナリティクス | | |
| **診断 > その他の診断データ** | 第三者広告 / 開発者広告 / アナリティクス | | |

> ⚠️ **家計簿アプリは「金融情報 > その他の金融情報」の申告を忘れない**。Apple の定義は
> 「salary, income, assets, debts, **or any other financial information**」で、支出額・予算・精算額が該当する。
> 初版でこれを「その他のユーザーコンテンツ」だけで済ませていたが、**過少申告は 5.1.1 のリジェクト要因**（過剰申告では落ちない）。
>
> 🔑 **トラッキングにチェックするのは `デバイスID` だけ**。
> AdMob の `.xcprivacy` で `NSPrivacyCollectedDataTypeTracking = true` になっているのは **DeviceID のみ**で、
> `AdvertisingData` を含む他はすべて `false`。（初版でここを「広告データも ✓」と誤記していたため訂正）
> 上4種は自社データ（Supabase）。下7種は **AdMob SDK 同梱分**で、自社コードでは取得していないが申告義務がある。

### 注意（言ってはいけないこと）
- ❌「レシート画像は端末外に出ない」→ **誤り**。Storage に保存される（ポリシー修正済み）
- ⭕「OCR（文字認識）のために画像を外部送信することはない」→ 正しい

---

## 2. 年齢制限レーティング

| 質問 | 回答 |
|------|------|
| 暴力・性的表現・薬物・ギャンブル等 | **すべて「なし」** |
| 無制限のWebアクセス | **なし**（アプリ内ブラウザなし。外部リンクはSafariで開く） |
| ユーザー生成コンテンツの共有 | **なし**（ペア2人の間のみ。公開共有・SNS機能なし） |

→ 想定レーティング: **4+**

> ※2025年7月〜の新カテゴリに対応。ギャンブル・コンテスト等は該当なし。

---

## 3. 審査に関する情報（App Review Information）

### サインイン必須: **はい**

### デモアカウント（要準備 ⚠️）

```
ユーザー名: [デモアカウントのメールアドレス]
パスワード: [パスワード]
```

**デモアカウントの要件（監査 A-9 / High）:**
1. **メール確認済みであること**
   Supabase の Confirm email が ON のため、審査員が新規登録しても確認メールを受け取れずログイン不可 → **確実にリジェクト**。事前に確認を済ませたアカウントを渡すこと。
2. **シードデータ入りであること**（空だと Guideline 4.2「最低限の機能」リスク）
   - ペア成立済み（パートナー側もダミーで作成）
   - 当月の支出 10件以上（複数カテゴリ・複数支払者）
   - 立替残高が 0 でない（精算ボタンを試せる状態）
   - 予算を設定済み（進捗バーが見える）
   - 固定費を1〜2件登録
   - 共同口座に入金・支出の記録あり
   - 精算履歴 1〜2件

### 連絡先情報
```
氏名: [姓・名]
電話番号: [連絡可能な番号]
メール: [連絡可能なメール]
```

### 備考（Notes）— **英語版を使うこと**

> ⚠️ 本アプリの ASC プライマリ言語は **英語（アメリカ）**。審査は英語圏のレビュアーに回る可能性が高いため、
> メモは英語で入れる。日本語版は参考として下に残す。

```
[About the app]
WeBudget is a household budgeting app for two people (couples/partners).
When either partner records an expense, the app automatically calculates who
has fronted how much, and the balance can be settled in one tap.

[Demo account]
The demo account above is email-verified and pre-loaded with sample data:
a paired partner, expenses across several categories, an outstanding
reimbursement balance, budgets, fixed costs, a joint account, and settlement
history. You can review every feature immediately after signing in.
Sign in with Apple also works, but it starts from an empty state, so please
use the demo account above to see the full functionality.

[Receipt OCR - please note]
Receipt text recognition runs entirely ON DEVICE (on-device ML Kit). No image
is sent to any external server for OCR. Only the saved receipt image is stored
in our cloud storage (Supabase) so the user and their partner can view it later.
This matches our Privacy Policy and our App Privacy declaration.

[Ads and tracking]
The app shows Google AdMob banner ads. On first launch we present the Google
UMP consent form and the App Tracking Transparency prompt. All features remain
fully available if the user declines tracking.

[Account deletion]
Settings > Account > Delete account. This removes the user's personal data on
the server, and revokes the Apple token when Sign in with Apple was used.

[Devices]
Supports both iPhone and iPad.
```

### 備考（Notes）日本語版（参考・プライマリ言語を日本語にする場合に使う）

```
【アプリ概要】
2人（カップル・夫婦）で家計を共有する家計簿アプリです。支出を記録すると、
どちらがいくら立て替えているかを自動計算し、ワンタップで精算できます。

【デモアカウントについて】
上記のデモアカウントはメール確認済みで、支出・ペア・立替残高・予算・共同口座・
精算履歴のサンプルデータが入っています。ログイン後すぐに全機能をご確認いただけます。
「Sign in with Apple」でもログイン可能ですが、その場合データが空の状態から始まるため、
機能確認には上記デモアカウントのご利用をお願いします。

【レシートOCRについて】
レシートの文字認識は端末内（Apple/Google の on-device ML Kit）で処理しており、
読み取りのために画像を外部サーバーへ送信することはありません。
保存されたレシート画像のみ、ユーザーとパートナーが後から閲覧できるよう
当社のクラウドストレージ（Supabase）に保管されます。この点はプライバシーポリシー
および App Privacy の申告と一致しています。

【広告とトラッキングについて】
Google AdMob のバナー広告を表示します。初回起動時に UMP（Google User Messaging
Platform）による同意フォームと、App Tracking Transparency のダイアログを表示します。
トラッキングを拒否された場合も、アプリの全機能は制限なくご利用いただけます。

【アカウント削除】
設定 > アカウント > アカウントを削除 から実行できます。削除時にはサーバー側の
個人情報も削除され、Sign in with Apple 利用時は Apple のトークンも失効させます。

【対応デバイス】
iPhone / iPad の両方に対応しています。
```

---

## 4. 提出前の最終確認

- [ ] デモアカウントを作成し、**実際にログインできることを確認**（確認メール済み）
- [ ] デモアカウントにシードデータを投入
- [ ] App Privacy を上記の表どおり入力
- [ ] 年齢レーティングを回答（4+ 想定）
- [ ] 審査メモを貼り付け
- [ ] **AdMob コンソールで ATT メッセージ + GDPR同意フォームを公開**（未構成だと ATT が出ずガイドライン 5.1.2 違反）
- [ ] 実機で初回起動 → UMP同意 → ATTダイアログが出ることを確認
