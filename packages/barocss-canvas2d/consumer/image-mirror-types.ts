import { mirrorImageAsset as compiledMirror } from '../dist/index.js';
import type { ImageMirrorAxis, ImageAssetInput } from '../dist/index.js';
import { mirrorImageAsset as sourceMirror } from '../src/index.js';
import type { ImageMirrorAxis as SourceAxis, ImageAssetInput as SourceImage } from '../src/index.js';
export function mirrorPublicTypes(asset: ImageAssetInput) {
  const axis: ImageMirrorAxis = 'horizontal';
  const sourceAxis: SourceAxis = 'vertical';
  const compiled: ImageAssetInput = compiledMirror(asset, axis);
  const source: SourceImage = sourceMirror(asset, sourceAxis);
  const compatible: ImageAssetInput = source;
  // @ts-expect-error Axis is required.
  compiledMirror(asset);
  // @ts-expect-error Only horizontal and vertical are accepted.
  sourceMirror(asset, 'both');
  // @ts-expect-error Pixel storage must be a Uint8Array.
  compiledMirror({ width: 1, height: 1, pixels: [1, 2, 3, 4] }, axis);
  // @ts-expect-error Pixel preparation is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledMirror(asset, axis);
  return { compiled, source, compatible, asynchronous };
}
