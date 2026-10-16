// Explicit constraints and dimensions on a closed outline: what the selection allows, applying one,
// listing and removing them, committing a dimension value. Every addition is solved first: a conflict
// or a constraint the others already imply (it would over-define the sketch) is refused with a reason,
// so the shape on screen always satisfies exactly what the list shows.
import type { SketchShape } from '../viewport/Viewport';
import { arcOf, inferredHV, samePair, solveOutline, type ArcPair, type OutlineConstraints, type P2, type SolveReport, type SolveResult } from './profile';
import { edgeAngle, type SketchRule } from './terms';

export type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
/**
 * A picked outline point, segment (line or arc) or circle by index. A circle is one of the outline's
 * circles (`circles`), or with `done` a finished circle shape of the sketch (`done` index) not yet attached.
 */
export interface SketchPick { kind: 'point' | 'edge' | 'circle'; i: number; done?: true }
export type ConstraintKind = 'horizontal' | 'vertical' | 'parallel' | 'perpendicular' | 'equal' | 'fix' | 'coincident';

export const isSettled = (s: SketchShape | null | undefined): s is Polygon => s?.kind === 'polygon' && s.closed && !s.pending;
export const samePick = (a: SketchPick, b: SketchPick) => a.kind === b.kind && a.i === b.i && !a.done === !b.done;
const isArc = (s: Polygon, i: number) => !!s.bulges?.[i];
const isLine = (s: Polygon, i: number) => i >= 0 && i < s.points.length && !isArc(s, i);
const edgeName = (s: Polygon, i: number) => `${isArc(s, i) ? 'arc' : 'edge'} ${i + 1}`;
const list = (names: string[]) => names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Horizontal / vertical edges: kept on the outline once it is closed, else as drawn. */
export const hvOf = (s: Polygon) => s.hv ?? inferredHV(s.points as P2[], s.bulges);

export const constraintsOf = (s: Polygon): OutlineConstraints => ({
  lengths: s.lengths, radii: s.radii, tangents: s.tangents, equalRadii: s.equalRadii, concentric: s.concentric, hv: hvOf(s), rules: s.rules,
  circles: s.circles?.map(c => c.c),
});

const solved = new WeakMap<Polygon, SolveResult>();
/** The outline solved with all its constraints (cached per shape object). */
export function solveShape(s: Polygon): SolveResult {
  let r = solved.get(s);
  if (!r) { r = solveOutline(s.points as P2[], constraintsOf(s), s.bulges); solved.set(s, r); }
  return r;
}
/** Redundant scalar constraints: those the others already imply. */
export const redundancy = (r: SolveResult) => r.ok ? Math.max(0, r.rows - r.rank) : 0;

export type EditResult = { ok: true; shape: Polygon; report: SolveReport } | { ok: false; reason: string };
/**
 * Solves a candidate outline. Refused: constraints that cannot hold together, and an edit that makes
 * more constraints redundant than `prev` had (`what` names the addition in the reason).
 */
export function checkEdit(candidate: Polygon, prev: Polygon | null, what = 'That'): EditResult {
  const r = solveShape(candidate);
  if (!r.ok) return { ok: false, reason: `${what}: ${r.reason}` };
  if (prev && redundancy(r) > redundancy(solveShape(prev)))
    return { ok: false, reason: `${what} is already implied by the other constraints — adding it would over-define the sketch` };
  const shape: Polygon = { ...candidate, points: r.points, bulges: r.bulges, ...(candidate.circles ? { circles: candidate.circles.map((c, j) => ({ ...c, c: r.circles[j] ?? c.c })) } : {}) };
  solved.set(shape, r);
  return { ok: true, shape, report: r };
}

function split(s: Polygon, picks: readonly SketchPick[]) {
  const points = picks.filter(p => p.kind === 'point').map(p => p.i), edges = picks.filter(p => p.kind === 'edge').map(p => p.i);
  return { points, edges, lines: edges.filter(i => !isArc(s, i)), arcs: edges.filter(i => isArc(s, i)), circles: picks.filter(p => p.kind === 'circle' && !p.done).map(p => p.i) };
}
const hasRule = (s: Polygon, test: (r: SketchRule) => boolean) => (s.rules ?? []).some(test);
const pairRule = (kind: SketchRule['kind'], a: number, b: number) => (r: SketchRule) =>
  r.kind === kind && 'b' in r && ((r.a === a && r.b === b) || (r.a === b && r.b === a));

