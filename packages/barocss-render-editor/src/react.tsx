import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderEditorController, RenderEditorActionResult} from './controller.js';
import type {RenderEditorError} from './errors.js';
import {normalizeRenderEditorError} from './errors.js';
import {createSceneViewportPresenter} from './scene-viewport.js';
import {deriveRenderSceneFramingCamera} from './scene-framing.js';
import {createSceneSelectionInput} from './scene-selection-input.js';
import {createSceneCameraInput} from './scene-camera-input.js';
import {SourceStudioLayout} from './source-studio-layout.js';
import type {RenderSceneGizmoMode} from './scene-gizmo-projection.js';
import {WorkbenchIcon, ViewOrientation} from './mixed-workbench-icons.js';
import {SourceTimeline} from './source-timeline.js';
import {SceneGizmo} from './scene-gizmo.js';
import {SceneObjectInspector} from './scene-object-inspector.js';
import {inspectRenderSceneObjects, addRenderSceneObjectSource, removeRenderSceneObjectSource, duplicateRenderSceneObjectSource} from './scene-object-source.js';
import type {RenderSceneObjectKind} from './scene-object-source.js';
const OBJECT_LABELS: Record<RenderSceneObjectKind, string> = {sphere:'Sphere',box:'Box',cylinder:'Cylinder',capsule:'Capsule','rounded-box':'Rounded box',torus:'Torus'};
export {createSceneViewportPresenter} from './scene-viewport.js';
export * from './mixed-react.js';

export interface RenderEditorPanelProps {controller: RenderEditorController; onError?: (error: RenderEditorError) => void; onCameraHelp?: () => void; onObjectSelection?:(objectId:string)=>void; navigationDisabled?: boolean; onGizmoHelp?: () => void; onTransformGesture?: (active:boolean) => void; onPlaybackChange?: (active:boolean) => void; onAnimationHelp?: () => void; gizmoMode?:RenderSceneGizmoMode; onGizmoModeChange?:(mode:RenderSceneGizmoMode)=>void; showGizmoModeButtons?:boolean; onFrameCommandChange?:(command:((scope:'all'|'selected')=>void)|null)=>void}
export interface RenderEditorProps extends RenderEditorPanelProps {
  header?: ReactNode;
  toolbar?: ReactNode;
  onAction?: (action: 'new' | 'open' | 'save') => void;
  projectBrowser?: ReactNode;
  onObjectHelp?: () => void;
  onDuplicateCommandChange?: (command:(()=>void)|null) => void;
}
function useSession(controller: RenderEditorController) { return useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot); }
function action(result: RenderEditorActionResult, onError?: (error: RenderEditorError) => void) { if (!result.ok) onError?.(result.error); }

