import { extrudeImageAsset as compiled } from '../dist/index.js';
import type { ImageAssetInput } from '../dist/index.js';
import { extrudeImageAsset as source } from '../src/index.js';
import type { ImageAssetInput as SourceAsset } from '../src/index.js';
export function extrusionPublicTypes(asset: ImageAssetInput, gutter: number) {
 const emitted: ImageAssetInput = compiled(asset,gutter);
 const original: SourceAsset = source(asset,gutter);
 const compatible: ImageAssetInput = original;
 const bytes: Uint8Array = emitted.pixels;
 // @ts-expect-error Required gutter has no default.
 compiled(asset);
 // @ts-expect-error Required asset and gutter have no default.
 source();
 // @ts-expect-error Gutter must be a number.
 source(asset,'1');
 // @ts-expect-error Pixel input must be Uint8Array.
 compiled({width:1,height:1,pixels:[1,2,3,4]},1);
 // @ts-expect-error Extrusion is synchronous.
 const asynchronous: Promise<ImageAssetInput> = source(asset,gutter);
 return {emitted,original,compatible,bytes,asynchronous};
}