/** Why each constraint cannot apply to the selection (null: it can). */
export function constraintOptions(s: Polygon, picks: readonly SketchPick[]): Record<ConstraintKind, string | null> {
  if (picks.some(p => p.kind === 'circle')) {
    const why = 'A circle takes dimensions: its diameter, or its centre from an outline point (Dimension)';
    return { horizontal: why, vertical: why, parallel: why, perpendicular: why, equal: why, fix: why, coincident: why };
  }
  const { points, edges, lines, arcs } = split(s, picks), hv = hvOf(s);
  const onlyLines = (min: number, max = Infinity) => points.length === 0 && arcs.length === 0 && lines.length >= min && lines.length <= max;
  const axis = (key: 'h' | 'v', name: string) => !onlyLines(1) ? 'Select one or more straight edges'
    : lines.every(i => hv[key].includes(i)) ? `Already ${name}` : null;
  const pair = (kind: 'parallel' | 'perpendicular') => !onlyLines(2, 2) ? 'Select two straight edges'
    : hasRule(s, pairRule(kind, lines[0], lines[1])) ? `Already ${kind}` : null;
  const fixable = points.filter(i => i !== 0 && !hasRule(s, r => r.kind === 'fix' && r.point === i));
  const coincident = points.length === 1 && arcs.length === 1 && lines.length === 0 ? (pointOnArcEnd(s, points[0], arcs[0]) ?? (hasRule(s, r => r.kind === 'coincident' && r.point === points[0] && r.arc === arcs[0]) ? 'Already coincident' : null))
    : points.length === 0 && lines.length === 0 && arcs.length === 2 ? ((s.concentric ?? []).some(p => samePair(p, pairOf(arcs[0], arcs[1]))) ? 'Already concentric' : null)
      : 'Select a point and an arc (point on its centre), or two arcs (same centre)';
  return {
    horizontal: axis('h', 'horizontal'), vertical: axis('v', 'vertical'),
    parallel: pair('parallel'), perpendicular: pair('perpendicular'),
    equal: points.length || edges.length < 2 || (lines.length && arcs.length) ? 'Select two or more lines (same length) or arcs (same radius)' : null,
    fix: !points.length || edges.length ? 'Select one or more points' : !fixable.length ? (points.includes(0) && points.length === 1 ? 'Point 1 is the sketch anchor: it is already fixed' : 'Already fixed') : null,
    coincident,
  };
}
const pairOf = (a: number, b: number): ArcPair => a < b ? [a, b] : [b, a];
function pointOnArcEnd(s: Polygon, point: number, arc: number): string | null {
  const n = s.points.length;
  return point === arc || point === (arc + 1) % n ? `Point ${point + 1} is an end of arc ${arc + 1}: it cannot sit on its centre` : null;
}

/** The selection's dimension: an edge's length, an arc's radius, or the distance between two points (null: none). */
export function dimensionKey(s: Polygon, picks: readonly SketchPick[]): string | null {
  const { points, edges, circles } = split(s, picks);
  if (circles.length === 1 && !edges.length && points.length <= 1) return points.length ? `cdist${points[0]}_${circles[0]}` : `cdia${circles[0]}`;
  if (circles.length === 1 && edges.length === 1 && !points.length) return edgeCircleKey(s, edges[0], circles[0]);
  if (circles.length === 2 && !edges.length && !points.length) return circlePairKeys(circles[0], circles[1]).dist;
  if (circles.length) return null;
  if (edges.length === 1 && !points.length) return (isArc(s, edges[0]) ? 'rad' : 'len') + edges[0];
  if (points.length === 2 && !edges.length) return distanceKey(s, points[0], points[1]);
  if (edges.length === 2 && !points.length && edges.every(i => !isArc(s, i))) return angleKey(edges[0], edges[1]);
  return null;
}
/** The straight, horizontal and vertical dimension keys between two points (dist / dx / dy <lo>_<hi>). */
export function pointDimensionKeys(a: number, b: number): { dist: string; dx: string; dy: string } {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return { dist: `dist${lo}_${hi}`, dx: `dx${lo}_${hi}`, dy: `dy${lo}_${hi}` };
}
/** Two straight edges' angle dimension key (ang<lo>_<hi>). */
export const angleKey = (a: number, b: number) => `ang${Math.min(a, b)}_${Math.max(a, b)}`;
type PointDim = 'dist' | 'dx' | 'dy';
const ruleKind = { dist: 'distance', dx: 'dx', dy: 'dy' } as const;
const pointDimName = { dist: 'Distance', dx: 'Horizontal distance', dy: 'Vertical distance' } as const;
/** Two points' dimension key: the edge between them when they are its ends, else a point distance. */
export function distanceKey(s: Polygon, a: number, b: number): string {
  const n = s.points.length, [lo, hi] = a < b ? [a, b] : [b, a];
  const edge = hi === lo + 1 ? lo : lo === 0 && hi === n - 1 ? hi : -1;
  return edge >= 0 && !isArc(s, edge) ? 'len' + edge : `dist${lo}_${hi}`;
}

