import { cropImageAsset as compiledCrop } from '../dist/index.js';
import type { ImageAssetInput, SourceRect } from '../dist/index.js';
import { cropImageAsset as sourceCrop } from '../src/index.js';
export function imageCropPublicTypes(asset: ImageAssetInput, rect: SourceRect) {
  const compiled: ImageAssetInput = compiledCrop(asset, rect);
  const source: ImageAssetInput = sourceCrop(asset, rect);
  const bytes: Uint8Array = compiled.pixels;
  // @ts-expect-error The source rectangle is required.
  compiledCrop(asset);
  // @ts-expect-error Normalized arrays are not SourceRect.
  sourceCrop(asset, [0, 0, 1, 1]);
  // @ts-expect-error Pixels must be Uint8Array.
  compiledCrop({ width: 1, height: 1, pixels: [0, 0, 0, 0] }, rect);
  // @ts-expect-error The helper is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledCrop(asset, rect);
  void asynchronous;
  return { compiled, source, bytes };
}
