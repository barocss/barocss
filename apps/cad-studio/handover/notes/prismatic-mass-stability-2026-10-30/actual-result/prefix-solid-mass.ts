// Mass properties of B-rep solids: closed form for prismatic solids (area moments of each slab's
// section times its height); for any other B-rep, quadrature over the exact surfaces (brep-mass-
// quadrature.ts), else exact integration of the display tessellation (exact for planar faces; for curved
// faces the chord error of the tessellation, reported). Bodies of facet faces and straight-edged planar faces
// (mesh bodies) are integrated exactly from their triangles and loops, once per B-rep.
import { regionMoments } from './curved-arrangement.js';
import { recordIntegralMass, transferNativeMassBasis, unsupportedNativeMass } from '../internal/native-si-mass-state.js';
import { planar, tessellateBrep } from './brep-tessellate.js';
import { brepQuadratureIntegrals } from './brep-mass-quadrature.js';
import { facetIntegrals } from '../mesh/facet-patch.js';
import type { Brep } from './brep-core.js';
import type { PrismaticSolid } from '../features/prismatic-solid.js';
import type { Point } from '../types.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

/**
 * A body's mass properties in MMGS (R7.3b, api-conventions §2): `volume` mm³, `mass` g, `centroid` mm, `inertia` g·mm²
 * about the centroid, products of inertia stored as −∫xy dm. A density is in g/cm³.
 */
export interface MassProperties {
  readonly volume: number; readonly mass: number; readonly centroid: Point;
  readonly inertia: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
  /** `quadrature`: Gauss quadrature exact across and to rounding along smooth (rational) edges. */
  readonly method: 'closed-form' | 'planar-exact' | 'tessellated' | 'quadrature';
  /**
   * `tessellated` only (a curved body the quadrature could not integrate): an estimate of the volume's error, mm³ — the
   * change from a mesh of half the segments, which the chord error's square makes some three times the error itself.
   */
  readonly volumeBound?: number;
}
/** This module's refusal (R7.3a batch 2: the SolidMassError class folded, D279): a BarocssError, `details.source` 'solid-mass'. */
export const solidMassError = (detail: string) => kernelRefusal('solid-mass', 'SOLID_MASS', 'Mass properties: ' + detail) as KernelError & { readonly code: 'SOLID_MASS' };
/** Whether something thrown is this module's refusal. */
export const isSolidMassError = (e: unknown): e is KernelError & { readonly code: 'SOLID_MASS' } => isFrom<'SOLID_MASS'>(e, 'solid-mass');

/** From volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] in mm-powers. */
export function solidMassFromIntegrals(I: readonly number[], density: number, method: MassProperties['method']): MassProperties {
  if (!(typeof density === 'number' && Number.isFinite(density) && density > 0)) throw solidMassError('a positive finite density is required');
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I;
  if (!(V > 0)) throw solidMassError('the solid has no positive volume');
  const c: Point = [X / V, Y / V, Z / V], k = density * 1e-3;
  const xx = XX - V * c[0] * c[0], yy = YY - V * c[1] * c[1], zz = ZZ - V * c[2] * c[2];
  const xy = XY - V * c[0] * c[1], xz = XZ - V * c[0] * c[2], yz = YZ - V * c[1] * c[2];
  // (g/cm³ is 1e-3 g/mm³: the mass in g, the inertia in g·mm².)
  const props: MassProperties = { volume: V, mass: density * V * 1e-3, centroid: c, method,
    inertia: [[k * (yy + zz), -k * xy, -k * xz], [-k * xy, k * (xx + zz), -k * yz], [-k * xz, -k * yz, k * (xx + yy)]] };
  recordIntegralMass(props, density, [xx, yy, zz, xy, xz, yz]);
  return props;
}

export function prismaticMassProperties(solid: PrismaticSolid, density: number): MassProperties {
  const I = Array(10).fill(0) as number[];
  for (const s of solid.slabs) {
    const h = s.z1 - s.z0;
    const h2 = h * (s.z0 / 2 + s.z1 / 2), h3 = h * (s.z0 * s.z0 + s.z0 * s.z1 + s.z1 * s.z1) / 3;
    for (const r of s.regions) {
      const [A, Sx, Sy, Sxx, Syy, Sxy] = regionMoments(r);
      I[0] += A * h; I[1] += Sx * h; I[2] += Sy * h; I[3] += A * h2; I[4] += Sxx * h; I[5] += Syy * h; I[6] += A * h3; I[7] += Sxy * h; I[8] += Sx * h2; I[9] += Sy * h2;
    }
  }
  return solidMassFromIntegrals(I, density, 'closed-form');
}

