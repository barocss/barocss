import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {prepareRenderNativeSceneGizmo, deriveRenderNativeSceneGizmoPose, hitTestRenderSceneGizmo, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeScenePose, RenderSceneGizmoKey, RenderSceneGizmoMode, RenderSceneGizmoViewport} from '@barocss/render-editor';
import {GizmoSurface} from '@barocss/render-editor/react';
import type {GizmoSurfaceActionResult, GizmoSurfaceAdapter} from '@barocss/render-editor/react';
import type {NativeSceneHost} from './native-scene-host';

type Point = readonly [number, number];
type Capture = {token: object; document: RenderNativeSceneDocument; bodyId: string; viewport: RenderSceneGizmoViewport; from: Point; mode: RenderSceneGizmoMode; space: 'world' | 'local'; key: RenderSceneGizmoKey};
interface Props {host: NativeSceneHost; canvas: HTMLCanvasElement | null; disabled: boolean; onError(cause: unknown): void}

/** A genuine Native pose adapter over the shared Source gizmo surface. */
export function NativeSceneGizmo({host, canvas, disabled, onError}: Props) {
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [mode, setMode] = useState<RenderSceneGizmoMode>('translate');
  const captured = useRef<Capture | null>(null);
  useEffect(() => {if (!state.poseGestureActive && !state.posePreview) captured.current = null;}, [state.poseGestureActive, state.posePreview, state.accepted]);
  const adapter = useMemo<GizmoSurfaceAdapter<Capture>>(() => {
    const result = (action: () => void): GizmoSurfaceActionResult => {
      try {action(); return {ok: true};} catch (cause) {return {ok: false, error: normalizeRenderEditorError(cause)};}
    };
    return {
      subscribe: host.subscribe,
      hitTest: hitTestRenderSceneGizmo,
      prepare(viewport) {
        const value = host.getSnapshot();
        if (!value.available || value.disposed || value.viewDirty || value.nativeDirty || value.materialDirty || value.invalidLighting || value.invalidBodyPose) return {pivot: [0, 0], handles: [], unavailable: 'Correct or Discard drafts and restore the view to use handles.'};
        const original = captured.current;
        const document = original?.document ?? value.accepted;
        const pose = value.posePreview?.pose;
        const poses = document.display.poses.length ? document.display.poses : value.preparation.entries.map(entry => ({bodyId: entry.binding.bodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]} as RenderNativeScenePose));
        const shown = pose ? {...document, display: {...document.display, poses: poses.map(item => item.bodyId === pose.bodyId ? pose : item)}} : document;
        return prepareRenderNativeSceneGizmo(shown, original?.bodyId ?? value.selectedBodyId,
          document.display.camera, viewport, original?.mode ?? mode, mode === 'translate' ? 'world' : 'local');
      },
      capture(key: RenderSceneGizmoKey, from, viewport) {
        const value = host.getSnapshot();
        if (value.poseGestureActive || value.posePreview || !value.available || value.dirty) return null;
        const token = host.beginBodyPosePreview(value.selectedBodyId);
        const capture: Capture = {token, document: value.accepted, bodyId: value.selectedBodyId, viewport, from, mode, space: mode === 'translate' ? 'world' : 'local', key};
        captured.current = capture; return capture;
      },
      isCurrent(capture) {
        const value = host.getSnapshot();
        return captured.current === capture && value.poseGestureActive && value.accepted === capture.document
          && value.selectedBodyId === capture.bodyId && value.available && !value.disposed;
      },
      preview(capture, to) {
        return result(() => host.previewBodyPose(capture.token, deriveRenderNativeSceneGizmoPose(capture.document, capture.bodyId,
          capture.document.display.camera, capture.viewport, capture.mode, capture.space,
          capture.key, capture.from, to)));
      },
      finish(capture) {return result(() => {host.applyBodyPosePreview(capture.token); captured.current = null;});},
      cancel(capture) {return result(() => {host.cancelBodyPosePreview(capture.token); captured.current = null;});},
    };
  }, [host, mode]);
  const cancel = (): GizmoSurfaceActionResult => {
    const capture = captured.current; return capture ? adapter.cancel(capture) : {ok: true};
  };
  return <GizmoSurface canvas={canvas} adapter={adapter} mode={mode} onModeChange={setMode}
    disabled={disabled || !state.available || state.viewDirty} pending={state.poseGestureActive || !!state.posePreview}
    onCancelPending={cancel} onError={onError} scaleLabel="Scale"
    profileNotice="Native origin · Move world axes · Rotate and Scale local axes"
    helpText="Drag a Move arrow, Rotate arc, or Scale square. XYZ scale changes one local component. S scales all three. Move uses scene distance converted once to mm. Rotation uses the captured local quaternion axes. Release applies one change. Escape restores the applied body pose. Material target chooses the body to edit. The pivot is its original source origin."/>;
}
