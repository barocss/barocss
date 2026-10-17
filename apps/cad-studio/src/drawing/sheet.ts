// The sheet as a display list in sheet millimetres (y down): frame, title block, the projected views
// and the dimensions. The SVG and PDF writers and the workspace all draw from it.
import type { BrepProjection, ProjectedCurve } from '@barocss/cad';
import { fmtMM, resolveDimension, type Resolved } from './dimensions';
import { centreMarks } from './centres';
import { fitText, textWidth } from './text';
import { VIEWS, scaleLabel, toSheet, type SheetLayout, type ViewPlacement, TITLE_BLOCK } from './views';
import type { DrawingNote, DrawingSettings, DrawingViews, Tolerance, ViewId, XY } from './types';
import { VIEW_IDS } from './types';

/** visible 0.5, hidden 0.35 dashed, thin 0.25 (dimensions, title block rules), centre 0.25 chain, frame 0.7. */
export type Pen = 'visible' | 'hidden' | 'thin' | 'center' | 'frame';
export const PENS: Record<Pen, { width: number; dash?: number[] }> = {
  visible: { width: 0.5 }, hidden: { width: 0.35, dash: [3, 1.5] }, thin: { width: 0.25 }, center: { width: 0.25, dash: [8, 1.5, 1.5, 1.5] }, frame: { width: 0.7 },
};
export type Mark =
  | { kind: 'line'; a: XY; b: XY; pen: Pen }
  /** `center + u·cos t + v·sin t`, t from t0 to t1 (sheet mm). */
  | { kind: 'arc'; center: XY; u: XY; v: XY; t0: number; t1: number; pen: Pen }
  | { kind: 'polyline'; points: XY[]; pen: Pen }
  | { kind: 'fill'; points: XY[] }
  /** `angle`: degrees, counter-clockwise as read on the sheet. */
  | { kind: 'text'; at: XY; text: string; size: number; anchor: 'start' | 'middle' | 'end'; angle?: number; bold?: boolean };
export interface MarkGroup { role: 'frame' | 'title' | 'view' | 'label' | 'dimension' | 'section' | 'note'; id?: string; view?: ViewId; marks: Mark[] }
export interface Sheet { size: [number, number]; groups: MarkGroup[]; dimensions: Resolved[] }

export const TEXT = 3.5;
const ARROW = 3, ARROW_HALF = 0.6, GAP = 1, OVER = 2;

