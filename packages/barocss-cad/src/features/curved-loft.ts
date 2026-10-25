// Exact conic sections on two or three parallel, identically oriented frames. The same
// rational quarter-circle parameters and weights on both ends make each ruled side's
// intermediate section an ellipse with positive linear radii. Its centre is linear without
// a guide, or gains the admitted two-section guide's transverse quadratic displacement. Strictly ordered
// section planes and positive radii certify a simple closed solid.
import { buildBrep, BrepError, lineCurve, type BrepFaceInput } from '../brep/brep-core.js';
import { solidMassFromIntegrals } from '../brep/solid-mass.js';
import { gauss } from '../core/quadrature.js';
import { buildXYArc } from '../xy-arc.js';
import { buildProfileLoop, capSurface, ExtrudedProfileLimits, type ProfileSegmentInput } from './extruded-profile-solid.js';
import { admitLoftGuide } from './loft-guide.js';
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
  const count = input.sections.length, K = count - 1;
  if ((count !== 2 && count !== 3) || frames.length !== count) return fail('currently support exactly two or three sections');
  if (input.smooth) return fail('currently support ruled sides, not smooth interpolation');
  if (count === 3 && input.guide !== undefined) return fail('three sections currently require no guide');
  if (frames.slice(1).some(f => !frames[0].u.every((x, c) => x === f.u[c]) || !frames[0].v.every((x, c) => x === f.v[c]))) return fail(count === 2 ? 'currently require identical xAxis and yAxis on both frames' : 'currently require identical xAxis and yAxis on all frames');
  const planeSteps = frames.slice(1).map((f, k) => {
    const delta = f.origin.map((x, c) => x - frames[k].origin[c]) as Point;
    const planeStep = dot(cross(frames[0].u, frames[0].v), delta);
    if (!(planeStep > 1e-9 * Math.max(1, Math.hypot(...delta)))) throw new BrepError('GEOMETRY', 'loft: curved sections need certified positive plane separation');
    return planeStep;
  });
  const sections = input.sections.map(s => admit(s.profile));
  const tags = input.sideTags;
  if (tags && (tags.length !== 1 || typeof tags[0] !== 'string' || !tags[0].length)) return fail('need one nonempty tag for the single conic contour');
  const side = (k: number, i: number) => `${input.name}.${K === 1 ? '' : `s${k}.`}${tags ? `side[${tags[0]}]#${i + 1}` : `side${i}`}`;
  const vertex = (k: number, i: number) => `v${k}_${i % 4}`, ring = (k: number, i: number) => `r${k}_${i % 4}`, ruling = (k: number, i: number) => `l${k}_${i % 4}`;
  // Reuse the existing exact, source-backed conic factory; affine scaling maps its rational
  // quadratic quarter circle to an ellipse without fitting, sampling or changing the weights.
  const unit = ([0, 1, 2, 3] as const).map(quadrant => buildXYArc({ kind: 'quarter-arc', id: `loft_quarter_${quadrant}`, center: [0, 0], radius: 1, quadrant }).curve);
  const curves = sections.map((s, k) => unit.map((q, i): Curve => ({ ...q, id: ring(k, i), knots: [...q.knots], weights: [...q.weights], controlPoints: q.controlPoints.map(p => map(frames[k], [s.center[0] + s.radii[0] * p[0], s.center[1] + s.radii[1] * p[1]])) })));
  if (curves.flat().some(q => q.controlPoints.some(p => p.some(x => !Number.isFinite(x) || Math.abs(x) > ExtrudedProfileLimits.coordinateMM)))) return fail('leave the existing modeling coordinate range');
  const positions = curves.map(row => row.map(q => q.controlPoints[0]));
  const guide = input.guide === undefined ? undefined : admitLoftGuide(input.guide, positions[0][0], positions[1][0], cross(frames[0].u, frames[0].v));
  const vertices = positions.flatMap((row, k) => row.map((p, i) => ({ id: vertex(k, i), point: p })));
  const edges = curves.flatMap((row, k) => row.map((q, i) => ({ id: ring(k, i), curve: q, vertices: [vertex(k, i), vertex(k, i + 1)] as [string, string], name: [k === K ? `${input.name}.top` : side(k, i), k === 0 ? `${input.name}.bottom` : side(k - 1, i)].sort().join('|') })));
  for (let k = 0; k < K; k++) for (let i = 0; i < 4; i++) {
    const lo = positions[k][i], hi = positions[k + 1][i];
    const curve: Curve = guide ? { kind: 'curve', id: ruling(k, i), degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [lo, guide.middle(lo, hi), hi], weights: [1, 1, 1] } : lineCurve(ruling(k, i), lo, hi);
    edges.push({ id: ruling(k, i), curve, vertices: [vertex(k, i), vertex(k + 1, i)], name: [side(k, (i + 3) % 4), side(k, i)].sort().join('|') });
  }
  const faces: BrepFaceInput[] = [];
  for (let k = 0; k < K; k++) faces.push(...unit.map((q, i): BrepFaceInput => ({ id: `f${k}_${i}`, name: side(k, i), sense: 'forward', surface: {
    kind: 'surface', id: `f${k}_${i}`, degreeU: 2, degreeV: guide ? 2 : 1, knotsU: [...q.knots], knotsV: guide ? [0, 0, 0, 1, 1, 1] : [0, 0, 1, 1],
    controlPoints: q.controlPoints.map((_, j) => { const lo = curves[k][i].controlPoints[j], hi = curves[k + 1][i].controlPoints[j]; return guide ? [lo, guide.middle(lo, hi), hi] : [lo, hi]; }), weights: q.weights.map(w => guide ? [w, w, w] : [w, w]),
  }, loops: [{ kind: 'outer', uses: [{ edge: ring(k, i), sense: 'forward' }, { edge: ruling(k, i + 1), sense: 'forward' }, { edge: ring(k + 1, i), sense: 'reversed' }, { edge: ruling(k, i), sense: 'reversed' }] }] })));
  for (const k of [0, K]) {
    const s = sections[k], [x, y] = s.center, [rx, ry] = s.radii;
    const cap = capSurface({ min: [x - rx - 1, y - ry - 1], max: [x + rx + 1, y + ry + 1] }, 0, k ? 'top' : 'bottom', k === K);
    cap.controlPoints = cap.controlPoints.map(row => row.map(p => map(frames[k], [p[0], p[1]])));
    faces.push({ id: k ? 'top' : 'bottom', surface: cap, sense: 'forward', name: `${input.name}.${k ? 'top' : 'bottom'}`, loops: [{ kind: 'outer', uses: unit.map((_, i) => ({ edge: ring(k, k ? i : 3 - i), sense: k ? 'forward' as const : 'reversed' as const })) }] });
  }
  if (guide && faces.some(f => f.surface.kind === 'surface' && f.surface.controlPoints.some(row => row.some(p => p.some(x => !Number.isFinite(x) || Math.abs(x) > ExtrudedProfileLimits.coordinateMM))))) return fail('guided surface leaves the existing modeling coordinate range');
  const id = input.id, brep = buildBrep({ source: { family: 'loft', id }, vertices, edges, bodies: [{ id, kind: 'solid', shells: [{ id: `${id}.shell`, faces, closed: true }] }] });

  // Exact ellipse area moments in the common section basis. Radii are linear; a guide makes
  // the centre quadratic. Second volume moments have degree at most six (four without a
  // guide), still integrated to rounding by the existing Gauss(4), with no mesh mass.
  const I = Array(10).fill(0) as number[], G = gauss(4), u = frames[0].u, v = frames[0].v;
  // Ordered section planes separate the spans; sum their world-space raw moments once.
  for (let k = 0; k < K; k++) G.x.forEach((t, it) => {
    const a = sections[k], b = sections[k + 1], rx = a.radii[0] + t * (b.radii[0] - a.radii[0]), ry = a.radii[1] + t * (b.radii[1] - a.radii[1]);
    const f: Frame = { origin: mix(frames[k].origin, frames[k + 1].origin, t), u, v };
    const c = map(f, [a.center[0] + t * (b.center[0] - a.center[0]), a.center[1] + t * (b.center[1] - a.center[1])]);
    if (guide) { const d = guide.offset(t); for (let i = 0; i < 3; i++) c[i] += d[i]; }
    const second = (i: number, j: number) => c[i] * c[j] + rx * rx / 4 * u[i] * u[j] + ry * ry / 4 * v[i] * v[j];
    const w = G.w[it] * planeSteps[k] * Math.PI * rx * ry;
    const moments = [1, ...c, second(0, 0), second(1, 1), second(2, 2), second(0, 1), second(0, 2), second(1, 2)];
    moments.forEach((m, i) => { I[i] += w * m; });
  });
  if (!I.every(Number.isFinite) || !(I[0] > 0)) throw new BrepError('GEOMETRY', 'loft: curved sections have no finite positive volume');
  return { brep, mass: (density: number) => solidMassFromIntegrals(I, density, 'quadrature') };
}
