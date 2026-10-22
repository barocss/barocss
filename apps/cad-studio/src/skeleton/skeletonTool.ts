// G17: the 3D skeleton sketch tool's own logic (no React, no viewport): where a pointer places a point (snapped to the
// sketch's points, the bodies' vertices, an axis through the last point, else the work plane), a drag solved live by
// FRg's solver (frames/sketch3d.ts, the outer lane's) with the dragged point as its target, the constraints offered
// for a selection, and the marks the viewport draws for them.
import { solveSketch3D, type Axis3, type BoundConstraint3D, type Constraint3D, type Solve3D, type V3 } from '@barocss/cad-model/frames/sketch3d';
import { boundConstraints, boundRefusal } from '@barocss/cad-model/frames/skeleton';

export interface SkeletonDraft { points: V3[]; segments: [number, number][]; constraints: BoundConstraint3D[] }
export type WorkPlane = 'xy' | 'xz' | 'yz';
export const PLANE_NORMAL: Record<WorkPlane, V3> = { xy: [0, 0, 1], xz: [0, 1, 0], yz: [1, 0, 0] };
const AXIS_DIR: Record<Axis3, V3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** The work plane's two in-plane axes. */
export const PLANE_AXES: Record<WorkPlane, [Axis3, Axis3]> = { xy: ['x', 'y'], xz: ['x', 'z'], yz: ['y', 'z'] };

/** Where the ray meets the work plane through `through`; null when it runs along it or away from it. */
export function onPlane(origin: V3, dir: V3, plane: WorkPlane, through: V3): V3 | null {
  const n = PLANE_NORMAL[plane], d = dot(dir, n); if (Math.abs(d) < 1e-9) return null;
  const t = dot(sub(through, origin), n) / d; if (t < 0) return null;
  return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
}

/** The point on the line through `from` along `axis` nearest the ray (the closest points of two lines); null when they run alike. */
export function onAxisLine(origin: V3, dir: V3, from: V3, axis: Axis3): V3 | null {
  const a = AXIS_DIR[axis], w = sub(from, origin), b = dot(a, dir), d = dot(a, w), e = dot(dir, w), den = 1 - b * b;
  if (Math.abs(den) < 1e-9) return null;
  // (dir is a unit vector, a is: s along the axis from `from`.)
  const s = (b * e - d) / den;
  return [from[0] + a[0] * s, from[1] + a[1] * s, from[2] + a[2] * s];
}

/** The point with its in-plane coordinates on a grid of `step` (the plane's own coordinate kept); as it is with no step. */
export function onGrid(p: V3, step: number, plane: WorkPlane): V3 {
  if (!(step > 0)) return p;
  const keep = plane === 'xy' ? 2 : plane === 'xz' ? 1 : 0;
  return p.map((v, k) => k === keep ? v : Math.round(v / step) * step || 0) as V3;
}

export type Snap = { kind: 'point'; index: number; at: V3 } | { kind: 'vertex'; at: V3 };
/** The sketch's point within `px` of the pointer, else a body vertex within it (the nearest of each); or null. */
export function nearestSnap(x: number, y: number, project: (p: V3) => readonly number[], points: readonly V3[], vertices: readonly V3[], px = 10): Snap | null {
  let best: Snap | null = null, d0 = px;
  points.forEach((p, index) => { const q = project(p), d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = { kind: 'point', index, at: p }; } });
  if (best) return best;
  for (const v of vertices) { const q = project(v), d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = { kind: 'vertex', at: [v[0], v[1], v[2]] }; } }
  return best;
}

/** The segment within `px` of the pointer (its screen distance), or null. */
export function segmentAt(x: number, y: number, project: (p: V3) => readonly number[], points: readonly V3[], segments: readonly [number, number][], px = 6): number | null {
  let best: number | null = null, d0 = px;
  segments.forEach(([i, j], k) => { const a = project(points[i]), b = project(points[j]), d = segDist(x, y, a[0], a[1], b[0], b[1]); if (d < d0) { d0 = d; best = k; } });
  return best;
}

export type Diagnosis = { solve: Solve3D; constraints: Constraint3D[]; bound: ReadonlyMap<number, string> } | { error: string };
/** The draft solved from its points as they are, with its diagnosis (well, under, over, conflict); or why it is refused. */
export function diagnoseDraft(draft: SkeletonDraft, parameters: Readonly<Record<string, number>>): Diagnosis {
  const b = boundConstraints(draft.constraints, parameters); if ('error' in b) return b;
  const why = boundRefusal(draft.points, draft.segments, b); if (why) return { error: why };
  return { solve: solveSketch3D(draft.points, draft.segments, b.constraints), constraints: b.constraints, bound: b.bound };
}

