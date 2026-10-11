import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createViewer} from '@barocss/viewer';
import type {Viewer, ViewerState, ViewerRef, ViewerGeometryPoint, ViewerGeometryPick} from '@barocss/viewer';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import type {MeshCamera} from '@barocss/gpu';
import {prepareNativeViewportAppearance} from './native-viewport-presentation';
import {compileMeshMaterial} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderMaterialController, RenderMaterialPreparation, RenderNativeSceneAppearancePreparation} from '@barocss/render-editor';
import {assertNativeScenePreviewContext} from './native-scene-host';
import type {NativeSceneHost} from './native-scene-host';
import {NativeSceneGizmo} from './native-scene-gizmo';
import {createNativeSceneSelectionInput} from './native-scene-selection';

export interface MaterialPreviewBridge {
  readonly source: string;
  readonly context: {mmToSceneUnit: number; background: readonly [number, number, number]};
  getState(): ViewerState;
  getEpoch(): number;
  getAppearanceToken(): object;
  pickNativeSurface(point: ViewerGeometryPoint): ViewerGeometryPick | null;
  present(prepared: RenderNativeSceneAppearancePreparation, cameraOverride?: MeshCamera): void;
  beginTransition(): void;
  endTransition(): void;
  retireLegacy(): void;
}
type PreviewHandle = {viewer: Viewer; ref: ViewerRef; refresh(): void; syncControls(): void; present(material: RenderMaterialPreparation): void; bridge: MaterialPreviewBridge};
interface Props {controller: RenderMaterialController; nativeHost?: NativeSceneHost | null; disabled: boolean; onError(error: unknown): void; onBridgeChange?(bridge: MaterialPreviewBridge | null): void; onTarget?(bodyId: string): void}
const context = {mmToSceneUnit: .001, background: [.025, .04, .06] as const};

