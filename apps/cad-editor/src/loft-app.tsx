import { useEffect, useRef, useState } from 'react';
import { Box, Download, FolderOpen, Maximize, Redo2, Spline, Undo2 } from 'lucide-react';
import { parseNurbsSourceLoftFeatureGraph } from '@barocss/cad';
import { CadEditorError, createCadEditorLoftSession, type CadEditorLoftSnapshot } from '@barocss/cad-editor';
import { CadEditorNurbsLoftEditor, type CadEditorLoftDisplayReceipt } from '@barocss/cad-editor/react';
import fixture from '../fixtures/nurbs-loft-sections.authored-graph.json?raw';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted, readCadEditorFile } from './file-actions';

const native = {maximumSources:3,maximumSourceEdits:3,maximumFeatureEvaluations:4,maximumLoftSections:3} as const;
const FILE_BYTES = 1048576;
interface Replacement { text:string; filename:string; anchor:string }
function errorText(error: CadEditorError) {
  if(error.code==='STALE')return 'The document changed. Try the action again.';
  if(error.code==='BUDGET')return 'This file or change exceeds the supported size.';
  if(error.code==='DISPLAY')return 'Cannot display this change. The accepted shape is retained.';
  if(error.code==='FILE')return 'Open a supported NURBS loft graph file.';
  return 'Cannot apply this change. Check the original point, weight and source.';
}
function anchor(snapshot:CadEditorLoftSnapshot) {
  return JSON.stringify([snapshot.generation,snapshot.displayGeneration,snapshot.view,snapshot.selection,snapshot.pending]);
}

