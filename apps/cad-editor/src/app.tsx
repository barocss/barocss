import { useEffect, useRef, useState } from 'react';
import { Box, ChevronRight, CircleHelp, Download, FolderOpen, Layers3, Maximize, Redo2, Undo2 } from 'lucide-react';
import { parseCadDocument } from '@barocss/cad';
import { CadEditorError, createCadEditorSession, type CadEditorExportResult, type CadEditorGeometryAnalysisResult, type CadEditorCurveLength } from '@barocss/cad-editor';
import { CadEditor, CadEditorExportReview, useCadEditorSnapshot, type CadEditorDisplayOptions, type CadEditorDisplayReceipt } from '@barocss/cad-editor/react';
import fixtureText from '../fixtures/canonical-surface-and-curve.cad-document.json?raw';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted, downloadReviewedExport, readCadEditorFile } from './file-actions';
import { FeatureApp } from './feature-app';
import { ReplacementDialog } from './replacement-dialog';
import { RecoveryDialog } from './recovery-dialog';
import { buildRecoveryRecord, readRecoverySlot, writeRecoveryCopy, deleteRecoveryCopy, RECOVERY_CHANGE_CHANNEL, type RecoveryRecord, type RecoverySlot } from './recovery-storage';
import { captureReplacementAnchor, assertReplacementCurrent, copyReplacementTarget, type ReplacementAnchor, type ReplacementTarget } from './document-replacement';

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
interface OpenChoice { id:number;anchor:ReplacementAnchor;focus:HTMLElement|null;text:string;filename:string;bodies:{id:string;name:string}[];selected:string[] }

