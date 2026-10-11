import {useEffect, useMemo, useRef, useState} from 'react';
import {normalizeRenderEditorError, type RenderEditorError} from './errors.js';
import type {RenderSceneGizmoMode, RenderSceneGizmoKey, RenderSceneGizmoViewport, RenderSceneGizmoPreparation, RenderSceneGizmoHandle} from './gizmo-projection-common.js';

type Point = readonly [number, number];
type Box = RenderSceneGizmoViewport & {left: number; top: number};
export type GizmoSurfaceActionResult = {readonly ok: true} | {readonly ok: false; readonly error: RenderEditorError};
export interface GizmoSurfaceAdapter<C> {
  prepare(viewport: RenderSceneGizmoViewport): RenderSceneGizmoPreparation;
  hitTest(preparation: RenderSceneGizmoPreparation, point: Point): RenderSceneGizmoHandle | null;
  capture(key: RenderSceneGizmoKey, from: Point, viewport: RenderSceneGizmoViewport): C | null;
  isCurrent(capture: C): boolean;
  preview(capture: C, to: Point): GizmoSurfaceActionResult;
  finish(capture: C): GizmoSurfaceActionResult;
  cancel(capture: C): GizmoSurfaceActionResult;
  subscribe(listener: () => void): () => void;
}
export interface GizmoSurfaceProps<C> {
  canvas: HTMLCanvasElement | null; mode: RenderSceneGizmoMode; adapter: GizmoSurfaceAdapter<C>;
  disabled?: boolean; pending?: boolean; onModeChange?: (mode: RenderSceneGizmoMode) => void;
  onGestureChange?: (active: boolean) => void; onError?: (error: RenderEditorError) => void; onHelp?: () => void;
  onCancelPending?: () => GizmoSurfaceActionResult; showModeButtons?: boolean; scaleLabel?: string; profileNotice?: string; helpText?: string;
  viewportShortcuts?: boolean; onFrame?: () => void; onFrameAll?: () => void; pivotLabel?: string;
}
const viewportOf = (box: Box): RenderSceneGizmoViewport => ({width: box.width, height: box.height, backingWidth: box.backingWidth, backingHeight: box.backingHeight});
const sameBox = (a: Box, b: Box) => (['width', 'height', 'backingWidth', 'backingHeight', 'left', 'top'] as const).every(key => a[key] === b[key]);
const measure = (canvas: HTMLCanvasElement): Box => {const rect = canvas.getBoundingClientRect(); return {left: rect.left, top: rect.top, width: rect.width, height: rect.height, backingWidth: canvas.width, backingHeight: canvas.height};};
const arrowPoints = (points: readonly Point[], anchor: Point) => {const prior = points[Math.max(0, points.length - 2)] ?? anchor, dx = anchor[0] - prior[0], dy = anchor[1] - prior[1], length = Math.hypot(dx, dy) || 1, x = dx / length, y = dy / length; return [[anchor[0] + 4 * x, anchor[1] + 4 * y], [anchor[0] - 7 * x + 4 * y, anchor[1] - 7 * y - 4 * x], [anchor[0] - 7 * x - 4 * y, anchor[1] - 7 * y + 4 * x]].map(p => p.join(',')).join(' ');};

