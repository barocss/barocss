import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderEditorController, RenderEditorActionResult} from './controller.js';
import type {RenderEditorError} from './errors.js';
import {normalizeRenderEditorError} from './errors.js';
import {createSceneViewportPresenter} from './scene-viewport.js';
import {MixedWorkbenchLayout} from './mixed-workbench-layout.js';
import {WorkbenchIcon, ViewOrientation} from './mixed-workbench-icons.js';
import {SceneObjectInspector} from './scene-object-inspector.js';
import {inspectRenderSceneObjects, addRenderSceneObjectSource, removeRenderSceneObjectSource} from './scene-object-source.js';
import type {RenderSceneObjectKind} from './scene-object-source.js';
const OBJECT_LABELS: Record<RenderSceneObjectKind, string> = {sphere:'Sphere',box:'Box',cylinder:'Cylinder',capsule:'Capsule','rounded-box':'Rounded box',torus:'Torus'};
export {createSceneViewportPresenter} from './scene-viewport.js';
export * from './mixed-react.js';

export interface RenderEditorPanelProps {controller: RenderEditorController; onError?: (error: RenderEditorError) => void}
export interface RenderEditorProps extends RenderEditorPanelProps {
  header?: ReactNode;
  toolbar?: ReactNode;
  onAction?: (action: 'new' | 'open' | 'save') => void;
  projectBrowser?: ReactNode;
  onObjectHelp?: () => void;
}
function useSession(controller: RenderEditorController) { return useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot); }
function action(result: RenderEditorActionResult, onError?: (error: RenderEditorError) => void) { if (!result.ok) onError?.(result.error); }

export function SceneViewport({controller, onError}: RenderEditorPanelProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const canvas = ref.current!;
    const presenter = createSceneViewportPresenter(canvas, error => controller.presentationUnavailable(error));
    let observer: ResizeObserver | null = null;
    const dispose = presenter.dispose;
    presenter.dispose = () => { observer?.disconnect(); dispose(); };
    action(controller.attachPresenter(presenter), onError);
    const resize = () => {
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
    return () => { observer.disconnect(); controller.detachPresenter(presenter); };
  }, [controller]);
  return <section className="re-viewport" aria-label="Scene viewport">
    <canvas ref={ref} width={960} height={640} aria-label="Rendered scene" data-testid="scene-canvas" />
    <div className="re-viewport-label">Scene<span>Perspective</span></div>
    {presentation.presentedRevision === null && <div className="re-viewport-fault" role="status"><p>{presentation.disposed ? 'Preview closed.' : presentation.presentationError ? 'Preview unavailable. Your applied scene is kept.' : 'Opening scene…'}</p>{presentation.presentationError && !presentation.disposed && <button type="button" onClick={() => action(controller.recover(), onError)}>Restore preview</button>}</div>}
  </section>;
}

export function SourcePanel({controller, onError, onManualEdit, showApply = true}: RenderEditorPanelProps & {onManualEdit?: () => void; showApply?: boolean}) {
  const snapshot = useSession(controller);
  const source = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (snapshot.sourceDirty) return;
    const range = snapshot.metadata.objects.find(object => object.id === snapshot.activeObjectId)?.range;
    if (range) source.current?.setSelectionRange(range.start, range.end);
  }, [snapshot.activeObjectId]);
  return <section className="re-source re-panel" aria-label="Scene source editor">
    <div className="re-panel-heading"><h2>Source</h2><span>{snapshot.sourceDirty ? 'Draft' : 'Applied'}</span>{showApply && <button type="button" aria-label="Apply source" disabled={!snapshot.sourceDirty || snapshot.disposed || snapshot.objectInputInvalid} onClick={() => action(controller.apply('source'), onError)}>Apply</button>}</div>
    {snapshot.objectInputInvalid && <p className="re-sphere-source-warning">Editing Source replaces object field drafts.</p>}
    <textarea ref={source} aria-label="Scene source" data-testid="scene-source" disabled={snapshot.disposed} spellCheck={false} value={snapshot.draftSource} onChange={event => { try { controller.session.setDraftSource(event.target.value); onManualEdit?.(); } catch (error) { onError?.(normalizeRenderEditorError(error)); } }} />
  </section>;
}

