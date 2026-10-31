// G24's data side (the queue's item 4; the S0 in decisions-outer.md, with the GPU lane's five additions): the drawing's
// annotations on the model. Each dimension, datum, feature control frame and weld symbol the sheet drew is lifted from
// its view into the part's coordinates — the very marks the sheet made, mapped back through the view's placement onto
// its plane (the view's right and up, at its targets' depth along its toward; a section's at its cut) — so the 3D lines,
// heads and text equal the sheet's. Lines carry a role, heads are heads (not their triangles), text its height in model
// mm and its baseline direction, a frame its cells and box, a weld its data. Targets are the drawing's own references:
// persistent edge names (a placed part's `<inst>/` kept) with their 3D points. Ids are the sheet items'. The glyph
// builders the sheet uses are given in plane coordinates too (`frameGlyph`, `weldGlyph`), one source for both.
import { datumAnchor } from './datums';
import { datumTargetConflicts, resolveDatumTarget, type DatumTargetFailureCode } from './datumTargets';
import { fmtTol, zonePrefix, type Characteristic, type MaterialModifier } from './controls';
import type { BrepProjection } from '@barocss/cad';
import type { Resolved } from './dimensions';
import { frameMarks, placementOf, projectionOf, type Head, type LineRole, type Mark, type MarkGroup, type Sheet } from './sheet';
import { symbolMarks, type Side } from './welds';
import { fromSheet, type SheetLayout, type ViewPlacement } from './views';
import { isSectionRef, sectionLetter, sectionsOf, type DimView, type DrawingDimension, type DrawingFrame, type DrawingSettings, type DrawingViews, type Tolerance, type XY } from './types';
import type { WeldJoint } from '../frames/welds';

export const MODEL_ANNOTATIONS_VERSION = 'model-annotations-v1';
// (R7.3c, conventions §10.2: the one Vec3, engine/vec3's.)
import type { Vec3 } from '../engine/vec3';
export type { Vec3 };
/** The plane an annotation lies in: its view's axes (model), through `depth` along `normal` (the view's toward). */
export interface AnnotationPlane { normal: Vec3; right: Vec3; up: Vec3; depth: number }
/** What an annotation points at: a point on the model and what it is on, by persistent name. */
export interface Target { at: Vec3; edge?: string; face?: string; centre?: true }
/** A text as drawn: its baseline point, its height (model mm), its alignment along `dir` (plane.right turned by its angle about the normal), `up` likewise. */
export interface Text3 { text: string; at: Vec3; height: number; align: 'start' | 'middle' | 'end'; dir: Vec3; up: Vec3; bold?: true }
export interface Line3 { a: Vec3; b: Vec3; role: LineRole }
/** `center + u·cos t + v·sin t`, t from t0 to t1 (model). */
export interface Arc3 { center: Vec3; u: Vec3; v: Vec3; t0: number; t1: number; role: LineRole }
/** A head: its tip, direction (unit), length and width (model mm), its style. */
export interface Head3 { tip: Vec3; dir: Vec3; length: number; width: number; style: Head['style'] }
export interface ModelAnnotation {
  /** The sheet item's id: the dimension's, the datum's, the frame's, the weld symbol's W-number. */
  id: string;
  kind: 'dimension' | 'datum' | 'frame' | 'weld';
  from: DimView;
  plane: AnnotationPlane;
  /** The first text's baseline point; all the texts, in the sheet's order. */
  anchor: Vec3; text: string[]; texts: Text3[];
  targets: Target[];
  lines: Line3[]; arcs: Arc3[]; arrows: Head3[];
  dimension?: { measure: 'linear' | 'diameter' | 'radius' | 'pcd' | 'angle'; value: number; unit: 'mm' | 'deg'; text: string; tol?: Tolerance; basic?: true; count?: number };
  /** The frame's compartments in order (the symbol's, the zone and value, each datum), and its box in plane coordinates [u0, v0, u1, v1]. */
  frame?: { characteristic: Characteristic; zone: 'diameter' | 'linear' | 'sphere'; statistical?: boolean; unequal?: number; around?: 'all-around' | 'all-over'; stacked?: { zone: 'diameter' | 'linear' | 'sphere'; value: number; datums: string[]; material?: MaterialModifier; datumModifiers?: Record<string, MaterialModifier>; cells: { text: string; symbol?: Characteristic }[] }; value: number; datums: string[]; dim: string; material?: MaterialModifier; datumModifiers?: Record<string, MaterialModifier>; projected?: number; freeState?: boolean; tangentPlane?: boolean; cells: { text: string; symbol?: Characteristic }[]; composite?: { zone: 'diameter' | 'linear' | 'sphere'; value: number; datums: string[]; material?: MaterialModifier; datumModifiers?: Record<string, MaterialModifier>; cells: { text: string }[] }; box: [number, number, number, number] };
  datum?: { letter: string; targetNumber?: number };
  weld?: { joint: string; kind: 'fillet' | 'butt'; size: number | null; estimate: boolean; allRound: boolean; inner: boolean };
}
export interface ModelAnnotations { version: typeof MODEL_ANNOTATIONS_VERSION; items: ModelAnnotation[]; left: { id: string; why: string; code?: DatumTargetFailureCode }[] }
/** What the lifting needs of a built sheet: its views, layout, settings and the sheet; the frame's weld joints. */
export interface AnnotationInputs { views: DrawingViews; layout: SheetLayout; settings: DrawingSettings; sheet: Sheet; welds?: readonly WeldJoint[] }

