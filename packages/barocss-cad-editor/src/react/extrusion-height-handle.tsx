import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CadEditorFeatureSession, CadEditorFeatureSnapshot, CadEditorFeatureParameterDraft } from '../feature-types.js';
import { CadEditorError } from '../types.js';
import type { CadEditorFeatureDisplayReceipt } from './feature-editor.js';
import { createExtrusionHeightProjection, extrusionHeightDelta, projectExtrusionHeight,
  type ExtrusionHeightProjection } from './extrusion-height-projection.js';

interface Props {
  session: CadEditorFeatureSession;
  canvas: HTMLCanvasElement | null;
  receipt: CadEditorFeatureDisplayReceipt | null;
  isCurrentFrame: (receipt: CadEditorFeatureDisplayReceipt) => boolean;
  onError: (error: CadEditorError) => void;
  onGestureChange: (active: boolean) => void;
}
type Point = [number, number, number];
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}
const numberText = (value: number) => Object.is(value, -0) ? '-0' : String(value);
function nativeAnchor(snapshot: CadEditorFeatureSnapshot, frame: CadEditorFeatureDisplayReceipt | null) {
  if (!frame || frame.status !== 'ready' || snapshot.disposed || snapshot.candidate
    || frame.graphId !== snapshot.accepted.document.id || frame.graphRevision !== snapshot.accepted.document.revision
    || frame.displayGeneration !== snapshot.displayGeneration) return null;
  const authored = snapshot.accepted.document.features.find(value => value.id === snapshot.selectedFeatureId);
  const feature = snapshot.accepted.features.find(value => value.featureId === snapshot.selectedFeatureId);
  if (authored?.kind !== 'normal-extrusion' || authored.distance.kind !== 'offset' || feature?.kind !== 'normal-extrusion'
    || feature.evaluation.report.empty || !feature.evaluation.normal) return null;
  const display = snapshot.displays.find(value => value.selection.featureId === feature.featureId && value.selection.outputSlotId === feature.outputSlotId);
  const shown = frame.displays.find(value => value.selection.featureId === feature.featureId && value.selection.outputSlotId === feature.outputSlotId);
  const binding = snapshot.accepted.report.qualifiedBindings.find(value => value.featureId === feature.featureId && value.outputSlotId === feature.outputSlotId);
  if (!display || !shown || !binding || display.nativeMesh.mesh.indices.length === 0 || !same(binding, display.binding)
    || !same(display.binding, shown.binding) || !same(display.selection, shown.selection)
    || !same(snapshot.displays.map(value => ({ binding: value.binding, selection: value.selection })),
      frame.displays.map(value => ({ binding: value.binding, selection: value.selection })))) return null;
  const parameterId = authored.distance.parameterId;
  const parameter = snapshot.accepted.document.parameters.find(value => value.id === parameterId);
  const resolved = snapshot.accepted.parameters.find(value => value.id === parameterId);
  const vertex = feature.evaluation.vertices.find(value => value.layer === 'top');
  if (!parameter || parameter.type !== 'length' || !resolved || !vertex) return null;
  return { generation: snapshot.generation, displayGeneration: snapshot.displayGeneration,
    graphId: snapshot.accepted.document.id, revision: snapshot.accepted.document.revision,
    featureId: feature.featureId, slot: feature.outputSlotId, parameterId: parameter.id,
    definition: structuredClone(parameter.definition), evaluatedValue: resolved.valueMM,
    distance: structuredClone(authored.distance), vertex: structuredClone(vertex), normal: [...feature.evaluation.normal] as Point,
    outputs: snapshot.displays.map(value => ({ binding: value.binding, selection: value.selection })) };
}
type Anchor = NonNullable<ReturnType<typeof nativeAnchor>>;
interface Gesture {
  pointerId: number; element: SVGCircleElement; anchor: Anchor; frame: CadEditorFeatureDisplayReceipt;
  projection: ExtrusionHeightProjection; start: { xCss: number; yCss: number };
  rect: { left: number; top: number; width: number; height: number };
  pixelWidth: number; pixelHeight: number; draft: CadEditorFeatureParameterDraft | null; delta: number;
}

