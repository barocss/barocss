import {useEffect,useId,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';
import {RenderMixedDocumentError,type RenderMixedDocumentDisplayV1} from './mixed-document.js';
import type {RenderMixedController,RenderMixedActionResult} from './mixed-controller.js';
import {createMixedViewportPresenter} from './mixed-viewport.js';
import {createViewer} from '@barocss/gpu';
import {prepareRenderNativeSourceImport} from './native-source-import.js';
import {NativeSurfacePosition} from './native-surface-position.js';
import {NativeSurfacePointInspector} from './native-surface-point-inspector.js';
import {createMixedCameraInput} from './mixed-camera-input.js';
import {MixedSphereInspector} from './mixed-sphere-inspector.js';
import {MixedWorkbenchLayout} from './mixed-workbench-layout.js';
import {WorkbenchIcon,ViewOrientation} from './mixed-workbench-icons.js';
export {createMixedViewportPresenter} from './mixed-viewport.js';
export interface RenderMixedEditorProps {controller:RenderMixedController;onError?:(error:RenderMixedDocumentError)=>void;onCameraHelp?:()=>void;onSphereHelp?:()=>void;projectBrowser?:ReactNode}
const useSession=(controller:RenderMixedController)=>useSyncExternalStore(controller.session.subscribe,controller.session.getSnapshot,controller.session.getSnapshot);
const result=(value:RenderMixedActionResult,handler?:RenderMixedEditorProps['onError'])=>{if(!value.ok)handler?.(value.error);};
function details(error:unknown):string {if(error instanceof Error)return `${'code'in error?String(error.code)+': ':''}${error.message}${error.cause?`\n${details(error.cause)}`:''}`;if(Array.isArray(error))return JSON.stringify(error,null,2);return String(error);}
function sphereCameraConstraint(error:unknown):boolean {
  if(!(error instanceof RenderMixedDocumentError)||error.code!=='GPU'||!(error.cause instanceof Error)||error.cause.name!=='MixedDepthError')return false;
  const code=Object.getOwnPropertyDescriptor(error.cause,'code');
  return Boolean(code&&'value'in code&&code.value==='CAMERA');
}

export function MixedSceneViewport({controller,onError,onCameraHelp}:RenderMixedEditorProps){
  const canvas=useRef<HTMLCanvasElement>(null),view=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const [mode,setMode]=useState<'orbit'|'pan'>('orbit'),modeRef=useRef(mode);
  const [localHelp,setLocalHelp]=useState(false),helpButton=useRef<HTMLButtonElement>(null);
  const state=useSession(controller),originalCamera=state.accepted.camera;
  const replacesCameraDraft=(['eye','target','up'] as const).some(field=>state.draft.camera[field].some((value,axis)=>!Object.is(value,originalCamera[field][axis])))||(['fovYDegrees','near','far'] as const).some(field=>!Object.is(state.draft.camera[field],originalCamera[field]));
  const input=useRef<ReturnType<typeof createMixedCameraInput>|null>(null),errorHandler=useRef(onError);
  errorHandler.current=onError;
  useEffect(()=>{
    const element=canvas.current!;let cleanup:(()=>void)|null=null,live=true;
    createViewer(element,{controls:false,autoResize:false,pixelRatio:Math.min(window.devicePixelRatio||1,2)}).then(viewer=>{
    if(!live){viewer.dispose();return;}
    const presenter=createMixedViewportPresenter(viewer);
    let observer:ResizeObserver|null=null;const dispose=presenter.dispose;presenter.dispose=()=>{observer?.disconnect();dispose();};
    result(controller.attachPresenter(presenter),onError);
    input.current=createMixedCameraInput(element,controller,{mode:()=>modeRef.current,onError:error=>errorHandler.current?.(error)});
    const resize=()=>{input.current?.reset();const rect=element.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);let width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));const scale=Math.min(1,1024/width,1024/height,Math.sqrt(1048576/(width*height)));width=Math.max(1,Math.floor(width*scale));height=Math.max(1,Math.floor(height*scale));const next=presenter.resize(width,height);if(!next.ok&&!next.retained)controller.presentationUnavailable(next.error);};
    observer=new ResizeObserver(resize);observer.observe(element);resize();cleanup=()=>{input.current?.dispose();input.current=null;observer?.disconnect();controller.detachPresenter(presenter);};
    },cause=>controller.presentationUnavailable(cause instanceof Error?cause:new Error('WebGPU is not available in this browser.')));
    return()=>{live=false;cleanup?.();};
  },[controller]);
  const changeMode=(next:'orbit'|'pan')=>{input.current?.reset();modeRef.current=next;setMode(next);};
  const pending=Boolean(view.cameraPreview),unavailable=view.presentedRevision===null||view.disposed;
  const cameraAction=(kind:'use'|'cancel')=>{input.current?.reset();result(kind==='use'?controller.applyCameraPreview():controller.cancelCameraPreview(),onError);};
  return <section className="re-viewport" aria-label="Mixed scene viewport">
    <div className="re-workbench-viewport-header">
      <div className="re-viewport-label">{!(pending&&replacesCameraDraft)&&<span>Perspective</span>}<span data-testid="camera-view-state">{pending?'View preview':'Scene'}</span>
        {pending&&replacesCameraDraft&&<span className="re-camera-replacement">Replaces camera draft</span>}</div>
      <div className="re-camera-toolbar" aria-label="Camera controls">
        <button type="button" data-testid="camera-orbit" aria-pressed={mode==='orbit'} disabled={unavailable} onClick={()=>changeMode('orbit')}>Orbit</button>
        <button type="button" data-testid="camera-pan" aria-pressed={mode==='pan'} disabled={unavailable} onClick={()=>changeMode('pan')}>Pan</button>
        {pending&&<><button type="button" data-testid="camera-use-view" disabled={unavailable} onClick={()=>cameraAction('use')}>Use view</button>
          <button type="button" data-testid="camera-cancel-view" disabled={unavailable} onClick={()=>cameraAction('cancel')}>Cancel view</button></>}
        <button ref={helpButton} type="button" data-testid="camera-controls-help" onClick={()=>onCameraHelp?onCameraHelp():setLocalHelp(true)} aria-label="Camera controls Help">Help</button>
      </div>
    </div>
    <div className="re-workbench-canvas">
      <canvas ref={canvas} width={800} height={600} tabIndex={0} aria-label="Rendered mixed scene" data-testid="mixed-canvas"/>
      <ViewOrientation camera={view.cameraPreview??state.accepted.camera}/>
      {localHelp&&<div className="re-camera-local-help" role="dialog" aria-label="Camera controls">
        <p>Drag to Orbit. Shift-drag or Pan moves the view. The wheel zooms. With the canvas focused, use arrows, Shift-arrows, +, and −.</p>
        <p>Use view replaces a camera draft and applies the complete draft. Cancel view restores the applied view and keeps all drafts. Invalid camera moves are refused.</p>
        <button type="button" onClick={()=>{setLocalHelp(false);helpButton.current?.focus();}}>Close Help</button>
      </div>}
      {view.presentedRevision===null&&<div className="re-viewport-fault" role="status"><p>{view.disposed?'Preview closed.':view.presentationError?'Preview unavailable. Your applied scene is kept.':'Opening scene…'}</p>
        {view.presentationError&&!view.disposed&&<button type="button" onClick={()=>result(controller.recover(),onError)}>Restore preview</button>}
      </div>}
    </div>
  </section>;
}