/**
 * A point dragged to `target`, solved live: first with it held at the target (a fixed constraint added) — where the
 * constraints let it go there it lies under the pointer and the rest move as little as they can; else (they hold it:
 * the hold left unmet) the constraints alone solved from the target as the start, the point as near as they let it.
 * A point the sketch fixes does not move. The points, the diagnosis without the hold, and whether it reached the target.
 */
export function dragSolve(draft: SkeletonDraft, index: number, target: V3, parameters: Readonly<Record<string, number>>): { points: V3[]; solve: Solve3D; reached: boolean } | { error: string } {
  const b = boundConstraints(draft.constraints, parameters); if ('error' in b) return b;
  const start = draft.points.map((p, i) => i === index ? [...target] as V3 : p);
  const why = boundRefusal(start, draft.segments, b); if (why) return { error: why };
  if (b.constraints.some(c => c.kind === 'fixed' && c.point === index)) { const solve = solveSketch3D(draft.points, draft.segments, b.constraints); return { points: solve.points, solve, reached: false }; }
  const held = solveSketch3D(start, draft.segments, [...b.constraints, { kind: 'fixed', point: index, at: target }]);
  if (!held.unmet.length) { const solve = solveSketch3D(held.points, draft.segments, b.constraints); return { points: solve.points, solve, reached: true }; }
  const solve = solveSketch3D(start, draft.segments, b.constraints);
  return { points: solve.points, solve, reached: false };
}

export interface Selection3D { points: number[]; segments: number[]; constraints: number[] }
export const NO_SELECTION: Selection3D = { points: [], segments: [], constraints: [] };

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const vec = (d: SkeletonDraft, s: number) => sub(d.points[d.segments[s][1]], d.points[d.segments[s][0]]);
/** The constraints the selection can take, each with its button's label: values as they are now. */
export function offers(d: SkeletonDraft, sel: Selection3D, plane: WorkPlane): { label: string; constraint: BoundConstraint3D }[] {
  const out: { label: string; constraint: BoundConstraint3D }[] = [], P = sel.points, S = sel.segments;
  if (!P.length && S.length === 1) {
    const s = S[0], u = vec(d, s);
    out.push({ label: 'Length', constraint: { kind: 'length', segment: s, value: r3(norm(u)) } });
    for (const axis of ['x', 'y', 'z'] as const) out.push({ label: `Along ${axis.toUpperCase()}`, constraint: { kind: 'along', segment: s, axis } });
  }
  if (!P.length && S.length === 2) {
    const [a, b] = S, u = vec(d, a), v = vec(d, b), deg = Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180 / Math.PI;
    out.push({ label: 'Parallel', constraint: { kind: 'parallel', a, b } }, { label: 'Perpendicular', constraint: { kind: 'perpendicular', a, b } });
    if (deg > 0.5 && deg < 179.5) out.push({ label: 'Angle', constraint: { kind: 'angle', a, b, degrees: Math.round(deg * 10) / 10 } });
  }
  if (P.length === 2 && !S.length) {
    const [a, b] = P;
    out.push({ label: 'Coincident', constraint: { kind: 'coincident', a, b } }, { label: 'Distance', constraint: { kind: 'distance', a, b, value: r3(norm(sub(d.points[b], d.points[a]))) } });
  }
  if (P.length === 1 && !S.length) {
    const p = P[0], at = d.points[p];
    out.push({ label: 'Fix', constraint: { kind: 'fixed', point: p, at: [r3(at[0]), r3(at[1]), r3(at[2])] } });
    out.push({ label: `On ${plane.toUpperCase()} plane`, constraint: { kind: 'on-plane', point: p, plane: { origin: [r3(at[0]), r3(at[1]), r3(at[2])], normal: PLANE_NORMAL[plane] } } });
    for (const axis of ['x', 'y', 'z'] as const) out.push({ label: `On ${axis.toUpperCase()} axis`, constraint: { kind: 'on-axis', point: p, axis } });
  }
  return out;
}

/** A constraint's text for its mark and its row: the symbol, and its value (a bound one with its parameter). */
export function constraintText(c: BoundConstraint3D): string {
  const val = (v: number | { parameter: string }, unit: string) => typeof v === 'number' ? `${+v.toFixed(2)}${unit}` : v.parameter;
  switch (c.kind) {
    case 'length': return `L ${val(c.value, '')}`;
    case 'distance': return `D ${val(c.value, '')}`;
    case 'angle': return `∠ ${val(c.degrees, '°')}`;
    case 'parallel': return '∥';
    case 'perpendicular': return '⊥';
    case 'along': return typeof c.axis === 'string' ? `→${c.axis.toUpperCase()}` : '→';
    case 'on-axis': return typeof c.axis === 'string' ? `on ${c.axis.toUpperCase()}` : 'on axis';
    case 'on-plane': return '▱';
    case 'fixed': return '⚓';
    case 'coincident': return '◎';
  }
}

