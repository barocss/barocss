import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CadEditorLoftSession, CadEditorLoftPoleField, CadEditorLoftNodeBinding } from '../loft-types.js';
import { CadEditorError } from '../types.js';
import type { CadEditorLoftDisplayReceipt } from './nurbs-loft-editor.js';
import { projectCurvePole, moveCurvePoleInViewPlane, type CurvePolePlane, type PolePoint } from './curve-pole-projection.js';

export function sameLoftData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameLoftData(left[key], right[key]));
}
interface Props {
  session: CadEditorLoftSession; canvas: HTMLCanvasElement | null; receipt: CadEditorLoftDisplayReceipt | null;
  isCurrentFrame: (receipt: CadEditorLoftDisplayReceipt) => boolean;
  onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
interface Gesture {
  pointerId: number; element: SVGCircleElement; nodeId: string; index: number; previousIndex: number;
  binding: CadEditorLoftNodeBinding; generation: number; displayGeneration: number; source: string;
  frame: CadEditorLoftDisplayReceipt; point: PolePoint; plane: CurvePolePlane;
  rect: { left: number; top: number; width: number; height: number }; startX: number; startY: number;
  moved: boolean; dx: number; dy: number; raw: Partial<Record<CadEditorLoftPoleField, string>>;
}
const fields = ['xMM', 'yMM', 'zMM'] as const;
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);

