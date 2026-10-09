import {useEffect, useRef, useSyncExternalStore, type ReactNode} from 'react';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderEditorController, RenderEditorActionResult} from './controller.js';
import type {RenderEditorError} from './errors.js';
import {normalizeRenderEditorError} from './errors.js';
import {createSceneViewportPresenter} from './scene-viewport.js';
export {createSceneViewportPresenter} from './scene-viewport.js';

export interface RenderEditorPanelProps {controller: RenderEditorController; onError?: (error: RenderEditorError) => void}
export interface RenderEditorProps extends RenderEditorPanelProps {
  header?: ReactNode;
  toolbar?: ReactNode;
  onAction?: (action: 'new' | 'open' | 'save') => void;
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
    <div className="re-viewport-label">{presentation.presentedRevision === null ? 'Viewport unavailable' : `Presented revision ${presentation.presentedRevision}`}<span>Source 1 · WebGL2</span></div>
    {presentation.presentedRevision === null && <div className="re-viewport-fault" role="status"><p>{presentation.presentationError?.message ?? 'Mounting viewport…'}</p><button type="button" onClick={() => action(controller.recover(), onError)}>Recover viewport</button></div>}
  </section>;
}

export function SourcePanel({controller, onError}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  const source = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (snapshot.sourceDirty) return;
    const range = snapshot.metadata.objects.find(object => object.id === snapshot.activeObjectId)?.range;
    if (range) source.current?.setSelectionRange(range.start, range.end);
  }, [snapshot.activeObjectId]);
  return <section className="re-source re-panel" aria-label="Scene source editor">
    <div className="re-panel-heading"><h2>Scene source</h2><span>{snapshot.sourceDirty ? 'Draft' : 'Accepted'} · source 1</span><button type="button" disabled={!snapshot.sourceDirty} onClick={() => action(controller.apply('source'), onError)}>Apply source</button></div>
    <textarea ref={source} aria-label="Scene source" data-testid="scene-source" spellCheck={false} value={snapshot.draftSource} onChange={event => { try { controller.session.setDraftSource(event.target.value); } catch (error) { onError?.(normalizeRenderEditorError(error)); } }} />
  </section>;
}

export function ObjectPanel({controller}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  return <section className="re-objects re-panel" aria-label="Scene objects">
    <div className="re-panel-heading"><h2>Objects</h2><span>{snapshot.metadata.objects.length}</span></div>
    <p className="re-caption">Accepted scene · {snapshot.metadata.name}</p>
    <ul>{snapshot.metadata.objects.map(object => <li key={object.id}><button type="button" aria-pressed={snapshot.activeObjectId === object.id} onClick={() => controller.session.setActiveObject(object.id)}><span className="re-object-symbol">◇</span><span>{object.id}</span><small>{object.type}</small></button></li>)}</ul>
    <p className="re-caption re-object-note">Select an ID to locate its source declaration.</p>
  </section>;
}

export function CameraPanel({controller, onError}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  const set = (field: keyof MeshCamera, value: number, axis?: number) => {
    const camera = structuredClone(snapshot.draftCamera);
    if (axis === undefined) (camera as unknown as Record<string, number>)[field] = value;
    else (camera[field] as [number, number, number])[axis] = value;
    controller.session.setDraftCamera(camera);
  };
  return <section className="re-camera re-panel" aria-label="Camera settings">
    <div className="re-panel-heading"><h2>Camera</h2><span>{snapshot.cameraDirty ? 'Draft' : 'Accepted'}</span></div>
    {(['eye', 'target', 'up'] as const).map(field => <fieldset key={field}><legend>{field === 'eye' ? 'Eye' : field === 'target' ? 'Target' : 'Up'}</legend><div className="re-vector">{snapshot.draftCamera[field].map((value, axis) => <label key={axis}><span>{['X', 'Y', 'Z'][axis]}</span><input type="number" step="0.1" aria-label={`${field} ${['X', 'Y', 'Z'][axis]}`} value={Number.isFinite(value) ? value : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value), axis)} /></label>)}</div></fieldset>)}
    {(['fovYDegrees', 'near', 'far'] as const).map(field => <label className="re-scalar" key={field}><span>{field === 'fovYDegrees' ? 'Field of view (°)' : field === 'near' ? 'Near clip' : 'Far clip'}</span><input type="number" step={field === 'fovYDegrees' ? 1 : 0.01} aria-label={field} value={Number.isFinite(snapshot.draftCamera[field]) ? snapshot.draftCamera[field] : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value))} /></label>)}
    <button type="button" className="re-primary" disabled={!snapshot.cameraDirty} onClick={() => action(controller.apply('camera'), onError)}>Apply camera</button>
  </section>;
}

export function DiagnosticsPanel({controller}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <section className="re-diagnostics re-panel" aria-label="Diagnostics"><div className="re-panel-heading"><h2>Diagnostics</h2><span>{snapshot.diagnostics.length}</span></div>
    <div role="status">{snapshot.diagnostics.length === 0 && !presentation.presentationError ? <p className="re-caption">{snapshot.sourceDirty ? 'Draft compiles. Apply to update the scene.' : 'Accepted source compiles.'}</p> : <ul>{snapshot.diagnostics.map((diagnostic, index) => <li key={index}><strong>{diagnostic.code}</strong> {diagnostic.range ? `${diagnostic.range.line}:${diagnostic.range.column} ` : ''}{diagnostic.message}</li>)}{presentation.presentationError && <li>{presentation.presentationError.message}</li>}</ul>}</div>
  </section>;
}

/** Reusable workbench. The application supplies file actions, routes and menus. */
export function RenderEditor({controller, header, toolbar, onError, onAction}: RenderEditorProps) {
  return <div className="re-editor">{header}<div className="re-editor-toolbar">{toolbar ?? (onAction ? <>{(['new', 'open', 'save'] as const).map(action => <button type="button" key={action} onClick={() => onAction(action)}>{action[0].toUpperCase() + action.slice(1)}</button>)}</> : null)}</div><div className="re-editor-workspace"><aside className="re-left"><ObjectPanel controller={controller} /></aside><div className="re-center"><SceneViewport controller={controller} onError={onError} /><SourcePanel controller={controller} onError={onError} /></div><aside className="re-right"><CameraPanel controller={controller} onError={onError} /><DiagnosticsPanel controller={controller} /></aside></div></div>;
}
