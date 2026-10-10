import {prepareRenderParametricSceneDocumentV2,parseRenderParametricSceneDocumentV2,serializeRenderParametricSceneDocumentV2,RENDER_PARAMETRIC_SCENE_V2_LIMITS} from './parametric-scene-document-v2.js';
import type {RenderParametricSceneDocumentV2,RenderParametricScenePreparationV2} from './parametric-scene-document-v2.js';
import {RenderEditorError} from './errors.js';

export type RenderParametricSceneSessionPurposeV2='apply'|'open'|'undo'|'redo';
export interface RenderParametricScenePreparedCandidateV2 {readonly preparation:RenderParametricScenePreparationV2;readonly purpose:RenderParametricSceneSessionPurposeV2}
export interface RenderParametricSceneSessionSnapshotV2 {
  readonly accepted:RenderParametricSceneDocumentV2;readonly preparation:RenderParametricScenePreparationV2;readonly draftText:string;
  readonly dirty:boolean;readonly canUndo:boolean;readonly canRedo:boolean;readonly savedRevision:number|null;readonly disposed:boolean;
}
export interface RenderParametricSceneSessionV2 {
  getSnapshot():RenderParametricSceneSessionSnapshotV2;subscribe(listener:()=>void):()=>void;setDraftText(text:string):void;
  prepareDraft():RenderParametricScenePreparedCandidateV2;prepareOpen(text:string):RenderParametricScenePreparedCandidateV2;
  prepareUndo():RenderParametricScenePreparedCandidateV2|null;prepareRedo():RenderParametricScenePreparedCandidateV2|null;
  commitPrepared(candidate:RenderParametricScenePreparedCandidateV2,beforeCommit?:()=>void):void;
  discardDraft():void;markSaved(revision:number):void;dispose():void;
}
interface HistoryEntry {readonly document:RenderParametricSceneDocumentV2;readonly bytes:number}
interface HistoryPlan {readonly entries:readonly HistoryEntry[];readonly index:number}
interface CandidateState {readonly generation:number;readonly plan:HistoryPlan;readonly text:string;used:boolean}
const asyncPrototype=Object.getPrototypeOf(async function(){}),asyncGeneratorPrototype=Object.getPrototypeOf(async function*(){});
const utf8Bytes=(text:string)=>new TextEncoder().encode(text).length;
function draftInput(text:unknown):asserts text is string {
  if(typeof text!=='string')throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v2 draft must be a string.');
  if(text.length>RENDER_PARAMETRIC_SCENE_V2_LIMITS.fileBytes||utf8Bytes(text)>RENDER_PARAMETRIC_SCENE_V2_LIMITS.fileBytes)throw new RenderEditorError('DOCUMENT_BYTES','Parametric scene v2 draft exceeds its file byte limit.');
}
function synchronousCallback(callback:unknown):asserts callback is (()=>void)|undefined {
  if(callback===undefined)return;
  if(typeof callback!=='function')throw new RenderEditorError('DOCUMENT_INPUT','Commit callback must be a synchronous function.');
  const prototype=Object.getPrototypeOf(callback),source=Function.prototype.toString.call(callback);
  if(prototype===asyncPrototype||prototype===asyncGeneratorPrototype||/^async(?:\s|\(|\/)/.test(source))throw new RenderEditorError('DOCUMENT_INPUT','Async commit callbacks are not supported.');
}

/** CPU authoring only. An optional synchronous callback precedes every accepted assignment. */
export function createRenderParametricSceneSessionV2(initial:RenderParametricSceneDocumentV2):RenderParametricSceneSessionV2 {
  let preparation=prepareRenderParametricSceneDocumentV2(initial),accepted=preparation.document;
  let acceptedText=serializeRenderParametricSceneDocumentV2(accepted),draftText=acceptedText,savedRevision:number|null=null;
  let disposed=false,locked=false,reentered=false,generation=0,historyIndex=0;
  let history:readonly HistoryEntry[]=Object.freeze([Object.freeze({document:accepted,bytes:utf8Bytes(acceptedText)})]);
  const candidates=new WeakMap<object,CandidateState>(),listeners=new Set<()=>void>();
  const makeSnapshot=():RenderParametricSceneSessionSnapshotV2=>Object.freeze({accepted,preparation,draftText,dirty:draftText!==acceptedText,
    canUndo:!disposed&&historyIndex>0,canRedo:!disposed&&historyIndex<history.length-1,savedRevision,disposed});
  let snapshot=makeSnapshot();
  const assertMutable=()=>{
    if(disposed)throw new RenderEditorError('DISPOSED','Parametric scene v2 session is disposed.');
    if(locked){reentered=true;throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 session mutations are locked during qualification or commit.');}
  };
  const qualify=<T,>(operation:()=>T):T=>{assertMutable();locked=true;reentered=false;try{return operation();}finally{locked=false;}};
  const changed=()=>{generation++;snapshot=makeSnapshot();for(const listener of [...listeners]){try{listener();}catch{/* Observer failures cannot refuse a completed CPU transaction. */}}};
  const nextRevision=()=>{if(accepted.revision===2147483647)throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v2 revision is at its maximum.');return accepted.revision+1;};
  const historyPlan=(entry:HistoryEntry,purpose:RenderParametricSceneSessionPurposeV2,target:number|null):HistoryPlan=>{
    let entries:HistoryEntry[],index:number;
    if(purpose==='open'){entries=[entry];index=0;}
    else if(target!==null){entries=[...history];index=target;entries[index]=entry;}
    else{entries=[...history.slice(0,historyIndex+1),entry];index=entries.length-1;}
    if(entries.length>RENDER_PARAMETRIC_SCENE_V2_LIMITS.historyEntries||entries.reduce((sum,value)=>sum+value.bytes,0)>RENDER_PARAMETRIC_SCENE_V2_LIMITS.historyBytes)throw new RenderEditorError('HISTORY_LIMIT','Parametric scene v2 history exceeds its entry or byte limit.');
    return Object.freeze({entries:Object.freeze(entries),index});
  };
  const prepare=(input:RenderParametricSceneDocumentV2,purpose:RenderParametricSceneSessionPurposeV2,target:number|null=null):RenderParametricScenePreparedCandidateV2=>{
    const next=prepareRenderParametricSceneDocumentV2(input),text=serializeRenderParametricSceneDocumentV2(next.document);
    const entry=Object.freeze({document:next.document,bytes:utf8Bytes(text)}),plan=historyPlan(entry,purpose,target);
    if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 changed during qualification.');
    const candidate=Object.freeze({preparation:next,purpose});candidates.set(candidate,{generation,plan,text,used:false});return candidate;
  };
  const session:RenderParametricSceneSessionV2={
    getSnapshot:()=>snapshot,
    subscribe(listener){assertMutable();if(typeof listener!=='function')throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v2 listener must be a function.');listeners.add(listener);return()=>{if(locked){reentered=true;throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 listener mutations are locked during commit.');}listeners.delete(listener);};},
    setDraftText(text){assertMutable();draftInput(text);draftText=text;changed();},
    prepareDraft(){return qualify(()=>{const input=parseRenderParametricSceneDocumentV2(draftText);if(input.documentId!==accepted.documentId||input.revision!==accepted.revision)throw new RenderEditorError('STALE_CANDIDATE','Draft document ID and revision must match the current parametric scene v2.');return prepare({...input,revision:nextRevision()},'apply');});},
    prepareOpen(text){return qualify(()=>prepare(parseRenderParametricSceneDocumentV2(text),'open'));},
    prepareUndo(){return qualify(()=>historyIndex===0?null:prepare({...history[historyIndex-1]!.document,revision:nextRevision()},'undo',historyIndex-1));},
    prepareRedo(){return qualify(()=>historyIndex===history.length-1?null:prepare({...history[historyIndex+1]!.document,revision:nextRevision()},'redo',historyIndex+1));},
    commitPrepared(candidate,beforeCommit){
      qualify(()=>{
        const state=candidate!==null&&typeof candidate==='object'?candidates.get(candidate):undefined;
        if(!state||state.used||state.generation!==generation)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 candidate is stale, foreign, forged, or already used.');
        if(state.plan.entries.length>RENDER_PARAMETRIC_SCENE_V2_LIMITS.historyEntries||state.plan.entries.reduce((sum,entry)=>sum+entry.bytes,0)>RENDER_PARAMETRIC_SCENE_V2_LIMITS.historyBytes)throw new RenderEditorError('HISTORY_LIMIT','Parametric scene v2 history exceeds its entry or byte limit.');
        synchronousCallback(beforeCommit);
        if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 session reentry was refused.');
        const result:unknown=beforeCommit?.();
        if(result!==null&&(typeof result==='object'||typeof result==='function')&&typeof Reflect.get(result,'then')==='function')throw new RenderEditorError('DOCUMENT_INPUT','Commit callback must not return a thenable.');
        if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v2 session reentry was refused.');
        accepted=candidate.preparation.document;preparation=candidate.preparation;acceptedText=state.text;draftText=acceptedText;
        history=state.plan.entries;historyIndex=state.plan.index;state.used=true;if(candidate.purpose==='open')savedRevision=accepted.revision;
      });changed();
    },
    discardDraft(){assertMutable();draftText=acceptedText;changed();},
    markSaved(revision){assertMutable();if(revision!==accepted.revision)throw new RenderEditorError('STALE_CANDIDATE','Saved revision does not match the accepted parametric scene v2.');savedRevision=revision;changed();},
    dispose(){if(disposed)return;assertMutable();disposed=true;changed();listeners.clear();},
  };
  return Object.freeze(session);
}
