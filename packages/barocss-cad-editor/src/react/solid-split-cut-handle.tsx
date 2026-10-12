import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SolidSplitWorkspaceSnapshot } from '../split-workspace.js';
import { moveSolidSplitCut, projectSolidSplitCut, type SolidSplitCutProjection } from './solid-split-cut-projection.js';

export interface SolidSplitCutDraft { readonly value: string | null; readonly revision: number }
interface Props {
  canvas: HTMLCanvasElement | null;
  snapshot: SolidSplitWorkspaceSnapshot;
  getSnapshot(): SolidSplitWorkspaceSnapshot;
  raw: string;
  disabled: boolean;
  getDraft(): SolidSplitCutDraft;
  onDraft(value: string | null): SolidSplitCutDraft;
  onGesture(active: boolean): void;
}
interface Gesture {
  pointerId: number; element: HTMLButtonElement; canvas: HTMLCanvasElement;
  context: SolidSplitWorkspaceSnapshot; rect: { left: number; top: number; width: number; height: number };
  width: number; height: number; startX: number; startY: number;
  projection: SolidSplitCutProjection; original: SolidSplitCutDraft; expected: SolidSplitCutDraft;
  moved: boolean;
}
const number = (raw: string) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())
  && Number.isFinite(Number(raw)) ? Number(raw) : null;
