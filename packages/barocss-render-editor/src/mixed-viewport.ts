import {showScene,type SceneView,type Viewer} from '@barocss/gpu';
import type {Mesh} from '@barocss/gpu';
import type {PreparedRenderMixedDocument} from './mixed-frame.js';
import type {RenderMixedPresenter,RenderMixedPresentationResult} from './mixed-controller.js';
import {applySceneCamera} from './scene-viewport.js';
/** The mixed preview on a viewer: the scene's Sphere and the original Surface, sharing one depth. */
export function createMixedViewportPresenter(viewer:Viewer):RenderMixedPresenter&{resize(width:number,height:number):RenderMixedPresentationResult;readPixels():Promise<Uint8Array>} {
  let view:SceneView|null=null,surface:Mesh|null=null,disposed=false;
  const error=(cause:unknown)=>cause instanceof Error?cause:new Error('Mixed preview failed.');
  const live=()=>!disposed&&view!==null&&viewer.ready;
  const refusal=(cause:unknown,retained=live()):RenderMixedPresentationResult=>({ok:false,error:error(cause),retained});
  /** The Surface packet in scene units (millimetres scaled, then moved), coloured as authored. */
  const showSurface=(prepared:PreparedRenderMixedDocument)=>{
    const f=prepared.frame,p=f.surface.packet,k=f.mmToSceneUnit,t=f.translate;
    const positions=Float32Array.from(p.positions,(v,i)=>v*k+t[i%3]);
    const next=viewer.add({positions,normals:p.normals,indices:p.indices},{name:prepared.metadata.surfaceId,material:{color:f.surface.color as [number,number,number],doubleSided:true}});
    surface?.remove();surface?.geometry.dispose();surface=next;
  };
  const show=(prepared:PreparedRenderMixedDocument):RenderMixedPresentationResult=>{
    const result=view!.update(prepared.frame.source);
    if(!result.ok)return refusal(new Error(result.diagnostics.map(d=>d.message).join('; ')||'The mixed source was refused.'));
    showSurface(prepared);applySceneCamera(viewer,prepared.frame.camera);return{ok:true};
  };
  return{
    present(prepared:PreparedRenderMixedDocument){if(disposed||!view)return refusal(new Error('Mixed preview is unavailable.'),false);try{return show(prepared);}catch(cause){return refusal(cause,false);}},
    recover(prepared){if(disposed)return refusal(new Error('Mixed viewport is disposed.'),false);view?.dispose();view=null;try{view=showScene(viewer,prepared.frame.source,{fit:false});showSurface(prepared);applySceneCamera(viewer,prepared.frame.camera);return{ok:true};}catch(cause){view?.dispose();view=null;return refusal(cause,false);}},
    resize(width,height){if(disposed)return refusal(new Error('Mixed preview is unavailable.'),false);viewer.setSize(width,height);return{ok:true};},
    async readPixels(){if(!live())throw new Error('Mixed preview is unavailable.');return(await viewer.capture()).data;},
    dispose(){if(disposed)return;disposed=true;view?.dispose();view=null;surface?.remove();surface?.geometry.dispose();surface=null;viewer.dispose();}
  };
}
