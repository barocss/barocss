import {mountMixedDepthScene,type MixedDepthRenderer} from '@barocss/gpu';
import type {PreparedRenderMixedDocument} from './mixed-frame.js';
import type {RenderMixedPresenter,RenderMixedPresentationResult} from './mixed-controller.js';
/** Own only the public mixed renderer and this adapter's context-loss listener. */
export function createMixedViewportPresenter(canvas:HTMLCanvasElement,onUnavailable?:(error:Error)=>void):RenderMixedPresenter&{resize(width:number,height:number):RenderMixedPresentationResult;readPixels():Uint8Array} {
  let renderer:MixedDepthRenderer|null=null,disposed=false;
  const error=(cause:unknown)=>cause instanceof Error?cause:new Error('Mixed preview failed.');
  const live=()=>{try{renderer!.readPixels();return true;}catch{return false;}};
  const refusal=(cause:unknown,retained=live()):RenderMixedPresentationResult=>({ok:false,error:error(cause),retained});
  const loss=(event:Event)=>{event.preventDefault();renderer?.dispose();renderer=null;onUnavailable?.(new Error('The display context was lost.'));};
  canvas.addEventListener('webglcontextlost',loss);
  return{
    present(prepared:PreparedRenderMixedDocument){if(disposed||!renderer)return refusal(new Error('Mixed preview is unavailable.'),false);try{const result=renderer.updateFrame(prepared.frame);return result.ok?result:refusal(result.error);}catch(cause){return refusal(cause,false);}},
    recover(prepared){if(disposed)return refusal(new Error('Mixed viewport is disposed.'),false);renderer?.dispose();renderer=null;try{renderer=mountMixedDepthScene(canvas,prepared.frame);return{ok:true};}catch(cause){return refusal(cause,false);}},
    resize(width,height){if(!renderer||disposed)return refusal(new Error('Mixed preview is unavailable.'),false);const result=renderer.resize(width,height);if(result.ok)return result;const retained=live();if(!retained)onUnavailable?.(result.error);return refusal(result.error,retained);},
    readPixels(){if(!renderer)throw new Error('Mixed preview is unavailable.');return renderer.readPixels();},
    dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',loss);renderer?.dispose();renderer=null;}
  };
}
