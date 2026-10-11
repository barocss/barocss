import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { evaluateCurve } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorSnapshot } from '../types.js';
import type { CadEditorDisplayReceipt, CadEditorCurvePresentationReceipt } from './types.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { useCurveKnot, curveKnotCurve } from './curve-knot.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null;
  documentReceipt: CadEditorDisplayReceipt | null; focusReceipt: CadEditorCurvePresentationReceipt | null;
  isCurrentCurve: () => boolean; onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
type Data = NonNullable<ReturnType<typeof curveKnotCurve>>;
type Frame = CadEditorDisplayReceipt | CadEditorCurvePresentationReceipt;
interface Gesture {
  session: CadEditorSession; pointerId: number; element: SVGCircleElement; data: Data; frame: Frame;
  rect: { left: number; top: number; width: number; height: number }; pixelWidth: number; pixelHeight: number;
  startX: number; startY: number; originalRaw: string | undefined; raw: string | undefined;
  expected: CadEditorSnapshot['pending']; moved: boolean;
}
const numberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Reflect.ownKeys(a), other = Reflect.ownKeys(b);
  return Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && keys.length === other.length
    && keys.every(key => other.includes(key) && same(Reflect.get(a, key), Reflect.get(b, key)));
}
function stations(data: Data) {
  const range = data.domain;
  return Array.from({ length: 65 }, (_, index) => {
    const value = index === 0 ? range[0] : index === 64 ? range[1] : range[0] + (range[1] - range[0]) * index / 64;
    return value === 0 ? data.curve.knots.find(knot => knot === 0) ?? value : value;
  });
}
function visibleFrame(props: Props, data: Data): Frame | null {
  if (data.snapshot.view.kind === 'document') {
    const frame = props.documentReceipt;
    return frame?.state.documentBodies.some(body => body.binding.bodyId === data.reference.bodyId
      && body.ref.kind === 'curve' && body.ref.curveId === data.curve.id) ? frame : null;
  }
  const frame = props.focusReceipt;
  return frame?.reference.bodyId === data.reference.bodyId && frame.preview.source === data.source ? frame : null;
}

