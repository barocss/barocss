import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Box, ChevronRight, Copy, Crosshair, Download, Expand, FolderOpen, Layers3, Maximize, MousePointer2, PanelLeftClose, PanelRightClose, Redo2, Shrink, Spline, Undo2 } from 'lucide-react';
import { parseCadDocument, resolveCadGeometryReference } from '@barocss/cad';
import { CadEditorError, createCadEditorSession, type CadEditorExportResult, type CadEditorGeometryAnalysisResult, type CadEditorCurveLength, type CadEditorView, type CadEditorSnapshot, type CadEditorEditTarget } from '@barocss/cad-editor';
import { CadEditor, CadEditorExportReview, useCadEditorSnapshot, type CadEditorDisplayOptions, type CadEditorDisplayReceipt, type CadEditorCurveFocusReceipt, type CadEditorCurvePresentationReceipt } from '@barocss/cad-editor/react';
import fixtureText from '../fixtures/canonical-surface-and-curve.cad-document.json?raw';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from './components/ui/menubar';
import {useWorkspaceLayout} from './workspace-layout';
import {WorkspacePanelDivider} from './panel-divider';
import {CadCommandPalette,type CommandId,type PaletteCommand} from './command-palette';
import { downloadAccepted, downloadReviewedExport, readCadEditorFile } from './file-actions';
import { FeatureApp } from './feature-app';
import { LoftApp } from './loft-app';
import { AssemblyApp } from './assembly-app';
import { DrivingSketchApp } from './driving-sketch-app';
import { ReplacementDialog } from './replacement-dialog';
import { RecoveryDialog } from './recovery-dialog';
import { buildRecoveryRecord, readRecoverySlot, writeRecoveryCopy, deleteRecoveryCopy, RECOVERY_CHANGE_CHANNEL, type RecoveryRecord, type RecoverySlot } from './recovery-storage';
import { captureReplacementAnchor, assertReplacementCurrent, copyReplacementTarget, type ReplacementAnchor, type ReplacementTarget } from './document-replacement';

function bodyPresentationLabels(bodies: readonly { id: string; name: string }[]) {
  const totals = new Map<string, number>(), ordinals = new Map<string, number>(), labels = new Map<string, string>();
  for (const body of bodies) totals.set(body.name, (totals.get(body.name) ?? 0) + 1);
  for (const body of bodies) {
    const ordinal = (ordinals.get(body.name) ?? 0) + 1;
    ordinals.set(body.name, ordinal);
    labels.set(body.id, totals.get(body.name)! > 1 ? `${body.name} ${ordinal}` : body.name);
  }
  return labels;
}

function nativeCauses(error: Error): {message:string;code:string|null}[] {
  const causes: {message:string;code:string|null}[]=[];
  let current=error.cause;
  for(let depth=0;depth<6 && current instanceof Error;depth++) {
    causes.push({message:current.message,code:'code' in current ? String(current.code) : null});
    current=current.cause;
  }
  return causes;
}
function actionError(error: CadEditorError): string {
  if(error.context.field==='curve-interval')return error.code==='STALE'?'The Curve or view changed. Review the pending bounds.':error.code==='DISPLAY'?'Cannot display this interval. The accepted Curve is retained.':'Enter a proper increasing interval within the current Curve bounds.';
  if(error.context.field==='curve-pole-drag')return error.code==='STALE'?'The point or view changed. Review the pending values before dragging again.':'Cannot move this point. Apply or discard the draft, then try again.';
  if(error.context.field==='curve-focus')return 'Cannot show this Curve view. Keep the current view, or choose another object. Open Help for the supported limits.';
  if(error.context.field==='curve-pole')return 'Cannot apply this Curve point. Check its coordinates and weight.';
  if(error.context.field==='document-recovery')return 'Cannot open this recovery copy. The current document is retained. Open Recovery copies to retry.';
  if(error.context.field==='curve-length')return 'Cannot estimate this Curve length. Check the original interval or open Help.';
  if(error.context.field==='document-replacement-download')return 'Download could not start. The current document is retained.';
  if(error.context.field==='document-replacement')return error.code==='STALE'?'The document changed. Open the file or choose New again.':error.code==='INPUT'?'Apply or discard your draft before replacing this document.':'The current document is retained. Try Open or New again.';
  if(error.context.field==='body-name')return 'Cannot rename this object. Check the name and try again.';
  if(error.context.field==='geometry-analysis')return 'Cannot inspect this geometry here. Check the original parameters or try Derivatives.';
  if(error.context.field==='document-export' || error.context.field==='export-download')return 'Cannot complete this export. Check the captured review, selected bodies and output IDs.';
  const chain=nativeCauses(error), cause=chain.map(item=>item.message).join('\n');
  if(chain.some(item=>item.code==='BINDING')) return 'Select a Surface with directly entered control-point values.';
  if (cause.includes('Weights must')) return 'Enter a weight from 0.000001 to 1000000.';
  if (error.message.includes('two assets and two bodies')) return 'Open a document with one Surface and one Curve.';
  if (error.message.includes('Native document Open')) return 'Cannot open this file. Select a valid CAD document.';
  if (error.context.field === 'fit-selection') return 'Show the selected object before fitting it.';
  if (cause.includes('native degree1..3 Curve')) return 'This object cannot be displayed. Choose another object.';
  if (error.context.field === 'display-body-set') return 'Display one to four objects. Hide an object before showing another.';
  if (error.context.field === 'edit-capability') return 'This Surface is read-only. Select an editable Surface.';
  if (error.context.field === 'history') return 'Apply or discard the pending values before using history.';
  if (error.context.field === 'selection-transition') return 'Apply or discard the pending values before this action.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current document is retained.';
  if (error.code === 'BUDGET') return 'This input exceeds the supported size. Open a smaller document.';
  if (error.code === 'REVISION') return 'This document reached its edit limit. Open a new document.';
  if (error.code === 'STALE') return 'The document changed. Select the control point and try again.';
  if (error.code === 'NATIVE') return 'Cannot apply these values. Check the coordinates and weight.';
  return error.message;
}

const defaultDisplay: CadEditorDisplayOptions = {
  viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] },
  document: { basis: 'authored-xyz-matches-rhyup', native: { sourceVersion: 0, countU: 17, countV: 17, unitsPerMillimeter: 1, curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 }, nativeCapacity: { version: 1, maximumObjects: 16 } } },
};

interface RecoveryOrigin { raw:string;wasDirty:boolean;hadPending:boolean }
interface ReplacementRequest { id:number;anchor:ReplacementAnchor;target:ReplacementTarget;focus:HTMLElement|null;downloadStarted:boolean;hostWasDirty:boolean;recovery?:RecoveryOrigin }
interface OpenChoice { id:number;anchor:ReplacementAnchor;focus:HTMLElement|null;text:string;filename:string;bodies:{id:string;name:string}[];curveBodies:{id:string;name:string}[];selected:string[];view:CadEditorView;recovery?:RecoveryOrigin }

