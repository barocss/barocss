import { trimImageAsset as compiled } from '../dist/index.js';
import type { TrimmedImageAsset, ImageAssetInput } from '../dist/index.js';
import { trimImageAsset as source } from '../src/index.js';
import type { TrimmedImageAsset as SourceTrim } from '../src/index.js';
export function trimPublicTypes(asset: ImageAssetInput) {
 const emitted: TrimmedImageAsset|null=compiled(asset);
 const original: SourceTrim|null=source(asset);
 const compatible: TrimmedImageAsset|null=original;
 if(emitted){const pixels:Uint8Array=emitted.asset.pixels;const offsets:number[]=[emitted.offsetX,emitted.offsetY];void [pixels,offsets];}
 // @ts-expect-error Alpha threshold options do not exist.
 compiled(asset,1);
 // @ts-expect-error Pixel input must be Uint8Array.
 source({width:1,height:1,pixels:[1,2,3,4]});
 // @ts-expect-error A valid fully transparent image can return null.
 const nonnullable:TrimmedImageAsset=compiled(asset);
 // @ts-expect-error Trimming is synchronous.
 const asynchronous:Promise<TrimmedImageAsset|null>=source(asset);
 return {emitted,original,compatible,nonnullable,asynchronous};
}