/** `section`: section A–A's projection and cut-face rings (view coordinates), drawn when the layout places it. */
/** `meta.callout`: a diameter dimension's text from the feature it measures (a hole callout), or null for Ø. */
export function buildSheet(views: DrawingViews, layout: SheetLayout, settings: DrawingSettings, meta: { title: string; date: string; callout?: (edge: string) => string | null }, section?: { projection: BrepProjection; rings: XY[][] }): Sheet {
  const groups: MarkGroup[] = [];
  const [W, H] = layout.size, f = layout.frame;
  groups.push({ role: 'frame', marks: [rect([0, 0, W, H], 'thin'), rect(f, 'frame')].flat() });
  groups.push({ role: 'title', marks: titleBlock(layout, settings, meta) });
  for (const id of VIEW_IDS) {
    const v = layout.views[id], pr = views[id], marks: Mark[] = [];
    const showHidden = settings.hidden && id !== 'iso';
    // Hidden pieces first, so visible ink covers them where they touch.
    for (const visible of [false, true]) for (const e of pr.edges) for (const p of e.pieces) {
      if (p.visible !== visible || (!visible && !showHidden)) continue;
      marks.push(curveMark(v, p.curve, !visible ? 'hidden' : e.tangent ? 'thin' : 'visible'));
    }
    if (id !== 'iso' && settings.centers !== false) marks.push(...centreMarks(v, pr));
    groups.push({ role: 'view', view: id, marks });
  }
  const dimensions = settings.dimensions.map(d => resolveDimension(views, d)).map(r => r.ok && r.kind === 'diameter' && meta.callout ? { ...r, text: meta.callout(r.dim.edge) ?? r.text } : r);
  for (const r of dimensions) if (r.ok) groups.push({ role: 'dimension', id: r.dim.id, view: r.dim.view, marks: dimensionMarks(layout.views[r.dim.view], r) });
  for (const n of settings.notes ?? []) groups.push({ role: 'note', id: n.id, marks: noteMarks(layout, n) });
  // Each view's name under it, below any dimension placed under the view.
  for (const id of VIEW_IDS) {
    const [x0, , x1, y1] = layout.views[id].box;
    let below = y1;
    for (const g of groups) if (g.role === 'dimension' && g.view === id) for (const m of g.marks) for (const p of markPoints(m)) if (p[0] >= x0 - 2 && p[0] <= x1 + 2 && p[1] > below) below = p[1];
    groups.push({ role: 'label', view: id, marks: [{ kind: 'text', at: [(x0 + x1) / 2, below + 7], text: VIEWS[id].label, size: 2.5, anchor: 'middle' }] });
  }
  if (section && layout.section && settings.section) {
    // Section A–A under the front view's name (dimensions under the front view push it down).
    const front = groups.find(g => g.role === 'label' && g.view === 'front')!.marks[0] as Extract<Mark, { kind: 'text' }>;
    const shift = Math.max(0, front.at[1] + 6 - layout.section.box[1]), at = layout.section;
    const placed = { ...at, origin: [at.origin[0], at.origin[1] + shift] as XY, box: [at.box[0], at.box[1] + shift, at.box[2], at.box[3] + shift] as [number, number, number, number] };
    groups.push({ role: 'section', marks: sectionMarks({ ...layout, section: placed }, views, section, settings.section.y) });
    const [x0, , x1, y1] = placed.box;
    groups.push({ role: 'label', marks: [{ kind: 'text', at: [(x0 + x1) / 2, y1 + 7], text: 'SECTION A–A', size: 2.5, anchor: 'middle' }] });
  }
  return { size: [W, H], groups, dimensions };
}

export function curveMark(v: ViewPlacement, c: ProjectedCurve, pen: Pen): Mark {
  if (c.kind === 'line') return { kind: 'line', a: toSheet(v, c.a), b: toSheet(v, c.b), pen };
  if (c.kind === 'polyline') return { kind: 'polyline', points: c.points.map(p => toSheet(v, p)), pen };
  return { kind: 'arc', center: toSheet(v, c.center), u: [v.scale * c.u[0], -v.scale * c.u[1]], v: [v.scale * c.v[0], -v.scale * c.v[1]], t0: c.t0, t1: c.t1, pen };
}

/** Points a mark reaches (a text's baseline point; an arc sampled). */
function markPoints(m: Mark): XY[] {
  switch (m.kind) {
    case 'line': return [m.a, m.b];
    case 'polyline': case 'fill': return m.points;
    case 'text': return [m.at];
    case 'arc': return Array.from({ length: 9 }, (_, k) => { const t = m.t0 + (m.t1 - m.t0) * k / 8; return [m.center[0] + m.u[0] * Math.cos(t) + m.v[0] * Math.sin(t), m.center[1] + m.u[1] * Math.cos(t) + m.v[1] * Math.sin(t)] as XY; });
  }
}

const rect = ([x0, y0, x1, y1]: readonly number[], pen: Pen): Mark[] => [
  { kind: 'line', a: [x0, y0], b: [x1, y0], pen }, { kind: 'line', a: [x1, y0], b: [x1, y1], pen },
  { kind: 'line', a: [x1, y1], b: [x0, y1], pen }, { kind: 'line', a: [x0, y1], b: [x0, y0], pen },
];

/** The title's room: from 2 mm in to 2 mm short of the projection symbol (its left edge at 59 mm from the right). */
export const TITLE_ROOM = TITLE_BLOCK.width - 2 - 59 - 2;

