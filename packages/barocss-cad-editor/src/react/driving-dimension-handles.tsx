import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CadEditorDrivingSketchSession } from '../driving-types.js';
import { CadEditorError } from '../types.js';
import type { CadEditorDrivingSketchDisplayReceipt } from './driving-sketch-editor.js';
import { createExtrusionHeightProjection, extrusionHeightDelta, projectExtrusionHeight,
  type ExtrusionHeightProjection } from './extrusion-height-projection.js';

export function sameDrivingData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameDrivingData(left[key], right[key]));
}
interface Props {
  session: CadEditorDrivingSketchSession; canvas: HTMLCanvasElement | null;
  receipt: CadEditorDrivingSketchDisplayReceipt | null; constraintId: string | null;
  isCurrentFrame: (receipt: CadEditorDrivingSketchDisplayReceipt) => boolean;
  onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function source(props: Props) {
  const snapshot = props.session.getSnapshot(), frame = props.receipt, selection = snapshot.selection;
  if (!frame || !selection || snapshot.disposed || snapshot.candidate || frame.state.status !== 'ready'
    || frame.generation !== snapshot.generation || frame.displayGeneration !== snapshot.displayGeneration
    || !sameDrivingData(frame.view, snapshot.view) || !sameDrivingData(frame.selection, selection)
    || !sameDrivingData(frame.native, snapshot.accepted) || !sameDrivingData(frame.profile.affine.source, frame.preview.source)
    || selection.native.profileId !== snapshot.view.profileId || !snapshot.selectedScopeIds.includes(snapshot.view.profileId)) return null;
  const definition = snapshot.accepted.document.constraints.find(value => value.id === props.constraintId);
  if (!definition || (definition.kind !== 'distance-x' && definition.kind !== 'distance-y') || definition.pointB !== selection.native.pointId) return null;
  const axis = definition.kind === 'distance-x' ? 0 : 1;
  const fixed = snapshot.accepted.document.constraints.find(value => value.kind === 'fixed' && value.pointId === definition.pointA
    && Number.isInteger(value.target[axis]));
  const pointA = snapshot.accepted.target.worldPointBindings.find(value => value.pointId === definition.pointA);
  const pointB = snapshot.accepted.target.worldPointBindings.find(value => value.pointId === definition.pointB && value.profileId === snapshot.view.profileId);
  const dimension = snapshot.accepted.report.dimensions.find(value => value.id === definition.id);
  if (!fixed || fixed.kind !== 'fixed' || !pointA || !pointB || !dimension || !sameDrivingData(pointB, selection.native)
    || dimension.axis !== (axis === 0 ? 'x' : 'y') || dimension.pointA !== definition.pointA || dimension.pointB !== definition.pointB
    || dimension.actualMM !== definition.distanceMM || frame.profile.worldCurveId !== pointB.worldCurveId) return null;
  const plane = snapshot.accepted.target.document.plane;
  return { snapshot, frame, selection, definition, fixed, pointA, pointB, plane, axis,
    direction: axis === 0 ? plane.uAxis : plane.vAxis };
}
type Source = NonNullable<ReturnType<typeof source>>;
interface Gesture {
  session: CadEditorDrivingSketchSession; pointerId: number; element: SVGCircleElement; data: Source; frame: CadEditorDrivingSketchDisplayReceipt;
  projection: ExtrusionHeightProjection; start: { xCss: number; yCss: number };
  rect: { left: number; top: number; width: number; height: number }; pixelWidth: number; pixelHeight: number;
  raw: string | null; delta: number;
}

/** One existing dimension is staged. The authored seed and accepted solved Curve are not dragged. */
export function DrivingDimensionHandles(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>());
  const [, render] = useState(0);
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Use the local distance field to change this dimension.', { field: 'driving-dimension' }, cause));
  }
  function captured(id: number, own?: Gesture) {
    return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
      !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id));
  }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(frame: CadEditorDrivingSketchDisplayReceipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !canvas.closest('[data-driving-host-busy="true"]') && now.isCurrentFrame(frame)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function identity(now: Source, prior: Source) {
    return now.snapshot.generation === prior.snapshot.generation && now.snapshot.displayGeneration === prior.snapshot.displayGeneration
      && sameDrivingData(now.selection, prior.selection) && sameDrivingData(now.definition, prior.definition)
      && sameDrivingData(now.fixed, prior.fixed) && sameDrivingData(now.pointA, prior.pointA) && sameDrivingData(now.pointB, prior.pointB)
      && sameDrivingData(now.plane, prior.plane) && sameDrivingData(now.frame.profile, prior.frame.profile)
      && sameDrivingData(now.frame.bindings, prior.frame.bindings);
  }
  function expected(data: Source, raw: string | null) { return raw === null ? {} : { [data.definition.id]: { distanceMM: raw } }; }
  function owned(current: Gesture, capture = true) {
    const now = latest.current, data = source(now), rect = now.canvas?.getBoundingClientRect();
    return now.session === current.session && !!data && !!rect && identity(data, current.data) && context(current.frame)
      && sameDrivingData(data.snapshot.pending.fields, expected(current.data, current.raw))
      && sameDrivingData(data.frame.state.camera, current.frame.state.camera)
      && Object.is(data.frame.state.mmToSceneUnit, current.frame.state.mmToSceneUnit)
      && now.canvas?.width === current.pixelWidth && now.canvas.height === current.pixelHeight
      && rect.left === current.rect.left && rect.top === current.rect.top && rect.width === current.rect.width && rect.height === current.rect.height
      && (!capture || current.element.hasPointerCapture(current.pointerId)) && !otherCapture(current);
  }
  function finish(current: Gesture) {
    gesture.current = null; latest.current.onGestureChange(false); render(value => value + 1);
    try { if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const current = gesture.current; if (!current) return;
    const restoreOwned = restore && owned(current, false); finish(current);
    if (restoreOwned && current.raw !== null) try { latest.current.session.discardPending(); } catch (cause) { fail(cause); }
    // This handle starts at the selected pointB and never changes the point selection.
  }
  function check(current: Gesture) {
    if (!owned(current)) throw new CadEditorError('STALE', 'The dimension or view changed. Review the pending values.', { field: 'driving-dimension' });
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => {
      if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', key, true);
    return () => { live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('keydown', key, true);
      cancel(true); pointers.current.clear(); };
  }, [props.session]);
  useEffect(() => { const current = gesture.current; if (current && !owned(current)) cancel(false); });
  useEffect(() => { if (!props.canvas) return;
    const observer = new ResizeObserver(() => { const current = gesture.current; if (current && !owned(current, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect(); }, [props.canvas]);
  function project(data: Source, frame: CadEditorDrivingSketchDisplayReceipt, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return createExtrusionHeightProjection({ anchorMM: [...data.pointB.worldPointMM], normal: [...data.direction], camera: frame.state.camera,
      mmToSceneUnit: frame.state.mmToSceneUnit, translate: [0, 0, 0], cssWidth: rect.width, cssHeight: rect.height,
      pixelWidth: canvas.width, pixelHeight: canvas.height });
  }
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || otherCapture()) return;
    try {
      const now = latest.current, data = source(now), canvas = now.canvas;
      if (!data || !canvas || !context(data.frame) || Object.keys(data.snapshot.pending.fields).length) return;
      const projection = project(data, data.frame, canvas); if (!projection) return;
      const rect = canvas.getBoundingClientRect(), current: Gesture = { session: now.session, pointerId: event.pointerId, element: event.currentTarget,
        data: structuredClone(data), frame: structuredClone(data.frame), projection,
        start: { xCss: event.clientX - rect.left, yCss: event.clientY - rect.top }, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        pixelWidth: canvas.width, pixelHeight: canvas.height, raw: null, delta: 0 };
      gesture.current = current; now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(current: Gesture, clientX: number, clientY: number) {
    check(current); const point = { xCss: clientX - current.rect.left, yCss: clientY - current.rect.top };
    if (current.raw === null && Math.hypot(point.xCss - current.start.xCss, point.yCss - current.start.yCss) <= 3) return;
    const delta = extrusionHeightDelta(current.projection, current.start, point);
    if (delta === null) throw new RangeError('Use the distance field. This view cannot map that movement.');
    const stepped = Math.round(delta), original = current.data.definition.distanceMM;
    const value = stepped === 0 ? original : original + stepped;
    if (!Number.isFinite(value)) throw new RangeError('The local distance must be finite.');
    const raw = text(value); check(current); current.raw = Object.is(value, original) ? null : raw;
    current.session.stageConstraintField(current.data.definition.id, 'distanceMM', raw);
    current.delta = stepped; check(current); render(version => version + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    try { check(current); if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(current, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    try { stage(current, event.clientX, event.clientY); check(current); const changed = current.raw !== null; finish(current);
      if (changed) { if (!owned(current, false)) throw new CadEditorError('STALE', 'The dimension or pending values changed. Review the pending values.', { field: 'driving-dimension' });
        current.session.prepareApply(); } } catch (cause) { cancel(false); fail(cause); }
  }
  function nudge(event: ReactKeyboardEvent<SVGCircleElement>) {
    if (!['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || gesture.current || otherCapture()) return;
    try {
      const start = latest.current, data = source(start), canvas = start.canvas, rect = canvas?.getBoundingClientRect();
      if (!data || !canvas || !rect || !context(data.frame) || Object.keys(data.snapshot.pending.fields).length) return;
      const frame = structuredClone(data.frame), before = structuredClone(data), pixelWidth = canvas.width, pixelHeight = canvas.height;
      const bounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1, raw = text(data.definition.distanceMM + step);
      start.session.stageConstraintField(data.definition.id, 'distanceMM', raw);
      const now = latest.current, current = source(now), actualRect = now.canvas?.getBoundingClientRect();
      if (now.session !== start.session || now.canvas !== canvas || !current || !actualRect || !identity(current, before) || !context(frame) || gesture.current || otherCapture()
        || !sameDrivingData(current.snapshot.pending.fields, expected(before, raw)) || !sameDrivingData(current.frame.state.camera, frame.state.camera)
        || canvas.width !== pixelWidth || canvas.height !== pixelHeight || actualRect.left !== bounds.left || actualRect.top !== bounds.top
        || actualRect.width !== bounds.width || actualRect.height !== bounds.height)
        throw new CadEditorError('STALE', 'The dimension or pending values changed. Review the pending values.', { field: 'driving-dimension' });
      start.session.prepareApply();
    } catch (cause) { fail(cause); }
  }
  const current = gesture.current, data = current?.data ?? source(props), frame = current?.frame ?? props.receipt, canvas = props.canvas;
  const rect = canvas?.getBoundingClientRect(); let projection = current?.projection ?? null;
  if (!data || !frame || !canvas || !rect || rect.width <= 0 || rect.height <= 0) return null;
  if (!projection) try { projection = project(data, frame, canvas); } catch { /* Numeric editing remains available. */ }
  if (!projection) return null;
  const x = projection.xCss + projection.dirX * 38, y = projection.yCss + projection.dirY * 38;
  const ghost = current?.raw !== null && current ? projectExtrusionHeight(projection, current.delta) : null;
  const disabled = !current && (Object.keys(data.snapshot.pending.fields).length > 0 || !context(frame) || otherCapture());
  return <div className="cad-editor-driving-controls"><svg className="driving-dimension-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    <g className="driving-dimension-guide" aria-hidden="true"><line x1={projection.xCss} y1={projection.yCss} x2={x} y2={y} />
      <text x={x + 10} y={y - 10}>{data.axis === 0 ? 'X' : 'Y'}</text></g>
    {ghost && <g className="driving-dimension-ghost" data-testid="driving-dimension-ghost"><line x1={projection.xCss} y1={projection.yCss} x2={ghost.xCss} y2={ghost.yCss} /><circle cx={ghost.xCss} cy={ghost.yCss} r={6} /></g>}
    <circle className="driving-dimension-handle" data-testid="driving-dimension-handle" role="button" tabIndex={0} aria-disabled={disabled}
      aria-label={'Change local ' + (data.axis === 0 ? 'X' : 'Y') + ' distance'} cx={x} cy={y} r={9}
      onPointerDown={begin} onPointerMove={move} onPointerUp={end} onKeyDown={nudge}
      onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
      onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Drag local distance in 1 mm steps</title></circle>
  </svg>{current && <p className="driving-dimension-status" data-testid="driving-dimension-status" role="status">Δ{data.axis === 0 ? 'X' : 'Y'} {text(current.delta)} mm</p>}</div>;
}