export function SceneViewport({controller, onError, onCameraHelp, onObjectSelection, onGizmoHelp, onTransformGesture, gizmoMode, onGizmoModeChange, showGizmoModeButtons, onFrameCommandChange, navigationDisabled = false}: RenderEditorPanelProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [canvasElement,setCanvasElement]=useState<HTMLCanvasElement|null>(null), gesture=useRef(false);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const snapshot = useSession(controller), input = useRef<ReturnType<typeof createSceneCameraInput> | null>(null), selection=useRef<ReturnType<typeof createSceneSelectionInput>|null>(null);
  const [selectionError,setSelectionError]=useState<RenderEditorError|null>(null), selectionCallback=useRef(onObjectSelection);
  selectionCallback.current=onObjectSelection;
  const [mode, setMode] = useState<'orbit'|'pan'>('orbit'), modeRef = useRef(mode), errorRef = useRef(onError), disabledRef = useRef(navigationDisabled);
  const [frameStatus,setFrameStatus]=useState(''),frameCommand=useRef<(scope:'all'|'selected')=>void>(()=>{}), navigationPointer=useRef<number|null>(null);
  const [localHelp, setLocalHelp] = useState(false), helpButton = useRef<HTMLButtonElement>(null);
  errorRef.current = onError; disabledRef.current = navigationDisabled;
  const cameraDraftChanged = (['eye','target','up'] as const).some(field => snapshot.draftCamera[field].some((value, axis) => !Object.is(value, snapshot.accepted.camera[field][axis])))
    || (['fovYDegrees','near','far'] as const).some(field => !Object.is(snapshot.draftCamera[field], snapshot.accepted.camera[field]));
  useEffect(() => {
    const canvas = ref.current!; setCanvasElement(canvas);
    const presenter = createSceneViewportPresenter(canvas, error => controller.presentationUnavailable(error));
    let observer: ResizeObserver | null = null;
    const dispose = presenter.dispose;
    presenter.dispose = () => { observer?.disconnect(); dispose(); };
    action(controller.attachPresenter(presenter), onError);
    input.current = createSceneCameraInput(canvas, controller, {mode: () => modeRef.current, onError: error => errorRef.current?.(error), canNavigate: () => !disabledRef.current && !gesture.current});
    selection.current=createSceneSelectionInput(canvas,controller,presenter,{
      canSelect:()=>!disabledRef.current&&!gesture.current,
      onClick:()=>input.current?.reset(),
      onSelection:id=>{setSelectionError(null);if(id!==null)selectionCallback.current?.(id);},
      onError:error=>{setSelectionError(error);if(!error.message.includes('Canvas selection is unavailable'))errorRef.current?.(error);},
    });
    const captureNavigation=(event:PointerEvent)=>{if(event.button===0&&canvas.hasPointerCapture(event.pointerId))navigationPointer.current=event.pointerId;};
    const releaseNavigation=(event?:PointerEvent)=>{if(!event||event.pointerId===navigationPointer.current)navigationPointer.current=null;};
    const framingKey=(event:KeyboardEvent)=>{
      const target=event.target;if(!(target instanceof Element)||event.isComposing||event.metaKey||event.ctrlKey||event.altKey||event.key.toLowerCase()!=='f'||target.closest('input,textarea,select,[contenteditable],[role="menu"],[role="menuitem"],[role="dialog"]'))return;
      if(target!==canvas&&!target.closest('[data-gizmo-key]'))return;
      event.preventDefault();event.stopPropagation();if(!event.repeat)frameCommand.current(event.shiftKey?'all':'selected');
    };
    const surface=canvas.parentElement!;
    canvas.addEventListener('pointerdown',captureNavigation);canvas.addEventListener('pointerup',releaseNavigation);canvas.addEventListener('pointercancel',releaseNavigation);canvas.addEventListener('lostpointercapture',releaseNavigation);
    const blurNavigation=()=>releaseNavigation();canvas.addEventListener('blur',blurNavigation);surface.addEventListener('keydown',framingKey,true);
    const resize = () => {
      selection.current?.reset();input.current?.reset();
      const box = canvas.getBoundingClientRect();
      // Respect GPU dimensions and pixel budget; CSS owns the layout size.
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      let width = Math.max(1, Math.min(4096, Math.round(box.width * ratio)));
      let height = Math.max(1, Math.min(4096, Math.round(box.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height)));
      width = Math.floor(width * scale); height = Math.floor(height * scale);
      try { presenter.resize(width, height); }
      catch (error) { controller.presentationUnavailable(error instanceof Error ? error : new Error('Resize failed.')); }
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas); resize();
    return () => {canvas.removeEventListener('pointerdown',captureNavigation);canvas.removeEventListener('pointerup',releaseNavigation);canvas.removeEventListener('pointercancel',releaseNavigation);canvas.removeEventListener('lostpointercapture',releaseNavigation);canvas.removeEventListener('blur',blurNavigation);surface.removeEventListener('keydown',framingKey,true);navigationPointer.current=null;selection.current?.dispose();selection.current=null; input.current?.dispose(); input.current = null; observer.disconnect(); controller.detachPresenter(presenter); };
  }, [controller]);
  useEffect(() => { if(navigationDisabled){selection.current?.reset();input.current?.reset();} }, [navigationDisabled]);
  frameCommand.current=(scope)=>{
    const canvas=ref.current,current=controller.session.getSnapshot(),view=controller.getSnapshot();
    if(!canvas||disabledRef.current||gesture.current||navigationPointer.current!==null||current.disposed||view.disposed||view.presentedRevision===null||view.cameraPreview||view.transformPreview||view.animationPreview){setFrameStatus('Framing is unavailable until the current operation is finished.');return;}
    const id=scope==='selected'?current.activeObjectId:undefined;
    if(scope==='selected'&&!id){setFrameStatus('Select an applied object to frame.');return;}
    selection.current?.reset();input.current?.reset();const rect=canvas.getBoundingClientRect(),width=canvas.width,height=canvas.height;
    try {
      const camera=deriveRenderSceneFramingCamera(current.accepted.sceneSource,view.viewportCamera??current.accepted.camera,{width:rect.width,height:rect.height,backingWidth:width,backingHeight:height},id??undefined);
      const nextRect=canvas.getBoundingClientRect();
      if(controller.session.getSnapshot()!==current||controller.getSnapshot()!==view||disabledRef.current||gesture.current||navigationPointer.current!==null||rect.left!==nextRect.left||rect.top!==nextRect.top||rect.width!==nextRect.width||rect.height!==nextRect.height||width!==canvas.width||height!==canvas.height){setFrameStatus('The view changed. Try framing again.');return;}
      if(camera===null){setFrameStatus('No applied objects to frame.');return;}
      const result=controller.navigateViewportCamera(camera);if(!result.ok){setFrameStatus(controller.getSnapshot().presentedRevision===null?'Preview unavailable. Restore preview to continue.':'The view could not be framed. The previous view is kept.');onError?.(result.error);return;}
      setFrameStatus(scope==='all'?'Framed all applied objects.':`Framed ${id}.`);
    }catch(cause){setFrameStatus('This scene could not be framed. The previous view is kept.');onError?.(normalizeRenderEditorError(cause));}
  };
  useEffect(()=>{let live=true;onFrameCommandChange?.(scope=>{if(live)frameCommand.current(scope);});return()=>{live=false;onFrameCommandChange?.(null);};},[controller,onFrameCommandChange]);
  useEffect(()=>{setFrameStatus('');setSelectionError(null);},[snapshot.accepted]);
  const transform = Boolean(presentation.transformPreview), preview = Boolean(presentation.cameraPreview), unavailable = presentation.disposed || presentation.presentedRevision === null;
  const chooseMode = (value: 'orbit'|'pan') => {if(gesture.current||controller.getSnapshot().transformPreview)return;selection.current?.reset();input.current?.reset();modeRef.current=value;setMode(value);};
  const finish = (use: boolean) => {if(disabledRef.current||gesture.current||controller.getSnapshot().transformPreview)return;selection.current?.reset();input.current?.reset();action(use ? controller.applyCameraPreview() : controller.cancelCameraPreview(), onError);};
  const localView=Boolean(presentation.viewportCamera);
  const useSceneView=(apply:boolean)=>{if(disabledRef.current||gesture.current||controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview)return;selection.current?.reset();input.current?.reset();action(apply?controller.applyViewportCameraToScene():controller.resetViewportCamera(),onError);};
  return <section className="re-viewport re-scene-viewport" aria-label="Scene viewport">
    <div className="re-workbench-viewport-header"><div className="re-viewport-label"><span data-testid="scene-camera-view-state">{presentation.animationPreview ? 'Animation preview' : transform ? 'Transform preview' : preview ? 'View preview' : localView ? 'User view' : 'Scene view'}</span><span>Perspective</span></div>
      <div className="re-camera-toolbar" aria-label="Camera controls"><button type="button" data-testid="scene-camera-orbit" disabled={unavailable||navigationDisabled||transform||gesture.current} aria-pressed={mode==='orbit'} onClick={()=>chooseMode('orbit')}>Orbit</button><button type="button" data-testid="scene-camera-pan" disabled={unavailable||navigationDisabled||transform||gesture.current} aria-pressed={mode==='pan'} onClick={()=>chooseMode('pan')}>Pan</button><button type="button" data-testid="scene-camera-frame-all" disabled={unavailable||navigationDisabled||transform||preview||gesture.current||Boolean(presentation.animationPreview)} onClick={()=>frameCommand.current('all')}>Frame all</button><button type="button" data-testid="scene-camera-frame-selected" disabled={unavailable||navigationDisabled||transform||preview||gesture.current||Boolean(presentation.animationPreview)||!snapshot.activeObjectId} onClick={()=>frameCommand.current('selected')}>Frame selected</button>{!preview&&<><button type="button" data-testid="scene-camera-reset-view" disabled={!localView||unavailable||navigationDisabled||transform||gesture.current} onClick={()=>useSceneView(false)}>Scene camera</button><button type="button" data-testid="scene-camera-set-scene" disabled={!localView||unavailable||navigationDisabled||transform||gesture.current||snapshot.cameraDirty} onClick={()=>useSceneView(true)}>Set scene camera</button></>}{preview&&<><button type="button" data-testid="scene-camera-use-view" disabled={unavailable||navigationDisabled||transform||gesture.current} onClick={()=>finish(true)}>Use view</button>{cameraDraftChanged&&<span className="re-camera-replacement" title="Replaces camera draft">Replaces draft</span>}<button type="button" data-testid="scene-camera-cancel-view" disabled={unavailable||navigationDisabled||transform||gesture.current} onClick={()=>finish(false)}>Cancel view</button></>}<button ref={helpButton} type="button" data-testid="scene-camera-help" aria-label="Camera controls Help" onClick={()=>onCameraHelp?onCameraHelp():setLocalHelp(true)}>Help</button></div>
    </div>
    <div className="re-workbench-canvas">{selectionError&&<details className="re-gizmo-status re-selection-notice" style={{bottom:54,pointerEvents:'auto'}} role="status" data-testid="scene-selection-status"><summary>{selectionError.message.includes('Canvas selection is unavailable')?'Canvas selection is unavailable. Use the Outliner.':'Canvas selection was refused. Use the Outliner or try again.'}</summary><pre data-testid="scene-selection-error-details">{selectionError.code}: {selectionError.message}</pre></details>}{frameStatus&&<p className="re-gizmo-status re-framing-status" style={{bottom:30}} data-testid="scene-camera-frame-status" role="status">{frameStatus}</p>}<canvas ref={ref} width={960} height={640} tabIndex={0} aria-label="Rendered scene" data-testid="scene-canvas" />
    <ViewOrientation camera={presentation.cameraPreview??presentation.viewportCamera??snapshot.accepted.camera}/><SceneGizmo mode={gizmoMode} onModeChange={onGizmoModeChange} showModeButtons={showGizmoModeButtons} controller={controller} canvas={canvasElement} disabled={navigationDisabled} onError={onError} onHelp={onGizmoHelp} onGestureChange={active=>{gesture.current=active;selection.current?.reset();input.current?.reset();onTransformGesture?.(active);}}/>
    {presentation.presentedRevision === null && <div className="re-viewport-fault" role="status"><p>{presentation.disposed ? 'Preview closed.' : presentation.presentationError ? 'Preview unavailable. Your applied scene is kept.' : 'Opening scene…'}</p>{presentation.presentationError && !presentation.disposed && <button type="button" onClick={() => action(controller.recover(), onError)}>Restore preview</button>}</div>}</div>
    {localHelp&&<div className="re-camera-local-help" role="dialog" aria-label="Camera controls"><p>An unmodified primary click is intended to select an applied object, while a drag moves the view. Canvas selection requires renderer support; if it is unavailable, use the Outliner. Selection keeps editing drafts. Left drag and arrows Orbit. Shift-drag, Pan, or Shift-arrows move the view. Wheel and +/− zoom. Navigation changes only User view and keeps authoring drafts editable. Scene camera or Escape restores the stored scene view. Set scene camera applies the view through complete Apply; first Apply or Discard any manual camera draft. Frame all or Shift-F fits the applied objects; Frame selected or F fits the applied selection. F works only on the focused scene or handle. Raw drafts stay intact. Save stores the scene camera, not User view.</p><button type="button" onClick={()=>{setLocalHelp(false);helpButton.current?.focus();}}>Close Help</button></div>}
  </section>;
}

