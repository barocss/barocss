// CG1.1: two affine-corresponding convex polygons on explicit planes. Each intermediate section
// is planar. Positive det(A(t), B(t), D(q)) on the whole polygon and span separates every pair
// of sections: P(s,q) lies strictly on the s-t side of the plane at t. This is an admission
// certificate, not a sampled mesh-intersection test. CG1.1b also admits non-affine polygons on
// frames with identical axes: every intermediate polygon must remain strictly convex, certified
// by all edge/vertex orientation quadratics. The strictly ordered parallel planes cannot meet.
// Circle/ellipse pairs use the separate exact conic path; general curves and more than two planes stay out.
import { BrepError, buildBrep, lineCurve, type BrepFaceInput } from '../brep/brep-core.js';
import { solidMassFromIntegrals } from '../brep/solid-mass.js';
import { gauss } from '../core/quadrature.js';
import { buildProfileLoop, capSurface, ExtrudedProfileLimits, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { curvedLoftSolid } from './curved-loft.js';
import type { loftSolid, LoftInput, LoftSectionFrame } from './loft.js';
import { framedMixedLoftSolid } from './framed-mixed-loft.js';
import type { Point } from '../types.js';

type XY = [number, number];
type Basis = { origin: Point; u: Point; v: Point };
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix = (a: Point, b: Point, t: number): Point => [0, 1, 2].map(i => a[i] + t * (b[i] - a[i])) as Point;
const point = (f: Basis, q: XY): Point => [0, 1, 2].map(i => f.origin[i] + q[0] * f.u[i] + q[1] * f.v[i]) as Point;
const turn = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: oriented sections ${detail}`); };
const folded = (): never => { throw new BrepError('GEOMETRY', 'loft: oriented sections intersect, fold, or have no certified positive separation'); };
/** Exact location of a quadratic's minimum on [0,1], including an interior minimum. */
function minimumOnSpan(f: (t: number) => number): number {
  const y0 = f(0), ym = f(0.5), y1 = f(1), A = 2 * (y1 + y0 - 2 * ym), B = y1 - y0 - A;
  const t = A > 0 ? -B / (2 * A) : -1;
  return Math.min(y0, y1, t > 0 && t < 1 ? f(t) : Infinity);
}

function frame(input: LoftSectionFrame | undefined): Basis {
  if (!input || typeof input !== 'object') return fail('must each provide a frame');
  const vector = (x: unknown): Point => {
    if (!Array.isArray(x) || x.length !== 3 || !x.every(v => typeof v === 'number' && Number.isFinite(v))) return fail('need finite three-component frame vectors');
    return [...x] as Point;
  };
  const origin = vector(input.origin), u = vector(input.xAxis), v = vector(input.yAxis);
  // An explicit rigid, right-handed frame: its normal is xAxis × yAxis. No silent projection.
  if (Math.abs(dot(u, u) - 1) > 1e-9 || Math.abs(dot(v, v) - 1) > 1e-9 || Math.abs(dot(u, v)) > 1e-9) return fail('need perpendicular unit xAxis and yAxis');
  return { origin, u, v };
}

export function orientedLoftSolid(input: LoftInput, legacy: typeof loftSolid) {
  if (input.sections.length !== 2) return fail('currently support exactly two sections');
  if (input.smooth) return fail('currently support ruled sides, not smooth interpolation');
  const S = input.sections;
  if (S.some(s => s.z !== undefined || s.frame === undefined)) return fail('require frame on both sections and no z');
  const frames = S.map(s => frame(s.frame));
  // A guide is admitted only by the exact circle/ellipse path, never ignored by polygon/mixed paths.
  if (input.guide !== undefined) return curvedLoftSolid(input, frames);
  if (S.every(s => Array.isArray(s.profile)) && S.some(s => {
    const p = s.profile as readonly ProfileSegmentInput[];
    return p.some(g => g.kind === 'line') && p.some(g => g.kind === 'arc');
  })) return framedMixedLoftSolid(input, frames, legacy);
  if (S.some(s => !Array.isArray(s.profile) || s.profile.some(g => g.kind === 'arc'))) return curvedLoftSolid(input, frames);
  const loops = S.map(s => buildProfileLoop(s.profile as readonly ProfileSegmentInput[]));
  const polygons = loops.map(loop => loop.segments.map(s => s.kind === 'line' ? [...s.start] as XY : fail('currently support straight polygon edges only')));
  const [lo, hi] = polygons, n = lo.length;
  if (n < 3 || hi.length !== n) return fail('need equal polygon edge counts of at least three');
  const scale = Math.max(1, ...polygons.flat().flat().map(Math.abs));
  for (const p of polygons) for (let i = 0; i < n; i++) {
    if (!(turn(p[i], p[(i + 1) % n], p[(i + 2) % n]) > 1e-9 * scale * scale)) return fail('must be strictly convex polygons without collinear edges');
  }
  // Use the first triangle as coordinates on both section planes. Nonparallel planes require
  // exact affine correspondence; never fit or move a supplied vertex. A separate certificate
  // below permits non-affine polygons only when their frame axes are identical.
  const determinant = turn(lo[0], lo[1], lo[2]);
  const coordinates = (q: XY): XY => [
    ((q[0] - lo[0][0]) * (lo[2][1] - lo[0][1]) - (q[1] - lo[0][1]) * (lo[2][0] - lo[0][0])) / determinant,
    ((lo[1][0] - lo[0][0]) * (q[1] - lo[0][1]) - (lo[1][1] - lo[0][1]) * (q[0] - lo[0][0])) / determinant,
  ];
  const domain = lo.map(coordinates);
  let affine = true;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    if (hi[0][c] + domain[i][0] * (hi[1][c] - hi[0][c]) + domain[i][1] * (hi[2][c] - hi[0][c]) !== hi[i][c]) affine = false;
  }
  const parallelPolygon = !affine;
  const identicalAxes = frames[0].u.every((x, c) => x === frames[1].u[c]) && frames[0].v.every((x, c) => x === frames[1].v[c]);
  if (parallelPolygon && !identicalAxes) return fail('need exact affine polygon correspondence unless both frames have identical axes');
  const interpolateXY = (a: XY, b: XY, t: number): XY => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  const sectionPoint = (i: number, t: number): XY => interpolateXY(lo[i], hi[i], t);
  const planeStep = dot(cross(frames[0].u, frames[0].v), sub(frames[1].origin, frames[0].origin));
  if (parallelPolygon) {
    if (!(planeStep > 1e-9 * Math.max(1, Math.hypot(...sub(frames[1].origin, frames[0].origin))))) return folded();
    // A polygon is strictly convex and simple when every other vertex lies strictly left of
    // each directed edge. Each orientation is quadratic in t. This checks the full interval,
    // rather than just the endpoint shapes or a fixed set of interpolated sections.
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (j === i || j === (i + 1) % n) continue;
      const minimum = minimumOnSpan(t => turn(sectionPoint(i, t), sectionPoint((i + 1) % n, t), sectionPoint(j, t)));
      if (!Number.isFinite(minimum) || !(minimum > 1e-9 * scale * scale)) return folded();
    }
  }
  const basis = polygons.map((p, k): Basis => {
    const origin = point(frames[k], p[0]);
    return { origin, u: sub(point(frames[k], p[1]), origin), v: sub(point(frames[k], p[2]), origin) };
  });
  const [a, b] = basis;
  const at = (t: number): Basis => ({ origin: mix(a.origin, b.origin, t), u: mix(a.u, b.u, t), v: mix(a.v, b.v, t) });
  const delta = (q: XY): Point => sub(point(b, q), point(a, q));
  const J = (q: XY, t: number) => { const f = at(t); return dot(cross(f.u, f.v), delta(q)); };
  // J is affine in q and quadratic in t. Check every polygon vertex and the exact interior
  // minimum of each quadratic. Convexity extends the strict lower bound to the whole section.
  const margin = 1e-9 * Math.max(1, ...domain.map(q => Math.max(Math.hypot(...a.u) * Math.hypot(...a.v), Math.hypot(...b.u) * Math.hypot(...b.v)) * Math.hypot(...delta(q))));
  for (const q of parallelPolygon ? [] : domain) {
    const minimum = minimumOnSpan(t => J(q, t));
    if (!Number.isFinite(minimum) || !(minimum > margin)) return folded();
  }

  const id = input.id, nm = input.name;
  const tags = input.sideTags;
  if (tags && (tags.length !== n || tags.some(t => typeof t !== 'string' || !t.length) || new Set(tags).size !== n)) return fail('need one unique nonempty side tag per first-section edge');
  const side = (i: number) => `${nm}.${tags ? `side[${tags[loops[0].reversed ? n - 1 - i : i]}]` : `side${i}`}`;
  const vertex = (k: number, i: number) => `v${k}_${i % n}`, ring = (k: number, i: number) => `r${k}_${i % n}`, ruling = (i: number) => `l0_${i % n}`;
  const positions = parallelPolygon ? polygons.map((p, k) => p.map(q => point(frames[k], q))) : basis.map(f => domain.map(q => point(f, q)));
  if (positions.flat().some(p => p.some(x => !Number.isFinite(x) || Math.abs(x) > ExtrudedProfileLimits.coordinateMM))) return fail('leave the existing modeling coordinate range');
  const vertices = positions.flatMap((p, k) => p.map((q, i) => ({ id: vertex(k, i), point: q })));
  const edges = positions.flatMap((p, k) => p.map((q, i) => ({ id: ring(k, i), curve: lineCurve(ring(k, i), q, p[(i + 1) % n]), vertices: [vertex(k, i), vertex(k, i + 1)] as [string, string], name: [k ? `${nm}.top` : `${nm}.bottom`, side(i)].sort().join('|') })));
  for (let i = 0; i < n; i++) edges.push({ id: ruling(i), curve: lineCurve(ruling(i), positions[0][i], positions[1][i]), vertices: [vertex(0, i), vertex(1, i)], name: [side((i + n - 1) % n), side(i)].sort().join('|') });
  const faces: BrepFaceInput[] = domain.map((_, i) => {
    const j = (i + 1) % n;
    return { id: `f0_${i}`, name: side(i), sense: 'forward', surface: {
      kind: 'surface', id: `f0_${i}`, degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
      controlPoints: [[positions[0][i], positions[1][i]], [mix(positions[0][i], positions[0][j], 0.5), mix(positions[1][i], positions[1][j], 0.5)], [positions[0][j], positions[1][j]]], weights: [[1, 1], [1, 1], [1, 1]],
    }, loops: [{ kind: 'outer', uses: [{ edge: ring(0, i), sense: 'forward' }, { edge: ruling(i + 1), sense: 'forward' }, { edge: ring(1, i), sense: 'reversed' }, { edge: ruling(i), sense: 'reversed' }] }] };
  });
  const bounds = { min: [Math.min(...domain.map(q => q[0])) - 1, Math.min(...domain.map(q => q[1])) - 1] as XY, max: [Math.max(...domain.map(q => q[0])) + 1, Math.max(...domain.map(q => q[1])) + 1] as XY };
  for (const k of [0, 1]) {
    const p = polygons[k];
    const capBounds = parallelPolygon ? { min: [Math.min(...p.map(q => q[0])) - 1, Math.min(...p.map(q => q[1])) - 1] as XY, max: [Math.max(...p.map(q => q[0])) + 1, Math.max(...p.map(q => q[1])) + 1] as XY } : bounds;
    const cap = capSurface(capBounds, 0, k ? 'top' : 'bottom', k === 1);
    cap.controlPoints = cap.controlPoints.map(row => row.map(p => point(parallelPolygon ? frames[k] : basis[k], [p[0], p[1]])));
    faces.push({ id: k ? 'top' : 'bottom', surface: cap, name: `${nm}.${k ? 'top' : 'bottom'}`, sense: 'forward', loops: [{ kind: 'outer', uses: domain.map((_, i) => ({ edge: ring(k, k ? i : n - 1 - i), sense: k ? 'forward' as const : 'reversed' as const })) }] });
  }
  const brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });

  // Integrate the actual ruled map over a triangle fan in its convex domain. With a Duffy
  // triangle map, second moments × J × triangle Jacobian have degree at most seven in each
  // integration variable. Four-point Gauss integrates these polynomials to rounding, no mesh.
  const G = gauss(4), I = Array(10).fill(0) as number[];
  for (let i = 1; i < n - 1; i++) {
    G.x.forEach((u, iu) => G.x.forEach((v, iv) => G.x.forEach((t, it) => {
      const [q0, q1, q2] = parallelPolygon ? [sectionPoint(0, t), sectionPoint(i, t), sectionPoint(i + 1, t)] : [domain[0], domain[i], domain[i + 1]];
      const area2 = turn(q0, q1, q2);
      const q: XY = [0, 1].map(c => q0[c] + u * (q1[c] - q0[c]) + (1 - u) * v * (q2[c] - q0[c])) as XY;
      const f = parallelPolygon ? { origin: mix(frames[0].origin, frames[1].origin, t), u: frames[0].u, v: frames[0].v } : at(t);
      const [x, y, z] = point(f, q), w = G.w[iu] * G.w[iv] * G.w[it] * area2 * (1 - u) * (parallelPolygon ? planeStep : J(q, t));
      const moments = [1, x, y, z, x * x, y * y, z * z, x * y, x * z, y * z];
      moments.forEach((m, j) => { I[j] += w * m; });
    })));
  }
  if (!I.every(Number.isFinite) || !(I[0] > 0)) return folded();
  return { brep, mass: (density: number) => solidMassFromIntegrals(I, density, 'quadrature') };
}
