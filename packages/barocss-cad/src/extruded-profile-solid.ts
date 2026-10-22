import type { Curve, Point, Surface } from './types.js';
import { evaluateCurve, evaluateSurface } from './math.js';
import { encodeBinaryStl } from './stl.js';

// Extruded profile solids: a closed XY loop of lines and circular arcs, swept straight along +Z.
// Geometry is binary64 with explicit tolerances (not exact rationals); arcs are exact rational
// quadratic NURBS split into spans of at most 90°. The result is a small boundary representation
// (vertices, edges with curves, faces with surfaces and oriented edge-use loops) that is validated
// on construction, measured by boundary integrals, and tessellated watertight.

export const ExtrudedProfileDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', GEOMETRY: 'GEOMETRY', TOPOLOGY: 'TOPOLOGY', SELF_INTERSECTION: 'SELF_INTERSECTION',
} as const);
export type ExtrudedProfileDiagnosticCode = typeof ExtrudedProfileDiagnosticCode[keyof typeof ExtrudedProfileDiagnosticCode];

export class ExtrudedProfileError extends Error {
  readonly code: ExtrudedProfileDiagnosticCode;
  constructor(code: ExtrudedProfileDiagnosticCode, detail: string, cause?: unknown) {
    super(('Extruded profile: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ExtrudedProfileError'; this.code = code;
  }
}

export type XY = [number, number];
/** One loop segment runs from its `start` to the next segment's `start` (the loop closes). */
export type ProfileSegmentInput =
  | { readonly kind: 'line'; readonly start: XY }
  | { readonly kind: 'arc'; readonly start: XY; readonly center: XY; readonly direction: 'ccw' | 'cw' };

export type ProfileSegment =
  | { readonly kind: 'line'; readonly start: XY; readonly end: XY; readonly lengthMM: number }
  | { readonly kind: 'arc'; readonly start: XY; readonly end: XY; readonly center: XY; readonly radiusMM: number; readonly startAngle: number; readonly sweep: number; readonly lengthMM: number };

export interface ProfileLoop {
  readonly kind: 'extruded-profile-loop'; readonly version: 0;
  readonly segments: readonly ProfileSegment[];
  /** True when the authored order was clockwise and was reversed to counter-clockwise. */
  readonly reversed: boolean;
  readonly areaMM2: number; readonly centroidMM: XY; readonly perimeterMM: number;
  /** Second moments of area about the centroid: [∫(x−x̄)², ∫(y−ȳ)², ∫(x−x̄)(y−ȳ)] in mm⁴. */
  readonly secondMomentsMM4: readonly [number, number, number];
  readonly boundsMM: { readonly min: XY; readonly max: XY };
}

export interface ExtrudedProfileVertex { readonly id: string; readonly pointMM: Point }
export interface ExtrudedProfileEdge { readonly id: string; readonly vertexIds: readonly [string, string]; readonly curve: Curve; readonly role: 'bottom' | 'top' | 'vertical'; readonly segment: number }
export interface ExtrudedProfileEdgeUse { readonly edgeId: string; readonly sense: 'forward' | 'reversed' }
export interface ExtrudedProfileFace {
  readonly id: string; readonly role: 'bottom' | 'top' | 'side'; readonly segment: number | null;
  readonly kind: 'plane' | 'cylinder'; readonly surface: Surface; readonly outwardNormal: Point | null;
  readonly loop: readonly ExtrudedProfileEdgeUse[];
}
export interface ExtrudedProfileSolidResult {
  readonly kind: 'extruded-profile-solid'; readonly version: 0; readonly id: string; readonly lengthUnit: 'mm';
  readonly profile: ProfileLoop; readonly fromMM: number; readonly heightMM: number;
  readonly vertices: readonly ExtrudedProfileVertex[]; readonly edges: readonly ExtrudedProfileEdge[]; readonly faces: readonly ExtrudedProfileFace[];
  readonly report: {
    readonly valid: true; readonly eulerCharacteristic: number; readonly faceCount: number; readonly edgeCount: number; readonly vertexCount: number;
    readonly volumeMM3: number; readonly surfaceAreaMM2: number; readonly boundsMM: { readonly min: Point; readonly max: Point };
    readonly maxCurveDeviationMM: number; readonly toleranceMM: number;
  };
}

export const ExtrudedProfileLimits = Object.freeze({ segments: 64, coordinateMM: 10000, minimumRadiusMM: 0.01, minimumLengthMM: 1e-4, toleranceMM: 1e-7 });

const fail = (code: ExtrudedProfileDiagnosticCode, detail: string): never => { throw new ExtrudedProfileError(code, detail); };
const finite = (v: unknown, what: string) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > ExtrudedProfileLimits.coordinateMM) fail('INPUT', `${what} must be a finite number within ±${ExtrudedProfileLimits.coordinateMM} mm`);
  return v as number;
};
const xy = (v: unknown, what: string): XY => {
  if (!Array.isArray(v) || v.length !== 2) fail('INPUT', `${what} must be an [x, y] pair`);
  return [finite((v as unknown[])[0], what + '[0]'), finite((v as unknown[])[1], what + '[1]')];
};
const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const TAU = Math.PI * 2;

