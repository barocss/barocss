// Sketch geometry shared by the viewport, the sketch panel and Finish sketch.
// An outline is a closed chain of points; segment i runs from point i to point i+1 and is a line
// (bulge 0) or a circular arc. Bulge is the DXF convention: tan(sweep / 4), positive = counter-clockwise.
import { solveXYNumericalSketch } from '@barocss/cad';

export type P2 = [number, number];
export type LoopSegment = { kind: 'line'; start: P2 } | { kind: 'arc'; start: P2; center: P2; direction: 'ccw' | 'cw' };

const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0; // never -0

/** Bulge of the arc from a to b that passes through p; 0 when p is (nearly) on the chord line. */
export function bulgeThrough(a: P2, b: P2, p: P2): number {
  const pa = sub(a, p), pb = sub(b, p);
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (chord < 1e-9 || Math.abs(cross(sub(b, a), sub(p, a))) / chord < chord * 0.02) return 0;
  const inscribed = Math.acos(Math.max(-1, Math.min(1, (pa[0] * pb[0] + pa[1] * pb[1]) / (Math.hypot(...pa) * Math.hypot(...pb)))));
  // A counter-clockwise arc from a to b bulges to the right of the chord.
  const sign = cross(sub(b, a), sub(p, a)) < 0 ? 1 : -1;
  return sign / Math.tan(inscribed / 2);
}

export interface Arc { center: P2; radius: number; start: number; sweep: number }
/** Centre, radius and signed sweep of the arc a→b with this bulge. */
export function arcOf(a: P2, b: P2, bulge: number): Arc {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]); const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n: P2 = [-(b[1] - a[1]) / c, (b[0] - a[0]) / c]; // left normal of the chord
  const d = (c / 2) * (1 - bulge * bulge) / (2 * bulge);
  const center: P2 = [m[0] + n[0] * d, m[1] + n[1] * d];
  return { center, radius: Math.hypot(a[0] - center[0], a[1] - center[1]), start: Math.atan2(a[1] - center[1], a[0] - center[0]), sweep: 4 * Math.atan(bulge) };
}
export function radiusToBulge(a: P2, b: P2, radius: number, sign: number): number | null {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1]); if (radius < c / 2 - 1e-9) return null;
  const s = radius - Math.sqrt(Math.max(0, radius * radius - c * c / 4)); // minor-arc sagitta
  return (sign < 0 ? -1 : 1) * 2 * s / c;
}

/** Points along one segment, excluding its end point. */
export function sampleSegment(a: P2, b: P2, bulge: number, perQuarter = 8): P2[] {
  if (!bulge) return [a];
  const arc = arcOf(a, b, bulge); const steps = Math.max(2, Math.ceil(Math.abs(arc.sweep) / (Math.PI / 2) * perQuarter));
  return Array.from({ length: steps }, (_, i) => {
    const t = arc.start + arc.sweep * i / steps; return [arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)] as P2;
  });
}
export function sampleOutline(points: P2[], bulges: number[] | undefined, closed: boolean): P2[] {
  const n = points.length, out: P2[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) out.push(...sampleSegment(points[i], points[(i + 1) % n], bulges?.[i] ?? 0));
  if (!closed && n) out.push(points[n - 1]);
  return out;
}
export const signedArea = (ring: P2[]) => ring.reduce((s, p, i) => s + cross(p, ring[(i + 1) % ring.length]), 0) / 2;

export function outlineSegments(points: P2[], bulges: number[] | undefined): LoopSegment[] {
  return points.map((start, i) => {
    const b = bulges?.[i] ?? 0; if (!b) return { kind: 'line', start };
    const arc = arcOf(start, points[(i + 1) % points.length], b);
    // The centre is kept at full precision: the kernel requires both ends on one circle within 1e-7 mm.
    return { kind: 'arc', start, center: arc.center, direction: b > 0 ? 'ccw' : 'cw' };
  });
}

