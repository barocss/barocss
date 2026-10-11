import type { ImageAssetInput, Canvas2DRenderer } from '../src/index.js';
import { decodeImageBlob as sourceDecode } from '../src/index.js';
import { decodeImageBlob as emittedDecode } from '../dist/index.js';
import { stageCanvasDocument as sourceStage } from '../src/document.js';
import { stageCanvasDocument as emittedStage } from '../dist/document.js';
const source: (blob: Blob) => Promise<ImageAssetInput> = sourceDecode;
const emitted: (blob: Blob) => Promise<ImageAssetInput> = emittedDecode;
const stageSource: typeof sourceStage = sourceStage;
const stageEmitted: (text:string,canvas:HTMLCanvasElement,options:Parameters<typeof emittedStage>[2]) => ReturnType<typeof emittedStage> = emittedStage;
type OwnedRenderer = Pick<Canvas2DRenderer,'setImageAsset'|'updateScene'|'render'|'dispose'>;
void [source,emitted,stageSource,stageEmitted];
// @ts-expect-error Blob input is required
sourceDecode();
// @ts-expect-error a string is not a Blob
emittedDecode('not a Blob');
