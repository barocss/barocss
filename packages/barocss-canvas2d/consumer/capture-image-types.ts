import { Canvas2DRenderer as CompiledRenderer } from '../dist/index.js';
import type { ImageAssetInput as CompiledImage } from '../dist/index.js';
import { Canvas2DRenderer as SourceRenderer } from '../src/index.js';
import type { ImageAssetInput as SourceImage } from '../src/index.js';
export function captureImagePublicTypes(compiled: CompiledRenderer, source: SourceRenderer) {
  const compiledImage: CompiledImage = compiled.captureImageAsset();
  const sourceImage: SourceImage = source.captureImageAsset();
  const compatible: CompiledImage = sourceImage;
  const pixels: Uint8Array = compiledImage.pixels;
  const size: { width: number; height: number } = sourceImage;
  // @ts-expect-error Capture has no crop or resize options.
  compiled.captureImageAsset({ width: 10 });
  // @ts-expect-error The source method has no input options.
  source.captureImageAsset(null);
  // @ts-expect-error Capture is synchronous and returns an ImageAssetInput.
  const promise: Promise<CompiledImage> = compiled.captureImageAsset();
  void promise;
  return { compiledImage, sourceImage, compatible, pixels, size };
}
