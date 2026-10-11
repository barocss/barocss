import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createCadGeometryReference, evaluateSurface, surfaceDomain, type CadGeometryReferenceV0, type Surface } from '@barocss/cad';
import { CadEditorError, type CadEditorSession, type CadEditorSnapshot } from '../types.js';
import type { CadEditorDisplayReceipt } from './types.js';
import { projectCurvePole } from './curve-pole-projection.js';
import { useSurfaceIsoCurve } from './surface-isocurve.js';

interface Props {
  session: CadEditorSession; canvas: HTMLCanvasElement | null; receipt: CadEditorDisplayReceipt | null;
  isCurrentSurface: (receipt?: CadEditorDisplayReceipt) => boolean; onError: (error: CadEditorError) => void; onGestureChange: (active: boolean) => void;
}
interface Gesture {
  session: CadEditorSession; pointerId: number; element: SVGCircleElement; axis: 'u' | 'v';
  reference: CadGeometryReferenceV0; surface: Surface; source: string; domain: ReturnType<typeof surfaceDomain>;
  generation: number; displayGeneration: number; selection: unknown; frame: CadEditorDisplayReceipt;
  rect: { left: number; top: number; width: number; height: number }; pixelWidth: number; pixelHeight: number;
  startX: number; startY: number; originalRaw: string | undefined; raw: string | undefined;
  expected: CadEditorSnapshot['pending']; moved: boolean;
}
const textNumber = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const keyFor = (axis: 'u' | 'v') => axis === 'u' ? 'surfaceIsoU' : 'surfaceIsoV';
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Reflect.ownKeys(a), other = Reflect.ownKeys(b);
  return Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && keys.length === other.length
    && keys.every(key => other.includes(key) && same(Reflect.get(a, key), Reflect.get(b, key)));
}
function selectedSurface(session: CadEditorSession) {
  const snapshot = session.getSnapshot();
  if (snapshot.disposed || snapshot.view.kind !== 'document' || snapshot.editTarget !== 'pole' || !snapshot.selectedBodyId) return null;
  const resolved = createCadGeometryReference(snapshot.accepted, { bodyId: snapshot.selectedBodyId });
  return resolved.geometry.kind === 'surface' ? { snapshot, reference: resolved.reference, source: resolved.source,
    surface: resolved.geometry, domain: surfaceDomain(resolved.geometry) } : null;
}
function currentFrame(frame: CadEditorDisplayReceipt, data: NonNullable<ReturnType<typeof selectedSurface>>) {
  const displayed = frame.state.documentBodies.find(body => body.binding.bodyId === data.reference.bodyId);
  const asset = data.snapshot.accepted.document.assets.find(asset => asset.id === data.reference.assetId);
  const compiled = data.snapshot.accepted.compiledAssets.find(asset => asset.assetId === data.reference.assetId);
  return !!displayed && !!asset && !!compiled && frame.state.status === 'ready' && same(frame.state.document, data.snapshot.accepted)
    && asset.source === data.source && compiled.source === data.source
    && same(displayed.binding, { documentId: data.reference.documentId, documentRevision: data.reference.documentRevision,
      nativeFrame: data.snapshot.accepted.document.nativeFrame, bodyId: data.reference.bodyId, assetId: data.reference.assetId,
      assetRevision: data.reference.assetRevision, sourceFrame: data.reference.sourceFrame, modelId: compiled.model.name,
      geometryKind: 'surface', geometryId: data.surface.id })
    && displayed.ref.kind === 'surface' && displayed.ref.surfaceId === data.surface.id
    && same(frame.state.selectedGeometry, displayed.ref) && frame.state.visibleGeometry.some(ref => same(ref, displayed.ref));
}
function stations(surface: Surface, axis: 'u' | 'v', domain: ReturnType<typeof surfaceDomain>) {
  const range = domain[axis], knots = axis === 'u' ? surface.knotsU : surface.knotsV;
  return Array.from({ length: 65 }, (_, index) => {
    const value = index === 0 ? range[0] : index === 64 ? range[1] : range[0] + (range[1] - range[0]) * index / 64;
    return value === 0 ? knots.find(knot => knot === 0) ?? value : value;
  });
}
function at(surface: Surface, domain: ReturnType<typeof surfaceDomain>, axis: 'u' | 'v', parameter: number) {
  const other = domain[axis === 'u' ? 'v' : 'u'], middle = other[0] + (other[1] - other[0]) / 2;
  return evaluateSurface(surface, axis === 'u' ? parameter : middle, axis === 'v' ? parameter : middle);
}