export function SourcePanel({controller, onError, onManualEdit, navigationDisabled, showApply = true}: RenderEditorPanelProps & {onManualEdit?: () => void; showApply?: boolean}) {
  const snapshot = useSession(controller);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), disabled = Boolean(navigationDisabled) || snapshot.disposed || Boolean(view.cameraPreview||view.transformPreview||view.animationPreview);
  const source = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (snapshot.sourceDirty) return;
    const range = snapshot.metadata.objects.find(object => object.id === snapshot.activeObjectId)?.range;
    if (range) source.current?.setSelectionRange(range.start, range.end);
  }, [snapshot.activeObjectId]);
  return <section className="re-source re-panel" aria-label="Scene source editor">
    <div className="re-panel-heading"><h2>Source</h2><span>{snapshot.sourceDirty ? 'Draft' : 'Applied'}</span>{showApply && <button type="button" aria-label="Apply source" disabled={!snapshot.sourceDirty || disabled || snapshot.objectInputInvalid||snapshot.animationInputInvalid} onClick={() => action(controller.apply('source'), onError)}>Apply</button>}</div>
    {snapshot.objectInputInvalid && <p className="re-sphere-source-warning">Editing Source replaces object field drafts.</p>}{snapshot.animationInputInvalid&&<p className="re-sphere-source-warning">Animation key drafts remain until corrected or Discard.</p>}
    <textarea ref={source} aria-label="Scene source" data-testid="scene-source" disabled={disabled} spellCheck={false} value={snapshot.draftSource} onChange={event => {if((controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return;try { controller.session.setDraftSource(event.target.value); onManualEdit?.(); } catch (error) { onError?.(normalizeRenderEditorError(error)); } }} />
  </section>;
}

export function ObjectPanel({controller,navigationDisabled}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <section className="re-objects re-panel" aria-label="Scene objects">
    <div className="re-panel-heading"><h2>Objects</h2><span>{snapshot.metadata.objects.length}</span></div>
    <p className="re-caption">{snapshot.metadata.name}</p>
    <ul>{snapshot.metadata.objects.map(object => <li key={object.id}><button type="button" data-testid={`scene-object-${object.id}`} data-scene-object={object.id} disabled={navigationDisabled||snapshot.disposed||Boolean(view.cameraPreview||view.transformPreview||view.animationPreview)} aria-pressed={snapshot.activeObjectId === object.id} onClick={() => {if(!(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))controller.session.setActiveObject(object.id);}}><WorkbenchIcon kind={object.type}/><span>{object.id}</span><small>{OBJECT_LABELS[object.type]}</small></button></li>)}</ul>
  </section>;
}

export function CameraPanel({controller, onError, navigationDisabled, showApply = true}: RenderEditorPanelProps & {showApply?: boolean}) {
  const snapshot = useSession(controller);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot), disabled = Boolean(navigationDisabled) || snapshot.disposed || Boolean(view.cameraPreview||view.transformPreview||view.animationPreview);
  const shownCamera = snapshot.draftCamera;
  const set = (field: keyof MeshCamera, value: number, axis?: number) => {
    if((controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return;
    const camera = structuredClone(snapshot.draftCamera);
    if (axis === undefined) (camera as unknown as Record<string, number>)[field] = value;
    else (camera[field] as [number, number, number])[axis] = value;
    controller.session.setDraftCamera(camera);
  };
  const vector = (field: 'eye' | 'target' | 'up') => <fieldset key={field}><legend>{field === 'eye' ? 'Position · scene units' : field === 'target' ? 'Target · scene units' : 'Up direction'}</legend><div className="re-vector">{shownCamera[field].map((value, axis) => <label key={axis}><span>{['X', 'Y', 'Z'][axis]}</span><input type="number" disabled={disabled} step="0.1" aria-label={`${field} ${['X', 'Y', 'Z'][axis]}`} value={Number.isFinite(value) ? value : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value), axis)} /></label>)}</div></fieldset>;
  const scalar = (field: 'fovYDegrees' | 'near' | 'far') => <label className="re-scalar" key={field}><span>{field === 'fovYDegrees' ? 'Field of view (°)' : field === 'near' ? 'Near clip · scene units' : 'Far clip · scene units'}</span><input type="number" disabled={disabled} step={field === 'fovYDegrees' ? 1 : 0.01} aria-label={field} value={Number.isFinite(shownCamera[field]) ? shownCamera[field] : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value))} /></label>;
  return <section className="re-camera re-panel" aria-label="Camera settings">
    <div className="re-panel-heading"><h2>Scene camera</h2><span>{snapshot.cameraDirty ? 'Draft' : 'Applied'}</span></div>
    {vector('eye')}{vector('target')}{scalar('fovYDegrees')}
    <details className="re-camera-advanced"><summary>Advanced camera</summary>{vector('up')}{scalar('near')}{scalar('far')}</details>
    {showApply && <button type="button" className="re-primary" aria-label="Apply camera" disabled={!snapshot.cameraDirty || disabled || snapshot.objectInputInvalid||snapshot.animationInputInvalid} onClick={() => action(controller.apply('camera'), onError)}>Apply</button>}
  </section>;
}

