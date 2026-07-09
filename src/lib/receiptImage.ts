/**
 * レシート画像の前処理。
 * OCRには撮影した最高画質の画像をそのまま使い（JPEG圧縮ノイズは細かい文字を潰す）、
 * Storage へのアップロード用には縮小・再圧縮した別ファイルを作って通信量・容量を抑える。
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageUpload } from '@/data';

/** アップロード画像の長辺上限（あとで見返して文字が読める程度は保つ）。 */
const MAX_UPLOAD_DIMENSION = 1600;
/** アップロード画像のJPEG品質。 */
const UPLOAD_JPEG_QUALITY = 0.7;

/** ImagePicker が返す asset のうち、ここで使う最小限。 */
interface CapturedAsset {
  uri: string;
  width?: number;
  height?: number;
  base64?: string | null;
  mimeType?: string;
}

/**
 * 撮影画像からアップロード用の縮小版（base64つき）を作る。
 * 縮小に失敗した場合は撮影時の base64 があればそれを使い、無ければ null
 * （レシート画像なしで支出だけ保存できる）。
 */
export async function prepareReceiptUpload(asset: CapturedAsset): Promise<ImageUpload | null> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    if (Math.max(w, h) > MAX_UPLOAD_DIMENSION) {
      context.resize(w >= h ? { width: MAX_UPLOAD_DIMENSION } : { height: MAX_UPLOAD_DIMENSION });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: UPLOAD_JPEG_QUALITY,
      base64: true,
    });
    if (!saved.base64) throw new Error('base64 missing');
    return { uri: saved.uri, base64: saved.base64, contentType: 'image/jpeg' };
  } catch {
    if (asset.base64) {
      return { uri: asset.uri, base64: asset.base64, contentType: asset.mimeType ?? 'image/jpeg' };
    }
    return null;
  }
}
