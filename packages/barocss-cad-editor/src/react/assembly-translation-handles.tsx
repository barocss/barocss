import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CadEditorAssemblySession, CadEditorAssemblyPoseField, CadEditorAssemblySelection } from '../assembly-types.js';
import { CadEditorError } from '../types.js';
import type { CadEditorAssemblyDisplayReceipt } from './assembly-editor.js';
import { createExtrusionHeightProjection, extrusionHeightDelta, projectExtrusionHeight,
  type ExtrusionHeightProjection } from './extrusion-height-projection.js';

type Triple = [number, number, number];
const fields = ['xMM', 'yMM', 'zMM'] as const;
const labels = ['X', 'Y', 'Z'] as const;
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
export function sameAssemblyData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameAssemblyData(left[key], right[key]));
}
interface Props {
  session: CadEditorAssemblySession;
  canvas: HTMLCanvasElement | null;
  receipt: CadEditorAssemblyDisplayReceipt | null;
  isCurrentFrame: (receipt: CadEditorAssemblyDisplayReceipt) => boolean;
  onError: (error: CadEditorError) => void;
  onGestureChange: (active: boolean) => void;
}
interface Gesture {
  pointerId: number; element: SVGCircleElement; axis: 0 | 1 | 2;
  binding: CadEditorAssemblySelection; frame: CadEditorAssemblyDisplayReceipt;
  placement: Triple; parentMatrix: readonly number[] | null;
  projection: ExtrusionHeightProjection; start: { xCss: number; yCss: number };
  rect: { left: number; top: number; width: number; height: number };
  pixelWidth: number; pixelHeight: number; delta: number;
  raw: Partial<Record<CadEditorAssemblyPoseField, string>>;
}
function source(session: CadEditorAssemblySession, frame: CadEditorAssemblyDisplayReceipt | null) {
  const snapshot = session.getSnapshot(), selection = snapshot.selection;
  if (!frame || !selection || snapshot.disposed || snapshot.candidate || frame.state.status !== 'ready'
    || frame.generation !== snapshot.generation || frame.displayGeneration !== snapshot.displayGeneration
    || frame.assemblyId !== selection.binding.assemblyId || frame.assemblyRevision !== selection.binding.assemblyRevision
    || frame.selectedInstanceId !== selection.binding.instanceId || !frame.selectedBinding || !frame.point
    || !sameAssemblyData(frame.state.assembly, snapshot.accepted)
    || frame.selectedBinding.instanceId !== selection.binding.instanceId
    || !sameAssemblyData(frame.selectedBinding.reference, selection.binding.reference)
    || frame.point.instanceId !== selection.binding.instanceId || frame.point.assemblyId !== selection.binding.assemblyId
    || frame.point.assemblyRevision !== selection.binding.assemblyRevision
    || !sameAssemblyData(frame.point.reference, selection.binding.reference)
    || !sameAssemblyData(frame.point.worldMatrix, selection.instance.worldMatrix)) return null;
  const parent = selection.instance.parentId === null ? null
    : snapshot.accepted.instances.find(value => value.instanceId === selection.instance.parentId);
  if (selection.instance.parentId !== null && !parent) return null;
  return { snapshot, selection, anchor: frame.point.assemblyPointMM,
    parentMatrix: parent?.worldMatrix ?? null };
}
function direction(matrix: readonly number[] | null, axis: 0 | 1 | 2): Triple {
  return matrix ? [matrix[axis], matrix[4 + axis], matrix[8 + axis]] : [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0];
}

