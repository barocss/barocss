// The drawing as DXF (R11b, O1), through the kernel's writer: the sheet at true size (one unit a paper
// millimetre, the views at the sheet's scale, as the SVG and PDF), and section A–A alone at 1:1 in model mm.
// Layers are the drawing's pens (VISIBLE, HIDDEN, THIN, CENTER, FRAME) plus TEXT, HATCH and DIMENSIONS; the
// frame and title block are one block (TITLE_BLOCK); each dimension is a DIMENSION entity showing exactly what
// the sheet draws, with its definition points from the model; the section's hatching is a HATCH.
import { writeDxf, type BrepProjection, type DxfDocument, type DxfEntity, type DxfLayer, type DxfVersion, type DxfWriteResult, type DxfXY, type ProjectedCurve } from '@barocss/cad';
import { toleranceText, type Mark, type MarkGroup, type Pen, type Sheet } from '@barocss/cad-model/drawing/sheet';
import { toSheet, type SheetLayout, type ViewPlacement } from '@barocss/cad-model/drawing/views';
import type { Resolved } from '@barocss/cad-model/drawing/dimensions';
import type { XY } from '@barocss/cad-model/drawing/types';

export const SHEET_DXF_VERSION = 'cad-studio-sheet-dxf-v1';

const PEN_LAYER: Record<Pen, string> = { visible: 'VISIBLE', hidden: 'HIDDEN', thin: 'THIN', center: 'CENTER', frame: 'FRAME' };
/** The pens' dash patterns (sheet mm, as PENS) and weights (1/100 mm). */
export const DXF_LINETYPES = [
  { name: 'BC_HIDDEN', description: 'Hidden __ __ __ (3, 1.5)', pattern: [3, -1.5] },
  { name: 'BC_CENTER', description: 'Centre ____ _ ____ (8, 1.5, 1.5, 1.5)', pattern: [8, -1.5, 1.5, -1.5] },
];
export const DXF_LAYERS: DxfLayer[] = [
  { name: 'VISIBLE', color: 7, lineweight: 50 },
  { name: 'HIDDEN', color: 8, linetype: 'BC_HIDDEN', lineweight: 35 },
  { name: 'THIN', color: 7, lineweight: 25 },
  { name: 'CENTER', color: 1, linetype: 'BC_CENTER', lineweight: 25 },
  { name: 'FRAME', color: 7, lineweight: 70 },
  { name: 'TEXT', color: 7, lineweight: 25 },
  { name: 'HATCH', color: 7, lineweight: 25 },
  { name: 'DIMENSIONS', color: 7, lineweight: 25 },
];
const STYLES = [{ name: 'BC_TEXT', font: 'arial.ttf' }, { name: 'BC_BOLD', font: 'arialbd.ttf' }];
/** The section's hatching (sheet mm), as the sheet draws it. */
const HATCH_SPACING = 2.5;

const TAU = 2 * Math.PI;
const degOf = (r: number) => r * 180 / Math.PI;

/**
 * An arc `center + u·cos t + v·sin t` (t0 → t1) of y-up coordinates as DXF: a CIRCLE or ARC where it is
 * round (|u| = |v|, u ⊥ v to 1e-12), else an ELLIPSE on its principal axes, the same way round.
 */
export function arcEntity(center: DxfXY, u: DxfXY, v: DxfXY, t0: number, t1: number, layer: string): DxfEntity {
  const uu = u[0] * u[0] + u[1] * u[1], vv = v[0] * v[0] + v[1] * v[1], uv = u[0] * v[0] + u[1] * v[1], cross = u[0] * v[1] - u[1] * v[0];
  const whole = t1 - t0 >= TAU - 1e-9, scale = Math.max(uu, vv);
  if (Math.abs(uu - vv) <= 1e-12 * scale && Math.abs(uv) <= 1e-12 * scale) {
    const radius = Math.sqrt(uu), base = Math.atan2(u[1], u[0]);
    if (whole) return { type: 'circle', center, radius, layer };
    // Counter-clockwise with t when u × v > 0; clockwise arcs are written from their far end.
    return cross > 0 ? { type: 'arc', center, radius, startDeg: degOf(base + t0), endDeg: degOf(base + t1), layer } : { type: 'arc', center, radius, startDeg: degOf(base - t1), endDeg: degOf(base - t0), layer };
  }
  // Principal axes: p(t) = c + A cos(t − ts) + B sin(t − ts), A ⊥ B.
  const ts = 0.5 * Math.atan2(2 * uv, uu - vv), cs = Math.cos(ts), sn = Math.sin(ts);
  const A: DxfXY = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn], B: DxfXY = [-u[0] * sn + v[0] * cs, -u[1] * sn + v[1] * cs];
  const lenA = Math.hypot(A[0], A[1]), lenB = Math.hypot(B[0], B[1]);
  // The major axis M and N with p = c + M cos s + N sin s: (A, B) at s = t − ts, or (B, −A) at s = t − ts − π/2.
  const [M, N, shift] = lenA >= lenB ? [A, B, ts] : [B, [-A[0], -A[1]] as DxfXY, ts + Math.PI / 2];
  const ratio = Math.min(lenA, lenB) / Math.max(lenA, lenB);
  if (whole) return { type: 'ellipse', center, major: M, ratio, start: 0, end: TAU, layer };
  const s0 = t0 - shift, s1 = t1 - shift;
  // DXF runs an ellipse counter-clockwise (N along z × M); the other way round, the parameter is negated.
  return M[0] * N[1] - M[1] * N[0] > 0 ? { type: 'ellipse', center, major: M, ratio, start: s0, end: s1, layer } : { type: 'ellipse', center, major: M, ratio, start: -s1, end: -s0, layer };
}