function visible(canvas: HTMLCanvasElement) {
  return canvas.isConnected && !canvas.closest('[hidden]') && canvas.getClientRects().length > 0
    && !['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility);
}
/** Approximate display-bound editing guide only. It never authors or previews native geometry. */
export function SolidSplitCutHandle(props: Props) {
  const latest = useRef(props); latest.current = props;
  const gesture = useRef<Gesture | null>(null), composing = useRef(false), [, redraw] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  function sameContext(g: Gesture) {
    const now = latest.current, state = now.getSnapshot(), rect = g.canvas.getBoundingClientRect();
    return now.canvas === g.canvas && !now.disabled && state.available && !state.busy && !state.disposed
      && state.authorityAvailable && state.display === g.context.display && state.selection === g.context.selection
      && state.session?.generation === g.context.session?.generation
      && state.session?.displayGeneration === g.context.session?.displayGeneration
      && visible(g.canvas) && rect.left === g.rect.left && rect.top === g.rect.top
      && rect.width === g.rect.width && rect.height === g.rect.height
      && g.canvas.width === g.width && g.canvas.height === g.height;
  }
  function finish(g: Gesture, restore: boolean) {
    if (gesture.current !== g) return;
    gesture.current = null;
    // Compare the exact draft token, not its text: newer away-and-back edits own their value.
    if (restore && latest.current.getDraft() === g.expected && g.expected !== g.original)
      latest.current.onDraft(g.original.value);
    try { if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId); } catch { /* Capture can already be lost. */ }
    latest.current.onGesture(false); redraw(value => value + 1);
  }
  const cancel = () => { const g = gesture.current; if (g) finish(g, true); };
  function current(g: Gesture) {
    return sameContext(g) && latest.current.getDraft() === g.expected && g.element.hasPointerCapture(g.pointerId);
  }
  function begin(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation();
    const now = latest.current, canvas = now.canvas, context = now.getSnapshot();
    if (gesture.current || composing.current || now.disabled || !canvas || !context.available || context.busy || !context.authorityAvailable || !visible(canvas)) return;
    const original = now.getDraft();
    const raw = original.value ?? context.session?.pending.cutY ?? (context.session ? String(context.session.cutY) : '');
    const projection = project({ ...now, snapshot: context, raw }); if (!projection) return;
    const rect = canvas.getBoundingClientRect();
    const g: Gesture = { pointerId: event.pointerId, element: event.currentTarget, canvas, context,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, width: canvas.width, height: canvas.height,
      startX: event.clientX, startY: event.clientY, projection, original, expected: original, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { setNotice('Pointer capture is unavailable. Use the Cut Y field.'); return; }
    gesture.current = g; setNotice(null); now.onGesture(true); event.currentTarget.focus({ preventScroll: true });
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (!current(g)) { finish(g, true); return; }
    const dx = event.clientX - g.startX, dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) <= 3) return;
    const value = moveSolidSplitCut(g.projection, dx, dy);
    if (value === null) { setNotice('This view cannot map that movement. Use the Cut Y field.'); finish(g, true); return; }
    if (!g.moved && Object.is(value, g.projection.cutY)) return;
    g.moved = true;
    const raw = Object.is(value, g.projection.cutY) ? g.original.value : Object.is(value, -0) ? '-0' : String(value);
    g.expected = latest.current.onDraft(raw);
  }
  function end(event: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (event.type === 'pointerup') { move(event); if (gesture.current === g) finish(g, !current(g)); }
    else finish(g, true);
  }
  useEffect(() => {
    const canvas = props.canvas; if (!canvas) return;
    let active = true;
    const check = () => { if (!active) return; const g = gesture.current; if (g && !sameContext(g)) finish(g, true); redraw(value => value + 1); };
    const interrupt = () => cancel();
    const compositionStart = () => { composing.current = true; cancel(); };
    const compositionEnd = () => { composing.current = false; };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); } };
    const down = (event: PointerEvent) => { if (gesture.current && event.pointerId !== gesture.current.pointerId) cancel(); };
    const resize = new ResizeObserver(check); resize.observe(canvas);
    const mutation = new MutationObserver(check);
    for (let node: HTMLElement | null = canvas; node; node = node.parentElement)
      mutation.observe(node, { attributes: true, attributeFilter: ['hidden', 'style', 'class', 'width', 'height'] });
    window.addEventListener('keydown', key, true); window.addEventListener('pointerdown', down, true);
    window.addEventListener('blur', interrupt); window.addEventListener('hashchange', interrupt);
    window.addEventListener('scroll', check, true); window.addEventListener('resize', check);
    window.addEventListener('compositionstart', compositionStart, true); window.addEventListener('compositionend', compositionEnd, true); document.addEventListener('visibilitychange', interrupt);
    canvas.addEventListener('webglcontextlost', interrupt);
    return () => {
      active = false; resize.disconnect(); mutation.disconnect(); cancel();
      window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('blur', interrupt); window.removeEventListener('hashchange', interrupt);
      window.removeEventListener('scroll', check, true); window.removeEventListener('resize', check);
      window.removeEventListener('compositionstart', compositionStart, true); window.removeEventListener('compositionend', compositionEnd, true); document.removeEventListener('visibilitychange', interrupt);
      canvas.removeEventListener('webglcontextlost', interrupt);
    };
  }, [props.canvas]);
  useEffect(() => { const g = gesture.current; if (g && (!sameContext(g) || latest.current.getDraft() !== g.expected)) finish(g, true); });
  const projection = project(props);
  return <div className="cad-solid-split-cut-guide" data-testid="solid-split-cut-guide">
    {projection && !props.disabled && <button type="button" className="cad-solid-split-cut-grip"
      style={{ left: projection.xCss, top: projection.yCss }} aria-label="Drag constant-Y cut draft; use Cut Y field for exact or keyboard editing"
      title="Approximate Cut Y guide. Drag to draft; choose Split to apply." onPointerDown={begin} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onClick={event => { event.preventDefault(); event.stopPropagation(); }}>Y</button>}
    <span className="cad-solid-split-cut-caption">{notice ?? (projection ? 'Approximate Cut Y guide · draft only' : 'Cut guide unavailable in this view · use Cut Y field')}</span>
  </div>;
}
function project(props: Props): SolidSplitCutProjection | null {
  const canvas = props.canvas, display = props.snapshot.display, cutY = number(props.raw);
  if (!canvas || !display || cutY === null || !props.snapshot.available || !visible(canvas)) return null;
  const rect = canvas.getBoundingClientRect();
  const min = [0, 1, 2].map(axis => Math.min(...display.bodies.map(body => body.bounds.min[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...display.bodies.map(body => body.bounds.max[axis])));
  return projectSolidSplitCut({ camera: display.scene.camera, bounds: { min, max }, cutY,
    cssWidth: rect.width, cssHeight: rect.height, pixelWidth: canvas.width, pixelHeight: canvas.height });
}
