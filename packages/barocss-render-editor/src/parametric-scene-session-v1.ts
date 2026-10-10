import {prepareRenderParametricSceneDocumentV1,parseRenderParametricSceneDocumentV1,serializeRenderParametricSceneDocumentV1,RENDER_PARAMETRIC_SCENE_V1_LIMITS} from './parametric-scene-document-v1.js';
import type {RenderParametricSceneDocumentV1,RenderParametricScenePreparationV1} from './parametric-scene-document-v1.js';
import {RenderEditorError} from './errors.js';

export type RenderParametricSceneSessionPurposeV1='apply'|'open'|'undo'|'redo';
export interface RenderParametricScenePreparedCandidateV1 {readonly preparation:RenderParametricScenePreparationV1;readonly purpose:RenderParametricSceneSessionPurposeV1}
export interface RenderParametricSceneSessionSnapshotV1 {
  readonly accepted:RenderParametricSceneDocumentV1;readonly preparation:RenderParametricScenePreparationV1;readonly draftText:string;
  readonly dirty:boolean;readonly canUndo:boolean;readonly canRedo:boolean;readonly savedRevision:number|null;readonly disposed:boolean;
}
export interface RenderParametricSceneSessionV1 {
  getSnapshot():RenderParametricSceneSessionSnapshotV1;subscribe(listener:()=>void):()=>void;setDraftText(text:string):void;
  prepareDraft():RenderParametricScenePreparedCandidateV1;prepareOpen(text:string):RenderParametricScenePreparedCandidateV1;
  prepareUndo():RenderParametricScenePreparedCandidateV1|null;prepareRedo():RenderParametricScenePreparedCandidateV1|null;
  commitPrepared(candidate:RenderParametricScenePreparedCandidateV1,beforeCommit?:()=>void):void;
  discardDraft():void;markSaved(revision:number):void;dispose():void;
}
interface HistoryEntry {readonly document:RenderParametricSceneDocumentV1;readonly bytes:number}
interface HistoryPlan {readonly entries:readonly HistoryEntry[];readonly index:number}
interface CandidateState {readonly generation:number;readonly plan:HistoryPlan;readonly text:string;used:boolean}
const asyncPrototype=Object.getPrototypeOf(async function(){}),asyncGeneratorPrototype=Object.getPrototypeOf(async function*(){});
const utf8Bytes=(text:string)=>new TextEncoder().encode(text).length;
function draftInput(text:unknown):asserts text is string {
  if(typeof text!=='string')throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v1 draft must be a string.');
  if(text.length>RENDER_PARAMETRIC_SCENE_V1_LIMITS.fileBytes||utf8Bytes(text)>RENDER_PARAMETRIC_SCENE_V1_LIMITS.fileBytes)throw new RenderEditorError('DOCUMENT_BYTES','Parametric scene v1 draft exceeds its file byte limit.');
}
function synchronousCallback(callback:unknown):asserts callback is (()=>void)|undefined {
  if(callback===undefined)return;
  if(typeof callback!=='function')throw new RenderEditorError('DOCUMENT_INPUT','Commit callback must be a synchronous function.');
  const prototype=Object.getPrototypeOf(callback),source=Function.prototype.toString.call(callback);
  if(prototype===asyncPrototype||prototype===asyncGeneratorPrototype||/^async(?:\s|\(|\/)/.test(source))throw new RenderEditorError('DOCUMENT_INPUT','Async commit callbacks are not supported.');
}

/** CPU authoring only. An optional synchronous callback precedes every accepted assignment. */
export function createRenderParametricSceneSessionV1(initial:RenderParametricSceneDocumentV1):RenderParametricSceneSessionV1 {
  let preparation=prepareRenderParametricSceneDocumentV1(initial),accepted=preparation.document;
  let acceptedText=serializeRenderParametricSceneDocumentV1(accepted),draftText=acceptedText,savedRevision:number|null=null;
  let disposed=false,locked=false,reentered=false,generation=0,historyIndex=0;
  let history:readonly HistoryEntry[]=Object.freeze([Object.freeze({document:accepted,bytes:utf8Bytes(acceptedText)})]);
  const candidates=new WeakMap<object,CandidateState>(),listeners=new Set<()=>void>();
  const makeSnapshot=():RenderParametricSceneSessionSnapshotV1=>Object.freeze({accepted,preparation,draftText,dirty:draftText!==acceptedText,
    canUndo:!disposed&&historyIndex>0,canRedo:!disposed&&historyIndex<history.length-1,savedRevision,disposed});
  let snapshot=makeSnapshot();
  const assertMutable=()=>{
    if(disposed)throw new RenderEditorError('DISPOSED','Parametric scene v1 session is disposed.');
    if(locked){reentered=true;throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 session mutations are locked during qualification or commit.');}
  };
  const qualify=<T,>(operation:()=>T):T=>{assertMutable();locked=true;reentered=false;try{return operation();}finally{locked=false;}};
  const changed=()=>{generation++;snapshot=makeSnapshot();for(const listener of [...listeners]){try{listener();}catch{/* Observer failures cannot refuse a completed CPU transaction. */}}};
  const nextRevision=()=>{if(accepted.revision===2147483647)throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v1 revision is at its maximum.');return accepted.revision+1;};
  const historyPlan=(entry:HistoryEntry,purpose:RenderParametricSceneSessionPurposeV1,target:number|null):HistoryPlan=>{
    let entries:HistoryEntry[],index:number;
    if(purpose==='open'){entries=[entry];index=0;}
    else if(target!==null){entries=[...history];index=target;entries[index]=entry;}
    else{entries=[...history.slice(0,historyIndex+1),entry];index=entries.length-1;}
    if(entries.length>RENDER_PARAMETRIC_SCENE_V1_LIMITS.historyEntries||entries.reduce((sum,value)=>sum+value.bytes,0)>RENDER_PARAMETRIC_SCENE_V1_LIMITS.historyBytes)throw new RenderEditorError('HISTORY_LIMIT','Parametric scene v1 history exceeds its entry or byte limit.');
    return Object.freeze({entries:Object.freeze(entries),index});
  };
  const prepare=(input:RenderParametricSceneDocumentV1,purpose:RenderParametricSceneSessionPurposeV1,target:number|null=null):RenderParametricScenePreparedCandidateV1=>{
    const next=prepareRenderParametricSceneDocumentV1(input),text=serializeRenderParametricSceneDocumentV1(next.document);
    const entry=Object.freeze({document:next.document,bytes:utf8Bytes(text)}),plan=historyPlan(entry,purpose,target);
    if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 changed during qualification.');
    const candidate=Object.freeze({preparation:next,purpose});candidates.set(candidate,{generation,plan,text,used:false});return candidate;
  };
  const session:RenderParametricSceneSessionV1={
    getSnapshot:()=>snapshot,
    subscribe(listener){assertMutable();if(typeof listener!=='function')throw new RenderEditorError('DOCUMENT_INPUT','Parametric scene v1 listener must be a function.');listeners.add(listener);return()=>{if(locked){reentered=true;throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 listener mutations are locked during commit.');}listeners.delete(listener);};},
    setDraftText(text){assertMutable();draftInput(text);draftText=text;changed();},
    prepareDraft(){return qualify(()=>{const input=parseRenderParametricSceneDocumentV1(draftText);if(input.documentId!==accepted.documentId||input.revision!==accepted.revision)throw new RenderEditorError('STALE_CANDIDATE','Draft document ID and revision must match the current parametric scene v1.');return prepare({...input,revision:nextRevision()},'apply');});},
    prepareOpen(text){return qualify(()=>prepare(parseRenderParametricSceneDocumentV1(text),'open'));},
    prepareUndo(){return qualify(()=>historyIndex===0?null:prepare({...history[historyIndex-1]!.document,revision:nextRevision()},'undo',historyIndex-1));},
    prepareRedo(){return qualify(()=>historyIndex===history.length-1?null:prepare({...history[historyIndex+1]!.document,revision:nextRevision()},'redo',historyIndex+1));},
    commitPrepared(candidate,beforeCommit){
      qualify(()=>{
        const state=candidate!==null&&typeof candidate==='object'?candidates.get(candidate):undefined;
        if(!state||state.used||state.generation!==generation)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 candidate is stale, foreign, forged, or already used.');
        if(state.plan.entries.length>RENDER_PARAMETRIC_SCENE_V1_LIMITS.historyEntries||state.plan.entries.reduce((sum,entry)=>sum+entry.bytes,0)>RENDER_PARAMETRIC_SCENE_V1_LIMITS.historyBytes)throw new RenderEditorError('HISTORY_LIMIT','Parametric scene v1 history exceeds its entry or byte limit.');
        synchronousCallback(beforeCommit);
        if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 session reentry was refused.');
        const result:unknown=beforeCommit?.();
        if(result!==null&&(typeof result==='object'||typeof result==='function')&&typeof Reflect.get(result,'then')==='function')throw new RenderEditorError('DOCUMENT_INPUT','Commit callback must not return a thenable.');
        if(reentered)throw new RenderEditorError('STALE_CANDIDATE','Parametric scene v1 session reentry was refused.');
        accepted=candidate.preparation.document;preparation=candidate.preparation;acceptedText=state.text;draftText=acceptedText;
        history=state.plan.entries;historyIndex=state.plan.index;state.used=true;if(candidate.purpose==='open')savedRevision=accepted.revision;
      });changed();
    },
    discardDraft(){assertMutable();draftText=acceptedText;changed();},
    markSaved(revision){assertMutable();if(revision!==accepted.revision)throw new RenderEditorError('STALE_CANDIDATE','Saved revision does not match the accepted parametric scene v1.');savedRevision=revision;changed();},
    dispose(){if(disposed)return;assertMutable();disposed=true;changed();listeners.clear();},
  };
  return Object.freeze(session);
}
