// CG1.1c: exact conic sections on two parallel, identically oriented frames. The same
// rational quarter-circle parameters and weights on both ends make each ruled side's
// intermediate section an ellipse with linearly interpolated centre and positive radii.
// Strictly ordered section planes and positive radii certify a simple closed solid.
import { buildBrep, BrepError, lineCurve, type BrepFaceInput } from '../brep/brep-core.js';
import { solidMassFromIntegrals } from '../brep/solid-mass.js';
import { gauss } from '../core/quadrature.js';
import { buildXYArc } from '../xy-arc.js';
import { buildProfileLoop, capSurface, ExtrudedProfileLimits, type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { LoftInput, LoftSectionInput } from './loft.js';
import type { Curve, Point } from '../types.js';

type XY = [number, number];
type Frame = { readonly origin: Point; readonly u: Point; readonly v: Point };
type Ellipse = { readonly center: XY; readonly radii: XY };
const fail = (detail: string): never => { throw new BrepError('INPUT', `loft: curved sections ${detail}`); };
const map = (f: Frame, p: XY): Point => [0, 1, 2].map(c => f.origin[c] + f.u[c] * p[0] + f.v[c] * p[1]) as Point;
const mix = (a: Point, b: Point, t: number): Point => [0, 1, 2].map(c => a[c] + t * (b[c] - a[c])) as Point;
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function admit(profile: LoftSectionInput['profile']): Ellipse {
  if (Array.isArray(profile)) {
    const loop = buildProfileLoop(profile as readonly ProfileSegmentInput[]);
    const arc = loop.segments[0];
    if (loop.segments.length !== 1 || arc.kind !== 'arc') return fail('currently need one full-circle arc or one inline ellipse on each end');
    // A canonical +X seam gives the four named quarters one stable correspondence. A partial
    // arc or arbitrary phase is not silently joined, rephased or approximated by a polygon.
    if (arc.start[1] !== arc.center[1] || !(arc.start[0] > arc.center[0])) return fail('need a full-circle seam at the positive local X axis');
    return { center: [...arc.center], radii: [arc.radius, arc.radius] };
  }
  const value = profile as Exclude<LoftSectionInput['profile'], readonly ProfileSegmentInput[]>;
  if (!value || typeof value !== 'object' || value.kind !== 'ellipse') return fail('need an inline ellipse profile');
  const pair = (p: unknown, label: string): XY => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(x => typeof x === 'number' && Number.isFinite(x))) return fail(`need a finite two-component ${label}`);
    return [p[0], p[1]];
  };
  const center = pair(value.center, 'center'), radii = pair(value.radii, 'radii');
  if (value.direction !== undefined && value.direction !== 'ccw' && value.direction !== 'cw') return fail('direction must be ccw or cw');
  if (radii.some(r => r < ExtrudedProfileLimits.minimumRadiusMM || r > ExtrudedProfileLimits.coordinateMM)) return fail('need positive radii within the existing profile radius bounds');
  if (center.some(x => Math.abs(x) > ExtrudedProfileLimits.coordinateMM)) return fail('center leaves the existing modeling coordinate range');
  // Match buildProfileLoop's clockwise-loop normalization; both directions keep the +X seam.
  return { center, radii };
}