/** Shared projected handles and capture arbitration. The adapter owns authored units and transactions. */
export function GizmoSurface<C>({canvas, mode, adapter, disabled = false, pending = false, onModeChange, onGestureChange, onError, onHelp, onCancelPending, showModeButtons = true, scaleLabel = 'Scale', profileNotice = '', helpText = '', viewportShortcuts = false, onFrame, onFrameAll, pivotLabel = ''}: GizmoSurfaceProps<C>) {
  const [box, setBox] = useState<Box | null>(null), [revision, setRevision] = useState(0);
  const [active, setActive] = useState<string | null>(null), [notice, setNotice] = useState(''), [localHelp, setLocalHelp] = useState(false), [hovered, setHovered] = useState<string | null>(null), [focused, setFocused] = useState<string | null>(null), [capturedKey, setCapturedKey] = useState<RenderSceneGizmoKey | null>(null), [retained, setRetained] = useState(false);
  const svg = useRef<SVGSVGElement>(null), help = useRef<HTMLButtonElement>(null), retry = useRef<C | null>(null);
  const latest = useRef({disabled, pending, mode, adapter, localHelp, active, retained, viewportShortcuts, onFrame, onFrameAll, onModeChange, onError, onHelp, onGestureChange, onCancelPending}); latest.current = {disabled, pending, mode, adapter, localHelp, active, retained, viewportShortcuts, onFrame, onFrameAll, onModeChange, onError, onHelp, onGestureChange, onCancelPending};
  const chooseMode = (value: RenderSceneGizmoMode) => {latest.current.onModeChange?.(value); setHovered(null); setFocused(null); setNotice('');};
  const cancelGesture = useRef<(() => void) | null>(null);
  const subscriptionRevision = useRef(0);
  useEffect(() => {
    if (retry.current !== null && !pending && !adapter.isCurrent(retry.current)) {retry.current = null; setRetained(false);}
  }, [adapter, pending, revision, retained]);
  useEffect(() => {if (!canvas) return; const update = () => setBox(measure(canvas)), observer = new ResizeObserver(update); observer.observe(canvas); update(); return () => observer.disconnect();}, [canvas]);
  useEffect(() => {setHovered(null); setFocused(null);}, [mode]);
  const preparation = useMemo(() => {
    if (!box) return {pivot: [0, 0] as Point, handles: [], unavailable: null};
    try {return adapter.prepare(viewportOf(box));} catch {return {pivot: [0, 0] as Point, handles: [], unavailable: 'Handles are unavailable for this view. Use the object fields.'};}
  }, [adapter, box, revision, mode, disabled, pending]);
  const rendered = useRef({box, preparation, revision}); rendered.current = {box, preparation, revision};
  const report = (cause: unknown) => {const error = normalizeRenderEditorError(cause); if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true}); setNotice('The transform was refused. Check the object fields or camera.'); latest.current.onError?.(error);};
  useEffect(() => {
    if (!canvas || !svg.current) return;
    const element = svg.current, surface = canvas.parentElement!;
    type Gesture = {token: C; key: RenderSceneGizmoKey; box: Box; from: Point; to: Point; pointer: number; moved: boolean};
    let gesture: Gesture | null = null, frame: number | null = null, presenting = false;
    const current = (g: Gesture) => latest.current.adapter.isCurrent(g.token);
    const valid = (g: Gesture) => current(g) && !latest.current.disabled && sameBox(measure(canvas), g.box);
    const retain = (token: C) => {retry.current = token; setRetained(true);};
    const clearRetry = () => {retry.current = null; setRetained(false);};
    const release = () => {if (frame !== null) {cancelAnimationFrame(frame); frame = null;} const old = gesture; gesture = null; if (old && element.hasPointerCapture(old.pointer)) element.releasePointerCapture(old.pointer); setActive(null); setCapturedKey(null); setHovered(null); latest.current.onGestureChange?.(false);};
    const cancel = () => {
      const old = gesture; release(); if (!old) return;
      presenting = true;
      try {const result = latest.current.adapter.cancel(old.token); if (!result.ok) {retain(old.token); report(result.error);} else {clearRetry(); setNotice('');}} catch (cause) {retain(old.token); report(cause);} finally {presenting = false;}
    };
    cancelGesture.current = cancel;
    const flush = () => {
      frame = null; const g = gesture; if (!g) return false;
      if (!valid(g)) {cancel(); setNotice('The scene changed. Start a new transform.'); return false;}
      if (!g.moved) return true;
      presenting = true;
      try {const result = latest.current.adapter.preview(g.token, g.to); if (!result.ok) {report(result.error); return false;} if (!current(g)) {cancel(); return false;} setNotice(''); return true;} catch (cause) {report(cause); return false;} finally {presenting = false;}
    };
    const within = (event: PointerEvent) => event.target === canvas || event.target instanceof Node && element.contains(event.target);
    const pick = (event: PointerEvent) => {
      if (latest.current.disabled || latest.current.pending || latest.current.localHelp || retry.current !== null) return null;
      const rect = measure(canvas), point: Point = [event.clientX - rect.left, event.clientY - rect.top];
      if (point[0] < 0 || point[1] < 0 || point[0] >= rect.width || point[1] >= rect.height) return null;
      try {const prepared = rendered.current.revision === subscriptionRevision.current && rendered.current.box && sameBox(rendered.current.box, rect) ? rendered.current.preparation : latest.current.adapter.prepare(viewportOf(rect)); return latest.current.adapter.hitTest(prepared, point);} catch {return null;}
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || gesture || !within(event)) return;
      const hit = pick(event); if (!hit) return;
      const rect = measure(canvas), from: Point = [event.clientX - rect.left, event.clientY - rect.top];
      event.preventDefault(); event.stopPropagation();
      try {
        presenting = true; const token = latest.current.adapter.capture(hit.key, from, viewportOf(rect)); presenting = false; if (token === null) return;
        gesture = {token, key: hit.key, box: rect, from, to: from, pointer: event.pointerId, moved: false};
        if (latest.current.viewportShortcuts) {
          canvas.focus({preventScroll: true});
          if (!gesture || !current(gesture)) {cancel(); return;}
        } else element.querySelector<SVGElement>(`[data-gizmo-key="${hit.key}"]`)?.focus();
        try {element.setPointerCapture(event.pointerId);} catch {cancel(); return;}
        setCapturedKey(hit.key); setHovered(null); setActive(hit.label); setNotice(''); latest.current.onGestureChange?.(true);
      } catch (cause) {presenting = false; report(cause);}
    };
    const move = (event: PointerEvent) => {
      const g = gesture; if (!g) {setHovered(event.buttons === 0 && within(event) ? pick(event)?.key ?? null : null); return;}
      if (event.pointerId !== g.pointer) return;
      event.preventDefault(); event.stopPropagation(); g.to = [event.clientX - g.box.left, event.clientY - g.box.top]; g.moved ||= Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1]) >= 3; if (frame === null) frame = requestAnimationFrame(flush);
    };
    const leave = () => {if (!gesture) setHovered(null);};
    const up = (event: PointerEvent) => {
      const g = gesture; if (!g || event.pointerId !== g.pointer) return;
      event.preventDefault(); event.stopPropagation(); g.to = [event.clientX - g.box.left, event.clientY - g.box.top]; g.moved ||= Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1]) >= 3;
      if (frame !== null) {cancelAnimationFrame(frame); frame = null;} const success = flush(); if (gesture !== g) return;
      release(); presenting = true;
      try {const result = success && g.moved ? latest.current.adapter.finish(g.token) : latest.current.adapter.cancel(g.token); if (!result.ok) {retain(g.token); report(result.error);} else clearRetry();} catch (cause) {retain(g.token); report(cause);} finally {presenting = false;}
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture) {event.preventDefault(); event.stopPropagation(); cancel(); return;}
      if (latest.current.disabled || latest.current.localHelp) return;
      const handle = event.target instanceof Element ? event.target.closest<SVGElement>('[data-gizmo-key]') : null;
      if (handle && !element.contains(handle)) return;
      if (event.key === 'Escape' && (event.target === canvas || handle !== null) && (retry.current !== null || latest.current.pending)) {
        event.preventDefault(); event.stopPropagation();
        try {const result = retry.current !== null ? latest.current.adapter.cancel(retry.current) : latest.current.onCancelPending?.(); if (result && !result.ok) report(result.error); else clearRetry();} catch (cause) {report(cause);}
        return;
      }
      const shortcut = event.key.toLowerCase();
      if (latest.current.viewportShortcuts && ['w', 'e', 'r', 'f'].includes(shortcut)) {
        const target = event.target;
        if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.shiftKey && shortcut !== 'f')
          || gesture || latest.current.active !== null || latest.current.pending || latest.current.retained || retry.current !== null
          || !(target instanceof Element) || target !== canvas && handle === null
          || target.closest('input,textarea,select,[contenteditable],button,[role="menu"],[role="menuitem"],[role="dialog"]')
          || canvas.ownerDocument.activeElement !== target) return;
        const frameAction = event.shiftKey ? latest.current.onFrameAll : latest.current.onFrame;
        if (shortcut === 'f' && !frameAction) return;
        event.preventDefault(); event.stopPropagation();
        try {
          if (shortcut === 'f') frameAction?.();
          else chooseMode(shortcut === 'w' ? 'translate' : shortcut === 'e' ? 'rotate' : 'scale');
        } catch (cause) {report(cause);}
        return;
      }
      const offsets: Record<string, Point> = {ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6]};
      if (handle && (event.key === 'Enter' || event.key === ' ') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {event.preventDefault(); event.stopPropagation(); setFocused(handle.dataset.gizmoKey as RenderSceneGizmoKey); return;}
      if (handle && offsets[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
        event.preventDefault(); event.stopPropagation(); if (event.repeat || gesture || latest.current.pending || retry.current !== null) return;
        let token: C | null = null; presenting = true;
        try {
          const prepared = latest.current.adapter.prepare(viewportOf(measure(canvas))), selected = prepared.handles.find(value => value.key === handle.dataset.gizmoKey); if (!selected) return;
          const delta = offsets[event.key]!, from = selected.anchor, to: Point = [from[0] + delta[0], from[1] + delta[1]];
          token = latest.current.adapter.capture(selected.key, from, viewportOf(measure(canvas))); if (token === null) return;
          latest.current.onGestureChange?.(true); const preview = latest.current.adapter.preview(token, to);
          const result = preview.ok ? latest.current.adapter.finish(token) : latest.current.adapter.cancel(token);
          if (!preview.ok) report(preview.error); if (!result.ok) {retain(token); report(result.error);} else clearRetry();
        } catch (cause) {if (token !== null) retain(token); report(cause);} finally {presenting = false; latest.current.onGestureChange?.(false);}
      }
      if (gesture && (event.ctrlKey || event.metaKey) && ['n', 'o', 's', 'z'].includes(event.key.toLowerCase())) {event.preventDefault(); event.stopPropagation();}
    };
    const lost = (event: PointerEvent) => {if (gesture?.pointer === event.pointerId) cancel();};
    const resized = () => {if (gesture && !sameBox(measure(canvas), gesture.box)) cancel();};
    const changed = () => {subscriptionRevision.current++; setRevision(subscriptionRevision.current); if (!presenting) {setHovered(null); if (gesture && !valid(gesture)) cancel(); if (retry.current !== null && !latest.current.pending && !latest.current.adapter.isCurrent(retry.current)) clearRetry();}};
    const observer = new ResizeObserver(resized); observer.observe(canvas); const unsubscribe = adapter.subscribe(changed);
    surface.addEventListener('pointerdown', down, true); surface.addEventListener('pointermove', move, true); surface.addEventListener('pointerup', up, true); surface.addEventListener('pointercancel', lost, true); surface.addEventListener('lostpointercapture', lost, true); surface.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', keydown); window.addEventListener('blur', cancel); canvas.addEventListener('webglcontextlost', cancel);
    return () => {observer.disconnect(); cancel(); cancelGesture.current = null; unsubscribe(); surface.removeEventListener('pointerdown', down, true); surface.removeEventListener('pointermove', move, true); surface.removeEventListener('pointerup', up, true); surface.removeEventListener('pointercancel', lost, true); surface.removeEventListener('lostpointercapture', lost, true); surface.removeEventListener('pointerleave', leave); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', cancel); canvas.removeEventListener('webglcontextlost', cancel);};
  }, [adapter, canvas]);
  const cancelPending = () => {
    cancelGesture.current?.();
    try {const result = retry.current !== null ? adapter.cancel(retry.current) : onCancelPending?.(); if (result && !result.ok) report(result.error); else {retry.current = null; setRetained(false); setNotice('');}} catch (cause) {report(cause);}
  };
  const locked = disabled || active !== null || pending || retained, highlighted = capturedKey ?? hovered ?? focused;
  return <>
    <div className="re-gizmo-toolbar" aria-label="Object transform controls">{showModeButtons && (['translate', 'rotate', 'scale'] as const).map(value => <button key={value} type="button" data-testid={`gizmo-mode-${value}`} aria-pressed={mode === value} aria-keyshortcuts={viewportShortcuts ? value === 'translate' ? 'W' : value === 'rotate' ? 'E' : 'R' : undefined} disabled={locked} onClick={() => {if (!locked) chooseMode(value);}}>{value === 'translate' ? 'Move' : value === 'rotate' ? 'Rotate' : scaleLabel}</button>)}{pivotLabel && <span className="re-gizmo-pivot-label" data-testid="gizmo-pivot-label">Pivot: {pivotLabel}</span>}<button ref={help} type="button" data-testid="gizmo-help" aria-label="Transform controls Help" disabled={active !== null || pending || retained} onClick={() => onHelp ? onHelp() : setLocalHelp(true)}>Help</button>{(pending || retained) && !active && <button type="button" disabled={disabled} onClick={cancelPending}>Cancel transform</button>}</div>
    <svg ref={svg} className="re-gizmo-overlay" data-testid="gizmo-overlay" width="100%" height="100%" style={{pointerEvents: 'none'}} aria-label="Projected object transform handles" data-active-axis={capturedKey ?? undefined} data-hovered-axis={hovered ?? undefined}>{preparation.handles.length > 0 && <circle className="re-gizmo-pivot" cx={preparation.pivot[0]} cy={preparation.pivot[1]} r="3"/>}{preparation.handles.map(handle => <g key={`${mode}-${handle.key}`} data-gizmo-key={handle.key} data-anchor-x={handle.anchor[0]} data-anchor-y={handle.anchor[1]} data-testid={`gizmo-handle-${handle.key}`} aria-label={handle.label} role="button" tabIndex={locked ? -1 : 0} aria-disabled={locked} data-highlighted={highlighted === handle.key ? 'true' : undefined} data-active-axis={capturedKey === handle.key ? 'true' : undefined} onFocus={() => setFocused(handle.key)} onBlur={() => setFocused(previous => previous === handle.key ? null : previous)} className={`re-gizmo-handle re-gizmo-axis-${handle.key}`} style={{pointerEvents: 'none'}}>
      {handle.key === 'uniform' && <title>Scale all axes uniformly</title>}
      {(handle.segments ?? [{points: handle.points, front: true}]).map((segment, index) => <polyline key={index} className={`re-gizmo-line${segment.front ? '' : ' re-gizmo-ring-back'}`} data-front={segment.front ? 'true' : 'false'} points={segment.points.map(p => p.join(',')).join(' ')} style={{pointerEvents: 'none'}}/>)}
      {mode === 'translate' ? <polygon className="re-gizmo-anchor" points={arrowPoints(handle.points, handle.anchor)} style={{pointerEvents: 'none'}}/> : mode === 'scale' ? <rect className="re-gizmo-anchor" x={handle.anchor[0] - 5} y={handle.anchor[1] - 5} width="10" height="10" style={{pointerEvents: 'none'}}/> : null}
      {mode !== 'rotate' && <text x={handle.anchor[0] + 8} y={handle.anchor[1] - 7} style={{pointerEvents: 'none'}}>{handle.key === 'uniform' ? 'All' : handle.key.toUpperCase()}</text>}
    </g>)}</svg>
    <p className="re-gizmo-status" data-testid="gizmo-status" role="status">{active ? `${active} · Release to apply · Escape to cancel` : pending || retained ? 'Transform preview · Cancel or correct the refused change' : notice || preparation.unavailable || profileNotice || (highlighted ? `${mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'} ${highlighted === 'uniform' ? 'uniform' : highlighted.toUpperCase()}` : '')}</p>
    {localHelp && <div className="re-camera-local-help" role="dialog" aria-label="Transform controls"><p>{helpText}</p><button type="button" onClick={() => {setLocalHelp(false); help.current?.focus();}}>Close Help</button></div>}
  </>;
}
