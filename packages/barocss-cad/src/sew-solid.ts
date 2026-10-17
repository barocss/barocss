// Open surfaces sewn into one closed solid: each surface a face bounded by its four natural edges
// (u and v at the ends of its domain; an edge that shrinks to a point is left out), corners within the
// tolerance welded, and every edge matched with exactly one other face's edge running along it. The
// faces are turned to agree along their edges and outward. The faces keep their exact surfaces; an
// edge's curve is the first of its two faces' boundary curves (the other lies on it within the
// tolerance). Surfaces trimmed inside their domain, and gaps wider than the tolerance, do not sew.
import { assertValidBrep, buildBrep, type Brep, type BrepFaceInput } from './brep-core.js';
import { evaluateCurve, evaluateSurface, curveDomain, surfaceDomain } from './math.js';
import { extractSurfaceIsoCurve } from './surface-isocurve.js';
import type { Curve, Point, Surface } from './types.js';

export class SewError extends Error {
  constructor(message: string) { super(message); this.name = 'SewError'; }
}

export interface SewSolidRequest {
  /** The body's id (also the faces' names' prefix). */
  readonly id?: string;
  readonly surfaces: readonly Surface[];
  /** Edges and corners closer than this (mm) are one; default 1e-3 of the surfaces' size, at least 1e-6. */
  readonly toleranceMM?: number;
}

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** One boundary side of a face, as its loop runs: from corner `from` to corner `to`. */
interface Side { face: number; curve: Curve; reversed: boolean; from: number; to: number; at: (f: number) => Point }