/** Applies one constraint to the selection: the solved outline, or why it is refused. */
export function applyConstraint(s: Polygon, picks: readonly SketchPick[], kind: ConstraintKind): EditResult {
  const why = constraintOptions(s, picks)[kind]; if (why) return { ok: false, reason: why };
  const { points, lines, arcs } = split(s, picks), hv = hvOf(s), rules = s.rules ?? [];
  switch (kind) {
    case 'horizontal': case 'vertical': {
      const key = kind === 'horizontal' ? 'h' : 'v', other = kind === 'horizontal' ? 'v' : 'h';
      const clash = lines.filter(i => hv[other].includes(i));
      if (clash.length) return { ok: false, reason: `${list(clash.map(i => edgeName(s, i)))} ${clash.length > 1 ? 'are' : 'is'} ${other === 'h' ? 'horizontal' : 'vertical'}: remove that constraint first` };
      const add = lines.filter(i => !hv[key].includes(i));
      const next = { ...hv, [key]: [...hv[key], ...add].sort((x, y) => x - y) };
      return checkEdit({ ...s, hv: next }, s, `${kind === 'horizontal' ? 'Horizontal' : 'Vertical'} ${list(add.map(i => edgeName(s, i)))}`);
    }
    case 'parallel': case 'perpendicular':
      return checkEdit({ ...s, hv, rules: [...rules, { kind, a: lines[0], b: lines[1] }] }, s,
        `${kind === 'parallel' ? 'Parallel' : 'Perpendicular'} ${edgeName(s, lines[0])} and ${edgeName(s, lines[1])}`);
    case 'equal': {
      if (arcs.length) {
        const pairs = arcs.slice(1).map(b => pairOf(arcs[0], b)).filter(p => !(s.equalRadii ?? []).some(q => samePair(p, q)));
        if (!pairs.length) return { ok: false, reason: 'Already equal' };
        return checkEdit({ ...s, hv, equalRadii: [...(s.equalRadii ?? []), ...pairs] }, s, `Equal radius ${list(arcs.map(i => edgeName(s, i)))}`);
      }
      const added = lines.slice(1).filter(b => !hasRule(s, pairRule('equal', lines[0], b))).map((b): SketchRule => ({ kind: 'equal', a: lines[0], b }));
      if (!added.length) return { ok: false, reason: 'Already equal' };
      return checkEdit({ ...s, hv, rules: [...rules, ...added] }, s, `Equal length ${list(lines.map(i => edgeName(s, i)))}`);
    }
    case 'fix': {
      const add = points.filter(i => i !== 0 && !hasRule(s, r => r.kind === 'fix' && r.point === i));
      return checkEdit({ ...s, hv, rules: [...rules, ...add.map((i): SketchRule => ({ kind: 'fix', point: i, at: [...s.points[i]] as P2 }))] }, s,
        `Fix ${list(add.map(i => `point ${i + 1}`))}`);
    }
    case 'coincident':
      if (arcs.length === 2) return checkEdit({ ...s, hv, concentric: [...(s.concentric ?? []), pairOf(arcs[0], arcs[1])] }, s, `Concentric ${edgeName(s, arcs[0])} and ${edgeName(s, arcs[1])}`);
      return checkEdit({ ...s, hv, rules: [...rules, { kind: 'coincident', point: points[0], arc: arcs[0] }] }, s, `Point ${points[0] + 1} on the centre of arc ${arcs[0] + 1}`);
  }
}