/** Admits and normalises a loop: closed, simple, counter-clockwise. */
/** `maximumSegments` lets B-rep builders (no fixed caps) raise the stored-solid budget of 64. */
export function buildProfileLoop(input: readonly ProfileSegmentInput[], options: { readonly maximumSegments?: number } = {}): ProfileLoop {
  const budget = options.maximumSegments ?? ExtrudedProfileLimits.segments;
  if (!Array.isArray(input)) fail('INPUT', 'Segments must be an array');
  if (input.length < 1 || input.length > budget) fail('BUDGET', `A loop needs 1..${budget} segments`);
  const raw = input.map((s, i) => {
    if (!s || typeof s !== 'object') fail('INPUT', `Segment ${i} must be an object`);
    if (s.kind === 'line') return { kind: 'line' as const, start: xy(s.start, `segments[${i}].start`) };
    if (s.kind === 'arc') {
      if (s.direction !== 'ccw' && s.direction !== 'cw') fail('INPUT', `segments[${i}].direction must be 'ccw' or 'cw'`);
      return { kind: 'arc' as const, start: xy(s.start, `segments[${i}].start`), center: xy(s.center, `segments[${i}].center`), direction: s.direction };
    }
    return fail('INPUT', `segments[${i}].kind must be 'line' or 'arc'`);
  });
  let scale = 1;
  for (const s of raw) { scale = Math.max(scale, Math.abs(s.start[0]), Math.abs(s.start[1])); if (s.kind === 'arc') scale = Math.max(scale, Math.abs(s.center[0]), Math.abs(s.center[1])); }
  const tol = Math.max(ExtrudedProfileLimits.toleranceMM, scale * 1e-12);
  const segments: ProfileSegment[] = raw.map((s, i) => {
    const end = raw[(i + 1) % raw.length].start;
    if (s.kind === 'line') {
      const length = dist(s.start, end);
      if (raw.length === 1 || length < ExtrudedProfileLimits.minimumLengthMM) fail('GEOMETRY', `Line ${i} is degenerate (length ${length})`);
      return { kind: 'line', start: s.start, end, lengthMM: length };
    }
    const r0 = dist(s.start, s.center), r1 = dist(end, s.center);
    if (r0 < ExtrudedProfileLimits.minimumRadiusMM) fail('GEOMETRY', `Arc ${i} radius ${r0} is below ${ExtrudedProfileLimits.minimumRadiusMM} mm`);
    if (Math.abs(r0 - r1) > Math.max(tol, r0 * 1e-9)) fail('GEOMETRY', `Arc ${i} start and end are not on one circle (radii ${r0} and ${r1})`);
    const a0 = Math.atan2(s.start[1] - s.center[1], s.start[0] - s.center[0]);
    const a1 = Math.atan2(end[1] - s.center[1], end[0] - s.center[0]);
    let sweep = a1 - a0;
    const closed = dist(s.start, end) <= tol;
    if (s.direction === 'ccw') { while (sweep <= 0) sweep += TAU; if (closed) sweep = TAU; }
    else { while (sweep >= 0) sweep -= TAU; if (closed) sweep = -TAU; }
    if (closed && raw.length !== 1) fail('GEOMETRY', `Arc ${i} is a full circle; a full circle must be the only segment`);
    return { kind: 'arc', start: s.start, end, center: s.center, radiusMM: r0, startAngle: a0, sweep, lengthMM: Math.abs(sweep) * r0 };
  });
  let loop = segments;
  checkSimple(loop, tol);
  let moments = areaMoments(loop);
  let reversed = false;
  if (Math.abs(moments.area) < 1e-9 * scale * scale) fail('GEOMETRY', 'The loop encloses no area');
  if (moments.area < 0) { loop = reverseLoop(loop); moments = areaMoments(loop); reversed = true; }
  const samples = sampleLoop(loop, Math.PI / 36);
  const min: XY = [Infinity, Infinity], max: XY = [-Infinity, -Infinity];
  for (const p of samples) for (let k = 0; k < 2; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  const cx = moments.mx / moments.area, cy = moments.my / moments.area;
  return deepFreeze({
    kind: 'extruded-profile-loop', version: 0, segments: loop, reversed,
    areaMM2: moments.area, centroidMM: [cx, cy] as XY, perimeterMM: loop.reduce((s, g) => s + g.lengthMM, 0),
    secondMomentsMM4: [moments.mxx - moments.area * cx * cx, moments.myy - moments.area * cy * cy, moments.mxy - moments.area * cx * cy] as const,
    boundsMM: { min, max },
  });
}

function reverseLoop(loop: readonly ProfileSegment[]): ProfileSegment[] {
  return [...loop].reverse().map((s): ProfileSegment => s.kind === 'line'
    ? { kind: 'line', start: s.end, end: s.start, lengthMM: s.lengthMM }
    : { kind: 'arc', start: s.end, end: s.start, center: s.center, radiusMM: s.radiusMM, startAngle: s.startAngle + s.sweep, sweep: -s.sweep, lengthMM: s.lengthMM });
}

// 12-point Gauss–Legendre on [-1, 1].
const GL_X = [-0.9815606342467192, -0.9041172563704749, -0.7699026741943047, -0.5873179542866175, -0.3678314989981802, -0.1252334085114689, 0.1252334085114689, 0.3678314989981802, 0.5873179542866175, 0.7699026741943047, 0.9041172563704749, 0.9815606342467192];
const GL_W = [0.0471753363865118, 0.1069393259953184, 0.1600783285433462, 0.2031674267230659, 0.2334925365383548, 0.2491470458134028, 0.2491470458134028, 0.2334925365383548, 0.2031674267230659, 0.1600783285433462, 0.1069393259953184, 0.0471753363865118];

/** Area moments by Green's theorem: A, ∫x, ∫y, ∫x², ∫y², ∫xy over the enclosed region. */
function areaMoments(loop: readonly ProfileSegment[]) {
  let area = 0, mx = 0, my = 0, mxx = 0, myy = 0, mxy = 0;
  const add = (x: number, y: number, dx: number, dy: number, w: number) => {
    area += 0.5 * (x * dy - y * dx) * w; mx += 0.5 * x * x * dy * w; my += -0.5 * y * y * dx * w;
    mxx += (x * x * x / 3) * dy * w; myy += -(y * y * y / 3) * dx * w; mxy += 0.5 * x * x * y * dy * w;
  };
  for (const s of loop) {
    if (s.kind === 'line') {
      const dx = s.end[0] - s.start[0], dy = s.end[1] - s.start[1];
      for (let q = 0; q < 12; q++) { const t = 0.5 * (GL_X[q] + 1); add(s.start[0] + dx * t, s.start[1] + dy * t, dx, dy, 0.5 * GL_W[q]); }
    } else {
      const spans = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 2)));
      for (let k = 0; k < spans; k++) {
        const t0 = s.startAngle + s.sweep * k / spans, dt = s.sweep / spans;
        for (let q = 0; q < 12; q++) {
          const t = t0 + dt * 0.5 * (GL_X[q] + 1);
          add(s.center[0] + s.radiusMM * Math.cos(t), s.center[1] + s.radiusMM * Math.sin(t), -s.radiusMM * Math.sin(t) * dt, s.radiusMM * Math.cos(t) * dt, 0.5 * GL_W[q]);
        }
      }
    }
  }
  return { area, mx, my, mxx, myy, mxy };
}