/** Local pose movement only. The accepted shared part sources and displayed geometry stay unchanged while held. */
export function AssemblyTranslationHandles(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>());
  const [, render] = useState(0);
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Use the local position fields to move this instance.', { field: 'assembly-drag' }, cause));
  }
  function captured(id: number, own?: Gesture) {
    return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
      !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id));
  }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(frame: CadEditorAssemblyDisplayReceipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !canvas.closest('[data-assembly-host-busy="true"]') && now.isCurrentFrame(frame)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function owned(current: Gesture, capture = true) {
    const now = latest.current, frame = now.receipt, data = source(now.session, frame), rect = now.canvas?.getBoundingClientRect();
    if (!data || !frame || !rect) return false;
    return sameAssemblyData(data.selection.binding, current.binding)
      && sameAssemblyData(data.selection.instance.placement.translationMM, current.placement)
      && sameAssemblyData(data.parentMatrix, current.parentMatrix)
      && sameAssemblyData(data.snapshot.pending.fields, current.raw)
      && (Object.keys(current.raw).length ? sameAssemblyData(data.snapshot.pending.target, current.binding) : data.snapshot.pending.target === null)
      && context(frame) && sameAssemblyData(frame.state.camera, current.frame.state.camera)
      && Object.is(frame.state.mmToSceneUnit, current.frame.state.mmToSceneUnit)
      && sameAssemblyData(frame.instanceIds, current.frame.instanceIds)
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
    if (restoreOwned && Object.keys(current.raw).length) try { latest.current.session.discardPending(); } catch (cause) { fail(cause); }
    // Handles operate on the already selected instance. No selection is changed or discarded by capture.
  }
  function check(current: Gesture) {
    if (!owned(current)) throw new CadEditorError('STALE', 'The instance or view changed. Review the pending local position.', { field: 'assembly-drag' });
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => {
      if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); }
    };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', key, true);
    return () => { live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true);
      window.removeEventListener('keydown', key, true); cancel(true); pointers.current.clear(); };
  }, [props.session]);
  useEffect(() => { const current = gesture.current; if (current && !owned(current)) cancel(false); });
  useEffect(() => {
    if (!props.canvas) return;
    const observer = new ResizeObserver(() => { const current = gesture.current; if (current && !owned(current, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect();
  }, [props.canvas]);
  function begin(axis: 0 | 1 | 2, event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation();
    if (gesture.current || otherCapture()) return;
    try {
      const now = latest.current, data = source(now.session, now.receipt), frame = now.receipt, canvas = now.canvas;
      if (!data || !frame || !canvas || !context(frame) || Object.keys(data.snapshot.pending.fields).length) return;
      const rect = canvas.getBoundingClientRect(), projection = createExtrusionHeightProjection({
        anchorMM: [...data.anchor], normal: direction(data.parentMatrix, axis), camera: frame.state.camera,
        mmToSceneUnit: frame.state.mmToSceneUnit, translate: [0, 0, 0], cssWidth: rect.width, cssHeight: rect.height,
        pixelWidth: canvas.width, pixelHeight: canvas.height });
      if (!projection) return;
      const current: Gesture = { pointerId: event.pointerId, element: event.currentTarget, axis,
        binding: structuredClone(data.selection.binding), frame: structuredClone(frame),
        placement: [...data.selection.instance.placement.translationMM], parentMatrix: data.parentMatrix ? [...data.parentMatrix] : null,
        projection, start: { xCss: event.clientX - rect.left, yCss: event.clientY - rect.top },
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth: canvas.width, pixelHeight: canvas.height, delta: 0, raw: {} };
      gesture.current = current; now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    try {
      check(current);
      if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        throw new CadEditorError('INPUT', 'Finish the movement with an unmodified primary pointer.', { field: 'assembly-drag' });
      const point = { xCss: event.clientX - current.rect.left, yCss: event.clientY - current.rect.top };
      if (!Object.keys(current.raw).length && Math.hypot(point.xCss - current.start.xCss, point.yCss - current.start.yCss) <= 3) return;
      const delta = extrusionHeightDelta(current.projection, current.start, point);
      if (delta === null) throw new RangeError('Use local position fields. This view cannot map that axis movement.');
      const value = delta === 0 ? current.placement[current.axis] : current.placement[current.axis] + delta;
      const field = fields[current.axis], raw = text(value); check(current);
      current.raw = Object.is(value, current.placement[current.axis]) ? {} : { [field]: raw };
      latest.current.session.stagePoseField(field, raw); current.delta = delta; check(current); render(version => version + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    // Pointerup has buttons=0. Process its final location without requiring the held-button state.
    try {
      check(current);
      const point = { xCss: event.clientX - current.rect.left, yCss: event.clientY - current.rect.top };
      if (Object.keys(current.raw).length || Math.hypot(point.xCss - current.start.xCss, point.yCss - current.start.yCss) > 3) {
        const delta = extrusionHeightDelta(current.projection, current.start, point);
        if (delta === null) throw new RangeError('Use local position fields. This view cannot map that axis movement.');
        const value = delta === 0 ? current.placement[current.axis] : current.placement[current.axis] + delta, field = fields[current.axis];
        current.raw = Object.is(value, current.placement[current.axis]) ? {} : { [field]: text(value) };
        latest.current.session.stagePoseField(field, text(value)); current.delta = delta; check(current);
      }
      const changed = Object.keys(current.raw).length > 0; finish(current);
      if (changed) latest.current.session.prepareApply();
    } catch (cause) { cancel(false); fail(cause); }
  }
  function nudge(axis: 0 | 1 | 2, event: ReactKeyboardEvent<SVGCircleElement>) {
    if (!['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || gesture.current || otherCapture()) return;
    try {
      const start = latest.current, data = source(start.session, start.receipt), frame = start.receipt;
      const canvas = start.canvas, rect = canvas?.getBoundingClientRect();
      if (!data || !frame || !canvas || !rect || !context(frame) || Object.keys(data.snapshot.pending.fields).length) return;
      const binding = structuredClone(data.selection.binding), instance = structuredClone(data.selection.instance);
      const parentMatrix = data.parentMatrix ? [...data.parentMatrix] : null, axisDirection = direction(parentMatrix, axis);
      const capturedFrame = structuredClone(frame), generation = data.snapshot.generation, displayGeneration = data.snapshot.displayGeneration;
      const bounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth = canvas.width, pixelHeight = canvas.height;
      const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1, field = fields[axis];
      const raw = text(instance.placement.translationMM[axis] + delta);
      start.session.stagePoseField(field, raw);
      const now = latest.current, current = source(now.session, now.receipt), currentRect = now.canvas?.getBoundingClientRect();
      if (now.session !== start.session || now.canvas !== canvas || !current || !currentRect || gesture.current || otherCapture()
        || !context(capturedFrame) || current.snapshot.generation !== generation || current.snapshot.displayGeneration !== displayGeneration
        || !sameAssemblyData(current.selection.binding, binding) || !sameAssemblyData(current.selection.instance, instance)
        || !sameAssemblyData(current.parentMatrix, parentMatrix) || !sameAssemblyData(direction(current.parentMatrix, axis), axisDirection)
        || !sameAssemblyData(current.snapshot.pending.target, binding) || !sameAssemblyData(current.snapshot.pending.fields, { [field]: raw })
        || !sameAssemblyData(now.receipt?.state.camera, capturedFrame.state.camera)
        || canvas.width !== pixelWidth || canvas.height !== pixelHeight || currentRect.left !== bounds.left || currentRect.top !== bounds.top
        || currentRect.width !== bounds.width || currentRect.height !== bounds.height)
        throw new CadEditorError('STALE', 'The instance or pending values changed. Review the pending local position.', { field: 'assembly-drag' });
      start.session.prepareApply();
    } catch (cause) { fail(cause); }
  }
  const current = gesture.current, frame = current?.frame ?? props.receipt, data = source(props.session, frame), canvas = props.canvas;
  const rect = canvas?.getBoundingClientRect();
  if (!frame || !data || !rect || rect.width <= 0 || rect.height <= 0) return null;
  const pending = Object.keys(data.snapshot.pending.fields).length > 0;
  const projections = ([0, 1, 2] as const).map(axis => {
    if (current?.axis === axis) return current.projection;
    try { return createExtrusionHeightProjection({ anchorMM: [...data.anchor], normal: direction(data.parentMatrix, axis),
      camera: frame.state.camera, mmToSceneUnit: frame.state.mmToSceneUnit, translate: [0, 0, 0], cssWidth: rect.width,
      cssHeight: rect.height, pixelWidth: canvas!.width, pixelHeight: canvas!.height }); } catch { return null; }
  });
  return <div className="cad-editor-assembly-controls"><svg className="assembly-translation-svg" width={rect.width} height={rect.height}
    viewBox={`0 0 ${rect.width} ${rect.height}`}>
    {projections.map((projection, axis) => {
      if (!projection) return null;
      const x = projection.xCss + projection.dirX * 38, y = projection.yCss + projection.dirY * 38;
      const disabled = current ? current.axis !== axis : pending || !context(frame) || otherCapture();
      const ghost = current?.axis === axis && Object.keys(current.raw).length ? projectExtrusionHeight(projection, current.delta) : null;
      return <g key={axis} data-axis={labels[axis].toLowerCase()}>
        <g className="assembly-translation-guide" aria-hidden="true"><line x1={projection.xCss} y1={projection.yCss} x2={x} y2={y} />
          <text x={x + 10} y={y - 10}>{labels[axis]}</text></g>
        {ghost && <g className="assembly-translation-ghost" data-testid="assembly-translation-ghost"><line x1={projection.xCss} y1={projection.yCss} x2={ghost.xCss} y2={ghost.yCss} />
          <circle cx={ghost.xCss} cy={ghost.yCss} r={6} /></g>}
        <circle className="assembly-translation-handle" data-testid={'assembly-axis-' + labels[axis].toLowerCase()} cx={x} cy={y} r={9}
          role="button" tabIndex={0} aria-label={'Move instance along local ' + labels[axis]} aria-disabled={disabled}
          onPointerDown={event => begin(axis as 0 | 1 | 2, event)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
          onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
          onKeyDown={event => nudge(axis as 0 | 1 | 2, event)}><title>Drag local {labels[axis]} position</title></circle>
      </g>;
    })}
  </svg><p className="assembly-translation-status" data-testid="assembly-translation-status" role="status">Local position · Drag an axis · Escape cancels</p></div>;
}
