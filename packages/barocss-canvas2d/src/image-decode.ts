import { Canvas2DError } from './schema.js';
import type { ImageAssetInput } from './schema.js';

const maxEncodedBytes = 8 * 1024 * 1024;
const maxDecodedBytes = 32 * 1024 * 1024;
const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function decodeImageBlob(blob: Blob): Promise<ImageAssetInput> {
  if (typeof Blob !== 'function' || !(blob instanceof Blob) || blob.size === 0) {
    throw new Canvas2DError('INVALID_ASSET', 'image source must be a nonempty Blob');
  }
  if (!rasterTypes.has(blob.type)) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'image MIME type is unsupported');
  }
  if (blob.size > maxEncodedBytes) {
    throw new Canvas2DError('ASSET_LIMIT', 'encoded image exceeds 8 MiB');
  }
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined' ||
      typeof document.createElement !== 'function') {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'browser image decoding is unavailable');
  }

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { throw new Canvas2DError('INVALID_ASSET', 'browser could not decode image'); }
  let canvas: HTMLCanvasElement | undefined;
  try {
    const { width, height } = bitmap;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Canvas2DError('INVALID_ASSET', 'decoded image dimensions are invalid');
    }
    if (width > 4096 || height > 4096 || width * height * 4 > maxDecodedBytes) {
      throw new Canvas2DError('ASSET_LIMIT', 'decoded image exceeds asset limits');
    }
    canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Canvas2DError('UNSUPPORTED_FEATURE', '2D canvas is unavailable');
    try {
      context.drawImage(bitmap, 0, 0);
      const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
      return { width, height, pixels };
    } catch {
      throw new Canvas2DError('INVALID_ASSET', 'browser could not read decoded image pixels');
    }
  } finally {
    try {
      if (canvas) {
        try { canvas.width = 0; }
        finally { canvas.height = 0; }
      }
    } finally { bitmap.close(); }
  }
}
