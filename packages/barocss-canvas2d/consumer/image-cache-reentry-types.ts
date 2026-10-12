import { createImageAssetCache as compiledCreate } from '../dist/index.js';
import type { ImageAssetCache, ImageAssetCacheOptions, ImageAssetInput } from '../dist/index.js';
import { createImageAssetCache as sourceCreate } from '../src/index.js';
import type { ImageAssetCache as SourceCache, ImageAssetCacheOptions as SourceOptions } from '../src/index.js';

// Compile-only compatibility consumer; these helpers are never executed.
export async function imageCachePublicTypes(fetcher: typeof fetch) {
  const options: ImageAssetCacheOptions = { maxEntries: 2, maxBytes: 32, fetcher };
  const sourceOptions: SourceOptions = options;
  const compiled: ImageAssetCache = compiledCreate(options);
  const source: SourceCache = sourceCreate(sourceOptions);
  try {
    const pending: Promise<ImageAssetInput> = compiled.load('https://example.test/a.png');
    const sourcePending: Promise<ImageAssetInput> = source.load('https://example.test/a.png#copy');
    const cached: ImageAssetInput | null = compiled.get('https://example.test/a.png');
    const removed: boolean = source.delete('https://example.test/a.png');
    const size: number = compiled.size;
    const bytes: number = source.byteLength;
    compiled.clear(); source.clear();
    // @ts-expect-error The URL remains required.
    compiled.load();
    // @ts-expect-error Cache load takes no per-call cancellation options.
    source.load('https://example.test/a.png', { signal: new AbortController().signal });
    // @ts-expect-error Cache loads remain asynchronous.
    const synchronous: ImageAssetInput = compiled.load('https://example.test/a.png');
    // @ts-expect-error Resident counters remain readonly.
    source.size = 0;
    // @ts-expect-error Resident byte accounting remains readonly.
    compiled.byteLength = 0;
    // @ts-expect-error No callback-timing or new cache options are exposed.
    sourceCreate({ schedule: 'microtask' });
    void synchronous;
    return { pending: await pending, sourcePending: await sourcePending, cached, removed, size, bytes };
  } finally {
    compiled.dispose(); source.dispose();
  }
}
