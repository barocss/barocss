import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CadEditorDrivingSketchSession } from '../driving-types.js';
import { CadEditorError } from '../types.js';
import type { CadEditorDrivingSketchDisplayReceipt } from './driving-sketch-editor.js';
import { sameDrivingData as same } from './driving-dimension-handles.js';
import { prepareDrivingAnchorProjection, projectDrivingAnchor, drivingAnchorDisplacement, type DrivingAnchorProjection } from './driving-anchor-projection.js';

interface Props {
  session: CadEditorDrivingSketchSession; canvas: HTMLCanvasElement | null;
  receipt: CadEditorDrivingSketchDisplayReceipt | null; constraintId: string | null;
  isCurrentFrame: (receipt: CadEditorDrivingSketchDisplayReceipt, ownCandidateToken?: string) => boolean;
  onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function source(props: Props, ownCandidateToken?: string) {
  const snapshot = props.session.getSnapshot(), frame = props.receipt, selection = snapshot.selection;
  if (!frame || !selection || snapshot.disposed || (ownCandidateToken === undefined ? snapshot.candidate !== null : snapshot.candidate?.token !== ownCandidateToken)
    || frame.state.status !== 'ready' || frame.generation !== snapshot.generation || frame.displayGeneration !== snapshot.displayGeneration
    || !same(frame.view, snapshot.view) || !same(frame.selection, selection) || !same(frame.native, snapshot.accepted)
    || selection.generation !== snapshot.generation || selection.native.profileId !== snapshot.view.profileId
    || !snapshot.selectedScopeIds.includes(snapshot.view.profileId)) return null;
  const definition = snapshot.accepted.document.constraints.find(value => value.id === props.constraintId);
  if (!definition || definition.kind !== 'fixed' || definition.pointId !== selection.native.pointId || !definition.target.every(Number.isInteger)) return null;
  const point = snapshot.accepted.target.worldPointBindings.find(value => value.pointId === definition.pointId && value.profileId === snapshot.view.profileId);
  const profile = snapshot.accepted.target.profiles.find(value => value.profileId === snapshot.view.profileId);
  const bindings = snapshot.accepted.segmentMappings.filter(value => value.profileId === snapshot.view.profileId);
  const ref = profile ? { kind: 'curve', modelId: profile.affine.model.name, curveId: profile.worldCurveId } : null;
  if (!point || !profile || !same(point, selection.native) || point.localPointMM[0] !== definition.target[0] || point.localPointMM[1] !== definition.target[1]
    || point.worldCurveId !== profile.worldCurveId || !same(frame.profile, profile) || !same(frame.bindings, bindings)
    || frame.preview.source !== profile.affine.source || !same(frame.preview.model, profile.affine.model)
    || frame.preview.curveId !== profile.worldCurveId || frame.preview.count !== 65 || frame.preview.parameters.length !== 65
    || frame.state.native !== null || frame.state.document !== null || frame.state.documentBodies.length !== 0
    || frame.state.curveSampleVersion !== 3 || !same(frame.state.selectedUniformCurve, frame.preview)
    || frame.state.visibleGeometry.length !== 1 || !same(frame.state.visibleGeometry[0], ref) || !same(frame.state.selectedGeometry, ref)) return null;
  return { snapshot, frame, selection, definition, point, profile, bindings, plane: snapshot.accepted.target.document.plane };
}
type Source = NonNullable<ReturnType<typeof source>>;
type Raw = Partial<Record<'xMM' | 'yMM', string>>;
interface Gesture {
  session: CadEditorDrivingSketchSession; pointerId: number; element: SVGCircleElement; data: Source;
  projection: DrivingAnchorProjection; start: { xCss: number; yCss: number };
  rect: { left: number; top: number; width: number; height: number }; pixelWidth: number; pixelHeight: number;
  raw: Raw; delta: [number, number]; moved: boolean;
}

/** Stage the existing fixed constraint only. Native seed, solved profiles and frame stay accepted until release. */
export function DrivingAnchorHandles(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>()), composing = useRef(false), [, render] = useState(0);
  function fail(cause: unknown) { latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
    cause instanceof Error ? cause.message : 'Use the fixed point fields in this view.', { field: 'driving-anchor' }, cause)); }
  function captured(id: number, own?: Gesture) { return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
    !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id)); }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(frame: CadEditorDrivingSketchDisplayReceipt, ownCandidateToken?: string) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return !composing.current && canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility) && !canvas.closest('[data-driving-host-busy="true"]')
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null && now.isCurrentFrame(frame, ownCandidateToken);
  }
  function expected(g: Gesture) { return Object.keys(g.raw).length ? { [g.data.definition.id]: { ...g.raw } } : {}; }
  function owned(g: Gesture, capture = true, ownCandidateToken?: string) {
    const now = latest.current, data = source(now, ownCandidateToken), rect = now.canvas?.getBoundingClientRect();
    return now.session === g.session && !!data && !!rect && data.snapshot.generation === g.data.snapshot.generation
      && data.snapshot.displayGeneration === g.data.snapshot.displayGeneration && same(data.selection, g.data.selection)
      && same(data.definition, g.data.definition) && same(data.point, g.data.point) && same(data.plane, g.data.plane)
      && same(data.profile, g.data.profile) && same(data.bindings, g.data.bindings) && same(data.snapshot.view, g.data.snapshot.view)
      && same(data.snapshot.pending.fields, expected(g)) && context(g.data.frame, ownCandidateToken)
      && same(data.frame.state.camera, g.data.frame.state.camera) && Object.is(data.frame.state.mmToSceneUnit, g.data.frame.state.mmToSceneUnit)
      && now.canvas?.width === g.pixelWidth && now.canvas.height === g.pixelHeight
      && rect.left === g.rect.left && rect.top === g.rect.top && rect.width === g.rect.width && rect.height === g.rect.height
      && (!capture || g.element.hasPointerCapture(g.pointerId)) && !otherCapture(g);
  }
  function check(g: Gesture, capture = true) { if (!owned(g, capture)) throw new CadEditorError('STALE', 'The fixed point, view or draft changed. Review the pending values.', { field: 'driving-anchor' }); }
  function finish(g: Gesture) {
    gesture.current = null; latest.current.onGestureChange(false); render(value => value + 1);
    try { if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const g = gesture.current; if (!g) return;
    const own = restore && owned(g, false); finish(g);
    if (own && owned(g, false) && Object.keys(g.raw).length) try { g.session.discardPending(); } catch (cause) { fail(cause); }
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    const startComposition = () => { cancel(true); composing.current = true; }, endComposition = () => { composing.current = false; };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', escape, true);
    window.addEventListener('compositionstart', startComposition, true); window.addEventListener('compositionend', endComposition, true);
    return () => { live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('keydown', escape, true);
      window.removeEventListener('compositionstart', startComposition, true); window.removeEventListener('compositionend', endComposition, true);
      cancel(true); pointers.current.clear(); composing.current = false; };
  }, [props.session]);
  useEffect(() => { const g = gesture.current; if (g && !owned(g)) cancel(false); });
  useEffect(() => { if (!props.canvas) return; const observer = new ResizeObserver(() => { const g = gesture.current; if (g && !owned(g, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect(); }, [props.canvas]);
  function projection(data: Source, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return prepareDrivingAnchorProjection({ anchorMM: [...data.point.worldPointMM],
      plane: { originMM: [...data.plane.originMM], uAxis: [...data.plane.uAxis], vAxis: [...data.plane.vAxis] },
      camera: data.frame.state.camera, mmToSceneUnit: data.frame.state.mmToSceneUnit,
      cssWidth: rect.width, cssHeight: rect.height, pixelWidth: canvas.width, pixelHeight: canvas.height });
  }
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || otherCapture()) return;
    try {
      const now = latest.current, data = source(now), canvas = now.canvas;
      if (!data || !canvas || !context(data.frame) || Object.keys(data.snapshot.pending.fields).length) return;
      const prepared = projection(data, canvas); if (!prepared) return;
      const rect = canvas.getBoundingClientRect();
      const g: Gesture = { session: now.session, pointerId: event.pointerId, element: event.currentTarget, data: structuredClone(data), projection: prepared,
        start: { xCss: event.clientX - rect.left, yCss: event.clientY - rect.top }, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        pixelWidth: canvas.width, pixelHeight: canvas.height, raw: {}, delta: [0, 0], moved: false };
      gesture.current = g; now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true });
      check(g); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(g: Gesture, clientX: number, clientY: number) {
    check(g); const point = { xCss: clientX - g.rect.left, yCss: clientY - g.rect.top };
    if (!g.moved && Math.hypot(point.xCss - g.start.xCss, point.yCss - g.start.yCss) <= 3) return;
    const delta = drivingAnchorDisplacement(g.projection, g.start, point);
    if (!delta) throw new RangeError('This view cannot map that movement. Use the fixed point fields.');
    const stepped: [number, number] = [Math.round(delta[0]), Math.round(delta[1])];
    if (!projectDrivingAnchor(g.projection, stepped)) throw new RangeError('The proposed point is outside the current view. Use the fields.');
    for (const [field, axis] of [['xMM', 0], ['yMM', 1]] as const) {
      check(g); const original = g.data.definition.target[axis], value = stepped[axis] === 0 ? original : original + stepped[axis], raw = text(value);
      if (!Number.isFinite(value)) throw new RangeError('The local target must be finite.');
      const next = { ...g.raw }; if (Object.is(value, original)) delete next[field]; else next[field] = raw;
      if (same(next, g.raw)) continue;
      g.raw = next; g.session.stageConstraintField(g.data.definition.id, field, raw); check(g);
    }
    g.delta = stepped; g.moved = true; render(value => value + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    try { if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(g, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    try { stage(g, event.clientX, event.clientY); check(g); const changed = Object.keys(g.raw).length > 0; finish(g);
      if (changed) { check(g, false); const candidate = g.session.prepareApply();
        if (!candidate || !owned(g, false, candidate.token)) {
          if (candidate && g.session.getSnapshot().candidate?.token === candidate.token) g.session.cancelCandidate(candidate.token);
          throw new CadEditorError('STALE', 'The fixed point changed during preparation. Review the draft.', { field: 'driving-anchor' });
        }
      }
    } catch (cause) { cancel(false); fail(cause); }
  }
  const g = gesture.current, data = g?.data ?? source(props), frame = g?.data.frame ?? props.receipt, canvas = props.canvas, rect = canvas?.getBoundingClientRect();
  if (!data || !frame || !canvas || !rect || rect.width <= 0 || rect.height <= 0) return null;
  let prepared = g?.projection ?? null; if (!prepared) try { prepared = projection(data, canvas); } catch { /* The native fields remain available. */ }
  if (!prepared) return null;
  const ghost = g && Object.keys(g.raw).length ? projectDrivingAnchor(prepared, g.delta) : null;
  const disabled = !g && (Object.keys(data.snapshot.pending.fields).length > 0 || !context(frame) || otherCapture());
  return <div className="driving-anchor-controls"><svg className="driving-anchor-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    {ghost && <g className="driving-anchor-ghost" data-testid="driving-anchor-ghost"><line x1={prepared.xCss} y1={prepared.yCss} x2={ghost.xCss} y2={ghost.yCss} /><circle cx={ghost.xCss} cy={ghost.yCss} r={6} /></g>}
    <circle className="driving-anchor-handle" data-testid="driving-anchor-handle" cx={prepared.xCss} cy={prepared.yCss} r={9}
      role="button" tabIndex={0} aria-disabled={disabled} aria-label="Drag fixed point on the original workplane"
      onPointerDown={begin} onPointerMove={move} onPointerUp={end}
      onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
      onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Drag local XY in 1 mm steps</title></circle>
  </svg><p className="driving-anchor-status" data-testid="driving-anchor-status" role="status">Fixed point · Local XY · 1 mm steps · Escape cancels</p></div>;
}
