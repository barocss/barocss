import { useEffect, useRef, useState } from 'react';
import { Box, Download, FolderOpen, Maximize, Redo2, Undo2 } from 'lucide-react';
import { parseCadAssembly, serializeCadDocument, CadAssemblyError, CadDocumentError, type CadAssemblyResult } from '@barocss/cad';
import { CadEditorError, createCadEditorAssemblySession, type CadEditorAssemblySnapshot } from '@barocss/cad-editor';
import { CadEditorAssemblyEditor, type CadEditorAssemblyDisplayReceipt, type CadEditorAssemblyFrameReceipt } from '@barocss/cad-editor/react';
import fixture from '../fixtures/assembly-authored.cad-assembly.json?raw';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from './components/ui/menubar';
import { downloadAccepted } from './file-actions';
import { readCadAssemblyFile } from './assembly-file-actions';

const INITIAL_DISPLAY = ['child','surface_grandchild','shared_root','asset_b_instance'];
interface Target { text:string; filename:string; anchor:string; displayInstanceIds:string[] }
interface Choice { text:string; filename:string; anchor:string; native:CadAssemblyResult; ids:string[] }
function anchor(s:CadEditorAssemblySnapshot) { return JSON.stringify([s.generation,s.displayGeneration,s.display,s.selection,s.pending]); }
function message(error:CadEditorError) {
  if(error.code==='STALE')return 'The assembly or view changed. Try the action again.';
  if(error.code==='BUDGET')return 'This file or change exceeds the supported size.';
  if(error.code==='DISPLAY')return 'Cannot display this change. Review the current assembly.';
  if(error.code==='FILE')return 'Open a supported native assembly file.';
  return 'Cannot apply this change. Check the local pose and parent.';
}
function fileError(cause:unknown) {
  if(cause instanceof CadEditorError)return cause;
  const native=cause instanceof CadAssemblyError||cause instanceof CadDocumentError;
  const code=native&&cause.code==='BUDGET'?'BUDGET':native&&cause.code==='REVISION'?'REVISION':native&&cause.code==='STALE'?'STALE':'FILE';
  return new CadEditorError(code,'Cannot open this assembly.',{field:'assembly-open'},cause);
}

