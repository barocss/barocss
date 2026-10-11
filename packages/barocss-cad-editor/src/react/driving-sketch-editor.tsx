import { useEffect, useId, useRef, useState } from 'react';
import { createViewer, type Viewer, type ViewerOptions, type ViewerState, type ViewerPointerControls, type ViewerKeyboardControls } from '@barocss/viewer';
import { prepareSelectedUniformCurvePreview, type SelectedUniformCurvePreview } from '@barocss/gpu';
import type { DrivenMixedSketchLinesResult, XYLinearSketchConstraintV1 } from '@barocss/cad';
import type { CadEditorDrivingSketchSession, CadEditorDrivingSketchSnapshot, CadEditorDrivingSketchCandidate,
  CadEditorDrivingSketchView, CadEditorDrivingSketchSelection, CadEditorDrivingSketchConstraintField } from '../driving-types.js';
import { CadEditorError } from '../types.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { CadEditorViewNavigator, VIEW_SIDES, type NativeViewSide } from './view-navigator.js';
import { DrivingDimensionHandles, sameDrivingData as same } from './driving-dimension-handles.js';
import { DrivingAnchorHandles } from './driving-anchor-handles.js';

type NativeProfile = DrivenMixedSketchLinesResult['target']['profiles'][number];
type NativeSegmentMapping = DrivenMixedSketchLinesResult['segmentMappings'][number];
export interface CadEditorDrivingSketchDisplayOptions { viewer: ViewerOptions; native: Parameters<Viewer['loadSelectedUniformCurvePreview']>[1] }
export interface CadEditorDrivingSketchDisplayReceipt {
  native: DrivenMixedSketchLinesResult; profile: NativeProfile; bindings: NativeSegmentMapping[]; preview: SelectedUniformCurvePreview;
  view: CadEditorDrivingSketchView; selection: CadEditorDrivingSketchSelection | null;
  generation: number; displayGeneration: number; state: ViewerState; lifecycle: { mounts: number; disposals: number };
}
export interface CadEditorDrivingSketchFrameReceipt extends CadEditorDrivingSketchDisplayReceipt {
  readIndex: number; width: number; height: number; pixelBytes: number; pixelHash: string; nonBackgroundPixels: number; backgroundRGB: [number, number, number];
}
export interface CadEditorDrivingSketchEditorProps {
  session: CadEditorDrivingSketchSession; displayOptions?: CadEditorDrivingSketchDisplayOptions;
  onError?: (error: CadEditorError) => void;
  onAccepted?: (snapshot: CadEditorDrivingSketchSnapshot, candidate: CadEditorDrivingSketchCandidate) => void;
  onDisplay?: (receipt: CadEditorDrivingSketchDisplayReceipt | null) => void;
  readRequest?: number; onFrame?: (receipt: CadEditorDrivingSketchFrameReceipt | null) => void; fitRequest?: number;
}
const DEFAULT_OPTIONS: CadEditorDrivingSketchDisplayOptions = { viewer: { mmToSceneUnit: 0.01, background: [0.07, 0.08, 0.10] }, native: { basis: 'authored-xyz-matches-rhyup' } };
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const profileLabel = (profile: NativeProfile) => ({ line: 'Line', polyline: 'Polyline', arc: 'Arc', rectangle: 'Rectangle' }[profile.kind]);
const constraintLabel = (constraint: XYLinearSketchConstraintV1) => ({ fixed: 'Fixed point', horizontal: 'Horizontal', vertical: 'Vertical', coincident: 'Coincident', 'distance-x': 'Local X distance', 'distance-y': 'Local Y distance' }[constraint.kind]);
interface Loaded { profile: NativeProfile; bindings: NativeSegmentMapping[]; preview: SelectedUniformCurvePreview; view: CadEditorDrivingSketchView }
interface Mounted {
  viewer: Viewer; options: CadEditorDrivingSketchDisplayOptions; native: DrivenMixedSketchLinesResult; loaded: Loaded;
  selection: CadEditorDrivingSketchSelection | null; generation: number; displayGeneration: number;
  admitting: boolean; optionsRefused: boolean; unavailable: boolean;
}
type AddKind = 'fixed' | 'horizontal' | 'vertical' | 'coincident';
interface AddDraft {
  owner: CadEditorDrivingSketchSession; kind: AddKind; name: string; point: string; pointA: string; pointB: string; segment: string; xMM: string; yMM: string;
  generation: number; displayGeneration: number; view: CadEditorDrivingSketchView; documentId: string; token: string | null; expectedGeneration: number | null;
  definition: XYLinearSketchConstraintV1 | null; error: CadEditorError | null;
}
function fault(message: string, field = 'driving-display', cause?: unknown) { return new CadEditorError('DISPLAY', message, { field }, cause); }
function loadedFor(native: DrivenMixedSketchLinesResult, view: CadEditorDrivingSketchView): Loaded {
  const profile = native.target.profiles.find(value => value.profileId === view.profileId);
  if (!profile || profile.affine.geometry.kind !== 'curve' || profile.affine.geometry.id !== profile.worldCurveId || profile.affine.model.objects.length !== 2)
    throw fault('The selected profile has no current complete native World Curve.');
  const preview = prepareSelectedUniformCurvePreview({ source: profile.affine.source, curveId: profile.worldCurveId, count: 65 });
  if (preview.source !== profile.affine.source || !same(preview.model, profile.affine.model)
    || !same(preview.model.objects.find(value => value.id === profile.worldCurveId), profile.affine.geometry)
    || preview.parameters.length !== 65 || preview.pointsMM.length !== 65) throw fault('The selected complete source differs from its native profile.');
  return { profile: structuredClone(profile), preview, bindings: structuredClone(native.segmentMappings.filter(value => value.profileId === view.profileId)), view: structuredClone(view) };
}
function checkState(viewer: Viewer, loaded: Loaded): ViewerState {
  const state = viewer.getState(), ref = { kind: 'curve' as const, modelId: loaded.preview.model.name, curveId: loaded.profile.worldCurveId };
  if (state.status !== 'ready' || state.native !== null || state.document !== null || state.documentBodies.length || state.assembly !== null || state.shell !== null
    || state.curveSampleVersion !== 3 || !same(state.selectedUniformCurve, loaded.preview) || state.visibleGeometry.length !== 1
    || !same(state.visibleGeometry[0], ref) || !same(state.selectedGeometry, ref)) throw fault('The actual Viewer state differs from the selected native profile.');
  return state;
}
function present(viewer: Viewer, native: DrivenMixedSketchLinesResult, view: CadEditorDrivingSketchView,
  options: CadEditorDrivingSketchDisplayOptions, camera: ViewerState['camera'] | null) {
  const loaded = loadedFor(native, view);
  viewer.loadSelectedUniformCurvePreview(loaded.preview, options.native);
  if (camera) viewer.setView(camera);
  viewer.selectGeometry({ kind: 'curve', modelId: loaded.preview.model.name, curveId: loaded.profile.worldCurveId });
  return { loaded, state: checkState(viewer, loaded) };
}
function selectionFor(native: DrivenMixedSketchLinesResult, generation: number, target: CadEditorDrivingSketchCandidate['selectionTarget']): CadEditorDrivingSketchSelection | null {
  if (!target) return null;
  const point = native.target.worldPointBindings.find(value => value.profileId === target.profileId && value.pointId === target.pointId);
  if (!point) throw new CadEditorError('STALE', 'The selected original point is no longer current.', { field: 'driving-selection' });
  return { generation, native: structuredClone(point) };
}
function details(error: Error) {
  const lines: string[] = [], seen = new Set<unknown>();
  function visit(value: unknown) { if (!(value instanceof Error) || seen.has(value)) return; seen.add(value); lines.push(value.name + ': ' + value.message);
    if (value instanceof AggregateError) value.errors.forEach(visit); visit(value.cause); }
  visit(error); return lines.join('\n');
}
function diagnostics(error: Error | null): { code: string; message: string; path: string; constraintIds: string[] }[] {
  let cause: unknown = error;
  for (let index = 0; index < 8 && cause instanceof Error; index++) {
    if ('solverDiagnostics' in cause && Array.isArray(cause.solverDiagnostics)) return structuredClone(cause.solverDiagnostics);
    cause = cause.cause;
  }
  return [];
}
function actionable(error: CadEditorError) {
  if (error.context.field === 'driving-restore') return 'Cannot restore the current view. Reopen the Sketch view.';
  if (error.code === 'DISPLAY') return 'Cannot display this change. The current view is retained.';
  if (error.code === 'STALE') return 'The sketch or pending values changed. Review the pending values.';
  if (/pending|draft/i.test(details(error))) return 'Apply or discard the pending values first.';
  const messages = diagnostics(error), detail = details(error);
  if (messages.some(value => value.code === 'CONFLICT')) return 'These constraints conflict. Change the values or remove a conflicting constraint.';
  if (/integer|fractional/i.test(detail + messages.map(value => value.message).join(' '))) return 'Use whole millimetres and a fixed integer anchor for this distance.';
  if (messages.some(value => value.code === 'DEGENERATE_GEOMETRY')) return 'Keep each segment at least 0.001 mm long.';
  if (/identity|identifier|disjoint|name/i.test(detail)) return 'Use a unique constraint name with letters, numbers, underscores or hyphens.';
  return 'The change was not applied. Review the constraint and its point or segment.';
}
function parseScalar(raw: string) {
  const value = raw.trim();
  if (raw.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))
    throw new CadEditorError('INPUT', 'Enter a finite decimal or exponent coordinate.', { field: 'driving-add' });
  return Number(value);
}
function freshName(native: DrivenMixedSketchLinesResult) {
  const names = new Set<string>();
  function collect(value: unknown) { if (typeof value === 'string') names.add(value); else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect); }
  collect(native.document);
  for (let index = 1; index <= 4096; index++) if (!names.has('ce_constraint_' + index)) return 'ce_constraint_' + index;
  throw new CadEditorError('INPUT', 'Choose a new unique constraint name.', { field: 'driving-add' });
}