/** Called after the shared explicit-frame admission. No curved support for the legacy z path. */
export function curvedLoftSolid(input: LoftInput, frames: readonly Frame[]) {
  if (!frames[0].u.every((x, c) => x === frames[1].u[c]) || !frames[0].v.every((x, c) => x === frames[1].v[c])) return fail('currently require identical xAxis and yAxis on both frames');
  const delta = frames[1].origin.map((x, c) => x - frames[0].origin[c]) as Point;
  const planeStep = dot(cross(frames[0].u, frames[0].v), delta);
  if (!(planeStep > 1e-9 * Math.max(1, Math.hypot(...delta)))) throw new BrepError('GEOMETRY', 'loft: curved sections need certified positive plane separation');
  const sections = input.sections.map(s => admit(s.profile));
  const tags = input.sideTags;
  if (tags && (tags.length !== 1 || typeof tags[0] !== 'string' || !tags[0].length)) return fail('need one nonempty tag for the single conic contour');
  const side = (i: number) => `${input.name}.${tags ? `side[${tags[0]}]#${i + 1}` : `side${i}`}`;
  const vertex = (k: number, i: number) => `v${k}_${i % 4}`, ring = (k: number, i: number) => `r${k}_${i % 4}`, ruling = (i: number) => `l0_${i % 4}`;
  // Reuse the existing exact, source-backed conic factory; affine scaling maps its rational
  // quadratic quarter circle to an ellipse without fitting, sampling or changing the weights.
  const unit = ([0, 1, 2, 3] as const).map(quadrant => buildXYArc({ kind: 'quarter-arc', id: `loft_quarter_${quadrant}`, center: [0, 0], radius: 1, quadrant }).curve);
  const curves = sections.map((s, k) => unit.map((q, i): Curve => ({ ...q, id: ring(k, i), knots: [...q.knots], weights: [...q.weights], controlPoints: q.controlPoints.map(p => map(frames[k], [s.center[0] + s.radii[0] * p[0], s.center[1] + s.radii[1] * p[1]])) })));
  if (curves.flat().some(q => q.controlPoints.some(p => p.some(x => !Number.isFinite(x) || Math.abs(x) > ExtrudedProfileLimits.coordinateMM)))) return fail('leave the existing modeling coordinate range');
  const positions = curves.map(row => row.map(q => q.controlPoints[0]));
  const vertices = positions.flatMap((row, k) => row.map((p, i) => ({ id: vertex(k, i), point: p })));
  const edges = curves.flatMap((row, k) => row.map((q, i) => ({ id: ring(k, i), curve: q, vertices: [vertex(k, i), vertex(k, i + 1)] as [string, string], name: [k ? `${input.name}.top` : `${input.name}.bottom`, side(i)].sort().join('|') })));
  for (let i = 0; i < 4; i++) edges.push({ id: ruling(i), curve: lineCurve(ruling(i), positions[0][i], positions[1][i]), vertices: [vertex(0, i), vertex(1, i)], name: [side((i + 3) % 4), side(i)].sort().join('|') });
  const faces: BrepFaceInput[] = unit.map((q, i) => ({ id: `f0_${i}`, name: side(i), sense: 'forward', surface: {
    kind: 'surface', id: `f0_${i}`, degreeU: 2, degreeV: 1, knotsU: [...q.knots], knotsV: [0, 0, 1, 1],
    controlPoints: q.controlPoints.map((_, j) => [curves[0][i].controlPoints[j], curves[1][i].controlPoints[j]]), weights: q.weights.map(w => [w, w]),
  }, loops: [{ kind: 'outer', uses: [{ edge: ring(0, i), sense: 'forward' }, { edge: ruling(i + 1), sense: 'forward' }, { edge: ring(1, i), sense: 'reversed' }, { edge: ruling(i), sense: 'reversed' }] }] }));
  for (const k of [0, 1]) {
    const s = sections[k], [x, y] = s.center, [rx, ry] = s.radii;
    const cap = capSurface({ min: [x - rx - 1, y - ry - 1], max: [x + rx + 1, y + ry + 1] }, 0, k ? 'top' : 'bottom', k === 1);
    cap.controlPoints = cap.controlPoints.map(row => row.map(p => map(frames[k], [p[0], p[1]])));
    faces.push({ id: k ? 'top' : 'bottom', surface: cap, sense: 'forward', name: `${input.name}.${k ? 'top' : 'bottom'}`, loops: [{ kind: 'outer', uses: unit.map((_, i) => ({ edge: ring(k, k ? i : 3 - i), sense: k ? 'forward' as const : 'reversed' as const })) }] });
  }
  const id = input.id, brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });

  // Exact ellipse area moments in the common section basis. Radii and centres are linear in t;
  // second volume moments have degree at most four. Gauss(4) integrates to rounding, no mesh.
  const I = Array(10).fill(0) as number[], G = gauss(4), u = frames[0].u, v = frames[0].v;
  G.x.forEach((t, it) => {
    const a = sections[0], b = sections[1], rx = a.radii[0] + t * (b.radii[0] - a.radii[0]), ry = a.radii[1] + t * (b.radii[1] - a.radii[1]);
    const f: Frame = { origin: mix(frames[0].origin, frames[1].origin, t), u, v };
    const c = map(f, [a.center[0] + t * (b.center[0] - a.center[0]), a.center[1] + t * (b.center[1] - a.center[1])]);
    const second = (i: number, j: number) => c[i] * c[j] + rx * rx / 4 * u[i] * u[j] + ry * ry / 4 * v[i] * v[j];
    const w = G.w[it] * planeStep * Math.PI * rx * ry;
    const moments = [1, ...c, second(0, 0), second(1, 1), second(2, 2), second(0, 1), second(0, 2), second(1, 2)];
    moments.forEach((m, i) => { I[i] += w * m; });
  });
  if (!I.every(Number.isFinite) || !(I[0] > 0)) throw new BrepError('GEOMETRY', 'loft: curved sections have no finite positive volume');
  return { brep, mass: (density: number) => solidMassFromIntegrals(I, density, 'quadrature') };
}
