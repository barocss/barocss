import { blurImageAsset as compiledBlur } from '../dist/index.js';
import type { ImageAssetInput as CompiledImage } from '../dist/index.js';
import { blurImageAsset as sourceBlur } from '../src/index.js';
import type { ImageAssetInput as SourceImage } from '../src/index.js';
export function imageBlurPublicTypes(asset: CompiledImage) {
  const compiled: CompiledImage = compiledBlur(asset, 2);
  const source: SourceImage = sourceBlur(asset, 0);
  const compatible: CompiledImage = source;
  const bytes: Uint8Array = compiled.pixels;
  // @ts-expect-error A numeric radius is required.
  compiledBlur(asset);
  // @ts-expect-error Radius strings are not accepted.
  sourceBlur(asset, '2');
  // @ts-expect-error The input needs RGBA8 bytes.
  compiledBlur({ width: 1, height: 1, pixels: [0, 0, 0, 0] }, 1);
  // @ts-expect-error The helper is synchronous.
  const asynchronous: Promise<CompiledImage> = compiledBlur(asset, 1);
  void asynchronous;
  return { compiled, source, compatible, bytes };
}