export function RenderMixedEditor({controller,onError,onCameraHelp,onSphereHelp,projectBrowser}:RenderMixedEditorProps){
  const state=useSession(controller),view=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const [tab,setTab]=useState<'scene'|'asset'>('scene'),[target,setTarget]=useState<'scene'|'asset'>('scene'),[ack,setAck]=useState<RenderMixedDocumentError|null>(null);
  const [manualSceneEdit,setManualSceneEdit]=useState(0),sphereControls=useRef<HTMLDivElement>(null);
  const [browserTab,setBrowserTab]=useState<'scene'|'projects'>('scene'),[inspectorTab,setInspectorTab]=useState<'object'|'camera'>('object');
  const [drawer,setDrawer]=useState<'source'|'problems'|null>(null),sourceId=useId(),sourceTabs=useRef<HTMLDivElement>(null);
  const source=useRef<HTMLTextAreaElement>(null),nativeControls=useRef<HTMLElement>(null),draft=state.draft;
  const cameraPending=Boolean(view.cameraPreview),controlsDisabled=state.disposed||view.disposed||cameraPending;
  const shownCamera=view.cameraPreview??draft.camera;
  const cameraDraftChanged=(['eye','target','up'] as const).some(field=>draft.camera[field].some((value,axis)=>!Object.is(value,state.accepted.camera[field][axis])))||(['fovYDegrees','near','far'] as const).some(field=>!Object.is(draft.camera[field],state.accepted.camera[field]));
  const nativeImport=useMemo(()=>{try{return prepareRenderNativeSourceImport(draft.asset.source);}catch{return null;}},[draft.asset.source]);
  const positionInvalid=draft.display.translate.some(value=>!Number.isFinite(value)||Math.abs(value)>1000);
  const update=(fn:()=>void)=>{if(controller.getSnapshot().cameraPreview)return;try{fn();}catch(cause){onError?.(cause instanceof RenderMixedDocumentError?cause:new RenderMixedDocumentError('INPUT','The draft could not be changed.',cause));}};
  const number=(text:string)=>text===''?NaN:Number(text);
  const camera=(field:'eye'|'target'|'up',axis:number,value:number)=>{const next=structuredClone(draft.camera);next[field][axis]=value;update(()=>controller.session.setDraftCamera(next));};
  const scalar=(field:'fovYDegrees'|'near'|'far',value:number)=>update(()=>controller.session.setDraftCamera({...draft.camera,[field]:value}));
  const display=(field:keyof RenderMixedDocumentDisplayV1,value:number,axis?:number)=>{const next={...draft.display,translate:[...draft.display.translate] as [number,number,number],color:[...draft.display.color] as [number,number,number]};if(axis===undefined)(next as unknown as Record<string,number>)[field]=value;else (next[field] as number[])[axis]=value;update(()=>controller.session.setDraftDisplay(next));};
  const position=(axis:number,value:number)=>update(()=>{const current=controller.session.getSnapshot().draft.display;const translate=[...current.translate] as [number,number,number];translate[axis]=value;controller.session.setDraftDisplay({...current,translate});});
  const vector=(field:'eye'|'target'|'up',label:string)=><fieldset key={field}><legend>{label}</legend><div className="re-vector">{shownCamera[field].map((value,axis)=><label key={axis}><span>{['X','Y','Z'][axis]}</span><input type="number" step=".1" disabled={controlsDisabled} aria-label={`${field} ${['X','Y','Z'][axis]}`} value={Number.isFinite(value)?value:''} onChange={event=>camera(field,axis,number(event.target.value))}/></label>)}</div></fieldset>;
  const error=view.presentationError,unavailable=view.presentedRevision===null,notice=error&&!view.disposed&&(unavailable||ack!==error);
  const select=(kind:'scene'|'asset')=>{if(cameraPending)return;setTarget(kind);setTab(kind);setInspectorTab('object');};
  const editSource=()=>{if(cameraPending)return;setTab('scene');setDrawer('source');requestAnimationFrame(()=>source.current?.focus());};
  const editPosition=()=>{if(cameraPending)return;select('asset');requestAnimationFrame(()=>nativeControls.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus());};
  const editSphere=()=>{if(cameraPending)return;select('scene');requestAnimationFrame(()=>{const first=sphereControls.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')??sphereControls.current?.querySelector<HTMLInputElement>('input:not(:disabled)');first?.focus();});};
  const targetDraft=draft.asset.modelId!==state.accepted.asset.modelId||draft.asset.surfaceId!==state.accepted.asset.surfaceId;
  const surfaceDraft=targetDraft||draft.asset.source!==state.accepted.asset.source||draft.display.mmToSceneUnit!==state.accepted.display.mmToSceneUnit||draft.display.countU!==state.accepted.display.countU||draft.display.countV!==state.accepted.display.countV||draft.display.translate.some((value,axis)=>!Object.is(value,state.accepted.display.translate[axis]))||draft.display.color.some((value,axis)=>!Object.is(value,state.accepted.display.color[axis]));
  const scene=<section className="re-panel re-objects" aria-label="Mixed objects">
    <div className="re-panel-heading"><h2>Scene</h2><span>2 shown</span></div>
    <ul><li><button type="button" data-testid="mixed-object-sphere" disabled={controlsDisabled} onClick={()=>select('scene')} aria-pressed={target==='scene'}>
      <WorkbenchIcon kind="sphere"/><span>{state.prepared.metadata.objectId}</span><small>Sphere</small></button></li>
      <li><button type="button" data-testid="mixed-object-surface" disabled={controlsDisabled} onClick={()=>select('asset')} aria-pressed={target==='asset'}>
        <WorkbenchIcon kind="surface"/><span>{state.prepared.metadata.surfaceId}</span><small>Surface</small></button></li></ul>
    <details className="re-mixed-originals"><summary>Original asset objects ({state.prepared.metadata.nativeObjects.length})</summary>
      <ul>{state.prepared.metadata.nativeObjects.map(object=><li key={object.id}><WorkbenchIcon kind={object.kind}/><span>{object.id}</span>
        <small>{object.kind}{object.id===state.prepared.metadata.surfaceId?' · shown':' · stored'}</small></li>)}</ul>
    </details>
  </section>;
  const sourcePanel=<section className="re-source re-panel" aria-label="Mixed source editor">
    <div className="re-panel-heading"><div ref={sourceTabs} role="tablist" aria-label="Source kind">
      {(['scene','asset'] as const).map((kind,index)=><button key={kind} id={`${sourceId}-${kind}`} data-testid={`source-tab-${kind}`} role="tab"
        aria-selected={tab===kind} aria-controls={`${sourceId}-body`} tabIndex={tab===kind?0:-1} type="button" disabled={controlsDisabled}
        onClick={()=>setTab(kind)} onKeyDown={event=>{
          if(cameraPending)return;
          const next=event.key==='Home'?0:event.key==='End'?1:event.key==='ArrowLeft'||event.key==='ArrowRight'?1-index:null;
          if(next===null)return;event.preventDefault();setTab(next===0?'scene':'asset');
          sourceTabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{kind==='scene'?'Scene':'CAD source'}</button>)}
    </div><span>{state.dirty?'Draft':'Applied'}</span></div>
    {state.sphereInputInvalid&&tab==='scene'&&<p className="re-sphere-source-warning" data-testid="sphere-source-warning">Editing Scene source replaces Sphere field drafts.</p>}
    <div id={`${sourceId}-body`} role="tabpanel" aria-labelledby={`${sourceId}-${tab}`} className="re-workbench-source-body">
      <textarea ref={source} aria-label={tab==='scene'?'Scene source':'CAD source'} data-testid={tab==='scene'?'mixed-scene-source':'mixed-native-source'}
        disabled={controlsDisabled} spellCheck={false} value={tab==='scene'?draft.sceneSource:draft.asset.source}
        onChange={event=>update(()=>{controller.session.setDraftSource(tab,event.target.value);if(tab==='scene')setManualSceneEdit(value=>value+1);})}/>
    </div>
  </section>;
  const cameraPanel=<section className="re-camera re-panel" aria-label="Mixed camera">
    <div className="re-panel-heading"><h2>Camera</h2><span>{cameraPending?'View preview':cameraDraftChanged?'Draft':'Applied'}</span></div>
    {vector('eye','Position · scene units')}{vector('target','Target · scene units')}
    <label className="re-scalar"><span>Field of view (°)</span><input type="number" aria-label="fovYDegrees" disabled={controlsDisabled}
      value={Number.isFinite(shownCamera.fovYDegrees)?shownCamera.fovYDegrees:''} onChange={event=>scalar('fovYDegrees',number(event.target.value))}/></label>
    <details className="re-camera-advanced"><summary>Advanced camera</summary>{vector('up','Up direction')}
      {(['near','far'] as const).map(field=><label className="re-scalar" key={field}><span>{field} clip · scene units</span>
        <input type="number" aria-label={field} disabled={controlsDisabled} value={Number.isFinite(shownCamera[field])?shownCamera[field]:''}
          onChange={event=>scalar(field,number(event.target.value))}/></label>)}
    </details>
  </section>;
  const objectPanel=<>
    <div ref={sphereControls}><MixedSphereInspector controller={controller} hidden={target!=='scene'} disabled={controlsDisabled}
      manualEdit={manualSceneEdit} onEditSource={editSource} onHelp={onSphereHelp} onError={onError}/></div>
    <section ref={nativeControls} className="re-camera re-panel" aria-label="Surface inspector" data-testid="inspector-surface" hidden={target!=='asset'}>
      <div className="re-panel-heading"><h2>Surface</h2><span>{surfaceDraft?'Draft':'Applied'}</span></div>
      {targetDraft&&<p className="re-inspector-target" data-testid="mixed-inspector-target-status">Draft: {draft.asset.modelId} / {draft.asset.surfaceId}. Applied: {state.accepted.asset.modelId} / {state.accepted.asset.surfaceId}.</p>}
      <label className="re-scalar"><span>Surface</span><select aria-label="Surface" data-testid="mixed-surface-selector" disabled={!nativeImport||controlsDisabled}
        value={draft.asset.surfaceId} onChange={event=>update(()=>controller.session.setDraftAssetReference(nativeImport!.modelId,event.target.value))}>
        {!nativeImport?.surfaces.some(surface=>surface.id===draft.asset.surfaceId)&&<option value={draft.asset.surfaceId}>{draft.asset.surfaceId||'Choose a Surface'}</option>}
        {nativeImport?.surfaces.map(surface=><option key={surface.id} value={surface.id}>{surface.id}</option>)}
      </select></label>
      <NativeSurfacePosition translate={draft.display.translate} disabled={controlsDisabled} onChange={position}/>
      <label className="re-scalar"><span>Surface color</span><input type="color" aria-label="Surface color" disabled={controlsDisabled}
        value={'#'+draft.display.color.map(value=>Math.round(Math.max(0,Math.min(1,Number.isFinite(value)?value:0))*255).toString(16).padStart(2,'0')).join('')}
        onChange={event=>{const color=[1,3,5].map(offset=>parseInt(event.target.value.slice(offset,offset+2),16)/255) as [number,number,number];update(()=>controller.session.setDraftDisplay({...draft.display,color}));}}/></label>
      <NativeSurfacePointInspector controller={controller}/>
      <details className="re-camera-advanced"><summary>Asset settings</summary>
        <label className="re-scalar"><span>Scene units / mm</span><input type="number" step=".01" aria-label="mmToSceneUnit" disabled={controlsDisabled}
          value={Number.isFinite(draft.display.mmToSceneUnit)?draft.display.mmToSceneUnit:''} onChange={event=>display('mmToSceneUnit',number(event.target.value))}/></label>
        {(['countU','countV'] as const).map(field=><label key={field} className="re-scalar"><span>{field==='countU'?'Samples U':'Samples V'}</span>
          <input type="number" aria-label={field} disabled={controlsDisabled} value={Number.isFinite(draft.display[field])?draft.display[field]:''}
            onChange={event=>display(field,number(event.target.value))}/></label>)}
        <label className="re-scalar"><span>Model</span><input aria-label="Native model" disabled={controlsDisabled} value={draft.asset.modelId}
          onChange={event=>update(()=>controller.session.setDraftAssetReference(event.target.value,draft.asset.surfaceId))}/></label>
        <label className="re-scalar"><span>Surface</span><input aria-label="Native Surface" disabled={controlsDisabled} value={draft.asset.surfaceId}
          onChange={event=>update(()=>controller.session.setDraftAssetReference(draft.asset.modelId,event.target.value))}/></label>
      </details>
    </section>
  </>;
  const problems=<>
    <section className="re-diagnostics re-panel" aria-label="Mixed diagnostics">
      <div className="re-panel-heading"><h2>Problems</h2><span data-testid="mixed-draft-error-count">{state.diagnostics?1:0}</span></div>
      <div role="status"><p className="re-caption">{state.sphereInputInvalid?'Correct the Sphere properties before Apply.':positionInvalid?'Surface position needs correction.':
        state.diagnostics?state.diagnostics.code==='INPUT'?'Check the camera and display values, then Apply again.':state.diagnostics.code==='GPU'?
          sphereCameraConstraint(state.diagnostics)?'The Sphere does not fit this camera view. Reduce its radius, move it, or adjust the camera, then Apply.':
          'Check the sources, camera and native position limits. Your draft is kept.':state.diagnostics.message:state.dirty?'Ready to apply.':'No draft errors.'}</p>
        {state.sphereInputInvalid&&<button className="re-inspector-action" type="button" disabled={controlsDisabled} data-testid="edit-sphere-properties" onClick={editSphere}>Edit Sphere properties</button>}
        {positionInvalid&&<button className="re-inspector-action" type="button" disabled={controlsDisabled} onClick={editPosition}>Edit Surface position</button>}
        {state.diagnostics&&<details className="re-mixed-details"><summary>Details</summary><pre>{details(state.diagnostics)}</pre></details>}
      </div>
      {notice&&<section className="re-preview-notice" data-testid="mixed-preview-notice"><h3>{unavailable?'Preview unavailable':'Update failed'}</h3>
        <p>{unavailable?'Your applied scene is kept. Restore the preview.':'The previous scene is still shown.'}</p>
        {unavailable&&!view.disposed&&<button type="button" onClick={()=>result(controller.recover(),onError)}>Restore preview</button>}
        {!unavailable&&<div className="re-preview-actions">{state.dirty&&<button type="button" disabled={controlsDisabled||state.sphereInputInvalid||positionInvalid}
          onClick={()=>result(controller.apply(),onError)}>Retry update</button>}<button type="button" disabled={controlsDisabled} onClick={()=>setAck(error)}>Dismiss preview notice</button></div>}
        <details><summary>Details</summary><pre data-testid="mixed-preview-details">{details(error)}</pre></details>
      </section>}
    </section>
    <details className="re-mixed-help"><summary>Help: mixed preview</summary><p>This mode shows one sphere and one selected native Surface. Other original CAD objects stay in the saved source. Use the source editor for other SDF objects.</p>
      <p>Native coordinates use mm. Apply one scene-unit conversion. Camera position and native Position X/Y/Z use scene units. Cameras inside or clipping the sphere are refused.</p>
      <p>Edits stay drafts until Apply. Save stores both original sources and view settings. Preview buffers are rebuilt after Open.</p>
    </details>
  </>;
  const actions=<><button type="button" data-testid="workbench-apply" className="re-workbench-apply"
    disabled={!state.dirty||controlsDisabled||positionInvalid||state.sphereInputInvalid} onClick={()=>result(controller.apply(),onError)}>Apply</button>
    <button type="button" data-testid="workbench-discard" disabled={!state.dirty||controlsDisabled} onClick={()=>update(()=>controller.session.discardDraft())}>Discard</button></>;
  const viewport=<><MixedSceneViewport controller={controller} onError={onError} onCameraHelp={onCameraHelp}/>
    {notice&&!unavailable&&<button type="button" className="re-workbench-preview-status" aria-label="Show preview problem" onClick={()=>setDrawer('problems')}>Update failed · Problems</button>}
  </>;
  return <MixedWorkbenchLayout scene={scene} projects={projectBrowser??<p className="re-caption">Project navigation is provided by the host.</p>}
    object={objectPanel} camera={cameraPanel} viewport={viewport} actions={actions} source={sourcePanel} problems={problems}
    browserTab={browserTab} onBrowserTab={setBrowserTab} inspectorTab={inspectorTab} onInspectorTab={setInspectorTab}
    drawer={drawer} onDrawer={setDrawer} problemCount={(state.diagnostics?1:0)+(notice?1:0)}/>;
}
