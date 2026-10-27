// Open surfaces sewn into one closed solid: each surface a face bounded by its four natural edges
// (u and v at the ends of its domain; an edge that shrinks to a point is left out), corners within the
// tolerance welded, and every edge matched with exactly one other face's edge running along it. The
// faces are turned to agree along their edges and outward. The faces keep their exact surfaces; an
// edge's curve is the first of its two faces' boundary curves (the other lies on it within the
// tolerance). Surfaces trimmed inside their domain, and gaps wider than the tolerance, do not sew.
import { assertValidBrep, buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import { evaluateCurve, curveDomain, curveEvaluator, surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { extractSurfaceIsoCurve } from '../nurbs/surfaces/surface-isocurve.js';
import type { Curve, Point, Surface } from '../types.js';
import { dist } from '../core/vec3.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

/** This module's refusal (R7.3a batch 2: the SewError class folded, D279): a BarocssError, `details.source` 'sew'. */
export const sewError = (message: string) => kernelRefusal('sew', 'SEW', message) as KernelError & { readonly code: 'SEW' };
/** Whether something thrown is this module's refusal. */
export const isSewError = (e: unknown): e is KernelError & { readonly code: 'SEW' } => isFrom<'SEW'>(e, 'sew');

export interface SewSolidRequest {
  /** The body's id (also the faces' names' prefix). */
  readonly id?: string;
  readonly surfaces: readonly Surface[];
  /** Edges and corners closer than this (mm) are one; default 1e-3 of the surfaces' size, at least 1e-6. */
  readonly tolerance?: number;
}


/** One boundary side of a face, as its loop runs (reversed: against its curve): from corner `from` to corner `to`. */
interface Side { face: number; curve: Curve; at: (t: number) => Point; reversed: boolean; t0: number; t1: number; from: number; to: number }

/** The side's point a share f (0 … 1) of the way as it runs. */
function sideAt(b: Side, f: number): Point {
  return b.at(b.reversed ? b.t1 - (b.t1 - b.t0) * f : b.t0 + (b.t1 - b.t0) * f);
}
/** Welded corners and a hash of them by cells of the tolerance's size. */
interface Corners { points: Point[]; cells: Map<string, number[]>; tol: number }
/** The welded corner within tol of p, the first added when several are (added when there is none). */
function weld(corners: Corners, p: Point): number {
  const { points, cells, tol } = corners, cx = Math.floor(p[0] / tol), cy = Math.floor(p[1] / tol), cz = Math.floor(p[2] / tol);
  let found = -1;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const list = cells.get(`${cx + i},${cy + j},${cz + k}`); if (!list) continue;
    for (const c of list) if ((found < 0 || c < found) && dist(p, points[c]) <= tol) found = c;
  }
  if (found >= 0) return found;
  const key = `${cx},${cy},${cz}`, list = cells.get(key);
  if (list) list.push(points.length); else cells.set(key, [points.length]);
  points.push(p); return points.length - 1;
}
/** Where along side b (0 … 1, as it runs) its nearest point to p lies, and how far. */
function nearest(b: Side, p: Point): [number, number] {
  let best = 0, gap = Infinity;
  for (let i = 0; i <= 32; i++) { const g = dist(sideAt(b, i / 32), p); if (g < gap) { gap = g; best = i / 32; } }
  let lo = Math.max(0, best - 1 / 32), hi = Math.min(1, best + 1 / 32);
  for (let i = 0; i < 40; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (dist(sideAt(b, m1), p) < dist(sideAt(b, m2), p)) hi = m2; else lo = m1; }
  const f = (lo + hi) / 2; return [f, dist(sideAt(b, f), p)];
}
const SHARES = [0.2, 0.4, 0.6, 0.8];
/** Side a's points at SHARES, each found along b: [where on b, how far]. */
function along(a: Side, b: Side): [number, number][] {
  const out: [number, number][] = [];
  for (const f of SHARES) out.push(nearest(b, sideAt(a, f)));
  return out;
}
const farther = (fit: readonly [number, number][], tol: number) => { for (const [, g] of fit) if (g > tol) return true; return false; };
/** The enclosed volume of a surface's 12 × 12 sample triangles (divergence theorem, ∂u × ∂v outward). */
function sampledVolume(s: Surface): number {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), n = 12, P: Point[][] = [], at = surfaceEvaluator(s);
  for (let i = 0; i <= n; i++) { const row: Point[] = []; for (let j = 0; j <= n; j++) row.push(at(u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * j / n)); P.push(row); }
  let v = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v += tetra(P[i][j], P[i + 1][j], P[i + 1][j + 1]) + tetra(P[i][j], P[i + 1][j + 1], P[i][j + 1]);
  return v;
}
const tetra = (a: Point, b: Point, c: Point) => (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
/**
 * Whether side i runs as its edge's curve does: the pair's first side unless it is reversed; its mate
 * when they run the same way and the first is not reversed, or the other way and it is.
 */
function runsForward(sides: readonly Side[], mate: Int32Array, same: Uint8Array, i: number): boolean {
  const first = Math.min(i, mate[i]);
  return i === first ? !sides[i].reversed : (same[i] === 1) === !sides[first].reversed;
}

export function sewSolid(req: SewSolidRequest): Brep {
  const id = (req.id ?? 'sew').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_'), surfaces = req.surfaces;
  if (surfaces.length < 2) throw sewError('sewing needs two or more surfaces');
  let size = 0;
  for (const s of surfaces) for (const row of s.controlPoints) for (const p of row) for (const x of p) size = Math.max(size, Math.abs(x));
  const tol = req.tolerance ?? Math.max(1e-6, size * 1e-3);
  if (!(tol > 0)) throw sewError('the tolerance must be positive');
  // Corners welded within the tolerance; each face's loop a → b → c → d over (u0, v0) (u1, v0) (u1, v1)
  // (u0, v1): counter-clockwise about ∂u × ∂v.
  const corners: Corners = { points: [], cells: new Map(), tol }, sides: Side[] = [], loops: number[][] = [];
  for (let k = 0; k < surfaces.length; k++) {
    const s: Surface = { ...surfaces[k], id: `${id}_s${k}` }, { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s);
    const around: [Curve, boolean][] = [[isoCurve(s, 'v', v0, `${id}_c${k}_0`), false], [isoCurve(s, 'u', u1, `${id}_c${k}_1`), false], [isoCurve(s, 'v', v1, `${id}_c${k}_2`), true], [isoCurve(s, 'u', u0, `${id}_c${k}_3`), true]];
    const loop: number[] = [];
    for (const [curve, reversed] of around) {
      // (A side that shrinks to a point — a surface's pole — is no edge.)
      if (collapsed(curve.controlPoints, tol)) continue;
      const [t0, t1] = curveDomain(curve), side: Side = { face: k, curve, at: curveEvaluator(curve), reversed, t0, t1, from: 0, to: 0 };
      side.from = weld(corners, sideAt(side, 0)); side.to = weld(corners, sideAt(side, 1));
      sides.push(side); loop.push(sides.length - 1);
    }
    if (loop.length < 2) throw sewError(`surface ${k + 1} has no area`);
    loops.push(loop);
  }
  // Sides matched in pairs: the same two corners, and each lying along the other (candidates by their corners).
  const mate = new Int32Array(sides.length).fill(-1), same = new Uint8Array(sides.length), byCorners = new Map<string, number[]>();
  for (let i = 0; i < sides.length; i++) {
    const key = `${Math.min(sides[i].from, sides[i].to)}-${Math.max(sides[i].from, sides[i].to)}`, list = byCorners.get(key);
    if (list) list.push(i); else byCorners.set(key, [i]);
  }
  for (let i = 0; i < sides.length; i++) {
    if (mate[i] >= 0) continue;
    const a = sides[i];
    for (const j of byCorners.get(`${Math.min(a.from, a.to)}-${Math.max(a.from, a.to)}`)!) {
      if (j <= i) continue;
      const b = sides[j];
      const fit = along(a, b); if (farther(fit, tol) || farther(along(b, a), tol)) continue;
      if (mate[j] >= 0) throw sewError(`more than two surfaces meet along one edge (surfaces ${sides[mate[j]].face + 1}, ${b.face + 1} and ${a.face + 1})`);
      mate[i] = j; mate[j] = i; same[i] = same[j] = fit[0][0] < fit[3][0] ? 1 : 0;
    }
  }
  const openFaces = new Set<number>(); let open = 0;
  for (let i = 0; i < sides.length; i++) if (mate[i] < 0) { open++; openFaces.add(sides[i].face + 1); }
  if (open) throw sewError(`the surfaces do not close: ${open} edge${open === 1 ? '' : 's'} meet no other surface (surface${openFaces.size === 1 ? '' : 's'} ${[...openFaces].join(', ')})`);
  // Faces turned so each edge runs opposite ways in its two faces (a breadth-first walk from the first).
  const flip = new Int8Array(surfaces.length).fill(-1); flip[0] = 0;
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    const f = queue[q];
    for (const i of loops[f]) {
      const g = sides[mate[i]].face, want = flip[f] ^ same[i];
      if (flip[g] < 0) { flip[g] = want; queue.push(g); } else if (flip[g] !== want) throw sewError('the surfaces cannot all face one way (the shell has one side, like a Möbius strip)');
    }
  }
  if (flip.includes(-1)) throw sewError('the surfaces are not all joined into one shell');
  // Outward: the enclosed volume (divergence theorem over each face's sampled triangles) positive.
  let volume = 0;
  for (let k = 0; k < surfaces.length; k++) { const v = sampledVolume(surfaces[k]); volume += flip[k] ? -v : v; }
  if (!(Math.abs(volume) > tol * tol * tol)) throw sewError('the sewn shell encloses no volume');
  if (volume < 0) for (let k = 0; k < flip.length; k++) flip[k] ^= 1;
  // The edges: one per matched pair, its curve the first side's (forward as that curve runs).
  const edgeOf = new Int32Array(sides.length), edges: { id: string; curve: Curve; vertices: [string, string] }[] = [];
  for (let i = 0; i < sides.length; i++) {
    if (i > mate[i]) continue;
    const e = edges.length, curve: Curve = { ...sides[i].curve, id: `${id}_e${e}` }, [t0, t1] = curveDomain(curve);
    edges.push({ id: curve.id, curve, vertices: [`${id}_v${weld(corners, evaluateCurve(curve, t0))}`, `${id}_v${weld(corners, evaluateCurve(curve, t1))}`] });
    edgeOf[i] = edgeOf[mate[i]] = e;
  }
  const faces: BrepFaceInput[] = [];
  for (let k = 0; k < surfaces.length; k++) {
    const loop = flip[k] ? [...loops[k]].reverse() : loops[k], uses: { edge: string; sense: 'forward' | 'reversed' }[] = [];
    for (const i of loop) uses.push({ edge: `${id}_e${edgeOf[i]}`, sense: runsForward(sides, mate, same, i) !== !!flip[k] ? 'forward' : 'reversed' });
    faces.push({ id: `${id}_f${k}`, name: `${id}.surface${k}`, surface: { ...surfaces[k], id: `${id}_s${k}` }, sense: flip[k] ? 'reversed' : 'forward', loops: [{ kind: 'outer', uses }] });
  }
  const used = new Set<string>(); for (const e of edges) { used.add(e.vertices[0]); used.add(e.vertices[1]); }
  const vertices: { id: string; point: Point }[] = [];
  for (let c = 0; c < corners.points.length; c++) if (used.has(`${id}_v${c}`)) vertices.push({ id: `${id}_v${c}`, point: corners.points[c] });
  const brep = buildBrep({ source: { family: 'sew', id }, tolerance: tol, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  assertValidBrep(brep);
  return brep;
}

const isoCurve = (s: Surface, axis: 'u' | 'v', t: number, curveId: string) => extractSurfaceIsoCurve(s, { fixedAxis: axis, parameter: t, curveId }).curve;
const collapsed = (ps: readonly Point[], tol: number) => { for (const p of ps) if (dist(p, ps[0]) > tol) return false; return true; };
