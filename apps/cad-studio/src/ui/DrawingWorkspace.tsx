// The Drawing workspace: the part's standard views on a sheet, dimensioned by clicking in a view.
// Tools: Select (click a dimension to select it, drag to move it, Delete removes it), Linear (two
// points, or one straight edge, then where the dimension line goes), Diameter and Radius (a circle
// that shows round in the view, then where the text goes). The sheet exports as SVG, PDF or DXF (R11b, O1);
// section A–A also alone as a 1:1 DXF.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectedEdge } from '@barocss/cad';
import type { EngineClient } from '../engine/client';
import type { StudioDoc } from '../engine/doc';
import type { FriendlyError } from '../engine/errors';
import { buildSheet, curveMark, dimensionMarks } from '../drawing/sheet';
import { marksSvg, sheetGroupsSvg, sheetSvg } from '../drawing/svg';
import { toleranceText } from '../drawing/sheet';
import { pdfMissing, sheetPdf } from '../drawing/pdf';
import { sectionDxfDocument, sheetDxf } from '../drawing/dxf';
import { MIN_HOLE_ON_PAPER_MM, autoLayout } from '../drawing/layout';
import { applyFix, drawingIssues, fixAll, type DrawingIssue } from '../drawing/issues';
import { writeDxf, type DxfVersion } from '@barocss/cad';
import { holeCallout } from '../drawing/callout';
import { threadsOf } from '../app/threads';
import { SCALES, VIEWS, fromSheet, layoutSheet, scaleLabel, toSheet } from '../drawing/views';
import { angleBetween, edgeAt, inView, resolveLine, newDimensionId, orientFor, resolveDimension, roundIn, snapPoints, type SnapPoint } from '../drawing/dimensions';
import { VIEW_IDS, modelPrint, nextRevision, type DimPoint, type DrawingNote, type EdgeRef, type Tolerance, type DrawingDimension, type DrawingSettings, type DrawingViews, type Vec3, type ViewId, type XY } from '../drawing/types';
import { downloadBytes } from './files';
import { Icon, Kbd } from './atoms';
import type { SectionResult } from '../drawing/section';
import '../drawing/drawing.css';

type Tool = 'select' | 'linear' | 'diameter' | 'radius' | 'angle' | 'note';
const TOOLS: { tool: Tool; label: string; icon: string; key: string; hint: string }[] = [
  { tool: 'select', label: 'Select', icon: 'arrow_selector_tool', key: 'V', hint: 'Click a dimension to select it, drag to move it · Delete removes it · drag the paper to pan, scroll to zoom' },
  { tool: 'linear', label: 'Linear dimension', icon: 'straighten', key: 'D', hint: 'Click two points (edge ends, circle centres) or one straight edge, then where the dimension goes' },
  { tool: 'diameter', label: 'Diameter', icon: 'radio_button_unchecked', key: 'Ø', hint: 'Click a circle, then where its diameter goes' },
  { tool: 'radius', label: 'Radius', icon: 'line_end_circle', key: 'R', hint: 'Click a circle or an arc, then where its radius goes' },
  { tool: 'angle', label: 'Angle', icon: 'architecture', key: 'A', hint: 'Click two straight edges, then the side of their corner the angle goes on' },
  { tool: 'note', label: 'Note', icon: 'sticky_note_2', key: 'N', hint: 'Click on the paper for a note, or on a view for a leader and then where its text goes' },
];
type Pending =
  | { kind: 'linear'; view: ViewId; a: DimPoint; b?: DimPoint }
  | { kind: 'diameter' | 'radius'; view: ViewId; edge: string; near: Vec3 }
  | { kind: 'angle'; view: ViewId; a: EdgeRef; b?: EdgeRef }
  | { kind: 'note'; leader: { view: ViewId; at: XY } };
