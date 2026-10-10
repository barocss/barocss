import { shadowImageAsset as compiledShadow } from '../dist/index.js';
import type { ImageShadowOptions, ImageAssetInput } from '../dist/index.js';
import { shadowImageAsset as sourceShadow } from '../src/index.js';
import type { ImageShadowOptions as SourceOptions, ImageAssetInput as SourceImage } from '../src/index.js';
export function shadowPublicTypes(asset: ImageAssetInput) {
  const options: ImageShadowOptions = { radius: 2, offsetX: 6, offsetY: 4, color: [0.25, 0.5, 1, 0.75] };
  const sourceOptions: SourceOptions = options;
  const compiled: ImageAssetInput = compiledShadow(asset, options);
  const source: SourceImage = sourceShadow(asset, sourceOptions);
  const compatible: ImageAssetInput = source;
  // @ts-expect-error Shadow options are required.
  compiledShadow(asset);
  // @ts-expect-error Offsets are required.
  sourceShadow(asset, { radius: 2, color: [0, 0, 0, 1] });
  // @ts-expect-error Color requires four numeric components.
  compiledShadow(asset, { ...options, color: [0, 0, 0] });
  // @ts-expect-error The option record is readonly.
  options.offsetX = 1;
  // @ts-expect-error Shadow preparation is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledShadow(asset, options);
  void asynchronous;
  return { compiled, source, compatible };
}