/** A dimension's current value in the drawing (len<i>, rad<i>, dist / dx / dy <a>_<b>). */
export function dimensionValue(s: Polygon, key: string): number | null {
  const l = parseLinkKey(key);
  if (l) {
    if (l.kind === 'cedge') { const c = s.circles?.[l.j], p = s.points[l.edge]; if (!c || !p || !edgeCircleKey(s, l.edge, l.j)) return null; const m = edgeAxis(s, l.edge); return Math.abs(c.c[m] - p[m]); }
    const a = s.circles?.[l.a]?.c, b = s.circles?.[l.b]?.c; if (!a || !b || l.a === l.b) return null;
    return l.kind === 'ccdist' ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs(b[l.kind === 'ccdx' ? 0 : 1] - a[l.kind === 'ccdx' ? 0 : 1]);
  }
  const c = parseCircleKey(key);
  if (c) {
    const circle = s.circles?.[c.j]; if (!circle) return null;
    if (c.kind === 'cdia') return circle.r * 2;
    const a = s.points[c.a]; if (!a) return null;
    return c.kind === 'cdist' ? Math.hypot(circle.c[0] - a[0], circle.c[1] - a[1]) : Math.abs(circle.c[c.kind === 'cdx' ? 0 : 1] - a[c.kind === 'cdx' ? 0 : 1]);
  }
  const d = parseKey(key), n = s.points.length; if (!d) return null;
  if (d.kind === 'ang') return isLine(s, d.a) && isLine(s, d.b) && d.a !== d.b ? edgeAngle(s.points as P2[], d.a, d.b).degrees : null;
  if ('a' in d) {
    const a = s.points[d.a], b = s.points[d.b]; if (!a || !b) return null;
    return d.kind === 'dist' ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs(b[d.kind === 'dx' ? 0 : 1] - a[d.kind === 'dx' ? 0 : 1]);
  }
  const a = s.points[d.i] as P2, b = s.points[(d.i + 1) % n] as P2, bulge = s.bulges?.[d.i] ?? 0;
  if (!a || (d.kind === 'rad') !== !!bulge) return null;
  return bulge ? arcOf(a, b, bulge).radius : Math.hypot(b[0] - a[0], b[1] - a[1]);
}
/** Whether a dimension is driving (locked). */
export function isDriving(s: Polygon, key: string): boolean {
  const l = parseLinkKey(key);
  if (l) return l.kind === 'cedge' ? hasRule(s, r => r.kind === 'cedge' && r.edge === l.edge && r.circle === l.j) : hasRule(s, r => r.kind === l.kind && r.a === l.a && r.b === l.b);
  const c = parseCircleKey(key);
  if (c) return c.kind === 'cdia' ? false : hasRule(s, r => r.kind === c.kind && r.a === c.a && r.circle === c.j);
  const d = parseKey(key); if (!d) return false;
  if (d.kind === 'ang') return hasRule(s, r => r.kind === 'angle' && r.a === d.a && r.b === d.b);
  if ('a' in d) { const kind = ruleKind[d.kind]; return hasRule(s, r => r.kind === kind && 'b' in r && r.a === d.a && r.b === d.b); }
  return (d.kind === 'rad' ? s.radii : s.lengths)?.[d.i] !== undefined;
}
type LinkDim = { kind: 'cedge'; edge: number; j: number } | { kind: 'ccdist' | 'ccdx' | 'ccdy'; a: number; b: number };
/** Edge-to-circle (cedge<edge>_<circle>) and circle-to-circle (ccdist / ccdx / ccdy <lo>_<hi>) dimension keys. */
function parseLinkKey(key: string): LinkDim | null {
  const e = /^cedge(\d+)_(\d+)$/.exec(key); if (e) return { kind: 'cedge', edge: Number(e[1]), j: Number(e[2]) };
  const c = /^(ccdist|ccdx|ccdy)(\d+)_(\d+)$/.exec(key); return c ? { kind: c[1] as 'ccdist' | 'ccdx' | 'ccdy', a: Number(c[2]), b: Number(c[3]) } : null;
}
/** The straight, horizontal and vertical dimension keys between the outline's circles a and b. */
export const circlePairKeys = (a: number, b: number) => { const [lo, hi] = a < b ? [a, b] : [b, a]; return { dist: `ccdist${lo}_${hi}`, dx: `ccdx${lo}_${hi}`, dy: `ccdy${lo}_${hi}` }; };
/** An edge's distance key to circle j, when the edge is kept horizontal or vertical (null otherwise). */
export function edgeCircleKey(s: Polygon, edge: number, j: number): string | null {
  const hv = hvOf(s); return isLine(s, edge) && (hv.h.includes(edge) || hv.v.includes(edge)) ? `cedge${edge}_${j}` : null;
}
const edgeAxis = (s: Polygon, edge: number): 0 | 1 => hvOf(s).h.includes(edge) ? 1 : 0;
const pairName = { ccdist: 'Distance', ccdx: 'Horizontal distance', ccdy: 'Vertical distance' } as const;
type CircleDim = { kind: 'cdist' | 'cdx' | 'cdy'; a: number; j: number } | { kind: 'cdia'; j: number };
/** Circle dimension keys: cdist / cdx / cdy <point>_<circle>, cdia<circle>. */
function parseCircleKey(key: string): CircleDim | null {
  const d = /^(cdist|cdx|cdy)(\d+)_(\d+)$/.exec(key); if (d) return { kind: d[1] as 'cdist' | 'cdx' | 'cdy', a: Number(d[2]), j: Number(d[3]) };
  const r = /^cdia(\d+)$/.exec(key); return r ? { kind: 'cdia', j: Number(r[1]) } : null;
}
/** The straight, horizontal and vertical dimension keys from point `a` to the outline's circle `j`. */
export const circleDimensionKeys = (a: number, j: number) => ({ dist: `cdist${a}_${j}`, dx: `cdx${a}_${j}`, dy: `cdy${a}_${j}` });
const circleDimName = { cdist: 'Distance', cdx: 'Horizontal distance', cdy: 'Vertical distance' } as const;
function parseKey(key: string): { kind: 'len' | 'rad'; i: number } | { kind: PointDim | 'ang'; a: number; b: number } | null {
  const g = /^ang(\d+)_(\d+)$/.exec(key); if (g) return { kind: 'ang', a: Number(g[1]), b: Number(g[2]) };
  const m = /^(len|rad)(\d+)$/.exec(key); if (m) return { kind: m[1] as 'len' | 'rad', i: Number(m[2]) };
  const d = /^(dist|dx|dy)(\d+)_(\d+)$/.exec(key); return d ? { kind: d[1] as PointDim, a: Number(d[2]), b: Number(d[3]) } : null;
}
export function dimensionLabel(s: Polygon, key: string): string {
  const l = parseLinkKey(key);
  if (l) return l.kind === 'cedge' ? `Distance edge ${l.edge + 1} – circle ${l.j + 1}` : `${pairName[l.kind]} circle ${l.a + 1} – circle ${l.b + 1}`;
  const c = parseCircleKey(key);
  if (c) return c.kind === 'cdia' ? `Diameter of circle ${c.j + 1}` : `${circleDimName[c.kind]} point ${c.a + 1} – circle ${c.j + 1}`;
  const d = parseKey(key); if (!d) return key;
  if (d.kind === 'ang') return `Angle edge ${d.a + 1} – edge ${d.b + 1}`;
  return 'a' in d ? `${pointDimName[d.kind]} point ${d.a + 1} – point ${d.b + 1}` : d.kind === 'rad' ? `Radius of arc ${d.i + 1}` : `Length of edge ${d.i + 1}`;
}

