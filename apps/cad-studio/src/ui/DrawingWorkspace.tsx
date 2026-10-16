// The Drawing workspace: the part's standard views on a sheet, dimensioned by clicking in a view.
// Tools: Select (click a dimension to select it, drag to move it, Delete removes it), Linear (two
// points, or one straight edge, then where the dimension line goes), Diameter and Radius (a circle
// that shows round in the view, then where the text goes). The sheet exports as SVG or PDF.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectedEdge } from '@barocss/cad';
import type { EngineClient } from '../engine/client';
import type { StudioDoc } from '../engine/doc';
import type { FriendlyError } from '../engine/errors';
import { buildSheet, curveMark, dimensionMarks } from '../drawing/sheet';
import { marksSvg, sheetGroupsSvg, sheetSvg } from '../drawing/svg';
import { sheetPdf } from '../drawing/pdf';
import { SCALES, VIEWS, fromSheet, layoutSheet, scaleLabel, toSheet } from '../drawing/views';
import { edgeAt, inView, newDimensionId, orientFor, resolveDimension, roundIn, snapPoints, type SnapPoint } from '../drawing/dimensions';
import { VIEW_IDS, type DimPoint, type DrawingDimension, type DrawingSettings, type DrawingViews, type Vec3, type ViewId, type XY } from '../drawing/types';
import { downloadBytes } from './files';
import { Icon, Kbd } from './atoms';
import '../drawing/drawing.css';

type Tool = 'select' | 'linear' | 'diameter' | 'radius';
const TOOLS: { tool: Tool; label: string; icon: string; key: string; hint: string }[] = [
  { tool: 'select', label: 'Select', icon: 'arrow_selector_tool', key: 'V', hint: 'Click a dimension to select it, drag to move it · Delete removes it · drag the paper to pan, scroll to zoom' },
  { tool: 'linear', label: 'Linear dimension', icon: 'straighten', key: 'D', hint: 'Click two points (edge ends, circle centres) or one straight edge, then where the dimension goes' },
  { tool: 'diameter', label: 'Diameter', icon: 'radio_button_unchecked', key: 'Ø', hint: 'Click a circle, then where its diameter goes' },
  { tool: 'radius', label: 'Radius', icon: 'line_end_circle', key: 'R', hint: 'Click a circle or an arc, then where its radius goes' },
];
type Pending =
  | { kind: 'linear'; view: ViewId; a: DimPoint; b?: DimPoint }
  | { kind: 'diameter' | 'radius'; view: ViewId; edge: string; near: Vec3 };