/** Boundary points: line ends, and arc points every `step` radians at most. Shared by caps and sides. */
function segmentSamples(s: ProfileSegment, step: number): XY[] {
  if (s.kind === 'line') return [s.start];
  const n = Math.max(2, Math.ceil(Math.abs(s.sweep) / step));
  const out: XY[] = [];
  for (let i = 0; i < n; i++) { const t = s.startAngle + s.sweep * i / n; out.push(i === 0 ? s.start : [s.center[0] + s.radiusMM * Math.cos(t), s.center[1] + s.radiusMM * Math.sin(t)]); }
  return out;
}
function sampleLoop(loop: readonly ProfileSegment[], step: number): XY[] { return loop.flatMap(s => segmentSamples(s, step)); }

function checkSimple(loop: readonly ProfileSegment[], tol: number) {
  const pts = sampleLoop(loop, Math.PI / 18); const n = pts.length;
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = pts[j], d = pts[(j + 1) % n];
      const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
      if (((d1 > tol && d2 < -tol) || (d1 < -tol && d2 > tol)) && ((d3 > tol && d4 < -tol) || (d3 < -tol && d4 > tol))) fail('SELF_INTERSECTION', 'The loop crosses itself');
    }
  }
}

/** Exact rational quadratic NURBS for an arc, spans ≤ 90°; degree-1 for a line. */
export function segmentCurve(s: ProfileSegment, z: number, id: string): Curve {
  if (s.kind === 'line') return { kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[s.start[0], s.start[1], z], [s.end[0], s.end[1], z]], weights: [1, 1] };
  const spans = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 2) - 1e-12));
  const dt = s.sweep / spans, w = Math.cos(Math.abs(dt) / 2);
  const cp: Point[] = [], wt: number[] = [], knots = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const t0 = s.startAngle + dt * k, tm = t0 + dt / 2;
    const p0: Point = k === 0 ? [s.start[0], s.start[1], z] : [s.center[0] + s.radiusMM * Math.cos(t0), s.center[1] + s.radiusMM * Math.sin(t0), z];
    const rm = s.radiusMM / w;
    if (k === 0) { cp.push(p0); wt.push(1); }
    cp.push([s.center[0] + rm * Math.cos(tm), s.center[1] + rm * Math.sin(tm), z]); wt.push(w);
    const t1 = t0 + dt;
    cp.push(k === spans - 1 ? [s.end[0], s.end[1], z] : [s.center[0] + s.radiusMM * Math.cos(t1), s.center[1] + s.radiusMM * Math.sin(t1), z]); wt.push(1);
    if (k < spans - 1) knots.push((k + 1) / spans, (k + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: 'curve', id, degree: 2, knots, controlPoints: cp, weights: wt };
}

