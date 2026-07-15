/**
 * App Store 用スクリーンショットの量産スクリプト。
 *
 * 実スクショを一切改変せず（拡大縮小と角丸のみ）、背景グラデーションと見出しだけを合成する。
 * → App Store Guideline 2.3.3「スクショは実際の画面と一致」を確実に満たすため、
 *   AI による再描画は使わない。
 *
 * 入力:  assets/store/raw/<lang>-<device>/<n>.png   例: raw/ja-iphone/1.png
 * 出力:  assets/store/out/<lang>-<device>/<n>.png   （提出サイズちょうどで書き出し）
 *
 * 使い方:
 *   node scripts/make-store-screenshots.js            # 全部
 *   node scripts/make-store-screenshots.js ja-iphone  # 特定セットだけ
 *
 * 見出し文言の出典: docs/aso_plan.md / docs/screenshot_plan.md
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAW_DIR = path.join(__dirname, '..', 'assets', 'store', 'raw');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'store', 'out');

/**
 * 提出サイズ。ここちょうどで書き出す。
 *
 * ⚠️ 要求サイズは App Store Connect の画面で必ず確認すること。
 *    「6.9インチ(1290×2796)が必須」とは限らない。本アプリの ASC は
 *    iPhone が 6.5インチ(1284×2778)スロットしか出さなかった（2026-07-15 実測）。
 */
const DEVICES = {
  iphone: { w: 1284, h: 2778 }, // 6.5インチ iPhone（ASCの要求に合わせた）
  ipad: { w: 2048, h: 2732 }, // 12.9インチ iPad
};

/**
 * ブランド。docs/ui/colors.md 由来。
 * bgBottom は白にしない: アプリ画面が白基調のため、白背景だとスクショの輪郭が消える。
 */
const BRAND = {
  coral: '#F86F50',
  bgTop: '#F5613F',
  bgBottom: '#FFDCD1',
  title: '#2B2B2B',
  sub: '#5C5C5C',
};

/**
 * フォントは実名で指定する。generic な sans-serif はセリフ体に化けるため使わない
 * （Windows + librsvg で確認済み）。
 */
const FONT_JA = 'Yu Gothic UI, Yu Gothic, Meiryo, Hiragino Sans';
const FONT_EN = 'Segoe UI, Yu Gothic UI, Helvetica Neue, Arial';

/** 各枚の見出し。docs/screenshot_plan.md A章と一致させる。並び順＝ファイル名の 1〜7。 */
const COPY = {
  ja: [
    { main: '2人の支出、ひと目でわかる', sub: '今月いくら？立替は？予算は？' },
    { main: '"誰がいくら"で、もう揉めない', sub: '立替は自動計算、精算はワンタップ' },
    { main: 'レシートは、撮るだけ', sub: '端末内で読み取り、画像も外部に送りません' },
    { main: '何に使ったか、まる見え', sub: 'カテゴリ別に自動で集計' },
    { main: '使いすぎる前に、お知らせ', sub: '予算の80%・100%でアラート' },
    { main: '家賃も光熱費も、入力いらず', sub: '固定費は自動計上、変動費はリマインド' },
    { main: '共同口座も、まとめて管理', sub: '入金・残高・支出をひとつに' },
  ],
  en: [
    { main: 'Your shared money, at a glance', sub: 'Spending, balance and budget in one place' },
    { main: 'Who owes what — settled in one tap', sub: 'Balances calculated automatically' },
    { main: 'Just snap the receipt', sub: 'Read on-device. Your image is never sent for OCR' },
    { main: 'See exactly where it goes', sub: 'Automatic category breakdown' },
    { main: 'Know before you overspend', sub: 'Alerts at 80% and 100% of budget' },
    { main: 'Bills on autopilot', sub: 'Fixed costs post themselves. Variable ones remind you' },
    { main: 'Track your joint account too', sub: 'Deposits, balance and spending in one place' },
  ],
};

/** XML特殊文字のエスケープ（&, <, >, ", '）。見出しの引用符が SVG を壊さないように。 */
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/**
 * 見出しの表示幅をざっくり見積もる（CJKは全角=1.0em、半角=0.55em換算）。
 * はみ出す場合にフォントサイズを自動で縮めるために使う。
 */
function estimateWidth(text, fontSize) {
  let units = 0;
  for (const ch of text) {
    units += /[　-鿿＀-￯]/.test(ch) ? 1.0 : 0.55;
  }
  return units * fontSize;
}

/** maxWidth に収まるフォントサイズへ縮める。 */
function fitFontSize(text, initial, maxWidth, min = 24) {
  let size = initial;
  while (size > min && estimateWidth(text, size) > maxWidth) size -= 2;
  return size;
}

/** 背景グラデーション + 見出しの SVG を作る。 */
function buildBackdrop({ w, h }, copy, font, layout) {
  const maxTextW = w * 0.86;
  const mainSize = fitFontSize(copy.main, layout.mainSize, maxTextW);
  const subSize = fitFontSize(copy.sub, layout.subSize, maxTextW);

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND.bgTop}"/>
      <stop offset="55%" stop-color="${BRAND.bgBottom}"/>
      <stop offset="100%" stop-color="${BRAND.bgBottom}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <text x="${w / 2}" y="${layout.mainY}" text-anchor="middle"
        font-family="${font}" font-size="${mainSize}" font-weight="bold" fill="#FFFFFF">${esc(copy.main)}</text>
  <text x="${w / 2}" y="${layout.subY}" text-anchor="middle"
        font-family="${font}" font-size="${subSize}" fill="#FFFFFF" opacity="0.92">${esc(copy.sub)}</text>
