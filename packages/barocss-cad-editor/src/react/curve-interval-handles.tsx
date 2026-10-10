import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { evaluateCurve, type CadGeometryReferenceV0, type Curve } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorCurveIntervalField, type CadEditorSnapshot } from '../types.js';
import type { CadEditorCurvePresentationReceipt } from './types.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { intervalCurve, intervalValue, intervalNumberText, sameIntervalData as same, useCurveInterval } from './curve-interval.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; presentation: CadEditorCurvePresentationReceipt | null;
  isCurrentPresentation: (receipt: CadEditorCurvePresentationReceipt) => boolean;
  onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
interface Gesture {
  session: CadEditorSession; pointerId: number; element: SVGCircleElement; endpoint: CadEditorCurveIntervalField;
  reference: CadGeometryReferenceV0; curve: Curve; source: string; domain: [number, number];
  generation: number; displayGeneration: number; selection: unknown; view: unknown; presentation: CadEditorCurvePresentationReceipt;
  rect: { left: number; top: number; width: number; height: number }; pixelWidth: number; pixelHeight: number;
  startX: number; startY: number; originalRaw: string | undefined; raw: string | undefined; expected: CadEditorSnapshot['pending']; moved: boolean;
}
const keyFor = (endpoint: CadEditorCurveIntervalField) => endpoint === 'min' ? 'intervalMin' : 'intervalMax';