/**
 * The integrals over the exact surfaces (ten volume integrals and the area), extrapolated from q and 2q a
 * quarter when any face was integrated over its tessellation; null when a face cannot be integrated so.
 */
/**
 * The quadrature's integrals, kept per B-rep and step (PERF3 C16): mass properties and surface area read the same
 * run — a STEP export's validation properties ask for both — and a B-rep is a value. Read only by the callers.
 */
const quadratures = new WeakMap<Brep, Map<number, number[] | null>>();
function quadrature(brep: Brep, q: number): number[] | null {
  let byQ = quadratures.get(brep);
  if (!byQ) { byQ = new Map(); quadratures.set(brep, byQ); }
  if (byQ.has(q)) return byQ.get(q)!;
  const out = quadratureOf(brep, q);
  byQ.set(q, out);
  return out;
}
function quadratureOf(brep: Brep, q: number): number[] | null {
  try {
    // (Integrated without the tessellation, the result does not depend on q: no second pass.)
    const coarse = brepQuadratureIntegrals(brep, q), fine = coarse?.meshed ? brepQuadratureIntegrals(brep, 2 * q) : coarse;
    if (!coarse || !fine) return null;
    if (!coarse.meshed) return coarse.integrals;
    // Richardson per kind of meshed face: those with a pole err with the square of the step, the others (their
    // trims' strips integrated) with its cube; the faces integrated exactly are the same on both.
    const s0 = coarse.squared!, s1 = fine.squared!, c0 = coarse.cubed!, c1 = fine.cubed!;
    return fine.integrals.map((x, k) => x - s1[k] - c1[k] + (4 * s1[k] - s0[k]) / 3 + (8 * c1[k] - c0[k]) / 7);
  } catch { return null; }
}

/**
 * The surface area of a B-rep (mm²): over its exact surfaces as mass properties are (planar faces by Green's
 * theorem along their edges, whole B-spline patches by tensor Gauss, others over their parameter domains),
 * else the area of its fine tessellation.
 */
export function brepSurfaceArea(brep: Brep, options: { readonly segmentsPerQuarter?: number; readonly quadratureSegments?: number } = {}): number {
  const poly = polyhedralIntegrals(brep);
  if (poly) return poly[10];
  const q = options.quadratureSegments ?? 8, Q = q > 0 ? quadrature(brep, q) : null;
  if (Q && Q[10] > 0) return Q[10];
  const curved = brep.faces.some(f => f.surface.kind === 'surface' && (f.surface.degreeU > 1 || f.surface.degreeV > 1));
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: curved ? options.segmentsPerQuarter ?? 64 : 1 }), p = mesh.positions, ix = mesh.indices;
  let area = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = 3 * ix[t], b = 3 * ix[t + 1], c = 3 * ix[t + 2], ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return area;
}

/**
 * Curved B-reps by quadrature over their surfaces, on meshes of `quadratureSegments` a quarter (8 by
 * default; 0: none) and twice that, extrapolated (Richardson: with the curved strips along trims integrated,
 * the error left falls with the cube of the step, beside a surface's pole with its square; faces with none
 * give the same value on both). Otherwise, or when that cannot integrate a face, tetrahedra from the
 * origin over the watertight tessellation (divergence theorem).
 */