export function DiagnosticsPanel({controller, onError, onCorrectObject, onCorrectAnimation, objectCorrectionLabel = 'Edit object properties'}: RenderEditorPanelProps & {onCorrectObject?: () => void; onCorrectAnimation?: () => void; objectCorrectionLabel?: string}) {
  const snapshot = useSession(controller);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [acknowledged, setAcknowledged] = useState<RenderEditorError | null>(null);
  const error = presentation.presentationError;
  const unavailable = presentation.presentedRevision === null;
  const showNotice = error !== null && !presentation.disposed && (unavailable || acknowledged !== error);
  const dirty = snapshot.sourceDirty || snapshot.cameraDirty;
  const retry = () => action(controller.apply(snapshot.sourceDirty && !snapshot.cameraDirty ? 'source' : snapshot.cameraDirty && !snapshot.sourceDirty ? 'camera' : 'both'), onError);
  return <section className="re-diagnostics re-panel" aria-label="Diagnostics"><div className="re-panel-heading"><h2>Source errors</h2><span data-testid="source-error-count">{snapshot.diagnostics.length}</span></div>
    <div role="status">{snapshot.animationInputInvalid ? <><p className="re-caption">Animation keys need correction. Return to the incomplete key.</p>{onCorrectAnimation&&<button type="button" className="re-inspector-action" disabled={Boolean(presentation.animationPreview)} onClick={onCorrectAnimation}>Edit animation keys</button>}</> : snapshot.objectInputInvalid ? <><p className="re-caption">Object properties need correction. Return to the incomplete object.</p>{onCorrectObject && <button type="button" className="re-inspector-action" disabled={Boolean(presentation.cameraPreview||presentation.transformPreview||presentation.animationPreview)} onClick={onCorrectObject}>{objectCorrectionLabel}</button>}</> : snapshot.diagnostics.length === 0 ? <p className="re-caption">{snapshot.sourceDirty ? 'Ready to apply.' : 'No source errors.'}</p> : <ul>{snapshot.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic.range ? `Line ${diagnostic.range.line}, column ${diagnostic.range.column}: ` : ''}{diagnostic.message}</li>)}</ul>}</div>
    {showNotice && <section className="re-preview-notice" data-testid="preview-notice" aria-label="Preview status"><div role="status"><h3>{unavailable ? 'Preview unavailable' : 'Update failed'}</h3><p>{unavailable ? 'Your applied scene is kept. Restore the preview to continue.' : 'The previous scene is still shown.'}</p>{!unavailable && <p>{dirty ? 'Check the draft, then try Apply again.' : 'There are no pending edits.'}</p>}</div>
      {!unavailable && <div className="re-preview-actions">{dirty && <button type="button" disabled={snapshot.objectInputInvalid||snapshot.animationInputInvalid||Boolean(presentation.cameraPreview||presentation.transformPreview||presentation.animationPreview)} onClick={retry}>Retry update</button>}<button type="button" onClick={() => setAcknowledged(error)}>Dismiss preview notice</button></div>}
      <details><summary>Details</summary><pre data-testid="preview-error-details">{error.code}: {error.message}</pre></details>
    </section>}
  </section>;
}

