import { rotateImageAsset as compiledRotate } from '../dist/index.js';
import type { ImageAssetInput, ImageQuarterTurns } from '../dist/index.js';
import { rotateImageAsset as sourceRotate } from '../src/index.js';
import type { ImageQuarterTurns as SourceTurns } from '../src/index.js';
export function imageRotatePublicTypes(asset: ImageAssetInput, turns: ImageQuarterTurns) {
  const sourceTurns: SourceTurns = turns;
  const compiled: ImageAssetInput = compiledRotate(asset, turns);
  const source: ImageAssetInput = sourceRotate(asset, sourceTurns);
  // @ts-expect-error Both arguments are required.
  compiledRotate(asset);
  // @ts-expect-error Only quarter turns are accepted.
  sourceRotate(asset, 4);
  // @ts-expect-error The helper is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledRotate(asset, 0);
  // @ts-expect-error Turns are numeric literals.
  compiledRotate(asset, '1');
  void asynchronous;
  return { compiled, source };
}