/** A straight slot: two centres, a width; semicircular ends. */
export function slotSegments(a: P2, b: P2, r: number): LoopSegment[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const u: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; const n: P2 = [-u[1], u[0]];
  const at = (c: P2, s: number): P2 => [c[0] + n[0] * r * s || 0, c[1] + n[1] * r * s || 0]; // unrounded: ends stay on their circles
  return [
    { kind: 'line', start: at(a, -1) }, { kind: 'arc', start: at(b, -1), center: b, direction: 'ccw' },
    { kind: 'line', start: at(b, 1) }, { kind: 'arc', start: at(a, 1), center: a, direction: 'ccw' },
  ];
}
export function sampleSlot(a: P2, b: P2, r: number, perQuarter = 12): P2[] {
  const segs = slotSegments(a, b, r), out: P2[] = [];
  segs.forEach((s, i) => {
    const end = segs[(i + 1) % segs.length].start;
    if (s.kind === 'line') out.push(s.start);
    else { const t0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]); for (let k = 0; k < perQuarter * 2; k++) { const t = t0 + Math.PI * k / (perQuarter * 2); out.push([s.center[0] + r * Math.cos(t), s.center[1] + r * Math.sin(t)]); } }
    void end;
  });
  return out;
}

// ---- Constraint solving ------------------------------------------------------------------------
// The kernel's numerical sketch solver works on points and straight segments. An arc becomes its
// centre point plus two radius segments (centre → start, centre → end) held equal; tangency is a
// ±90° angle between a line and a radius (0° / 180° between two radii); a radius lock is a length.

export interface OutlineConstraints { lengths?: Record<number, number>; radii?: Record<number, number>; tangents?: number[] }
export interface SolveReport { ok: true; dof: number; rank: number; points: P2[]; bulges: number[] }
export type SolveResult = SolveReport | { ok: false; reason: string };

/** Horizontal / vertical straight edges as drawn (exact coordinate equality on the 1 mm snap). */
export function inferredHV(points: P2[], bulges?: number[]): { h: number[]; v: number[] } {
  const h: number[] = [], v: number[] = [], n = points.length;
  for (let i = 0; i < n; i++) {
    if (bulges?.[i]) continue;
    const a = points[i], b = points[(i + 1) % n]; if (a[1] === b[1]) h.push(i); else if (a[0] === b[0]) v.push(i);
  }
  return { h, v };
}

const angle = (v: P2) => Math.atan2(v[1], v[0]);
const wrap = (a: number) => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };

/** Directions meeting at joint j (segment j−1 in, segment j out) as solver segment ids and current vectors. */
function jointSides(points: P2[], bulges: number[], j: number) {
  const n = points.length, a = (j - 1 + n) % n, b = j;
  const centre = (i: number) => arcOf(points[i], points[(i + 1) % n], bulges[i]).center;
  const into = bulges[a] ? { id: 'rb' + a, v: sub(points[j], centre(a)), arc: true } : { id: 's' + a, v: sub(points[j], points[a]), arc: false };
  const out = bulges[b] ? { id: 'ra' + b, v: sub(points[j], centre(b)), arc: true } : { id: 's' + b, v: sub(points[(j + 1) % n], points[j]), arc: false };
  return { into, out };
}
/** Tangency target at a joint: line/arc → ±90°, arc/arc → 0 or 180°, whichever is nearest the drawing. */
function tangentTarget(points: P2[], bulges: number[], j: number) {
  const { into, out } = jointSides(points, bulges, j);
  if (!into.arc && !out.arc) return null;
  const current = wrap(angle(out.v) - angle(into.v));
  const options = into.arc && out.arc ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
  const target = options.reduce((best, o) => Math.abs(wrap(current - o)) < Math.abs(wrap(current - best)) ? o : best);
  return { a: into.id, b: out.id, target, deviation: Math.abs(wrap(current - target)) };
}
/** Joints next to an arc that are drawn within `toleranceRad` of tangent. */
export function inferTangents(points: P2[], bulges: number[] | undefined, toleranceRad = 12 * Math.PI / 180): number[] {
  if (!bulges?.some(Boolean)) return [];
  return points.flatMap((_, j) => { const t = tangentTarget(points, bulges, j); return t && t.deviation <= toleranceRad ? [j] : []; });
}
export const canBeTangent = (points: P2[], bulges: number[] | undefined, j: number) => !!bulges && tangentTarget(points, bulges, j) !== null;

/**
 * Solves a closed outline with the kernel's numerical sketch solver: point 1 anchored, drawn H/V edges
 * kept, locked lengths and radii held, tangent joints kept tangent. Arcs keep their turning direction.
 */