function DirectApp() {
  const [session] = useState(() => createCadEditorSession(parseCadDocument(fixtureText).document));
  const snapshot = useCadEditorSnapshot(session);
  const [error, setError] = useState<CadEditorError | null>(null);
  const [filename, setFilename] = useState('Weighted surface');
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
    recoveryMutation.current=true;recoveryReadSerial.current++;setRecoveryBusy(true);setRecoveryMessage(null);
    let message:string;
    try{
      if(kind==='delete')await deleteRecoveryCopy(raw);else {if(!record)throw new Error('A captured document is required.');await writeRecoveryCopy(raw,record);}
      message=kind==='delete'?'Recovery copy deleted.':'Copy stored in this browser.'+(record?.hadPending?' Draft fields were not copied.':'')+' Later changes are not included.';
    }catch(cause){message=cause instanceof Error&&'code' in cause&&cause.code==='STALE'?'The recovery copy changed. Review it before trying again.':'Cannot change the recovery copy. The current document is retained.';}
    finally{recoveryMutation.current=false;setRecoveryBusy(false);cancelRecoveryConfirmation();}
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
      const anchor=captureReplacementAnchor(session);replacementAttempt.current=true;setRecoveryChecking(true);
      const slot=await readRecoverySlot();if(id!==requestSerial.current)return;
      assertReplacementCurrent(session,anchor);
      if(slot.raw!==observed.raw||!slot.record||slot.error)throw new Error('The recovery copy changed or cannot be read.');
      const record=slot.record;
      setRecoveryHandover(true);setRecoveryOpen(false);cancelRecoveryConfirmation();
      receiveTarget(id,anchor,{kind:'open',text:record.text,filename:record.filename,displayBodyIds:record.displayBodyIds},fileMenu.current,{raw:slot.raw,wasDirty:record.wasDirty,hadPending:record.hadPending});
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
      exportReview:()=>structuredClone(exportReview),geometryAnalysis:()=>structuredClone(geometryAnalysis),curveLength:()=>structuredClone(curveLength),recovery:()=>({status:recoveryStatus,slot:structuredClone(recoverySlot),unsaved:recoveredUnsavedRef.current}),readFrame:()=>setReadRequest(value=>value+1),
      setDisplayRefusal: (refuse: boolean) => setDisplayOptions(refuse ? { ...defaultDisplay, document: { ...defaultDisplay.document, native: { ...defaultDisplay.document.native, countU: 1 } } } : defaultDisplay),
      setMounted: (mounted: boolean) => { setMount(mounted); if (mounted) setMountKey(key => key + 1); },
      session,
    };
    Object.assign(window, { __cadEditorFlow: api });
    return () => { delete (window as Window & { __cadEditorFlow?: unknown }).__cadEditorFlow; };
  }, [flowMode, session, receipt, exportReview, geometryAnalysis, curveLength, error,recoveryStatus,recoverySlot]);
  function clearReplacement() {
    requestSerial.current++;setReplacementBusy(false);setRecoveryChecking(false);recoveryCommitRef.current=null;replacementAttempt.current=false;replacementRef.current=null;setReplacement(null);setOpenChoice(null);
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
    const candidate=session.prepareOpen(target.text,target.displayBodyIds?{displayBodyIds:target.displayBodyIds}:undefined);
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
      const anchor=captureReplacementAnchor(session),focus=openButton.current;replacementAttempt.current=true;
      const text=await readCadEditorFile(file);
      if(id!==requestSerial.current)return;
      assertReplacementCurrent(session,anchor);
      let document;
      try{document=parseCadDocument(text).document;}catch(cause){throw new CadEditorError('NATIVE','Native document Open failed.',{},cause);}
      if(document.bodies.length>4){setOpenChoice({id,anchor,focus,text,filename:file.name,bodies:document.bodies,selected:[]});return;}
      receiveTarget(id,anchor,{kind:'open',text,filename:file.name},focus);
    }catch(cause){if(id===requestSerial.current)replacementError(cause);}
  };
  const newSample = () => {
    try{clearReplacement();setError(null);const anchor=captureReplacementAnchor(session);replacementAttempt.current=true;receiveTarget(requestSerial.current,anchor,{kind:'sample',text:fixtureText,filename:'Weighted surface'},fileMenu.current);}
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

  return <div className="cad-app">
    <header className="app-header">
      <a className="app-brand" href="#/projects"><Box size={20} strokeWidth={1.6} /><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar">
        <MenubarMenu><MenubarTrigger ref={fileMenu}>File</MenubarTrigger><MenubarContent>
          <MenubarItem onSelect={newSample} disabled={busy}>New sample<MenubarShortcut>01</MenubarShortcut></MenubarItem>
          <MenubarItem onSelect={chooseOpenFile} disabled={busy}>Open native document…</MenubarItem>
          <MenubarItem disabled={busy} onSelect={() => { location.hash = "/features/cad_boolean_extrusion"; }}>New Boolean extrusion</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={showRecovery} disabled={busy}>Recovery copies…</MenubarItem>
          <MenubarItem onSelect={() => run(downloadCurrent)}>Download accepted document</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => { location.hash = '/projects'; }}>Projects</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent>
          <MenubarItem disabled={!snapshot.history.canUndo || busy || hasDraft} onSelect={() => run(() => session.prepareUndo())}>Undo</MenubarItem>
          <MenubarItem disabled={!snapshot.history.canRedo || busy || hasDraft} onSelect={() => run(() => session.prepareRedo())}>Redo</MenubarItem>
          <MenubarSeparator/><MenubarItem onSelect={() => run(() => session.discardPending())}>Discard pending fields</MenubarItem>
        </MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarItem onSelect={() => setFitRequest(value => value + 1)}>Fit document</MenubarItem></MenubarContent></MenubarMenu>
      </Menubar>
      <span className="document-title">{filename}<span className="dirty-dot" aria-label={effectiveUnsaved ? 'Unsaved accepted changes' : 'Accepted content unchanged'}>{effectiveUnsaved ? ' •' : ''}</span></span>

      <Button ref={openButton} data-testid="document-open" variant="outline" size="sm" onClick={chooseOpenFile} disabled={busy}><FolderOpen/>Open</Button>
      <Button size="sm" onClick={() => run(downloadCurrent)}><Download/>Download</Button>
      <input ref={fileInput} type="file" accept=".json,.cad-document.json" aria-label="Open native document file" className="file-input" onChange={event => { void openFile(event.target.files?.[0]); event.target.value = ''; }}/>
    </header>
    <div className="app-toolbar"><span className="breadcrumb"><a href="#/projects">Projects</a><ChevronRight size={12}/><span>{filename}</span></span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!snapshot.history.canUndo || busy || hasDraft} onClick={() => run(() => session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!snapshot.history.canRedo || busy || hasDraft} onClick={() => run(() => session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" onClick={() => setFitRequest(value => value + 1)}><Maximize/>Fit</Button><Button variant="ghost" size="sm" data-testid="fit-selected-body" disabled={!snapshot.selectedBodyId} onClick={() => setFitSelectedRequest(value => value + 1)}>Fit selected</Button>
      {mount && <CadEditorExportReview session={session}
        onReview={result=>{setExportReview(result);if(result!==null)setError(current=>current?.context.field==='document-export'?null:current);}}
        onError={failure=>{setReadRequest(value=>value+1);setError(failure);}}
        onDownload={downloadReviewedExport}/>}
    </div></div>
    {error && <div className="app-error" role="alert">{actionError(error)}<Button variant="ghost" size="xs" onClick={() => setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace">
      <aside className="document-tree"><h2><Layers3 size={15}/>Document</h2><div className="tree-document"><Box size={16}/><span>{filename}</span></div>
        <div className="tree-section">BODIES <span>{snapshot.accepted.document.bodies.length}</span></div>
        {snapshot.accepted.document.bodies.map(body => {
          const binding = snapshot.accepted.bodyBindings.find(item => item.bodyId === body.id)!;
          const selected = snapshot.selectedBodyId === body.id;
          const shown = snapshot.displayBodyIds.includes(body.id);
          const editable = snapshot.bodyCapabilities.find(item => item.bodyId === body.id)?.canEditSurfacePole;
          return <div key={body.id} className="tree-body-row">
            <button className={'tree-body' + (selected ? ' selected' : '')} data-testid={'body-select-' + body.id}
              onClick={() => run(() => session.requestSelection(binding.geometryKind === 'surface' ? { bodyId: body.id, uIndex: 1, vIndex: 1 } : { bodyId: body.id }))} aria-pressed={selected}>
              <span className={'body-symbol ' + binding.geometryKind}>{binding.geometryKind === 'surface' ? '▱' : '╱'}</span><span>{body.name}<small>{editable ? 'Editable surface' : binding.geometryKind === 'surface' ? 'Read-only surface' : 'Read-only curve'}</small></span>
            </button>
            <input type="checkbox" data-testid={'body-visible-' + body.id} aria-label={(shown ? 'Hide ' : 'Show ') + body.name}
              checked={shown} disabled={busy} onChange={() => run(() => session.prepareDisplayBodies(shown ? snapshot.displayBodyIds.filter(id => id !== body.id) : [...snapshot.displayBodyIds, body.id]))} />
          </div>;
        })}
        <div className="tree-details"><span>Units</span><strong>mm</strong><span>Axes</span><strong>XYZ</strong>{snapshot.selection && <><span>Control grid</span><strong>{snapshot.selection.countU} × {snapshot.selection.countV}</strong></>}</div>
        <div className="tree-foot"><CircleHelp size={14}/><p>Select a surface to edit its control points. Use the checkboxes to show or hide objects.</p></div>
      </aside>
      <main className="main-workspace">
        {projectView ? <section className="projects-view"><span className="eyebrow">LOCAL DOCUMENTS</span><h1>Projects</h1><p>Start with the weighted surface, or open a native document.</p><button className="sample-project" data-testid="project-new-sample" onClick={newSample}><span className="sample-symbol">▱</span><span><strong>Weighted surface</strong><small>Quadratic 3 × 3 surface · Reference line</small></span><ChevronRight size={20}/></button><Button variant="outline" onClick={chooseOpenFile}><FolderOpen/>Open document</Button></section> : mount && <CadEditor key={mountKey} session={session} displayOptions={displayOptions} fitRequest={fitRequest} fitSelectedRequest={fitSelectedRequest || undefined} readRequest={readRequest}
          onLength={result=>{setCurveLength(result);if(result!==null)setError(current=>current?.context.field==='curve-length'?null:current);}}
          onAnalysis={result=>{setGeometryAnalysis(result);if(result!==null)setError(current=>current?.context.field==='geometry-analysis'?null:current);}}
          onError={failure => { pendingOpen.current=null;setError(failure); }} onAccepted={(accepted,candidate) => { setError(null);if(candidate.kind==='open'&&pendingOpen.current?.token===candidate.token){setFilename(pendingOpen.current.filename);provenance(pendingOpen.current.recovery?.wasDirty??false);if(pendingOpen.current.recovery)setRecoveryMessage(pendingOpen.current.recovery.hadPending?'Recovery copy opened. Draft fields were not restored.':'Recovery copy opened.');}pendingOpen.current=null;location.hash='/documents/'+accepted.accepted.document.documentId; }} onDisplay={setReceipt}/>}
      </main>
    </div>
    <ReplacementDialog open={replacement!==null} currentName={filename} action={replacement?.target.kind??'open'} targetName={replacement?.target.filename??''} downloadStarted={replacement?.downloadStarted??false} returnFocus={replacement?.focus??null} busy={replacementBusy} onCancel={clearReplacement} onDownload={downloadReplacementCopy} onContinue={continueReplacement}/>
    <RecoveryDialog open={recoveryOpen} currentName={recoveryDecision.current?.record?.filename??filename} copy={recoverySlot?.record?{name:recoverySlot.record.filename,savedAtText:new Date(recoverySlot.record.savedAtUTC).toLocaleString(),savedWithPending:recoverySlot.record.hadPending}:null}
      status={recoveryStatus} busy={recoveryBusy} canSave={recoverySlot!==null&&!busy&&!snapshot.disposed&&!recoveryChecking} canOpen={!!recoverySlot?.record&&!busy&&!hasDraft&&!recoveryChecking} canDelete={recoverySlot?.raw!==undefined&&recoverySlot!==null&&!recoveryChecking}
      confirmation={recoveryConfirmation} message={recoveryMessage} onSave={saveRecovery} onOpen={()=>{void openRecovery();}} onDelete={removeRecovery} onConfirm={confirmRecovery} onCancelConfirmation={cancelRecoveryConfirmation} onCancel={closeRecovery} returnFocus={fileMenu.current} suppressReturnFocus={recoveryHandover}/>
    <Dialog open={openChoice !== null} onOpenChange={open => { if (!open) clearReplacement(); }}>
      <DialogContent className="cad-editor-help-dialog" data-testid="open-display-choice" onCloseAutoFocus={event=>{event.preventDefault();if(!replacementRef.current)openButton.current?.focus({preventScroll:true});}}>
        <DialogHeader><DialogTitle>Choose visible objects</DialogTitle><DialogDescription>Select one to four objects to display. The complete document will be opened.</DialogDescription></DialogHeader>
        <div className="open-body-list">{openChoice?.bodies.map(body => <label key={body.id}>
          <input type="checkbox" data-testid={'open-body-' + body.id} checked={openChoice.selected.includes(body.id)}
            onChange={event => setOpenChoice(current => current && {...current,selected:event.target.checked ? [...current.selected,body.id] : current.selected.filter(id => id !== body.id)})} />{body.name}
        </label>)}</div>
        <p>{openChoice?.selected.length ?? 0} selected</p>
        <div className="cad-editor-transition-actions"><Button variant="outline" onClick={clearReplacement}>Cancel</Button>
          <Button data-testid="open-display-confirm" disabled={!openChoice || openChoice.selected.length < 1 || openChoice.selected.length > 4} onClick={() => run(() => {
            if (!openChoice) return;
            const choice=openChoice;setOpenChoice(null);try{receiveTarget(choice.id,choice.anchor,{kind:'open',text:choice.text,filename:choice.filename,displayBodyIds:choice.selected},choice.focus);}catch(cause){replacementError(cause);}
          })}>Open</Button></div>
      </DialogContent>
    </Dialog>
    <footer className="app-status"><span className="status-led"/><span>{busy ? 'Preparing display' : Object.keys(snapshot.pending).length ? 'Pending fields' : 'Accepted document'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-divider"/><span data-testid="app-unsaved-state" aria-live="polite">{effectiveUnsaved?'Unsaved changes':'No new changes'}</span><span data-testid="app-draft-state">{hasDraft?'Draft pending':'No draft'}</span><span data-testid="app-recovery-state">{recoveryStatus==='ready'?'Recovery copy ready':recoveryStatus==='failed'?'Recovery unavailable':recoveryStatus==='loading'?'Checking recovery':'No recovery copy'}</span><span className="status-spacer"/><span>History {snapshot.history.index + 1} / {snapshot.history.count}</span><span className="status-divider"/><span>XYZ · mm</span></footer>
  </div>;
}

export function App() {
  const [featureMode, setFeatureMode] = useState(() => location.hash.startsWith('#/features/'));
  const [visited, setVisited] = useState(() => ({direct:!location.hash.startsWith('#/features/'),feature:location.hash.startsWith('#/features/')}));
  useEffect(() => {
    const update = () => {
      const feature = location.hash.startsWith('#/features/');
      setFeatureMode(feature);
      setVisited(prior => ({direct:prior.direct || !feature,feature:prior.feature || feature}));
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  // Mode navigation keeps each host-owned native session and its pending fields.
  return <>{visited.direct && <div className="cad-mode" hidden={featureMode}><DirectApp /></div>}
    {visited.feature && <div className="cad-mode" hidden={!featureMode}><FeatureApp /></div>}</>;
}