/** The Viewer belongs to this mounted Canvas, independently of its document session. */
export function MaterialPreview({controller, nativeHost = null, disabled, onError, onBridgeChange, onTarget}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), handle = useRef<PreviewHandle | null>(null);
  const mountId = useRef(crypto.randomUUID());
  const current = useRef({controller, nativeHost, disabled, onError, onBridgeChange, onTarget});
  current.current = {controller, nativeHost, disabled, onError, onBridgeChange, onTarget};
  const [state, setState] = useState<ViewerState | null>(null), [message, setMessage] = useState('Loading reference Surface…');
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<{document: ReturnType<NativeSceneHost['getSnapshot']>['accepted']; bodyId: string; text: string} | null>(null);
  const presentation = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    setCanvasElement(element);
    let live = true, viewer: Viewer | null = null, controls: {dispose(): void} | null = null;
    let epoch = 0, transitions = 0, legacy = true, appearanceToken: object = Object.freeze({});
    const abort = new AbortController();
    const refresh = () => {if (live && viewer) setState(viewer.getState());};
    const stopControls = () => {controls?.dispose(); controls = null;};
    const observe = () => queueMicrotask(() => {
      if (!live || !viewer) return;
      refresh();
      const host = current.current.nativeHost;
      if (host && !host.getSnapshot().disposed && !host.getSnapshot().poseGestureActive && !host.getSnapshot().posePreview) {
        try {host.observeView(viewer.getState().camera);} catch (cause) {current.current.onError(cause);}
      }
    });
    const failure = (cause: unknown) => {
      if (!live) return;
      refresh(); setMessage(cause instanceof Error ? cause.message : 'Preview failed.'); current.current.onError(cause);
      if (viewer && ['unavailable', 'context-lost', 'disposed'].includes(viewer.getState().status)) {
        stopControls();
        queueMicrotask(() => {
          if (!live) return;
          const active = current.current;
          if (!active.controller.getSnapshot().disposed) active.controller.setPresenter(null);
          if (active.nativeHost && !active.nativeHost.getSnapshot().disposed) active.nativeHost.setAvailable(false);
        });
      }
    };
    const syncControls = () => {
      const host = current.current.nativeHost;
      const draft = host?.getSnapshot();
      if (!live || !viewer || transitions || current.current.disabled || viewer.getState().status !== 'ready' || draft && (!draft.available || draft.disposed || draft.poseGestureActive || draft.posePreview)) {stopControls(); return;}
      if (!controls) controls = viewer.attachPointerControls({onError: failure});
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
    const lost = () => {
      stopControls(); epoch++; appearanceToken = Object.freeze({});
      // Viewer installs its own context-loss handler first. Defer session changes past any commit lock.
      queueMicrotask(() => {if (live) failure(new RenderEditorError('PRESENTATION_REFUSED', 'Graphics context lost. Reload the preview to recover.'));});
    };
    element.addEventListener('pointermove', observe);
    element.addEventListener('pointerup', observe);
    element.addEventListener('wheel', observe, {passive: true});
    void (async () => {
      try {
        const native = await loadBaroCadModelSet({format: 'barocad-model-set', version: 0, entries: [{aliasId: 'cloth_reference', url: './reference-panel.barocad', options: {sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1}}]}, {baseURL: location.href, signal: abort.signal});
        if (!live) return;
        viewer = createViewer(element, {mmToSceneUnit: context.mmToSceneUnit, background: [...context.background], lighting: {ambientStrength: .4, directionalStrength: .6, direction: [.3, 1, .4]}});
        element.addEventListener('webglcontextlost', lost);
        resize(); viewer.loadModelSet(native); viewer.fit();
        const ref = viewer.getState().surfaces[0];
        if (!ref || ref.modelId !== 'cloth_reference' || ref.surfaceId !== 'reference_panel' || native.entries.length !== 1 || native.entries[0].result.model.name !== 'cloth_reference_981' || native.entries[0].result.model.lengthUnit !== 'mm') throw new Error('Reference Surface identity does not match this preview.');
        const source = native.entries[0].result.source;
        const requireViewer = () => {
          if (!live || !viewer || handle.current?.viewer !== viewer) throw new RenderEditorError('PRESENTATION_REFUSED', 'The preview was replaced.');
          return viewer;
        };
        const present = (material: RenderMaterialPreparation) => {
          const active = requireViewer(), before = active.getState();
          if (!legacy || before.status !== 'ready' || before.modelSet?.entries[0]?.result.source !== source) throw new RenderEditorError('PRESENTATION_REFUSED', 'The reference Surface is unavailable.');
          try {
            const compiled = compileMeshMaterial(material.document.shaderSource);
            if (!compiled.ok) throw new RenderEditorError('SOURCE_REFUSED', 'The material shader could not compile.');
            active.setSurfaceMaterial(ref, {material: compiled.material, uniforms: {...material.document.uniforms}});
            refresh(); setMessage('Rendered Surface');
          } catch (cause) {
            failure(cause); const error = normalizeRenderEditorError(cause, 'PRESENTATION_REFUSED');
            Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;
          }
        };
        const bridge: MaterialPreviewBridge = {
          source, context,
          getState: () => requireViewer().getState(), getEpoch: () => epoch,
          getAppearanceToken: () => {requireViewer(); return appearanceToken;},
          pickNativeSurface: point => {
            const active = requireViewer(), token = appearanceToken, mount = epoch;
            if (active.getState().status !== 'ready') throw new RenderEditorError('PRESENTATION_REFUSED', 'Body selection is unavailable.');
            const hit = active.pickGeometry(point, {kinds: ['surface']});
            if (token !== appearanceToken || mount !== epoch || active !== requireViewer()) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed during body selection.');
            return hit;
          },
          beginTransition: () => {requireViewer(); transitions++; stopControls();},
          endTransition: () => {if (transitions > 0) transitions--; syncControls();},
          retireLegacy: () => {
            legacy = false;
            const old = current.current.controller;
            if (!old.getSnapshot().disposed) old.setPresenter(null);
          },
          present: (prepared, cameraOverride) => {
            const active = requireViewer(), token = epoch;
            stopControls();
            try {
              assertNativeScenePreviewContext(prepared.context, active.getState().mmToSceneUnit, context.background);
              if (token !== epoch || !live || handle.current?.viewer !== active) throw new RenderEditorError('PRESENTATION_REFUSED', 'The preview changed during preparation.');
              const request = prepareNativeViewportAppearance(prepared, cameraOverride);
              if (token !== epoch || !live || handle.current?.viewer !== active) throw new RenderEditorError('PRESENTATION_REFUSED', 'The preview changed during preparation.');
              active.replaceNativeSceneAppearance(request);
              appearanceToken = Object.freeze({});
              refresh(); setMessage('Rendered scene');
            } catch (cause) {failure(cause); throw cause;}
            finally {queueMicrotask(() => {if (live) syncControls();});}
          },
        };
        handle.current = {viewer, ref, present, refresh, syncControls, bridge};
        current.current.controller.setPresenter(present);
        current.current.onBridgeChange?.(bridge);
        syncControls(); refresh();
      } catch (cause) {if (live && !abort.signal.aborted) failure(cause);}
    })();
    return () => {
      live = false; epoch++; appearanceToken = Object.freeze({}); abort.abort(); observer.disconnect(); stopControls();
      element.removeEventListener('webglcontextlost', lost); element.removeEventListener('pointermove', observe); element.removeEventListener('pointerup', observe); element.removeEventListener('wheel', observe);
      handle.current = null; current.current.onBridgeChange?.(null);
      if (!current.current.controller.getSnapshot().disposed) current.current.controller.setPresenter(null);
      viewer?.dispose();
    };
  }, []);
  useEffect(() => {
    const active = handle.current;
    if (active && !nativeHost && !controller.getSnapshot().disposed) controller.setPresenter(active.present);
    active?.syncControls();
  }, [controller, nativeHost]);
  useEffect(() => {handle.current?.syncControls();}, [disabled, presentation]);
  useEffect(() => nativeHost?.subscribe(() => handle.current?.syncControls()), [nativeHost]);
  useEffect(() => {
    const active = handle.current, element = canvas.current;
    if (!nativeHost || !active || !element || state?.status !== 'ready') return;
    const input = createNativeSceneSelectionInput(element, nativeHost, active.bridge, {
      canSelect: () => !current.current.disabled && current.current.nativeHost === nativeHost,
      onTarget: bodyId => current.current.onTarget?.(bodyId),
      onStatus: text => {const snapshot = nativeHost.getSnapshot(); setSelectionMessage({document: snapshot.accepted, bodyId: snapshot.selectedBodyId, text});},
      onError: cause => current.current.onError(cause),
    });
    return () => input.dispose();
  }, [nativeHost, state?.status]);
  const visible = state?.visibleGeometry.some(ref => ref.kind === 'surface') ?? false, ready = state?.status === 'ready';
  const visibility = () => {
    const active = handle.current; if (!active || disabled || nativeHost) return;
    try {
      if (visible) {active.viewer.setSurfaceMaterial(active.ref, null); controller.setPresenter(null); active.viewer.setVisibleGeometry([]); setMessage('Surface hidden.');}
      else {active.viewer.setVisibleGeometry([{kind: 'surface', ...active.ref}]); controller.setPresenter(active.present); setMessage('Rendered Surface');}
      active.refresh(); active.syncControls();
    } catch (cause) {active.refresh(); current.current.onError(cause);}
  };
  const fit = () => {
    const active = handle.current, draft = nativeHost?.getSnapshot(); if (!active || disabled || draft && (!draft.available || draft.disposed || draft.poseGestureActive || draft.posePreview)) return;
    try {active.viewer.fit(); active.refresh(); if (nativeHost) nativeHost.observeView(active.viewer.getState().camera);} catch (cause) {current.current.onError(cause);}
  };
  const bindings = state?.surfaceMaterials ?? [], original = state?.modelSet?.entries[0]?.result;
  const inspection = state && {status: state.status, sourceUnit: state.sourceUnit, mmToSceneUnit: state.mmToSceneUnit,
    nativeSource: original?.source, document: state.document, documentBodies: state.documentBodies,
    surfaces: state.surfaces, visibleGeometry: state.visibleGeometry, selected: state.selected,
    materials: bindings.map(binding => ({ref: binding.ref, source: binding.binding.material.source, shaderId: binding.binding.material.shaderId, uniforms: binding.binding.uniforms})),
    geometryMotion: state.geometryMotion, lighting: state.lighting, camera: state.camera, displayedRevision: nativeHost?.getSnapshot().accepted.revision ?? presentation.displayed?.revision ?? null,
    nativeScene: nativeHost && {accepted: nativeHost.getSnapshot().accepted, draftDocument: nativeHost.getSnapshot().draftDocument, nativeDirty: nativeHost.getSnapshot().nativeDirty, materialDirty: nativeHost.getSnapshot().materialDirty, invalidLighting: nativeHost.getSnapshot().invalidLighting, invalidBodyPose: nativeHost.getSnapshot().invalidBodyPose, invalidBodyPoseBodyId: nativeHost.getSnapshot().invalidBodyPoseBodyId, bodyPoseInputResetEpoch: nativeHost.getSnapshot().bodyPoseInputResetEpoch, selectedBodyId: nativeHost.getSnapshot().selectedBodyId, dirty: nativeHost.getSnapshot().dirty, viewDirty: nativeHost.getSnapshot().viewDirty, poseGestureActive: nativeHost.getSnapshot().poseGestureActive, posePreview: nativeHost.getSnapshot().posePreview, available: nativeHost.getSnapshot().available, canUndo: nativeHost.getSnapshot().canUndo, canRedo: nativeHost.getSnapshot().canRedo, savedRevision: nativeHost.getSnapshot().savedRevision}};
  return <div className="material-native-preview">
    <div className="re-material-heading"><h2 data-testid="native-canvas-body-title">{nativeHost ? nativeHost.getSnapshot().targets.find(target => target.bodyId === nativeHost.getSnapshot().selectedBodyId)?.title ?? 'Scene' : 'Surface preview'}</h2><span data-testid="material-preview-status">{state?.status ?? 'loading'}</span>
      {!nativeHost && <button type="button" data-testid="material-preview-visible" disabled={disabled || !ready} onClick={visibility}>{visible ? 'Hide' : 'Show'}</button>}
      <div className="native-camera-toolbar">
        {nativeHost && <><span className="native-camera-badge" data-testid="native-camera-view-state">{nativeHost.getSnapshot().viewDirty ? 'User view' : 'Scene view'}</span>
          <button type="button" data-testid="native-scene-camera" disabled={disabled || !ready || !nativeHost.getSnapshot().available} onClick={() => {try {nativeHost.resetViewportCamera();} catch (cause) {onError(cause);}}}>Scene camera</button>
          <button type="button" data-testid="native-set-scene-camera" disabled={disabled || !ready || !nativeHost.getSnapshot().available || nativeHost.getSnapshot().dirty || !nativeHost.getSnapshot().viewDirty} onClick={() => {try {nativeHost.applyCamera();} catch (cause) {onError(cause);}}}>Set scene camera</button></>}
        <button type="button" data-testid="native-frame" aria-keyshortcuts={nativeHost ? 'F' : undefined} disabled={disabled || !ready || !visible || !!nativeHost && !nativeHost.getSnapshot().available} onClick={fit}>Frame</button>
      </div>
    </div>
    <div className="material-native-canvas re-editor--workbench">
      <canvas ref={canvas} data-testid="material-preview-canvas" data-mount-id={mountId.current} aria-label="Rendered native Surface" tabIndex={nativeHost ? 0 : undefined} onPointerDown={nativeHost ? event => {if (!disabled && event.target === event.currentTarget) event.currentTarget.focus({preventScroll: true});} : undefined}/>
      {nativeHost && <NativeSceneGizmo host={nativeHost} canvas={canvasElement} disabled={disabled || !ready || !visible} onError={onError} onFrame={fit}/>}
      {nativeHost && selectionMessage && selectionMessage.document === nativeHost.getSnapshot().accepted && selectionMessage.bodyId === nativeHost.getSnapshot().selectedBodyId && <p className="native-selection-status" role="status" data-testid="native-selection-status">{selectionMessage.text}</p>}
      {(disabled || !ready || !visible) && <div className="material-native-overlay">{disabled ? 'Finish the current dialog to use the preview.' : visible ? message : state ? 'Surface hidden · Show to resume' : message}</div>}
      <span className="material-native-navigation">Drag: orbit · Shift + drag: pan · Wheel: zoom</span>
    </div>
    <div className="re-material-heading"><span style={{marginLeft: 0}} data-testid="material-preview-binding">{bindings.length ? bindings.length + ' material ' + (bindings.length === 1 ? 'binding' : 'bindings') : 'No rendered material binding'}</span><span>{nativeHost ? 'Applied ' + nativeHost.getSnapshot().accepted.revision : presentation.displayed ? 'Applied ' + presentation.displayed.revision : 'Preview detached'}</span></div>
    <details className="material-native-inspection"><summary>Scene and view details</summary><pre data-testid="material-preview-state">{JSON.stringify(inspection, (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value, 2)}</pre></details>
  </div>;
}