export function LoftApp() {
  const [session] = useState(()=>createCadEditorLoftSession(parseNurbsSourceLoftFeatureGraph(fixture,native).document,{native}));
  const [snapshot,setSnapshot] = useState(()=>session.getSnapshot());
  const [receipt,setReceipt] = useState<CadEditorLoftDisplayReceipt|null>(null);
  const [error,setError] = useState<CadEditorError|null>(null);
  const [filename,setFilename] = useState('NURBS loft');
  const [replacement,setReplacement] = useState<Replacement|null>(null);
  const [reading,setReading] = useState(false);
  const [captured,setCaptured] = useState(false);
  const [fitRequest,setFitRequest] = useState(0);
  const [readRequest,setReadRequest] = useState(0);
  const root = useRef<HTMLDivElement>(null),file = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Set<number>()),fileBusy = useRef(false),decision = useRef<Replacement|null>(null);
  const opening = useRef<{token:string;filename:string}|null>(null);
  const navigationEpoch = useRef(0);
  const flowMode = new URLSearchParams(location.search).has('flow');
  function captureFor(id:number) {
    return !!root.current?.hasPointerCapture(id)||[...(root.current?.querySelectorAll('*')??[])].some(node=>node.hasPointerCapture(id));
  }
  function hasCapture(){return [...pointers.current].some(captureFor);}
  function blocked(allowDecision=false) {
    const current=session.getSnapshot();
    return current.disposed||current.candidate!==null||fileBusy.current||hasCapture()||(!allowDecision&&decision.current!==null)
      ||!root.current?.getClientRects().length;
  }
  function run(action:()=>unknown, requiresEmptyDraft=false) {
    if(blocked()||requiresEmptyDraft&&Object.keys(session.getSnapshot().pending.fields).length>0)return;
    try{setError(null);action();}catch(cause){setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','The action failed.',{},cause));}
  }
  const busy=snapshot.candidate!==null||reading||captured||replacement!==null;
  const draft=Object.keys(snapshot.pending.fields).length>0;
  useEffect(()=>session.subscribe(setSnapshot),[session]);
  useEffect(()=>()=>session.dispose(),[session]);
  useEffect(()=>{
    const changed=()=>{navigationEpoch.current++;if(!location.hash.startsWith('#/lofts/'))clearDecision();};
    window.addEventListener('hashchange',changed);
    return()=>window.removeEventListener('hashchange',changed);
  },[session]);
  useEffect(()=>{
    let listening=true;
    const refresh=()=>{if(listening)setCaptured(hasCapture());};
    const down=(event:PointerEvent)=>{if(!(event.target instanceof Element)||!root.current?.contains(event.target))return;
      pointers.current.add(event.pointerId);setTimeout(refresh,0);};
    const release=(event:PointerEvent)=>{if(!captureFor(event.pointerId))pointers.current.delete(event.pointerId);refresh();
      setTimeout(()=>{if(!listening)return;if(!captureFor(event.pointerId))pointers.current.delete(event.pointerId);refresh();},0);};
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);
    window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    return()=>{listening=false;pointers.current.clear();window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',release,true);
      window.removeEventListener('pointercancel',release,true);window.removeEventListener('lostpointercapture',release,true);};
  },[session]);
  useEffect(()=>{
    if(!flowMode)return;
    Object.assign(window,{__cadLoftFlow:{session,snapshot:()=>session.getSnapshot(),display:()=>structuredClone(receipt),
      readFrame:()=>setReadRequest(value=>value+1),error:()=>error?{code:error.code,message:error.message,context:error.context,
        cause:error.cause instanceof Error?{message:error.cause.message,code:'code'in error.cause?error.cause.code:null}:null}:null}});
    return()=>{delete(window as Window&{__cadLoftFlow?:unknown}).__cadLoftFlow;};
  },[session,receipt,error,flowMode]);
  function clearDecision(){decision.current=null;setReplacement(null);root.current?.removeAttribute('data-loft-host-busy');}
  function prepareTarget(target:Replacement) {
    const candidate=session.prepareOpen(target.text);opening.current={token:candidate.token,filename:target.filename};
  }
  function receive(text:string,name:string,before:string,epoch=navigationEpoch.current) {
    const current=session.getSnapshot();
    if(epoch!==navigationEpoch.current||!location.hash.startsWith('#/lofts/')||!root.current?.isConnected
      ||!root.current.getClientRects().length||current.disposed||current.candidate||anchor(current)!==before||hasCapture())
      throw new CadEditorError('STALE','The document or view changed while the file was read.',{field:'open'});
    if(text.length>FILE_BYTES||new TextEncoder().encode(text).byteLength>FILE_BYTES)throw new CadEditorError('BUDGET','Loft files are limited to1048576bytes.',{field:'open'});
    // Validate the authored family before showing a replacement decision. Derived packets are not files.
    parseNurbsSourceLoftFeatureGraph(text,native);
    const target={text,filename:name,anchor:before};
    if(session.getSnapshot().dirty){decision.current=target;root.current?.setAttribute('data-loft-host-busy','true');setReplacement(target);}
    else prepareTarget(target);
  }
  async function openFile(input:File|undefined) {
    if(!input||blocked()||Object.keys(session.getSnapshot().pending.fields).length>0)return;
    const before=anchor(session.getSnapshot()),epoch=navigationEpoch.current;fileBusy.current=true;root.current?.setAttribute('data-loft-host-busy','true');setReading(true);
    try{setError(null);if(input.size>FILE_BYTES)throw new CadEditorError('BUDGET','Loft files are limited to1048576bytes.');
      const text=await readCadEditorFile(input);receive(text,input.name,before,epoch);
    }catch(cause){opening.current=null;setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot open this loft.',{field:'open'},cause));}
    finally{fileBusy.current=false;setReading(false);if(!decision.current)root.current?.removeAttribute('data-loft-host-busy');}
  }
  function newSample(){run(()=>receive(fixture,'NURBS loft',anchor(session.getSnapshot())),true);}
  function continueReplacement() {
    const target=decision.current;if(!target||blocked(true))return;
    if(anchor(session.getSnapshot())!==target.anchor){clearDecision();setError(new CadEditorError('STALE','The document changed. Choose the file again.',{field:'open'}));return;}
    try{prepareTarget(target);clearDecision();}catch(cause){setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot open this loft.',{field:'open'},cause));}
  }
  function downloadBeforeReplacement() {
    if(blocked(true))return;
    try{downloadAccepted(session);}catch(cause){setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot download this loft.',{field:'download'},cause));}
  }
  const nodes=snapshot.accepted.document.nodes.filter(node=>node.kind==='source-curve-edit');
  return <div ref={root} className="cad-app" data-loft-host-busy={reading||replacement?'true':undefined}>
    <header className="app-header"><a className="app-brand" href="#/lofts/loft_supported_graph" onClick={event=>{if(blocked())event.preventDefault();}}><Box size={20}/><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger disabled={busy}>File</MenubarTrigger><MenubarContent>
        <MenubarItem data-testid="loft-new" disabled={busy||draft} onSelect={newSample}>New NURBS loft</MenubarItem>
        <MenubarItem disabled={busy||draft} onSelect={()=>run(()=>file.current?.click())}>Open native loft graph…</MenubarItem>
        <MenubarItem disabled={busy} onSelect={()=>run(()=>downloadAccepted(session))}>Download accepted graph</MenubarItem>
        <MenubarSeparator/><MenubarItem disabled={busy} onSelect={()=>run(()=>{location.hash='/documents/cad_editor_fixture';})}>Surface document</MenubarItem>
        <MenubarItem disabled={busy} onSelect={()=>run(()=>{location.hash='/features/cad_boolean_extrusion';})}>Boolean extrusion</MenubarItem>
      </MenubarContent></MenubarMenu></Menubar>
      <span className="document-title">{filename}{snapshot.dirty&&<span className="dirty-dot"> •</span>}</span>
      <Button variant="outline" size="sm" data-testid="loft-open" disabled={busy||draft} onClick={()=>run(()=>file.current?.click())}><FolderOpen/>Open</Button>
      <Button size="sm" data-testid="loft-download" disabled={busy} onClick={()=>run(()=>downloadAccepted(session))}><Download/>Download</Button>
      <input ref={file} type="file" accept=".json" className="file-input" aria-label="Open native NURBS loft graph file" onChange={event=>{void openFile(event.target.files?.[0]);event.target.value='';}}/>
    </header>
    <div className="app-toolbar"><span className="breadcrumb"><Spline size={13}/>NURBS loft<span className="toolbar-divider"/>{snapshot.view.kind==='section'?'Section view':'Loft view'}</span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" data-testid="loft-undo" aria-label="Undo" disabled={busy||draft||!snapshot.history.canUndo} onClick={()=>run(()=>session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="loft-redo" aria-label="Redo" disabled={busy||draft||!snapshot.history.canRedo} onClick={()=>run(()=>session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" data-testid="loft-fit" disabled={busy||draft} onClick={()=>run(()=>setFitRequest(value=>value+1),true)}><Maximize/>Fit</Button>
    </div></div>
    {error&&<div className="app-error" role="alert">{errorText(error)}<Button variant="ghost" size="xs" onClick={()=>setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace"><aside className="document-tree" aria-label="Loft objects"><h2><Spline size={15}/>Objects</h2>
      {nodes.map((node,index)=><button key={node.id} type="button" data-testid={'loft-section-'+node.id} disabled={busy||draft} className={'tree-body'+(snapshot.view.kind==='section'&&snapshot.view.nodeId===node.id?' selected':'')}
        aria-pressed={snapshot.view.kind==='section'&&snapshot.view.nodeId===node.id} onClick={()=>run(()=>session.prepareView({kind:'section',nodeId:node.id}))}><Spline size={14}/><span>Section {index+1}</span></button>)}
      <button type="button" data-testid="loft-show-output" disabled={busy||draft} className={'tree-body'+(snapshot.view.kind==='loft'?' selected':'')} aria-pressed={snapshot.view.kind==='loft'} onClick={()=>run(()=>session.prepareView({kind:'loft'}))}><Box size={14}/><span>Loft</span></button>
      <Button type="button" variant="ghost" size="xs" data-testid={snapshot.accepted.loft.status==='active'?'loft-suppress':'loft-resume'} disabled={busy||draft} onClick={()=>run(()=>session.prepareSuppression(snapshot.accepted.loft.status==='active'))}>{snapshot.accepted.loft.status==='active'?'Suppress loft':'Resume loft'}</Button>
    </aside><main className="main-workspace"><CadEditorNurbsLoftEditor session={session} fitRequest={fitRequest} readRequest={readRequest} onDisplay={setReceipt}
      onError={failure=>{opening.current=null;setError(failure);}} onAccepted={(_,candidate)=>{setError(null);if(opening.current?.token===candidate.token){setFilename(opening.current.filename);opening.current=null;}}}/></main></div>
    <footer className="app-status"><span className="status-led"/><span>Accepted document</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-divider"/>
      <span>{draft?'Pending fields':snapshot.accepted.loft.status==='suppressed'?'Loft suppressed':snapshot.dirty?'Unsaved changes':'No new changes'}</span><span className="status-spacer"/><span>History {snapshot.history.index+1} / {snapshot.history.count}</span><span className="status-divider"/><span>XYZ · mm</span></footer>
    <Dialog open={replacement!==null} onOpenChange={open=>{if(!open&&!snapshot.candidate)clearDecision();}}><DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="loft-replacement-dialog">
      <DialogHeader><DialogTitle>Replace this loft?</DialogTitle><DialogDescription>Download the accepted graph or continue without downloading. Pending fields are not included in a download.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" data-testid="loft-replacement-cancel" onClick={clearDecision}>Cancel</Button><Button variant="outline" data-testid="loft-replacement-download" onClick={downloadBeforeReplacement}>Download copy</Button>
        <Button data-testid="loft-replacement-continue" onClick={continueReplacement}>Continue without downloading</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