</svg>`);
}

/** 角丸マスクの SVG（dest-in 合成用。塗り色は不問だが不透明であること）。 */
function buildRoundedMask(w, h, r) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
}

/** 影の元になる黒の角丸（白マスクを流用すると白い影になって見えないので分ける）。 */
function buildShadowShape(w, h, r) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000000" fill-opacity="0.38"/></svg>`
  );
}

/** 端末ごとのレイアウト（見出し位置とスクショ枠）。 */
function layoutFor(device, canvas) {
  if (device === 'ipad') {
    // iPad は縦横比が正方形寄りなので、幅を広めに取らないと下に死んだ余白が出る。
    return {
      mainY: Math.round(canvas.h * 0.072),
      subY: Math.round(canvas.h * 0.108),
      mainSize: 92,
      subSize: 50,
      shotTop: Math.round(canvas.h * 0.15),
      shotMaxW: Math.round(canvas.w * 0.78),
      shotBottomPad: Math.round(canvas.h * 0.05),
      radius: 28,
    };
  }
  return {
    mainY: Math.round(canvas.h * 0.075),
    subY: Math.round(canvas.h * 0.108),
    mainSize: 74,
    subSize: 40,
    shotTop: Math.round(canvas.h * 0.15),
    shotMaxW: Math.round(canvas.w * 0.8),
    shotBottomPad: Math.round(canvas.h * 0.045),
    radius: 44,
  };
}

/** 1枚を合成する。 */
async function compose(rawPath, outPath, device, lang, index) {
  const canvas = DEVICES[device];
  const layout = layoutFor(device, canvas);
  const copy = COPY[lang][index - 1];
  if (!copy) throw new Error(`見出しが未定義: ${lang} の ${index}枚目（COPY に追加してください）`);

  const shot = sharp(rawPath);
  const meta = await shot.metadata();

  // アスペクト比を保ったまま、見出しの下の空き枠に収める（実スクショは歪ませない）
  const availH = canvas.h - layout.shotTop - layout.shotBottomPad;
  const scale = Math.min(layout.shotMaxW / meta.width, availH / meta.height);
  const sw = Math.round(meta.width * scale);
  const sh = Math.round(meta.height * scale);

  const resized = await shot.resize(sw, sh, { fit: 'fill' }).png().toBuffer();

  // 角丸だけ付与（中身のピクセルは触らない）
  const rounded = await sharp(resized)
    .composite([{ input: buildRoundedMask(sw, sh, layout.radius), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const left = Math.round((canvas.w - sw) / 2);
  const top = layout.shotTop;

  // 影。ぼかしが端で切れないよう、上下左右に余白を取った面に黒の角丸を描いてから blur する。
  const pad = 60;
  const shadow = await sharp({
    create: { width: sw + pad * 2, height: sh + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: buildShadowShape(sw, sh, layout.radius), left: pad, top: pad }])
    .blur(26)
    .png()
    .toBuffer();

  await sharp(buildBackdrop(canvas, copy, lang === 'ja' ? FONT_JA : FONT_EN, layout))
    .composite([
      { input: shadow, left: left - pad, top: top - pad + 16, blend: 'over' },
      { input: rounded, left, top, blend: 'over' },
    ])
    .png()
    .toFile(outPath);

  return { sw, sh, canvas };
}

async function main() {
  const only = process.argv[2];
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`入力フォルダがありません: ${RAW_DIR}`);
    process.exit(1);
  }

  const sets = fs
    .readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !only || n === only);

  if (sets.length === 0) {
    console.error(`処理対象がありません。assets/store/raw/<lang>-<device>/ に画像を置いてください（例: ja-iphone/1.png）`);
    process.exit(1);
  }

  let count = 0;
  for (const set of sets) {
    const [lang, device] = set.split('-');
    if (!COPY[lang] || !DEVICES[device]) {
      console.warn(`スキップ: ${set}（命名は <ja|en>-<iphone|ipad> にしてください）`);
      continue;
    }

    const outSet = path.join(OUT_DIR, set);
    fs.mkdirSync(outSet, { recursive: true });

    const files = fs
      .readdirSync(path.join(RAW_DIR, set))
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    for (const f of files) {
      const index = parseInt(f, 10);
      if (!index) {
        console.warn(`スキップ: ${set}/${f}（ファイル名を 1.png 〜 5.png にしてください）`);
        continue;
      }
      const outPath = path.join(outSet, `${index}.png`);
      const r = await compose(path.join(RAW_DIR, set, f), outPath, device, lang, index);
      console.log(`✓ ${set}/${index}.png  → ${r.canvas.w}x${r.canvas.h}（スクショ ${r.sw}x${r.sh}）`);
      count++;
    }
  }
  console.log(`\n完了: ${count}枚を assets/store/out/ に出力しました。`);
}

main().catch((e) => {
  console.error('失敗:', e.message);
  process.exit(1);
});