function DirectApp() {
  const appRoot=useRef<HTMLDivElement>(null);
  const [session] = useState(() => createCadEditorSession(parseCadDocument(fixtureText).document));
  const snapshot = useCadEditorSnapshot(session);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [filename, setFilename] = useState('Weighted surface');
  const [curveDisplay,setCurveDisplay]=useState<CadEditorCurveFocusReceipt|null>(null);
  const [curvePresentation,setCurvePresentation]=useState<CadEditorCurvePresentationReceipt|null>(null);
  const openChoiceFocusRef=useRef<HTMLElement|null>(null);
  const [receipt, setReceipt] = useState<CadEditorDisplayReceipt | null>(null);
  const [exportReview,setExportReview]=useState<CadEditorExportResult|null>(null);
  const [geometryAnalysis,setGeometryAnalysis]=useState<CadEditorGeometryAnalysisResult|null>(null);
  const [curveLength,setCurveLength]=useState<CadEditorCurveLength|null>(null);
  const [displayOptions, setDisplayOptions] = useState(defaultDisplay);
  const [fitSelectedRequest, setFitSelectedRequest] = useState(0);
  const [openChoice, setOpenChoice] = useState<OpenChoice | null>(null);
  const [replacement,setReplacement]=useState<ReplacementRequest|null>(null);
  const replacementRef=useRef<ReplacementRequest|null>(null),requestSerial=useRef(0);
  const replacementAttempt=useRef(false),copyNotification=useRef(false);
  const openButton=useRef<HTMLButtonElement>(null),fileMenu=useRef<HTMLButtonElement>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [mount, setMount] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const [readRequest, setReadRequest] = useState(0);
  const [route, setRoute] = useState(location.hash);
  const fileInput = useRef<HTMLInputElement>(null);
  if(openChoice)openChoiceFocusRef.current=openChoice.focus;
  const pendingOpen=useRef<{token:string;filename:string;recovery?:RecoveryOrigin}|null>(null);
  const recoveredUnsavedRef=useRef(false);
  const [recoveredUnsaved,setRecoveredUnsaved]=useState(false);
  const [replacementBusy,setReplacementBusy]=useState(false);
  const recoveryCommitRef=useRef<number|null>(null);
  const [recoveryChecking,setRecoveryChecking]=useState(false);
  const [recoveryOpen,setRecoveryOpen]=useState(false);
  const [recoverySlot,setRecoverySlot]=useState<RecoverySlot|null>(null);
  const recoverySlotRef=useRef<RecoverySlot|null>(null),recoveryReadSerial=useRef(0),recoveryMutation=useRef(false);
  const [recoveryStatus,setRecoveryStatus]=useState<'loading'|'ready'|'empty'|'failed'>('loading');
  const [recoveryMessage,setRecoveryMessage]=useState<string|null>(null);
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const [recoveryConfirmation,setRecoveryConfirmation]=useState<'replace'|'delete'|null>(null);
  const recoveryDecision=useRef<{kind:'replace'|'delete';raw:string;record?:RecoveryRecord}|null>(null);
  const [recoveryHandover,setRecoveryHandover]=useState(false);
  function provenance(value:boolean){recoveredUnsavedRef.current=value;setRecoveredUnsaved(value);}
  function cancelRecoveryConfirmation(){recoveryDecision.current=null;setRecoveryConfirmation(null);}
  async function refreshRecovery(){
    if(recoveryMutation.current)return;
    const serial=++recoveryReadSerial.current;
    try{
      const slot=await readRecoverySlot();if(serial!==recoveryReadSerial.current)return;
      recoverySlotRef.current=slot;setRecoverySlot(slot);setRecoveryStatus(slot.error?'failed':slot.record?'ready':'empty');
      if(recoveryDecision.current&&slot.raw!==recoveryDecision.current.raw){cancelRecoveryConfirmation();setRecoveryMessage('The recovery copy changed. Review it before trying again.');}
      const request=replacementRef.current;
      if(request?.recovery&&slot.raw!==request.recovery.raw)replacementError(new CadEditorError('STALE','The recovery copy changed.',{field:'document-recovery'}));
    }catch(cause){if(serial!==recoveryReadSerial.current)return;recoverySlotRef.current=null;setRecoverySlot(null);setRecoveryStatus('failed');setRecoveryMessage('Recovery storage is unavailable. Retry from File.');}
  }
  useEffect(()=>{
    let channel:BroadcastChannel|null=null;
    const refresh=()=>{void refreshRecovery();};
    if(typeof BroadcastChannel!=='undefined'){try{channel=new BroadcastChannel(RECOVERY_CHANGE_CHANNEL);channel.onmessage=refresh;}catch{}}
    window.addEventListener('focus',refresh);refresh();
    return()=>{recoveryReadSerial.current++;channel?.close();window.removeEventListener('focus',refresh);};
  },[]);
  function showRecovery(){clearReplacement();cancelRecoveryConfirmation();setRecoveryMessage(Object.keys(session.getSnapshot().pending).length||session.getSnapshot().selectionTransition?'Draft fields are excluded. Apply or discard them before opening a copy.':null);setRecoveryHandover(false);setRecoveryOpen(true);void refreshRecovery();}
  function closeRecovery(){if(recoveryMutation.current)return;clearReplacement();cancelRecoveryConfirmation();setRecoveryOpen(false);}
  async function mutateRecovery(kind:'replace'|'delete',raw:string|undefined,record?:RecoveryRecord){
    if(recoveryMutation.current)return;
    recoveryMutation.current=true;appRoot.current?.setAttribute('data-direct-host-busy','true');recoveryReadSerial.current++;setRecoveryBusy(true);setRecoveryMessage(null);
    let message:string;
    try{
      if(kind==='delete')await deleteRecoveryCopy(raw);else {if(!record)throw new Error('A captured document is required.');await writeRecoveryCopy(raw,record);}
      message=kind==='delete'?'Recovery copy deleted.':'Copy stored in this browser.'+(record?.hadPending?' Draft fields were not copied.':'')+' Later changes are not included.';
    }catch(cause){message=cause instanceof Error&&'code' in cause&&cause.code==='STALE'?'The recovery copy changed. Review it before trying again.':'Cannot change the recovery copy. The current document is retained.';}
    finally{recoveryMutation.current=false;if(!replacementAttempt.current)appRoot.current?.removeAttribute('data-direct-host-busy');setRecoveryBusy(false);cancelRecoveryConfirmation();}
    setRecoveryMessage(message);
    await refreshRecovery();
  }
  function saveRecovery(){
    try{
      const current=session.getSnapshot();
      if(current.disposed||current.candidate)throw new Error('Resolve the current display operation first.');
      const slot=recoverySlotRef.current;if(!slot)throw new Error('Recovery storage is unavailable.');
      const record=buildRecoveryRecord(current,filename,current.dirty||recoveredUnsavedRef.current);
      if(slot.raw!==undefined){recoveryDecision.current={kind:'replace',raw:slot.raw,record};setRecoveryConfirmation('replace');}
      else void mutateRecovery('replace',undefined,record);
    }catch{setRecoveryMessage('Cannot copy the current document. Resolve the display operation or retry storage.');}
  }
  function removeRecovery(){const raw=recoverySlotRef.current?.raw;if(raw===undefined)return;recoveryDecision.current={kind:'delete',raw};setRecoveryConfirmation('delete');}
  function confirmRecovery(){const decision=recoveryDecision.current;if(decision)void mutateRecovery(decision.kind,decision.raw,decision.record);}
  async function openRecovery(){
    const observed=recoverySlotRef.current;if(!observed?.record||observed.raw===undefined)return;
    let id=requestSerial.current;
    try{
      clearReplacement();id=requestSerial.current;setError(null);
      const anchor=captureReplacementAnchor(session);replacementAttempt.current=true;appRoot.current?.setAttribute('data-direct-host-busy','true');setRecoveryChecking(true);
      const slot=await readRecoverySlot();if(id!==requestSerial.current)return;
      assertReplacementCurrent(session,anchor);
      if(slot.raw!==observed.raw||!slot.record||slot.error)throw new Error('The recovery copy changed or cannot be read.');
      const record=slot.record;
      setRecoveryHandover(true);setRecoveryOpen(false);cancelRecoveryConfirmation();
      const parsed=parseCadDocument(record.text),origin:RecoveryOrigin={raw:slot.raw,wasDirty:record.wasDirty,hadPending:record.hadPending};
      const curveBodies=parsed.document.bodies.filter(body=>parsed.bodyBindings.some(binding=>binding.bodyId===body.id&&binding.geometryKind==='curve'));
      if(parsed.compiledAssets.some(asset=>asset.model.objects.some(geometry=>geometry.kind==='curve'&&geometry.degree>3))){
        setOpenChoice({id,anchor,focus:fileMenu.current,text:record.text,filename:record.filename,bodies:parsed.document.bodies,curveBodies,selected:[...record.displayBodyIds],view:{kind:'document'},recovery:origin});return;
      }
      receiveTarget(id,anchor,{kind:'open',text:record.text,filename:record.filename,displayBodyIds:record.displayBodyIds},fileMenu.current,origin);
    }catch(cause){if(id!==requestSerial.current)return;replacementError(new CadEditorError('FILE','Cannot open this recovery copy.',{field:'document-recovery'},cause));setRecoveryMessage('Cannot open this copy. Resolve drafts or review the current recovery copy.');void refreshRecovery();}
    finally{if(id===requestSerial.current)setRecoveryChecking(false);}
  }
  function downloadCurrent(){clearReplacement();downloadAccepted(session);provenance(false);}
  const flowMode = new URLSearchParams(location.search).has('flow');
  const run = (action: () => unknown) => { try { setError(null); action(); } catch (cause) { setReadRequest(value => value + 1); setError(cause instanceof CadEditorError ? cause : new CadEditorError('FILE', String(cause), {}, cause)); } };
  useEffect(() => {
    const updateRoute = () => { clearReplacement();setRoute(location.hash); };
    window.addEventListener('hashchange', updateRoute);
    if (!location.hash) location.hash = '/documents/' + snapshot.accepted.document.documentId;
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  useEffect(() => { setError(null); }, [snapshot.selectedBodyId]);
  useEffect(() => () => session.dispose(), [session]);
  useEffect(() => {
    if (!flowMode) return;
    // This focused flow seam exposes copied data and declared host actions only.
    const api = {
      snapshot: () => session.getSnapshot(), display: () => structuredClone(receipt), error: () => error ? {code:error.code,message:error.message,context:{...error.context},cause:error.cause instanceof Error ? error.cause.message : null,causeChain:nativeCauses(error)} : null,
      exportReview:()=>structuredClone(exportReview),geometryAnalysis:()=>structuredClone(geometryAnalysis),curveLength:()=>structuredClone(curveLength),curveDisplay:()=>structuredClone(curveDisplay),curvePresentation:()=>structuredClone(curvePresentation),recovery:()=>({status:recoveryStatus,slot:structuredClone(recoverySlot),unsaved:recoveredUnsavedRef.current}),readFrame:()=>setReadRequest(value=>value+1),
      setDisplayRefusal: (refuse: boolean) => setDisplayOptions(refuse ? { ...defaultDisplay, document: { ...defaultDisplay.document, native: { ...defaultDisplay.document.native, countU: 1 } } } : defaultDisplay),
      setMounted: (mounted: boolean) => { setMount(mounted); if (mounted) setMountKey(key => key + 1); },
      session,
    };
    Object.assign(window, { __cadEditorFlow: api });
    return () => { delete (window as Window & { __cadEditorFlow?: unknown }).__cadEditorFlow; };
  }, [flowMode, session, receipt, exportReview, geometryAnalysis, curveLength,curveDisplay,curvePresentation, error,recoveryStatus,recoverySlot]);
  function clearReplacement() {
    requestSerial.current++;setReplacementBusy(false);setRecoveryChecking(false);recoveryCommitRef.current=null;replacementAttempt.current=false;if(!recoveryMutation.current)appRoot.current?.removeAttribute('data-direct-host-busy');replacementRef.current=null;setReplacement(null);setOpenChoice(null);
  }
  function replacementError(cause:unknown) {
    clearReplacement();if(pendingOpen.current&&session.getSnapshot().candidate?.token!==pendingOpen.current.token)pendingOpen.current=null;setReadRequest(value=>value+1);
    setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot replace this document.',{field:'document-replacement'},cause));
  }
  function currentRequest(request:ReplacementRequest) {
    if(request.id!==requestSerial.current||replacementRef.current!==request)throw new CadEditorError('STALE','The replacement request is no longer current.',{field:'document-replacement'});
    if(request.hostWasDirty!==recoveredUnsavedRef.current)throw new CadEditorError('STALE','The recovered document state changed.',{field:'document-replacement'});
    assertReplacementCurrent(session,request.anchor);
  }
  function commitReplacement(request:ReplacementRequest) {
    currentRequest(request);
    const target=copyReplacementTarget(request.target);
    clearReplacement();setError(null);
    const candidate=session.prepareOpen(target.text,target.displayBodyIds||target.view?{...(target.displayBodyIds?{displayBodyIds:target.displayBodyIds}:{}),...(target.view?{view:target.view}:{})}:undefined);
    pendingOpen.current={token:candidate.token,filename:target.filename,recovery:request.recovery};
    if(location.hash==='#/projects')location.hash='/documents/'+session.getSnapshot().accepted.document.documentId;
  }
  async function verifyRecoveryThenCommit(request:ReplacementRequest){
    if(recoveryCommitRef.current===request.id)return;
    try{
      currentRequest(request);recoveryCommitRef.current=request.id;setReplacementBusy(true);
      const slot=await readRecoverySlot();
      if(request.id!==requestSerial.current||replacementRef.current!==request)return;
      currentRequest(request);
      if(slot.raw!==request.recovery?.raw||!slot.record||slot.error)throw new CadEditorError('STALE','The recovery copy changed or cannot be read.',{field:'document-recovery'});
      commitReplacement(request);
    }catch(cause){if(request.id===requestSerial.current)replacementError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot read recovery storage.',{field:'document-recovery'},cause));}
    finally{if(request.id===requestSerial.current)setReplacementBusy(false);}
  }
  function continueReplacement(){const request=replacementRef.current;if(!request)return;if(request.recovery){void verifyRecoveryThenCommit(request);return;}try{commitReplacement(request);}catch(cause){replacementError(cause);}}
  function receiveTarget(id:number,anchor:ReplacementAnchor,target:ReplacementTarget,focus:HTMLElement|null,recovery?:RecoveryOrigin) {
    if(id!==requestSerial.current)return;
    assertReplacementCurrent(session,anchor);
    const request:ReplacementRequest={id,anchor,target:copyReplacementTarget(target),focus,downloadStarted:false,hostWasDirty:recoveredUnsavedRef.current,recovery};
    replacementRef.current=request;
    if(session.getSnapshot().dirty||recoveredUnsavedRef.current)setReplacement(request);else if(recovery)void verifyRecoveryThenCommit(request);else commitReplacement(request);
  }
  function chooseOpenFile(){clearReplacement();fileInput.current?.click();}
  const openFile = async (file:File|undefined) => {
    if(!file)return;
    let id=requestSerial.current;
    try {
      clearReplacement();id=requestSerial.current;setError(null);
      const anchor=captureReplacementAnchor(session),focus=openButton.current;replacementAttempt.current=true;appRoot.current?.setAttribute('data-direct-host-busy','true');
      const text=await readCadEditorFile(file);
      if(id!==requestSerial.current)return;
      assertReplacementCurrent(session,anchor);
      let parsed;
      try{parsed=parseCadDocument(text);}catch(cause){throw new CadEditorError('NATIVE','Native document Open failed.',{},cause);}
      const document=parsed.document;
      const curveBodies=document.bodies.filter(body=>parsed.bodyBindings.some(binding=>binding.bodyId===body.id&&binding.geometryKind==='curve'));
      const wide=parsed.compiledAssets.some(asset=>asset.model.objects.some(geometry=>geometry.kind==='curve'&&geometry.degree>3));
      if(document.bodies.length>4||wide){setOpenChoice({id,anchor,focus,text,filename:file.name,bodies:document.bodies,curveBodies,selected:document.bodies.length<=4?document.bodies.map(body=>body.id):[],view:{kind:'document'}});return;}
      receiveTarget(id,anchor,{kind:'open',text,filename:file.name},focus);
    }catch(cause){if(id===requestSerial.current)replacementError(cause);}
  };
  const newSample = () => {
    try{clearReplacement();setError(null);const anchor=captureReplacementAnchor(session);replacementAttempt.current=true;appRoot.current?.setAttribute('data-direct-host-busy','true');receiveTarget(requestSerial.current,anchor,{kind:'sample',text:fixtureText,filename:'Weighted surface'},fileMenu.current);}
    catch(cause){replacementError(cause);}
  };
  function downloadReplacementCopy() {
    const request=replacementRef.current;if(!request)return;
    try{
      currentRequest(request);copyNotification.current=true;downloadAccepted(session);provenance(false);
      const next={...request,anchor:captureReplacementAnchor(session),hostWasDirty:false,downloadStarted:true};
      replacementRef.current=next;setReplacement(next);setError(null);
    }catch(cause){replacementError(new CadEditorError('FILE','Download copy failed.',{field:'document-replacement-download'},cause));}finally{copyNotification.current=false;}
  }
  useEffect(()=>session.subscribe(()=>{if(replacementAttempt.current&&!copyNotification.current)replacementError(new CadEditorError('STALE','The document changed during replacement.',{field:'document-replacement'}));}),[session]);
  useEffect(()=>{
    const request=replacementRef.current;
    try{if(request)currentRequest(request);if(openChoice){if(openChoice.id!==requestSerial.current)throw new CadEditorError('STALE','The Open request is no longer current.',{field:'document-replacement'});assertReplacementCurrent(session,openChoice.anchor);}}
    catch(cause){replacementError(cause);}
    if(pendingOpen.current&&snapshot.candidate?.token!==pendingOpen.current.token)pendingOpen.current=null;
  },[snapshot.generation,snapshot.displayGeneration,snapshot.selectedBodyId,snapshot.selection,snapshot.pending,snapshot.selectionTransition,snapshot.candidate,snapshot.dirty,snapshot.downloadStatus,snapshot.disposed]);
  const busy = snapshot.candidate !== null;
  const effectiveUnsaved=snapshot.dirty||recoveredUnsaved;
  const hasDraft = Object.keys(snapshot.pending).length > 0 || snapshot.selectionTransition !== null;
  const projectView = route === '#/projects';
  const selectedBody = snapshot.accepted.document.bodies.find(body => body.id === snapshot.selectedBodyId);
  const bodyLabels = bodyPresentationLabels(snapshot.accepted.document.bodies);
  const openBodyLabels = bodyPresentationLabels(openChoice?.bodies ?? []);
  const selectedBodyLabel = selectedBody ? bodyLabels.get(selectedBody.id) : undefined;
  const selectedKind = snapshot.accepted.bodyBindings.find(binding => binding.bodyId === snapshot.selectedBodyId)?.geometryKind;
  const duplicatePointers=useRef(new Set<number>());
  const duplicateJob=useRef<number|null>(null);
  const [,duplicateRefresh]=useState(0);
  function duplicateCaptured(){
    const root=appRoot.current;if(!root)return false;
    return [...duplicatePointers.current].some(id=>[root,...root.querySelectorAll('*')].some(node=>node.hasPointerCapture(id)));
  }
  function duplicateReady(ignoreMenu=false){
    const current=session.getSnapshot();
    if(current.disposed||current.candidate||current.selectionTransition||Object.keys(current.pending).length||!current.selectedBodyId
      ||projectView||!mount||replacement!==null||openChoice!==null||recoveryOpen||replacementAttempt.current||replacementBusy
      ||recoveryChecking||recoveryMutation.current||recoveryCommitRef.current!==null||duplicateCaptured()
      ||!appRoot.current?.getClientRects().length||appRoot.current.querySelector('.cad-editor-viewport')?.getAttribute('data-viewer-ready')!=='true'
      ||document.querySelector('[role="dialog"][data-state="open"]')||(!ignoreMenu&&document.querySelector('[role="menu"]')))return false;
    if(current.accepted.document.assets.length>=4||current.accepted.document.bodies.length>=16||current.accepted.document.revision>=2147483647)return false;
    return current.view.kind==='curve-focus'?current.view.bodyId===current.selectedBodyId&&curvePresentation?.state.status==='ready'
      &&curvePresentation.generation===current.generation&&curvePresentation.displayGeneration===current.displayGeneration
      :current.displayBodyIds.length<4&&receipt?.state.status==='ready'&&JSON.stringify(receipt.state.document)===JSON.stringify(current.accepted);
  }
  function duplicateAnchor(){
    const current=session.getSnapshot();
    return JSON.stringify([current.generation,current.displayGeneration,current.selectedBodyId,current.selection,current.curveSelection,
      current.view,current.displayBodyIds,current.editTarget,current.rotationAxis,current.scaleAxis]);
  }
  function duplicateSelected(fromMenu=false){
    if(duplicateJob.current!==null||!duplicateReady(fromMenu))return;
    const anchor=duplicateAnchor(),bodyId=session.getSnapshot().selectedBodyId!;
    const menu=fromMenu?document.activeElement?.closest('[role="menu"]'):null;
    let frames=0;
    const dispatch=()=>{
      duplicateJob.current=null;
      if(anchor!==duplicateAnchor())return;
      if(menu?.isConnected||document.querySelector('[role="menu"]')){
        if(++frames<40)duplicateJob.current=requestAnimationFrame(dispatch);
        return;
      }
      if(!duplicateReady())return;
      const body=session.getSnapshot().accepted.document.bodies.find(value=>value.id===bodyId);if(!body)return;
      const copyName=body.name+' copy';
      const name=new TextEncoder().encode(copyName).byteLength<=128?copyName:body.name;
      run(()=>session.prepareDuplicateBody(bodyId,{name}));
    };
    duplicateJob.current=requestAnimationFrame(dispatch);
  }
  useEffect(()=>{
    let listening=true;
    const down=(event:PointerEvent)=>{if(!(event.target instanceof Element)||!appRoot.current?.contains(event.target))return;
      duplicatePointers.current.add(event.pointerId);setTimeout(()=>{if(listening)duplicateRefresh(value=>value+1);},0);};
    const release=(event:PointerEvent)=>{if(event.type!=='lostpointercapture'||!duplicateCaptured())duplicatePointers.current.delete(event.pointerId);duplicateRefresh(value=>value+1);};
    const observer=new MutationObserver(()=>{if(listening)duplicateRefresh(value=>value+1);});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['role','data-state','data-viewer-ready']});
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    return()=>{listening=false;observer.disconnect();if(duplicateJob.current!==null)cancelAnimationFrame(duplicateJob.current);duplicateJob.current=null;duplicatePointers.current.clear();
      window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('lostpointercapture',release,true);};
  },[session]);
  const layout=useWorkspaceLayout(appRoot,session,()=>busy||snapshot.selectionTransition!==null||snapshot.disposed||projectView||!mount
    ||replacement!==null||openChoice!==null||recoveryOpen||replacementAttempt.current||replacementBusy||recoveryChecking
    ||recoveryMutation.current||recoveryCommitRef.current!==null,
    snapshot.view.kind==='curve-focus'?curvePresentation?.state.status==='ready'&&curvePresentation.generation===snapshot.generation
      &&curvePresentation.displayGeneration===snapshot.displayGeneration:receipt?.state.status==='ready'
      &&JSON.stringify(receipt.state.document)===JSON.stringify(snapshot.accepted));
  const modelBusy=busy||layout.resizing;
  const panelStyle={
    '--cad-objects-width':layout.objectsWidth===null?undefined:layout.objectsWidth+'px',
    '--cad-properties-width':layout.propertiesWidth===null?undefined:layout.propertiesWidth+'px',
  } as CSSProperties;
  function commandBlocked(){
    const current=session.getSnapshot();
    return current.candidate!==null||current.selectionTransition!==null||current.disposed||projectView||!mount||layout.resizing
      ||replacement!==null||openChoice!==null||recoveryOpen||replacementAttempt.current||replacementBusy||recoveryChecking
      ||recoveryMutation.current||recoveryCommitRef.current!==null;
  }
  function commandReady(current:CadEditorSnapshot=session.getSnapshot()){
    return current.view.kind==='curve-focus'?curvePresentation?.state.status==='ready'&&curvePresentation.generation===current.generation
      &&curvePresentation.displayGeneration===current.displayGeneration:receipt?.state.status==='ready'
      &&JSON.stringify(receipt.state.document)===JSON.stringify(current.accepted);
  }
  function commandAvailable(id:CommandId,current:CadEditorSnapshot=session.getSnapshot()):boolean {
    if(commandBlocked()||!commandReady(current))return false;
    if(id==='objects'||id==='properties')return !layout.focused;
    if(id==='focus'||id==='fit-document')return true;
    if(id==='fit-selected')return current.selectedBodyId!==null&&(current.view.kind==='curve-focus'
      ?current.view.bodyId===current.selectedBodyId&&curvePresentation?.reference.bodyId===current.selectedBodyId
      :current.displayBodyIds.includes(current.selectedBodyId)&&receipt?.state.documentBodies.some(body=>body.binding.bodyId===current.selectedBodyId)===true);
    if(Object.keys(current.pending).length)return false;
    const cap=current.bodyCapabilities.find(body=>body.bodyId===current.selectedBodyId);
    const supported=id==='object'?cap?.canTranslateBody:id==='rotation'?cap?.canRotateBody:id==='scale'?cap?.canScaleBody
      :current.curveSelection?cap?.canEditCurvePole:cap?.canEditSurfacePole;
    if(!supported)return false;
    try {
      if(current.view.kind==='document'&&current.selection&&current.selection.bodyId===current.selectedBodyId
        &&current.displayBodyIds.includes(current.selection.bodyId)
        &&receipt?.state.documentBodies.some(body=>body.binding.bodyId===current.selection?.bodyId&&body.ref.kind==='surface'))
        return resolveCadGeometryReference(current.accepted,current.selection.reference).geometry.kind==='surface';
      if(current.view.kind==='document'&&current.curveSelection&&current.curveSelection.bodyId===current.selectedBodyId
        &&current.displayBodyIds.includes(current.curveSelection.bodyId)){
        const resolved=resolveCadGeometryReference(current.accepted,current.curveSelection.reference);
        const body=receipt?.state.documentBodies.find(body=>body.binding.bodyId===current.curveSelection?.bodyId);
        if(resolved.geometry.kind==='curve'&&body?.ref.kind==='curve'&&body.ref.curveId===resolved.geometry.id
          &&body.binding.assetId===resolved.reference.assetId&&body.binding.assetRevision===resolved.reference.assetRevision
          &&body.binding.documentRevision===resolved.reference.documentRevision)return true;
      }
      if(current.view.kind==='curve-focus'&&current.curveSelection&&current.view.bodyId===current.curveSelection.bodyId
        &&current.curveSelection.bodyId===current.selectedBodyId&&curvePresentation
        &&JSON.stringify(curvePresentation.reference)===JSON.stringify(current.curveSelection.reference)){
        const resolved=resolveCadGeometryReference(current.accepted,current.curveSelection.reference);
        return resolved.geometry.kind==='curve'&&resolved.source===curvePresentation.preview.source;
      }
    }catch{return false;}
    return false;
  }
  function executeCommand(id:CommandId){
    if(!commandAvailable(id))return;
    if(id==='fit-document')setFitRequest(value=>value+1);
    else if(id==='fit-selected')setFitSelectedRequest(value=>value+1);
    else if(id==='objects')layout.toggleObjects();
    else if(id==='properties')layout.toggleProperties();
    else if(id==='focus')layout.toggleFocus();
    else run(()=>session.setEditTarget(id as CadEditorEditTarget));
  }
  const paletteCommands:PaletteCommand[]=[
    {id:'pole',name:'Control point',shortcut:'Q'}, {id:'object',name:'Move object',shortcut:'W'},
    {id:'rotation',name:'Rotate object',shortcut:'E'}, {id:'scale',name:'Scale object',shortcut:'R'},
    {id:'fit-document',name:'Fit document'}, {id:'fit-selected',name:'Fit selected'},
    {id:'objects',name:'Objects',status:layout.objectsVisible?'Shown':'Hidden'},
    {id:'properties',name:'Properties',status:layout.propertiesVisible?'Shown':'Hidden'},
    {id:'focus',name:layout.focused?'Restore panels':'Canvas focus',shortcut:'F8'},
  ].map(command=>({...command,id:command.id as CommandId,disabled:!commandAvailable(command.id as CommandId,snapshot),
    status:command.id===snapshot.editTarget?'Current':command.status}));

  return <div ref={appRoot} className="cad-app cad-direct-app" data-objects-visible={layout.objectsVisible}
    data-direct-host-busy={replacementAttempt.current||replacement!==null||openChoice!==null||recoveryBusy||recoveryChecking?'true':undefined} data-properties-visible={layout.propertiesVisible} data-canvas-focused={layout.focused} data-panel-resizing={layout.resizing}
    data-object-panel-width={layout.objectsWidth??'auto'} data-property-panel-width={layout.propertiesWidth??'auto'} style={panelStyle}
    onKeyDownCapture={event=>{if(layout.resizing&&event.key!=='Escape'){event.preventDefault();event.stopPropagation();}}}>
    <header className="app-header">
      <a className="app-brand" href="#/projects"><Box size={20} strokeWidth={1.6} /><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar">
        <MenubarMenu><MenubarTrigger ref={fileMenu}>File</MenubarTrigger><MenubarContent>
          <MenubarItem onSelect={newSample} disabled={modelBusy}>New sample<MenubarShortcut>01</MenubarShortcut></MenubarItem>
          <MenubarItem onSelect={chooseOpenFile} disabled={modelBusy}>Open native document…</MenubarItem>
          <MenubarItem disabled={modelBusy} onSelect={() => { location.hash = "/features/cad_boolean_extrusion"; }}>New Boolean extrusion</MenubarItem>
          <MenubarItem disabled={modelBusy} onSelect={() => { if (!commandBlocked() && !duplicateCaptured()) location.hash = '/lofts/loft_supported_graph'; }}>New NURBS loft</MenubarItem>
          <MenubarItem disabled={modelBusy} onSelect={() => { if (!commandBlocked() && !duplicateCaptured()) location.hash = '/assemblies/assembly_editor_fixture'; }}>New assembly</MenubarItem>
          <MenubarItem disabled={modelBusy} onSelect={() => { if (!commandBlocked() && !duplicateCaptured()) location.hash = '/sketches/driving_lines_document'; }}>New driving Sketch</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={showRecovery} disabled={modelBusy}>Recovery copies…</MenubarItem>
          <MenubarItem disabled={layout.resizing} onSelect={() => run(downloadCurrent)}>Download accepted document</MenubarItem>
          <MenubarSeparator/><MenubarItem disabled={layout.resizing} onSelect={() => { location.hash = '/projects'; }}>Projects</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
          <MenubarItem data-testid="duplicate-body-menu" disabled={!duplicateReady(true)} onSelect={()=>duplicateSelected(true)}>Duplicate body</MenubarItem>
          <MenubarSeparator/>
          <MenubarItem disabled={!snapshot.history.canUndo || modelBusy || hasDraft} onSelect={() => run(() => session.prepareUndo())}>Undo</MenubarItem>
          <MenubarItem disabled={!snapshot.history.canRedo || modelBusy || hasDraft} onSelect={() => run(() => session.prepareRedo())}>Redo</MenubarItem>
          <MenubarSeparator/><MenubarItem disabled={layout.resizing} onSelect={() => run(() => session.discardPending())}>Discard pending fields</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarItem disabled={layout.resizing} onSelect={() => setFitRequest(value => value + 1)}>Fit document</MenubarItem>
          <MenubarSeparator/>
          <MenubarCheckboxItem checked={layout.objectsVisible} disabled={layout.disabled||layout.focused} onCheckedChange={layout.toggleObjects}>Objects</MenubarCheckboxItem>
          <MenubarCheckboxItem checked={layout.propertiesVisible} disabled={layout.disabled||layout.focused} onCheckedChange={layout.toggleProperties}>Properties</MenubarCheckboxItem>
          <MenubarItem disabled={layout.disabled} onSelect={layout.toggleFocus}>{layout.focused?'Restore panels':'Canvas focus'}<MenubarShortcut>F8</MenubarShortcut></MenubarItem>
        </MenubarContent></MenubarMenu>
      </Menubar>
      <span className="document-title" title={filename}>{filename}<span className="dirty-dot" aria-label={effectiveUnsaved ? 'Unsaved accepted changes' : 'Accepted content unchanged'}>{effectiveUnsaved ? ' •' : ''}</span></span>
      <CadCommandPalette root={appRoot} commands={paletteCommands} blocked={commandBlocked} ready={commandReady} available={commandAvailable} execute={executeCommand}/>
      <Button ref={openButton} data-testid="document-open" variant="outline" size="sm" className="document-command-icon" aria-label="Open" title="Open" onClick={chooseOpenFile} disabled={modelBusy}><FolderOpen size={16} aria-hidden="true"/></Button>
      <Button size="sm" className="document-command-icon" aria-label="Download" title="Download" disabled={layout.resizing} onClick={() => run(downloadCurrent)}><Download size={16} aria-hidden="true"/></Button>
      <input ref={fileInput} type="file" accept=".json,.cad-document.json" aria-label="Open native document file" className="file-input" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }}/>
    </header>
    <div className="app-toolbar modeling-toolbar">
      <div className="workspace-context"><span className="workspace-mode"><MousePointer2 size={13}/>Modeling<span>{snapshot.view.kind==='curve-focus'?'Curve focus':'Document view'}</span></span>
        <span className="workspace-selection" title={selectedBodyLabel}>{selectedBodyLabel ?? 'Select an object'}{selectedKind && <small>{selectedKind === 'surface' ? 'Surface' : 'Curve'}</small>}</span>
      </div>
      <div className="toolbar-actions">
      <div className="command-group" role="group" aria-label="History commands"><span className="command-group-label">History</span><div className="command-group-actions">
      <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.history.canUndo || modelBusy || hasDraft} onClick={() => run(() => session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.history.canRedo || modelBusy || hasDraft} onClick={() => run(() => session.prepareRedo())}><Redo2/></Button>
      </div></div>
      <div className="command-group" role="group" aria-label="View commands"><span className="command-group-label">View</span><div className="command-group-actions">
      <Button variant="ghost" size="sm" className="document-command-icon" aria-label="Fit" title="Fit" disabled={layout.resizing} onClick={() => setFitRequest(value => value + 1)}><Maximize size={16} aria-hidden="true"/></Button><Button variant="ghost" size="sm" data-testid="fit-selected-body" className="document-command-icon" aria-label="Fit selected" title="Fit selected" disabled={!snapshot.selectedBodyId||layout.resizing} onClick={() => setFitSelectedRequest(value => value + 1)}><Crosshair size={16} aria-hidden="true"/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="toggle-object-panel" aria-label={layout.objectsVisible?'Hide objects':'Show objects'} title={layout.objectsVisible?'Hide objects':'Show objects'} aria-pressed={layout.objectsVisible} disabled={layout.disabled||layout.focused} onClick={layout.toggleObjects}><PanelLeftClose/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="toggle-property-panel" aria-label={layout.propertiesVisible?'Hide properties':'Show properties'} title={layout.propertiesVisible?'Hide properties':'Show properties'} aria-pressed={layout.propertiesVisible} disabled={layout.disabled||layout.focused} onClick={layout.toggleProperties}><PanelRightClose/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="toggle-canvas-focus" aria-label={layout.focused?'Restore panels (F8)':'Canvas focus (F8)'} title={layout.focused?'Restore panels (F8)':'Canvas focus (F8)'} aria-pressed={layout.focused} aria-keyshortcuts="F8" disabled={layout.disabled} onClick={layout.toggleFocus}>{layout.focused?<Shrink/>:<Expand/>}</Button>
      </div></div>
      <div className="command-group" role="group" aria-label="Export commands" inert={layout.resizing}><span className="command-group-label">Export</span><div className="command-group-actions">
      {mount && <CadEditorExportReview session={session}
        onReview={result=>{setExportReview(result);if(result!==null)setError(current=>current?.context.field==='document-export'?null:current);}}
        onError={failure=>{setReadRequest(value=>value+1);setError(failure);}}
        onDownload={downloadReviewedExport}/>}
      </div></div>
    </div></div>
    {error && <div className="app-error" role="alert">{actionError(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace">
      <aside className="document-tree" inert={layout.resizing} hidden={!layout.objectsVisible} aria-label="Object browser"><h2><Layers3 size={15}/>Objects<span className="tree-count">{snapshot.accepted.document.bodies.length}</span>
        <Button type="button" variant="ghost" size="icon-sm" data-testid="duplicate-body" aria-label="Duplicate selected body" title="Duplicate selected body" disabled={!duplicateReady()} onClick={()=>duplicateSelected()}><Copy size={13}/></Button>
      </h2>
        {snapshot.accepted.document.bodies.map(body => {
          const binding = snapshot.accepted.bodyBindings.find(item => item.bodyId === body.id)!;
          const selected = snapshot.selectedBodyId === body.id;
          const shown = snapshot.displayBodyIds.includes(body.id);
          const label = bodyLabels.get(body.id)!;
          return <div key={body.id} className={'tree-body-row' + (selected ? ' selected' : '')}>
            <button className={'tree-body' + (selected ? ' selected' : '')} data-testid={'body-select-' + body.id}
              onClick={() => run(() => session.requestSelection(binding.geometryKind === 'surface' ? { bodyId: body.id, uIndex: 1, vIndex: 1 } : { bodyId: body.id }))} aria-pressed={selected} aria-label={bodyLabels.get(body.id)+' '+(binding.geometryKind==='surface'?'Surface':'Curve')}>
              <span className={'body-symbol ' + binding.geometryKind}>{binding.geometryKind === 'surface' ? <Layers3 size={16}/> : <Spline size={16}/>}</span><span className="tree-body-name" title={label}>{body.name}</span>
              {label !== body.name && <span style={{ flexShrink: 0, whiteSpace: 'pre' }}>{label.slice(body.name.length)}</span>}
            </button>
            <input type="checkbox" data-testid={'body-visible-' + body.id} aria-label={(shown?'Hide ':'Show ')+bodyLabels.get(body.id)+(snapshot.view.kind==='curve-focus'?' in document view':'')}
              checked={shown} disabled={modelBusy} onChange={() => run(() => session.prepareDisplayBodies(shown ? snapshot.displayBodyIds.filter(id => id !== body.id) : [...snapshot.displayBodyIds, body.id]))} />
          </div>;
        })}
      </aside>
      <main className="main-workspace" inert={layout.resizing}>
        {projectView ? <section className="projects-view"><span className="eyebrow">LOCAL DOCUMENTS</span><h1>Projects</h1><p>Start with the weighted surface, or open a native document.</p><button className="sample-project" data-testid="project-new-sample" onClick={newSample}><span className="sample-symbol">▱</span><span><strong>Weighted surface</strong><small>Quadratic 3 × 3 surface · Reference line</small></span><ChevronRight size={20}/></button><Button variant="outline" onClick={chooseOpenFile}><FolderOpen/>Open document</Button></section> : mount && <CadEditor key={mountKey} session={session} displayOptions={displayOptions} fitRequest={fitRequest} fitSelectedRequest={fitSelectedRequest || undefined} readRequest={readRequest} curvePresentationPolicy="native-state" curveReadRequest={flowMode?readRequest:undefined}
          onLength={result=>{setCurveLength(result);if(result!==null)setError(current=>current?.context.field==='curve-length'?null:current);}}
          onAnalysis={result=>{setGeometryAnalysis(result);if(result!==null)setError(current=>current?.context.field==='geometry-analysis'?null:current);}}
          onCurveDisplay={setCurveDisplay} onCurvePresentation={setCurvePresentation} onDisplayInvalidated={()=>{setReceipt(null);setCurveDisplay(null);}} onError={failure => { pendingOpen.current=null;setError(failure); }} onAccepted={(accepted,candidate) => { setError(null);if(candidate.kind==='open'&&pendingOpen.current?.token===candidate.token){setFilename(pendingOpen.current.filename);provenance(pendingOpen.current.recovery?.wasDirty??false);if(pendingOpen.current.recovery)setRecoveryMessage(pendingOpen.current.recovery.hadPending?'Recovery copy opened. Draft fields were not restored.':'Recovery copy opened.');}pendingOpen.current=null;location.hash='/documents/'+accepted.accepted.document.documentId; }} onDisplay={setReceipt}/>}
      </main>
      <WorkspacePanelDivider {...layout.dividerProps('objects')}/>
      <WorkspacePanelDivider {...layout.dividerProps('properties')}/>
    </div>
    <ReplacementDialog open={replacement!==null} currentName={filename} action={replacement?.target.kind??'open'} targetName={replacement?.target.filename??''} downloadStarted={replacement?.downloadStarted??false} returnFocus={replacement?.focus??null} busy={replacementBusy} onCancel={clearReplacement} onDownload={downloadReplacementCopy} onContinue={continueReplacement}/>
    <RecoveryDialog open={recoveryOpen} currentName={recoveryDecision.current?.record?.filename??filename} copy={recoverySlot?.record?{name:recoverySlot.record.filename,savedAtText:new Date(recoverySlot.record.savedAtUTC).toLocaleString(),savedWithPending:recoverySlot.record.hadPending}:null}
      status={recoveryStatus} busy={recoveryBusy} canSave={recoverySlot!==null&&!busy&&!snapshot.disposed&&!recoveryChecking} canOpen={!!recoverySlot?.record&&!busy&&!hasDraft&&!recoveryChecking} canDelete={recoverySlot?.raw!==undefined&&recoverySlot!==null&&!recoveryChecking}
      confirmation={recoveryConfirmation} message={recoveryMessage} onSave={saveRecovery} onOpen={()=>{void openRecovery();}} onDelete={removeRecovery} onConfirm={confirmRecovery} onCancelConfirmation={cancelRecoveryConfirmation} onCancel={closeRecovery} returnFocus={fileMenu.current} suppressReturnFocus={recoveryHandover}/>
    <Dialog open={openChoice !== null} onOpenChange={open => { if (!open) clearReplacement(); }}>
      <DialogContent className="cad-editor-help-dialog" data-testid="open-display-choice" onCloseAutoFocus={event=>{event.preventDefault();if(!replacementRef.current)openChoiceFocusRef.current?.focus({preventScroll:true});}}>
        <DialogHeader><DialogTitle>Choose visible objects</DialogTitle><DialogDescription>Choose one to four objects for document view. You can open one Curve in focus view. The complete original document is retained.</DialogDescription></DialogHeader>
        {openChoice&&openChoice.curveBodies.length>0&&<div className="open-view-fields">
          <label>Open view<select data-testid="open-view-mode" value={openChoice.view.kind} onChange={event=>setOpenChoice(current=>current&&{...current,view:event.target.value==='curve-focus'?{kind:'curve-focus',bodyId:current.curveBodies[0].id,count:65}:{kind:'document'}})}><option value="document">Document view</option><option value="curve-focus">Curve focus</option></select></label>
          {openChoice.view.kind==='curve-focus'&&<label>Curve<select data-testid="open-focus-curve" value={openChoice.view.bodyId} onChange={event=>setOpenChoice(current=>current&&{...current,view:{kind:'curve-focus',bodyId:event.target.value,count:65}})}>{openChoice.curveBodies.map(body=><option key={body.id} value={body.id}>{openBodyLabels.get(body.id)}</option>)}</select></label>}
          <p>Curve focus shows one Curve. The checkboxes retain your document-view choice.</p>
        </div>}
        <div className="open-body-list">{openChoice?.bodies.map(body => <label key={body.id}>
          <input type="checkbox" data-testid={'open-body-' + body.id} checked={openChoice.selected.includes(body.id)}
            onChange={event => setOpenChoice(current => current && {...current,selected:event.target.checked ? [...current.selected,body.id] : current.selected.filter(id => id !== body.id)})} />{openBodyLabels.get(body.id)}
        </label>)}</div>
        <p>{openChoice?.selected.length ?? 0} selected</p>
        <div className="cad-editor-transition-actions"><Button variant="outline" onClick={clearReplacement}>Cancel</Button>
          <Button data-testid="open-display-confirm" disabled={!openChoice || openChoice.selected.length < 1 || openChoice.selected.length > 4} onClick={() => run(() => {
            if (!openChoice) return;
            const choice=openChoice;setOpenChoice(null);try{receiveTarget(choice.id,choice.anchor,{kind:'open',text:choice.text,filename:choice.filename,displayBodyIds:choice.selected,view:choice.view},choice.focus,choice.recovery);}catch(cause){replacementError(cause);}
          })}>Open</Button></div>
      </DialogContent>
    </Dialog>
    <footer className="app-status"><span className="status-led"/><span>{busy ? 'Preparing display' : Object.keys(snapshot.pending).length ? 'Pending fields' : snapshot.view.kind==='curve-focus'?'Curve focus':'Accepted document'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-divider"/><span data-testid="app-unsaved-state" aria-live="polite">{effectiveUnsaved?'Unsaved changes':'No new changes'}</span><span data-testid="app-draft-state" className={hasDraft?'status-pending':undefined}>{hasDraft?'Draft pending':'No draft'}</span><span data-testid="app-recovery-state">{recoveryStatus==='ready'?'Recovery copy ready':recoveryStatus==='failed'?'Recovery unavailable':recoveryStatus==='loading'?'Checking recovery':'No recovery copy'}</span><span className="status-spacer"/><span>History {snapshot.history.index + 1} / {snapshot.history.count}</span><span className="status-divider"/><span>XYZ · mm</span></footer>
  </div>;
}

export function App() {
  const routeMode = () => location.hash.startsWith('#/sketches/') ? 'driving' : location.hash.startsWith('#/assemblies/') ? 'assembly' : location.hash.startsWith('#/lofts/') ? 'loft' : location.hash.startsWith('#/features/') ? 'feature' : 'direct';
  const [mode, setMode] = useState(routeMode);
  const [visited, setVisited] = useState(() => ({direct:routeMode()==='direct',feature:routeMode()==='feature',loft:routeMode()==='loft',assembly:routeMode()==='assembly',driving:routeMode()==='driving'}));
  useEffect(() => {
    const update = () => {
      const next = routeMode();
      setMode(next);
      setVisited(prior => ({direct:prior.direct || next==='direct',feature:prior.feature || next==='feature',loft:prior.loft || next==='loft',assembly:prior.assembly || next==='assembly',driving:prior.driving || next==='driving'}));
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  // Mode navigation keeps each host-owned native session and its pending fields.
  return <>{visited.direct && <div className="cad-mode" hidden={mode!=='direct'}><DirectApp /></div>}
    {visited.feature && <div className="cad-mode" hidden={mode!=='feature'}><FeatureApp /></div>}
    {visited.loft && <div className="cad-mode" hidden={mode!=='loft'}><LoftApp /></div>}
    {visited.assembly && <div className="cad-mode" hidden={mode!=='assembly'}><AssemblyApp /></div>}
    {visited.driving && <div className="cad-mode" hidden={mode!=='driving'}><DrivingSketchApp /></div>}</>;
}