export function extrudedSurface(curve: Curve, z0: number, z1: number, id: string): Surface {
  return { kind: 'surface', id, degreeU: curve.degree, degreeV: 1, knotsU: [...curve.knots], knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map(p => [[p[0], p[1], z0], [p[0], p[1], z1]]), weights: curve.weights.map(w => [w, w]) };
}

export function capSurface(bounds: { min: XY; max: XY }, z: number, id: string, up: boolean): Surface {
  const [x0, y0] = bounds.min, [x1, y1] = bounds.max;
  // U along X, V along Y; swap for the bottom so the parametric normal points outward (−Z).
  const grid: Point[][] = up ? [[[x0, y0, z], [x0, y1, z]], [[x1, y0, z], [x1, y1, z]]] : [[[x0, y0, z], [x1, y0, z]], [[x0, y1, z], [x1, y1, z]]];
  return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: grid, weights: [[1, 1], [1, 1]] };
}

export interface ExtrudedProfileSolidOptions { readonly id: string; readonly heightMM: number; readonly fromMM?: number }

export function buildExtrudedProfileSolid(profile: ProfileLoop, options: ExtrudedProfileSolidOptions): ExtrudedProfileSolidResult {
  if (!profile || profile.kind !== 'extruded-profile-loop') fail('INPUT', 'A profile loop from buildProfileLoop is required');
  if (typeof options?.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(options.id)) fail('INPUT', 'A short identifier is required');
  const h = finite(options.heightMM, 'heightMM'); if (h <= 0) fail('INPUT', 'heightMM must be positive');
  const z0 = options.fromMM === undefined ? 0 : finite(options.fromMM, 'fromMM'), z1 = z0 + h;
  if (Math.abs(z1) > ExtrudedProfileLimits.coordinateMM) fail('INPUT', 'The extrusion leaves the ±10000 mm modeling range');
  const id = options.id, segs = profile.segments, n = segs.length;
  const vertices: ExtrudedProfileVertex[] = [], edges: ExtrudedProfileEdge[] = [], faces: ExtrudedProfileFace[] = [];
  segs.forEach((s, i) => { vertices.push({ id: `${id}_v${i}b`, pointMM: [s.start[0], s.start[1], z0] }, { id: `${id}_v${i}t`, pointMM: [s.start[0], s.start[1], z1] }); });
  const next = (i: number) => (i + 1) % n;
  segs.forEach((s, i) => {
    edges.push({ id: `${id}_e${i}b`, vertexIds: [`${id}_v${i}b`, `${id}_v${next(i)}b`], curve: segmentCurve(s, z0, `${id}_c${i}b`), role: 'bottom', segment: i });
    edges.push({ id: `${id}_e${i}t`, vertexIds: [`${id}_v${i}t`, `${id}_v${next(i)}t`], curve: segmentCurve(s, z1, `${id}_c${i}t`), role: 'top', segment: i });
    edges.push({ id: `${id}_e${i}v`, vertexIds: [`${id}_v${i}b`, `${id}_v${i}t`], role: 'vertical', segment: i,
      curve: { kind: 'curve', id: `${id}_c${i}v`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[s.start[0], s.start[1], z0], [s.start[0], s.start[1], z1]], weights: [1, 1] } });
  });
  faces.push({ id: `${id}_f_bottom`, role: 'bottom', segment: null, kind: 'plane', surface: capSurface(profile.boundsMM, z0, `${id}_s_bottom`, false), outwardNormal: [0, 0, -1],
    loop: segs.map((_, i) => ({ edgeId: `${id}_e${n - 1 - i}b`, sense: 'reversed' as const })) });
  faces.push({ id: `${id}_f_top`, role: 'top', segment: null, kind: 'plane', surface: capSurface(profile.boundsMM, z1, `${id}_s_top`, true), outwardNormal: [0, 0, 1],
    loop: segs.map((_, i) => ({ edgeId: `${id}_e${i}t`, sense: 'forward' as const })) });
  segs.forEach((s, i) => {
    const curve = edges[i * 3].curve;
    const normal: Point | null = s.kind === 'line' ? [(s.end[1] - s.start[1]) / s.lengthMM, -(s.end[0] - s.start[0]) / s.lengthMM, 0] : null;
    faces.push({ id: `${id}_f_side${i}`, role: 'side', segment: i, kind: s.kind === 'line' ? 'plane' : 'cylinder', surface: extrudedSurface(curve, z0, z1, `${id}_s_side${i}`), outwardNormal: normal,
      loop: [{ edgeId: `${id}_e${i}b`, sense: 'forward' }, { edgeId: `${id}_e${next(i)}v`, sense: 'forward' }, { edgeId: `${id}_e${i}t`, sense: 'reversed' }, { edgeId: `${id}_e${i}v`, sense: 'reversed' }] });
  });
  // Validation: every edge used exactly twice with opposite senses, Euler characteristic 2,
  // and every curve passes through its vertices and stays on its circle.
  const uses = new Map<string, string[]>();
  for (const f of faces) for (const u of f.loop) uses.set(u.edgeId, [...(uses.get(u.edgeId) ?? []), u.sense]);
  for (const e of edges) { const u = uses.get(e.id) ?? []; if (u.length !== 2 || u[0] === u[1]) fail('TOPOLOGY', `Edge ${e.id} is not used once in each direction`); }
  const euler = vertices.length - edges.length + faces.length;
  if (euler !== 2) fail('TOPOLOGY', `Euler characteristic ${euler} ≠ 2`);
  const vmap = new Map(vertices.map(v => [v.id, v.pointMM]));
  let deviation = 0;
  const tol = Math.max(ExtrudedProfileLimits.toleranceMM, Math.max(1, ...profile.boundsMM.max.map(Math.abs), ...profile.boundsMM.min.map(Math.abs), Math.abs(z1)) * 1e-11);
  for (const e of edges) {
    const a = evaluateCurve(e.curve, 0), b = evaluateCurve(e.curve, 1);
    deviation = Math.max(deviation, d3(a, vmap.get(e.vertexIds[0])!), d3(b, vmap.get(e.vertexIds[1])!));
    const s = segs[e.segment];
    if (e.role !== 'vertical' && s.kind === 'arc') for (let k = 1; k < 16; k++) {
      const p = evaluateCurve(e.curve, k / 16); deviation = Math.max(deviation, Math.abs(Math.hypot(p[0] - s.center[0], p[1] - s.center[1]) - s.radiusMM));
    }
  }
  for (const f of faces) if (f.role === 'side') {
    const p = evaluateSurface(f.surface, 1, 1), v = vmap.get(`${id}_v${next(f.segment!)}t`)!;
    deviation = Math.max(deviation, d3(p, v));
  }
  if (deviation > tol) fail('GEOMETRY', `Curves deviate ${deviation} mm from their vertices or circles (tolerance ${tol})`);
  const sideArea = segs.reduce((sum, s) => sum + s.lengthMM * h, 0);
  return deepFreeze({
    kind: 'extruded-profile-solid', version: 0, id, lengthUnit: 'mm', profile, fromMM: z0, heightMM: h, vertices, edges, faces,
    report: { valid: true, eulerCharacteristic: euler, faceCount: faces.length, edgeCount: edges.length, vertexCount: vertices.length,
      volumeMM3: profile.areaMM2 * h, surfaceAreaMM2: 2 * profile.areaMM2 + sideArea,
      boundsMM: { min: [profile.boundsMM.min[0], profile.boundsMM.min[1], z0], max: [profile.boundsMM.max[0], profile.boundsMM.max[1], z1] },
      maxCurveDeviationMM: deviation, toleranceMM: tol },
  });
}