/** `q`: the pointer on the sheet (mm); `at`: in the view under it (model mm). */
interface Hover { q: XY; view: ViewId; at: XY; snap: SnapPoint | null; edge: ProjectedEdge | null }

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function DrawingWorkspace({ engine, doc, settings, fileName, onChange, onToast }: {
  engine: EngineClient; doc: StudioDoc; settings: DrawingSettings; fileName: string;
  onChange(next: DrawingSettings): void; onToast(e: FriendlyError): void;
}) {
  const [views, setViews] = useState<DrawingViews | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [tool, setTool] = useState<Tool>('select');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; place: XY } | { pan: XY; box: [number, number, number, number] } | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // Project the part whenever its model changes (the drawing settings do not change the views).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => doc, [doc.nodes, doc.parameters]);
  useEffect(() => {
    let live = true; setBusy(true);
    engine.drawing(model).then(r => {
      if (!live) return;
      setBusy(false);
      if (r.ok) { setViews(r.views); setError(null); } else { setViews(null); setError(r.error); }
    });
    return () => { live = false; };
  }, [engine, model]);

  const title = settings.title ?? fileName;
  const layout = useMemo(() => views && layoutSheet(views, settings), [views, settings]);
  const sheet = useMemo(() => views && layout && buildSheet(views, layout, settings, { title, date: today() }), [views, layout, settings, title]);
  const sheetMarkup = useMemo(() => sheet ? sheetGroupsSvg(sheet, selected) : '', [sheet, selected]);
  const [W, H] = layout?.size ?? [297, 210];
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  useEffect(() => { setBox(null); }, [settings.sheet]);
  const viewBox = box ?? [-6, -6, W + 12, H + 12];

  // Pointer position on the sheet (mm), and the view under it.
  const sheetPoint = useCallback((clientX: number, clientY: number): XY | null => {
    const el = svg.current, m = el?.getScreenCTM(); if (!el || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse()); return [p.x, p.y];
  }, []);
  const mmPerPx = () => { const m = svg.current?.getScreenCTM(); return m ? 1 / m.a : 0.3; };
  const viewAt = useCallback((q: XY): ViewId | null => {
    if (!layout) return null;
    let best: ViewId | null = null, bestD = 30;
    for (const id of VIEW_IDS) {
      const [x0, y0, x1, y1] = layout.views[id].box, d = Math.max(x0 - q[0], q[0] - x1, y0 - q[1], q[1] - y1, 0);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }, [layout]);
  const snaps = useMemo(() => views ? Object.fromEntries(VIEW_IDS.map(id => [id, snapPoints(views[id])])) as Record<ViewId, SnapPoint[]> : null, [views]);

  const hoverAt = useCallback((clientX: number, clientY: number): Hover | null => {
    const q = sheetPoint(clientX, clientY); if (!q || !layout || !views || !snaps) return null;
    const view = viewAt(q); if (!view) return null;
    const v = layout.views[view], at = fromSheet(v, q), tol = 9 * mmPerPx() / v.scale;
    let snap: SnapPoint | null = null, best = tol;
    for (const s of snaps[view]) { const d = Math.hypot(s.at[0] - at[0], s.at[1] - at[1]); if (d < best) { best = d; snap = s; } }
    return { q, view, at, snap, edge: snap ? null : edgeAt(views[view], at, 6 * mmPerPx() / v.scale) };
  }, [sheetPoint, layout, views, snaps, viewAt]);

  const commitDims = (dimensions: DrawingDimension[]) => onChange({ ...settings, dimensions });
  const cancel = () => { setPending(null); setMessage(null); };

  const click = (h: Hover) => {
    if (!views) return;
    setMessage(null);
    // Where a dimension goes is read in its own view, wherever the pointer is.
    const placing = pending && (pending.kind !== 'linear' || pending.b);
    const place = placing && layout ? fromSheet(layout.views[pending.view], h.q) : h.at;
    if (h.view === 'iso' && !placing) { setMessage('Dimensions go on the front, top and right views.'); return; }
    const pr = views[placing ? pending.view : h.view];
    if (tool === 'linear') {
      if (pending?.kind === 'linear' && pending.b) {
        const a = pointIn(pr, pending.a), b = pointIn(pr, pending.b);
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: 'linear', a: pending.a, b: pending.b, orient: orientFor(a, b, place), place }]);
        setPending(null); return;
      }
      if (pending?.kind === 'linear' && pending.view !== h.view) { setMessage('Pick the second point in the same view.'); return; }
      if (h.snap) {
        if (!pending || pending.kind !== 'linear') { setPending({ kind: 'linear', view: h.view, a: h.snap.ref }); return; }
        const a = pointIn(pr, pending.a);
        if (Math.hypot(a[0] - h.snap.at[0], a[1] - h.snap.at[1]) < 1e-9) { setMessage('Pick a different point.'); return; }
        setPending({ ...pending, b: h.snap.ref }); return;
      }
      if (h.edge && !pending && h.edge.ends && h.edge.kind !== 'circle' && h.edge.kind !== 'curve') {
        const [p, q] = h.edge.ends;
        setPending({ kind: 'linear', view: h.view, a: { edge: h.edge.name, at: 'end', near: [...p] as Vec3 }, b: { edge: h.edge.name, at: 'end', near: [...q] as Vec3 } }); return;
      }
      setMessage(pending ? 'Click an edge end or a circle centre.' : 'Click an edge end, a circle centre or a straight edge.'); return;
    }
    if (tool === 'diameter' || tool === 'radius') {
      if (pending && pending.kind === tool) {
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: tool, edge: pending.edge, near: pending.near, place }]);
        setPending(null); return;
      }
      const e = h.edge ?? (h.snap ? pr.edges.find(x => x.name === h.snap!.ref.edge && x.circle) ?? null : null);
      if (!e?.circle) { setMessage('Click a circle or an arc.'); return; }
      if (!roundIn(pr, e)) { setMessage(`This circle is not round in the ${VIEWS[h.view].label.toLowerCase()} view — dimension it where it shows as a circle.`); return; }
      setPending({ kind: tool, view: h.view, edge: e.name, near: [...e.circle.center] as Vec3 }); return;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = (e.target as Element).closest('[data-dim]');
    if (tool === 'select') {
      const id = target?.getAttribute('data-dim') ?? null;
      setSelected(id);
      const d = id ? settings.dimensions.find(x => x.id === id) : undefined;
      if (d) setDrag({ id: d.id, place: d.place });
      else setDrag({ pan: [e.clientX, e.clientY], box: [...viewBox] as [number, number, number, number] });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    const h = hoverAt(e.clientX, e.clientY); if (h) click(h);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag && 'pan' in drag) {
      const k = mmPerPx(); setBox([drag.box[0] - (e.clientX - drag.pan[0]) * k, drag.box[1] - (e.clientY - drag.pan[1]) * k, drag.box[2], drag.box[3]]); return;
    }
    if (drag && layout) {
      const q = sheetPoint(e.clientX, e.clientY), d = settings.dimensions.find(x => x.id === drag.id);
      if (q && d) setDrag({ id: drag.id, place: fromSheet(layout.views[d.view], q) });
      return;
    }
    setHover(hoverAt(e.clientX, e.clientY));
  };
  const onPointerUp = () => {
    if (drag && !('pan' in drag)) {
      const d = settings.dimensions.find(x => x.id === drag.id);
      if (d && (d.place[0] !== drag.place[0] || d.place[1] !== drag.place[1])) {
        commitDims(settings.dimensions.map(x => x.id !== d.id ? x : x.kind === 'linear' && views
          ? { ...x, place: drag.place, orient: orientFor(pointIn(views[x.view], x.a), pointIn(views[x.view], x.b), drag.place) } : { ...x, place: drag.place }));
      }
    }
    setDrag(null);
  };
  const onWheel = (e: React.WheelEvent) => {
    const q = sheetPoint(e.clientX, e.clientY); if (!q) return;
    const k = Math.exp(e.deltaY * 0.0015), [x, y, w, h] = viewBox, nw = Math.min(W * 4, Math.max(20, w * k)), f = nw / w;
    setBox([q[0] - (q[0] - x) * f, q[1] - (q[1] - y) * f, nw, h * f]);
  };

  const remove = useCallback((id: string) => { commitDims(settings.dimensions.filter(d => d.id !== id)); setSelected(null); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') { if (pending) cancel(); else { setSelected(null); setTool('select'); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(selected); return; }
      const t = ({ v: 'select', d: 'linear', o: 'diameter', r: 'radius' } as Record<string, Tool>)[e.key.toLowerCase()];
      if (t) { setTool(t); setPending(null); setMessage(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Dev/test hooks: a view point (model mm in the view) in client pixels, and the sheet's state.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__studioDrawingAt = (view: ViewId, u: number, v: number) => {
      const m = svg.current?.getScreenCTM(); if (!m || !layout) return null;
      const q = toSheet(layout.views[view], [u, v]), p = new DOMPoint(q[0], q[1]).matrixTransform(m); return { x: p.x, y: p.y };
    };
    w.__studioDrawing = () => sheet && { scale: layout?.scale, dimensions: sheet.dimensions.map(r => r.ok ? { id: r.dim.id, text: r.text, value: r.value } : { id: r.dim.id, lost: r.reason }),
      hidden: Object.fromEntries(VIEW_IDS.map(id => [id, views![id].edges.reduce((n, e) => n + e.pieces.filter(p => !p.visible).length, 0)])) };
    return () => { delete w.__studioDrawingAt; delete w.__studioDrawing; };
  }, [layout, sheet, views]);

  const exportSvg = () => { if (sheet) downloadBytes(new TextEncoder().encode(sheetSvg(sheet, title)), `${fileName}.svg`, 'image/svg+xml'); };
  const exportPdf = () => { if (sheet) downloadBytes(sheetPdf(sheet, title), `${fileName}.pdf`, 'application/pdf'); };
  useEffect(() => { if (error) onToast({ title: 'Could not draw the part', hint: 'Fix the model’s errors first, then open the drawing again.', detail: error }); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // What follows the cursor: the snap, the hovered edge, and the dimension being placed or dragged.
  const overlay = useMemo(() => {
    if (!layout || !views) return '';
    const parts: string[] = [];
    const v = hover ? layout.views[hover.view] : null;
    const placing = pending && hover && (pending.kind !== 'linear' || pending.b);
    if (pending?.kind === 'linear') for (const ref of [pending.a, ...(pending.b ? [pending.b] : [])]) {
      const q = toSheet(layout.views[pending.view], pointIn(views[pending.view], ref)); parts.push(`<circle class="dw-pick" cx="${q[0]}" cy="${q[1]}" r="0.9"/>`);
    }
    if (placing && hover) {
      const at = fromSheet(layout.views[pending.view], hover.q);
      const d: DrawingDimension = pending.kind === 'linear'
        ? { id: 'preview', view: pending.view, kind: 'linear', a: pending.a, b: pending.b!, orient: orientFor(pointIn(views[pending.view], pending.a), pointIn(views[pending.view], pending.b!), at), place: at }
        : { id: 'preview', view: pending.view, kind: pending.kind, edge: pending.edge, near: pending.near, place: at };
      const r = resolveDimension(views, d);
      if (r.ok) parts.push(`<g class="dw-preview">${marksSvg(dimensionMarks(layout.views[pending.view], r))}</g>`);
    } else if (hover && v && tool !== 'select') {
      if (hover.snap && tool === 'linear') { const q = toSheet(v, hover.snap.at); parts.push(`<circle class="dw-snap" cx="${q[0]}" cy="${q[1]}" r="1.4"/>`); }
      else if (hover.edge && (tool !== 'linear' || !pending)) {
        const ok = tool === 'linear' ? hover.edge.kind !== 'circle' && hover.edge.kind !== 'curve' : !!hover.edge.circle && roundIn(views[hover.view], hover.edge);
        if (ok) parts.push(`<g class="dw-hover">${marksSvg(hover.edge.pieces.map(p => curveMark(v, p.curve, 'visible')))}</g>`);
      }
    }
    return parts.join('');
  }, [layout, views, hover, pending, tool]);

  // The dimension being dragged is drawn where it goes.
  const shownMarkup = useMemo(() => {
    if (!drag || 'pan' in drag || !views || !layout || !sheet) return sheetMarkup;
    const dims = settings.dimensions.map(d => d.id === drag.id ? (d.kind === 'linear' ? { ...d, place: drag.place, orient: orientFor(pointIn(views[d.view], d.a), pointIn(views[d.view], d.b), drag.place) } : { ...d, place: drag.place }) : d);
    return sheetGroupsSvg(buildSheet(views, layout, { ...settings, dimensions: dims }, { title, date: today() }), selected);
  }, [drag, views, layout, sheet, sheetMarkup, settings, title, selected]);

  const hint = message ?? (pending ? (pending.kind === 'linear' && !pending.b ? 'Now the second point · Esc cancels' : 'Click where the dimension goes · Esc cancels') : TOOLS.find(t => t.tool === tool)!.hint);
  const lost = sheet?.dimensions.filter(r => !r.ok) ?? [];

  return (
    <div className="dw" aria-label="Drawing">
      <nav className="card dw-tools" aria-label="Drawing tools">
        {TOOLS.map(t => <button key={t.tool} className={'tool' + (tool === t.tool ? ' on' : '')} aria-label={t.label} title={`${t.label} (${t.key === 'Ø' ? 'O' : t.key})`}
          onClick={() => { setTool(t.tool); setPending(null); setMessage(null); }}><Icon name={t.icon} /></button>)}
        <div className="sep" />
        <button className="tool" aria-label="Fit sheet" title="Fit the sheet" onClick={() => setBox(null)}><Icon name="fit_screen" /></button>
      </nav>

      <div className="dw-paper">
        {layout && <svg ref={svg} viewBox={viewBox.join(' ')} className={drag && 'pan' in drag ? 'dw-pan' : ''} aria-label="Drawing sheet" data-scale={layout.scale}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)} onWheel={onWheel}>
          <rect className="dw-sheet" x={0} y={0} width={W} height={H} fill="#fff" />
          <g fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" fontFamily="Helvetica, Arial, sans-serif" dangerouslySetInnerHTML={{ __html: shownMarkup }} />
          <g dangerouslySetInnerHTML={{ __html: overlay }} />
        </svg>}
        {busy && !views && <div className="dw-busy">Projecting views…</div>}
        {!busy && !views && <div className="dw-busy">{error ?? 'Nothing to draw.'}</div>}
      </div>

      <aside className="card dw-panel" aria-label="Drawing settings">
        <div className="card-title">SHEET {busy && views && <span className="muted">updating…</span>}</div>
        <label className="field"><span>Size</span><select aria-label="Sheet size" value={settings.sheet} onChange={e => onChange({ ...settings, sheet: e.target.value as 'A4' })}>
          <option value="A4">A4 landscape</option><option value="A3">A3 landscape</option></select></label>
        <label className="field"><span>Scale</span><select aria-label="Scale" value={settings.scale ?? 'auto'} onChange={e => { const v = e.target.value; const { scale: _, ...rest } = settings; onChange(v === 'auto' ? rest : { ...rest, scale: Number(v) }); }}>
          <option value="auto">Auto{layout && settings.scale === undefined ? ` (${scaleLabel(layout.scale)})` : ''}</option>
          {SCALES.map(s => <option key={s} value={s}>{scaleLabel(s)}</option>)}</select></label>
        <label className="field"><span>Projection</span><select aria-label="Projection" value={settings.projection} onChange={e => onChange({ ...settings, projection: e.target.value as 'third' })}>
          <option value="third">Third angle</option><option value="first">First angle</option></select></label>
        <label className="field"><span>Hidden lines</span><input type="checkbox" className="check" aria-label="Hidden lines" checked={settings.hidden} onChange={e => onChange({ ...settings, hidden: e.target.checked })} /></label>
        <label className="field"><span>Title</span><input aria-label="Drawing title" value={titleDraft ?? title} onChange={e => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== null) { const { title: _, ...rest } = settings; onChange(titleDraft.trim() && titleDraft.trim() !== fileName ? { ...rest, title: titleDraft.trim() } : rest); setTitleDraft(null); } }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
        {layout && !layout.fits && <div className="empty" style={{ color: 'var(--warn)' }}>The views do not fit the sheet at {scaleLabel(layout.scale)}. Pick a smaller scale or a larger sheet.</div>}

        <div className="card-title" style={{ marginTop: 8 }}>DIMENSIONS <span className="muted">{settings.dimensions.length}</span></div>
        <div className="dw-dims">
          {sheet?.dimensions.map(r => <div key={r.dim.id} role="button" tabIndex={0} className={'dw-dim' + (selected === r.dim.id ? ' sel' : '') + (r.ok ? '' : ' lost')} title={r.ok ? undefined : r.reason}
            onClick={() => { setSelected(r.dim.id); setTool('select'); }}>
            <b>{r.ok ? r.text : 'lost'}</b><span>{r.dim.kind === 'linear' ? r.dim.orient : r.dim.kind} · {r.dim.view}</span>
            <span className="muted" />
            <button className="tool tiny" aria-label={`Remove dimension ${r.ok ? r.text : r.dim.id}`} onClick={e => { e.stopPropagation(); remove(r.dim.id); }}><Icon name="close" small /></button>
          </div>)}
          {!settings.dimensions.length && <div className="empty">Pick a dimension tool (<Kbd>D</Kbd> linear, <Kbd>O</Kbd> diameter, <Kbd>R</Kbd> radius) and click in a view. Values come from the model in mm and follow it as it changes.</div>}
          {lost.length > 0 && <div className="empty" style={{ color: 'var(--warn)' }}>{lost.length} dimension{lost.length > 1 ? 's' : ''} lost {lost.length > 1 ? 'their' : 'its'} reference (the part changed).</div>}
        </div>

        <div className="card-title" style={{ marginTop: 8 }}>EXPORT</div>
        <div className="dw-actions">
          <button className="primary" disabled={!sheet} onClick={exportSvg} aria-label="Export SVG"><Icon name="download" small /> SVG</button>
          <button className="ghost" disabled={!sheet} onClick={exportPdf} aria-label="Export PDF">PDF</button>
        </div>
        {sheet && <div className="empty">{scaleLabel(layout!.scale)} · {settings.sheet} · {VIEW_IDS.map(id => `${VIEWS[id].label.toLowerCase()} ${views![id].edges.length}`).join(', ')} edges</div>}
      </aside>

      <div className={'card dw-hint' + (message ? ' warn' : '')} role="status">
        <span>{hint}</span>
        {selected && <span><Kbd>Del</Kbd> remove</span>}
        <span><Kbd>V</Kbd> <Kbd>D</Kbd> <Kbd>O</Kbd> <Kbd>R</Kbd> tools</span>
      </div>
    </div>
  );
}

/** A dimension point in a view's coordinates, by its stored model point (it may since have moved). */
function pointIn(pr: DrawingViews[ViewId], ref: DimPoint): XY {
  for (const e of pr.edges) if (e.name === ref.edge) {
    const cands = ref.at === 'center' ? (e.circle ? [e.circle.center] : []) : (e.ends ?? []);
    let best: readonly number[] | null = null, bd = Infinity;
    for (const p of cands) { const d = Math.hypot(p[0] - ref.near[0], p[1] - ref.near[1], p[2] - ref.near[2]); if (d < bd) { bd = d; best = p; } }
    if (best) return inView(pr, best);
  }
  return inView(pr, ref.near);
}
