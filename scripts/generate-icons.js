/**
 * アイコン生成: assets/icon-source.png（マスター画像）→ 必要な PNG を出力する。
 * 画像を差し替えたら `node scripts/generate-icons.js` で全PNGを再生成。
 *
 * 出力:
 *  - icon.png            1024 不透明（iOS/汎用アイコン。App Store要件でアルファ無し）
 *  - adaptive-icon.png   1024 透過・余白付き（Android適応アイコンの前景。マスクで欠けない）
 *  - splash-icon.png     1024 透過・余白付き（スプラッシュのロゴ）
 *  - favicon.png         48   不透明（web）
 */
const path = require('path');
const sharp = require('sharp');

const A = path.join(__dirname, '..', 'assets');
const SOURCE = path.join(A, 'icon-source.png');
/** マスター画像の背景色（四隅からサンプル）。スプラッシュ/Android背景色と一致させる。 */
const BG = '#F86F50';

/** 不透明の正方形アイコン（アルファ除去）。 */
async function opaqueIcon(out, size) {
  await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: BG }) // アルファ除去（App Store要件）
    .png()
    .toFile(path.join(A, out));
  console.log('  ✓', out, `(${size}px, opaque)`);
}

/** 透過・余白付き前景（Android適応/スプラッシュ用。マスクで内容が欠けないよう内側に縮小）。 */
async function paddedForeground(out, size, contentRatio = 0.8) {
  const inner = Math.round(size * contentRatio);
  const pad = Math.round((size - inner) / 2);
  await sharp(SOURCE)
    .resize(inner, inner, { fit: 'cover' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(A, out));
  console.log('  ✓', out, `(${size}px, padded transparent)`);
}

(async () => {
  console.log('Generating icons from icon-source.png...');
  await opaqueIcon('icon.png', 1024);
  await paddedForeground('adaptive-icon.png', 1024);
  await paddedForeground('splash-icon.png', 1024);
  await opaqueIcon('favicon.png', 48);
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