/** Sets a driving dimension to `value` mm (adding it if new): the solved outline, or why it is refused. */
export function commitDimension(s: Polygon, key: string, value: number): EditResult {
  const l = parseLinkKey(key);
  if (l) {
    if (dimensionValue(s, key) === null) return { ok: false, reason: l.kind === 'cedge' ? 'Measure a circle from a horizontal or vertical edge (or from a point)' : 'Unknown dimension' };
    if (!Number.isFinite(value) || value < 0.001) return { ok: false, reason: 'A dimension must be greater than 0' };
    const what = `${dimensionLabel(s, key)} = ${round(value)}`, base = { ...s, hv: hvOf(s) };
    if (l.kind === 'cedge') {
      const rules = (s.rules ?? []).filter(r => !(r.kind === 'cedge' && r.edge === l.edge && r.circle === l.j));
      return checkEdit({ ...base, rules: [...rules, { kind: 'cedge', edge: l.edge, circle: l.j, axis: edgeAxis(s, l.edge), value }] }, s, what);
    }
    const rules = (s.rules ?? []).filter(r => !(r.kind === l.kind && r.a === l.a && r.b === l.b));
    return checkEdit({ ...base, rules: [...rules, { kind: l.kind, a: l.a, b: l.b, value }] }, s, what);
  }
  const c = parseCircleKey(key);
  if (c) {
    if (!s.circles?.[c.j] || (c.kind !== 'cdia' && !s.points[c.a])) return { ok: false, reason: 'Unknown dimension' };
    if (!Number.isFinite(value) || value < 0.001) return { ok: false, reason: 'A dimension must be greater than 0' };
    const what = `${dimensionLabel(s, key)} = ${round(value)}`, base = { ...s, hv: hvOf(s) };
    if (c.kind === 'cdia') return checkEdit({ ...base, circles: s.circles.map((x, j) => j === c.j ? { ...x, r: value / 2 } : x) }, s, what);
    const rules = (s.rules ?? []).filter(r => !(r.kind === c.kind && r.a === c.a && r.circle === c.j));
    return checkEdit({ ...base, rules: [...rules, { kind: c.kind, a: c.a, circle: c.j, value }] }, s, what);
  }
  const d = parseKey(key); if (!d) return { ok: false, reason: 'Unknown dimension' };
  if (d.kind === 'ang') {
    if (!isLine(s, d.a) || !isLine(s, d.b) || d.a === d.b) return { ok: false, reason: 'Unknown dimension' };
    if (!Number.isFinite(value) || value <= 0 || value >= 180) return { ok: false, reason: 'An angle must be between 0° and 180° (use Parallel for 0° or 180°)' };
    const rules = (s.rules ?? []).filter(r => !(r.kind === 'angle' && r.a === d.a && r.b === d.b));
    return checkEdit({ ...s, hv: hvOf(s), rules: [...rules, { kind: 'angle', a: d.a, b: d.b, value }] }, s, `${dimensionLabel(s, key)} = ${round(value)}°`);
  }
  if (!Number.isFinite(value) || value < 0.001) return { ok: false, reason: 'A dimension must be greater than 0' };
  if ('a' in d && (!s.points[d.a] || !s.points[d.b] || d.a === d.b)) return { ok: false, reason: 'Unknown dimension' };
  if ('i' in d && (d.i >= s.points.length || (d.kind === 'rad') !== isArc(s, d.i))) return { ok: false, reason: 'Unknown dimension' };
  const what = `${dimensionLabel(s, key)} = ${round(value)}`, base = { ...s, hv: hvOf(s) };
  if ('a' in d) {
    const kind = ruleKind[d.kind], rules = (s.rules ?? []).filter(r => !(r.kind === kind && 'b' in r && r.a === d.a && r.b === d.b));
    return checkEdit({ ...base, rules: [...rules, { kind, a: d.a, b: d.b, value }] }, s, what);
  }
  const field = d.kind === 'rad' ? 'radii' : 'lengths';
  return checkEdit({ ...base, [field]: { ...(s[field] ?? {}), [d.i]: value } }, s, what);
}