const add3 = (a: readonly number[], b: readonly number[], k = 1): Vec3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const z0 = (v: Vec3): Vec3 => [v[0] + 0, v[1] + 0, v[2] + 0];
const ROLE_OF: Record<string, LineRole> = { dimension: 'dimension', datum: 'leader', control: 'frame', weld: 'weld' };

/** A plane point (view coordinates, model mm) in the model. */
const lift = (p: AnnotationPlane, w: readonly number[]): Vec3 => z0(add3(add3(add3([0, 0, 0], p.right, w[0]), p.up, w[1]), p.normal, p.depth));
/** A sheet direction (y down the paper) in the model. */
const dirOf = (p: AnnotationPlane, d: readonly number[]): Vec3 => z0(add3(add3([0, 0, 0], p.right, d[0]), p.up, -d[1]));

/** The drawing's annotations on the model, from a built sheet (lost ones, notes and the isometric view's, said in `left`). */
export function modelAnnotations(i: AnnotationInputs): ModelAnnotations {
  const items: ModelAnnotation[] = [], left: ModelAnnotations['left'] = [];
  for (const d of i.settings.datums ?? []) if (d.face && !datumAnchor(i.views, d)) left.push({ id: d.id, why: 'its face has no unique current boundary anchor' });
  const targetConflicts = datumTargetConflicts(i.settings.datumTargets ?? []), omittedTargets = new Set<string>();
  for (const d of i.settings.datumTargets ?? []) {
    const result = targetConflicts.has(d) ? { ok: false as const, code: 'DATUM_TARGET_DUPLICATE' as const, reason: 'The datum target id or letter-number is defined more than once.' } : resolveDatumTarget(i.views[d.view], d);
    if (!result.ok) { left.push({ id: d.id, code: result.code, why: result.reason }); omittedTargets.add(d.id); }
    else if (i.layout.views[d.view].hidden) { left.push({ id: d.id, why: `its view (${d.view}) is not on the sheet` }); omittedTargets.add(d.id); }
  }
  for (const r of i.sheet.dimensions) if (!r.ok) left.push({ id: r.dim.id, why: r.reason });
  for (const n of i.settings.notes ?? []) left.push({ id: n.id, why: 'a note is placed on the paper, not on the model' });
  for (const f of i.settings.frames ?? []) if (f.dim === undefined) left.push({ id: f.id, why: 'a standalone frame has no attached model geometry' });
  for (const g of i.sheet.groups) {
    if (!g.id || !(g.role === 'dimension' || g.role === 'datum' || g.role === 'control' || g.role === 'weld')) continue;
    if (g.datumTarget && omittedTargets.has(g.id)) continue;
    const view = g.role === 'control' ? controlView(i, g) : g.view;
    if (!view) continue;
    if (view === 'iso') { left.push({ id: g.id, why: 'in the isometric view: no plane of the model' }); continue; }
    const v = placementOf(i.layout, i.sheet, view), pr = projectionOf(i.views, i.sheet, view);
    if (!v || !pr) { left.push({ id: g.id, why: `its view (${view}) is not on the sheet` }); continue; }
    const item = itemOf(i, g, view, v, pr);
    if (item) items.push(item); else left.push({ id: g.id, why: 'nothing on the model to point at' });
  }
  return { version: MODEL_ANNOTATIONS_VERSION, items, left };
}

