import {RenderMixedDocumentError} from './mixed-document.js';
import type {PreparedRenderMixedDocument} from './mixed-frame.js';
import type {RenderMixedPreparedCandidate, RenderMixedSession} from './mixed-session.js';

export type RenderMixedPresentationResult = {ok:true} | {ok:false;error:Error;retained:boolean};
export interface RenderMixedPresenter {
  present(prepared:PreparedRenderMixedDocument, previous:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  recover(prepared:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  dispose():void;
}
export interface RenderMixedControllerSnapshot {readonly presentedRevision:number|null;readonly presentationError:RenderMixedDocumentError|null;readonly disposed:boolean}
export type RenderMixedActionResult = {ok:true}|{ok:false;error:RenderMixedDocumentError};
export interface RenderMixedController {
  readonly session:RenderMixedSession;
  getSnapshot():RenderMixedControllerSnapshot;
  subscribe(listener:()=>void):()=>void;
  attachPresenter(presenter:RenderMixedPresenter):RenderMixedActionResult;
  detachPresenter(presenter:RenderMixedPresenter):void;
  apply():RenderMixedActionResult;open(text:string):RenderMixedActionResult;undo():RenderMixedActionResult;redo():RenderMixedActionResult;recover():RenderMixedActionResult;
  presentationUnavailable(error:Error):void;dispose():void;
}
/** A complete mixed-frame presentation precedes accepted document/history changes. */
export function createRenderMixedController(session:RenderMixedSession, initial?:RenderMixedPresenter):RenderMixedController {
  let presenter:RenderMixedPresenter|null=null, visible:PreparedRenderMixedDocument|null=null, busy=false;
  let snapshot:RenderMixedControllerSnapshot=Object.freeze({presentedRevision:null,presentationError:null,disposed:false});
  const listeners=new Set<()=>void>();
  const emit=(value:RenderMixedControllerSnapshot)=>{snapshot=Object.freeze(value);for(const listener of [...listeners]){try{listener();}catch{/* Observer errors cannot undo a visible commit. */}}};
  const check=()=>{if(snapshot.disposed)throw new RenderMixedDocumentError('INPUT','Mixed controller is disposed.');if(busy)throw new RenderMixedDocumentError('INPUT','Mixed presentation transaction is active.');};
  const failed=(error:unknown):RenderMixedActionResult=>({ok:false,error:error instanceof RenderMixedDocumentError?error:new RenderMixedDocumentError('GPU','The preview action failed.',error)});
  const run=(prepare:()=>RenderMixedPreparedCandidate|null):RenderMixedActionResult=>{
    try{
      check();if(!presenter||visible!==session.getSnapshot().prepared)throw new RenderMixedDocumentError('GPU','Restore the preview before applying changes.');
      const candidate=prepare();if(!candidate)return{ok:true};const previous=session.getSnapshot().prepared;
      busy=true;
      try{session.commitPrepared(candidate,()=>{
        let result:RenderMixedPresentationResult;
        try{result=presenter!.present(candidate.prepared,previous);}catch(cause){visible=null;const error=new RenderMixedDocumentError('GPU','The preview is unavailable.',cause);emit({...snapshot,presentedRevision:null,presentationError:error});throw error;}
        if(!result.ok){const error=new RenderMixedDocumentError('GPU',result.retained?'The update failed. The previous scene is still shown.':'The preview is unavailable.',result.error);if(!result.retained)visible=null;emit({...snapshot,presentedRevision:result.retained?snapshot.presentedRevision:null,presentationError:error});throw error;}
      });}finally{busy=false;}
      visible=candidate.prepared;emit({...snapshot,presentedRevision:visible.document.revision,presentationError:null});return{ok:true};
    }catch(error){return failed(error);}
  };
  const controller:RenderMixedController={session,getSnapshot:()=>snapshot,subscribe(listener){check();listeners.add(listener);return()=>{listeners.delete(listener);};},
    attachPresenter(next){try{check();if(presenter&&presenter!==next)throw new RenderMixedDocumentError('GPU','A mixed viewport is already attached.');presenter=next;return controller.recover();}catch(error){return failed(error);}},
    detachPresenter(next){if(presenter!==next)return;check();presenter=null;visible=null;next.dispose();emit({...snapshot,presentedRevision:null});},
    apply:()=>run(()=>session.prepareDraft()),open:text=>run(()=>session.prepareOpen(text)),undo:()=>run(()=>session.prepareUndo()),redo:()=>run(()=>session.prepareRedo()),
    recover(){try{check();if(!presenter)throw new RenderMixedDocumentError('GPU','No mixed viewport is attached.');const prepared=session.getSnapshot().prepared,result=presenter.recover(prepared);if(!result.ok){visible=null;const error=new RenderMixedDocumentError('GPU','The preview could not be restored.',result.error);emit({...snapshot,presentedRevision:null,presentationError:error});return{ok:false,error};}visible=prepared;emit({...snapshot,presentedRevision:prepared.document.revision,presentationError:null});return{ok:true};}catch(cause){visible=null;const error=new RenderMixedDocumentError('GPU','The preview is unavailable.',cause);emit({...snapshot,presentedRevision:null,presentationError:error});return{ok:false,error};}},
    presentationUnavailable(cause){if(snapshot.disposed)return;visible=null;emit({...snapshot,presentedRevision:null,presentationError:new RenderMixedDocumentError('GPU','The preview is unavailable. Your applied scene is kept.',cause)});},
    dispose(){if(snapshot.disposed)return;check();const previous=presenter;presenter=null;visible=null;previous?.dispose();emit({presentedRevision:null,presentationError:null,disposed:true});listeners.clear();}
  };
  if(initial)controller.attachPresenter(initial);return controller;
}