/** Discrete original-parameter observations only; no continuous Curve inverse or coefficient edit is implied. */
export function CurveIntervalHandles(props: Props) {
  const mode = useCurveInterval(), latest = useRef(props), modeRef = useRef(mode); latest.current = props; modeRef.current = mode;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>()), [, render] = useState(0);
  function fail(cause: unknown) { const error = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
    cause instanceof Error ? cause.message : 'Use the parameter fields to choose this interval.', { field: 'curve-interval' }, cause);
    modeRef.current?.report(error); /* Provider forwards the same diagnostic once. */ }
  function captured(id: number, own?: Gesture) { return [document.documentElement, ...document.querySelectorAll('*')]
    .some(element => !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id)); }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(presentation: CadEditorCurvePresentationReceipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !canvas.closest('[data-panel-resizing="true"],[data-direct-host-busy="true"]')
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null && now.isCurrentPresentation(presentation);
  }
  function current(current: Gesture, capture = true) {
    const now = latest.current, frame = now.presentation, rect = now.canvas?.getBoundingClientRect(), mode = modeRef.current;
    let data: ReturnType<typeof intervalCurve> = null; try { data = intervalCurve(now.session, current.reference.bodyId); } catch {}
    return now.session === current.session && !!data && !!frame && !!rect && mode?.active === true && mode.bodyId === current.reference.bodyId
      && !data.snapshot.candidate && !data.snapshot.selectionTransition && data.snapshot.generation === current.generation
      && data.snapshot.displayGeneration === current.displayGeneration && same(data.reference, current.reference)
      && data.source === current.source && same(data.curve, current.curve) && same(data.domain, current.domain)
      && same(data.snapshot.view, current.view) && same({ surface: data.snapshot.selection, curve: data.snapshot.curveSelection }, current.selection)
      && same(data.snapshot.pending, current.expected) && context(frame)
      && same(frame.state.camera, current.presentation.state.camera) && Object.is(frame.state.mmToSceneUnit, current.presentation.state.mmToSceneUnit)
      && now.canvas?.width === current.pixelWidth && now.canvas.height === current.pixelHeight
      && rect.left === current.rect.left && rect.top === current.rect.top && rect.width === current.rect.width && rect.height === current.rect.height
      && (!capture || current.element.hasPointerCapture(current.pointerId)) && !otherCapture(current);
  }
  function finish(current: Gesture) { gesture.current = null; modeRef.current?.setGesture(false); latest.current.onGestureChange(false); render(value => value + 1);
    try { if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId); } catch {} }
  function cancel(restore: boolean) {
    const g = gesture.current; if (!g) return; const own = restore && current(g, false); finish(g);
    if (own && g.raw !== g.originalRaw) try { g.session.stageCurveIntervalField(g.endpoint, g.originalRaw ?? intervalNumberText(g.domain[g.endpoint === 'min' ? 0 : 1])); }
    catch (cause) { fail(cause); }
  }
  function check(g: Gesture, capture = true) { if (!current(g, capture)) throw new CadEditorError('STALE', 'The Curve, view or pending interval changed. Review the values.', { field: 'curve-interval' }); }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', escape, true);
    return () => { live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('keydown', escape, true); cancel(true); pointers.current.clear(); };
  }, [props.session]);
  useEffect(() => { const g = gesture.current; if (g && !current(g)) cancel(false); });
  useEffect(() => { if (!props.canvas) return; const observer = new ResizeObserver(() => { const g = gesture.current; if (g && !current(g, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect(); }, [props.canvas]);
  function begin(endpoint: CadEditorCurveIntervalField, event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || otherCapture() || !mode?.active) return;
    try {
      const now = latest.current, frame = now.presentation, canvas = now.canvas, data = intervalCurve(now.session, mode.bodyId);
      if (!data || !frame || !canvas || !context(frame) || data.snapshot.candidate || data.snapshot.selectionTransition
        || Object.keys(data.snapshot.pending).some(key => key !== 'intervalMin' && key !== 'intervalMax')
        || frame.preview.count !== 65 || frame.preview.parameters.length !== 65 || !same(frame.reference, data.reference)
        || frame.preview.source !== data.source || !same(frame.preview.model.objects.find(value => value.id === frame.curveId), data.curve)) return;
      const rect = canvas.getBoundingClientRect(), raw = data.snapshot.pending[keyFor(endpoint)];
      gesture.current = { session: now.session, pointerId: event.pointerId, element: event.currentTarget, endpoint,
        reference: structuredClone(data.reference), curve: structuredClone(data.curve), source: data.source, domain: [...data.domain],
        generation: data.snapshot.generation, displayGeneration: data.snapshot.displayGeneration,
        selection: structuredClone({ surface: data.snapshot.selection, curve: data.snapshot.curveSelection }), view: structuredClone(data.snapshot.view), presentation: structuredClone(frame),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth: canvas.width, pixelHeight: canvas.height,
        startX: event.clientX, startY: event.clientY, originalRaw: raw, raw, expected: structuredClone(data.snapshot.pending), moved: false };
      mode.setGesture(true); now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(g: Gesture, x: number, y: number) {
    check(g); if (!g.moved && Math.hypot(x - g.startX, y - g.startY) <= 3) return;
    const candidates = g.presentation.preview.pointsMM.flatMap((point, index) => {
      const projected = projectCurvePole(point, g.presentation.state.camera, g.presentation.state.mmToSceneUnit, g.rect.width, g.rect.height, g.pixelWidth, g.pixelHeight);
      return projected ? [{ index, distance: Math.hypot(projected.xCss + g.rect.left - x, projected.yCss + g.rect.top - y) }] : [];
    }).sort((a, b) => a.distance - b.distance || a.index - b.index);
    const closest = candidates[0]; if (!closest) throw new RangeError('No sampled parameter is visible. Use the fields.');
    if (candidates.some(value => Math.abs(value.index - closest.index) > 1 && Math.abs(value.distance - closest.distance) <= 0.5))
      throw new RangeError('Projected parameters overlap. Use the exact parameter fields.');
    const parameter = g.presentation.preview.parameters[closest.index], raw = intervalNumberText(parameter), key = keyFor(g.endpoint), expected = { ...g.expected };
    if (Object.is(parameter, g.domain[g.endpoint === 'min' ? 0 : 1])) delete expected[key]; else expected[key] = raw;
    check(g); g.expected = expected; g.raw = expected[key]; g.session.stageCurveIntervalField(g.endpoint, raw); g.moved = true; check(g); render(value => value + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) { const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    try { check(g); if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(g, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); } }
  function end(event: ReactPointerEvent<SVGCircleElement>) { const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    try { stage(g, event.clientX, event.clientY); check(g); const changed = g.moved && g.raw !== g.originalRaw; finish(g);
      if (changed) { check(g, false); g.session.prepareApply(); } } catch (cause) { cancel(false); fail(cause); } }
  const frame = props.presentation, canvas = props.canvas;
  let data: ReturnType<typeof intervalCurve> = null; try { if (mode?.active) data = intervalCurve(props.session, mode.bodyId); } catch {}
  const rect = canvas?.getBoundingClientRect(); if (!mode?.active || !data || !frame || !canvas || !rect || rect.width <= 0 || rect.height <= 0
    || !same(frame.reference, data.reference) || frame.generation !== data.snapshot.generation || frame.displayGeneration !== data.snapshot.displayGeneration) return null;
  const min = intervalValue(data.snapshot.pending.intervalMin, data.domain[0]), max = intervalValue(data.snapshot.pending.intervalMax, data.domain[1]);
  function position(parameter: number | null) {
    if (parameter === null || parameter < data!.domain[0] || parameter > data!.domain[1]) return null;
    try { return projectCurvePole(evaluateCurve(data!.curve, parameter), frame!.state.camera, frame!.state.mmToSceneUnit, rect!.width, rect!.height, canvas!.width, canvas!.height); } catch { return null; }
  }
  const start = position(min), endPoint = position(max), hasRaw = data.snapshot.pending.intervalMin !== undefined || data.snapshot.pending.intervalMax !== undefined;
  const ghostPoints = min !== null && max !== null && min < max ? frame.preview.parameters.flatMap((value, index) => {
    if (value < min || value > max) return []; const projected = projectCurvePole(frame.preview.pointsMM[index], frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
    return projected ? [projected.xCss + ',' + projected.yCss] : [];
  }).join(' ') : '';
  return <div className="curve-interval-overlay"><svg className="curve-interval-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    {hasRaw && <g className="curve-interval-ghost" data-testid="curve-interval-ghost">{ghostPoints && <polyline points={ghostPoints} fill="none" />}</g>}
    {(['min', 'max'] as const).map(endpoint => { const point = endpoint === 'min' ? start : endPoint; if (!point) return null;
      return <g key={endpoint}><text className="curve-interval-label" x={point.xCss + 11} y={point.yCss - 11}>{endpoint === 'min' ? 'Start' : 'End'}</text>
        <circle className="curve-interval-handle" data-endpoint={endpoint} data-testid={endpoint === 'min' ? 'curve-interval-start-handle' : 'curve-interval-end-handle'}
          cx={point.xCss} cy={point.yCss} r={9} role="button" tabIndex={0} aria-label={'Curve interval ' + (endpoint === 'min' ? 'start' : 'end')}
          aria-disabled={!!data!.snapshot.candidate || !!data!.snapshot.selectionTransition || !context(frame!) || (!gesture.current && otherCapture())}
          onPointerDown={event => begin(endpoint, event)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
          onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Choose a sampled original parameter</title></circle></g>;
    })}
  </svg><p className="curve-interval-status" data-testid="curve-interval-status" role="status">65 sampled parameters · Type for exact values · Escape cancels drag</p></div>;
}