/** A frame's view: its dimension's. */
function controlView(i: AnnotationInputs, g: MarkGroup): DimView | undefined {
  const f = i.settings.frames?.find(x => x.id === g.id);
  return f?.dim !== undefined ? i.settings.dimensions.find(d => d.id === f.dim)?.view : undefined;
}

function itemOf(i: AnnotationInputs, g: MarkGroup, view: DimView, v: ViewPlacement, pr: BrepProjection): ModelAnnotation | null {
  const kind = g.role === 'dimension' ? 'dimension' : g.role === 'datum' ? 'datum' : g.role === 'control' ? 'frame' : 'weld';
  let targets: Target[] = [], extra: Partial<ModelAnnotation> = {};
  if (kind === 'dimension' || kind === 'frame') {
    const f = kind === 'frame' ? i.settings.frames?.find(x => x.id === g.id) : undefined;
    const r = i.sheet.dimensions.find((x): x is Extract<Resolved, { ok: true }> => x.ok && x.dim.id === (f ? f.dim : g.id));
    if (!r) return null;
    targets = targetsOf(r.dim);
    if (kind === 'dimension') extra = { dimension: { measure: r.kind, value: r.value, unit: r.kind === 'angle' ? 'deg' : 'mm', text: r.text, ...(r.dim.tol ? { tol: r.dim.tol } : {}), ...(r.dim.basic ? { basic: true as const } : {}), ...(r.dim.count ? { count: r.dim.count } : {}) } };
    else if (f?.dim !== undefined) extra = { frame: { characteristic: f.characteristic, zone: zoneOf(f, f), value: f.value, ...(f.statistical ? { statistical: true } : {}), ...(f.unequal !== undefined ? { unequal: f.unequal } : {}), ...(f.around ? { around: f.around } : {}), ...(f.material ? { material: f.material } : {}), ...(f.datumModifiers ? { datumModifiers: { ...f.datumModifiers } } : {}), ...(f.projected ? { projected: f.projected } : {}), ...(f.freeState ? { freeState: true } : {}), ...(f.tangentPlane ? { tangentPlane: true } : {}), datums: [...f.datums], dim: f.dim, cells: cellsOf(f), ...(f.composite ? { composite: rowDataOf(f, f.composite) } : {}), ...(f.stacked ? { stacked: rowDataOf(f, f.stacked, f.characteristic) } : {}), box: boxOf(g.marks, v) } };
  } else if (kind === 'datum') {
    if (g.datumTarget) {
      const d = i.settings.datumTargets?.find(x => x.id === g.id); if (!d) return null;
      const result = resolveDatumTarget(pr, d); if (!result.ok) return null;
      targets = [{ at: result.at, edge: result.edge }]; extra = { datum: { letter: d.letter, targetNumber: d.number } };
    } else {
      const d = i.settings.datums?.find(x => x.id === g.id); if (!d) return null;
      const at = datumAnchor(i.views, d); if (!at) return null;
      targets = [{ at, ...(d.face ? { face: d.face.face } : { edge: d.edge.edge }) }]; extra = { datum: { letter: d.letter } };
    }
  } else {
    const placed = i.sheet.welds?.placed.find(p => p.label === g.id), j = placed && i.welds?.find(x => x.id === placed.joint);
    if (!placed || !j) return null;
    targets = [{ at: [...j.at] as Vec3, edge: placed.edge, face: j.face }];
    extra = { weld: { joint: j.id, kind: j.weld.kind, size: j.weld.size, estimate: j.weld.sizeBasis === 'estimate', allRound: j.weld.allRound, inner: j.innerLoop?.welded === true } };
  }
  const plane = planeOf(i, view, pr, targets);
  const lines: Line3[] = [], arcs: Arc3[] = [], arrows: Head3[] = [], texts: Text3[] = [], role = ROLE_OF[g.role];
  const at = (q: XY) => lift(plane, fromSheet(v, q));
  for (const m of g.marks) {
    if (m.kind === 'line') lines.push({ a: at(m.a), b: at(m.b), role: m.role ?? role });
    else if (m.kind === 'polyline') for (let k = 1; k < m.points.length; k++) lines.push({ a: at(m.points[k - 1]), b: at(m.points[k]), role: m.role ?? role });
    else if (m.kind === 'arc') arcs.push({ center: at(m.center), u: dirOf(plane, [m.u[0] / v.scale, m.u[1] / v.scale]), v: dirOf(plane, [m.v[0] / v.scale, m.v[1] / v.scale]), t0: m.t0, t1: m.t1, role: m.role ?? role });
    else if (m.kind === 'fill' && m.head) arrows.push({ tip: at(m.head.tip), dir: dirOf(plane, m.head.dir), length: m.head.length / v.scale, width: m.head.width / v.scale, style: m.head.style });
    else if (m.kind === 'text') {
      const a = (m.angle ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const dir = z0(add3(add3([0, 0, 0], plane.right, c), plane.up, s)), up = z0(add3(add3([0, 0, 0], plane.right, -s), plane.up, c));
      texts.push({ text: m.text, at: at(m.at), height: m.size / v.scale, align: m.anchor, dir, up, ...(m.bold ? { bold: true as const } : {}) });
    }
  }
  if (!texts.length && kind !== 'weld') return null;
  return { id: g.id!, kind, from: view, plane, anchor: texts[0]?.at ?? targets[0].at, text: texts.map(t => t.text), texts, targets, lines, arcs, arrows, ...extra };
}

/** A dimension's references as targets: its ends or centres, its edge, its ring's holes. */
function targetsOf(d: DrawingDimension): Target[] {
  const p = (x: { edge: string; near: readonly number[]; at?: string }): Target => ({ at: [...x.near] as Vec3, edge: x.edge, ...(x.at === 'center' ? { centre: true as const } : {}) });
  if (d.kind === 'linear') return [p(d.a), p(d.b)];
  if (d.kind === 'angle') return [p(d.a), p(d.b)];
  if (d.kind === 'pcd') return d.ring.map(x => ({ at: [...x.near] as Vec3, edge: x.edge, centre: true as const }));
  return [{ at: [...d.near] as Vec3, edge: d.edge, centre: true }];
}

/** A view's plane through its targets' mean depth; a section's through its cut (its depth along toward is −at). */
function planeOf(i: AnnotationInputs, view: DimView, pr: BrepProjection, targets: readonly Target[]): AnnotationPlane {
  const normal = [...pr.toward] as Vec3, right = [...pr.right] as Vec3, up = [...pr.up] as Vec3;
  const sec = isSectionRef(view) ? sectionsOf(i.settings).find(x => x.id === sectionLetter(view)) : undefined;
  const depth = sec ? -sec.at : targets.length ? targets.reduce((t, x) => t + dot3(x.at, normal), 0) / targets.length : 0;
  return { normal, right, up, depth: depth + 0 };
}

type RowData = { zone: 'diameter' | 'linear' | 'sphere'; value: number; datums: string[]; material?: MaterialModifier; datumModifiers?: Record<string, MaterialModifier>; cells: { text: string; symbol?: Characteristic }[] };
const zoneOf = (f: DrawingFrame, row: { diameter?: boolean }): RowData['zone'] => f.sphere ? 'sphere' : zonePrefix(f, row) ? 'diameter' : 'linear';
const rowDataOf = (f: DrawingFrame, c: NonNullable<DrawingFrame['composite']>, symbol?: Characteristic): RowData => ({ zone: zoneOf(f, c), value: c.value, datums: [...c.datums], ...(c.material ? { material: c.material } : {}), ...(c.datumModifiers ? { datumModifiers: { ...c.datumModifiers } } : {}), cells: [...(symbol ? [{ text: symbol === 'position' ? '⌖' : symbol, symbol }] : []), ...rowCellsOf(f, c)] });
const materialLetter = (m: MaterialModifier) => m === 'maximum' ? '(M)' : '(L)';
const cellsOf = (f: DrawingFrame): { text: string; symbol?: Characteristic }[] => [
  { text: f.characteristic === 'position' ? '⌖' : f.characteristic, symbol: f.characteristic },
  { text: `${zonePrefix(f, f)}${fmtTol(f.value)}${f.material ? materialLetter(f.material) : ''}${f.freeState ? '(F)' : ''}${f.tangentPlane ? '(T)' : ''}${f.projected ? `(P)${fmtTol(f.projected)}` : ''}${f.statistical ? '(ST)' : ''}${f.unequal !== undefined ? `(U)${fmtTol(f.unequal)}` : ''}` },
  ...f.datums.map(d => ({ text: d + (f.datumModifiers?.[d] ? materialLetter(f.datumModifiers[d]) : '') })),
];
/** The lower row of a composite frame, or a stacked frame's (which repeats the symbol), in order. */
const rowCellsOf = (f: DrawingFrame, c: NonNullable<DrawingFrame['composite']>): { text: string }[] => [
  { text: `${zonePrefix(f, c)}${fmtTol(c.value)}${c.material ? materialLetter(c.material) : ''}` },
  ...c.datums.map(d => ({ text: d + (c.datumModifiers?.[d] ? materialLetter(c.datumModifiers[d]) : '') })),
];
/** A frame's box: its marks' extent, in plane coordinates. */
function boxOf(marks: readonly Mark[], v: ViewPlacement): [number, number, number, number] {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const m of marks) if (m.kind === 'polyline' || m.kind === 'line') for (const q of m.kind === 'line' ? [m.a, m.b] : m.points) { const w = fromSheet(v, q); u0 = Math.min(u0, w[0]); v0 = Math.min(v0, w[1]); u1 = Math.max(u1, w[0]); v1 = Math.max(v1, w[1]); }
  return [u0, v0, u1, v1];
}