export function brepMassProperties(brep: Brep, density: number, options: { readonly segmentsPerQuarter?: number; readonly quadratureSegments?: number } = {}): MassProperties {
  const poly = polyhedralIntegrals(brep);
  if (poly && poly[0] > 0) return solidMassFromIntegrals(poly, density, 'planar-exact');
  const curved = brep.faces.some(f => f.surface.kind === 'surface' && (f.surface.degreeU > 1 || f.surface.degreeV > 1));
  const q = options.quadratureSegments ?? 8;
  if (curved && q > 0) {
    const Q = quadrature(brep, q);
    if (Q && Q[0] > 0) return solidMassFromIntegrals(Q, density, 'quadrature');
  }
  const segments = curved ? options.segmentsPerQuarter ?? 64 : 1, I = meshIntegrals(brep, segments);
  if (!curved) return solidMassFromIntegrals(I, density, 'planar-exact');
  // (Not silently: the chord error is the mesh's, and it is stated — the volume's change from half the segments, some
  // three times its error as the error falls with the square of the step. L4 fuzz 171, D200.)
  const half = meshIntegrals(brep, Math.max(1, Math.floor(segments / 2)));
  const mass = solidMassFromIntegrals(I, density, 'tessellated');
  const result = { ...mass, volumeBound: Math.abs(I[0] - half[0]) };
  transferNativeMassBasis(mass, result);
  return result;
}
/** Volume integrals over a B-rep's watertight tessellation: tetrahedra from the origin (divergence theorem). */
function meshIntegrals(brep: Brep, segmentsPerQuarter: number): number[] {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter }), p = mesh.positions, ix = mesh.indices;
  const I = Array(10).fill(0) as number[];
  for (let t = 0; t < ix.length; t += 3) {
    const a = [p[ix[t] * 3], p[ix[t] * 3 + 1], p[ix[t] * 3 + 2]], b = [p[ix[t + 1] * 3], p[ix[t + 1] * 3 + 1], p[ix[t + 1] * 3 + 2]], c = [p[ix[t + 2] * 3], p[ix[t + 2] * 3 + 1], p[ix[t + 2] * 3 + 2]];
    const D = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    const s = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
    const second = (i: number, j: number) => D / 120 * (a[i] * a[j] + b[i] * b[j] + c[i] * c[j] + s[i] * s[j]);
    I[0] += D / 6; I[1] += D / 24 * s[0]; I[2] += D / 24 * s[1]; I[3] += D / 24 * s[2];
    I[4] += second(0, 0); I[5] += second(1, 1); I[6] += second(2, 2); I[7] += second(0, 1); I[8] += second(0, 2); I[9] += second(1, 2);
  }
  return I;
}

/**
 * Mass properties of a body made of pieces that meet only in faces, each given in its own frame and
 * placed by a rotation (its columns: the frame's axes in world) and an offset (mm): masses add, centroids
 * average, each inertia turns with its piece (R I Rᵀ) and moves to the common centroid (parallel axes).
 */
export function combineMassProperties(parts: readonly { readonly props: MassProperties; readonly axes: readonly [Point, Point, Point]; readonly offset: Point }[]): MassProperties {
  if (!parts.length) throw solidMassError('no pieces to combine');
  const world = parts.map(({ props, axes, offset }) => {
    const R = [0, 1, 2].map(i => [axes[0][i], axes[1][i], axes[2][i]]), c = props.centroid;
    const centroid = [0, 1, 2].map(i => offset[i] + R[i][0] * c[0] + R[i][1] * c[1] + R[i][2] * c[2]) as Point;
    const I = props.inertia, turned = [0, 1, 2].map(i => [0, 1, 2].map(j => { let v = 0; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) v += R[i][p] * I[p][q] * R[j][q]; return v; }));
    return { m: props.mass, v: props.volume, centroid, I: turned };
  });
  const M = world.reduce((a, w) => a + w.m, 0), V = world.reduce((a, w) => a + w.v, 0);
  const C = [0, 1, 2].map(k => world.reduce((a, w) => a + w.m * w.centroid[k], 0) / M) as Point;
  const I = [0, 1, 2].map(i => [0, 1, 2].map(j => world.reduce((a, w) => {
    const d = [0, 1, 2].map(k => w.centroid[k] - C[k]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    return a + w.I[i][j] + w.m * ((i === j ? dd : 0) - d[i] * d[j]);
  }, 0))) as [[number, number, number], [number, number, number], [number, number, number]];
  return unsupportedNativeMass({ volume: V, mass: M, centroid: C, inertia: I, method: 'closed-form' }, 'combined');
}

// ---- Polyhedral bodies (PERF3 B9): facet faces and planar faces bounded by straight edges, the mesh bodies ----

/** Each B-rep's polyhedral integrals (null: not polyhedral), worked out once: a B-rep is a value. */
const polyhedral = new WeakMap<Brep, readonly number[] | null>();
/**
 * The ten volume integrals and the area (eleventh) of a body whose every face is a facet patch or a planar face
 * bounded by straight edges, exactly and without a tessellation: tetrahedra from the body's centre over each
 * facet triangle and over a fan of each planar loop (a fan's signed triangles cover the loop's region, holes
 * too, so their cones add up to the face's). Null for any other body, or when a planar face's loops do not
 * turn about its outward normal as the B-rep's do.
 */