function titleBlock(layout: SheetLayout, settings: DrawingSettings, meta: { title: string; date: string }): Mark[] {
  const [x0, y0, x1, y1] = layout.title, marks: Mark[] = rect(layout.title, 'frame');
  const mid = y0 + 14, cols = [x0, x0 + 24, x0 + 42, x0 + 72, x0 + 90, x1];
  marks.push({ kind: 'line', a: [x0, mid], b: [x1, mid], pen: 'thin' });
  for (const x of cols.slice(1, -1)) marks.push({ kind: 'line', a: [x, mid], b: [x, y1], pen: 'thin' });
  marks.push({ kind: 'text', at: [x0 + 2, y0 + 4], text: 'TITLE', size: 1.8, anchor: 'start' });
  // Each field fits its cell: shrunk to a floor, then cut with an ellipsis. The title runs up to the projection symbol.
  marks.push({ kind: 'text', at: [x0 + 2, y0 + 11], ...fitText(meta.title, 5, true, TITLE_ROOM, 3), anchor: 'start', bold: true });
  marks.push({ kind: 'text', at: [x1 - 2, y0 + 4], text: 'barocss cad-studio', size: 1.8, anchor: 'end' });
  const cells: [string, string][] = [['SCALE', scaleLabel(layout.scale)], ['UNITS', 'mm'], ['DATE', meta.date], ['REV', settings.revision ?? '-'], ['SHEET', settings.sheet]];
  cells.forEach(([k, val], i) => {
    marks.push({ kind: 'text', at: [cols[i] + 2, mid + 4], text: k, size: 1.8, anchor: 'start' });
    marks.push({ kind: 'text', at: [cols[i] + 2, mid + 12], ...fitText(val, 3.5, true, cols[i + 1] - cols[i] - 4, 2.2), anchor: 'start', bold: true });
  });
  marks.push(...projectionSymbol([x1 - 52, y0 + 7], settings.projection));
  marks.push({ kind: 'text', at: [x1 - 42, y0 + 11.5], text: settings.projection === 'third' ? 'THIRD ANGLE' : 'FIRST ANGLE', size: 1.8, anchor: 'start' });
  return marks;
}

/** The projection symbol: a truncated cone's side view and end view (side view left for third angle). */
function projectionSymbol([cx, cy]: XY, projection: DrawingSettings['projection']): Mark[] {
  const cone = (x: number): Mark[] => [
    { kind: 'line', a: [x - 3, cy - 1.5], b: [x + 3, cy - 3], pen: 'thin' }, { kind: 'line', a: [x + 3, cy - 3], b: [x + 3, cy + 3], pen: 'thin' },
    { kind: 'line', a: [x + 3, cy + 3], b: [x - 3, cy + 1.5], pen: 'thin' }, { kind: 'line', a: [x - 3, cy + 1.5], b: [x - 3, cy - 1.5], pen: 'thin' },
  ];
  const end = (x: number): Mark[] => [
    { kind: 'arc', center: [x, cy], u: [3, 0], v: [0, 3], t0: 0, t1: 2 * Math.PI, pen: 'thin' },
    { kind: 'arc', center: [x, cy], u: [1.5, 0], v: [0, 1.5], t0: 0, t1: 2 * Math.PI, pen: 'thin' },
  ];
  return projection === 'third' ? [...cone(cx - 4), ...end(cx + 4)] : [...end(cx - 4), ...cone(cx + 4)];
}

const unit = (v: XY): XY => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const add = (a: XY, b: XY, k = 1): XY => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const dot2 = (a: XY, b: XY) => a[0] * b[0] + a[1] * b[1];

/** A filled arrowhead with its tip at `tip`, pointing along `dir`. */
function arrow(tip: XY, dir: XY): Mark {
  const d = unit(dir), n: XY = [-d[1], d[0]], base = add(tip, d, -ARROW);
  return { kind: 'fill', points: [tip, add(base, n, ARROW_HALF), add(base, n, -ARROW_HALF)] };
}

/** Text along a direction, turned to read from below or from the right (angle in (-90°, 90°]). */
function readAngle(dir: XY): number {
  let angle = -Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
  if (angle > 90.001) angle -= 180; else if (angle < -89.999) angle += 180;
  return Math.round(angle * 1000) / 1000;
}

/** A deviation as written: +0.1, -0.05 (an ASCII minus, which every font and PDF encoding has), 0. */
const signed = (v: number, unit: string) => v === 0 ? '0' : (v > 0 ? '+' : '-') + fmtMM(Math.abs(v)) + unit;
/** A tolerance on one line (the panel; ± and fits print so on the sheet too). */
export function toleranceText(t: Tolerance, unit = ''): string {
  return t.kind === 'symmetric' ? `±${fmtMM(t.value)}${unit}` : t.kind === 'fit' ? t.code : `${signed(t.upper, unit)}/${signed(t.lower, unit)}`;
}

