import { outlineImageAsset as compiled } from '../dist/index.js';
import type { ImageAssetInput, Color } from '../dist/index.js';
import { outlineImageAsset as source } from '../src/index.js';
export function outlinePublicTypes(asset:ImageAssetInput){
 const color:Color=[1,1,1,0.5];const emitted:ImageAssetInput=compiled(asset,1,color);const original:ImageAssetInput=source(asset,8,color);
 // @ts-expect-error Radius and color are required.
 compiled(asset);
 // @ts-expect-error Color is required.
 source(asset,1);
 // @ts-expect-error A four-channel Color is required.
 source(asset,1,[1,1,1]);
 // @ts-expect-error Pixels must use Uint8Array.
 compiled({width:1,height:1,pixels:[1,2,3,4]},1,color);
 // @ts-expect-error Preparation is synchronous.
 const asynchronous:Promise<ImageAssetInput>=source(asset,1,color);
 return {emitted,original,asynchronous};
}