// ——— The sheet's glyphs in plane coordinates (model mm, y up): what the GPU lane draws, so its glyphs are the sheet's.
/** A mark in plane coordinates: the sheet's kinds, points in model mm on the plane (y up), sizes in model mm. */
export type PlaneMark = Mark;
/** Sheet marks drawn at `scale` (sheet mm per model mm) about an origin, in plane coordinates. */
export function toPlane(marks: readonly Mark[], scale: number, origin: XY = [0, 0]): PlaneMark[] {
  const v = { origin, scale } as ViewPlacement, P = (q: XY): XY => fromSheet(v, q), D = (d: XY): XY => [d[0] / scale + 0, -d[1] / scale + 0];
  return marks.map((m): PlaneMark => {
    switch (m.kind) {
      case 'line': return { ...m, a: P(m.a), b: P(m.b) };
      case 'polyline': return { ...m, points: m.points.map(P) };
      case 'arc': return { ...m, center: P(m.center), u: D(m.u), v: D(m.v) };
      case 'fill': return { ...m, points: m.points.map(P), ...(m.head ? { head: { ...m.head, tip: P(m.head.tip), dir: [m.head.dir[0] + 0, -m.head.dir[1] + 0], length: m.head.length / scale, width: m.head.width / scale } } : {}) };
      case 'hatch': return { ...m, rings: m.rings.map(r => r.map(P)), spacing: m.spacing / scale };
      case 'text': return { ...m, at: P(m.at), size: m.size / scale };
    }
  });
}
/** Plane points as sheet points at `scale` about the origin (the inverse of toPlane's). */
const toSheetAt = (p: XY, scale: number): XY => [p[0] * scale, -p[1] * scale];
/**
 * A feature control frame under a text, in plane coordinates: the sheet's `frameMarks` at `scale` (the drawing's,
 * sheet mm per model mm). `under`: the text it sits under — its baseline point, text and height in plane coordinates.
 */
export function frameGlyph(f: DrawingFrame, under: { at: XY; text: string; height: number; align: 'start' | 'middle' | 'end' }, scale: number): PlaneMark[] {
  return toPlane(frameMarks({ kind: 'text', at: toSheetAt(under.at, scale), text: under.text, size: under.height * scale, anchor: under.align }, f), scale);
}
/** A weld symbol in plane coordinates: the sheet's `symbolMarks` (its arrow's tip on the seam, its knee, the side it leaves by) at `scale`. */
export function weldGlyph(tip: XY, knee: XY, side: Side, joint: WeldJoint, label: string, scale: number): PlaneMark[] {
  return toPlane(symbolMarks(toSheetAt(tip, scale), toSheetAt(knee, scale), side, joint, label), scale);
}
