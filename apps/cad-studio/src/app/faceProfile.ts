// A flat face of a body as a sketch profile (Extrude on a picked face, as push/pull in CAD tools): the
// face's boundary from its display triangles (edges of one triangle only), on the face's sketch plane,
// with runs of points on one circle turned back into arcs and straight runs into single lines. The
// outer loop is the profile; the loops inside it are its holes.
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import type { LoopSegment, SketchNode } from '../engine/doc';
import { planeOfFace, toLocal } from '@barocss/cad-model/sketch/plane';
import { signedArea as area } from '@barocss/cad-model/engine/geom2';

type XY = [number, number];
// To 0.1 µm: the display mesh is single precision, so authored sizes come back rounded off.
const r4 = (x: number) => Math.round(x * 1e4) / 1e4 || 0;

/** The closed boundary loops of face `face` of a display mesh, as world points (in triangle winding order). */
export function faceBoundary(mesh: DisplayMesh, face: number): Vec3[][] {
  const key = (v: number) => [0, 1, 2].map(k => Math.round(mesh.positions[v * 3 + k] * 1e5)).join(',');
  const point = new Map<string, Vec3>(), count = new Map<string, number>(), directed: [string, string][] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    if (mesh.faceOfVertex[mesh.indices[t]] !== face) continue;
    const ks = [0, 1, 2].map(j => { const v = mesh.indices[t + j], k = key(v); if (!point.has(k)) point.set(k, [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]); return k; });
    for (let j = 0; j < 3; j++) {
      const a = ks[j], b = ks[(j + 1) % 3]; if (a === b) continue;
      const u = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(u, (count.get(u) ?? 0) + 1); directed.push([a, b]);
    }
  }
  const next = new Map<string, string>();
  for (const [a, b] of directed) if (count.get(a < b ? `${a}|${b}` : `${b}|${a}`) === 1) next.set(a, b);
  const loops: Vec3[][] = [], seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: Vec3[] = []; let k: string | undefined = start;
    while (k !== undefined && !seen.has(k)) { seen.add(k); loop.push(point.get(k)!); k = next.get(k); }
    if (k === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** The circle through three points (null when they are in a line). */
function circleOf(a: XY, b: XY, c: XY): { c: XY; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const s = (p: XY) => p[0] * p[0] + p[1] * p[1];
  const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d, y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { c: [x, y], r: Math.hypot(a[0] - x, a[1] - y) };
}
/** Chords of a sampled arc: short against the radius (well under a radian each) and about one length. */
function chords(run: readonly XY[], r: number): boolean {
  const ls = run.slice(1).map((p, q) => Math.hypot(p[0] - run[q][0], p[1] - run[q][1])), lo = Math.min(...ls), hi = Math.max(...ls);
  return hi < r * 0.6 && hi < lo * 1.5;
}
const turn = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);

/**
 * A counter-clockwise ring of points as line and arc segments: straight runs as one line, runs of three
 * or more points on one circle (turning one way, in even chords well under a radian) as
 * one arc. `tol` is how far a point may lie off the line or circle.
 */
export function fitLoop(ring: readonly XY[], tol: number): LoopSegment[] {
  const n = ring.length, at = (i: number) => ring[((i % n) + n) % n];
  // A whole circle: every point on the circle through three spread ones.
  const whole = n >= 6 ? circleOf(ring[0], ring[Math.floor(n / 3)], ring[Math.floor(2 * n / 3)]) : null;
  if (whole && ring.every(p => Math.abs(Math.hypot(p[0] - whole.c[0], p[1] - whole.c[1]) - whole.r) < tol)) {
    const c: XY = [r4(whole.c[0]), r4(whole.c[1])];
    return [{ kind: 'arc', start: [r4(c[0] + whole.r), c[1]], center: c, direction: 'ccw' }];
  }
  // Start at a corner: a point where the outline's direction jumps (else the loop could start inside an arc).
  const chord = (i: number) => Math.atan2(at(i + 1)[1] - at(i)[1], at(i + 1)[0] - at(i)[0]);
  const bend = (i: number) => { let d = chord(i) - chord(i - 1); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
  let first = 0; for (let i = 1; i < n; i++) if (bend(i) > bend(first)) first = i;
  const pts = Array.from({ length: n + 1 }, (_, i) => at(first + i)); // closed: last = first
  const out: LoopSegment[] = [];
  let i = 0;
  while (i < n) {
    // The longest straight run from i.
    let j = i + 1;
    while (j < n) { const a = pts[i], b = pts[j + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!(l > 0) || pts.slice(i + 1, j + 1).some(p => Math.abs(turn(a, b, p)) / l > tol)) break; j++; }
    // The longest arc from i (three or more points, one way, all on the circle of its ends and middle).
    let k = i + 1, arc: { c: XY; r: number } | null = null;
    for (let m = i + 2; m <= n; m++) {
      const c = circleOf(pts[i], pts[Math.floor((i + m) / 2)], pts[m]); if (!c) break;
      const run = pts.slice(i, m + 1), sign = Math.sign(turn(run[0], run[1], run[2]));
      const fits = run.every(p => Math.abs(Math.hypot(p[0] - c.c[0], p[1] - c.c[1]) - c.r) < tol)
        && run.slice(1, -1).every((_, q) => Math.sign(turn(run[q], run[q + 1], run[q + 2])) === sign)
        && chords(run, c.r);
      if (!fits) break;
      k = m; arc = c;
    }
    if (arc && k > j) {
      const dir = turn(pts[i], pts[i + 1], pts[i + 2]) > 0 ? 'ccw' : 'cw';
      out.push({ kind: 'arc', start: [r4(pts[i][0]), r4(pts[i][1])], center: [r4(arc.c[0]), r4(arc.c[1])], direction: dir });
      i = k;
    } else { out.push({ kind: 'line', start: [r4(pts[i][0]), r4(pts[i][1])] }); i = j; }
  }
  // An arc the start fell inside (tangent joints bend no more than the chords): its two pieces as one.
  const same = (a: LoopSegment, b: LoopSegment) => a.kind === 'arc' && b.kind === 'arc' && a.direction === b.direction && Math.hypot(Number(a.center[0]) - Number(b.center[0]), Number(a.center[1]) - Number(b.center[1])) < tol;
  if (out.length > 2 && same(out[out.length - 1], out[0])) out.shift();
  return out;
}

/** The sketch a flat face makes (its plane, outline and holes), or null for a curved face or no closed boundary. */
export function faceProfile(mesh: DisplayMesh, face: number): SketchNode | null {
  const f = mesh.faces[face]; if (!f || f.kind !== 'plane') return null;
  const plane = planeOfFace(f.normal, f.centroid); if (!plane) return null;
  const size = Math.max(...[0, 1, 2].map(k => mesh.bounds.max[k] - mesh.bounds.min[k])), tol = Math.max(1e-4, size * 2e-4);
  const rings = faceBoundary(mesh, face).map(l => l.map(p => toLocal(plane, p)))
    // Counter-clockwise each (holes too, as drawn ones are), the largest first: the outline.
    .map(r => area(r) < 0 ? [...r].reverse() : r).sort((a, b) => area(b) - area(a));
  if (!rings.length) return null;
  const [outer, ...holes] = rings.map(r => fitLoop(r, tol));
  const r3 = (v: readonly number[]) => v.map(r4) as [number, number, number];
  return { kind: 'sketch', profile: 'loop', segments: outer, ...(holes.length ? { holes } : {}), plane: { origin: r3(plane.origin), normal: r3(plane.normal), xAxis: r3(plane.xAxis) } };
}
