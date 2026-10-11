import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {deriveRenderNativeSceneSurfacePoleAxisDrag,
  prepareRenderNativeSceneSurfacePoleControls, hitTestRenderSceneGizmo, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneDocument, RenderNativeSceneSurfacePolePatch, RenderNativeSceneSurfacePoleSelection,
  RenderSceneGizmoViewport, RenderEditorError} from '@barocss/render-editor';
import {GizmoSurface} from '@barocss/render-editor/react';
import type {GizmoSurfaceAdapter, GizmoSurfaceActionResult} from '@barocss/render-editor/react';
import type {MeshCamera} from '@barocss/gpu';
import type {NativeSceneHost} from './native-scene-host';

type Point = readonly [number, number];
type Box = RenderSceneGizmoViewport & {left: number; top: number};
type Capture = {token: object; document: RenderNativeSceneDocument; bodyId: string;
  selection: RenderNativeSceneSurfacePoleSelection; camera: MeshCamera; viewport: RenderSceneGizmoViewport;
  axis: 'x' | 'y' | 'z'; from: Point; patch: RenderNativeSceneSurfacePolePatch | null; previewDocument: RenderNativeSceneDocument | null};
interface Props {host: NativeSceneHost; canvas: HTMLCanvasElement | null; disabled: boolean;
  onError(cause: unknown): void; onFrame(): void; onFrameAll(): void}
const measure = (canvas: HTMLCanvasElement): Box => {const rect = canvas.getBoundingClientRect();
  return {left: rect.left, top: rect.top, width: rect.width, height: rect.height, backingWidth: canvas.width, backingHeight: canvas.height};};
const viewport = ({width, height, backingWidth, backingHeight}: Box): RenderSceneGizmoViewport => ({width, height, backingWidth, backingHeight});
const sameBox = (a: Box, b: Box) => (['left', 'top', 'width', 'height', 'backingWidth', 'backingHeight'] as const).every(key => a[key] === b[key]);
const sameCamera = (a: MeshCamera, b: MeshCamera) => a.eye.every((value, i) => value === b.eye[i])
  && a.target.every((value, i) => value === b.target[i]) && a.up.every((value, i) => value === b.up[i])
  && a.fovYDegrees === b.fovYDegrees && a.near === b.near && a.far === b.far;