/** Only the pending endpoint is projected. Native Shells remain accepted until the existing frame gate. */
export function ExtrusionHeightHandle(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), pointers = useRef(new Set<number>());
  const [delta, setDelta] = useState<number | null>(null), statusId = useId();
  function fail(cause: unknown) {
    latest.current.onError(cause instanceof CadEditorError ? cause : new CadEditorError('INPUT',
      cause instanceof Error ? cause.message : 'Use the shared length field to change this height.', { field: 'extrusion-height' }, cause));
  }
  function otherCapture(own?: Gesture) {
    return [...pointers.current].some(id => [document.documentElement, ...document.querySelectorAll('*')]
      .some(element => !(own && own.pointerId === id && own.element === element) && element.hasPointerCapture(id)));
  }
  function contextCurrent(frame: CadEditorFeatureDisplayReceipt) {
    const now = latest.current, canvas = now.canvas, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !canvas.closest('[data-feature-host-busy="true"]') && now.isCurrentFrame(frame)
      && document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') === null;
  }
  function owned(current: Gesture, capture = true) {
    const now = latest.current, snapshot = now.session.getSnapshot(), frame = now.receipt, rect = now.canvas?.getBoundingClientRect();
    const expected = { parameters: current.draft ? { [current.anchor.parameterId]: current.draft } : {}, booleanOperations: {} };
    return !!frame && same(nativeAnchor(snapshot, frame), current.anchor) && same(snapshot.pending, expected)
      && contextCurrent(frame) && same(frame.camera, current.frame.camera) && same(frame.options, current.frame.options)
      && frame.width === current.pixelWidth && frame.height === current.pixelHeight
      && now.canvas?.width === current.pixelWidth && now.canvas.height === current.pixelHeight
      && !!rect && rect.left === current.rect.left && rect.top === current.rect.top
      && rect.width === current.rect.width && rect.height === current.rect.height
      && (!capture || current.element.hasPointerCapture(current.pointerId)) && !otherCapture(current);
  }
  function finish(current: Gesture) {
    gesture.current = null; setDelta(null); latest.current.onGestureChange(false);
    try { if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId); } catch {}
  }
  function cancel(restore: boolean) {
    const current = gesture.current; if (!current) return;
    const restoreOwned = restore && owned(current, false); finish(current);
    if (restoreOwned && current.draft) try { latest.current.session.discardPending(); } catch (cause) { fail(cause); }
  }
  function check(current: Gesture) {
    if (!owned(current)) throw new CadEditorError('STALE', 'The feature or view changed. Review the pending shared length.', { field: 'extrusion-height' });
  }
  useEffect(() => {
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); };
    const up = (event: PointerEvent) => { pointers.current.delete(event.pointerId); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(true); } };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true); window.addEventListener('keydown', escape, true);
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true); window.removeEventListener('keydown', escape, true); cancel(true); pointers.current.clear(); };
  }, [props.session]);
  useEffect(() => { const current = gesture.current; if (current && !owned(current)) cancel(false); });
  useEffect(() => {
    const canvas = props.canvas; if (!canvas) return;
    const observer = new ResizeObserver(() => { const current = gesture.current; if (current && !owned(current, false)) cancel(false); });
    observer.observe(canvas); return () => observer.disconnect();
  }, [props.canvas]);
  function begin(event: ReactPointerEvent<SVGCircleElement>) {
    if (!event.isPrimary || event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); event.stopPropagation();
    if (gesture.current || otherCapture()) return;
    try {
      const now = latest.current, snapshot = now.session.getSnapshot(), frame = now.receipt, canvas = now.canvas;
      const anchor = nativeAnchor(snapshot, frame);
      if (!canvas || !frame || !anchor || !contextCurrent(frame) || Object.keys(snapshot.pending.parameters).length
        || Object.keys(snapshot.pending.booleanOperations).length) return;
      const rect = canvas.getBoundingClientRect();
      const projection = createExtrusionHeightProjection({ anchorMM: anchor.vertex.pointMM, normal: anchor.normal,
        camera: frame.camera, mmToSceneUnit: frame.options.mmToSceneUnit, translate: frame.options.translate,
        cssWidth: rect.width, cssHeight: rect.height, pixelWidth: canvas.width, pixelHeight: canvas.height });
      if (!projection) return;
      gesture.current = { pointerId: event.pointerId, element: event.currentTarget, anchor, frame: structuredClone(frame), projection,
        start: { xCss: event.clientX - rect.left, yCss: event.clientY - rect.top },
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        pixelWidth: canvas.width, pixelHeight: canvas.height, draft: null, delta: 0 };
      event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true });
      now.onGestureChange(true);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function move(event: ReactPointerEvent<SVGCircleElement>) {
    const current = gesture.current; if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    try {
      check(current);
      const point = { xCss: event.clientX - current.rect.left, yCss: event.clientY - current.rect.top };
      if (!current.draft && Math.hypot(point.xCss - current.start.xCss, point.yCss - current.start.yCss) <= 3) return;
      const nextDelta = extrusionHeightDelta(current.projection, current.start, point);
      if (nextDelta === null) throw new RangeError('Use the shared length field. This view cannot map the height movement.');
      const definition = current.anchor.definition;
      const original = definition.kind === 'literal' ? definition.valueMM : definition.offsetMM;
      const raw = numberText(nextDelta === 0 ? original : original + nextDelta);
      const draft: CadEditorFeatureParameterDraft = definition.kind === 'literal' ? { kind: 'literal', rawValueMM: raw }
        : { kind: 'offset', parameterId: definition.parameterId, rawOffsetMM: raw };
      check(current); latest.current.session.stageLengthParameter(current.anchor.parameterId, draft);
      current.draft = draft; current.delta = nextDelta; check(current); setDelta(nextDelta);
    } catch (cause) { cancel(false); fail(cause); }
  }
  function end(event: ReactPointerEvent<SVGCircleElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    move(event); const current = gesture.current; if (!current) return;
    event.preventDefault(); event.stopPropagation();
    try { check(current); finish(current); if (current.draft) latest.current.session.prepareApply(); }
    catch (cause) { cancel(false); fail(cause); }
  }
  const current = gesture.current, frame = current?.frame ?? props.receipt, canvas = props.canvas;
  const anchor = current?.anchor ?? nativeAnchor(props.session.getSnapshot(), frame), bounds = canvas?.getBoundingClientRect();
  let projection = current?.projection ?? null;
  if (!projection && frame && anchor && bounds) try {
    projection = createExtrusionHeightProjection({ anchorMM: anchor.vertex.pointMM, normal: anchor.normal,
      camera: frame.camera, mmToSceneUnit: frame.options.mmToSceneUnit, translate: frame.options.translate,
      cssWidth: bounds.width, cssHeight: bounds.height, pixelWidth: frame.width, pixelHeight: frame.height });
  } catch { /* Exact shared length fields remain available when this camera cannot show a handle. */ }
  const point = projection && projectExtrusionHeight(projection), ghost = projection && delta !== null ? projectExtrusionHeight(projection, delta) : null;
  if (!point || !bounds) return null;
  const unitPoint = projection && projectExtrusionHeight(projection, 1);
  const guideLength = unitPoint ? Math.hypot(unitPoint.xCss - point.xCss, unitPoint.yCss - point.yCss) : 0;
  const guide = unitPoint && guideLength > 1e-8 ? { x: (unitPoint.xCss - point.xCss) / guideLength,
    y: (unitPoint.yCss - point.yCss) / guideLength } : null;
  const hasPending = Object.keys(props.session.getSnapshot().pending.parameters).length + Object.keys(props.session.getSnapshot().pending.booleanOperations).length > 0;
  return <div className="cad-editor-feature-height-controls">
    <svg className="feature-height-svg" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
      {guide && <g className="feature-height-guide" aria-hidden="true">
        <line x1={point.xCss + guide.x * 10} y1={point.yCss + guide.y * 10}
          x2={point.xCss + guide.x * 30} y2={point.yCss + guide.y * 30} />
        <path d={`M ${point.xCss + guide.x * 25 - guide.y * 4} ${point.yCss + guide.y * 25 + guide.x * 4}
          L ${point.xCss + guide.x * 30} ${point.yCss + guide.y * 30}
          L ${point.xCss + guide.x * 25 + guide.y * 4} ${point.yCss + guide.y * 25 - guide.x * 4}`} fill="none" />
        <text className="feature-height-label" x={point.xCss + guide.x * 34 - guide.y * 5}
          y={point.yCss + guide.y * 34 + guide.x * 5}>H</text>
      </g>}
      {ghost && <g className="feature-height-ghost" data-testid="feature-height-ghost"><line x1={point.xCss} y1={point.yCss} x2={ghost.xCss} y2={ghost.yCss} />
        <circle cx={ghost.xCss} cy={ghost.yCss} r={7} /></g>}
      <circle className="feature-height-handle" data-testid="feature-height-handle" cx={point.xCss} cy={point.yCss} r={9}
        role="button" tabIndex={0} aria-label="Extrusion height" aria-describedby={statusId} aria-disabled={!current && (hasPending || !frame || !contextCurrent(frame))}
        onPointerDown={begin} onPointerMove={move} onPointerUp={end}
        onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}
        onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) cancel(true); }}>
        <title>Drag extrusion height</title>
      </circle>
    </svg>
    <p id={statusId} className="feature-height-status" data-testid="feature-height-status" role="status">Changes this shared length and its dependent extrusions.</p>
  </div>;
}