export function ObjectPanel({controller}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  return <section className="re-objects re-panel" aria-label="Scene objects">
    <div className="re-panel-heading"><h2>Objects</h2><span>{snapshot.metadata.objects.length}</span></div>
    <p className="re-caption">{snapshot.metadata.name}</p>
    <ul>{snapshot.metadata.objects.map(object => <li key={object.id}><button type="button" data-testid={`scene-object-${object.id}`} data-scene-object={object.id} disabled={snapshot.disposed} aria-pressed={snapshot.activeObjectId === object.id} onClick={() => controller.session.setActiveObject(object.id)}><WorkbenchIcon kind={object.type}/><span>{object.id}</span><small>{OBJECT_LABELS[object.type]}</small></button></li>)}</ul>
  </section>;
}

export function CameraPanel({controller, onError, showApply = true}: RenderEditorPanelProps & {showApply?: boolean}) {
  const snapshot = useSession(controller);
  const set = (field: keyof MeshCamera, value: number, axis?: number) => {
    const camera = structuredClone(snapshot.draftCamera);
    if (axis === undefined) (camera as unknown as Record<string, number>)[field] = value;
    else (camera[field] as [number, number, number])[axis] = value;
    controller.session.setDraftCamera(camera);
  };
  const vector = (field: 'eye' | 'target' | 'up') => <fieldset key={field}><legend>{field === 'eye' ? 'Position · scene units' : field === 'target' ? 'Target · scene units' : 'Up direction'}</legend><div className="re-vector">{snapshot.draftCamera[field].map((value, axis) => <label key={axis}><span>{['X', 'Y', 'Z'][axis]}</span><input type="number" disabled={snapshot.disposed} step="0.1" aria-label={`${field} ${['X', 'Y', 'Z'][axis]}`} value={Number.isFinite(value) ? value : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value), axis)} /></label>)}</div></fieldset>;
  const scalar = (field: 'fovYDegrees' | 'near' | 'far') => <label className="re-scalar" key={field}><span>{field === 'fovYDegrees' ? 'Field of view (°)' : field === 'near' ? 'Near clip · scene units' : 'Far clip · scene units'}</span><input type="number" disabled={snapshot.disposed} step={field === 'fovYDegrees' ? 1 : 0.01} aria-label={field} value={Number.isFinite(snapshot.draftCamera[field]) ? snapshot.draftCamera[field] : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value))} /></label>;
  return <section className="re-camera re-panel" aria-label="Camera settings">
    <div className="re-panel-heading"><h2>Camera</h2><span>{snapshot.cameraDirty ? 'Draft' : 'Applied'}</span></div>
    {vector('eye')}{vector('target')}{scalar('fovYDegrees')}
    <details className="re-camera-advanced"><summary>Advanced camera</summary>{vector('up')}{scalar('near')}{scalar('far')}</details>
    {showApply && <button type="button" className="re-primary" aria-label="Apply camera" disabled={!snapshot.cameraDirty || snapshot.disposed || snapshot.objectInputInvalid} onClick={() => action(controller.apply('camera'), onError)}>Apply</button>}
  </section>;
}

