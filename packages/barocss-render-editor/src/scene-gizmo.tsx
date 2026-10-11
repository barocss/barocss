import {useMemo, useRef, useState, useSyncExternalStore} from 'react';
import type {MeshCamera} from '@barocss/gpu';
import type {RenderEditorController} from './controller.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';
import {editRenderSceneObjectSource} from './scene-object-source.js';
import {prepareRenderSceneGizmo, deriveRenderSceneGizmoPatch, hitTestRenderSceneGizmo, type RenderSceneGizmoMode, type RenderSceneGizmoKey, type RenderSceneGizmoViewport} from './scene-gizmo-projection.js';
import {GizmoSurface, type GizmoSurfaceAdapter, type GizmoSurfaceActionResult} from './gizmo-surface.js';

interface Props {controller: RenderEditorController; canvas: HTMLCanvasElement | null; disabled?: boolean; onError?: (error: RenderEditorError) => void; onHelp?: () => void; onGestureChange?: (active: boolean) => void; mode?: RenderSceneGizmoMode; onModeChange?: (mode: RenderSceneGizmoMode) => void; showModeButtons?: boolean}
type Point = readonly [number, number];
interface Capture {snapshot: ReturnType<RenderEditorController['session']['getSnapshot']>; id: string; source: string; mode: RenderSceneGizmoMode; camera: MeshCamera; viewportCamera: MeshCamera | null; viewport: RenderSceneGizmoViewport; key: RenderSceneGizmoKey; from: Point; expected: ReturnType<RenderEditorController['getSnapshot']>['transformPreview']; used: boolean}
const success: GizmoSurfaceActionResult = {ok: true};
const failure = (cause: unknown): GizmoSurfaceActionResult => ({ok: false, error: normalizeRenderEditorError(cause)});

/** Source1 semantics adapt the shared handles without changing Euler or dimension policies. */
export function SceneGizmo({controller, canvas, disabled = false, onError, onHelp, onGestureChange, mode: controlledMode, onModeChange, showModeButtons = true}: Props) {
  const session = useSyncExternalStore(controller.session.subscribe, controller.session.getSnapshot, controller.session.getSnapshot), view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [localMode, setLocalMode] = useState<RenderSceneGizmoMode>('translate'), mode = controlledMode ?? localMode;
  const latest = useRef({mode, disabled}); latest.current = {mode, disabled};
  const adapter = useMemo<GizmoSurfaceAdapter<Capture>>(() => {
    const clean = () => {const state = controller.session.getSnapshot(); return !state.sourceDirty && !state.cameraDirty && !state.objectInputInvalid && !state.animationInputInvalid;};
    const current = (capture: Capture) => {const state = controller.session.getSnapshot(), view = controller.getSnapshot(); return !capture.used && !view.disposed && view.presentedRevision !== null && !view.cameraPreview && !view.animationPreview && state === capture.snapshot && state.activeObjectId === capture.id && view.transformPreview === capture.expected && view.viewportCamera === capture.viewportCamera;};
    return {
      hitTest: hitTestRenderSceneGizmo,
      prepare(viewport) {
        const state = controller.session.getSnapshot(), view = controller.getSnapshot();
        if (!state.activeObjectId || view.cameraPreview || view.animationPreview || view.disposed || view.presentedRevision === null || !clean() && !view.transformPreview) return {pivot: [0, 0], handles: [], unavailable: null};
        return prepareRenderSceneGizmo(view.transformPreview?.source ?? state.accepted.sceneSource, state.activeObjectId, view.viewportCamera ?? state.accepted.camera, viewport, latest.current.mode);
      },
      capture(key, from, viewport) {
        const state = controller.session.getSnapshot(), view = controller.getSnapshot();
        if (latest.current.disabled || !clean() || !state.activeObjectId || view.disposed || view.presentedRevision === null || view.cameraPreview || view.animationPreview || view.transformPreview) return null;
        return {snapshot: state, id: state.activeObjectId, source: state.accepted.sceneSource, mode: latest.current.mode, camera: view.viewportCamera ?? state.accepted.camera, viewportCamera: view.viewportCamera, viewport, key, from, expected: null, used: false};
      },
      isCurrent: current,
      preview(capture, to) {
        try {
          if (!current(capture)) throw new RenderEditorError('STALE_CANDIDATE', 'The Source transform changed.');
          const patch = deriveRenderSceneGizmoPatch(capture.source, capture.id, capture.camera, capture.viewport, capture.mode, capture.key, capture.from, to), source = editRenderSceneObjectSource(capture.source, capture.id, patch);
          const result = controller.previewObjectSource(capture.id, source); capture.expected = controller.getSnapshot().transformPreview; return result;
        } catch (cause) {return failure(cause);}
      },
      finish(capture) {
        if (!current(capture)) return failure(new RenderEditorError('STALE_CANDIDATE', 'The Source transform changed.'));
        const result = capture.expected === null ? success : controller.applyObjectPreview(); if (result.ok) capture.used = true; return result;
      },
      cancel(capture) {
        if (!current(capture)) return success;
        const result = capture.expected === null ? success : controller.cancelObjectPreview(); if (result.ok) capture.used = true; return result;
      },
      subscribe(listener) {const unview = controller.subscribe(listener), unsession = controller.session.subscribe(listener); return () => {unview(); unsession();};},
    };
  }, [controller]);
  const selectedType = session.metadata.objects.find(object => object.id === session.activeObjectId)?.type, sizeAxes = selectedType === 'box' || selectedType === 'rounded-box';
  const clean = !session.sourceDirty && !session.cameraDirty && !session.objectInputInvalid && !session.animationInputInvalid;
  const profileNotice = !clean ? 'Apply or Discard drafts to use handles.' : mode === 'scale' ? selectedType === 'rounded-box' ? 'Size XYZ · Radius unchanged · S uniform' : selectedType === 'box' ? 'Local size XYZ · S uniform' : selectedType ? 'Uniform scale only for this primitive.' : 'Select an applied object.' : '';
  return <GizmoSurface canvas={canvas} mode={mode} adapter={adapter} disabled={disabled || Boolean(view.cameraPreview || view.animationPreview) || view.disposed} pending={Boolean(view.transformPreview)} showModeButtons={showModeButtons} scaleLabel={sizeAxes ? selectedType === 'rounded-box' ? 'Size' : 'Scale' : 'Uniform scale'} profileNotice={profileNotice} onModeChange={value => {if (controlledMode === undefined) setLocalMode(value); onModeChange?.(value);}} onError={onError} onHelp={onHelp} onGestureChange={onGestureChange} onCancelPending={() => controller.getSnapshot().transformPreview ? controller.cancelObjectPreview() : success} helpText="Point to a Move arrow, Rotate arc, or Scale endpoint, then drag. The nearest projected handle is highlighted and selected; the captured axis stays fixed during the drag. Rotation uses thin front arcs and dim rear arcs. Box Scale XYZ changes independent local size dimensions. Rounded box Size XYZ keeps its radius unchanged. Other primitives offer only Uniform scale. S scales every supported primitive uniformly. Release applies once. Escape cancels. Handles use the source origin and scene units; local rotation is X, then Y, then Z. Focus a handle and use arrows for a small transform. Use the numeric object fields when a handle is unavailable."/>;
}