export interface ExtrudedProfileMass {
  readonly volumeMM3: number; readonly massKG: number; readonly centroidMM: Point;
  /** Inertia tensor about the centroid in kg·m², products of inertia stored as −∫xy dm. */
  readonly inertiaCentroidKgM2: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
}

export function measureExtrudedProfileSolid(solid: ExtrudedProfileSolidResult, options: { readonly densityKgPerM3: number }): ExtrudedProfileMass {
  const rho = options?.densityKgPerM3;
  if (typeof rho !== 'number' || !Number.isFinite(rho) || rho <= 0) fail('INPUT', 'A positive density is required');
  const p = solid.profile, h = solid.heightMM, A = p.areaMM2;
  const [sxx, syy, sxy] = p.secondMomentsMM4;
  const k = rho * 1e-15; // kg/m³ · mm⁵ → kg·m²
  const zz = A * h * h * h / 12;
  const Ixx = k * (h * syy + zz), Iyy = k * (h * sxx + zz), Izz = k * h * (sxx + syy), Ixy = -k * h * sxy;
  return deepFreeze({
    volumeMM3: A * h, massKG: rho * A * h * 1e-9, centroidMM: [p.centroidMM[0], p.centroidMM[1], solid.fromMM + h / 2],
    inertiaCentroidKgM2: [[Ixx, Ixy, 0], [Ixy, Iyy, 0], [0, 0, Izz]],
  });
}

