import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { evaluateSurface, type CadGeometryReferenceV0, type Surface } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorSnapshot, type CadEditorSurfaceSplitAxis } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { sameIntervalData as same } from './curve-interval.js';
import { surfaceSplitSurface, useSurfaceSplit, splitNumber } from './surface-split.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
  isCurrentSurface: (receipt?: CadEditorDisplayReceipt, ownCandidateToken?: string) => boolean;
  onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
interface Gesture {
  session: CadEditorSession; canvas: HTMLCanvasElement; pointerId: number; element: SVGCircleElement; axis: CadEditorSurfaceSplitAxis;
  reference: CadGeometryReferenceV0; surface: Surface; source: string; domain: NonNullable<ReturnType<typeof surfaceSplitSurface>>['domain'];
  generation: number; displayGeneration: number; selection: unknown; view: CadEditorSnapshot['view']; tool: unknown;
  frame: CadEditorDisplayReceipt; rect: { left: number; top: number; width: number; height: number };
  pixelWidth: number; pixelHeight: number; startX: number; startY: number; originalRaw: string | undefined; raw: string | undefined;
  expected: CadEditorSnapshot['pending']; moved: boolean;
}
const selection = (snapshot: CadEditorSnapshot) => ({ surface: snapshot.selection, curve: snapshot.curveSelection });
const tool = (snapshot: CadEditorSnapshot) => ({ editTarget: snapshot.editTarget, rotationAxis: snapshot.rotationAxis, scaleAxis: snapshot.scaleAxis });
const keyFor = (axis: CadEditorSurfaceSplitAxis) => axis === 'u' ? 'surfaceSplitU' : 'surfaceSplitV';
function qualified(frame: CadEditorDisplayReceipt, data: NonNullable<ReturnType<typeof surfaceSplitSurface>>) {
  const body = frame.state.documentBodies.find(body => body.binding.bodyId === data.reference.bodyId);
  const asset = data.snapshot.accepted.document.assets.find(asset => asset.id === data.reference.assetId);
  const compiled = data.snapshot.accepted.compiledAssets.find(asset => asset.assetId === data.reference.assetId);
  return !!body && !!asset && !!compiled && frame.state.status === 'ready' && same(frame.state.document, data.snapshot.accepted)
    && asset.source === data.source && compiled.source === data.source && body.ref.kind === 'surface' && body.ref.surfaceId === data.surface.id
    && same(body.binding, { documentId: data.reference.documentId, documentRevision: data.reference.documentRevision,
      nativeFrame: data.snapshot.accepted.document.nativeFrame, bodyId: data.reference.bodyId, assetId: data.reference.assetId,
      assetRevision: data.reference.assetRevision, sourceFrame: data.reference.sourceFrame, modelId: compiled.model.name,
      geometryKind: 'surface', geometryId: data.surface.id })
    && same(frame.state.selectedGeometry, body.ref) && frame.state.visibleGeometry.some(ref => same(ref, body.ref));
}
function parameters(data: { surface: Surface; domain: Gesture['domain'] }, axis: CadEditorSurfaceSplitAxis) {
  const range = data.domain[axis], knots = axis === 'u' ? data.surface.knotsU : data.surface.knotsV;
  return Array.from({ length: 65 }, (_, index) => {
    const value = index === 0 ? range[0] : index === 64 ? range[1] : range[0] + (range[1] - range[0]) * index / 64;
    return value === 0 ? knots.find(knot => knot === 0) ?? value : value;
  });
}
function pointAt(data: { surface: Surface; domain: Gesture['domain'] }, axis: CadEditorSurfaceSplitAxis, parameter: number) {
  const other = data.domain[axis === 'u' ? 'v' : 'u'], middle = other[0] / 2 + other[1] / 2;
  return evaluateSurface(data.surface, axis === 'u' ? parameter : middle, axis === 'v' ? parameter : middle);
}
/** Original D0 parameter observations only; the actual native constructor creates both children. */
export function SurfaceSplitHandles(props: Props) {
  const mode = useSurfaceSplit(), modeRef = useRef(mode), latest = useRef(props); modeRef.current = mode; latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>()), composing = useRef(false), [, render] = useState(0);
  function fail(cause: unknown) { latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
    cause instanceof Error ? cause.message : 'Use the exact Surface split parameter.', { field: 'surface-split' }, cause)); }
  function captured(id: number, own?: Gesture) { return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
    !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id)); }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(frame = latest.current.receipt, token?: string) {
    const canvas = latest.current.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-direct-host-busy="true"],[data-panel-resizing="true"]')
      && document.querySelector('[role="menu"],[role="dialog"][data-state="open"]') === null && !!frame && latest.current.isCurrentSurface(frame, token);
  }
  function current(g: Gesture, capture = true, token?: string) {
    const now = latest.current, mode = modeRef.current, frame = now.receipt, rect = now.canvas?.getBoundingClientRect();
    let data: ReturnType<typeof surfaceSplitSurface> = null; try { data = surfaceSplitSurface(now.session); } catch {}
    return now.session === g.session && now.canvas === g.canvas && mode?.session === g.session && mode.isActive() && mode.currentAxis() === g.axis && !!data && !!frame && !!rect
      && (token === undefined ? data.snapshot.candidate === null : data.snapshot.candidate?.token === token) && !data.snapshot.selectionTransition
      && data.snapshot.generation === g.generation && data.snapshot.displayGeneration === g.displayGeneration
      && same(data.reference, g.reference) && data.source === g.source && same(data.surface, g.surface) && same(data.domain, g.domain)
      && same(selection(data.snapshot), g.selection) && same(data.snapshot.view, g.view) && same(tool(data.snapshot), g.tool)
      && same(data.snapshot.pending, g.expected) && !composing.current && context(frame, token) && qualified(frame, data)
      && same(frame.state.camera, g.frame.state.camera) && Object.is(frame.state.mmToSceneUnit, g.frame.state.mmToSceneUnit)
      && g.canvas.width === g.pixelWidth && g.canvas.height === g.pixelHeight
      && rect.left === g.rect.left && rect.top === g.rect.top && rect.width === g.rect.width && rect.height === g.rect.height
      && (!capture || g.element.hasPointerCapture(g.pointerId)) && !otherCapture(g);
  }
  function check(g: Gesture, capture = true) { if (!current(g, capture)) throw new CadEditorError('STALE', 'The Surface, parameter or view changed. Review the draft.', { field: 'surface-split' }); }
  function finish(g: Gesture) {
    gesture.current = null; modeRef.current?.onGestureChange(false); latest.current.onGestureChange(false); render(value => value + 1);
    try { if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const g = gesture.current; if (!g) return; const own = restore && current(g, false); finish(g);
    if (own && current(g, false) && g.raw !== g.originalRaw) try {
      const expected = { ...g.expected }; if (g.originalRaw === undefined) delete expected[keyFor(g.axis)]; else expected[keyFor(g.axis)] = g.originalRaw;
      g.expected = expected; g.raw = g.originalRaw; g.session.stageSurfaceSplitField(g.axis, g.originalRaw ?? ''); check(g, false);
    } catch (cause) { fail(cause); }
  }
  useEffect(() => {
    let live = true; const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => { if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0); };
    const start = () => { cancel(true); composing.current = true; }, end = () => { composing.current = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
    window.addEventListener('lostpointercapture', release, true); window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true); window.addEventListener('keydown', escape, true);
    return () => { live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      window.removeEventListener('lostpointercapture', release, true); window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true);
      window.removeEventListener('keydown', escape, true); cancel(true); pointers.current.clear(); composing.current = false; };
  }, [props.session]);
  useEffect(() => { const g = gesture.current; if (g && !current(g)) cancel(false); });
  useEffect(() => { if (!props.canvas) return; const observer = new ResizeObserver(() => { const g = gesture.current; if (g && !current(g, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect(); }, [props.canvas]);
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || composing.current || otherCapture() || !modeRef.current?.isActive()) return;
    try {
      const now = latest.current, frame = now.receipt, canvas = now.canvas, data = surfaceSplitSurface(now.session), mode = modeRef.current;
      if (!data || !frame || !canvas || !mode || !context(frame) || !qualified(frame, data) || data.snapshot.candidate || data.snapshot.selectionTransition
        || mode.currentAxis() !== mode.axis || Object.keys(data.snapshot.pending).some(key => key !== keyFor(mode.axis))) return;
      const rect = canvas.getBoundingClientRect(), raw = data.snapshot.pending[keyFor(mode.axis)];
      gesture.current = { session: now.session, canvas, pointerId: event.pointerId, element: event.currentTarget, axis: mode.axis,
        reference: structuredClone(data.reference), surface: structuredClone(data.surface), source: data.source, domain: structuredClone(data.domain),
        generation: data.snapshot.generation, displayGeneration: data.snapshot.displayGeneration, selection: structuredClone(selection(data.snapshot)),
        view: structuredClone(data.snapshot.view), tool: structuredClone(tool(data.snapshot)), frame: structuredClone(frame),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth: canvas.width, pixelHeight: canvas.height,
        startX: event.clientX, startY: event.clientY, originalRaw: raw, raw, expected: structuredClone(data.snapshot.pending), moved: false };
      mode.onGestureChange(true); now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(g: Gesture, x: number, y: number) {
    check(g); if (!g.moved && Math.hypot(x - g.startX, y - g.startY) <= 3) return;
    const candidates = parameters(g, g.axis).flatMap((parameter, index) => {
      const p = projectCurvePole(pointAt(g, g.axis, parameter), g.frame.state.camera, g.frame.state.mmToSceneUnit,
        g.rect.width, g.rect.height, g.pixelWidth, g.pixelHeight);
      return p ? [{ index, parameter, x: p.xCss, y: p.yCss, distance: Math.hypot(p.xCss + g.rect.left - x, p.yCss + g.rect.top - y) }] : [];
    }).sort((a, b) => a.distance - b.distance || a.index - b.index);
    const closest = candidates[0]; if (!closest) throw new RangeError('No original parameter station is visible. Use the exact field.');
    if (candidates.some(value => Math.abs(value.index - closest.index) > 1 && Math.hypot(value.x - closest.x, value.y - closest.y) <= 0.5))
      throw new RangeError('Projected parameter stations overlap. Use the exact field.');
    const raw = splitNumber(closest.parameter); check(g); g.expected = { ...g.expected, [keyFor(g.axis)]: raw }; g.raw = raw;
    g.session.stageSurfaceSplitField(g.axis, raw); g.moved = true; check(g); render(value => value + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    try { check(g); if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(g, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    let token: string | null = null;
    try {
      stage(g, event.clientX, event.clientY); check(g); const changed = g.moved && g.raw !== g.originalRaw; finish(g);
      if (changed) { check(g, false); const proposed = g.session.prepareApply(); token = proposed?.token ?? null;
        if (!proposed || proposed.kind !== 'surface-split' || proposed.baseGeneration !== g.generation || proposed.baseDisplayGeneration !== g.displayGeneration
          || !current(g, false, proposed.token)) throw new CadEditorError('STALE', 'The split changed during preparation. Review the draft.', { field: 'surface-split' }); }
    } catch (cause) { if (token && g.session.getSnapshot().candidate?.token === token) { try { g.session.cancelCandidate(token); } catch {} } cancel(false); fail(cause); }
  }
  let data: ReturnType<typeof surfaceSplitSurface> = null; try { if (mode?.isActive()) data = surfaceSplitSurface(props.session); } catch {}
  const frame = props.receipt, canvas = props.canvas, rect = canvas?.getBoundingClientRect();
  if (!mode?.isActive() || !data || !frame || !canvas || !rect || !context(frame) || !qualified(frame, data) || data.surface.degreeU > 3 || data.surface.degreeV > 3) return null;
  const raw = mode.currentRaw().trim(), parameter = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ? Number(raw) : NaN;
  const axis = mode.currentAxis(), range = data.domain[axis];
  if (!Number.isFinite(parameter) || parameter < range[0] || parameter > range[1]) return null;
  let point: ReturnType<typeof projectCurvePole> = null, projected: ReturnType<typeof projectCurvePole>[] = [];
  try {
    point = projectCurvePole(pointAt(data, axis, parameter), frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
    const other = data.domain[axis === 'u' ? 'v' : 'u'];
    projected = Array.from({ length: 65 }, (_, index) => { const t = index === 0 ? other[0] : index === 64 ? other[1] : other[0] + (other[1] - other[0]) * index / 64;
      return projectCurvePole(evaluateSurface(data!.surface, axis === 'u' ? parameter : t, axis === 'v' ? parameter : t), frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height); });
  } catch { return null; }
  const segments: string[] = []; let segment: string[] = [];
  for (const p of projected) { if (p) segment.push(p.xCss + ',' + p.yCss); else if (segment.length) { segments.push(segment.join(' ')); segment = []; } }
  if (segment.length) segments.push(segment.join(' '));
  return <div className="surface-split-overlay"><svg className="surface-split-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    <g className="surface-split-ghost" data-testid="surface-split-ghost">{segments.map((segment, index) => <polyline key={index} className="surface-split-guide" points={segment} fill="none" />)}</g>
    {point && <g><text className="surface-split-label" x={point.xCss + 12} y={point.yCss - 10}>{axis.toUpperCase()} split</text>
      <circle className="surface-split-handle" data-testid="surface-split-handle" cx={point.xCss} cy={point.yCss} r={9} role="button" tabIndex={0}
        aria-label="Place Surface split parameter" aria-disabled={!!data.snapshot.candidate || !!data.snapshot.selectionTransition || (!gesture.current && otherCapture())}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end}
        onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
        onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Choose an original parameter station or use the exact field</title></circle></g>}
  </svg><p className="surface-split-status" role="status" data-testid="surface-split-status">65 parameter stations · Exact value in field · Escape cancels drag</p></div>;
}