export function DiagnosticsPanel({controller, onError, onCorrectObject, objectCorrectionLabel = 'Edit object properties'}: RenderEditorPanelProps & {onCorrectObject?: () => void; objectCorrectionLabel?: string}) {
  const snapshot = useSession(controller);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [acknowledged, setAcknowledged] = useState<RenderEditorError | null>(null);
  const error = presentation.presentationError;
  const unavailable = presentation.presentedRevision === null;
  const showNotice = error !== null && !presentation.disposed && (unavailable || acknowledged !== error);
  const dirty = snapshot.sourceDirty || snapshot.cameraDirty;
  const retry = () => action(controller.apply(snapshot.sourceDirty && !snapshot.cameraDirty ? 'source' : snapshot.cameraDirty && !snapshot.sourceDirty ? 'camera' : 'both'), onError);
  return <section className="re-diagnostics re-panel" aria-label="Diagnostics"><div className="re-panel-heading"><h2>Source errors</h2><span data-testid="source-error-count">{snapshot.diagnostics.length}</span></div>
    <div role="status">{snapshot.objectInputInvalid ? <><p className="re-caption">Object properties need correction. Return to the incomplete object.</p>{onCorrectObject && <button type="button" className="re-inspector-action" onClick={onCorrectObject}>{objectCorrectionLabel}</button>}</> : snapshot.diagnostics.length === 0 ? <p className="re-caption">{snapshot.sourceDirty ? 'Ready to apply.' : 'No source errors.'}</p> : <ul>{snapshot.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic.range ? `Line ${diagnostic.range.line}, column ${diagnostic.range.column}: ` : ''}{diagnostic.message}</li>)}</ul>}</div>
    {showNotice && <section className="re-preview-notice" data-testid="preview-notice" aria-label="Preview status"><div role="status"><h3>{unavailable ? 'Preview unavailable' : 'Update failed'}</h3><p>{unavailable ? 'Your applied scene is kept. Restore the preview to continue.' : 'The previous scene is still shown.'}</p>{!unavailable && <p>{dirty ? 'Check the draft, then try Apply again.' : 'There are no pending edits.'}</p>}</div>
      {!unavailable && <div className="re-preview-actions">{dirty && <button type="button" disabled={snapshot.objectInputInvalid} onClick={retry}>Retry update</button>}<button type="button" onClick={() => setAcknowledged(error)}>Dismiss preview notice</button></div>}
      <details><summary>Details</summary><pre data-testid="preview-error-details">{error.code}: {error.message}</pre></details>
    </section>}
  </section>;
}

