import { applyImageAlphaMatte as compiled } from '../dist/index.js';
import type { ImageAssetInput } from '../dist/index.js';
import { applyImageAlphaMatte as source } from '../src/index.js';
export function mattePublicTypes(asset:ImageAssetInput, matte:ImageAssetInput){
 const emitted:ImageAssetInput=compiled(asset,matte);const original:ImageAssetInput=source(asset,matte);
 // @ts-expect-error A matte is required.
 compiled(asset);
 // @ts-expect-error A scalar is not an image matte.
 source(asset,0.5);
 // @ts-expect-error Pixels must use Uint8Array.
 compiled({width:1,height:1,pixels:[1,2,3,4]},matte);
 // @ts-expect-error Preparation is synchronous.
 const asynchronous:Promise<ImageAssetInput>=source(asset,matte);
 return {emitted,original,asynchronous};
}