/** A sampled parameter placement guide over the original Surface, never a coefficient or topology pick. */
export function SurfaceIsoCurveHandles(props: Props) {
  const mode = useSurfaceIsoCurve(), latest = useRef(props), modeRef = useRef(mode);
  latest.current = props; modeRef.current = mode;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>()), composing = useRef(false), [, render] = useState(0);
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Use the exact parameter field.', { field: 'surface-isocurve' }, cause));
  }
  function captured(id: number, own?: Gesture) {
    return [document.documentElement, ...document.querySelectorAll('*')].some(element =>
      !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id));
  }
  function otherCapture(own?: Gesture) { return [...pointers.current].some(id => captured(id, own)); }
  function context(frame = latest.current.receipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility)
      && !canvas.closest('[data-panel-resizing="true"],[data-direct-host-busy="true"]')
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null && !!frame && now.isCurrentSurface(frame);
  }
  function current(g: Gesture, capture = true, candidateToken?: string) {
    const now = latest.current, frame = now.receipt, rect = now.canvas?.getBoundingClientRect(), mode = modeRef.current;
    let data: ReturnType<typeof selectedSurface> = null; try { data = selectedSurface(now.session); } catch {}
    return now.session === g.session && !!data && !!frame && !!rect && mode?.isActive() === true && mode.currentAxis() === g.axis
      && data.reference.bodyId === g.reference.bodyId
      && (candidateToken === undefined ? !data.snapshot.candidate : data.snapshot.candidate?.token === candidateToken)
      && !data.snapshot.selectionTransition
      && data.snapshot.generation === g.generation && data.snapshot.displayGeneration === g.displayGeneration
      && same(data.reference, g.reference) && same(data.surface, g.surface) && data.source === g.source && same(data.domain, g.domain)
      && same({ surface: data.snapshot.selection, curve: data.snapshot.curveSelection }, g.selection)
      && same(data.snapshot.pending, g.expected) && !composing.current && context(frame) && currentFrame(frame, data)
      && same(frame.state.camera, g.frame.state.camera) && Object.is(frame.state.mmToSceneUnit, g.frame.state.mmToSceneUnit)
      && now.canvas?.width === g.pixelWidth && now.canvas.height === g.pixelHeight
      && rect.left === g.rect.left && rect.top === g.rect.top && rect.width === g.rect.width && rect.height === g.rect.height
      && frame.state.documentBodies.some(body => body.binding.bodyId === g.reference.bodyId && body.ref.kind === 'surface')
      && (!capture || g.element.hasPointerCapture(g.pointerId)) && !otherCapture(g);
  }
  function finish(g: Gesture) {
    gesture.current = null; modeRef.current?.onGestureChange(false); latest.current.onGestureChange(false); render(value => value + 1);
    try { if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const g = gesture.current; if (!g) return;
    const own = restore && current(g, false); finish(g);
    if (own && current(g, false) && g.raw !== g.originalRaw) try { g.session.stageSurfaceIsoCurveField(g.axis, g.originalRaw ?? ''); } catch (cause) { fail(cause); }
  }
  function check(g: Gesture, capture = true) {
    if (!current(g, capture)) throw new CadEditorError('STALE', 'The Surface, view or pending parameter changed. Review the values.', { field: 'surface-isocurve' });
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const release = (event: PointerEvent) => {
      if (!captured(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live && !captured(event.pointerId)) pointers.current.delete(event.pointerId); }, 0);
    };
    const startComposition = () => { cancel(true); composing.current = true; };
    const endComposition = () => { composing.current = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true); window.addEventListener('keydown', escape, true);
    window.addEventListener('compositionstart', startComposition, true); window.addEventListener('compositionend', endComposition, true);
    return () => {
      live = false; window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true);
      window.removeEventListener('keydown', escape, true); window.removeEventListener('compositionstart', startComposition, true);
      window.removeEventListener('compositionend', endComposition, true); cancel(true); composing.current = false; pointers.current.clear();
    };
  }, [props.session]);
  useEffect(() => { const g = gesture.current; if (g && !current(g)) cancel(false); });
  useEffect(() => {
    if (!props.canvas) return;
    const observer = new ResizeObserver(() => { const g = gesture.current; if (g && !current(g, false)) cancel(false); });
    observer.observe(props.canvas); return () => observer.disconnect();
  }, [props.canvas]);
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); if (gesture.current || composing.current || otherCapture() || !mode?.isActive() || mode.currentAxis() !== mode.axis) return;
    try {
      const now = latest.current, frame = now.receipt, canvas = now.canvas, data = selectedSurface(now.session);
      if (!data || !frame || !canvas || !context(frame) || !currentFrame(frame, data) || data.snapshot.candidate || data.snapshot.selectionTransition
        || Object.keys(data.snapshot.pending).some(key => key !== keyFor(mode.axis))
        || !frame.state.documentBodies.some(body => body.binding.bodyId === data.reference.bodyId && body.ref.kind === 'surface')) return;
      const rect = canvas.getBoundingClientRect(), raw = data.snapshot.pending[keyFor(mode.axis)];
      gesture.current = { session: now.session, pointerId: event.pointerId, element: event.currentTarget, axis: mode.axis,
        reference: structuredClone(data.reference), surface: structuredClone(data.surface), source: data.source, domain: structuredClone(data.domain),
        generation: data.snapshot.generation, displayGeneration: data.snapshot.displayGeneration,
        selection: structuredClone({ surface: data.snapshot.selection, curve: data.snapshot.curveSelection }), frame: structuredClone(frame),
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, pixelWidth: canvas.width, pixelHeight: canvas.height,
        startX: event.clientX, startY: event.clientY, originalRaw: raw, raw, expected: structuredClone(data.snapshot.pending), moved: false };
      mode.onGestureChange(true); now.onGestureChange(true); event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true }); render(value => value + 1);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function stage(g: Gesture, x: number, y: number) {
    check(g); if (!g.moved && Math.hypot(x - g.startX, y - g.startY) <= 3) return;
    const candidates = stations(g.surface, g.axis, g.domain).flatMap((parameter, index) => {
      const p = projectCurvePole(at(g.surface, g.domain, g.axis, parameter), g.frame.state.camera, g.frame.state.mmToSceneUnit,
        g.rect.width, g.rect.height, g.pixelWidth, g.pixelHeight);
      return p ? [{ index, parameter, xCss: p.xCss, yCss: p.yCss, distance: Math.hypot(p.xCss + g.rect.left - x, p.yCss + g.rect.top - y) }] : [];
    }).sort((a, b) => a.distance - b.distance || a.index - b.index);
    const closest = candidates[0]; if (!closest) throw new RangeError('No original parameter station is visible. Use the exact field.');
    if (candidates.some(value => Math.abs(value.index - closest.index) > 1 && Math.hypot(value.xCss - closest.xCss, value.yCss - closest.yCss) <= 0.5))
      throw new RangeError('Projected parameters overlap. Use the exact parameter field.');
    const raw = textNumber(closest.parameter); check(g); g.expected = { ...g.expected, [keyFor(g.axis)]: raw }; g.raw = raw;
    g.session.stageSurfaceIsoCurveField(g.axis, raw); g.moved = true; check(g); render(value => value + 1);
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    try { check(g); if (!event.isPrimary || event.buttons !== 1 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
      stage(g, event.clientX, event.clientY); } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return; event.preventDefault(); event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) { cancel(true); return; }
    try { stage(g, event.clientX, event.clientY); check(g); const changed = g.moved && g.raw !== g.originalRaw; finish(g);
      if (changed) {
        check(g, false); const proposed = g.session.prepareApply();
        if (!proposed || !current(g, false, proposed.token)) {
          if (proposed && g.session.getSnapshot().candidate?.token === proposed.token) g.session.cancelCandidate(proposed.token);
          throw new CadEditorError('STALE', 'Curve creation changed during preparation. Review the draft.', { field: 'surface-isocurve' });
        }
      } } catch (cause) { cancel(false); fail(cause); }
  }
  let data: ReturnType<typeof selectedSurface> = null; try { if (mode?.isActive()) data = selectedSurface(props.session); } catch {}
  const frame = props.receipt, canvas = props.canvas, rect = canvas?.getBoundingClientRect();
  if (!mode?.isActive() || !data || !frame || !canvas || !rect || !context(frame) || !currentFrame(frame, data)
    || data.surface.degreeU > 3 || data.surface.degreeV > 3 || data.surface.controlPoints.some(row => row.some(point => point.some(value => Math.abs(value) > 10000)))) return null;
  const raw = mode.raw.trim(), parameter = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ? Number(raw) : NaN;
  const range = data.domain[mode.axis]; if (!Number.isFinite(parameter) || parameter < range[0] || parameter > range[1]) return null;
  let point: ReturnType<typeof projectCurvePole> = null;
  try { point = projectCurvePole(at(data.surface, data.domain, mode.axis, parameter), frame.state.camera, frame.state.mmToSceneUnit,
    rect.width, rect.height, canvas.width, canvas.height); } catch { return null; }
  const other = data.domain[mode.axis === 'u' ? 'v' : 'u'];
  let projected: ReturnType<typeof projectCurvePole>[] = [];
  try { projected = Array.from({ length: 65 }, (_, index) => {
    const t = index === 0 ? other[0] : index === 64 ? other[1] : other[0] + (other[1] - other[0]) * index / 64;
    const p = evaluateSurface(data!.surface, mode.axis === 'u' ? parameter : t, mode.axis === 'v' ? parameter : t);
    return projectCurvePole(p, frame.state.camera, frame.state.mmToSceneUnit, rect.width, rect.height, canvas.width, canvas.height);
  }); } catch { return null; }
  const segments: string[] = []; let line: string[] = [];
  for (const p of projected) { if (p) line.push(p.xCss + ',' + p.yCss); else if (line.length) { segments.push(line.join(' ')); line = []; } }
  if (line.length) segments.push(line.join(' '));
  return <div className="surface-isocurve-overlay"><svg className="surface-isocurve-svg" width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
    <g className="surface-isocurve-ghost" data-testid="surface-isocurve-ghost">{segments.map((segment, index) => <polyline key={index} points={segment} fill="none" />)}</g>
    {point && <g><text className="surface-isocurve-label" x={point.xCss + 12} y={point.yCss - 12}>{mode.axis.toUpperCase()} iso-Curve</text>
      <circle className="surface-isocurve-handle" data-testid="surface-isocurve-handle" cx={point.xCss} cy={point.yCss} r={9}
        role="button" tabIndex={0} aria-label={'Place Surface ' + mode.axis.toUpperCase() + ' iso-Curve'}
        aria-disabled={!!data.snapshot.candidate || !!data.snapshot.selectionTransition || (!gesture.current && otherCapture())}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end}
        onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
        onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}><title>Choose a sampled original parameter</title></circle></g>}
  </svg><p className="surface-isocurve-status" role="status" data-testid="surface-isocurve-status">65 parameter stations · Type for exact values · Escape cancels drag</p></div>;
}