/** Reusable workbench. The application supplies file actions, routes and menus. */
export function RenderEditor({controller, header, toolbar, onError, onAction, projectBrowser, onObjectHelp, onCameraHelp, onObjectSelection, onGizmoHelp, onTransformGesture, onPlaybackChange, onAnimationHelp, onDuplicateCommandChange, onFrameCommandChange, navigationDisabled}: RenderEditorProps) {
  const state = useSession(controller), view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [gizmoMode,setGizmoMode]=useState<RenderSceneGizmoMode>('translate');
  const [playbackActive,setPlaybackActive]=useState(false), playbackRef=useRef(false), [keyCorrection,setKeyCorrection]=useState(0);
  const [transformGesture,setTransformGesture]=useState(false), transformGestureRef=useRef(false);
  const [browserTab,setBrowserTab] = useState<'scene'|'projects'>('scene'), [inspectorTab,setInspectorTab] = useState<'object'|'camera'>('object');
  const [drawer,setDrawer] = useState<'source'|'problems'|null>(null), [manualEdit,setManualEdit] = useState(0);
  const [addKind,setAddKind] = useState<RenderSceneObjectKind>('sphere'), [addId,setAddId] = useState('sphere_1'), [toolError,setToolError] = useState<RenderEditorError|null>(null);
  const automaticAddName=useRef(true);
  const source = useRef<HTMLDivElement>(null), object = useRef<HTMLDivElement>(null), invalidObject = useRef<string|null>(null);
  const invalidObjectSource = useRef(false);
  const duplicateCommand=useRef<()=>void>(()=>{});
  const pendingSelection = useRef<{id:string; documentId:string;duplicateBase?:typeof state.accepted}|null>(null);
  useEffect(()=>controller.session.subscribe(()=>{const pending=pendingSelection.current,next=controller.session.getSnapshot();if(pending?.duplicateBase&&next.accepted===pending.duplicateBase&&next.draftSource===pending.duplicateBase.sceneSource)pendingSelection.current=null;}),[controller]);
  const objects = useMemo(() => { try { return inspectRenderSceneObjects(state.draftSource); } catch { return null; } }, [state.draftSource]);
  const sourceValid = objects !== null, cameraPending=playbackActive||transformGesture||Boolean(view.cameraPreview||view.transformPreview||view.animationPreview), disabled = cameraPending || state.disposed || state.objectInputInvalid || state.animationInputInvalid || !sourceValid;
  const active = state.activeObjectId, draftIds = new Set(objects?.map(value => value.objectId) ?? []);
  const pendingAdded = objects?.filter(value => !state.metadata.objects.some(old => old.id === value.objectId)).map(value => value.objectId) ?? [];
  const pendingRemoved = sourceValid ? state.metadata.objects.filter(value => !draftIds.has(value.id)).map(value => value.id) : [];
  const nextId = (kind: RenderSceneObjectKind) => { let n=1; while(draftIds.has(`${kind}_${n}`))n++; return `${kind}_${n}`; };
  useEffect(()=>{if(automaticAddName.current&&sourceValid)setAddId(nextId(addKind));},[state.draftSource,state.accepted,addKind]);
  const report = (cause: unknown) => { const error=normalizeRenderEditorError(cause);setToolError(error);onError?.(error); };
  const editSource = () => { if(playbackRef.current||transformGestureRef.current||(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return; setDrawer('source'); requestAnimationFrame(() => source.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()); };
  const correctObject = () => {
    if(playbackRef.current||transformGestureRef.current||(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return;
    if(invalidObjectSource.current){editSource();return;}
    setInspectorTab('object');setBrowserTab('scene');
    const id=invalidObject.current; if(id&&state.metadata.objects.some(value=>value.id===id))controller.session.setActiveObject(id);
    requestAnimationFrame(() => {const field=object.current?.querySelector<HTMLInputElement>('[data-testid="scene-object-fields"] input[aria-invalid="true"]')??object.current?.querySelector<HTMLInputElement>('[data-testid="scene-object-fields"] input:not(:disabled)');field?.focus();});
  };
  useEffect(() => {
    invalidObject.current=null;invalidObjectSource.current=false;setToolError(null);
    const pending=pendingSelection.current;
    if(pending&&pending.documentId===state.accepted.documentId&&state.metadata.objects.some(value=>value.id===pending.id)){controller.session.setActiveObject(pending.id);pendingSelection.current=null;setInspectorTab('object');}
    else if(!state.activeObjectId&&state.metadata.objects.length)controller.session.setActiveObject(state.metadata.objects[0]!.id);
  }, [state.accepted]);
  useEffect(() => { if(!state.objectInputInvalid)invalidObject.current=null; if(pendingSelection.current&&sourceValid&&!draftIds.has(pendingSelection.current.id))pendingSelection.current=null; }, [state.objectInputInvalid,state.draftSource]);
  const add = (kind:RenderSceneObjectKind=addKind,id:string=addId,quick=false) => {
    if(playbackRef.current||transformGestureRef.current||disabled||(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return;
    try {const output=addRenderSceneObjectSource(controller.session.getSnapshot().draftSource,kind,id);controller.session.setDraftObjectSource(output);pendingSelection.current={id,documentId:state.accepted.documentId};setToolError(null);const ids=new Set(inspectRenderSceneObjects(output).map(value=>value.objectId));let n=1;while(ids.has(`${kind}_${n}`))n++;setAddKind(kind);if(!quick||automaticAddName.current){automaticAddName.current=true;setAddId(`${kind}_${n}`);}}
    catch(cause){report(cause);}
  };
  const duplicateSelected = () => {
    const current=controller.session.getSnapshot(),presentation=controller.getSnapshot();
    if(navigationDisabled||playbackRef.current||transformGestureRef.current||current.disposed||presentation.disposed||presentation.cameraPreview||presentation.transformPreview||presentation.animationPreview||current.objectInputInvalid||current.animationInputInvalid||!current.activeObjectId)return;
    try {
      const inventory=inspectRenderSceneObjects(current.draftSource),selected=inventory.find(value=>value.objectId===current.activeObjectId);
      if(!selected||inventory.length>=32)return;
      const ids=new Set(inventory.map(value=>value.objectId));let number=1;while(ids.has(`${selected.type}_${number}`))number++;
      const id=`${selected.type}_${number}`,output=duplicateRenderSceneObjectSource(current.draftSource,selected.objectId,id);
      if(controller.session.getSnapshot()!==current||controller.getSnapshot()!==presentation)return;
      controller.session.setDraftObjectSource(output);
      pendingSelection.current={id,documentId:current.accepted.documentId,duplicateBase:current.accepted};setToolError(null);
    }catch(cause){report(cause);}
  };
  duplicateCommand.current=duplicateSelected;
  useEffect(()=>{let live=true;onDuplicateCommandChange?.(()=>{if(live)duplicateCommand.current();});return()=>{live=false;onDuplicateCommandChange?.(null);};},[controller,onDuplicateCommandChange]);
  const remove = () => {
    if(playbackRef.current||transformGestureRef.current||disabled||(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview)||!active||!draftIds.has(active))return;
    try {controller.session.setDraftObjectSource(removeRenderSceneObjectSource(state.draftSource,active));setToolError(null);}catch(cause){report(cause);}
  };
  const addNameError = !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(addId) ? 'Use an ASCII name of 1 to 48 characters.' : draftIds.has(addId) ? 'This name already exists.' : null;
  const scene = <div onClickCapture={event=>{if((event.target as HTMLElement).closest('[data-scene-object]'))setInspectorTab('object');}}><ObjectPanel controller={controller} navigationDisabled={transformGesture||playbackActive}/></div>;
  const addToolbar = <section className="re-scene-object-tools" aria-label="Scene object tools"><div className="re-studio-add-types" aria-label="Add primitives">{(['sphere','box','cylinder','capsule','rounded-box','torus'] as const).map(kind=><button key={kind} type="button" data-testid={`add-${kind}`} aria-label={`Add ${OBJECT_LABELS[kind]}`} title={`Add ${OBJECT_LABELS[kind]} to draft`} disabled={disabled||(objects?.length??0)>=32} onClick={()=>add(kind,nextId(kind),true)}><WorkbenchIcon kind={kind}/><span>{OBJECT_LABELS[kind]}</span></button>)}</div><label>Type<select aria-label="Add object type" data-testid="add-object-type" disabled={disabled} value={addKind} onChange={event=>{const kind=event.target.value as RenderSceneObjectKind;setAddKind(kind);if(automaticAddName.current)setAddId(nextId(kind));}}>{(['sphere','box','cylinder','capsule','rounded-box','torus'] as const).map(kind=><option key={kind} value={kind}>{OBJECT_LABELS[kind]}</option>)}</select></label><label>Name<input aria-label="Add object name" data-testid="add-object-name" type="text" maxLength={48} disabled={disabled} value={addId} aria-invalid={addNameError!==null} onChange={event=>{automaticAddName.current=false;setAddId(event.target.value);}}/></label>{addNameError&&<p className="re-caption" data-testid="add-object-name-error">{addNameError}</p>}<div className="re-scene-tool-actions"><button type="button" data-testid="add-object" disabled={disabled||Boolean(addNameError)||(objects?.length??0)>=32} onClick={()=>add()}>Add to draft</button><button type="button" data-testid="duplicate-object" disabled={disabled||navigationDisabled||!active||!draftIds.has(active)||(objects?.length??0)>=32} onClick={duplicateSelected}>Duplicate selected</button><button type="button" data-testid="remove-object" disabled={disabled||!active||!draftIds.has(active)} onClick={remove}>Remove selected</button></div>{pendingAdded.length>0&&<p className="re-caption" data-testid="pending-add">Pending add: {pendingAdded.join(', ')}. Apply to show.</p>}{pendingRemoved.length>0&&<p className="re-caption" data-testid="pending-remove">Pending remove: {pendingRemoved.join(', ')}. Apply to remove.</p>}{toolError&&<div className="re-scene-source-error"><p>The object operation was refused. Check the source or fields.</p><details><summary>Details</summary><pre>{toolError.message}</pre></details></div>}</section>;
  const selectedType=state.metadata.objects.find(value=>value.id===active)?.type;
  const railMode=(mode:RenderSceneGizmoMode)=>{if(playbackRef.current||transformGestureRef.current||controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview)return;setGizmoMode(mode);};
  const toolRail=<>{(['translate','rotate','scale'] as const).map(mode=><button type="button" key={mode} data-testid={`gizmo-mode-${mode}`} aria-pressed={gizmoMode===mode} disabled={cameraPending||state.disposed} aria-label={mode==='translate'?'Move':mode==='rotate'?'Rotate':selectedType==='rounded-box'?'Size':selectedType==='box'?'Scale':'Uniform scale'} title={mode==='translate'?'Move':mode==='rotate'?'Rotate':selectedType==='rounded-box'?'Size XYZ / uniform':selectedType==='box'?'Scale XYZ / uniform':'Uniform scale'} onClick={()=>railMode(mode)}><span aria-hidden="true">{mode==='translate'?'↗':mode==='rotate'?'↻':'↔'}</span></button>)}</>;
  const actions = <div className="re-workbench-main-actions re-scene-main-actions">{header}{toolbar}{onAction&&<>{(['new','open','save'] as const).map(name=><button type="button" key={name} disabled={cameraPending} onClick={()=>{if(!playbackRef.current&&!transformGestureRef.current&&!(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))onAction(name);}}>{name}</button>)}</>}<button type="button" className="re-workbench-apply" data-testid="scene-apply" disabled={cameraPending||state.disposed||state.objectInputInvalid||state.animationInputInvalid||!(state.sourceDirty||state.cameraDirty)} onClick={()=>action(controller.apply('both'),onError)}>Apply</button><button type="button" data-testid="scene-discard" disabled={cameraPending||state.disposed||!(state.sourceDirty||state.cameraDirty)} onClick={()=>{if(playbackRef.current||transformGestureRef.current||(controller.getSnapshot().cameraPreview||controller.getSnapshot().transformPreview||controller.getSnapshot().animationPreview))return;controller.session.discardDraft();setToolError(null);}}>Discard</button></div>;
  return <SourceStudioLayout scene={scene} toolRail={toolRail} addToolbar={addToolbar} projects={projectBrowser??<p className="re-caption">The host provides projects.</p>}
    object={<div ref={object}><SceneObjectInspector controller={controller} disabled={cameraPending||state.animationInputInvalid} manualEdit={manualEdit} onEditSource={editSource} onHelp={onObjectHelp} onError={onError} onInvalidObject={(id, sourceCorrection)=>{invalidObject.current=id;invalidObjectSource.current=Boolean(sourceCorrection);}}/></div>}
    camera={<CameraPanel controller={controller} onError={onError} navigationDisabled={transformGesture||playbackActive} showApply={false}/>}
    viewport={<SceneViewport onObjectSelection={id=>{setInspectorTab('object');setBrowserTab('scene');onObjectSelection?.(id);}} onFrameCommandChange={onFrameCommandChange} gizmoMode={gizmoMode} onGizmoModeChange={railMode} showGizmoModeButtons={false} controller={controller} onError={onError} onCameraHelp={onCameraHelp} onGizmoHelp={onGizmoHelp} onTransformGesture={active=>{transformGestureRef.current=active;setTransformGesture(active);onTransformGesture?.(active);}} navigationDisabled={navigationDisabled||playbackActive||Boolean(view.animationPreview)}/>} timeline={<SourceTimeline controller={controller} disabled={navigationDisabled} correctionRequest={keyCorrection} onError={onError} onHelp={onAnimationHelp} onPlaybackChange={active=>{playbackRef.current=active;setPlaybackActive(active);onPlaybackChange?.(active);}}/>}
    actions={actions} source={<div ref={source}><SourcePanel controller={controller} onError={onError} navigationDisabled={transformGesture||playbackActive} showApply={false} onManualEdit={()=>setManualEdit(value=>value+1)}/></div>}
    problems={<DiagnosticsPanel controller={controller} onError={onError} onCorrectObject={correctObject} onCorrectAnimation={()=>setKeyCorrection(value=>value+1)} objectCorrectionLabel={invalidObjectSource.current?'Edit source':'Edit object properties'}/>}
    browserTab={browserTab} onBrowserTab={setBrowserTab} inspectorTab={inspectorTab} onInspectorTab={setInspectorTab}
    drawer={drawer} onDrawer={setDrawer} problemCount={state.diagnostics.length+(view.presentationError?1:0)}/>;
}