/** Reusable workbench. The application supplies file actions, routes and menus. */
export function RenderEditor({controller, header, toolbar, onError, onAction, projectBrowser, onObjectHelp}: RenderEditorProps) {
  const state = useSession(controller), view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [browserTab,setBrowserTab] = useState<'scene'|'projects'>('scene'), [inspectorTab,setInspectorTab] = useState<'object'|'camera'>('object');
  const [drawer,setDrawer] = useState<'source'|'problems'|null>(null), [manualEdit,setManualEdit] = useState(0);
  const [addKind,setAddKind] = useState<RenderSceneObjectKind>('sphere'), [addId,setAddId] = useState('sphere_1'), [toolError,setToolError] = useState<RenderEditorError|null>(null);
  const source = useRef<HTMLDivElement>(null), object = useRef<HTMLDivElement>(null), invalidObject = useRef<string|null>(null);
  const invalidObjectSource = useRef(false);
  const pendingSelection = useRef<{id:string; documentId:string}|null>(null);
  const objects = useMemo(() => { try { return inspectRenderSceneObjects(state.draftSource); } catch { return null; } }, [state.draftSource]);
  const sourceValid = objects !== null, disabled = state.disposed || state.objectInputInvalid || !sourceValid;
  const active = state.activeObjectId, draftIds = new Set(objects?.map(value => value.objectId) ?? []);
  const pendingAdded = objects?.filter(value => !state.metadata.objects.some(old => old.id === value.objectId)).map(value => value.objectId) ?? [];
  const pendingRemoved = sourceValid ? state.metadata.objects.filter(value => !draftIds.has(value.id)).map(value => value.id) : [];
  const nextId = (kind: RenderSceneObjectKind) => { let n=1; while(draftIds.has(`${kind}_${n}`))n++; return `${kind}_${n}`; };
  const report = (cause: unknown) => { const error=normalizeRenderEditorError(cause);setToolError(error);onError?.(error); };
  const editSource = () => { setDrawer('source'); requestAnimationFrame(() => source.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()); };
  const correctObject = () => {
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
  const add = () => {
    if(disabled)return;
    try {const output=addRenderSceneObjectSource(state.draftSource,addKind,addId);controller.session.setDraftObjectSource(output);pendingSelection.current={id:addId,documentId:state.accepted.documentId};setToolError(null);const ids=new Set(inspectRenderSceneObjects(output).map(value=>value.objectId));let n=1;while(ids.has(`${addKind}_${n}`))n++;setAddId(`${addKind}_${n}`);}
    catch(cause){report(cause);}
  };
  const remove = () => {
    if(disabled||!active||!draftIds.has(active))return;
    try {controller.session.setDraftObjectSource(removeRenderSceneObjectSource(state.draftSource,active));setToolError(null);}catch(cause){report(cause);}
  };
  const addNameError = !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(addId) ? 'Use an ASCII name of 1 to 48 characters.' : draftIds.has(addId) ? 'This name already exists.' : null;
  const scene = <><div onClickCapture={event=>{if((event.target as HTMLElement).closest('[data-scene-object]'))setInspectorTab('object');}}><ObjectPanel controller={controller}/></div><section className="re-scene-object-tools" aria-label="Scene object tools"><div className="re-panel-heading"><h2>Add object</h2></div><label>Type<select aria-label="Add object type" data-testid="add-object-type" disabled={disabled} value={addKind} onChange={event=>{const kind=event.target.value as RenderSceneObjectKind;setAddKind(kind);setAddId(nextId(kind));}}>{(['sphere','box','cylinder','capsule','rounded-box','torus'] as const).map(kind=><option key={kind} value={kind}>{OBJECT_LABELS[kind]}</option>)}</select></label><label>Name<input aria-label="Add object name" data-testid="add-object-name" type="text" maxLength={48} disabled={disabled} value={addId} aria-invalid={addNameError!==null} onChange={event=>setAddId(event.target.value)}/></label>{addNameError&&<p className="re-caption">{addNameError}</p>}<div className="re-scene-tool-actions"><button type="button" data-testid="add-object" disabled={disabled||Boolean(addNameError)||(objects?.length??0)>=32} onClick={add}>Add to draft</button><button type="button" data-testid="remove-object" disabled={disabled||!active||!draftIds.has(active)} onClick={remove}>Remove selected</button></div>{pendingAdded.length>0&&<p className="re-caption" data-testid="pending-add">Pending add: {pendingAdded.join(', ')}. Apply to show.</p>}{pendingRemoved.length>0&&<p className="re-caption" data-testid="pending-remove">Pending remove: {pendingRemoved.join(', ')}. Apply to remove.</p>}{toolError&&<div className="re-scene-source-error"><p>The object operation was refused. Check the source or fields.</p><details><summary>Details</summary><pre>{toolError.message}</pre></details></div>}</section></>;
  const actions = <div className="re-workbench-main-actions re-scene-main-actions">{header}{toolbar}{onAction&&<>{(['new','open','save'] as const).map(name=><button type="button" key={name} onClick={()=>onAction(name)}>{name}</button>)}</>}<button type="button" className="re-workbench-apply" data-testid="scene-apply" disabled={state.disposed||state.objectInputInvalid||!(state.sourceDirty||state.cameraDirty)} onClick={()=>action(controller.apply('both'),onError)}>Apply</button><button type="button" data-testid="scene-discard" disabled={state.disposed||!(state.sourceDirty||state.cameraDirty)} onClick={()=>{controller.session.discardDraft();setToolError(null);}}>Discard</button></div>;
  return <MixedWorkbenchLayout scene={scene} projects={projectBrowser??<p className="re-caption">The host provides projects.</p>}
    object={<div ref={object}><SceneObjectInspector controller={controller} manualEdit={manualEdit} onEditSource={editSource} onHelp={onObjectHelp} onError={onError} onInvalidObject={(id, sourceCorrection)=>{invalidObject.current=id;invalidObjectSource.current=Boolean(sourceCorrection);}}/></div>}
    camera={<CameraPanel controller={controller} onError={onError} showApply={false}/>}
    viewport={<><SceneViewport controller={controller} onError={onError}/><ViewOrientation camera={state.accepted.camera}/></>}
    actions={actions} source={<div ref={source}><SourcePanel controller={controller} onError={onError} showApply={false} onManualEdit={()=>setManualEdit(value=>value+1)}/></div>}
    problems={<DiagnosticsPanel controller={controller} onError={onError} onCorrectObject={correctObject} objectCorrectionLabel={invalidObjectSource.current?'Edit source':'Edit object properties'}/>}
    browserTab={browserTab} onBrowserTab={setBrowserTab} inspectorTab={inspectorTab} onInspectorTab={setInspectorTab}
    drawer={drawer} onDrawer={setDrawer} problemCount={state.diagnostics.length+(view.presentationError?1:0)}/>;
}
