/**
 * アイコン生成: assets/*.svg → 必要な PNG を出力する。
 * SVGを編集したら `node scripts/generate-icons.js` で全PNGを再生成。
 *
 * 出力:
 *  - icon.png            1024 不透明（iOS/汎用アイコン。App Store要件でアルファ無し）
 *  - adaptive-icon.png   1024 透過（Android適応アイコンの前景。背景色はapp.jsonで指定）
 *  - splash-icon.png     1024 透過（スプラッシュのロゴ）
 *  - favicon.png         48   透過（web）
 */
const path = require('path');
const sharp = require('sharp');

const A = path.join(__dirname, '..', 'assets');
const CORAL = '#E14B2E';

async function toPng(svg, out, size, { opaque = false } = {}) {
  let img = sharp(path.join(A, svg)).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (opaque) img = img.flatten({ background: CORAL }); // アルファ除去（App Store要件）
  await img.png().toFile(path.join(A, out));
  console.log('  ✓', out, `(${size}px)`);
}

(async () => {
  console.log('Generating icons...');
  await toPng('icon.svg', 'icon.png', 1024, { opaque: true });
  await toPng('adaptive-foreground.svg', 'adaptive-icon.png', 1024);
  await toPng('adaptive-foreground.svg', 'splash-icon.png', 1024);
  await toPng('icon.svg', 'favicon.png', 48, { opaque: true });
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