export function sewSolid(req: SewSolidRequest): Brep {
  const id = (req.id ?? 'sew').replace(/[^A-Za-z0-9_-]/g, '_').replace(/^(?=[^A-Za-z_])/, '_'), surfaces = req.surfaces;
  if (surfaces.length < 2) throw new SewError('sewing needs two or more surfaces');
  let size = 0;
  for (const s of surfaces) for (const row of s.controlPoints) for (const p of row) size = Math.max(size, ...p.map(Math.abs));
  const tol = req.toleranceMM ?? Math.max(1e-6, size * 1e-3);
  if (!(tol > 0)) throw new SewError('the tolerance must be positive');
  // Corners welded within the tolerance.
  const corners: Point[] = [];
  const corner = (p: Point) => { let k = corners.findIndex(q => dist(p, q) <= tol); if (k < 0) { corners.push(p); k = corners.length - 1; } return k; };
  // Each face's loop a → b → c → d over (u0, v0) (u1, v0) (u1, v1) (u0, v1): counter-clockwise about ∂u × ∂v.
  const sides: Side[] = [], loops: number[][] = [];
  surfaces.forEach((s0, k) => {
    const s: Surface = { ...s0, id: `${id}_s${k}` }, { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s);
    const iso = (axis: 'u' | 'v', t: number, n: number) => extractSurfaceIsoCurve(s, { fixedAxis: axis, parameter: t, curveId: `${id}_c${k}_${n}` }).curve;
    const around: [Curve, boolean][] = [[iso('v', v0, 0), false], [iso('u', u1, 1), false], [iso('v', v1, 2), true], [iso('u', u0, 3), true]];
    const loop: number[] = [];
    for (const [curve, reversed] of around) {
      // (A side that shrinks to a point — a surface's pole — is no edge.)
      const ps = curve.controlPoints; if (ps.every(p => dist(p, ps[0]) <= tol)) continue;
      const [t0, t1] = curveDomain(curve), at = (f: number) => evaluateCurve(curve, reversed ? t1 - (t1 - t0) * f : t0 + (t1 - t0) * f);
      sides.push({ face: k, curve, reversed, from: corner(at(0)), to: corner(at(1)), at }); loop.push(sides.length - 1);
    }
    if (loop.length < 2) throw new SewError(`surface ${k + 1} has no area`);
    loops.push(loop);
  });
  // Where along side b (0 … 1, as it runs) its nearest point to p lies, and how far.
  const nearest = (b: Side, p: Point): [number, number] => {
    let best = 0, gap = Infinity;
    for (let i = 0; i <= 32; i++) { const g = dist(b.at(i / 32), p); if (g < gap) { gap = g; best = i / 32; } }
    let lo = Math.max(0, best - 1 / 32), hi = Math.min(1, best + 1 / 32);
    for (let i = 0; i < 40; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (dist(b.at(m1), p) < dist(b.at(m2), p)) hi = m2; else lo = m1; }
    const f = (lo + hi) / 2; return [f, dist(b.at(f), p)];
  };
  // Sides matched in pairs: the same two corners, and each lying along the other.
  const mate = new Int32Array(sides.length).fill(-1), same = new Uint8Array(sides.length);
  const along = (a: Side, b: Side) => [0.2, 0.4, 0.6, 0.8].map(f => nearest(b, a.at(f)));
  for (let i = 0; i < sides.length; i++) {
    if (mate[i] >= 0) continue;
    const a = sides[i], pair = (x: Side) => [Math.min(x.from, x.to), Math.max(x.from, x.to)].join();
    for (let j = i + 1; j < sides.length; j++) {
      const b = sides[j]; if (pair(a) !== pair(b)) continue;
      const fit = along(a, b); if (fit.some(([, g]) => g > tol) || along(b, a).some(([, g]) => g > tol)) continue;
      if (mate[j] >= 0) throw new SewError(`more than two surfaces meet along one edge (surfaces ${sides[mate[j]].face + 1}, ${b.face + 1} and ${a.face + 1})`);
      mate[i] = j; mate[j] = i; same[i] = same[j] = fit[0][0] < fit[3][0] ? 1 : 0;
    }
  }
  const open = sides.filter((_, i) => mate[i] < 0);
  if (open.length) throw new SewError(`the surfaces do not close: ${open.length} edge${open.length === 1 ? '' : 's'} meet no other surface (surface${new Set(open.map(s => s.face)).size === 1 ? '' : 's'} ${[...new Set(open.map(s => s.face + 1))].join(', ')})`);
  // Faces turned so each edge runs opposite ways in its two faces (a breadth-first walk from the first).
  const flip = new Int8Array(surfaces.length).fill(-1); flip[0] = 0;
  const queue = [0], sidesOf = loops;
  while (queue.length) {
    const f = queue.shift()!;
    for (const i of sidesOf[f]) {
      const j = mate[i], g = sides[j].face, want = flip[f] ^ same[i];
      if (flip[g] < 0) { flip[g] = want; queue.push(g); } else if (flip[g] !== want) throw new SewError('the surfaces cannot all face one way (the shell has one side, like a Möbius strip)');
    }
  }
  if (flip.some(x => x < 0)) throw new SewError('the surfaces are not all joined into one shell');
  // Outward: the enclosed volume (divergence theorem over each face's sampled triangles) positive.
  let volume = 0;
  surfaces.forEach((s, k) => {
    const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(s), n = 12, P: Point[][] = [];
    for (let i = 0; i <= n; i++) { const row: Point[] = []; for (let j = 0; j <= n; j++) row.push(evaluateSurface(s, u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * j / n)); P.push(row); }
    const tri = (a: Point, b: Point, c: Point) => (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    let v = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v += tri(P[i][j], P[i + 1][j], P[i + 1][j + 1]) + tri(P[i][j], P[i + 1][j + 1], P[i][j + 1]);
    volume += flip[k] ? -v : v;
  });
  if (!(Math.abs(volume) > tol * tol * tol)) throw new SewError('the sewn shell encloses no volume');
  if (volume < 0) for (let k = 0; k < flip.length; k++) flip[k] ^= 1;
  // The edges: one per matched pair, its curve the first side's (forward as that curve runs).
  const edgeOf = new Int32Array(sides.length), edges: { id: string; curve: Curve; vertices: [string, string] }[] = [];
  const vid = (c: number) => `${id}_v${c}`;
  sides.forEach((a, i) => {
    if (i > mate[i]) return;
    const e = edges.length, curve: Curve = { ...a.curve, id: `${id}_e${e}` }, [t0, t1] = curveDomain(curve);
    edges.push({ id: curve.id, curve, vertices: [vid(corner(evaluateCurve(curve, t0))), vid(corner(evaluateCurve(curve, t1)))] });
    edgeOf[i] = edgeOf[mate[i]] = e;
  });
  // A side's use: forward when it runs as its edge's curve does (the first side: unless it is reversed;
  // its mate: when they run the same way and the first is not reversed, or the other way and it is).
  const forward = (i: number) => { const j = mate[i], first = Math.min(i, j); return i === first ? !sides[i].reversed : (same[i] === 1) === !sides[first].reversed; };
  const faces: BrepFaceInput[] = surfaces.map((s, k) => {
    const loop = flip[k] ? [...loops[k]].reverse() : loops[k];
    return { id: `${id}_f${k}`, name: `${id}.surface${k}`, surface: { ...s, id: `${id}_s${k}` }, sense: flip[k] ? 'reversed' : 'forward',
      loops: [{ kind: 'outer', uses: loop.map(i => ({ edge: `${id}_e${edgeOf[i]}`, sense: forward(i) !== !!flip[k] ? 'forward' as const : 'reversed' as const })) }] };
  });
  const brep = buildBrep({ source: { family: 'sew', id }, toleranceMM: tol, vertices: corners.map((p, c) => ({ id: vid(c), point: p })).filter(v => edges.some(e => e.vertices.includes(v.id))), edges,
    bodies: [{ id, kind: 'solid', shells: [{ id: `${id}_shell`, faces, closed: true }] }] });
  assertValidBrep(brep);
  return brep;
}
