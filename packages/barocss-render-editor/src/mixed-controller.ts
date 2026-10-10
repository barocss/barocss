import {RenderMixedDocumentError} from './mixed-document.js';
import type {MeshCamera} from '@barocss/gpu';
import {prepareRenderMixedDocument} from './mixed-frame.js';
import type {PreparedRenderMixedDocument} from './mixed-frame.js';
import type {RenderMixedPreparedCandidate, RenderMixedSession, RenderMixedSessionSnapshot} from './mixed-session.js';

export type RenderMixedPresentationResult = {ok:true} | {ok:false;error:Error;retained:boolean};
export interface RenderMixedPresenter {
  present(prepared:PreparedRenderMixedDocument, previous:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  recover(prepared:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  dispose():void;
}
export interface RenderMixedControllerSnapshot {readonly presentedRevision:number|null;readonly presentationError:RenderMixedDocumentError|null;readonly cameraPreview:MeshCamera|null;readonly disposed:boolean}
export type RenderMixedActionResult = {ok:true}|{ok:false;error:RenderMixedDocumentError};
export interface RenderMixedController {
  readonly session:RenderMixedSession;
  getSnapshot():RenderMixedControllerSnapshot;
  subscribe(listener:()=>void):()=>void;
  attachPresenter(presenter:RenderMixedPresenter):RenderMixedActionResult;
  detachPresenter(presenter:RenderMixedPresenter):void;
  apply():RenderMixedActionResult;open(text:string):RenderMixedActionResult;undo():RenderMixedActionResult;redo():RenderMixedActionResult;recover():RenderMixedActionResult;
  previewCamera(camera:MeshCamera):RenderMixedActionResult;
  applyCameraPreview():RenderMixedActionResult;
  cancelCameraPreview():RenderMixedActionResult;
  presentationUnavailable(error:Error):void;dispose():void;
}
/** A complete mixed-frame presentation precedes accepted document/history changes. */
export function createRenderMixedController(session:RenderMixedSession, initial?:RenderMixedPresenter):RenderMixedController {
  let presenter:RenderMixedPresenter|null=null, visible:PreparedRenderMixedDocument|null=null, busy=false, viewEpoch=0;
  let previewBaseline:RenderMixedSessionSnapshot|null=null;
  let snapshot:RenderMixedControllerSnapshot=Object.freeze({presentedRevision:null,presentationError:null,cameraPreview:null,disposed:false});
  const listeners=new Set<()=>void>();
  const emit=(value:RenderMixedControllerSnapshot)=>{snapshot=Object.freeze(value);for(const listener of [...listeners]){try{listener();}catch{/* Observer errors cannot undo a visible commit. */}}};
  const check=()=>{if(snapshot.disposed)throw new RenderMixedDocumentError('INPUT','Mixed controller is disposed.');if(busy)throw new RenderMixedDocumentError('INPUT','Mixed presentation transaction is active.');};
  const failed=(error:unknown):RenderMixedActionResult=>({ok:false,error:error instanceof RenderMixedDocumentError?error:new RenderMixedDocumentError('GPU','The preview action failed.',error)});
  const unavailable=(cause:unknown,message='The preview is unavailable. Your applied scene is kept.')=>{
    viewEpoch++;visible=null;previewBaseline=null;
    const error=cause instanceof RenderMixedDocumentError?cause:new RenderMixedDocumentError('GPU',message,cause);
    emit({...snapshot,presentedRevision:null,presentationError:error,cameraPreview:null});
    return failed(error);
  };
  const present=(next:PreparedRenderMixedDocument,previous:PreparedRenderMixedDocument):RenderMixedActionResult=>{
    const epoch=viewEpoch;
    try{
      if(!presenter)throw new RenderMixedDocumentError('GPU','No mixed viewport is attached.');
      const result=presenter.present(next,previous);
      // A synchronous loss event overrides a stale successful presenter return.
      if(epoch!==viewEpoch)return failed(snapshot.presentationError??new RenderMixedDocumentError('GPU','The preview is unavailable.'));
      if(!result.ok){
        const error=new RenderMixedDocumentError('GPU',result.retained?'The update failed. The previous scene is still shown.':'The preview is unavailable.',result.error);
        if(!result.retained)return unavailable(error);
        emit({...snapshot,presentationError:error});return failed(error);
      }
      return{ok:true};
    }catch(cause){return unavailable(new RenderMixedDocumentError('GPU','The preview is unavailable.',cause));}
  };
  const restoreAccepted=():RenderMixedActionResult=>{
    if(!presenter||!visible)throw new RenderMixedDocumentError('GPU','Restore the preview before canceling the view.');
    const accepted=session.getSnapshot().prepared,result=present(accepted,visible);
    if(!result.ok)return result;
    visible=accepted;previewBaseline=null;
    emit({...snapshot,presentedRevision:accepted.document.revision,presentationError:null,cameraPreview:null});
    return{ok:true};
  };
  const checkPreviewBaseline=():RenderMixedSessionSnapshot=>{
    if(!snapshot.cameraPreview||!previewBaseline)throw new RenderMixedDocumentError('INPUT','There is no camera view to use.');
    if(previewBaseline!==session.getSnapshot())throw new RenderMixedDocumentError('INPUT','The scene or draft changed during view navigation. Cancel view before continuing.');
    return previewBaseline;
  };
  const run=(prepare:()=>RenderMixedPreparedCandidate|null):RenderMixedActionResult=>{
    try{
      check();if(snapshot.cameraPreview)throw new RenderMixedDocumentError('INPUT','Use view or Cancel view before applying other changes.');
      if(!presenter||visible!==session.getSnapshot().prepared)throw new RenderMixedDocumentError('GPU','Restore the preview before applying changes.');
      const candidate=prepare();if(!candidate)return{ok:true};const previous=session.getSnapshot().prepared;
      busy=true;
      try{session.commitPrepared(candidate,()=>{
        const result=present(candidate.prepared,previous);if(!result.ok)throw result.error;
      });}finally{busy=false;}
      visible=candidate.prepared;emit({...snapshot,presentedRevision:visible.document.revision,presentationError:null,cameraPreview:null});return{ok:true};
    }catch(error){return failed(error);}
  };
  const controller:RenderMixedController={session,getSnapshot:()=>snapshot,subscribe(listener){check();listeners.add(listener);return()=>{listeners.delete(listener);};},
    attachPresenter(next){try{check();if(presenter&&presenter!==next)throw new RenderMixedDocumentError('GPU','A mixed viewport is already attached.');presenter=next;return controller.recover();}catch(error){return failed(error);}},
    detachPresenter(next){if(presenter!==next)return;check();presenter=null;visible=null;previewBaseline=null;viewEpoch++;next.dispose();emit({...snapshot,presentedRevision:null,cameraPreview:null});},
    apply:()=>run(()=>session.prepareDraft()),open:text=>run(()=>session.prepareOpen(text)),undo:()=>run(()=>session.prepareUndo()),redo:()=>run(()=>session.prepareRedo()),
    previewCamera(camera){
      try{
        check();const baseline=snapshot.cameraPreview?checkPreviewBaseline():session.getSnapshot();
        if(baseline.disposed)throw new RenderMixedDocumentError('INPUT','Mixed session is disposed.');
        if(!presenter||!visible||(!snapshot.cameraPreview&&visible!==baseline.prepared))throw new RenderMixedDocumentError('GPU','Restore the preview before navigating the view.');
        const prepared=prepareRenderMixedDocument({...baseline.accepted,camera});
        busy=true;
        try{
          const result=present(prepared,visible);if(!result.ok)return result;
          if(session.getSnapshot().accepted!==baseline.accepted)return unavailable(new RenderMixedDocumentError('INPUT','The applied scene changed during view presentation. Restore the preview before continuing.'));
          visible=prepared;previewBaseline=baseline;
          emit({...snapshot,presentedRevision:prepared.document.revision,presentationError:null,cameraPreview:prepared.document.camera});
          if(session.getSnapshot()!==baseline)throw new RenderMixedDocumentError('INPUT','The scene or draft changed during view navigation. Cancel view before continuing.');
          return{ok:true};
        }finally{busy=false;}
      }catch(cause){return failed(cause);}
    },
    cancelCameraPreview(){
      try{check();if(!snapshot.cameraPreview)return{ok:true};busy=true;try{return restoreAccepted();}finally{busy=false;}}
      catch(cause){return failed(cause);}
    },
    applyCameraPreview(){
      try{
        check();const baseline=checkPreviewBaseline(),camera=snapshot.cameraPreview!;
        busy=true;
        try{
          const restored=restoreAccepted();if(!restored.ok)return restored;
          if(session.getSnapshot()!==baseline)throw new RenderMixedDocumentError('INPUT','The scene or draft changed before the camera view could be staged.');
          // Preserve every unrelated source/display/title draft and its raw data.
          session.setDraftCamera(camera);
          const staged=session.getSnapshot(),draft=staged.draft;
          if(staged.accepted!==baseline.accepted||draft.sceneSource!==baseline.draft.sceneSource||draft.asset!==baseline.draft.asset||draft.display!==baseline.draft.display||draft.title!==baseline.draft.title
            ||(['eye','target','up'] as const).some(field=>draft.camera[field].some((value,axis)=>!Object.is(value,camera[field][axis])))
            ||!Object.is(draft.camera.fovYDegrees,camera.fovYDegrees)||!Object.is(draft.camera.near,camera.near)||!Object.is(draft.camera.far,camera.far)){
            throw new RenderMixedDocumentError('INPUT','The scene or draft changed while the camera view was staged. Your drafts are kept. Apply them explicitly.');
          }
        }finally{busy=false;}
        return controller.apply();
      }catch(cause){return failed(cause);}
    },
    recover(){
      try{check();}catch(cause){return failed(cause);}
      try{
        previewBaseline=null;
        if(!presenter)throw new RenderMixedDocumentError('GPU','No mixed viewport is attached.');
        busy=true;
        try{
          const epoch=viewEpoch,prepared=session.getSnapshot().prepared,result=presenter.recover(prepared);
          if(epoch!==viewEpoch)return failed(snapshot.presentationError??new RenderMixedDocumentError('GPU','The preview is unavailable.'));
          if(!result.ok)return unavailable(new RenderMixedDocumentError('GPU','The preview could not be restored.',result.error));
          visible=prepared;emit({...snapshot,presentedRevision:prepared.document.revision,presentationError:null,cameraPreview:null});return{ok:true};
        }finally{busy=false;}
      }catch(cause){return unavailable(new RenderMixedDocumentError('GPU','The preview is unavailable.',cause));}
    },
    presentationUnavailable(cause){if(!snapshot.disposed)unavailable(cause);},
    dispose(){if(snapshot.disposed)return;check();const previous=presenter;presenter=null;visible=null;previewBaseline=null;viewEpoch++;try{previous?.dispose();}finally{emit({presentedRevision:null,presentationError:null,cameraPreview:null,disposed:true});listeners.clear();}}
  };
  if(initial)controller.attachPresenter(initial);return controller;
}