export interface ConstraintEntry { id: string; label: string; detail: string; removable: boolean; involves: SketchPick[] }
const E = (i: number): SketchPick => ({ kind: 'edge', i }), P = (i: number): SketchPick => ({ kind: 'point', i }), C = (i: number): SketchPick => ({ kind: 'circle', i });

/** Every constraint of a closed outline, in a stable order, with what each one involves. */
export function constraintEntries(s: Polygon): ConstraintEntry[] {
  const out: ConstraintEntry[] = [], add = (id: string, label: string, detail: string, involves: SketchPick[], removable = true) => out.push({ id, label, detail, removable, involves });
  add('anchor', 'Anchor', 'point 1', [P(0)], false);
  const hv = hvOf(s);
  for (const i of hv.h) add('h:' + i, 'Horizontal', `edge ${i + 1}`, [E(i)]);
  for (const i of hv.v) add('v:' + i, 'Vertical', `edge ${i + 1}`, [E(i)]);
  for (const [i, l] of Object.entries(s.lengths ?? {})) add('len:' + i, 'Length', `edge ${Number(i) + 1} = ${round(l)}`, [E(Number(i))]);
  for (const [i, r] of Object.entries(s.radii ?? {})) add('rad:' + i, 'Radius', `arc ${Number(i) + 1} = R${round(r)}`, [E(Number(i))]);
  for (const j of s.tangents ?? []) add('tan:' + j, 'Tangent', `point ${j + 1}`, [P(j)]);
  for (const [a, b] of s.equalRadii ?? []) add(`eqr:${a}_${b}`, 'Equal radius', `arc ${a + 1} = arc ${b + 1}`, [E(a), E(b)]);
  for (const [a, b] of s.concentric ?? []) add(`con:${a}_${b}`, 'Concentric', `arc ${a + 1} · arc ${b + 1}`, [E(a), E(b)]);
  (s.rules ?? []).forEach((r, k) => {
    const id = 'rule:' + k;
    if (r.kind === 'parallel') add(id, 'Parallel', `edge ${r.a + 1} ∥ edge ${r.b + 1}`, [E(r.a), E(r.b)]);
    else if (r.kind === 'perpendicular') add(id, 'Perpendicular', `edge ${r.a + 1} ⊥ edge ${r.b + 1}`, [E(r.a), E(r.b)]);
    else if (r.kind === 'equal') add(id, 'Equal length', `edge ${r.a + 1} = edge ${r.b + 1}`, [E(r.a), E(r.b)]);
    else if (r.kind === 'fix') add(id, 'Fixed', `point ${r.point + 1}`, [P(r.point)]);
    else if (r.kind === 'coincident') add(id, 'Coincident', `point ${r.point + 1} · arc ${r.arc + 1} centre`, [P(r.point), E(r.arc)]);
    else if (r.kind === 'cedge') add(id, 'Distance', `edge ${r.edge + 1} – circle ${r.circle + 1} = ${round(r.value)}`, [E(r.edge), C(r.circle)]);
    else if (r.kind === 'ccdist' || r.kind === 'ccdx' || r.kind === 'ccdy') add(id, pairName[r.kind], `circle ${r.a + 1} – circle ${r.b + 1} = ${round(r.value)}`, [C(r.a), C(r.b)]);
    else if (r.kind === 'cdist' || r.kind === 'cdx' || r.kind === 'cdy') add(id, circleDimName[r.kind], `point ${r.a + 1} – circle ${r.circle + 1} = ${round(r.value)}`, [P(r.a), C(r.circle)]);
    else if (r.kind === 'angle') add(id, 'Angle', `edge ${r.a + 1} ∠ edge ${r.b + 1} = ${round(r.value)}°`, [E(r.a), E(r.b)]);
    else if (r.kind === 'distance' || r.kind === 'dx' || r.kind === 'dy') add(id, pointDimName[r.kind === 'distance' ? 'dist' : r.kind], `point ${r.a + 1} – point ${r.b + 1} = ${round(r.value)}`, [P(r.a), P(r.b)]);
  });
  s.bulges?.forEach((b, i) => { if (b) add('arc:' + i, 'Arc', `edge ${i + 1} ${b > 0 ? 'ccw' : 'cw'}`, [E(i)], false); });
  return out;
}

