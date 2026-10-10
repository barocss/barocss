import { packSpriteAtlas as compiledPack } from '../dist/index.js';
import type { SpriteAtlasImage, PackedSpriteAtlas, ImageAssetInput, SpriteAtlas } from '../dist/index.js';
import { packSpriteAtlas as sourcePack } from '../src/index.js';
import type { SpriteAtlasImage as SourceEntry, PackedSpriteAtlas as SourcePacked } from '../src/index.js';
export function packAtlasPublicTypes(asset: ImageAssetInput) {
  const images: readonly SpriteAtlasImage[] = [{ name: 'First', asset, durationMS: 40 }];
  const sourceImages: readonly SourceEntry[] = images;
  const result: PackedSpriteAtlas = compiledPack('Atlas', images, 64);
  const source: SourcePacked = sourcePack('SourceAtlas', sourceImages, 64);
  const catalog: SpriteAtlas = result.atlas;
  const bytes: Uint8Array = result.asset.pixels;
  result.asset.pixels[0] = 0;
  // @ts-expect-error The outer result is readonly.
  result.asset = asset;
  // @ts-expect-error Image entry fields are readonly.
  images[0].durationMS = 50;
  // @ts-expect-error maxWidth is required.
  compiledPack('Atlas', images);
  // @ts-expect-error Entries need an explicit integer duration field.
  sourcePack('Atlas', [{ name: 'First', asset }], 64);
  // @ts-expect-error Width is a number.
  compiledPack('Atlas', images, '64');
  return { result, source, catalog, bytes };
}
