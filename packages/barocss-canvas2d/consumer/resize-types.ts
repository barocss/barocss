import { resizeImageAsset as compiledResize } from '../dist/index.js';
import type { ImageResizeSampling, ImageAssetInput } from '../dist/index.js';
import { resizeImageAsset as sourceResize } from '../src/index.js';
import type { ImageResizeSampling as SourceSampling, ImageAssetInput as SourceImage } from '../src/index.js';
export function resizePublicTypes(asset: ImageAssetInput) {
  const sampling: ImageResizeSampling = 'linear';
  const sourceSampling: SourceSampling = sampling;
  const compiled: ImageAssetInput = compiledResize(asset, 63, 31, sampling);
  const source: SourceImage = sourceResize(asset, 63, 31, sourceSampling);
  const compatible: ImageAssetInput = source;
  // @ts-expect-error Sampling is required.
  compiledResize(asset, 10, 10);
  // @ts-expect-error Only nearest and linear modes are supported.
  const unsupported: ImageResizeSampling = 'cubic';
  // @ts-expect-error Destination dimensions must be numbers.
  sourceResize(asset, '10', 10, 'nearest');
  // @ts-expect-error Pixels must be RGBA8 bytes.
  compiledResize({ width: 1, height: 1, pixels: [0, 0, 0, 0] }, 1, 1, 'linear');
  // @ts-expect-error Resize preparation is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledResize(asset, 1, 1, sampling);
  void [unsupported, asynchronous];
  return { compiled, source, compatible };
}
