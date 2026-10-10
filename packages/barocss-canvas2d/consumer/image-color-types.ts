import { applyImageRGBMatrix as compiled } from '../dist/index.js';
import type { SpriteRGBMatrix, ImageAssetInput } from '../dist/index.js';
import { applyImageRGBMatrix as source } from '../src/index.js';
import type { SpriteRGBMatrix as SourceParameter, ImageAssetInput as SourceImage } from '../src/index.js';
export function publicTypes(asset: ImageAssetInput) {
  const parameter: SpriteRGBMatrix = [1,0,0,0,0,1,0,0,0,0,1,0];
  const sourceParameter: SourceParameter = parameter;
  const emitted: ImageAssetInput = compiled(asset, parameter);
  const original: SourceImage = source(asset, sourceParameter);
  const compatible: ImageAssetInput = original;
  // @ts-expect-error The second argument is required.
  compiled(asset);
  // @ts-expect-error The second argument has a fixed shape.
  source(asset, [1,0,0]);
  // @ts-expect-error Pixels must use Uint8Array.
  compiled({ width: 1, height: 1, pixels: [1,2,3,4] }, parameter);
  // @ts-expect-error Preparation returns synchronously.
  const asynchronous: Promise<ImageAssetInput> = compiled(asset, parameter);
  return { emitted, original, compatible, asynchronous };
}