/** `q`: the pointer on the sheet (mm); `at`: in the view under it (model mm). */
interface Hover { q: XY; view: ViewId; at: XY; snap: SnapPoint | null; edge: ProjectedEdge | null }

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function DrawingWorkspace({ engine, doc, settings, fileName, onChange, onToast }: {
  engine: EngineClient; doc: StudioDoc; settings: DrawingSettings; fileName: string;
  onChange(next: DrawingSettings): void; onToast(e: FriendlyError): void;
}) {
  const [views, setViews] = useState<DrawingViews | null>(null);
  /** Section A–A as last projected (or why it could not be cut). */
  const [section, setSection] = useState<SectionResult | null>(null);
  const [sectionY, setSectionY] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The part has no body yet: the panel says so, and nothing is raised as an error. */
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [tool, setTool] = useState<Tool>('select');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; place: XY } | { note: string; at: XY; grab: XY } | { pan: XY; box: [number, number, number, number] } | null>(null);
  /** The selected note's text while it is typed, and the selected dimension's tolerance fields. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [tolDraft, setTolDraft] = useState<Record<string, string>>({});
  /** A note just added: its text box takes the keyboard, its placeholder text selected. */
  const noteBox = useRef<HTMLTextAreaElement>(null), [typeNote, setTypeNote] = useState<string | null>(null);
  // (Once the new note has come back in the settings and its text box shows it.)
  const shownNote = selected && settings.notes?.some(n => n.id === selected) ? selected : null;
  useEffect(() => {
    if (!typeNote || shownNote !== typeNote) return;
    const t = setTimeout(() => { noteBox.current?.focus(); noteBox.current?.select(); setTypeNote(null); }, 0);
    return () => clearTimeout(t);
  }, [typeNote, shownNote]);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // Project the part (and its shown instances) whenever they change; of the drawing settings only tangent edges change the views.
  const model = useMemo(() => doc, [doc.nodes, doc.parameters, JSON.stringify((doc.instances ?? []).map(i => [i.id, i.hidden, i.position, i.rotation, i.doc.nodes.length]))]);
  useEffect(() => {
    let live = true; setBusy(true);
    engine.drawing(model, { tangentEdges: !!settings.tangent, ...(settings.section ? { section: settings.section } : {}) }).then(r => {
      if (!live) return;
      setBusy(false);
      setEmpty(!r.ok && !!r.empty);
      if (r.ok) { setViews(r.views); setSection(r.section ?? null); setError(null); } else { setViews(null); setSection(null); setError(r.error); }
    });
    return () => { live = false; };
  }, [engine, model, settings.tangent, settings.section?.y]);

  const title = settings.title ?? fileName;
  const cut = settings.section && section?.ok ? section : undefined;
  const layout = useMemo(() => views && layoutSheet(views, settings, cut?.projection), [views, settings, cut]);
  // Diameter dimensions on a hole read as its callout (count, size or thread, depth, counterbore or countersink).
  const callout = useCallback((edge: string) => holeCallout(doc.nodes, edge), [doc.nodes]);
  const threads = useMemo(() => threadsOf(doc.nodes), [doc.nodes]);
  const sheet = useMemo(() => views && layout && buildSheet(views, layout, settings, { title, date: today(), callout, threads }, cut), [views, layout, settings, title, cut, callout, threads]);
  // The drawing's issue list (R14.2, O3): what is wrong on the sheet, then what is missing; fixes where safe.
  const issues = useMemo<DrawingIssue[]>(() => views && layout && sheet ? drawingIssues({ views, layout, settings, sheet, callout }) : [], [views, layout, settings, sheet, callout]);
  const fixIssue = (x: DrawingIssue) => { if (views && layout && sheet && x.fix) onChange(applyFix({ views, layout, settings, sheet, callout }, x.fix)); };
  const fixEvery = () => {
    if (!views) return;
    const r = fixAll({ views, settings, callout, meta: { title, date: today(), threads }, ...(cut ? { section: cut } : {}) });
    onChange(r.settings);
    onToast({ title: `${r.applied.length} fix${r.applied.length === 1 ? '' : 'es'} applied`, hint: r.left.length ? `${r.left.length} issue${r.left.length === 1 ? '' : 's'} left: ${r.left[0].message}` : 'The drawing has no issues.', detail: r.left.slice(1).map(x => x.message).join('\n') });
  };
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
      if (layout.views[id].hidden) continue;
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
    if (pending?.kind === 'note') { addNote(h.q, pending.leader); return; }
    const placing = pending && ((pending.kind !== 'linear' && pending.kind !== 'angle') || pending.b);
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
    if (tool === 'angle') {
      if (pending?.kind === 'angle' && pending.b) {
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: 'angle', a: pending.a, b: pending.b, place }]);
        setPending(null); return;
      }
      // (A straight edge under the pointer, even near its ends.)
      const e = h.edge ?? edgeAt(pr, h.at, 6 * mmPerPx() / (layout?.views[h.view].scale ?? 1));
      if (!e || !e.ends || e.circle || (e.kind !== 'line' && e.kind !== 'silhouette')) { setMessage('Click a straight edge.'); return; }
      const ref: EdgeRef = { edge: e.name, near: [0, 1, 2].map(k => (e.ends![0][k] + e.ends![1][k]) / 2) as Vec3 };
      if (!pending || pending.kind !== 'angle') { setPending({ kind: 'angle', view: h.view, a: ref }); return; }
      if (pending.view !== h.view) { setMessage('Pick the second edge in the same view.'); return; }
      const a = resolveLine(pr, pending.a), b = resolveLine(pr, ref);
      if (!a || !b || !angleBetween(a, b, h.at)) { setMessage('These edges are parallel here — pick one that meets the first at an angle.'); return; }
      setPending({ ...pending, b: ref }); return;
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

  /** A new note at a sheet point (with a leader to a view point), selected with its text ready to type. */
  const addNote = (at: XY, leader?: { view: ViewId; at: XY }) => {
    const used = new Set((settings.notes ?? []).map(n => n.id)); let k = 1; while (used.has(`n${k}`)) k++;
    const note: DrawingNote = { id: `n${k}`, text: 'NOTE', at: [Math.round(at[0] * 10) / 10, Math.round(at[1] * 10) / 10], ...(leader ? { leader } : {}) };
    onChange({ ...settings, notes: [...(settings.notes ?? []), note] });
    setPending(null); setTool('select'); setSelected(note.id); setNoteDraft(note.text); setTypeNote(note.id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = (e.target as Element).closest('[data-dim]');
    if (tool === 'note') e.preventDefault(); // (the note's text box keeps the focus it is given)
    if (tool === 'note' && !pending) {
      // On (or right by) a view: the leader's point first; elsewhere the note itself.
      const q = sheetPoint(e.clientX, e.clientY), h = hoverAt(e.clientX, e.clientY); if (!q || !layout) return;
      const [x0, y0, x1, y1] = h ? layout.views[h.view].box : [0, 0, 0, 0], on = h && q[0] >= x0 - 3 && q[0] <= x1 + 3 && q[1] >= y0 - 3 && q[1] <= y1 + 3;
      if (h && on) { setPending({ kind: 'note', leader: { view: h.view, at: h.snap?.at ?? h.at } }); setMessage(null); } else addNote(q);
      return;
    }
    if (tool === 'note' && pending?.kind === 'note') { const q = sheetPoint(e.clientX, e.clientY); if (q) addNote(q, pending.leader); return; }
    if (tool === 'select') {
      const id = target?.getAttribute('data-dim') ?? null;
      setSelected(id); setNoteDraft(null); setTolDraft({});
      const d = id ? settings.dimensions.find(x => x.id === id) : undefined, n = id ? settings.notes?.find(x => x.id === id) : undefined, q = sheetPoint(e.clientX, e.clientY);
      if (n) setNoteDraft(n.text);
      if (d) setDrag({ id: d.id, place: d.place });
      else if (n && q) setDrag({ note: n.id, at: n.at, grab: [q[0] - n.at[0], q[1] - n.at[1]] });
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
    if (drag && 'note' in drag) {
      const q = sheetPoint(e.clientX, e.clientY);
      if (q) setDrag({ ...drag, at: [Math.round((q[0] - drag.grab[0]) * 10) / 10, Math.round((q[1] - drag.grab[1]) * 10) / 10] });
      return;
    }
    if (drag && layout) {
      const q = sheetPoint(e.clientX, e.clientY), d = settings.dimensions.find(x => x.id === drag.id);
      if (q && d) setDrag({ id: drag.id, place: fromSheet(layout.views[d.view], q) });
      return;
    }
    setHover(hoverAt(e.clientX, e.clientY));
  };
  const onPointerUp = () => {
    if (drag && 'note' in drag) {
      const n = settings.notes?.find(x => x.id === drag.note);
      if (n && (n.at[0] !== drag.at[0] || n.at[1] !== drag.at[1])) onChange({ ...settings, notes: settings.notes!.map(x => x.id === n.id ? { ...x, at: drag.at } : x) });
      setDrag(null); return;
    }
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

  const remove = useCallback((id: string) => {
    if (settings.notes?.some(n => n.id === id)) { const notes = settings.notes.filter(n => n.id !== id), rest = { ...settings }; delete rest.notes; onChange(notes.length ? { ...rest, notes } : rest); }
    else commitDims(settings.dimensions.filter(d => d.id !== id));
    setSelected(null); setNoteDraft(null);
  },
    [settings]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') { if (pending) cancel(); else { setSelected(null); setTool('select'); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(selected); return; }
      const t = ({ v: 'select', d: 'linear', o: 'diameter', r: 'radius', a: 'angle', n: 'note' } as Record<string, Tool>)[e.key.toLowerCase()];
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
      hidden: Object.fromEntries(VIEW_IDS.map(id => [id, views![id].edges.reduce((n, e) => n + e.pieces.filter(p => !p.visible).length, 0)])),
      section: section ? (section.ok ? { rings: section.rings.length, edges: section.projection.edges.length } : { error: section.error }) : null,
      issues: issues.map(x => ({ code: x.code, severity: x.severity, ...(x.fix ? { fix: x.fix.kind } : {}) })) };
    return () => { delete w.__studioDrawingAt; delete w.__studioDrawing; };
  }, [layout, sheet, views, section, issues]);

  const exportSvg = () => { if (sheet) downloadBytes(new TextEncoder().encode(sheetSvg(sheet, title)), `${fileName}.svg`, 'image/svg+xml'); };
  const exportPdf = () => {
    if (!sheet) return;
    downloadBytes(sheetPdf(sheet, title), `${fileName}.pdf`, 'application/pdf');
    const missing = pdfMissing(sheet);
    if (missing.length) onToast({ title: 'PDF written, with some characters as ?', hint: `The PDF's standard fonts cannot show ${missing.map(c => `“${c}”`).join(' ')}: they print as ?. The SVG export keeps them.`, detail: '' });
  };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  /**
   * Auto (R14.1–R14.3, O2–O4): the views chosen and laid out with room for their dimensions, the scale and sheet that
   * give a clean drawing, then Auto-dimension; its own earlier dimensions replaced, those placed by hand kept.
   */
  const autoDimension = () => {
    if (!views) return;
    const { settings: next, report } = autoLayout({ views, settings, callout, meta: { title, date: today(), threads }, ...(cut ? { section: cut } : {}) });
    onChange(next);
    const a = report.dimensions.added, n = a.overall + a.levels + a.holePositions + a.pitches + a.callouts;
    const where = `${report.sheet} at ${scaleLabel(report.scale)}${report.dropped.length ? `, without the ${report.dropped.join(' and ')} view (it shows nothing the others do)` : ''}`;
    const notes = [...report.dimensions.skipped.map(x => `${x.what} (${x.view}): ${x.why}`), ...report.left.map(x => x.message), ...(report.readable ? [] : [`The smallest hole is under ${MIN_HOLE_ON_PAPER_MM} mm on paper at this scale: a larger sheet reads better.`])];
    onToast({ title: `${n} dimension${n === 1 ? '' : 's'} placed · ${where}`, hint: `${a.overall} overall, ${plural(a.levels, 'step')}, ${plural(a.holePositions + a.pitches, 'hole position')}, ${plural(a.callouts, 'callout')}${report.dimensions.kept ? `; ${report.dimensions.kept} of yours kept` : ''}${report.left.length ? `; ${plural(report.left.length, 'issue')} left` : ''}.`, detail: notes.join('\n') });
  };
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('AC1015');
  const dxfFailed = (e: unknown) => onToast({ title: 'Could not write the DXF', hint: 'Nothing was downloaded.', detail: e instanceof Error ? e.message : String(e) });
  const exportDxf = () => {
    if (!sheet || !layout) return;
    try {
      const r = sheetDxf(sheet, layout, dxfVersion);
      downloadBytes(r.bytes, `${fileName}.dxf`, 'image/vnd.dxf');
      // R12 has no ellipses, splines, hatches, line weights or units: say what was changed to fit it.
      if (r.report.r12) { const x = r.report.r12, n = x.ellipses + x.splines; onToast({ title: 'DXF R12 written', hint: `${n ? `${n} curve${n > 1 ? 's' : ''} as polylines within 0.001 mm; ` : ''}${x.hatches ? 'hatching as lines; ' : ''}no line weights or units in R12 (the drawing is in mm).`, detail: '' }); }
    } catch (e) { dxfFailed(e); }
  };
  const exportSectionDxf = () => {
    if (!cut) return;
    try { downloadBytes(writeDxf(sectionDxfDocument(cut), { version: dxfVersion }).bytes, `${fileName}-section-A-A.dxf`, 'image/vnd.dxf'); } catch (e) { dxfFailed(e); }
  };
  useEffect(() => { if (error && !empty) onToast({ title: 'Could not draw the part', hint: 'Fix the model’s errors first, then open the drawing again.', detail: error }); }, [error, empty]);

  // What follows the cursor: the snap, the hovered edge, and the dimension being placed or dragged.
  const overlay = useMemo(() => {
    if (!layout || !views) return '';
    const parts: string[] = [];
    const v = hover ? layout.views[hover.view] : null;
    if (pending?.kind === 'note' && hover) {
      const t = toSheet(layout.views[pending.leader.view], pending.leader.at);
      parts.push(`<g class="dw-preview"><line x1="${t[0]}" y1="${t[1]}" x2="${hover.q[0]}" y2="${hover.q[1]}" stroke-width="0.25"/></g><circle class="dw-pick" cx="${t[0]}" cy="${t[1]}" r="0.9"/>`);
      return parts.join('');
    }
    const placing = pending && hover && pending.kind !== 'note' && ((pending.kind !== 'linear' && pending.kind !== 'angle') || pending.b);
    if (pending?.kind === 'angle') for (const ref of [pending.a, ...(pending.b ? [pending.b] : [])]) {
      const l = resolveLine(views[pending.view], ref);
      if (l) parts.push(`<g class="dw-hover">${marksSvg([{ kind: 'line', a: toSheet(layout.views[pending.view], l[0]), b: toSheet(layout.views[pending.view], l[1]), pen: 'visible' }])}</g>`);
    }
    if (pending?.kind === 'linear') for (const ref of [pending.a, ...(pending.b ? [pending.b] : [])]) {
      const q = toSheet(layout.views[pending.view], pointIn(views[pending.view], ref)); parts.push(`<circle class="dw-pick" cx="${q[0]}" cy="${q[1]}" r="0.9"/>`);
    }
    if (placing && hover) {
      const at = fromSheet(layout.views[pending.view], hover.q);
      const d: DrawingDimension = pending.kind === 'linear'
        ? { id: 'preview', view: pending.view, kind: 'linear', a: pending.a, b: pending.b!, orient: orientFor(pointIn(views[pending.view], pending.a), pointIn(views[pending.view], pending.b!), at), place: at }
        : pending.kind === 'angle' ? { id: 'preview', view: pending.view, kind: 'angle', a: pending.a, b: pending.b!, place: at }
        : { id: 'preview', view: pending.view, kind: pending.kind, edge: pending.edge, near: pending.near, place: at };
      const r = resolveDimension(views, d);
      if (r.ok) parts.push(`<g class="dw-preview">${marksSvg(dimensionMarks(layout.views[pending.view], r))}</g>`);
    } else if (hover && v && tool !== 'select') {
      if (hover.snap && tool === 'linear') { const q = toSheet(v, hover.snap.at); parts.push(`<circle class="dw-snap" cx="${q[0]}" cy="${q[1]}" r="1.4"/>`); }
      else if (hover.edge && (tool !== 'linear' || !pending)) {
        const ok = tool === 'linear' || tool === 'angle' ? hover.edge.kind !== 'circle' && hover.edge.kind !== 'curve' : !!hover.edge.circle && roundIn(views[hover.view], hover.edge);
        if (ok) parts.push(`<g class="dw-hover">${marksSvg(hover.edge.pieces.map(p => curveMark(v, p.curve, 'visible')))}</g>`);
      }
    }
    return parts.join('');
  }, [layout, views, hover, pending, tool]);

  // The dimension being dragged is drawn where it goes.
  const shownMarkup = useMemo(() => {
    if (!drag || 'pan' in drag || !views || !layout || !sheet) return sheetMarkup;
    if ('note' in drag) return sheetGroupsSvg(buildSheet(views, layout, { ...settings, notes: (settings.notes ?? []).map(n => n.id === drag.note ? { ...n, at: drag.at } : n) }, { title, date: today(), callout, threads }, cut), selected);
    const dims = settings.dimensions.map(d => d.id === drag.id ? (d.kind === 'linear' ? { ...d, place: drag.place, orient: orientFor(pointIn(views[d.view], d.a), pointIn(views[d.view], d.b), drag.place) } : { ...d, place: drag.place }) : d);
    return sheetGroupsSvg(buildSheet(views, layout, { ...settings, dimensions: dims }, { title, date: today(), callout, threads }, cut), selected);
  }, [drag, views, layout, sheet, sheetMarkup, settings, title, selected]);

  const hint = message ?? (pending ? (pending.kind === 'note' ? 'Click where the note’s text goes · Esc cancels' : pending.kind === 'angle' && !pending.b ? 'Now the second edge · Esc cancels' : pending.kind === 'linear' && !pending.b ? 'Now the second point · Esc cancels' : 'Click where the dimension goes · Esc cancels') : TOOLS.find(t => t.tool === tool)!.hint);
  const lost = sheet?.dimensions.filter(r => !r.ok) ?? [];
  const selDim = selected ? settings.dimensions.find(d => d.id === selected) : undefined, selNote = selected ? settings.notes?.find(n => n.id === selected) : undefined;

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
        <label className="field"><span>Scale</span><select aria-label="Scale" value={settings.scale ?? 'auto'} onChange={e => { const v = e.target.value; const rest = { ...settings }; delete rest.scale; onChange(v === 'auto' ? rest : { ...rest, scale: Number(v) }); }}>
          <option value="auto">Auto{layout && settings.scale === undefined ? ` (${scaleLabel(layout.scale)})` : ''}</option>
          {SCALES.map(s => <option key={s} value={s}>{scaleLabel(s)}</option>)}</select></label>
        <label className="field"><span>Projection</span><select aria-label="Projection" value={settings.projection} onChange={e => onChange({ ...settings, projection: e.target.value as 'third' })}>
          <option value="third">Third angle</option><option value="first">First angle</option></select></label>
        <label className="field"><span>Hidden lines</span><input type="checkbox" className="check" aria-label="Hidden lines" checked={settings.hidden} onChange={e => onChange({ ...settings, hidden: e.target.checked })} /></label>
        <label className="field"><span>Section A–A</span><input type="checkbox" className="check" aria-label="Section A–A" checked={!!settings.section} onChange={e => {
          const rest = { ...settings }; delete rest.section;
          // By default through the middle of the part, front to back.
          onChange(e.target.checked && views ? { ...rest, section: { y: Math.round((views.top.min[1] + views.top.max[1]) / 2 * 100) / 100 } } : rest);
        }} /></label>
        {settings.section && <label className="field"><span>Cut at Y</span><span className="num"><input type="number" step="any" aria-label="Section Y" value={sectionY ?? settings.section.y}
          onChange={e => setSectionY(e.target.value)}
          onBlur={() => { const y = Number(sectionY); if (sectionY !== null && sectionY.trim() !== '' && Number.isFinite(y)) onChange({ ...settings, section: { y } }); setSectionY(null); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /><em>mm</em></span></label>}
        {settings.section && section && !section.ok && <div className="empty" style={{ color: 'var(--warn)' }}>Section A–A: {section.error}</div>}
        {(['right', 'iso'] as const).map(v => <label key={v} className="field"><span>{v === 'right' ? 'Right view' : 'Isometric view'}</span><input type="checkbox" className="check" aria-label={v === 'right' ? 'Right view' : 'Isometric view'} checked={!settings.views || settings.views.includes(v)} onChange={e => {
          const on = new Set(settings.views ?? VIEW_IDS); if (e.target.checked) on.add(v); else on.delete(v);
          const next = { ...settings }; delete next.views; onChange(on.size === VIEW_IDS.length ? next : { ...next, views: VIEW_IDS.filter(x => on.has(x)) });
        }} /></label>)}
        <label className="field"><span>Tangent edges</span><input type="checkbox" className="check" aria-label="Tangent edges" checked={!!settings.tangent} onChange={e => { const rest = { ...settings }; delete rest.tangent; onChange(e.target.checked ? { ...rest, tangent: true } : rest); }} /></label>
        <label className="field"><span>Centre lines</span><input type="checkbox" className="check" aria-label="Centre lines" checked={settings.centers !== false} onChange={e => { const rest = { ...settings }; delete rest.centers; onChange(e.target.checked ? rest : { ...rest, centers: false }); }} /></label>
        <label className="field"><span>Title</span><input aria-label="Drawing title" value={titleDraft ?? title} onChange={e => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== null) { const rest = { ...settings }; delete rest.title; onChange(titleDraft.trim() && titleDraft.trim() !== fileName ? { ...rest, title: titleDraft.trim() } : rest); setTitleDraft(null); } }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
        {(() => { const print = modelPrint(doc.nodes), stale = !!settings.revision && !!settings.revisedModel && settings.revisedModel !== print;
          const set = (rev: string) => onChange(rev ? { ...settings, revision: rev, revisedModel: print } : (({ revision: _r, revisedModel: _m, ...rest }) => rest)(settings));
          return <>
            <label className="field"><span>Revision</span><input aria-label="Revision" value={settings.revision ?? ''} placeholder="-" maxLength={6} onChange={e => set(e.target.value.trim().toUpperCase())} />
              <button className="ghost small" aria-label="Next revision" data-tip="Next revision" data-tip-desc="A → B, 01 → 02: the drawing’s new issue" onClick={() => set(nextRevision(settings.revision))}>Next</button></label>
            {stale && <div className="empty" style={{ color: 'var(--warn)' }} aria-label="Revision out of date">The model changed since revision {settings.revision}: give the drawing its next revision when you issue it.</div>}
          </>; })()}
        {layout && !layout.fits && <div className="empty" style={{ color: 'var(--warn)' }}>The views do not fit the sheet at {scaleLabel(layout.scale)}. Pick a smaller scale or a larger sheet.</div>}

        <div className="card-title" style={{ marginTop: 8 }}>ISSUES <span className="muted" aria-label="Issue count">{issues.length}</span>
          {issues.some(x => x.fix) && <button className="ghost small" onClick={fixEvery} aria-label="Fix all issues" data-tip="Fix all" data-tip-desc="Every fix the list offers, one at a time, the sheet checked again after each">Fix all</button>}</div>
        <div className="dw-issues" aria-label="Drawing issues">
          {issues.map((x, k) => <div key={k} className={'dw-issue ' + x.severity} role="button" tabIndex={0} title={x.code}
            onClick={() => { const d = x.dims?.[0]; if (d) { setSelected(d); setTool('select'); } }}>
            <Icon name={x.severity === 'error' ? 'error' : 'warning'} small /><span>{x.message}</span>
            {x.fix && <button className="ghost tiny" aria-label={`Fix: ${x.message}`} onClick={e => { e.stopPropagation(); fixIssue(x); }}>{x.fix.kind === 'auto-dimension' ? 'Auto' : x.fix.kind === 'remove' ? 'Remove' : x.fix.kind === 'accept' ? 'Accept' : x.fix.kind === 'scale' ? (x.fix.sheet ? 'A3' : 'Auto scale') : 'Move'}</button>}
          </div>)}
          {!issues.length && views && <div className="empty">No issues: nothing overlaps or is lost, and every hole, step and overall size is given.</div>}
        </div>

        <div className="card-title" style={{ marginTop: 8 }}>DIMENSIONS <span className="muted">{settings.dimensions.length}</span>
          <button className="ghost small" disabled={!views || !layout} onClick={autoDimension} aria-label="Auto-dimension" data-tip="Auto-dimension" data-tip-desc="Views laid out with room, a scale and sheet that read cleanly, then overall sizes, steps, hole positions and callouts: replaces its own earlier ones, keeps yours">Auto</button></div>
        <div className="dw-dims">
          {sheet?.dimensions.map(r => <div key={r.dim.id} role="button" tabIndex={0} className={'dw-dim' + (selected === r.dim.id ? ' sel' : '') + (r.ok ? '' : ' lost')} title={r.ok ? undefined : r.reason}
            onClick={() => { setSelected(r.dim.id); setTool('select'); }}>
            <b>{r.ok ? r.text : 'lost'}{r.dim.tol ? ` ${toleranceText(r.dim.tol, r.dim.kind === 'angle' ? '°' : '')}` : ''}</b><span>{r.dim.kind === 'linear' ? r.dim.orient : r.dim.kind} · {r.dim.view}</span>
            <span className="muted" />
            <button className="tool tiny" aria-label={`Remove dimension ${r.ok ? r.text : r.dim.id}`} onClick={e => { e.stopPropagation(); remove(r.dim.id); }}><Icon name="close" small /></button>
          </div>)}
          {!settings.dimensions.length && <div className="empty">Pick a dimension tool (<Kbd>D</Kbd> linear, <Kbd>O</Kbd> diameter, <Kbd>R</Kbd> radius, <Kbd>A</Kbd> angle) and click in a view. Values come from the model in mm and follow it as it changes.</div>}
          {lost.length > 0 && <div className="empty" style={{ color: 'var(--warn)' }}>{lost.length} dimension{lost.length > 1 ? 's' : ''} lost {lost.length > 1 ? 'their' : 'its'} reference (the part changed).</div>}
        </div>

        {selDim && <>
          <div className="card-title" style={{ marginTop: 8 }}>TOLERANCE</div>
          <label className="field"><span>Kind</span><select aria-label="Tolerance" value={selDim.tol?.kind ?? 'none'} onChange={e => {
            const k = e.target.value, rest = { ...selDim }; delete rest.tol;
            const tol: Tolerance | null = k === 'symmetric' ? { kind: 'symmetric', value: 0.1 } : k === 'deviation' ? { kind: 'deviation', upper: 0.1, lower: 0 } : k === 'fit' ? { kind: 'fit', code: selDim.kind === 'diameter' ? 'H7' : 'h7' } : null;
            setTolDraft({}); commitDims(settings.dimensions.map(d => d.id === selDim.id ? (tol ? { ...rest, tol } : rest) as DrawingDimension : d));
          }}><option value="none">None</option><option value="symmetric">± symmetric</option><option value="deviation">Upper / lower</option><option value="fit">Fit (H7, h6 …)</option></select></label>
          {selDim.tol && (selDim.tol.kind === 'symmetric' ? [['value', '±']] : selDim.tol.kind === 'deviation' ? [['upper', 'Upper'], ['lower', 'Lower']] : [['code', 'Fit']]).map(([key, label]) => {
            const t = selDim.tol as Record<string, unknown>, shown = tolDraft[key] ?? String(t[key]);
            const apply = () => {
              const raw = tolDraft[key]; if (raw === undefined) return;
              const next = { ...t, [key]: key === 'code' ? raw.trim() : Number(raw) } as Tolerance;
              const ok = next.kind === 'fit' ? /^[A-Za-z]{1,2}\d{1,2}$/.test(next.code) : next.kind === 'symmetric' ? Number.isFinite(next.value) && next.value > 0 : Number.isFinite(next.upper) && Number.isFinite(next.lower) && next.upper >= next.lower;
              if (ok) commitDims(settings.dimensions.map(d => d.id === selDim.id ? { ...d, tol: next } as DrawingDimension : d));
              else setMessage(next.kind === 'fit' ? 'A fit is a letter or two and a grade, as H7 or js6.' : next.kind === 'symmetric' ? 'A ± tolerance is a number above 0.' : 'The upper deviation must not be below the lower.');
              setTolDraft(m => { const rest = { ...m }; delete rest[key]; return rest; });
            };
            return <label key={key} className="field"><span>{label}</span><input aria-label={`Tolerance ${label}`} type={key === 'code' ? 'text' : 'number'} step="any" value={shown}
              onChange={e => setTolDraft(m => ({ ...m, [key]: e.target.value }))} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>;
          })}
        </>}

        <div className="card-title" style={{ marginTop: 8 }}>NOTES <span className="muted">{settings.notes?.length ?? 0}</span></div>
        <div className="dw-dims">
          {(settings.notes ?? []).map(n => <div key={n.id} role="button" tabIndex={0} className={'dw-dim' + (selected === n.id ? ' sel' : '')} onClick={() => { setSelected(n.id); setNoteDraft(n.text); setTool('select'); }}>
            <b className="dw-note-text">{n.text.split('\n')[0]}</b><span>{n.leader ? `→ ${n.leader.view}` : ''}</span><span className="muted" />
            <button className="tool tiny" aria-label={`Remove note ${n.id}`} onClick={e => { e.stopPropagation(); remove(n.id); }}><Icon name="close" small /></button>
          </div>)}
          {!settings.notes?.length && <div className="empty"><Kbd>N</Kbd> adds a note: click the paper, or a view for a leader first.</div>}
          {selNote && <>
            <textarea ref={noteBox} className="dw-note-edit" aria-label="Note text" rows={3} value={noteDraft ?? selNote.text}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => { const t = (noteDraft ?? selNote.text).replace(/\s+$/, ''); if (t && t !== selNote.text) onChange({ ...settings, notes: settings.notes!.map(n => n.id === selNote.id ? { ...n, text: t } : n) }); setNoteDraft(null); }}
              onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur(); }} />
            {selNote.leader && <button className="ghost" onClick={() => onChange({ ...settings, notes: settings.notes!.map(n => n.id === selNote.id ? { id: n.id, text: n.text, at: n.at } : n) })}>Remove leader</button>}
          </>}
        </div>

        <div className="card-title" style={{ marginTop: 8 }}>EXPORT</div>
        <div className="dw-actions">
          <button className="primary" disabled={!sheet} onClick={exportSvg} aria-label="Export SVG"><Icon name="download" small /> SVG</button>
          <button className="ghost" disabled={!sheet} onClick={exportPdf} aria-label="Export PDF">PDF</button>
          <button className="ghost" disabled={!sheet} onClick={exportDxf} aria-label="Export DXF" title="The sheet as DXF, at true size in mm, layers by line kind">DXF</button>
          <select aria-label="DXF version" value={dxfVersion} onChange={e => setDxfVersion(e.target.value as DxfVersion)} title="DXF 2000, or R12 for older programs (curves as polylines)">
            <option value="AC1015">2000</option><option value="AC1009">R12</option>
          </select>
          {cut && <button className="ghost" onClick={exportSectionDxf} aria-label="Export section DXF" title="Section A–A alone, 1:1 in model mm">A–A DXF</button>}
        </div>
        {sheet && <div className="empty">{scaleLabel(layout!.scale)} · {settings.sheet} · {VIEW_IDS.map(id => `${VIEWS[id].label.toLowerCase()} ${views![id].edges.length}`).join(', ')} edges</div>}
      </aside>

      <div className={'card dw-hint' + (message ? ' warn' : '')} role="status">
        <span>{hint}</span>
        {selected && <span><Kbd>Del</Kbd> remove</span>}
        <span><Kbd>V</Kbd> <Kbd>D</Kbd> <Kbd>O</Kbd> <Kbd>R</Kbd> <Kbd>A</Kbd> <Kbd>N</Kbd> tools</span>
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