/** Original control-grid markers follow the actual Surface preview; release commits once. */
export function NativeSurfacePoleControls({host, canvas, disabled, onError, onFrame, onFrameAll}: Props) {
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [box, setBox] = useState<Box | null>(null), [previewRevision, setPreviewRevision] = useState(0);
  const [error, setError] = useState<RenderEditorError | null>(null);
  const captured = useRef<Capture | null>(null), listeners = useRef(new Set<() => void>());
  const resetClick = useRef<(() => void) | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({disabled, onError}); latest.current = {disabled, onError};
  useEffect(() => {if (!state.dirty) setError(null);}, [state.dirty, state.accepted, state.surfacePoleInputResetEpoch]);
  useEffect(() => {if (disabled) resetClick.current?.();}, [disabled]);
  useEffect(() => {
    const live = host.getSnapshot();
    if (captured.current && !live.surfacePoleGestureActive && !live.surfacePolePreview) {
      captured.current = null; setPreviewRevision(value => value + 1);
      for (const listener of listeners.current) listener();
    }
  }, [host, state.surfacePoleGestureActive, state.surfacePolePreview, state.accepted]);
  const adapter = useMemo<GizmoSurfaceAdapter<Capture>>(() => {
    const notify = () => {setPreviewRevision(value => value + 1); for (const listener of listeners.current) listener();};
    const releaseIfClosed = () => {
      const live = host.getSnapshot();
      if (!live.surfacePoleGestureActive && !live.surfacePolePreview) captured.current = null;
      notify();
    };
    const result = (action: () => void): GizmoSurfaceActionResult => {
      try {action(); return {ok: true};} catch (cause) {return {ok: false, error: normalizeRenderEditorError(cause)};}
    };
    return {
      subscribe(listener) {listeners.current.add(listener); const stop = host.subscribe(listener);
        return () => {listeners.current.delete(listener); stop();};},
      hitTest: hitTestRenderSceneGizmo,
      prepare(size) {
        const live = host.getSnapshot(), active = captured.current;
        if (!live.available || live.disposed || live.poseGestureActive || live.posePreview
          || !active && live.dirty) return {pivot: [0, 0], handles: [], unavailable: 'Apply or Discard drafts before dragging a point.'};
        const selection = active?.selection ?? {uIndex: live.selectedSurfacePole.uIndex, vIndex: live.selectedSurfacePole.vIndex};
        return prepareRenderNativeSceneSurfacePoleControls(active?.previewDocument ?? active?.document ?? live.accepted,
          active?.bodyId ?? live.selectedBodyId, active?.camera ?? host.getDisplayCamera(), size, selection).gizmo;
      },
      capture(key, from, size) {
        const live = host.getSnapshot();
        if (latest.current.disabled || captured.current || live.dirty || !live.available || live.disposed
          || live.poseGestureActive || live.posePreview || live.surfacePolePreview || !['x', 'y', 'z'].includes(key)) return null;
        const selection = {uIndex: live.selectedSurfacePole.uIndex, vIndex: live.selectedSurfacePole.vIndex};
        const camera = host.getDisplayCamera();
        const token = host.beginSurfacePoleDrag(live.selectedBodyId, selection.uIndex, selection.vIndex);
        const capture: Capture = {token, document: live.accepted, bodyId: live.selectedBodyId, selection, camera,
          viewport: size, axis: key as Capture['axis'], from, patch: null, previewDocument: null};
        captured.current = capture; setError(null); return capture;
      },
      isCurrent(capture) {
        const live = host.getSnapshot();
        if (captured.current !== capture || (!live.surfacePoleGestureActive && !live.surfacePolePreview) || !live.available || live.disposed
          || live.accepted !== capture.document || live.selectedBodyId !== capture.bodyId
          || live.selectedSurfacePole.uIndex !== capture.selection.uIndex || live.selectedSurfacePole.vIndex !== capture.selection.vIndex) return false;
        try {return sameCamera(capture.camera, host.getDisplayCamera());} catch {return false;}
      },
      preview(capture, to) {return result(() => {
        const patch = deriveRenderNativeSceneSurfacePoleAxisDrag(capture.document, capture.bodyId, capture.selection,
          capture.camera, capture.viewport, capture.axis, capture.from, to);
        const preview = host.previewSurfacePoleDrag(capture.token, patch);
        capture.patch = patch; capture.previewDocument = preview.authored.document; notify();
      });},
      finish(capture) {return result(() => {
        try {if (capture.patch) host.finishSurfacePoleDrag(capture.token, capture.patch); else host.cancelSurfacePoleDrag(capture.token);}
        finally {releaseIfClosed();}
      });},
      cancel(capture) {return result(() => {
        try {host.cancelSurfacePoleDrag(capture.token);}
        finally {releaseIfClosed();}
      });},
    };
  }, [host]);
  useEffect(() => {
    if (!canvas) return;
    const update = () => setBox(measure(canvas)), observer = new ResizeObserver(update);
    observer.observe(canvas); update(); return () => observer.disconnect();
  }, [canvas]);
  const shown = useMemo(() => {
    if (!box) return {controls: null, cause: null};
    try {
      const active = captured.current, selection = {uIndex: state.selectedSurfacePole.uIndex, vIndex: state.selectedSurfacePole.vIndex};
      const document = active?.previewDocument ?? active?.document ?? state.accepted;
      return {controls: prepareRenderNativeSceneSurfacePoleControls(document, state.selectedBodyId,
        active?.camera ?? host.getDisplayCamera(), viewport(box), selection), cause: null};
    } catch (cause) {return {controls: null, cause: normalizeRenderEditorError(cause)};}
  }, [host, state, box, previewRevision]);
  const markers = useRef(shown); markers.current = shown;
  useEffect(() => {
    if (!canvas || !container.current) return;
    const element = container.current;
    type Click = {pointer: number; snapshot: typeof state; camera: MeshCamera; box: Box; from: Point; maximum: number; target: SVGElement};
    let click: Click | null = null;
    const clear = () => {const old = click; click = null; if (old?.target.hasPointerCapture(old.pointer)) old.target.releasePointerCapture(old.pointer);};
    resetClick.current = clear;
    const allowed = () => {const live = host.getSnapshot(); return !latest.current.disabled && live.available && !live.disposed
      && !live.dirty && !live.poseGestureActive && !live.posePreview && !live.surfacePolePreview && !element.querySelector('[role="dialog"]');};
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-native-pole]') || event.button !== 0
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || click || !allowed()) return;
      event.preventDefault(); event.stopPropagation(); canvas.focus({preventScroll: true});
      if (!allowed()) return;
      try {const target = event.target as SVGElement, box = measure(canvas);
        click = {pointer: event.pointerId, snapshot: host.getSnapshot(), camera: host.getDisplayCamera(), box,
          from: [event.clientX - box.left, event.clientY - box.top], maximum: 0, target}; target.setPointerCapture(event.pointerId);
      } catch (cause) {clear(); latest.current.onError(cause);}
    };
    const move = (event: PointerEvent) => {if (!click || click.pointer !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation(); click.maximum = Math.max(click.maximum,
        Math.hypot(event.clientX - click.box.left - click.from[0], event.clientY - click.box.top - click.from[1]));};
    const up = (event: PointerEvent) => {
      const old = click; if (!old || old.pointer !== event.pointerId) return;
      move(event); clear(); event.preventDefault(); event.stopPropagation();
      if (old.maximum > 3 || !allowed() || host.getSnapshot() !== old.snapshot || !sameBox(old.box, measure(canvas))) return;
      try {
        if (!sameCamera(old.camera, host.getDisplayCamera())) return;
        const point: Point = [event.clientX - old.box.left, event.clientY - old.box.top];
        let closest = null as NonNullable<typeof markers.current.controls>['points'][number] | null, distance = 8;
        for (const pole of markers.current.controls?.points ?? []) {
          const next = Math.hypot(pole.point[0] - point[0], pole.point[1] - point[1]);
          if (next < distance) {distance = next; closest = pole;}
        }
        if (closest) {host.selectSurfacePole(closest.uIndex, closest.vIndex); setError(null);}
      } catch (cause) {setError(normalizeRenderEditorError(cause)); latest.current.onError(cause);}
    };
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up); element.addEventListener('pointercancel', clear);
    element.addEventListener('lostpointercapture', clear); window.addEventListener('blur', clear);
    element.addEventListener('wheel', clear); window.addEventListener('keydown', clear);
    const stop = host.subscribe(clear), observer = new ResizeObserver(clear); observer.observe(canvas);
    return () => {clear(); resetClick.current = null; stop(); observer.disconnect(); element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', clear); element.removeEventListener('lostpointercapture', clear);
      element.removeEventListener('wheel', clear); window.removeEventListener('keydown', clear); window.removeEventListener('blur', clear);};
  }, [host, canvas]);
  const report = (cause: RenderEditorError) => {setError(cause); onError(cause);};
  const cancelPending = (): GizmoSurfaceActionResult => {
    const capture = captured.current;
    return capture ? adapter.cancel(capture) : {ok: true};
  };
  return <div className="re-native-pole-controls" ref={container}
    data-pole-gesture-active={state.surfacePoleGestureActive} data-pole-preview-body={state.surfacePolePreview?.bodyId}
    data-pole-preview-patch={state.surfacePolePreview ? JSON.stringify(state.surfacePolePreview.patch) : undefined}>
    {box && <svg className="re-native-pole-markers" viewBox={'0 0 ' + box.width + ' ' + box.height} aria-label="Original Surface control points" data-testid="native-pole-overlay">
      {shown.controls?.points.map(pole => <circle key={pole.uIndex + ':' + pole.vIndex} data-native-pole
        data-testid={'native-pole-point-' + pole.uIndex + '-' + pole.vIndex} data-u-index={pole.uIndex} data-v-index={pole.vIndex}
        data-active={pole.uIndex === state.selectedSurfacePole.uIndex && pole.vIndex === state.selectedSurfacePole.vIndex}
        cx={pole.point[0]} cy={pole.point[1]} r={4} aria-label={'Control point U ' + (pole.uIndex + 1) + ', V ' + (pole.vIndex + 1)}><title>{'U ' + (pole.uIndex + 1) + ', V ' + (pole.vIndex + 1)}</title></circle>)}
    </svg>}
    <GizmoSurface canvas={canvas} adapter={adapter} mode="translate" showModeButtons={false}
      disabled={disabled || !state.available || state.disposed || state.poseGestureActive || !!state.posePreview}
      pending={state.surfacePoleGestureActive || !!state.surfacePolePreview} onError={report} onCancelPending={cancelPending}
      viewportShortcuts onFrame={onFrame} onFrameAll={onFrameAll}
      profileNotice="Control point · local source XYZ"
      helpText="Click an original control-point marker to select its U row and V column. Markers show through the Surface; they are not Surface hits. Drag a local XYZ arrow to preview the actual Surface. Release applies one change. Escape restores the applied Surface. If restoration fails, use Cancel transform to retry before editing. Numeric point fields use original source mm and preserve weight; those field drafts use Apply scene. Apply or Discard existing drafts before choosing another point or mode. Use Object mode for body Move, Rotate and Scale. F frames the selected body; Shift + F frames all."/>
    <div className="re-native-pole-status" data-testid="native-pole-status" aria-live="polite">
      <span>{state.surfacePoleGestureActive ? 'Live Surface preview · Release applies · Escape restores'
        : state.surfacePolePreview ? 'Surface preview retained · Cancel transform to restore'
        : state.invalidSurfacePole ? 'Correct point fields or Discard. The applied Surface is kept.'
          : state.surfacePoleDraftActive ? 'Point draft · Apply scene to update Surface'
          : shown.cause ? 'Control points unavailable for this Surface.' : 'Original grid · x-ray markers · Drag XYZ to preview'}</span>
      {(error || shown.cause) && <details><summary>Details</summary><p>{(error ?? shown.cause)?.message}</p></details>}
    </div>
  </div>;
}