/** Original coefficients only. The accepted native Curve and Loft are never deformed by this overlay. */
export function LoftSectionHandles(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>());
  const [moving, setMoving] = useState(false);
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Cannot move this section point.', { field: 'loft-pole-drag' }, cause));
  }
  function otherCapture(own?: Gesture) {
    return [...pointers.current].some(id => [document.documentElement, ...document.querySelectorAll('*')]
      .some(element => !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id)));
  }
  function contextCurrent(frame: CadEditorLoftDisplayReceipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !canvas.closest('[data-loft-host-busy="true"]') && now.isCurrentFrame(frame)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function nodeForFrame() {
    const now = latest.current, snapshot = now.session.getSnapshot(), frame = now.receipt;
    if (!frame || frame.view.kind !== 'section' || snapshot.view.kind !== 'section'
      || frame.view.nodeId !== snapshot.view.nodeId || snapshot.disposed
      || frame.generation !== snapshot.generation || frame.displayGeneration !== snapshot.displayGeneration) return null;
    const nodeId = frame.view.nodeId;
    const node = snapshot.accepted.evaluatedNodes.find(value => value.nodeId === nodeId);
    const binding = snapshot.accepted.bindings.nodes.find(value => value.nodeId === nodeId);
    if (!node || !binding || !sameLoftData(binding, frame.binding) || frame.source !== node.evaluation.source
      || !frame.preview || !sameLoftData(frame.preview.model, node.evaluation.model)
      || frame.preview.curveId !== node.curveId || frame.preview.source !== node.evaluation.source) return null;
    return { snapshot, frame, node, binding, curve: node.evaluation.curve };
  }
  function owned(current: Gesture, capture = true) {
    const now = latest.current, state = now.session.getSnapshot(), frame = now.receipt, rect = now.canvas?.getBoundingClientRect();
    const node = nodeForFrame(), target = state.pending.target;
    return !!node && !!frame && !state.candidate && state.generation === current.generation && state.displayGeneration === current.displayGeneration
      && state.selection?.nodeId === current.nodeId && state.selection.index === current.index
      && sameLoftData(state.selection.binding, current.binding) && sameLoftData(node.binding, current.binding)
      && node.node.evaluation.source === current.source && sameLoftData(node.curve.controlPoints[current.index], current.point)
      && sameLoftData(state.pending.fields, current.raw)
      && (Object.keys(current.raw).length === 0 ? target === null : target?.nodeId === current.nodeId && target.index === current.index
        && (target.binding === undefined || sameLoftData(target.binding, current.binding)))
      && contextCurrent(frame) && sameLoftData(frame.state.camera, current.frame.state.camera)
      && Object.is(frame.state.mmToSceneUnit, current.frame.state.mmToSceneUnit)
      && frame.width === current.frame.width && frame.height === current.frame.height
      && now.canvas?.width === current.frame.width && now.canvas.height === current.frame.height
      && !!rect && rect.left === current.rect.left && rect.top === current.rect.top && rect.width === current.rect.width && rect.height === current.rect.height
      && (!capture || current.element.hasPointerCapture(current.pointerId)) && !otherCapture(current);
  }
  function finish(current: Gesture) {
    gesture.current = null; setMoving(false); latest.current.onGestureChange(false);
    try { if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const current = gesture.current; if (!current) return;
    const restoreOwned = restore && owned(current, false); finish(current);
    if (restoreOwned) try {
      if (Object.keys(current.raw).length) latest.current.session.discardPending();
      if (current.previousIndex !== current.index) latest.current.session.selectPole({ nodeId: current.nodeId, index: current.previousIndex, binding: current.binding });
    } catch (cause) { fail(cause); }
  }
  function check(current: Gesture) {
    if (!owned(current)) throw new CadEditorError('STALE', 'The section or view changed. Review the pending point values.', { field: 'loft-pole-drag' });
  }
  useEffect(() => {
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const up = (event: PointerEvent) => { pointers.current.delete(event.pointerId); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true); window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true); window.removeEventListener('keydown', key, true); cancel(true); pointers.current.clear(); };
  }, [props.session]);
  useEffect(() => { const current = gesture.current; if (current && !owned(current)) cancel(false); });
  useEffect(() => {
    if (!props.canvas) return;
    const observer = new ResizeObserver(() => { const current = gesture.current; if (current && !owned(current, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect();
  }, [props.canvas]);
  function begin(event: ReactPointerEvent<SVGCircleElement>, index: number) {
    if (!event.isPrimary || event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || otherCapture()) return;
    try {
      const now = latest.current, info = nodeForFrame(), canvas = now.canvas;
      if (!info || !canvas || !contextCurrent(info.frame) || info.snapshot.candidate || Object.keys(info.snapshot.pending.fields).length) return;
      const rect = canvas.getBoundingClientRect(), point = [...info.curve.controlPoints[index]] as PolePoint;
      const plane = projectCurvePole(point, info.frame.state.camera, info.frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
      if (!plane) return;
      const previousIndex = info.snapshot.selection?.index ?? index;
      now.session.selectPole({ nodeId: info.node.nodeId, index, binding: info.binding });
      const selected = now.session.getSnapshot();
      if (selected.selection?.nodeId !== info.node.nodeId || selected.selection.index !== index || selected.candidate
        || selected.generation !== info.snapshot.generation || selected.displayGeneration !== info.snapshot.displayGeneration
        || Object.keys(selected.pending.fields).length) throw new CadEditorError('STALE', 'The selected point changed.', { field: 'loft-pole-drag' });
      gesture.current = { pointerId: event.pointerId, element: event.currentTarget, nodeId: info.node.nodeId, index, previousIndex,
        binding: structuredClone(info.binding), generation: selected.generation, displayGeneration: selected.displayGeneration,
        source: info.node.evaluation.source, frame: structuredClone(info.frame), point, plane,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, startX: event.clientX, startY: event.clientY,
        moved: false, dx: 0, dy: 0, raw: {} };
      event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true });
      now.onGestureChange(true); setMoving(true);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    try {
      check(current); const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) <= 3) return;
      const point = moveCurvePoleInViewPlane(current.plane, dx, dy);
      for (let axis = 0; axis < fields.length; axis++) {
        check(current); const field = fields[axis], raw = text(point[axis]);
        const expected = { ...current.raw };
        if (Object.is(point[axis], current.point[axis])) delete expected[field]; else expected[field] = raw;
        latest.current.session.stagePoleField(field, raw); current.raw = expected; check(current);
      }
      current.moved = true; current.dx = dx; current.dy = dy; setMoving(true);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    move(event); const current = gesture.current; if (!current) return;
    event.preventDefault(); event.stopPropagation();
    try { check(current); finish(current); if (current.moved && Object.keys(current.raw).length) latest.current.session.prepareApply(); }
    catch (cause) { cancel(false); fail(cause); }
  }
  const info = nodeForFrame(), captured = gesture.current, canvas = props.canvas, frame = captured?.frame ?? info?.frame;
  const curve = info?.curve ?? (captured ? props.session.getSnapshot().accepted.evaluatedNodes.find(node => node.nodeId === captured.nodeId)?.evaluation.curve : null);
  const rect = canvas?.getBoundingClientRect();
  if (!curve || !frame || !rect || (!info && !captured)) return null;
  const snapshot = props.session.getSnapshot(), pending = Object.keys(snapshot.pending.fields).length > 0;
  const points = curve.controlPoints.map(point => [...point] as PolePoint);
  if (snapshot.selection && pending) {
    const index = snapshot.selection.index, proposed = [...points[index]] as PolePoint;
    for (let axis = 0; axis < fields.length; axis++) {
      const raw = snapshot.pending.fields[fields[axis]];
      if (raw !== undefined) proposed[axis] = raw.trim() === '' ? NaN : Number(raw);
    }
    if (proposed.every(Number.isFinite)) points[index] = proposed;
  }
  const planes = points.map(point => { try { return projectCurvePole(point, frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, frame.width, frame.height); } catch { return null; } });
  if (captured) planes[captured.index] = { ...captured.plane, xCss: captured.plane.xCss + captured.dx, yCss: captured.plane.yCss + captured.dy };
  return <div className="cad-editor-curve-controls cad-editor-loft-controls">
    <svg className="cad-editor-curve-control-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`} aria-label="Original section control points">
      <g data-testid={pending ? 'loft-section-ghost' : undefined}>
        {planes.map((point, index) => index > 0 && point && planes[index - 1] ? <line key={'line' + index}
          x1={planes[index - 1]!.xCss} y1={planes[index - 1]!.yCss} x2={point.xCss} y2={point.yCss}
          className={'curve-control-line' + (pending ? ' pending' : '')} /> : null)}
        {planes.map((point, index) => point ? <circle key={index} cx={point.xCss} cy={point.yCss} r={snapshot.selection?.index === index ? 7 : 5}
          role="button" tabIndex={0} aria-label={'Section point ' + (index + 1)} aria-pressed={snapshot.selection?.index === index}
          aria-disabled={!captured && (pending || !!snapshot.candidate || !contextCurrent(frame))}
          data-testid={'loft-pole-handle-' + index} className={'curve-control-point' + (snapshot.selection?.index === index ? ' selected' : '') + (pending && snapshot.selection?.index === index ? ' pending' : '')}
          onPointerDown={event => begin(event, index)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
          onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
          onKeyDown={event => {
            if (!['Enter', ' '].includes(event.key) || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229
              || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || gesture.current || pending || snapshot.candidate || otherCapture()) return;
            event.preventDefault(); event.stopPropagation();
            try { const live = nodeForFrame(); if (live && contextCurrent(live.frame)) props.session.selectPole({ nodeId: live.node.nodeId, index, binding: live.binding }); } catch (cause) { fail(cause); }
          }} /> : null)}
      </g>
    </svg>
    <p className="cad-editor-curve-drag-hint cad-editor-loft-drag-hint" role="status" data-testid="loft-drag-status">
      {moving ? 'Release to apply · Escape cancels' : pending ? 'Point values pending · Apply or discard' : 'Drag a point · Escape cancels'}
    </p>
  </div>;
}
