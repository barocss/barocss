import { downsampleImageAsset, type ImageAssetInput } from '../src/index.js';
import { downsampleImageAsset as emittedDownsample } from '../dist/index.js';
export function imageDownsampleTypes(asset: ImageAssetInput): ImageAssetInput {
  const source: ImageAssetInput = downsampleImageAsset(asset, 1, 1);
  const emitted: ImageAssetInput = emittedDownsample(asset, 1, 1);
  // @ts-expect-error Both dimensions are required.
  downsampleImageAsset(asset, 1);
  // @ts-expect-error Dimensions must be numbers.
  emittedDownsample(asset, '1', 1);
  // @ts-expect-error Preparation is synchronous.
  const promise: Promise<ImageAssetInput> = downsampleImageAsset(asset, 1, 1);
  void emitted; void promise; return source;
}
