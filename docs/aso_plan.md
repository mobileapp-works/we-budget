# WeBudget ASO計画・ストア掲載文（App Store Connect 貼り付け用）

作成: 2026-07-14 / 関連: [release_checklist.md](release_checklist.md) 1章 / [screenshot_plan.md](screenshot_plan.md)

> **そのままコピペできる形**で書いてある。
> 文字数は **2026-07-15 にスクリプトで実測して上限内を確認済み**（目視で数えると間違える。実際、初版の英語サブタイトルが31/30、英語プロモが205/170でオーバーしていた）。
> 文言を変えたら必ず再カウントすること（Appleは文字数=コードポイント数で判定。日本語も1字=1）。

---

## ⚠️ 先に読む: 競合の名前がほぼ同じ

App Store（日本）を検索した結果（2026-07-14 時点）:

| アプリ名 | Bundle ID | 備考 |
|---------|-----------|------|
| **We Budget: カップル家計簿** | `com.webudget.couple` | **名前もコンセプトもほぼ同一の競合が既存** |
| WeBudget: Shared Money Tracker | `com.appicorn.budgetapp` | 英語圏の共有家計簿 |
| Haushaltsbuch - WeBudget | `com.engineerwise.spendwise` | 独語 |

- 「WeBudget」**単体の名前は空いている**ので ASC の登録は通る見込み。
- ただし **"WeBudget" で検索すると競合が並ぶ**ため、アプリ名は**識別子を足して差別化**するのが必須。
- 下記の推奨名はこれを踏まえたもの。

---

## 1. ストア掲載情報（日本語）

### アプリ名（30字以内）— 23字
```
WeBudget - ふたりの家計簿・立替精算
```
> 「ふたり」「家計簿」「立替精算」で検索語を確保しつつ競合と差別化。

### サブタイトル（30字以内）— 17字
```
レシート撮影で記録、立替は自動精算
```

### プロモーションテキスト（170字以内）— 後から差し替え可
```
レシートを撮るだけで、ふたりの支出をまとめて記録。誰がいくら立て替えたかは自動で計算され、精算はワンタップ。固定費は自動計上、予算オーバーは事前にお知らせします。同棲・夫婦・遠距離、どんなカップルにも。
```

### 説明文（概要 / 4000字以内）
```
「今月いくら使った？」「これ、どっちが払った？」
ふたりのお金の話を、ラクにする家計簿アプリです。

WeBudget は、カップル・夫婦2人で使うことだけを考えて作りました。
支出を記録すると、誰がいくら立て替えているかが自動で計算され、
精算はワンタップ。もう「誰がいくら」で揉めません。

◆ レシートは撮るだけ
レシートを撮影すると、合計金額を自動で読み取ります。
文字の読み取りは"あなたの端末の中"で行われ、読み取りのために
画像が外部に送られることはありません。

◆ 立替は自動で計算、精算はワンタップ
「自分が払った」「パートナーが払った」「共同口座から払った」を記録するだけ。
負担割合（50:50 でも 60:40 でも自由）に応じて立替残高を自動計算します。
精算したらワンタップでリセット、履歴も残ります。

◆ 共同口座もまとめて管理
共同口座への入金・残高・そこからの支出を記録。
共同口座で払ったものは立替の対象外になるので、二重計上になりません。

◆ 固定費は自動、変動費はリマインド
家賃のような毎月同じ金額は自動で計上。
光熱費のような毎月変わる費目は、入力し忘れを通知でお知らせします。

◆ 使いすぎる前に、お知らせ
カテゴリ別・全体で月間予算を設定。80%到達と超過でアラートが届きます。

◆ 何に使ったか、まる見え
カテゴリ別の内訳をグラフで表示。月・週で切り替えられます。

◆ 海外でも使える
日本円以外の通貨でも記録でき、基準通貨に換算してまとめて管理できます。

◆ ふたりで、すぐ始められる
招待コードを送るだけでペアに。パートナーが支出を記録すると通知が届きます。
ひとりで始めて、あとからパートナーを招待することもできます。

【こんな方に】
・同棲を始めて、お金の分担を決めたい
・「立て替えたまま忘れる」をなくしたい
・共通の貯金や家賃をきちんと管理したい
・お互いの使いすぎを、責めずに把握したい

【対応】
・日本語 / English
・iPhone / iPad
・Appleでサインイン / Googleでサインイン / メールアドレス

【お問い合わせ】
アプリ内の設定画面、またはサポートページからご連絡ください。
```

