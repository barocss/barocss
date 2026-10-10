import { applyImageAlphaMask as compiled } from '../dist/index.js';
import type { SpriteAlphaMask, ImageAssetInput } from '../dist/index.js';
import { applyImageAlphaMask as source } from '../src/index.js';
import type { SpriteAlphaMask as SourceMask } from '../src/index.js';
export function maskPublicTypes(asset:ImageAssetInput){
 const mask:SpriteAlphaMask=[0,0,0,0.5];const sourceMask:SourceMask=mask;
 const emitted:ImageAssetInput=compiled(asset,mask);const original:ImageAssetInput=source(asset,sourceMask);
 // @ts-expect-error A mask is required.
 compiled(asset);
 // @ts-expect-error Four mask coefficients are required.
 source(asset,[1,0,0]);
 // @ts-expect-error Pixels must use Uint8Array.
 compiled({width:1,height:1,pixels:[1,2,3,4]},mask);
 // @ts-expect-error Preparation is synchronous.
 const asynchronous:Promise<ImageAssetInput>=source(asset,mask);
 return {emitted,original,asynchronous};
}