/**
 * Where each constraint's mark stands on screen: beside its segment's middle (a pair: one on each), or by its point; the
 * marks of one segment side by side along it, those of one point stacked below it.
 */
export function constraintMarks(d: SkeletonDraft, project: (p: V3) => readonly number[]): { constraint: number; at: [number, number]; text: string }[] {
  const bySegment = new Map<number, number[]>(), byPoint = new Map<number, number[]>();
  const on = <K>(m: Map<K, number[]>, key: K, k: number) => { const l = m.get(key); if (l) l.push(k); else m.set(key, [k]); };
  d.constraints.forEach((c, k) => {
    switch (c.kind) {
      case 'length': case 'along': on(bySegment, c.segment, k); break;
      case 'parallel': case 'perpendicular': case 'angle': on(bySegment, c.a, k); on(bySegment, c.b, k); break;
      case 'distance': case 'coincident': on(byPoint, c.a, k); on(byPoint, c.b, k); break;
      case 'fixed': case 'on-axis': case 'on-plane': on(byPoint, c.point, k); break;
    }
  });
  const out: { constraint: number; at: [number, number]; text: string }[] = [];
  for (const [s, ks] of bySegment) {
    const [i, j] = d.segments[s] ?? []; if (i === undefined) continue;
    const a = project(d.points[i]), b = project(d.points[j]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    // (Off the segment by 16 px on its one side; 52 px apart along it, the middle one at its middle.)
    ks.forEach((k, n) => { const t = (n - (ks.length - 1) / 2) * 52; out.push({ constraint: k, at: [(a[0] + b[0]) / 2 - uy * 16 + ux * t, (a[1] + b[1]) / 2 + ux * 16 + uy * t], text: constraintText(d.constraints[k]) }); });
  }
  for (const [p, ks] of byPoint) {
    const q = project(d.points[p]); if (!q) continue;
    ks.forEach((k, n) => out.push({ constraint: k, at: [q[0] + 14, q[1] + 16 + 20 * n], text: constraintText(d.constraints[k]) }));
  }
  return out;
}

/** The diagnosis in words, for the panel's chip. */
export function statusText(s: Solve3D): string {
  switch (s.status) {
    case 'well': return 'Fully defined';
    case 'under': return `Under-defined · ${s.dof} free`;
    case 'over': return `Over-defined · ${s.redundant.length} redundant`;
    case 'conflict': return `Conflict · ${s.unmet.length} unmet`;
  }
}

/**
 * The draft with points, segments or constraints removed: the constraints on what goes go with it, the indices after
 * it renumbered. A point removed takes its segments.
 */
export function removeFromDraft(d: SkeletonDraft, sel: Selection3D): SkeletonDraft {
  const dropP = new Set(sel.points), dropS = new Set(sel.segments.concat(d.segments.flatMap((s, k) => dropP.has(s[0]) || dropP.has(s[1]) ? [k] : [])));
  const pMap = new Map<number, number>(), sMap = new Map<number, number>();
  d.points.forEach((_, i) => { if (!dropP.has(i)) pMap.set(i, pMap.size); });
  d.segments.forEach((_, k) => { if (!dropS.has(k)) sMap.set(k, sMap.size); });
  const constraints = d.constraints.flatMap((c, k): BoundConstraint3D[] => {
    if (sel.constraints.includes(k)) return [];
    const P = (i: number) => pMap.get(i), S = (s: number) => sMap.get(s);
    switch (c.kind) {
      case 'coincident': case 'distance': { const a = P(c.a), b = P(c.b); return a === undefined || b === undefined ? [] : [{ ...c, a, b }]; }
      case 'fixed': case 'on-axis': case 'on-plane': { const p = P(c.point); return p === undefined ? [] : [{ ...c, point: p }]; }
      case 'length': case 'along': { const s = S(c.segment); return s === undefined ? [] : [{ ...c, segment: s }]; }
      case 'parallel': case 'perpendicular': case 'angle': { const a = S(c.a), b = S(c.b); return a === undefined || b === undefined ? [] : [{ ...c, a, b }]; }
    }
  });
  return {
    points: d.points.filter((_, i) => !dropP.has(i)),
    segments: d.segments.flatMap((s, k) => dropS.has(k) ? [] : [[pMap.get(s[0])!, pMap.get(s[1])!] as [number, number]]),
    constraints,
  };
}

const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