### キーワードフィールド（100字以内・カンマ区切り・スペース禁止）— 96字
```
カップル,同棲,夫婦,ふたり,家計簿,共有,割り勘,立替,精算,共同口座,家計,節約,予算,支出,レシート,家計管理,同棲生活,お小遣い
```
> ※アプリ名・サブタイトルに入れた語は重複させない方が効率的だが、日本語は表記ゆれを拾わせるため一部あえて重複。

---

## 2. ストア掲載情報（English）

### App Name（30字以内）— 30字
```
WeBudget - Couples Budget App
```

### Subtitle（30字以内）— **29字**
```
Snap receipts, settle up fast
```

### Promotional Text（170字以内）— **143字**
```
Snap a receipt and log it in seconds. WeBudget tracks who paid what and settles up in one tap. Bills on autopilot, alerts before you overspend.
```

### Description
```
"How much did we spend this month?" "Wait, who paid for that?"
WeBudget makes money conversations between two people easy.

Built only for couples. Log an expense and WeBudget automatically works out
who owes whom — settle up with a single tap.

◆ Just snap the receipt
Take a photo and the total is read automatically. Text recognition runs
on your device — your image is never sent anywhere for OCR.

◆ Balances calculated, settled in one tap
Record who paid: you, your partner, or your joint account.
Set any split you like (50:50, 60:40, whatever works) and the balance
updates itself. Settle up in a tap and keep the history.

◆ Joint account, included
Track deposits, balance and spending from your shared account.
Joint-account purchases are excluded from reimbursement, so nothing is double counted.

◆ Bills on autopilot
Fixed costs like rent are posted automatically each month.
Variable bills like utilities remind you when you haven't entered them.

◆ Know before you overspend
Set monthly budgets overall or per category. Get alerts at 80% and when exceeded.

◆ See exactly where it goes
Category breakdown with charts. Switch between monthly and weekly.

◆ Works abroad
Record expenses in other currencies and convert them to your base currency.

◆ Start in seconds
Send an invite code to pair up. Get notified when your partner logs something.
You can also start solo and invite your partner later.

【Perfect for】
- Couples who just moved in together
- Anyone tired of forgetting what they fronted
- Managing shared rent and savings properly
- Seeing spending clearly, without blame

【Details】
- English / 日本語
- iPhone / iPad
- Sign in with Apple / Google / Email
```

### Keywords（100字以内）— 97字
```
couple,shared,split,expense,settle,partner,joint,budget,receipt,tracker,spending,bills,roommate,duo
```

---

## 3. カテゴリ・その他

| 項目 | 設定値 | 備考 |
|------|--------|------|
| プライマリカテゴリ | **ファイナンス** | 家計簿の主戦場 |
| セカンダリカテゴリ | **ライフスタイル** | カップル文脈で拾う |
| 価格 | **無料** | 広告収益（v1.1でサブスク予定） |
| 配信地域 | 全世界（日英対応のため） | |

---

## 4. スクリーンショット戦略
→ [screenshot_plan.md](screenshot_plan.md) に撮影計画とキャッチコピーを記載済み。

---

## 5. リリース時 ASOチェック
- [x] アプリ名にメインキーワード（ふたり/家計簿/立替精算）を含む
- [x] サブタイトルに補助キーワード（レシート/自動精算）を含む
- [x] 説明文の1行目に最重要訴求（会話フック）
- [x] キーワードフィールドを100字近くまで使用
- [ ] スクショにキャッチコピーを入れる（撮影後）
- [x] 適切なカテゴリ選択

## 6. リリース後の見直し
- [ ] 「カップル 家計簿」「同棲 家計簿」での順位を確認
- [ ] 競合 "We Budget: カップル家計簿" とのキーワード被りを分析
- [ ] レビュー内の語をキーワードに反映