/**
 * A dimension's value with its tolerance, as text at `at` (its baseline; `angle` as read): ± and fits
 * follow the value on its line; deviations stack after it in smaller text, the upper one raised.
 */
export function valueMarks(at: XY, angle: number, anchor: 'start' | 'middle' | 'end', value: string, tol?: Tolerance, unit = ''): Mark[] {
  const a = angle * Math.PI / 180, x: XY = [Math.cos(a), -Math.sin(a)], up: XY = [-Math.sin(a), -Math.cos(a)];
  const main = tol && tol.kind !== 'deviation' ? `${value} ${toleranceText(tol, unit)}` : value;
  const small = 2.5, devs = tol?.kind === 'deviation' ? [signed(tol.upper, unit), signed(tol.lower, unit)] : null;
  const wMain = textWidth(main, TEXT, false), wDev = devs ? 0.8 + Math.max(...devs.map(d => textWidth(d, small, false))) : 0, total = wMain + wDev;
  const from = add(at, x, anchor === 'start' ? 0 : anchor === 'middle' ? -total / 2 : -total);
  const marks: Mark[] = [{ kind: 'text', at: from, text: main, size: TEXT, anchor: 'start', ...(angle ? { angle } : {}) }];
  if (devs) {
    const col = add(from, x, wMain + 0.8);
    marks.push({ kind: 'text', at: add(col, up, 1.5), text: devs[0], size: small, anchor: 'start', ...(angle ? { angle } : {}) },
      { kind: 'text', at: add(col, up, -0.6), text: devs[1], size: small, anchor: 'start', ...(angle ? { angle } : {}) });
  }
  return marks;
}