/** The outline without one constraint (removing never conflicts: the drawing already satisfies the rest). */
export function removeConstraint(s: Polygon, id: string): Polygon {
  const [kind, arg = ''] = id.split(':'), i = Number(arg), hv = hvOf(s);
  const without = <T extends Record<number, number>>(rec: T | undefined) => { const next = { ...(rec ?? {}) } as Record<number, number>; delete next[i]; return next; };
  const pair = arg.split('_').map(Number) as ArcPair;
  switch (kind) {
    case 'h': return { ...s, hv: { ...hv, h: hv.h.filter(x => x !== i) } };
    case 'v': return { ...s, hv: { ...hv, v: hv.v.filter(x => x !== i) } };
    case 'len': return { ...s, hv, lengths: without(s.lengths) };
    case 'rad': return { ...s, hv, radii: without(s.radii) };
    case 'tan': return { ...s, hv, tangents: (s.tangents ?? []).filter(x => x !== i) };
    case 'eqr': return { ...s, hv, equalRadii: (s.equalRadii ?? []).filter(p => !samePair(p, pair)) };
    case 'con': return { ...s, hv, concentric: (s.concentric ?? []).filter(p => !samePair(p, pair)) };
    case 'rule': return { ...s, hv, rules: (s.rules ?? []).filter((_, k) => k !== i) };
    default: return s;
  }
}
