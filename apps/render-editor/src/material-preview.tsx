import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createViewer} from '@barocss/viewer';
import type {Viewer, ViewerState, ViewerRef} from '@barocss/viewer';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {compileMeshMaterial} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderMaterialController, RenderMaterialPreparation} from '@barocss/render-editor';

type PreviewHandle = {viewer: Viewer; ref: ViewerRef; present: (material: RenderMaterialPreparation) => void; refresh: () => void};
interface Props {controller: RenderMaterialController; disabled: boolean; onError: (error: unknown) => void}

/** This fixed native preview is not part of the material file. */
export function MaterialPreview({controller, disabled, onError}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), handle = useRef<PreviewHandle | null>(null), report = useRef(onError);
  report.current = onError;
  const [state, setState] = useState<ViewerState | null>(null), [message, setMessage] = useState('Loading reference Surface…');
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    let live = true, viewer: Viewer | null = null, controls: {dispose(): void} | null = null;
    const abort = new AbortController();
    const refresh = () => {if (live && viewer) setState(viewer.getState());};
    const failure = (cause: unknown) => {
      if (!live) return;
      refresh(); setMessage(cause instanceof Error ? cause.message : 'Preview failed.'); report.current(cause);
      if (viewer && ['unavailable', 'context-lost', 'disposed'].includes(viewer.getState().status)) {
        controls?.dispose(); controls = null;
        // A presenter may report this while the controller is still in its synchronous commit.
        queueMicrotask(() => {if (live && !controller.getSnapshot().disposed) controller.setPresenter(null);});
      }
    };
    const resize = () => {
      if (!live || !viewer) return;
      try {
        const bounds = element.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(bounds.width * ratio)), height = Math.max(1, Math.round(bounds.height * ratio));
        if (element.width !== width || element.height !== height) viewer.resize(width, height);
        refresh();
      } catch (cause) {failure(cause);}
    };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const lost = () => {if (live) {controls?.dispose(); controls = null; controller.setPresenter(null); refresh(); setMessage('Graphics context lost. Reload this preview to recover.');}};
    const inspectCamera = () => queueMicrotask(refresh);
    element.addEventListener('webglcontextlost', lost);
    element.addEventListener('pointerup', inspectCamera);
    element.addEventListener('wheel', inspectCamera, {passive: true});
    void (async () => {
      try {
        const native = await loadBaroCadModelSet({format: 'barocad-model-set', version: 0, entries: [{aliasId: 'cloth_reference', url: './reference-panel.barocad', options: {sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1}}]}, {baseURL: location.href, signal: abort.signal});
        if (!live) return;
        viewer = createViewer(element, {mmToSceneUnit: .001, background: [.025, .04, .06], lighting: {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4]}});
        resize(); viewer.loadModelSet(native); viewer.fit();
        const ref = viewer.getState().surfaces[0];
        if (!ref || ref.modelId !== 'cloth_reference' || ref.surfaceId !== 'reference_panel' || native.entries.length !== 1 || native.entries[0].result.model.name !== 'cloth_reference_981' || native.entries[0].result.model.lengthUnit !== 'mm') throw new Error('Reference Surface identity does not match this preview.');
        const originalSource = native.entries[0].result.source;
        const present = (material: RenderMaterialPreparation) => {
          if (!live || !viewer || handle.current?.viewer !== viewer) throw new RenderEditorError('PRESENTATION_REFUSED', 'The preview was replaced.');
          const before = viewer.getState();
          if (before.status !== 'ready' || before.modelSet?.entries[0]?.result.source !== originalSource) throw new RenderEditorError('PRESENTATION_REFUSED', 'The reference Surface is unavailable.');
          try {
            const compiled = compileMeshMaterial(material.document.shaderSource);
            if (!compiled.ok) throw new RenderEditorError('SOURCE_REFUSED', 'The applied material shader could not compile for the Viewer.');
            viewer.setSurfaceMaterial(ref, {material: compiled.material, uniforms: {...material.document.uniforms}});
            refresh(); setMessage('Rendered Surface · lighting and gamma applied');
          } catch (cause) {
            failure(cause);
            const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
            Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;
          }
        };
        handle.current = {viewer, ref, present, refresh};
        controller.setPresenter(present);
        controls = viewer.attachPointerControls({onError: failure}); refresh();
      } catch (cause) {if (live && !abort.signal.aborted) failure(cause);}
    })();
    return () => {
      live = false; abort.abort(); observer.disconnect(); controls?.dispose();
      element.removeEventListener('webglcontextlost', lost); element.removeEventListener('pointerup', inspectCamera); element.removeEventListener('wheel', inspectCamera);
      handle.current = null;
      if (!controller.getSnapshot().disposed) controller.setPresenter(null);
      viewer?.dispose();
    };
  }, [controller]);
  const visible = state?.visibleGeometry.some(ref => ref.kind === 'surface') ?? false;
  const ready = state?.status === 'ready';
  const visibility = () => {
    const current = handle.current; if (!current || disabled) return;
    try {
      if (visible) {
        current.viewer.setSurfaceMaterial(current.ref, null);
        controller.setPresenter(null);
        current.viewer.setVisibleGeometry([]); setMessage('Surface hidden. Show it before Apply.');
      } else {
        current.viewer.setVisibleGeometry([{kind: 'surface', ...current.ref}]);
        controller.setPresenter(current.present); setMessage('Rendered Surface · lighting and gamma applied');
      }
      current.refresh();
    } catch (cause) {current.refresh(); report.current(cause);}
  };
  const fit = () => {const current = handle.current; if (!current || disabled) return; try {current.viewer.fit(); current.refresh();} catch (cause) {report.current(cause);}};
  const binding = state?.surfaceMaterial;
  const original = state?.modelSet?.entries[0]?.result;
  const inspection = state && {status: state.status, sourceUnit: state.sourceUnit, mmToSceneUnit: state.mmToSceneUnit,
    nativeSource: original?.source, displayRef: state.surfaces[0], visibleGeometry: state.visibleGeometry, selected: state.selected,
    material: binding && {ref: binding.ref, source: binding.binding.material.source, shaderId: binding.binding.material.shaderId, uniforms: binding.binding.uniforms},
    lighting: state.lighting, camera: state.camera, displayedRevision: presentation.displayed?.revision ?? null};
  return <div className="material-native-preview" style={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0}}>
    <div className="re-material-heading"><h2>Surface preview</h2><span data-testid="material-preview-status">{state?.status ?? 'loading'}</span><button type="button" data-testid="material-preview-visible" disabled={disabled || !ready} onClick={visibility}>{visible ? 'Hide' : 'Show'}</button><button type="button" disabled={disabled || !ready || !visible} onClick={fit}>Frame</button></div>
    <div style={{position: 'relative', flex: 1, minHeight: 0}}>
      <canvas ref={canvas} data-testid="material-preview-canvas" aria-label="Rendered native Surface" style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}}/>
      {(disabled || !ready || !visible) && <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(24,27,32,.72)', color: '#adb7c5', padding: 12}}>{disabled ? 'Finish the current dialog to use the preview.' : visible ? message : state ? 'Surface hidden · Show to resume' : message}</div>}
      <span style={{position: 'absolute', left: 8, bottom: 6, color: '#a7b4c7', pointerEvents: 'none', fontSize: 10}}>Drag: orbit · Shift + drag: pan · Wheel: zoom</span>
    </div>
    <div className="re-material-heading"><span style={{marginLeft: 0}} data-testid="material-preview-binding">{binding ? '#' + binding.binding.material.shaderId + ' → reference_panel' : 'No rendered material binding'}</span><span>{presentation.displayed ? 'Applied ' + presentation.displayed.revision : 'Preview detached'}</span></div>
    <details style={{padding: '3px 6px', fontSize: 10, borderTop: '1px solid #40444a'}}><summary>Reference asset and view</summary><p className="re-material-caption">Original Model: cloth_reference_981 · Surface: reference_panel · mm. Display alias: cloth_reference. Fixed lighting. Material files contain the shader and uniforms; this host supplies the reference asset and view.</p><pre data-testid="material-preview-state" style={{maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{JSON.stringify(inspection, null, 2)}</pre></details>
  </div>;
}