export function solveOutline(points: P2[], c: OutlineConstraints = {}, bulgesIn?: number[]): SolveResult {
  const n = points.length, bulges = points.map((_, i) => bulgesIn?.[i] ?? 0), arcs = bulges.flatMap((b, i) => b ? [i] : []);
  // Points = outline + one centre per arc; segments = lines + two radii per arc. Both are n + arcs.
  if (n + arcs.length > 16) return { ok: false, reason: 'Too many points and arcs for the sketch solver (16 points / 16 segments)' };
  const centres = new Map(arcs.map(i => [i, arcOf(points[i], points[(i + 1) % n], bulges[i]).center]));
  const hv = inferredHV(points, bulges);
  const segments = [
    ...points.flatMap((_, i) => bulges[i] ? [] : [{ id: 's' + i, startPointId: 'p' + i, endPointId: 'p' + ((i + 1) % n) }]),
    ...arcs.flatMap(i => [{ id: 'ra' + i, startPointId: 'c' + i, endPointId: 'p' + i }, { id: 'rb' + i, startPointId: 'c' + i, endPointId: 'p' + ((i + 1) % n) }]),
  ];
  type Constraint = Parameters<typeof solveXYNumericalSketch>[0]['constraints'][number];
  const constraints: Constraint[] = [
    { id: 'anchor', kind: 'fixed', pointId: 'p0', target: points[0] },
    ...hv.h.map((i): Constraint => ({ id: 'h' + i, kind: 'horizontal', segmentId: 's' + i })),
    ...hv.v.map((i): Constraint => ({ id: 'v' + i, kind: 'vertical', segmentId: 's' + i })),
    ...Object.entries(c.lengths ?? {}).filter(([i]) => !bulges[+i]).map(([i, lengthMM]): Constraint => ({ id: 'l' + i, kind: 'length', segmentId: 's' + i, lengthMM })),
    ...arcs.map((i): Constraint => ({ id: 'e' + i, kind: 'equal-length', segmentA: 'ra' + i, segmentB: 'rb' + i })),
    ...Object.entries(c.radii ?? {}).filter(([i]) => bulges[+i]).map(([i, lengthMM]): Constraint => ({ id: 'r' + i, kind: 'length', segmentId: 'ra' + i, lengthMM })),
    ...(c.tangents ?? []).flatMap((j): Constraint[] => {
      const t = tangentTarget(points, bulges, j); return t ? [{ id: 't' + j, kind: 'signed-angle', segmentA: t.a, segmentB: t.b, angleRad: t.target }] : [];
    }),
  ];
  const result = solveXYNumericalSketch({
    format: 'barocss-xy-numerical-sketch', version: 0, profile: 'bounded-length-angle-v0', id: 'studio_sketch', lengthUnit: 'mm', angleUnit: 'rad',
    points: [...points.map((position, i) => ({ id: 'p' + i, position })), ...arcs.map(i => ({ id: 'c' + i, position: centres.get(i)! }))],
    segments, constraints, branchGuards: [],
  });
  if (!result.ok) {
    const code = result.diagnostics[0]?.code;
    return { ok: false, reason: code === 'NONCONVERGENCE' ? 'These constraints conflict with each other or with the H/V edges'
      : code === 'LIMIT' || code === 'BUDGET' ? 'The sketch is too large for the solver' : result.diagnostics[0]?.message ?? 'The solver refused this sketch' };
  }
  const byId = new Map(result.solution.points.map(p => [p.id, p.position]));
  const solved = points.map((_, i) => { const p = byId.get('p' + i)!; return [round(p[0]), round(p[1])] as P2; });
  // Rebuild each bulge from the solved ends and centre, keeping the arc's turning direction.
  const solvedBulges = bulges.map((b, i) => {
    if (!b) return 0;
    const cc = byId.get('c' + i)!, s0 = sub(solved[i], cc), s1 = sub(solved[(i + 1) % n], cc);
    let sweep = Math.atan2(cross(s0, s1), s0[0] * s1[0] + s0[1] * s1[1]);
    if (b > 0 && sweep <= 0) sweep += 2 * Math.PI; if (b < 0 && sweep >= 0) sweep -= 2 * Math.PI;
    return Math.tan(sweep / 4);
  });
  return { ok: true, dof: result.report.localDegreesOfFreedom, rank: result.report.numericalRank, points: solved, bulges: solvedBulges };
}