/** A sheet point (y down) in the DXF's coordinates (y up from the sheet's bottom edge). */
const up = (H: number, p: XY): DxfXY => [p[0], H - p[1]];
const flip = (d: XY): DxfXY => [d[0], -d[1]];

/** A sheet mark as DXF entities (`solidFills`: fills of more than four points as fans of solids, for R12). */
function markEntities(m: Mark, H: number, out: DxfEntity[], solidFills: boolean): void {
  switch (m.kind) {
    case 'line': out.push({ type: 'line', a: up(H, m.a), b: up(H, m.b), layer: PEN_LAYER[m.pen] }); return;
    case 'polyline': out.push({ type: 'lwpolyline', points: m.points.map(p => up(H, p)), layer: PEN_LAYER[m.pen] }); return;
    case 'arc': out.push(arcEntity(up(H, m.center), flip(m.u), flip(m.v), m.t0, m.t1, PEN_LAYER[m.pen])); return;
    case 'fill': {
      const pts = m.points.map(p => up(H, p));
      if (pts.length <= 4) out.push({ type: 'solid', points: pts, layer: 'THIN' });
      // (The sheet's larger fills are its round dots, convex: a fan of triangles fills them exactly.)
      else if (solidFills) for (let i = 1; i + 1 < pts.length; i++) out.push({ type: 'solid', points: [pts[0], pts[i], pts[i + 1]], layer: 'THIN' });
      else out.push({ type: 'hatch', loops: [{ points: pts }], fill: { kind: 'solid' }, layer: 'THIN' });
      return;
    }
    case 'text':
      out.push({ type: 'text', at: up(H, m.at), height: m.size, text: m.text, ...(m.angle ? { rotationDeg: m.angle } : {}), align: m.anchor === 'middle' ? 'center' : m.anchor === 'end' ? 'right' : 'left', style: m.bold ? 'BC_BOLD' : 'BC_TEXT', layer: 'TEXT' });
      return;
    case 'hatch':
      // The sheet's lines run at 45° down the page: −45° in y-up coordinates, the family through the sheet's top left corner (its origin).
      out.push({ type: 'hatch', loops: m.rings.map(r => ({ points: r.map(p => up(H, p)) })), fill: { kind: 'lines', angleDeg: -m.angle, spacing: m.spacing, origin: [0, H] }, layer: 'HATCH' });
      return;
  }
}

const unit = (v: XY): XY => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/** A dimension's DXF geometry, text and measurement, from what it measures (sheet coordinates, then up). */
function dimensionEntity(r: Extract<Resolved, { ok: true }>, v: ViewPlacement, g: MarkGroup, H: number, solidFills: boolean): DxfEntity {
  const block: DxfEntity[] = [];
  for (const m of g.marks) markEntities(m, H, block, solidFills);
  const main = g.marks.find((m): m is Extract<Mark, { kind: 'text' }> => m.kind === 'text');
  const textAt = main ? up(H, main.at) : up(H, toSheet(v, r.dim.place));
  const unitText = r.kind === 'angle' ? '°' : '';
  const text = r.dim.tol ? `${r.text} ${toleranceText(r.dim.tol, unitText)}` : r.text;
  const place = toSheet(v, r.dim.place);
  let geometry: Extract<DxfEntity, { type: 'dimension' }>['geometry'];
  if (r.kind === 'linear') {
    const A = toSheet(v, r.a), B = toSheet(v, r.b), o = r.dim.orient;
    const d: XY = o === 'horizontal' ? [1, 0] : o === 'vertical' ? [0, 1] : unit([B[0] - A[0], B[1] - A[1]]), n: XY = [-d[1], d[0]];
    const k = (place[0] - B[0]) * n[0] + (place[1] - B[1]) * n[1], line = up(H, [B[0] + n[0] * k, B[1] + n[1] * k]);
    geometry = o === 'aligned' ? { kind: 'aligned', p1: up(H, A), p2: up(H, B), line } : { kind: 'linear', p1: up(H, A), p2: up(H, B), line, angleDeg: o === 'horizontal' ? 0 : 90 };
  } else if (r.kind === 'angle') {
    // View coordinates are y up, as the DXF's: the rays' directions carry over.
    const X = up(H, toSheet(v, r.vertex)), R = Math.hypot(place[0] - toSheet(v, r.vertex)[0], place[1] - toSheet(v, r.vertex)[1]), half = r.value * Math.PI / 360;
    const f = r.from, mid: XY = [f[0] * Math.cos(half) - f[1] * Math.sin(half), f[0] * Math.sin(half) + f[1] * Math.cos(half)];
    geometry = { kind: 'angular', line1: [X, [X[0] + f[0] * R, X[1] + f[1] * R]], line2: [X, [X[0] + r.to[0] * R, X[1] + r.to[1] * R]], arc: [X[0] + mid[0] * R, X[1] + mid[1] * R] };
  } else {
    const C = toSheet(v, r.center), R = r.radius * v.scale, toPlace: XY = [place[0] - C[0], place[1] - C[1]], e = Math.hypot(toPlace[0], toPlace[1]) > 1e-9 ? unit(toPlace) : [1, 0] as XY;
    const rim = up(H, [C[0] + e[0] * R, C[1] + e[1] * R]);
    geometry = r.kind === 'diameter' ? { kind: 'diameter', rim, opposite: up(H, [C[0] - e[0] * R, C[1] - e[1] * R]) } : { kind: 'radius', center: up(H, C), rim };
  }
  return { type: 'dimension', geometry, block, text, textAt, measurement: r.value, layer: 'DIMENSIONS' };
}