export interface ExtrudedProfileMeshFace { readonly faceId: string; readonly role: ExtrudedProfileFace['role']; readonly kind: ExtrudedProfileFace['kind']; readonly vertexOffset: number; readonly vertexCount: number; readonly indexOffset: number; readonly indexCount: number }
export interface ExtrudedProfileMesh { readonly positionsMM: Float64Array; readonly normals: Float64Array; readonly indices: Uint32Array; readonly faces: readonly ExtrudedProfileMeshFace[] }

/** Watertight triangle mesh: caps and side strips share the same boundary samples. */
export function tessellateExtrudedProfileSolid(solid: ExtrudedProfileSolidResult, options: { readonly segmentsPerQuarter?: number } = {}): ExtrudedProfileMesh {
  const q = options.segmentsPerQuarter ?? 8;
  if (!Number.isInteger(q) || q < 1 || q > 64) fail('INPUT', 'segmentsPerQuarter must be an integer in 1..64');
  const step = Math.PI / 2 / q, z0 = solid.fromMM, z1 = solid.fromMM + solid.heightMM;
  const pos: number[] = [], nor: number[] = [], idx: number[] = [], faces: ExtrudedProfileMeshFace[] = [];
  const begin = (f: ExtrudedProfileFace) => ({ face: f, v: pos.length / 3, i: idx.length });
  const end = (b: { face: ExtrudedProfileFace; v: number; i: number }) => faces.push({ faceId: b.face.id, role: b.face.role, kind: b.face.kind, vertexOffset: b.v, vertexCount: pos.length / 3 - b.v, indexOffset: b.i, indexCount: idx.length - b.i });
  const ring = sampleLoop(solid.profile.segments, step);
  const tris = earClip(ring);
  for (const [face, z, up] of [[solid.faces[0], z0, false], [solid.faces[1], z1, true]] as const) {
    const b = begin(face); const base = pos.length / 3;
    for (const p of ring) { pos.push(p[0], p[1], z); nor.push(0, 0, up ? 1 : -1); }
    for (const [a, bb, c] of tris) idx.push(base + a, base + (up ? bb : c), base + (up ? c : bb));
    end(b);
  }
  solid.profile.segments.forEach((s, i) => {
    const face = solid.faces[2 + i]; const b = begin(face); const base = pos.length / 3;
    const pts = [...segmentSamples(s, step), s.end];
    pts.forEach(p => {
      const n = s.kind === 'line' ? [(s.end[1] - s.start[1]) / s.lengthMM, -(s.end[0] - s.start[0]) / s.lengthMM]
        : [(p[0] - s.center[0]) / s.radiusMM * Math.sign(s.sweep), (p[1] - s.center[1]) / s.radiusMM * Math.sign(s.sweep)];
      pos.push(p[0], p[1], z0, p[0], p[1], z1); nor.push(n[0], n[1], 0, n[0], n[1], 0);
    });
    for (let k = 0; k < pts.length - 1; k++) { const a = base + 2 * k; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    end(b);
  });
  return Object.freeze({ positionsMM: new Float64Array(pos), normals: new Float64Array(nor), indices: new Uint32Array(idx), faces: Object.freeze(faces) });
}

/** Ear clipping for a simple counter-clockwise polygon. */
function earClip(ring: readonly XY[]): [number, number, number][] {
  const n = ring.length; const out: [number, number, number][] = [];
  const v = Array.from({ length: n }, (_, i) => i);
  const area2 = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p: XY, a: XY, b: XY, c: XY) => area2(a, b, p) >= -1e-12 && area2(b, c, p) >= -1e-12 && area2(c, a, p) >= -1e-12;
  let guard = 0;
  while (v.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < v.length; i++) {
      const ia = v[(i + v.length - 1) % v.length], ib = v[i], ic = v[(i + 1) % v.length];
      const a = ring[ia], b = ring[ib], c = ring[ic];
      if (area2(a, b, c) <= 1e-12) continue;
      if (v.some(j => j !== ia && j !== ib && j !== ic && inside(ring[j], a, b, c))) continue;
      out.push([ia, ib, ic]); v.splice(i, 1); clipped = true; break;
    }
    if (!clipped) { // collinear remainder: drop the flattest vertex
      let best = 0, bestA = Infinity;
      for (let i = 0; i < v.length; i++) { const A = Math.abs(area2(ring[v[(i + v.length - 1) % v.length]], ring[v[i]], ring[v[(i + 1) % v.length]])); if (A < bestA) { bestA = A; best = i; } }
      v.splice(best, 1);
    }
  }
  if (v.length === 3 && area2(ring[v[0]], ring[v[1]], ring[v[2]]) > 1e-12) out.push([v[0], v[1], v[2]]);
  return out;
}

/** Binary STL (little-endian) from the watertight tessellation. */
export function exportExtrudedProfileSolidStl(solid: ExtrudedProfileSolidResult, options: { readonly segmentsPerQuarter?: number } = {}): Uint8Array {
  const mesh = tessellateExtrudedProfileSolid(solid, options);
  return encodeBinaryStl(mesh.positionsMM, mesh.indices, `barocss extruded profile ${solid.id}`);
}

const d3 = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value as object)) deepFreeze(v); }
  return value;
}
