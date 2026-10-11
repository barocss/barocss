import { applyImageColorKey as source } from '../src/index.js';
import { applyImageColorKey as emitted } from '../dist/index.js';
import type { ImageRGBKey, ImageAssetInput } from '../src/index.js';
import type { ImageRGBKey as EmittedKey, ImageAssetInput as EmittedAsset } from '../dist/index.js';
const sourceAPI:(a:ImageAssetInput,k:ImageRGBKey,t:number)=>ImageAssetInput=source;
const emittedAPI:(a:EmittedAsset,k:EmittedKey,t:number)=>EmittedAsset=emitted;
void [sourceAPI,emittedAPI];
// @ts-expect-error required tolerance
source({width:1,height:1,pixels:new Uint8Array(4)},[0,0,0]);
// @ts-expect-error exactly three key channels
emitted({width:1,height:1,pixels:new Uint8Array(4)},[0,0,0,0],0);
// @ts-expect-error synchronous asset, not promise
const asyncResult:Promise<ImageAssetInput> = source({width:1,height:1,pixels:new Uint8Array(4)},[0,0,0],0);