/** The sheet as a DXF document (sheet millimetres, y up from the bottom edge). */
export function sheetDxfDocument(sheet: Sheet, layout: SheetLayout, version: DxfVersion = 'AC1015'): DxfDocument {
  const H = sheet.size[1], solidFills = version === 'AC1009', title: DxfEntity[] = [], entities: DxfEntity[] = [];
  for (const g of sheet.groups) {
    if (g.role === 'frame' || g.role === 'title') { for (const m of g.marks) markEntities(m, H, title, solidFills); continue; }
    if (g.role === 'dimension') {
      const r = sheet.dimensions.find((x): x is Extract<Resolved, { ok: true }> => x.ok && x.dim.id === g.id);
      // (A pitch circle has no DXF dimension type: its lines, arrow and text as they are.)
      if (r && r.kind !== 'pcd') { entities.push(dimensionEntity(r, layout.views[r.dim.view], g, H, solidFills)); continue; }
    }
    for (const m of g.marks) markEntities(m, H, entities, solidFills);
  }
  return { units: 'mm', linetypes: DXF_LINETYPES, layers: DXF_LAYERS, styles: STYLES, blocks: [{ name: 'TITLE_BLOCK', base: [0, 0], entities: title }], entities: [{ type: 'insert', block: 'TITLE_BLOCK', at: [0, 0] }, ...entities] };
}

/** The sheet as a DXF file (AC1015 by default; R12 with its curves as polylines within 0.001 mm of the paper). */
export function sheetDxf(sheet: Sheet, layout: SheetLayout, version: DxfVersion = 'AC1015'): DxfWriteResult {
  return writeDxf(sheetDxfDocument(sheet, layout, version), version === 'AC1009' ? { version, r12ChordTolerance: 1e-3 } : { version });
}

/** A projected curve (view coordinates, mm, y up) as a DXF entity. */
export function curveEntity(c: ProjectedCurve, layer: string): DxfEntity {
  if (c.kind === 'line') return { type: 'line', a: [c.a[0], c.a[1]], b: [c.b[0], c.b[1]], layer };
  if (c.kind === 'polyline') return { type: 'lwpolyline', points: c.points.map(p => [p[0], p[1]] as DxfXY), layer };
  return arcEntity([c.center[0], c.center[1]], [c.u[0], c.u[1]], [c.v[0], c.v[1]], c.t0, c.t1, layer);
}

/**
 * Section A–A alone at 1:1 (model mm, seen like the front view: x along the part's X, y up its Z): the cut
 * part's visible edges and its cut faces hatched at 45°, 2.5 mm apart.
 */
export function sectionDxfDocument(section: { projection: BrepProjection; rings: XY[][] }): DxfDocument {
  const entities: DxfEntity[] = [];
  for (const e of section.projection.edges) for (const p of e.pieces) if (p.visible) entities.push(curveEntity(p.curve, e.tangent ? 'THIN' : 'VISIBLE'));
  if (section.rings.length) entities.push({ type: 'hatch', loops: section.rings.map(r => ({ points: r.map(p => [p[0], p[1]] as DxfXY) })), fill: { kind: 'lines', angleDeg: 45, spacing: HATCH_SPACING }, layer: 'HATCH' });
  return { units: 'mm', linetypes: DXF_LINETYPES, layers: DXF_LAYERS, entities };
}
