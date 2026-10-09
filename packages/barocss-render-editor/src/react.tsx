import {useEffect, useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderEditorController, RenderEditorActionResult} from './controller.js';
import type {RenderEditorError} from './errors.js';
import {normalizeRenderEditorError} from './errors.js';
import {createSceneViewportPresenter} from './scene-viewport.js';
export {createSceneViewportPresenter} from './scene-viewport.js';
export * from './mixed-react.js';

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
    <div className="re-viewport-label">Scene<span>Perspective</span></div>
    {presentation.presentedRevision === null && <div className="re-viewport-fault" role="status"><p>{presentation.disposed ? 'Preview closed.' : presentation.presentationError ? 'Preview unavailable. Your applied scene is kept.' : 'Opening scene…'}</p>{presentation.presentationError && !presentation.disposed && <button type="button" onClick={() => action(controller.recover(), onError)}>Restore preview</button>}</div>}
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
    <div className="re-panel-heading"><h2>Source</h2><span>{snapshot.sourceDirty ? 'Draft' : 'Applied'}</span><button type="button" aria-label="Apply source" disabled={!snapshot.sourceDirty || snapshot.disposed} onClick={() => action(controller.apply('source'), onError)}>Apply</button></div>
    <textarea ref={source} aria-label="Scene source" data-testid="scene-source" disabled={snapshot.disposed} spellCheck={false} value={snapshot.draftSource} onChange={event => { try { controller.session.setDraftSource(event.target.value); } catch (error) { onError?.(normalizeRenderEditorError(error)); } }} />
  </section>;
}

export function ObjectPanel({controller}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  return <section className="re-objects re-panel" aria-label="Scene objects">
    <div className="re-panel-heading"><h2>Objects</h2><span>{snapshot.metadata.objects.length}</span></div>
    <p className="re-caption">{snapshot.metadata.name}</p>
    <ul>{snapshot.metadata.objects.map(object => <li key={object.id}><button type="button" disabled={snapshot.disposed} aria-pressed={snapshot.activeObjectId === object.id} onClick={() => controller.session.setActiveObject(object.id)}><span className="re-object-symbol">◇</span><span>{object.id}</span><small>{object.type}</small></button></li>)}</ul>
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
  const vector = (field: 'eye' | 'target' | 'up') => <fieldset key={field}><legend>{field === 'eye' ? 'Position · scene units' : field === 'target' ? 'Target · scene units' : 'Up direction'}</legend><div className="re-vector">{snapshot.draftCamera[field].map((value, axis) => <label key={axis}><span>{['X', 'Y', 'Z'][axis]}</span><input type="number" disabled={snapshot.disposed} step="0.1" aria-label={`${field} ${['X', 'Y', 'Z'][axis]}`} value={Number.isFinite(value) ? value : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value), axis)} /></label>)}</div></fieldset>;
  const scalar = (field: 'fovYDegrees' | 'near' | 'far') => <label className="re-scalar" key={field}><span>{field === 'fovYDegrees' ? 'Field of view (°)' : field === 'near' ? 'Near clip · scene units' : 'Far clip · scene units'}</span><input type="number" disabled={snapshot.disposed} step={field === 'fovYDegrees' ? 1 : 0.01} aria-label={field} value={Number.isFinite(snapshot.draftCamera[field]) ? snapshot.draftCamera[field] : ''} onChange={event => set(field, event.target.value === '' ? NaN : Number(event.target.value))} /></label>;
  return <section className="re-camera re-panel" aria-label="Camera settings">
    <div className="re-panel-heading"><h2>Camera</h2><span>{snapshot.cameraDirty ? 'Draft' : 'Applied'}</span></div>
    {vector('eye')}{vector('target')}{scalar('fovYDegrees')}
    <details className="re-camera-advanced"><summary>Advanced camera</summary>{vector('up')}{scalar('near')}{scalar('far')}</details>
    <button type="button" className="re-primary" aria-label="Apply camera" disabled={!snapshot.cameraDirty || snapshot.disposed} onClick={() => action(controller.apply('camera'), onError)}>Apply</button>
  </section>;
}

export function DiagnosticsPanel({controller, onError}: RenderEditorPanelProps) {
  const snapshot = useSession(controller);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [acknowledged, setAcknowledged] = useState<RenderEditorError | null>(null);
  const error = presentation.presentationError;
  const unavailable = presentation.presentedRevision === null;
  const showNotice = error !== null && !presentation.disposed && (unavailable || acknowledged !== error);
  const dirty = snapshot.sourceDirty || snapshot.cameraDirty;
  const retry = () => action(controller.apply(snapshot.sourceDirty && !snapshot.cameraDirty ? 'source' : snapshot.cameraDirty && !snapshot.sourceDirty ? 'camera' : 'both'), onError);
  return <section className="re-diagnostics re-panel" aria-label="Diagnostics"><div className="re-panel-heading"><h2>Source errors</h2><span data-testid="source-error-count">{snapshot.diagnostics.length}</span></div>
    <div role="status">{snapshot.diagnostics.length === 0 ? <p className="re-caption">{snapshot.sourceDirty ? 'Ready to apply.' : 'No source errors.'}</p> : <ul>{snapshot.diagnostics.map((diagnostic, index) => <li key={index}>{diagnostic.range ? `Line ${diagnostic.range.line}, column ${diagnostic.range.column}: ` : ''}{diagnostic.message}</li>)}</ul>}</div>
    {showNotice && <section className="re-preview-notice" data-testid="preview-notice" aria-label="Preview status"><div role="status"><h3>{unavailable ? 'Preview unavailable' : 'Update failed'}</h3><p>{unavailable ? 'Your applied scene is kept. Restore the preview to continue.' : 'The previous scene is still shown.'}</p>{!unavailable && <p>{dirty ? 'Check the draft, then try Apply again.' : 'There are no pending edits.'}</p>}</div>
      {!unavailable && <div className="re-preview-actions">{dirty && <button type="button" onClick={retry}>Retry update</button>}<button type="button" onClick={() => setAcknowledged(error)}>Dismiss preview notice</button></div>}
      <details><summary>Details</summary><pre data-testid="preview-error-details">{error.code}: {error.message}</pre></details>
    </section>}
  </section>;
}

/** Reusable workbench. The application supplies file actions, routes and menus. */
export function RenderEditor({controller, header, toolbar, onError, onAction}: RenderEditorProps) {
  return <div className="re-editor">{header}<div className="re-editor-toolbar">{toolbar ?? (onAction ? <>{(['new', 'open', 'save'] as const).map(action => <button type="button" key={action} onClick={() => onAction(action)}>{action[0].toUpperCase() + action.slice(1)}</button>)}</> : null)}</div><div className="re-editor-workspace"><aside className="re-left"><ObjectPanel controller={controller} /></aside><div className="re-center"><SceneViewport controller={controller} onError={onError} /><SourcePanel controller={controller} onError={onError} /></div><aside className="re-right"><CameraPanel controller={controller} onError={onError} /><DiagnosticsPanel controller={controller} onError={onError} /></aside></div></div>;
}