export function polyhedralIntegrals(brep: Brep): readonly number[] | null {
  if (polyhedral.has(brep)) return polyhedral.get(brep)!;
  const out = polyhedralOf(brep);
  polyhedral.set(brep, out);
  return out;
}
function polyhedralOf(brep: Brep): readonly number[] | null {
  if (!brep.faces.length) return null;
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c])), edges = new Map(brep.edges.map(e => [e.id, e]));
  // The centre: the middle of the vertices' and facet patches' box, for well-conditioned products.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of brep.vertices) for (let k = 0; k < 3; k++) { if (v.point[k] < lo[k]) lo[k] = v.point[k]; if (v.point[k] > hi[k]) hi[k] = v.point[k]; }
  for (const f of brep.faces) if (f.surface.kind === 'facets') { const b = f.surface.bounds; for (let k = 0; k < 3; k++) { if (b[k] < lo[k]) lo[k] = b[k]; if (b[k + 3] > hi[k]) hi[k] = b[k + 3]; } }
  const o: Point = [0, 1, 2].map(k => lo[k] <= hi[k] ? (lo[k] + hi[k]) / 2 : 0) as Point, I = Array(11).fill(0) as number[], J = faceScratch;
  for (const f of brep.faces) {
    const sign = f.sense === 'forward' ? 1 : -1;
    if (f.surface.kind === 'facets') { facetIntegrals(f.surface, sign, o, I); continue; }
    const plane = planar(f.surface); if (!plane) return null;
    const nx = plane.normal[0] * sign, ny = plane.normal[1] * sign, nz = plane.normal[2] * sign;
    J.fill(0);
    let area2 = 0;
    for (const lid of f.loops) {
      const list = loops.get(lid)!.coedges;
      // The loop's corners in its order (each coedge's start), every edge straight.
      let ax = 0, ay = 0, az = 0, px = 0, py = 0, pz = 0;
      for (let i = 0; i < list.length; i++) {
        const co = coedges.get(list[i])!, c = edges.get(co.edge)!.curve;
        if (!(c.degree === 1 && c.controlPoints.length === 2)) return null;
        const s = c.controlPoints[co.sense === 'forward' ? 0 : 1], x = s[0] - o[0], y = s[1] - o[1], z = s[2] - o[2];
        if (i === 0) { ax = x; ay = y; az = z; }
        else if (i >= 2) area2 += fanTriangle(J, ax, ay, az, px, py, pz, x, y, z, nx, ny, nz);
        px = x; py = y; pz = z;
      }
    }
    // (The loops turn about the outward normal, outer one way and holes the other: their area is positive.)
    if (!(area2 > 0)) return null;
    for (let k = 0; k < 10; k++) I[k] += J[k];
    I[10] += area2 / 2;
  }
  return fromCentreAt(I, o);
}
const faceScratch = new Float64Array(10);
/** One fan triangle's cone from the centre (a, b, c about it) added to the ten integrals; its doubled area along n, signed. */
function fanTriangle(I: Float64Array, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, nx: number, ny: number, nz: number): number {
  const D = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  const sx = ax + bx + cx, sy = ay + by + cy, sz = az + bz + cz;
  I[0] += D / 6; I[1] += D / 24 * sx; I[2] += D / 24 * sy; I[3] += D / 24 * sz;
  I[4] += D / 120 * (ax * ax + bx * bx + cx * cx + sx * sx); I[5] += D / 120 * (ay * ay + by * by + cy * cy + sy * sy); I[6] += D / 120 * (az * az + bz * bz + cz * cz + sz * sz);
  I[7] += D / 120 * (ax * ay + bx * by + cx * cy + sx * sy); I[8] += D / 120 * (ax * az + bx * bz + cx * cz + sx * sz); I[9] += D / 120 * (ay * az + by * bz + cy * cz + sy * sz);
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  return (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
}
/** Integrals about o moved to the world origin (as the quadrature's fromCentre); the area unchanged. */
function fromCentreAt(I: readonly number[], c: Point): number[] {
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I, [cx, cy, cz] = c;
  return [V, X + cx * V, Y + cy * V, Z + cz * V, XX + 2 * cx * X + cx * cx * V, YY + 2 * cy * Y + cy * cy * V, ZZ + 2 * cz * Z + cz * cz * V,
    XY + cx * Y + cy * X + cx * cy * V, XZ + cx * Z + cz * X + cx * cz * V, YZ + cy * Z + cz * Y + cy * cz * V, I[10]];
}