export function dimensionMarks(v: ViewPlacement, r: Extract<Resolved, { ok: true }>): Mark[] {
  const marks: Mark[] = [];
  const place = toSheet(v, r.dim.place);
  if (r.kind === 'angle') {
    // An arc about the vertex through the placement, between the two rays; arrows at its ends, extension
    // lines out from the edges when the arc lies beyond them, the value just outside its middle.
    const X = toSheet(v, r.vertex), R = Math.hypot(place[0] - X[0], place[1] - X[1]);
    const f: XY = [r.from[0], -r.from[1]], g: XY = [-r.from[1], -r.from[0]], theta = r.value * Math.PI / 180;
    const u: XY = [f[0] * R, f[1] * R], w: XY = [g[0] * R, g[1] * R];
    const at = (t: number): XY => [X[0] + u[0] * Math.cos(t) + w[0] * Math.sin(t), X[1] + u[1] * Math.cos(t) + w[1] * Math.sin(t)];
    const tangent = (t: number): XY => [-u[0] * Math.sin(t) + w[0] * Math.cos(t), -u[1] * Math.sin(t) + w[1] * Math.cos(t)];
    marks.push({ kind: 'arc', center: X, u, v: w, t0: 0, t1: theta, pen: 'thin' });
    const t0 = tangent(0), t1 = tangent(theta);
    marks.push(arrow(at(0), [-t0[0], -t0[1]]), arrow(at(theta), t1));
    for (const dir of [r.from, r.to]) {
      // The extension along a ray reaches out from the edge end lying along it (none along the ray behind it).
      const d: XY = [dir[0], -dir[1]], reach = Math.max(0, ...r.ends.map(e => { const E = toSheet(v, e), q = (E[0] - X[0]) * d[0] + (E[1] - X[1]) * d[1]; return Math.abs((E[0] - X[0]) * d[1] - (E[1] - X[1]) * d[0]) < 1e-6 * (1 + Math.abs(q)) ? q : 0; }));
      if (R > reach + GAP) marks.push({ kind: 'line', a: add(X, d, reach + GAP), b: add(X, d, R + OVER), pen: 'thin' });
    }
    const mid = at(theta / 2), out = unit(sub(mid, X));
    marks.push(...valueMarks(add(add(mid, out, 2.5), [0, 1.2]), 0, out[0] > 0.3 ? 'start' : out[0] < -0.3 ? 'end' : 'middle', r.text, r.dim.tol, '°'));
    return marks;
  }
  if (r.kind === 'linear') {
    const A = toSheet(v, r.a), B = toSheet(v, r.b), orient = r.dim.orient;
    const d: XY = orient === 'horizontal' ? [1, 0] : orient === 'vertical' ? [0, 1] : unit(sub(B, A)), n: XY = [-d[1], d[0]];
    const A2 = add(A, n, dot2(sub(place, A), n)), B2 = add(B, n, dot2(sub(place, B), n));
    for (const [P, Q] of [[A, A2], [B, B2]] as const) {
      const out = sub(Q, P), l = Math.hypot(out[0], out[1]);
      if (l > GAP) { const e = unit(out); marks.push({ kind: 'line', a: add(P, e, GAP), b: add(Q, e, OVER), pen: 'thin' }); }
    }
    const along = sub(B2, A2), len = Math.hypot(along[0], along[1]), e = unit(along);
    if (len >= 2 * ARROW + 1) {
      marks.push({ kind: 'line', a: A2, b: B2, pen: 'thin' }, arrow(A2, [-e[0], -e[1]]), arrow(B2, e));
    } else {
      // Too short for arrows inside: arrows outside, pointing in.
      marks.push({ kind: 'line', a: add(A2, e, -ARROW - 3), b: add(B2, e, ARROW + 3), pen: 'thin' }, arrow(A2, e), arrow(B2, [-e[0], -e[1]]));
    }
    // Text over the line (the side away from the measured points' middle when the line is beside them).
    const mid = add(A2, along, 0.5), up: XY = textUp(e);
    marks.push(...valueMarks(add(mid, up, 1.2), readAngle(e), 'middle', r.text, r.dim.tol));
    return marks;
  }
  const C = toSheet(v, r.center), R = r.radius * v.scale, toPlace = sub(place, C), dist = Math.hypot(toPlace[0], toPlace[1]);
  const e = dist > 1e-9 ? unit(toPlace) : [1, 0] as XY, rim = add(C, e, R);
  if (dist > R + 1) {
    // A leader from the rim out to the text, with a short shoulder.
    const start = r.kind === 'radius' ? C : rim;
    marks.push({ kind: 'line', a: start, b: place, pen: 'thin' });
    marks.push(r.kind === 'radius' ? arrow(rim, e) : arrow(rim, [-e[0], -e[1]]));
    const right = e[0] >= 0, shoulder = add(place, [right ? 1 : -1, 0], 3);
    marks.push({ kind: 'line', a: place, b: shoulder, pen: 'thin' });
    marks.push(...valueMarks(add(shoulder, [right ? 1 : -1, 0], 0.8), 0, right ? 'start' : 'end', r.text, r.dim.tol));
    if (r.kind === 'radius') marks.push({ kind: 'fill', points: circlePoints(C, 0.4) });
    return marks;
  }
  // Inside the circle: a diameter across it (or a radius from the centre), text along it.
  const far = add(C, e, -R);
  if (r.kind === 'diameter') marks.push({ kind: 'line', a: far, b: rim, pen: 'thin' }, arrow(rim, e), arrow(far, [-e[0], -e[1]]));
  else marks.push({ kind: 'line', a: C, b: rim, pen: 'thin' }, arrow(rim, e), { kind: 'fill', points: circlePoints(C, 0.4) });
  const mid = r.kind === 'diameter' ? add(C, e, R * 0.45) : add(C, e, R * 0.5);
  marks.push(...valueMarks(add(mid, textUp(e), 1.2), readAngle(e), 'middle', r.text, r.dim.tol));
  return marks;
}

/** The side of a line its text sits on: above it (or left of a vertical line), as read. */
function textUp(e: XY): XY {
  let n: XY = [e[1], -e[0]];
  if (n[1] > 1e-9 || (Math.abs(n[1]) <= 1e-9 && n[0] > 0)) n = [-n[0], -n[1]];
  return n;
}

