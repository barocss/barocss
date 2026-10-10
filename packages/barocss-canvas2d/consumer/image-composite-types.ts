import { compositeImageAssets as compiledComposite } from '../dist/index.js';
import type { ImageAssetInput } from '../dist/index.js';
import { compositeImageAssets as sourceComposite } from '../src/index.js';
import type { ImageAssetInput as SourceImage } from '../src/index.js';
export function compositePublicTypes(background: ImageAssetInput, foreground: ImageAssetInput) {
  const compiled: ImageAssetInput = compiledComposite(background, foreground);
  const source: SourceImage = sourceComposite(background, foreground);
  const compatible: ImageAssetInput = source;
  // @ts-expect-error Both input images are required.
  compiledComposite(background);
  // @ts-expect-error The foreground must be an image asset.
  sourceComposite(background, 'foreground');
  // @ts-expect-error Pixel storage must be a Uint8Array.
  compiledComposite(background, { width: 1, height: 1, pixels: [1, 2, 3, 4] });
  // @ts-expect-error Composition is synchronous.
  const asynchronous: Promise<ImageAssetInput> = compiledComposite(background, foreground);
  return { compiled, source, compatible, asynchronous };
}
