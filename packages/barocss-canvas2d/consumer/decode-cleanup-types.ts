import { decodeImageBlob as compiledDecode } from '../dist/index.js';
import type { ImageAssetInput } from '../dist/index.js';
import { decodeImageBlob as sourceDecode } from '../src/index.js';
import type { ImageAssetInput as SourceImage } from '../src/index.js';
export async function decodeCleanupPublicTypes(blob: Blob) {
  const compiledPromise: Promise<ImageAssetInput> = compiledDecode(blob);
  const sourcePromise: Promise<SourceImage> = sourceDecode(blob);
  const compiled: ImageAssetInput = await compiledPromise;
  const source: ImageAssetInput = await sourcePromise;
  const pixels: Uint8Array = compiled.pixels;
  // @ts-expect-error The decoder requires a Blob.
  compiledDecode(new Uint8Array(4));
  // @ts-expect-error The source decoder requires one Blob argument.
  sourceDecode();
  // @ts-expect-error The existing API remains asynchronous.
  const synchronous: ImageAssetInput = compiledDecode(blob);
  void synchronous;
  return { compiled, source, pixels };
}
