import { loadImageURL as compiledLoad } from '../dist/index.js';
import type { ImageURLLoadOptions, ImageAssetInput } from '../dist/index.js';
import { loadImageURL as sourceLoad } from '../src/index.js';
import type { ImageURLLoadOptions as SourceOptions, ImageAssetInput as SourceImage } from '../src/index.js';
export async function urlStreamPublicTypes(signal: AbortSignal, fetcher: typeof fetch) {
  const options: ImageURLLoadOptions = { signal, fetcher };
  const sourceOptions: SourceOptions = options;
  const compiledPromise: Promise<ImageAssetInput> = compiledLoad('https://example.test/image.png', options);
  const sourcePromise: Promise<SourceImage> = sourceLoad('https://example.test/image.png', sourceOptions);
  const compiled: ImageAssetInput = await compiledPromise;
  const source: ImageAssetInput = await sourcePromise;
  // @ts-expect-error The source argument remains a URL string.
  compiledLoad(new Blob(['image']));
  // @ts-expect-error Unknown options are not part of the public API.
  sourceLoad('https://example.test/image.png', { timeout: 100 });
  // @ts-expect-error The loader remains asynchronous.
  const synchronous: ImageAssetInput = compiledLoad('https://example.test/image.png');
  void synchronous;
  return { compiled, source };
}