export function AssemblyApp() {
  const [session]=useState(()=>{const value=createCadEditorAssemblySession(parseCadAssembly(fixture).assembly,{displayInstanceIds:INITIAL_DISPLAY});value.selectInstance('child');return value;});
  const [snapshot,setSnapshot]=useState(()=>session.getSnapshot());
  const [display,setDisplay]=useState<CadEditorAssemblyDisplayReceipt|null>(null),[frame,setFrame]=useState<CadEditorAssemblyFrameReceipt|null>(null);
  const [error,setError]=useState<CadEditorError|null>(null),[filename,setFilename]=useState('Assembly');
  const [replacement,setReplacement]=useState<Target|null>(null),[choice,setChoice]=useState<Choice|null>(null);
  const [reading,setReading]=useState(false),[captured,setCaptured]=useState(false),[fitRequest,setFitRequest]=useState(0),[readRequest,setReadRequest]=useState(0);
  const root=useRef<HTMLDivElement>(null),file=useRef<HTMLInputElement>(null),pointers=useRef(new Set<number>());
  const fileBusy=useRef(false),decision=useRef<Target|null>(null),displayChoice=useRef<Choice|null>(null),navigationEpoch=useRef(0);
  const opening=useRef<{token:string;filename:string}|null>(null),lastDisplay=useRef([...INITIAL_DISPLAY]);
  const flowMode=new URLSearchParams(location.search).has('flow');
  function captureFor(id:number){return [...document.querySelectorAll('*')].some(node=>node.hasPointerCapture(id));}
  function hasCapture(){return [...pointers.current].some(captureFor);}
  function visible(){return root.current?.isConnected&&!!root.current.getClientRects().length&&location.hash.startsWith('#/assemblies/');}
  function fitReady(){const s=session.getSnapshot();return display?.state.status==='ready'&&display.generation===s.generation&&display.displayGeneration===s.displayGeneration
    &&!!root.current?.querySelector('[data-assembly-ready="true"]')&&s.display.instanceIds.length>0;}
  function blocked(allowDecision=false){const s=session.getSnapshot();return s.disposed||s.candidate!==null||fileBusy.current||hasCapture()||!visible()||(!allowDecision&&(decision.current!==null||displayChoice.current!==null));}
  function markBusy(){root.current?.setAttribute('data-assembly-host-busy','true');}
  function clearDecisions(){decision.current=null;displayChoice.current=null;setReplacement(null);setChoice(null);if(!fileBusy.current)root.current?.removeAttribute('data-assembly-host-busy');}
  function run(action:()=>unknown,emptyDraft=false){if(blocked()||emptyDraft&&Object.keys(session.getSnapshot().pending.fields).length)return;try{setError(null);action();}catch(cause){setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','The assembly action failed.',{},cause));}}
  const draft=Object.keys(snapshot.pending.fields).length>0,busy=reading||captured||snapshot.candidate!==null||replacement!==null||choice!==null;
  useEffect(()=>session.subscribe(setSnapshot),[session]);
  useEffect(()=>()=>session.dispose(),[session]);
  useEffect(()=>{const changed=()=>{navigationEpoch.current++;if(!location.hash.startsWith('#/assemblies/'))clearDecisions();};window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[session]);
  useEffect(()=>{
    let listening=true;const refresh=()=>{if(listening)setCaptured(hasCapture());};
    const down=(event:PointerEvent)=>{if(!(event.target instanceof Element)||!root.current?.contains(event.target))return;pointers.current.add(event.pointerId);setTimeout(refresh,0);};
    const release=(event:PointerEvent)=>{if(!captureFor(event.pointerId))pointers.current.delete(event.pointerId);refresh();setTimeout(()=>{if(!listening)return;if(!captureFor(event.pointerId))pointers.current.delete(event.pointerId);refresh();},0);};
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('lostpointercapture',release,true);
    return()=>{listening=false;pointers.current.clear();window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('lostpointercapture',release,true);};
  },[session]);
  useEffect(()=>{
    if(!flowMode)return;Object.assign(window,{__cadAssemblyFlow:{session,snapshot:()=>session.getSnapshot(),display:()=>structuredClone(display),frame:()=>structuredClone(frame),readFrame:()=>setReadRequest(value=>value+1),
      error:()=>error?{code:error.code,message:error.message,context:error.context,cause:error.cause instanceof Error?{message:error.cause.message,code:'code'in error.cause?error.cause.code:null}:null}:null}});
    return()=>{delete(window as Window&{__cadAssemblyFlow?:unknown}).__cadAssemblyFlow;};
  },[session,display,frame,error,flowMode]);
  function currentIntent(before:string,epoch=navigationEpoch.current){const s=session.getSnapshot();if(epoch!==navigationEpoch.current||!visible()||s.disposed||s.candidate||hasCapture()||anchor(s)!==before)throw new CadEditorError('STALE','The assembly or view changed while the file was read.',{field:'assembly-open'});}
  function prepare(target:Target){const c=session.prepareOpen(target.text,{displayInstanceIds:target.displayInstanceIds});opening.current={token:c.token,filename:target.filename};}
  function queue(target:Target){currentIntent(target.anchor);if(session.getSnapshot().dirty){decision.current=target;markBusy();setReplacement(target);}else prepare(target);}
  function receive(text:string,name:string,before:string,epoch:number){
    currentIntent(before,epoch);const native=parseCadAssembly(text),ids=native.assembly.instances.map(value=>value.id);
    for(const part of native.assembly.parts)serializeCadDocument(part);
    if(ids.length<=4){queue({text,filename:name,anchor:before,displayInstanceIds:ids});return;}
    const prior=session.getSnapshot().display.instanceIds,selected=prior.every(id=>ids.includes(id))?[...prior]:[];
    const target={text,filename:name,anchor:before,native,ids:selected};displayChoice.current=target;markBusy();setChoice(target);
  }
  async function openFile(input:File|undefined){
    if(!input||blocked()||Object.keys(session.getSnapshot().pending.fields).length)return;
    const before=anchor(session.getSnapshot()),epoch=navigationEpoch.current;fileBusy.current=true;markBusy();setReading(true);
    try{setError(null);receive(await readCadAssemblyFile(input),input.name,before,epoch);}catch(cause){opening.current=null;setError(fileError(cause));}
    finally{fileBusy.current=false;setReading(false);if(!decision.current&&!displayChoice.current)root.current?.removeAttribute('data-assembly-host-busy');}
  }
  function confirmDisplay(){const value=displayChoice.current;if(!value||blocked(true))return;try{currentIntent(value.anchor);displayChoice.current=null;setChoice(null);queue({text:value.text,filename:value.filename,anchor:value.anchor,displayInstanceIds:value.ids});if(!decision.current)root.current?.removeAttribute('data-assembly-host-busy');}catch(cause){clearDecisions();setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot choose this assembly view.',{},cause));}}
  function continueReplacement(){const value=decision.current;if(!value||blocked(true))return;try{currentIntent(value.anchor);prepare(value);clearDecisions();}catch(cause){clearDecisions();setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot replace this assembly.',{},cause));}}
  function newSample(){run(()=>receive(fixture,'Assembly',anchor(session.getSnapshot()),navigationEpoch.current),true);}
  function chooseIds(id:string,checked:boolean){const value=displayChoice.current;if(!value)return;const ids=checked?[...value.ids,id]:value.ids.filter(item=>item!==id);if(ids.length>4)return;const next={...value,ids};displayChoice.current=next;setChoice(next);}
  const instances=snapshot.accepted.instances;
  return <div ref={root} className="cad-app cad-assembly-app" data-assembly-host-busy={reading||replacement||choice?'true':undefined}>
    <header className="app-header"><a className="app-brand" href="#/assemblies/assembly_editor_fixture" onClick={event=>{if(blocked())event.preventDefault();}}><Box size={20}/><span>barocss<span className="brand-sub">CAD</span></span></a>
      <Menubar className="app-menubar"><MenubarMenu><MenubarTrigger disabled={busy}>File</MenubarTrigger><MenubarContent>
        <MenubarItem data-testid="assembly-new" disabled={busy||draft} onSelect={newSample}>New assembly</MenubarItem>
        <MenubarItem disabled={busy||draft} onSelect={()=>run(()=>file.current?.click())}>Open native assembly…</MenubarItem>
        <MenubarItem disabled={busy} onSelect={()=>run(()=>downloadAccepted(session))}>Download accepted assembly</MenubarItem>
        <MenubarSeparator/><MenubarItem disabled={busy} onSelect={()=>run(()=>{location.hash='/documents/cad_editor_fixture';})}>Surface document</MenubarItem>
        <MenubarItem disabled={busy} onSelect={()=>run(()=>{location.hash='/features/cad_boolean_extrusion';})}>Boolean extrusion</MenubarItem>
        <MenubarItem disabled={busy} onSelect={()=>run(()=>{location.hash='/lofts/loft_supported_graph';})}>NURBS loft</MenubarItem>
      </MenubarContent></MenubarMenu></Menubar><span className="document-title">{filename}{snapshot.dirty&&<span className="dirty-dot"> •</span>}</span>
      <Button variant="outline" size="sm" data-testid="assembly-open" disabled={busy||draft} onClick={()=>run(()=>file.current?.click())}><FolderOpen/>Open</Button>
      <Button size="sm" data-testid="assembly-download" disabled={busy} onClick={()=>run(()=>downloadAccepted(session))}><Download/>Download</Button>
      <input ref={file} type="file" accept=".json" className="file-input" aria-label="Open native CAD assembly file" onChange={event=>{void openFile(event.target.files?.[0]);event.target.value='';}}/>
    </header>
    <div className="app-toolbar"><span className="breadcrumb"><Box size={13}/>Assembly<span className="toolbar-divider"/>{snapshot.display.instanceIds.length} / {instances.length} shown</span><div className="toolbar-actions">
      <Button variant="ghost" size="icon-sm" data-testid="assembly-undo" aria-label="Undo" disabled={busy||draft||!snapshot.history.canUndo} onClick={()=>run(()=>session.prepareUndo())}><Undo2/></Button>
      <Button variant="ghost" size="icon-sm" data-testid="assembly-redo" aria-label="Redo" disabled={busy||draft||!snapshot.history.canRedo} onClick={()=>run(()=>session.prepareRedo())}><Redo2/></Button>
      <span className="toolbar-divider"/><Button variant="ghost" size="sm" data-testid="assembly-fit" disabled={busy||draft||display?.state.status!=='ready'||display.generation!==snapshot.generation||display.displayGeneration!==snapshot.displayGeneration||snapshot.display.instanceIds.length===0} onClick={()=>run(()=>{if(fitReady())setFitRequest(value=>value+1);},true)}><Maximize/>Fit</Button>
    </div></div>
    {error&&<div className="app-error" role="alert">{message(error)}<Button variant="ghost" size="xs" onClick={()=>setError(null)}>Dismiss</Button></div>}
    <div className="app-workspace"><aside className="document-tree" aria-label="Assembly instances"><h2><Box size={15}/>Instances</h2>
      {instances.map(instance=>{const shown=snapshot.display.instanceIds.includes(instance.instanceId);return <div className="tree-body-row assembly-tree-row" key={instance.instanceId} style={{paddingLeft:(instance.depth-1)*8}}>
        <button type="button" className={'tree-body'+(snapshot.selection?.binding.instanceId===instance.instanceId?' selected':'')} data-testid={'assembly-instance-'+instance.instanceId} disabled={busy||draft} onClick={()=>run(()=>session.selectInstance(instance.instanceId))}><Box size={13}/><span>{instance.instanceId}</span></button>
        <input type="checkbox" aria-label={'Show '+instance.instanceId} data-testid={'assembly-visible-'+instance.instanceId} checked={shown} disabled={busy||draft||!shown&&snapshot.display.instanceIds.length===4}
          onChange={event=>run(()=>session.prepareDisplayInstances(event.target.checked?[...session.getSnapshot().display.instanceIds,instance.instanceId]:session.getSnapshot().display.instanceIds.filter(id=>id!==instance.instanceId)),true)}/>
      </div>;})}
      <div className="assembly-display-actions"><Button variant="ghost" size="xs" data-testid="assembly-display-clear" disabled={busy||draft||snapshot.display.instanceIds.length===0} onClick={()=>run(()=>{lastDisplay.current=[...session.getSnapshot().display.instanceIds];session.prepareDisplayInstances([]);},true)}>Hide all</Button>
        <Button variant="ghost" size="xs" data-testid="assembly-display-restore" disabled={busy||draft||snapshot.display.instanceIds.length!==0||lastDisplay.current.length===0} onClick={()=>run(()=>session.prepareDisplayInstances(lastDisplay.current),true)}>Restore view</Button></div>
    </aside><main className="main-workspace"><CadEditorAssemblyEditor session={session} fitRequest={fitRequest} readRequest={flowMode?readRequest:undefined} onDisplay={setDisplay} onFrame={setFrame}
      onError={cause=>{opening.current=null;setError(cause);}} onAccepted={(s,c)=>{setError(null);if(c.kind==='open'||s.display.instanceIds.length>0)lastDisplay.current=[...s.display.instanceIds];if(opening.current?.token===c.token){setFilename(opening.current.filename);opening.current=null;}}}/></main></div>
    <footer className="app-status"><span className="status-led"/><span>{draft?'Pending local pose':'Accepted assembly'}</span><span className="status-divider"/><span>{snapshot.downloadStatus}</span><span className="status-divider"/><span>{snapshot.dirty?'Unsaved changes':'No new changes'}</span><span className="status-spacer"/><span>History {snapshot.history.index+1} / {snapshot.history.count}</span><span className="status-divider"/><span>Local XYZ · mm / deg</span></footer>
    <Dialog open={choice!==null} onOpenChange={open=>{if(!open)clearDecisions();}}><DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="assembly-display-dialog"><DialogHeader><DialogTitle>Choose the assembly view</DialogTitle><DialogDescription>Choose up to four instances to display. The file retains every instance and complete part. Choose none for an empty view.</DialogDescription></DialogHeader>
      <div className="assembly-open-instances">{choice?.native.assembly.instances.map(value=><label key={value.id}><input type="checkbox" data-testid={'assembly-open-instance-'+value.id} checked={choice.ids.includes(value.id)} disabled={!choice.ids.includes(value.id)&&choice.ids.length===4} onChange={event=>chooseIds(value.id,event.target.checked)}/>{value.id}</label>)}</div>
      <DialogFooter><Button variant="outline" data-testid="assembly-display-cancel" onClick={clearDecisions}>Cancel</Button><Button data-testid="assembly-display-confirm" onClick={confirmDisplay}>Continue</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={replacement!==null} onOpenChange={open=>{if(!open&&!snapshot.candidate)clearDecisions();}}><DialogContent className="cad-editor-help-dialog document-replacement-dialog" data-testid="assembly-replacement-dialog"><DialogHeader><DialogTitle>Replace this assembly?</DialogTitle><DialogDescription>Download the accepted assembly or continue without downloading. Pending fields are not included in a download.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" data-testid="assembly-replacement-cancel" onClick={clearDecisions}>Cancel</Button><Button variant="outline" data-testid="assembly-replacement-download" onClick={()=>{if(blocked(true))return;try{downloadAccepted(session);}catch(cause){setError(cause instanceof CadEditorError?cause:new CadEditorError('FILE','Cannot download this assembly.',{},cause));}}}>Download copy</Button>
        <Button data-testid="assembly-replacement-continue" onClick={continueReplacement}>Continue without downloading</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