/** Original authored seed and complete constraints remain authority; display pixels are verification only. */
export function CadEditorDrivingSketchEditor(props: CadEditorDrivingSketchEditorProps) {
  const { session } = props, id = useId();
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());
  useEffect(() => { const stop = session.subscribe(setSnapshot); setSnapshot(session.getSnapshot()); return stop; }, [session]);
  const latest = useRef(props); latest.current = props;
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null), mountedRef = useRef<Mounted | null>(null);
  const lifecycle = useRef({ mounts: 0, disposals: 0 }), readIndex = useRef(0), pointers = useRef(new Set<number>()), gestureRef = useRef(false);
  const composing = useRef(new Set<string>()), lastFit = useRef(props.fitRequest), addTrigger = useRef<HTMLButtonElement>(null), addCancel = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false), [captured, setCaptured] = useState(false), [gesturing, setGesturing] = useState(false);
  const [receipt, setReceipt] = useState<CadEditorDrivingSketchDisplayReceipt | null>(null), [error, setError] = useState<CadEditorError | null>(null);
  const [activeDimension, setActiveDimension] = useState<string | null>(null), [add, setAdd] = useState<AddDraft | null>(null), [addHelp, setAddHelp] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  useEffect(() => { setActiveAnchor(null); }, [session, snapshot.view.profileId]);
  const addRef = useRef(add); addRef.current = add; const [, refreshCommands] = useState(0);
  function captureFor(pointerId: number) { return [document.documentElement, ...document.querySelectorAll('*')].some(element => element.hasPointerCapture(pointerId)); }
  function hasCapture() { return [...pointers.current].some(captureFor); }
  function hostBlocked() { return gestureRef.current || hasCapture() || !!canvasRef.current?.closest('[data-driving-host-busy="true"]'); }
  function report(cause: unknown) {
    const diagnostic = cause instanceof CadEditorError ? cause : fault(cause instanceof Error ? cause.message : 'The selected profile display was refused.', 'driving-display', cause);
    setError(diagnostic); const mounted = mountedRef.current;
    if (mounted && (diagnostic.context.field === 'driving-restore' || ['unavailable', 'context-lost'].includes(mounted.viewer.getState().status))) {
      mounted.unavailable = true; setReady(false); setReceipt(null);
      try { latest.current.onDisplay?.(null); } catch {} try { latest.current.onFrame?.(null); } catch {}
    }
    try { latest.current.onError?.(diagnostic); } catch { /* Observer failures do not discard native work. */ }
  }
  function makeReceipt(mounted: Mounted): CadEditorDrivingSketchDisplayReceipt {
    if (mounted.selection && (mounted.selection.generation !== mounted.generation
      || !mounted.native.target.worldPointBindings.some(value => same(value, mounted.selection!.native))))
      throw new CadEditorError('STALE', 'The selected solved point binding is no longer current.', { field: 'driving-selection' });
    return { native: structuredClone(mounted.native), ...structuredClone(mounted.loaded), selection: structuredClone(mounted.selection),
      generation: mounted.generation, displayGeneration: mounted.displayGeneration, state: checkState(mounted.viewer, mounted.loaded), lifecycle: { ...lifecycle.current } };
  }
  function publish(value: CadEditorDrivingSketchDisplayReceipt) {
    setReceipt(structuredClone(value)); try { latest.current.onDisplay?.(structuredClone(value)); }
    catch (cause) { report(fault('Sketch display callback failed.', 'driving-display-callback', cause)); }
  }
  function aligned(mounted: Mounted) { const now = session.getSnapshot(); return !now.disposed && now.generation === mounted.generation
    && now.displayGeneration === mounted.displayGeneration && same(now.accepted, mounted.native) && same(now.view, mounted.loaded.view); }
  function visibleCanvas() {
    const canvas = canvasRef.current, rect = canvas?.getBoundingClientRect();
    return canvas?.isConnected === true && canvas.getClientRects().length > 0 && !!rect && rect.width > 0 && rect.height > 0
      && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility);
  }
  function modalCurrent() {
    const mounted = mountedRef.current;
    return !!mounted && visibleCanvas() && !mounted.admitting && !mounted.optionsRefused && !mounted.unavailable
      && aligned(mounted) && optionsCurrent(mounted) && mounted.viewer.getState().status === 'ready';
  }
  function optionsCurrent(mounted: Mounted) { return same(latest.current.displayOptions ?? DEFAULT_OPTIONS, mounted.options); }
  function commandBlocked() {
    const mounted = mountedRef.current, now = session.getSnapshot(), canvas = canvasRef.current, rect = canvas?.getBoundingClientRect();
    return hostBlocked() || !mounted || mounted.admitting || mounted.optionsRefused || mounted.unavailable || !aligned(mounted) || !optionsCurrent(mounted)
      || now.candidate !== null || Object.keys(now.pending.fields).length > 0 || !canvas?.isConnected || !rect || rect.width <= 0 || rect.height <= 0
      || viewportRef.current?.getAttribute('data-driving-ready') !== 'true' || mounted.viewer.getState().status !== 'ready'
      || document.querySelector('[role="dialog"][data-state="open"],[role="menu"]') !== null;
  }
  function isCurrentFrame(value: CadEditorDrivingSketchDisplayReceipt, ownCandidateToken?: string) {
    const mounted = mountedRef.current, now = session.getSnapshot();
    if (!mounted || mounted.admitting || mounted.optionsRefused || mounted.unavailable || !aligned(mounted) || !optionsCurrent(mounted) || now.disposed
      || (ownCandidateToken === undefined ? now.candidate !== null : now.candidate?.token !== ownCandidateToken)
      || value.generation !== now.generation || value.displayGeneration !== now.displayGeneration || !same(value.view, now.view)
      || !same(value.selection, now.selection) || !same(mounted.selection, now.selection) || viewportRef.current?.getAttribute('data-driving-ready') !== 'true') return false;
    const state = mounted.viewer.getState(); return state.status === 'ready' && same(state.camera, value.state.camera)
      && Object.is(state.mmToSceneUnit, value.state.mmToSceneUnit) && same(state.selectedUniformCurve, value.preview)
      && same(value.profile, mounted.loaded.profile) && same(value.bindings, mounted.loaded.bindings);
  }
  function action(run: () => unknown) { const now = session.getSnapshot();
    if (hostBlocked() || now.disposed || now.candidate || mountedRef.current?.admitting
      || document.querySelector('[role="dialog"][data-state="open"],[role="menu"]')) return;
    try { run(); setError(null); } catch (cause) { report(cause); } }
  function restore(mounted: Mounted, prior: { native: DrivenMixedSketchLinesResult; loaded: Loaded; selection: CadEditorDrivingSketchSelection | null; camera: ViewerState['camera'] }, cause: unknown) {
    try { const actual = present(mounted.viewer, prior.native, prior.loaded.view, mounted.options, prior.camera);
      mounted.native = prior.native; mounted.loaded = actual.loaded; mounted.selection = prior.selection; publish(makeReceipt(mounted)); }
    catch (restoreCause) { report(fault('Restoring the accepted Sketch presentation failed.', 'driving-restore', new AggregateError([cause, restoreCause]))); return false; }
    return true;
  }
  useEffect(() => {
    let live = true;
    const down = (event: PointerEvent) => { pointers.current.add(event.pointerId); setTimeout(() => { if (live) setCaptured(hasCapture()); }, 0); };
    const release = (event: PointerEvent) => { if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId);
      setTimeout(() => { if (live) { if (!captureFor(event.pointerId)) pointers.current.delete(event.pointerId); setCaptured(hasCapture()); } }, 0); };
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true); window.addEventListener('lostpointercapture', release, true);
    return () => { live = false; pointers.current.clear(); window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true); window.removeEventListener('lostpointercapture', release, true); };
  }, [session]);
  useEffect(() => {
    const canvas = canvasRef.current!; let viewer: Viewer | null = null, pointer: ViewerPointerControls | null = null, keyboard: ViewerKeyboardControls | null = null;
    let observer: ResizeObserver | null = null, published = false; setReady(false); setReceipt(null); setError(null); readIndex.current = 0;
    function publishCamera() { const mounted = mountedRef.current; if (published && mounted && !mounted.admitting && !mounted.unavailable && aligned(mounted))
      try { publish(makeReceipt(mounted)); } catch (cause) { report(cause); } }
    function resize() { const mounted = mountedRef.current, rect = canvas.getBoundingClientRect(); if (!mounted || mounted.unavailable || rect.width <= 0 || rect.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.min(4096, Math.max(1, Math.round(rect.width * ratio))), height = Math.min(4096, Math.max(1, Math.round(rect.height * ratio)));
      const scale = Math.min(1, Math.sqrt(4194304 / (width * height))), w = Math.max(1, Math.floor(width * scale)), h = Math.max(1, Math.floor(height * scale));
      if (canvas.width === w && canvas.height === h) return; try { mounted.viewer.resize(w, h); publishCamera(); } catch (cause) { report(cause); } }
    try { const now = session.getSnapshot(), options = structuredClone(latest.current.displayOptions ?? DEFAULT_OPTIONS);
      if (now.disposed) throw new CadEditorError('LIFECYCLE', 'The Driving Sketch session is disposed.', { field: 'driving-display' });
      viewer = createViewer(canvas, options.viewer); lifecycle.current.mounts++;
      const mounted: Mounted = { viewer, options, native: now.accepted, loaded: loadedFor(now.accepted, now.view), selection: structuredClone(now.selection),
        generation: now.generation, displayGeneration: now.displayGeneration, admitting: false, optionsRefused: false, unavailable: false };
      mountedRef.current = mounted; resize(); mounted.loaded = present(viewer, now.accepted, now.view, options, null).loaded;
      published = true; setReady(true); publish(makeReceipt(mounted));
      pointer = viewer.attachPointerControls({ onError: report }); keyboard = viewer.attachKeyboardControls({ onError: report });
      canvas.addEventListener('pointerup', publishCamera); canvas.addEventListener('wheel', publishCamera); canvas.addEventListener('keydown', publishCamera);
      observer = new ResizeObserver(resize); observer.observe(canvas);
    } catch (cause) { report(cause); observer?.disconnect(); pointer?.dispose(); keyboard?.dispose(); if (viewer) { viewer.dispose(); lifecycle.current.disposals++; viewer = null; } mountedRef.current = null; }
    return () => { observer?.disconnect(); canvas.removeEventListener('pointerup', publishCamera); canvas.removeEventListener('wheel', publishCamera); canvas.removeEventListener('keydown', publishCamera);
      pointer?.dispose(); keyboard?.dispose(); if (viewer) { viewer.dispose(); lifecycle.current.disposals++; } mountedRef.current = null; gestureRef.current = false;
      try { latest.current.onDisplay?.(null); } catch {} try { latest.current.onFrame?.(null); } catch {} };
  }, [session]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting || mounted.unavailable) return;
    const next = structuredClone(props.displayOptions ?? DEFAULT_OPTIONS);
    if (!same(next.viewer, mounted.options.viewer)) { mounted.optionsRefused = true; report(fault('Viewer option changes require reopening the Sketch view.', 'driving-options')); return; }
    if (same(next.native, mounted.options.native)) { if (mounted.optionsRefused) { mounted.optionsRefused = false; refreshCommands(value => value + 1); setError(value => value?.context.field === 'driving-options' ? null : value); } return; }
    const prior = { native: mounted.native, loaded: mounted.loaded, selection: structuredClone(mounted.selection), camera: mounted.viewer.getState().camera };
    mounted.admitting = true;
    try { mounted.loaded = present(mounted.viewer, mounted.native, mounted.loaded.view, next, prior.camera).loaded;
      mounted.options = next; mounted.optionsRefused = false; setError(null); publish(makeReceipt(mounted)); }
    catch (cause) { mounted.optionsRefused = true; if (restore(mounted, prior, cause)) report(cause); }
    finally { mounted.admitting = false; }
  }, [props.displayOptions, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting) return;
    const now = session.getSnapshot(), candidate = now.candidate; if (!candidate) return;
    const prior = { native: mounted.native, loaded: mounted.loaded, selection: structuredClone(mounted.selection), camera: mounted.viewer.getState().camera };
    mounted.admitting = true; let attempted = false, committed = false;
    try {
      if (!visibleCanvas() || mounted.unavailable || mounted.optionsRefused || !optionsCurrent(mounted)) throw fault('Resolve the display error before applying.');
      if (!aligned(mounted) || candidate.baseGeneration !== now.generation || candidate.baseDisplayGeneration !== now.displayGeneration)
        throw new CadEditorError('STALE', 'The prepared Sketch candidate is no longer current.', { field: 'driving-display' });
      attempted = true;
      const actual = present(mounted.viewer, candidate.result, candidate.view, mounted.options,
        candidate.kind === 'open' || candidate.view.profileId !== prior.loaded.view.profileId ? null : prior.camera);
      const current = session.getSnapshot();
      if (current.candidate?.token !== candidate.token || current.generation !== candidate.baseGeneration || current.displayGeneration !== candidate.baseDisplayGeneration)
        throw new CadEditorError('STALE', 'The prepared Sketch changed before admission.', { field: 'driving-display' });
      const accepted = session.acceptCandidate(candidate.token); committed = true;
      mounted.native = candidate.result; mounted.loaded = actual.loaded; mounted.selection = selectionFor(candidate.result, accepted.generation, candidate.selectionTarget);
      mounted.generation = accepted.generation; mounted.displayGeneration = accepted.displayGeneration;
      setError(null); publish(makeReceipt(mounted));
      const draft = addRef.current;
      if (candidate.kind === 'add' && draft?.token === candidate.token && draft.expectedGeneration === accepted.generation
        && accepted.accepted.document.constraints.some(value => same(value, draft.definition))) {
        addRef.current = null; setAdd(null); setAddHelp(false); requestAnimationFrame(() => addTrigger.current?.focus({ preventScroll: true }));
      }
      try { latest.current.onAccepted?.(structuredClone(accepted), structuredClone(candidate)); }
      catch (cause) { report(fault('Sketch acceptance callback failed.', 'driving-accepted-callback', cause)); }
    } catch (cause) { if (committed) { report(cause); return; }
      try { session.cancelCandidate(candidate.token); } catch { /* Another token may own the prepared work. */ }
      if (!attempted || restore(mounted, prior, cause)) report(cause);
      const draft = addRef.current; if (draft?.token === candidate.token) { const diagnostic = cause instanceof CadEditorError ? cause : fault('Cannot display this constraint.', 'driving-display', cause);
        const next = { ...draft, token: null, expectedGeneration: null, error: diagnostic }; addRef.current = next; setAdd(next); }
    } finally { mounted.admitting = false; }
  }, [snapshot.candidate?.token, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current, now = session.getSnapshot();
    if (!mounted || mounted.admitting || mounted.unavailable || !aligned(mounted) || now.candidate || same(mounted.selection, now.selection)) return;
    mounted.selection = structuredClone(now.selection); try { publish(makeReceipt(mounted)); } catch (cause) { report(cause); }
  }, [snapshot.selection?.native.pointId, snapshot.selection?.native.profileId, snapshot.generation, snapshot.displayGeneration, session, ready]);
  useEffect(() => {
    const mounted = mountedRef.current; if (!mounted || mounted.admitting || mounted.unavailable || !aligned(mounted) || props.readRequest === undefined) return;
    try { const value = makeReceipt(mounted), canvas = canvasRef.current!, pixels = mounted.viewer.readPixels();
      if (pixels.length !== canvas.width * canvas.height * 4) throw fault('The Sketch RGBA read is incomplete.', 'driving-pixel-read');
      const backgroundRGB = mounted.options.viewer.background.map(value => Math.round(value * 255)) as [number, number, number];
      let hash = 2166136261, nonBackgroundPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) { if ([0, 1, 2].some(channel => Math.abs(pixels[index + channel] - backgroundRGB[channel]) > 2)) nonBackgroundPixels++;
        for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0; }
      latest.current.onFrame?.(structuredClone({ ...value, readIndex: ++readIndex.current, width: canvas.width, height: canvas.height, pixelBytes: pixels.length,
        pixelHash: hash.toString(16).padStart(8, '0'), nonBackgroundPixels, backgroundRGB }));
    } catch (cause) { report(fault('Reading the current Sketch frame failed.', 'driving-pixel-read', cause)); }
  }, [props.readRequest, session, ready]);
  function cameraAction(run: (viewer: Viewer) => void) {
    if (commandBlocked()) return; const mounted = mountedRef.current!, before = mounted.viewer.getState().camera;
    const generation = mounted.generation, displayGeneration = mounted.displayGeneration;
    try { run(mounted.viewer); if (!aligned(mounted) || mounted.generation !== generation || mounted.displayGeneration !== displayGeneration || commandBlocked())
      throw new CadEditorError('STALE', 'The sketch changed before the camera was published.', { field: 'driving-camera' });
      setError(null); publish(makeReceipt(mounted)); }
    catch (cause) { try { mounted.viewer.setView(before); publish(makeReceipt(mounted)); }
      catch (restoreCause) { report(fault('Restoring the Sketch camera failed.', 'driving-restore', new AggregateError([cause, restoreCause]))); return; } report(cause); }
  }
  useEffect(() => { if (props.fitRequest === lastFit.current) return; lastFit.current = props.fitRequest; if (props.fitRequest !== undefined) cameraAction(viewer => viewer.fit()); }, [props.fitRequest, session, ready]);
  function changeView(view: NativeViewSide) { const side = VIEW_SIDES.find(value => value.side === view); if (!side) return;
    cameraAction(viewer => { const camera = viewer.getState().camera, distance = Math.hypot(...camera.eye.map((value, index) => value - camera.target[index])), length = Math.hypot(...side.direction);
      viewer.setView({ ...camera, eye: camera.target.map((value, index) => value + side.direction[index] * distance / length) as [number, number, number], up: [...side.up] }); }); }
  function openAdd() {
    const now = session.getSnapshot(); if (addRef.current || !modalCurrent() || hostBlocked() || now.disposed || now.candidate || Object.keys(now.pending.fields).length
      || document.querySelector('[role="dialog"][data-state="open"],[role="menu"]')) return;
    try {
      const points = now.accepted.solver.document.points, segments = now.accepted.segmentMappings;
      const draft: AddDraft = { owner: session, kind: 'fixed', name: freshName(now.accepted), point: points[0]?.id ?? '', pointA: points[0]?.id ?? '', pointB: points[1]?.id ?? '',
        segment: segments[0]?.solverSegmentId ?? '', xMM: text(points[0]?.position[0] ?? 0), yMM: text(points[0]?.position[1] ?? 0),
        generation: now.generation, displayGeneration: now.displayGeneration, view: structuredClone(now.view), documentId: now.accepted.document.id, token: null, expectedGeneration: null, definition: null, error: null };
      addRef.current = draft; setAdd(draft); setAddHelp(false);
    } catch (cause) { report(cause); }
  }
  function closeAdd() { if (session.getSnapshot().candidate || mountedRef.current?.admitting) return;
    addRef.current = null; setAdd(null); setAddHelp(false); }
  function updateAdd(values: Partial<AddDraft>) { const draft = addRef.current; if (!draft || draft.token || session.getSnapshot().candidate) return;
    const next = { ...draft, ...values, error: null }; addRef.current = next; setAdd(next); }
  function confirmAdd() {
    const draft = addRef.current, now = session.getSnapshot();
    if (!draft || draft.token || addHelp || !modalCurrent() || hostBlocked() || now.disposed || now.candidate || Object.keys(now.pending.fields).length) return;
    try {
      if (draft.owner !== session || draft.generation !== now.generation || draft.displayGeneration !== now.displayGeneration || !same(draft.view, now.view) || draft.documentId !== now.accepted.document.id)
        throw new CadEditorError('STALE', 'The sketch changed. Close this dialog and add the constraint again.', { field: 'driving-add' });
      const definition: XYLinearSketchConstraintV1 = draft.kind === 'fixed' ? { id: draft.name, kind: 'fixed', pointId: draft.point, target: [parseScalar(draft.xMM), parseScalar(draft.yMM)] }
        : draft.kind === 'coincident' ? { id: draft.name, kind: 'coincident', pointA: draft.pointA, pointB: draft.pointB }
        : { id: draft.name, kind: draft.kind, segmentId: draft.segment };
      const candidate = session.prepareConstraintAddition(definition), current = session.getSnapshot();
      if (!modalCurrent() || current.candidate?.token !== candidate.token || current.generation !== candidate.baseGeneration
        || current.displayGeneration !== candidate.baseDisplayGeneration || Object.keys(current.pending.fields).length)
        throw new CadEditorError('STALE', 'The prepared constraint changed. Review this proposal and the pending values.', { field: 'driving-add' });
      const next = { ...draft, token: candidate.token, expectedGeneration: candidate.baseGeneration + 1, definition, error: null };
      addRef.current = next; setAdd(next); setError(null);
    } catch (cause) {
      const diagnostic = cause instanceof CadEditorError ? cause : new CadEditorError('INPUT', 'Review the new constraint values.', { field: 'driving-add' }, cause);
      const next = { ...draft, error: diagnostic }; addRef.current = next; setAdd(next); report(diagnostic);
    }
  }
  useEffect(() => {
    if (!add) return;
    function checkVisibility() {
      const draft = addRef.current; if (!draft || (draft.owner === session && visibleCanvas())) return;
      addRef.current = null; setAdd(null); setAddHelp(false);
      if (draft.token && draft.owner.getSnapshot().candidate?.token === draft.token) try { draft.owner.cancelCandidate(draft.token); } catch { /* Disposal has already canceled it. */ }
    }
    const observer = new MutationObserver(checkVisibility), resize = new ResizeObserver(checkVisibility);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    if (canvasRef.current) resize.observe(canvasRef.current);
    window.addEventListener('hashchange', checkVisibility); window.addEventListener('popstate', checkVisibility); checkVisibility();
    return () => { observer.disconnect(); resize.disconnect(); window.removeEventListener('hashchange', checkVisibility); window.removeEventListener('popstate', checkVisibility); };
  }, [add !== null, session]);
  const pending = Object.keys(snapshot.pending.fields).length > 0, mounted = mountedRef.current;
  const busy = snapshot.disposed || !!snapshot.candidate || captured || gesturing || !ready || mounted?.admitting === true;
  const navigationBusy = busy || pending || !!add || !receipt || receipt.state.status !== 'ready' || !mounted || mounted.unavailable || mounted.optionsRefused || !aligned(mounted);
  const viewed = snapshot.accepted.target.profiles.find(value => value.profileId === snapshot.view.profileId);
  const pointBindings = snapshot.accepted.target.worldPointBindings.filter(value => value.profileId === snapshot.view.profileId);
  const editableView = snapshot.selectedScopeIds.includes(snapshot.view.profileId) && (viewed?.kind === 'line' || viewed?.kind === 'polyline');
  const dimensions = snapshot.accepted.document.constraints.filter(value => (value.kind === 'distance-x' || value.kind === 'distance-y') && value.pointB === snapshot.selection?.native.pointId);
  const handleId = dimensions.some(value => value.id === activeDimension) ? activeDimension : dimensions.length === 1 ? dimensions[0].id : null;
  function pointLabel(pointId: string) {
    for (const profile of snapshot.accepted.document.seed.profiles) if (profile.kind === 'line' || profile.kind === 'polyline') {
      const index = profile.points.findIndex(value => value.id === pointId); if (index >= 0) return (profile.kind === 'line' ? 'Line' : 'Polyline') + ' · Point ' + (index + 1);
    }
    return pointId;
  }
  function segmentLabel(segmentId: string) { const mapping = snapshot.accepted.segmentMappings.find(value => value.solverSegmentId === segmentId);
    if (!mapping) return segmentId; const profile = snapshot.accepted.target.profiles.find(value => value.profileId === mapping.profileId);
    return (profile ? profileLabel(profile) : 'Profile') + ' · Segment ' + (mapping.segmentIndex + 1); }
  function scalarField(constraint: XYLinearSketchConstraintV1, field: CadEditorDrivingSketchConstraintField, value: number, label: string) {
    const key = constraint.id + '-' + field, raw = snapshot.pending.fields[constraint.id]?.[field];
    return <div className="cad-editor-field" key={key}><Label htmlFor={id + '-' + key}>{label}</Label>
      <Input id={id + '-' + key} data-testid={'driving-' + key} inputMode="decimal" type="text" disabled={busy}
        value={raw ?? text(value)} onCompositionStart={() => { composing.current.add(key); }} onCompositionEnd={() => { composing.current.delete(key); }}
        onChange={event => action(() => session.stageConstraintField(constraint.id, field, event.target.value))}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
          if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing || composing.current.has(key) || event.keyCode === 229
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault(); event.stopPropagation(); action(() => session.prepareApply());
        }} />{raw !== undefined && <span className="cad-editor-accepted">Current: {text(value)}</span>}
    </div>;
  }
  function definitionNote(constraint: XYLinearSketchConstraintV1) {
    if (constraint.kind === 'fixed') return pointLabel(constraint.pointId);
    if ('segmentId' in constraint) return segmentLabel(constraint.segmentId);
    return pointLabel(constraint.pointA) + ' → ' + pointLabel(constraint.pointB);
  }
  const solverMessages = diagnostics(error);
  return <div className="cad-editor cad-editor-driving" onClickCapture={event => { if (hostBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDownCapture={event => { if (gestureRef.current && event.key !== 'Escape') { event.preventDefault(); event.stopPropagation(); } }}>
    <div ref={viewportRef} className="cad-editor-viewport" data-driving-ready={ready}>
      <canvas ref={canvasRef} width={640} height={480} tabIndex={0} className="cad-editor-canvas" data-testid="cad-editor-driving-canvas"
        aria-label="Selected World Curve. Drag the local distance handle in 1 mm steps."
        onPointerDownCapture={event => { if (commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
        onWheelCapture={event => { if (commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }}
        onKeyDownCapture={event => { if (event.key === 'Escape' || commandBlocked()) { event.preventDefault(); event.stopPropagation(); } }} />
      <CadEditorViewNavigator camera={ready ? receipt?.state.camera ?? null : null} disabled={navigationBusy} onChoose={changeView} />
      <DrivingDimensionHandles session={session} canvas={ready ? canvasRef.current : null} receipt={ready ? receipt : null} constraintId={activeAnchor === null ? handleId : null}
        isCurrentFrame={isCurrentFrame} onError={report} onGestureChange={active => { gestureRef.current = active; setGesturing(active); }} />
      <DrivingAnchorHandles session={session} canvas={ready ? canvasRef.current : null} receipt={ready ? receipt : null} constraintId={activeAnchor}
        isCurrentFrame={isCurrentFrame} onError={report} onGestureChange={active => { gestureRef.current = active; setGesturing(active); }} />
      {error && <p className="cad-editor-viewport-error" role="alert">{actionable(error)}</p>}
    </div>
    <aside className="cad-editor-inspector" aria-label="Driving Sketch properties">
      <div className="cad-editor-inspector-title"><h2 className="cad-editor-heading">{viewed ? profileLabel(viewed) : 'Sketch'}</h2>
        <Dialog><DialogTrigger asChild><Button variant="ghost" size="xs" type="button" data-testid="driving-help" disabled={gesturing}>Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="driving-help-dialog"><DialogHeader><DialogTitle>Driving dimensions</DialogTitle>
            <DialogDescription>Change supported constraints while keeping the original sketch intent.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body">
              <p>Dimensions use signed local X or Y millimetres on the authored workplane, from point A to point B. A distance needs a fixed integer anchor on that axis. Typed fractional distances remain subject to native refusal.</p>
              <p>The canvas handle changes one existing distance, with a directly fixed integer point A and the selected solved point B. Movement rounds its displacement to the nearest 1 mm. Release applies one change. Escape or pointer cancellation cancels only owned movement. Use the field when the view cannot show a handle.</p>
              <p>Choose Drag point on a fixed constraint to move its local X/Y target on the original workplane. The grip rounds local displacement to 1 mm. Both fields are one native command on release. The original authored seed stays unchanged. Escape discards only the gesture-owned draft; unrelated or newer input remains.</p>
              <p>Local axes come from the actual workplane; the displayed World Curve already includes that mapping. The handle does not move seed points, anchors or profiles. Pending guides are not a solved geometry preview.</p>
              <p>The original mixed seed, all profiles and the full active constraint list stay in the file. Solved target points and generated World Curves are derived. Removing a constraint deletes its definition; Undo restores it. No hidden disabled definitions are saved.</p>
              <p>DOF and rank describe only the actual selected Line and Polyline scalar scope. Arc and Rectangle previews do not expand that scope. Supported additions are fixed, horizontal, vertical and coincident constraints. Point and segment choices use actual selected-scope native IDs.</p>
              <p>The native profile admits up to 16 selected points, eight segments and 32 constraints. Distances are whole millimetres within ±10000, and segments must remain at least 0.001 mm long. This is not a general nonlinear solver, a region, a Face or a Solid certificate.</p>
              <p>One complete native local-plus-World Model is displayed with 65 uniform D0 samples. This preserves original parameters and C0 states; it is not adaptive accuracy or full-visibility certification. The display has separate source, object, identifier and scene bounds.</p>
              <p>Front/Back look from ±Z, Right/Left from ±X, Top from +Y with −Z up, Bottom from −Y with +Z up, and Iso from +XYZ. These perspective choices preserve target, distance, FOV and clipping. Camera changes do not alter native history.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Source and solver details</summary>
                <pre>{JSON.stringify({ generation: snapshot.generation, displayGeneration: snapshot.displayGeneration, view: snapshot.view, selection: snapshot.selection,
                  pending: snapshot.pending, history: snapshot.history, report: snapshot.accepted.report, diagnostics: solverMessages,
                  definitions: snapshot.accepted.document.constraints, source: receipt?.preview.source, model: receipt?.preview.model }, null, 2)}</pre>
                {error && <pre>{error.code + '\n' + details(error)}</pre>}
              </details>
            </div><DialogClose asChild><Button type="button" variant="outline" className="cad-editor-export-close" data-testid="driving-help-close">Close help</Button></DialogClose>
          </DialogContent></Dialog>
      </div>
      <p className="cad-editor-properties-note">Selected scope · <span data-testid="driving-dof">{snapshot.accepted.report.selectedDegreesOfFreedom}</span> DOF · Rank <span data-testid="driving-rank">{snapshot.accepted.report.selectedRank}</span></p>
      <div className="cad-editor-field"><Label htmlFor={id + '-profile'}>Profile</Label><select id={id + '-profile'} data-testid="driving-profile" value={snapshot.view.profileId} disabled={busy || pending}
        onChange={event => action(() => { if (!Object.keys(session.getSnapshot().pending.fields).length) session.prepareView(event.target.value); })}>{snapshot.accepted.target.profiles.map((profile, index) => <option value={profile.profileId} key={profile.profileId}>{profileLabel(profile)} {index + 1}</option>)}</select></div>
      {!editableView ? <p>This profile is a read-only preview. Constraints use the selected Line and Polyline scope.</p> : <>
        <div className="cad-editor-field"><Label htmlFor={id + '-point'}>Point</Label><select id={id + '-point'} data-testid="driving-point" value={snapshot.selection?.native.pointId ?? ''} disabled={busy || pending}
          onChange={event => action(() => { const binding = pointBindings.find(value => value.pointId === event.target.value);
            if (binding) { setActiveAnchor(null); session.selectPoint(snapshot.view.profileId, binding.pointId, { generation: snapshot.generation, native: binding }); } })}>
          <option value="" disabled>Select a point</option>{pointBindings.map((point, index) => <option value={point.pointId} key={point.pointId}>Point {index + 1}</option>)}</select></div>
        {dimensions.length > 0 && <div className="cad-editor-field"><Label htmlFor={id + '-dimension'}>Canvas dimension</Label><select id={id + '-dimension'} data-testid="driving-dimension" value={handleId ?? ''} disabled={busy || pending}
          onChange={event => action(() => { if (!Object.keys(session.getSnapshot().pending.fields).length) { setActiveAnchor(null); setActiveDimension(event.target.value); } })}>
          <option value="" disabled>Choose a dimension</option>{dimensions.map((dimension, index) => <option value={dimension.id} key={dimension.id}>{constraintLabel(dimension)} {index + 1}</option>)}</select></div>}
      </>}
      <div className="cad-editor-actions"><Button type="button" data-testid="driving-apply" disabled={busy || !pending} onClick={() => action(() => session.prepareApply())}>Apply</Button>
        <Button type="button" variant="outline" data-testid="driving-discard" disabled={busy || !pending} onClick={() => action(() => session.discardPending())}>Discard</Button></div>
      <div className="driving-constraints-heading"><h3>Constraints</h3><Button ref={addTrigger} type="button" size="xs" variant="outline" data-testid="driving-add" disabled={busy || pending} onClick={openAdd}>Add</Button></div>
      <div className="driving-constraints-list">{snapshot.accepted.document.constraints.map(constraint => <section className="driving-constraint-row" key={constraint.id} data-testid={'driving-constraint-' + constraint.id}>
        <div className="driving-constraint-title"><strong>{constraintLabel(constraint)}</strong><Button type="button" variant="ghost" size="xs" data-testid={'driving-remove-' + constraint.id} disabled={busy || pending}
          onClick={() => action(() => session.prepareConstraintRemoval(constraint.id))}>Remove</Button></div>
        <p className="cad-editor-properties-note">{definitionNote(constraint)}</p>
        {constraint.kind === 'fixed' && <Button type="button" size="xs" variant="outline" className="driving-anchor-choose" data-testid={'driving-anchor-' + constraint.id}
          aria-pressed={activeAnchor === constraint.id && snapshot.selection?.native.pointId === constraint.pointId}
          disabled={busy || pending || !editableView || !pointBindings.some(point => point.pointId === constraint.pointId)}
          onClick={() => action(() => {
            const now = session.getSnapshot(), binding = now.accepted.target.worldPointBindings.find(point => point.profileId === now.view.profileId && point.pointId === constraint.pointId);
            if (!binding || now.candidate || Object.keys(now.pending.fields).length) return;
            session.selectPoint(now.view.profileId, binding.pointId, { generation: now.generation, native: binding });
            const after = session.getSnapshot();
            if (after.selection?.native.pointId !== binding.pointId || after.generation !== now.generation || after.candidate || Object.keys(after.pending.fields).length)
              throw fault('The fixed point changed during selection. Review the values.', 'driving-anchor');
            setActiveAnchor(constraint.id);
          })}>Drag point</Button>}
        {(constraint.kind === 'distance-x' || constraint.kind === 'distance-y') && scalarField(constraint, 'distanceMM', constraint.distanceMM, 'Distance (mm)')}
        {constraint.kind === 'fixed' && <div className="driving-fixed-fields">{scalarField(constraint, 'xMM', constraint.target[0], 'X (mm)')}{scalarField(constraint, 'yMM', constraint.target[1], 'Y (mm)')}</div>}
      </section>)}</div>
    </aside>
    <Dialog open={add !== null} onOpenChange={open => { if (!open) closeAdd(); }}>
      <DialogContent className="cad-editor-help-dialog driving-add-dialog" data-testid="driving-add-dialog" showCloseButton={false}
        onOpenAutoFocus={event => { event.preventDefault(); addCancel.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); addTrigger.current?.focus({ preventScroll: true }); }}>
        <DialogHeader><DialogTitle>Add constraint</DialogTitle><DialogDescription>Choose an existing point or segment.</DialogDescription></DialogHeader>
        <div className="cad-editor-help-body">
          <div className="cad-editor-field"><Label htmlFor={id + '-add-name'}>Constraint name</Label><Input id={id + '-add-name'} data-testid="driving-add-id" type="text" value={add?.name ?? ''} disabled={busy}
            onChange={event => updateAdd({ name: event.target.value })} /></div>
          <div className="cad-editor-field"><Label htmlFor={id + '-add-kind'}>Type</Label><select id={id + '-add-kind'} data-testid="driving-add-kind" value={add?.kind ?? 'fixed'} disabled={busy}
            onChange={event => updateAdd({ kind: event.target.value as AddKind })}><option value="fixed">Fixed point</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="coincident">Coincident points</option></select></div>
          {add?.kind === 'fixed' ? <>
            <div className="cad-editor-field"><Label htmlFor={id + '-add-point'}>Point</Label><select id={id + '-add-point'} data-testid="driving-add-point" value={add.point} disabled={busy} onChange={event => updateAdd({ point: event.target.value })}>
              {snapshot.accepted.solver.document.points.map(point => <option value={point.id} key={point.id}>{pointLabel(point.id)}</option>)}</select></div>
            {(['xMM', 'yMM'] as const).map(field => <div className="cad-editor-field" key={field}><Label htmlFor={id + '-add-' + field}>{field[0].toUpperCase()} (mm)</Label>
              <Input id={id + '-add-' + field} data-testid={'driving-add-' + field} type="text" inputMode="decimal" value={add[field]} disabled={busy}
                onChange={event => updateAdd({ [field]: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); } }} /></div>)}
          </> : add?.kind === 'coincident' ? <>
            {(['pointA', 'pointB'] as const).map((field, index) => <div className="cad-editor-field" key={field}><Label htmlFor={id + '-add-' + field}>Point {index === 0 ? 'A' : 'B'}</Label>
              <select id={id + '-add-' + field} data-testid={'driving-add-point-' + (index === 0 ? 'a' : 'b')} value={add[field]} disabled={busy} onChange={event => updateAdd({ [field]: event.target.value })}>
                {snapshot.accepted.solver.document.points.map(point => <option value={point.id} key={point.id}>{pointLabel(point.id)}</option>)}</select></div>)}
          </> : <div className="cad-editor-field"><Label htmlFor={id + '-add-segment'}>Segment</Label><select id={id + '-add-segment'} data-testid="driving-add-segment" value={add?.segment ?? ''} disabled={busy}
            onChange={event => updateAdd({ segment: event.target.value })}>{snapshot.accepted.segmentMappings.map(mapping => <option value={mapping.solverSegmentId} key={mapping.solverSegmentId}>{segmentLabel(mapping.solverSegmentId)}</option>)}</select></div>}
          {add?.error && <p role="alert" data-testid="driving-add-error">{actionable(add.error)}</p>}
        </div>
        <div className="driving-add-actions"><Dialog open={addHelp} onOpenChange={setAddHelp}><DialogTrigger asChild><Button type="button" variant="ghost" data-testid="driving-add-help" disabled={!!snapshot.candidate}>Help</Button></DialogTrigger>
          <DialogContent className="cad-editor-help-dialog" data-testid="driving-add-help-dialog"><DialogHeader><DialogTitle>Adding a constraint</DialogTitle><DialogDescription>Use the selected native point and segment scope.</DialogDescription></DialogHeader>
            <div className="cad-editor-help-body"><p>Fixed point supplies local X/Y targets. Horizontal and vertical use an existing solver segment. Coincident connects two distinct selected points. Native validation rejects conflicting, invalid or degenerate combinations.</p>
              <p>Names must be unique bounded native identifiers. The actual request contains its type and selected native IDs; no hidden enabled flag is stored. Distance creation is outside this dialog; existing signed distances can be edited or removed.</p>
              <p>Add is explicit. Typing, Tab and composing Enter do not commit. A failed native or display check keeps your name, choices and values for repair. Cancel closes this proposal; accepted constraints and the original seed remain unchanged until actual presentation and acceptance.</p>
              <details className="cad-editor-source"><summary className="cad-editor-source-title">Request and native details</summary><pre>{JSON.stringify({ name: add?.name, kind: add?.kind, point: add?.point,
                pointA: add?.pointA, pointB: add?.pointB, segment: add?.segment, xMM: add?.xMM, yMM: add?.yMM, definition: add?.definition,
                diagnostics: diagnostics(add?.error ?? null) }, null, 2)}</pre>{add?.error && <pre>{details(add.error)}</pre>}</details>
            </div><DialogClose asChild><Button type="button" className="cad-editor-export-close" variant="outline" data-testid="driving-add-help-close">Close help</Button></DialogClose>
          </DialogContent></Dialog><Button ref={addCancel} type="button" variant="outline" data-testid="driving-add-cancel" disabled={!!snapshot.candidate} onClick={closeAdd}>Cancel</Button>
          <Button type="button" data-testid="driving-add-confirm" disabled={busy} onClick={confirmAdd}>Add constraint</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