const circlePoints = (c: XY, r: number): XY[] => Array.from({ length: 12 }, (_, k) => [c[0] + r * Math.cos(k * Math.PI / 6), c[1] + r * Math.sin(k * Math.PI / 6)] as XY);

/**
 * Section A–A: the cut part's visible edges (sections show no hidden lines), its cut faces hatched at
 * 45°, and in the top view the cutting plane — a chain line, thick at its ends, with arrows pointing the
 * way the section is seen (+Y) and the letter A at each end.
 */
function sectionMarks(layout: SheetLayout, views: DrawingViews, section: { projection: BrepProjection; rings: XY[][] }, y: number): Mark[] {
  const v = layout.section!, marks: Mark[] = [];
  for (const e of section.projection.edges) for (const p of e.pieces) if (p.visible) marks.push(curveMark(v, p.curve, 'visible'));
  marks.push(...hatch(section.rings.map(r => r.map(q => toSheet(v, q))), 2.5));
  const top = layout.views.top, pr = views.top, k = 6 / top.scale;
  const a = toSheet(top, [pr.min[0] - k, y]), b = toSheet(top, [pr.max[0] + k, y]);
  marks.push({ kind: 'line', a, b, pen: 'center' });
  for (const [end, inward] of [[a, 1], [b, -1]] as const) {
    marks.push({ kind: 'line', a: end, b: [end[0] + inward * 5, end[1]], pen: 'frame' });
    const foot: XY = [end[0] + inward * 2, end[1]], tip: XY = [foot[0], foot[1] - 7];
    marks.push({ kind: 'line', a: foot, b: [tip[0], tip[1] + ARROW], pen: 'thin' }, arrow(tip, [0, -1]));
    marks.push({ kind: 'text', at: [tip[0] - inward * 2.5, tip[1] + 2], text: 'A', size: TEXT, anchor: inward > 0 ? 'end' : 'start', bold: true });
  }
  return marks;
}

/** Parallel hatch lines `spacing` apart at 45° over rings (even–odd: holes stay clear). */
export function hatch(rings: XY[][], spacing: number): Mark[] {
  // In coordinates turned by −45°, the hatch lines are horizontal: scan them and pair the crossings.
  const c = Math.SQRT1_2, to = (p: XY): XY => [c * p[0] + c * p[1], -c * p[0] + c * p[1]], back = (q: XY): XY => [c * q[0] - c * q[1], c * q[0] + c * q[1]];
  const rs = rings.map(r => r.map(to)), ys = rs.flat().map(p => p[1]);
  if (!ys.length) return [];
  const marks: Mark[] = [], lo = Math.min(...ys), hi = Math.max(...ys);
  for (let yy = Math.ceil(lo / spacing) * spacing; yy <= hi; yy += spacing) {
    const xs: number[] = [];
    for (const r of rs) for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      if ((p[1] <= yy) !== (q[1] <= yy)) xs.push(p[0] + (yy - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-9) marks.push({ kind: 'line', a: back([xs[i], yy]), b: back([xs[i + 1], yy]), pen: 'thin' });
  }
  return marks;
}

export const NOTE_LINE = 5;
/** A note's lines (top left at `at`) and its leader: from the nearer end of the first line, a short shoulder, then out to an arrow on the view point. */
export function noteMarks(layout: SheetLayout, n: DrawingNote): Mark[] {
  const lines = n.text.split('\n'), marks: Mark[] = lines.map((t, k) => ({ kind: 'text', at: [n.at[0], n.at[1] + TEXT * 0.85 + k * NOTE_LINE] as XY, text: t, size: TEXT, anchor: 'start' }));
  if (n.leader) {
    const tip = toSheet(layout.views[n.leader.view], n.leader.at), w = Math.max(0, ...lines.map(t => textWidth(t, TEXT, false)));
    const y = n.at[1] + TEXT * 0.45, left = tip[0] < n.at[0] + w / 2, start: XY = left ? [n.at[0] - 1, y] : [n.at[0] + w + 1, y], knee: XY = [start[0] + (left ? -3 : 3), y];
    marks.push({ kind: 'line', a: start, b: knee, pen: 'thin' }, { kind: 'line', a: knee, b: tip, pen: 'thin' }, arrow(tip, sub(tip, knee)));
  }
  return marks;
}