/** Forward-projected original parameters; this guide is neither a control coefficient nor an inverse pick. */
export function CurveKnotHandles(props: Props) {
  const mode = useCurveKnot(), latest = useRef(props), modeRef = useRef(mode);
  latest.current = props; modeRef.current = mode;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>()), composing = useRef(false), [, render] = useState(0);
  function data() { try { return curveKnotCurve(latest.current.session); } catch { return null; } }
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Use the exact parameter field.', { field: 'curve-knot' }, cause));
  }
  function captured(id: number, own?: Gesture) {
    return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
      !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id));
  }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context() {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return !composing.current && canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-panel-resizing="true"],[data-direct-host-busy="true"]')
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null && now.isCurrentCurve();
  }
  function current(g: Gesture, capture = true, candidateToken?: string) {
    const now = latest.current, value = data(), rect = now.canvas?.getBoundingClientRect(), mode = modeRef.current;
    const frame = value ? visibleFrame(now, value) : null;
    return now.session === g.session && !!value && !!frame && !!rect && mode?.isActive() === true
      && (candidateToken === undefined ? !value.snapshot.candidate : value.snapshot.candidate?.token === candidateToken)
      && !value.snapshot.selectionTransition && value.snapshot.generation === g.data.snapshot.generation
      && value.snapshot.displayGeneration === g.data.snapshot.displayGeneration && same(value.reference, g.data.reference)
      && value.source === g.data.source && same(value.curve, g.data.curve) && same(value.domain, g.data.domain)
      && same(value.snapshot.view, g.data.snapshot.view) && same(value.snapshot.selection, g.data.snapshot.selection)
      && same(value.snapshot.curveSelection, g.data.snapshot.curveSelection) && same(value.snapshot.pending, g.expected)
      && context() && same(frame.state.camera, g.frame.state.camera) && Object.is(frame.state.mmToSceneUnit, g.frame.state.mmToSceneUnit)
      && now.canvas?.width === g.pixelWidth && now.canvas.height === g.pixelHeight
      && rect.left === g.rect.left && rect.top === g.rect.top && rect.width === g.rect.width && rect.height === g.rect.height
      && (!capture || g.element.hasPointerCapture(g.pointerId)) && !otherCapture(g);
  }
  function finish(g: Gesture) {
    gesture.current = null; modeRef.current?.onGestureChange(false); latest.current.onGestureChange(false); render(value => value + 1);
    try { if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const g = gesture.current; if (!g) return;
    const own = restore && current(g, false); finish(g);
    if (own && current(g, false) && g.raw !== g.originalRaw) try { g.session.stageCurveKnotField(g.originalRaw ?? ''); } catch (cause) { fail(cause); }
  }
  function check(g: Gesture, capture = true) {
    if (!current(g, capture)) throw new CadEditorError('STALE', 'The Curve, view or parameter changed. Review the draft.', { field: 'curve-knot' });
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    const start = () => { cancel(true); composing.current = true; }, end = () => { composing.current = false; };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', escape, true);
    window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { live = false;
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('keydown', escape, true);
      window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true);
      cancel(true); pointers.current.clear(); composing.current = false; };
  }, [props.session]);
  useEffect(() => { const g = gesture.current; if (g && !current(g)) cancel(false); });
  useEffect(() => { if (!props.canvas) return;
    const observer = new ResizeObserver(() => { const g = gesture.current; if (g && !current(g, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect(); }, [props.canvas]);
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || otherCapture() || !mode?.isActive() || !context()) return;
    try {
      const now = latest.current, value = data(), canvas = now.canvas, frame = value ? visibleFrame(now, value) : null;
      if (!value || !canvas || !frame || value.snapshot.candidate || value.snapshot.selectionTransition
        || Object.keys(value.snapshot.pending).some(key => key !== 'curveKnot')) return;
      const rect = canvas.getBoundingClientRect(), raw = value.snapshot.pending.curveKnot;
      gesture.current = { session: now.session, pointerId: event.pointerId, element: event.currentTarget, data: structuredClone(value), frame: structuredClone(frame),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth: canvas.width, pixelHeight: canvas.height,
        startX: event.clientX, startY: event.clientY, originalRaw: raw, raw, expected: structuredClone(value.snapshot.pending), moved: false };
      mode.onGestureChange(true); now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(g: Gesture, x: number, y: number) {
    check(g); if (!g.moved && Math.hypot(x - g.startX, y - g.startY) <= 3) return;
    const points = stations(g.data).flatMap((parameter, index) => {
      const point = projectCurvePole(evaluateCurve(g.data.curve, parameter), g.frame.state.camera, g.frame.state.mmToSceneUnit,
        g.rect.width, g.rect.height, g.pixelWidth, g.pixelHeight);
      return point ? [{ index, parameter, xCss: point.xCss, yCss: point.yCss, distance: Math.hypot(point.xCss + g.rect.left - x, point.yCss + g.rect.top - y) }] : [];
    }).sort((a, b) => a.distance - b.distance || a.index - b.index);
    const closest = points[0]; if (!closest) throw new RangeError('No original parameter station is visible. Use the exact field.');
    if (points.some(point => Math.abs(point.index - closest.index) > 1 && Math.hypot(point.xCss - closest.xCss, point.yCss - closest.yCss) <= .5))
      throw new RangeError('Projected parameters overlap. Use the exact field.');
    const raw = numberText(closest.parameter); check(g); g.expected = { ...g.expected, curveKnot: raw }; g.raw = raw;
    g.session.stageCurveKnotField(raw); g.moved = true; check(g); render(value => value + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    try { if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(g, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    try { stage(g, event.clientX, event.clientY); check(g); const changed = g.moved && g.raw !== g.originalRaw; finish(g);
      if (changed) { check(g, false); const candidate = g.session.prepareApply();
        if (!candidate || !current(g, false, candidate.token)) {
          if (candidate && g.session.getSnapshot().candidate?.token === candidate.token) g.session.cancelCandidate(candidate.token);
          throw new CadEditorError('STALE', 'The insertion changed during preparation. Review the draft.', { field: 'curve-knot' });
        }
      }
    } catch (cause) { cancel(false); fail(cause); }
  }
  const value = data(), canvas = props.canvas, frame = value ? visibleFrame(props, value) : null, rect = canvas?.getBoundingClientRect();
  if (!mode?.isActive() || !value || !canvas || !frame || !rect || !context()) return null;
  const raw = mode.raw.trim(), parameter = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isFinite(parameter) || parameter < value.domain[0] || parameter > value.domain[1]) return null;
  const marker = projectCurvePole(evaluateCurve(value.curve, parameter), frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
  const segments: string[] = []; let line: string[] = [];
  for (const t of stations(value)) {
    const point = projectCurvePole(evaluateCurve(value.curve, t), frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
    if (point) line.push(point.xCss + ',' + point.yCss); else if (line.length) { segments.push(line.join(' ')); line = []; }
  }
  if (line.length) segments.push(line.join(' '));
  return <div className="curve-knot-overlay"><svg className="curve-knot-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    <g className="curve-knot-ghost" data-testid="curve-knot-ghost">{segments.map((points, index) => <polyline key={index} points={points} fill="none" />)}</g>
    {marker && <g><text className="curve-knot-label" x={marker.xCss + 12} y={marker.yCss - 12}>Knot</text>
      <circle className="curve-knot-handle" data-testid="curve-knot-handle" cx={marker.xCss} cy={marker.yCss} r={9} role="button" tabIndex={0}
        aria-label="Place original Curve knot" aria-disabled={!!value.snapshot.candidate || !!value.snapshot.selectionTransition || (!gesture.current && otherCapture())}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end}
        onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
        onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Choose a sampled original parameter</title></circle></g>}
  </svg><p className="curve-knot-status" role="status" data-testid="curve-knot-status">65 parameter stations · Type for exact values · Escape cancels drag</p></div>;
}
