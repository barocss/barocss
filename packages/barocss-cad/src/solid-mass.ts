// Mass properties of B-rep solids: closed form for prismatic solids (area moments of each slab's
// section times its height); for any other B-rep, quadrature over the exact surfaces (brep-mass-
// quadrature.ts), else exact integration of the display tessellation (exact for planar faces; for curved
// faces the chord error of the tessellation, reported).
import { regionMoments } from './curved-arrangement.js';
import { tessellateBrep } from './brep-tessellate.js';
import { brepQuadratureIntegrals } from './brep-mass-quadrature.js';
import type { Brep } from './brep-core.js';
import type { PrismaticSolid } from './prismatic-solid.js';
import type { Point } from './types.js';

export interface SolidMassProperties {
  readonly volumeMM3: number; readonly massKG: number; readonly centroidMM: Point;
  /** About the centroid in kg·m², products of inertia stored as −∫xy dm. */
  readonly inertiaCentroidKgM2: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
  /** `quadrature`: Gauss quadrature exact across and to rounding along smooth (rational) edges. */
  readonly method: 'closed-form' | 'planar-exact' | 'tessellated' | 'quadrature';
}
export class SolidMassError extends Error { constructor(detail: string) { super('Mass properties: ' + detail); this.name = 'SolidMassError'; } }

/** From volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] in mm-powers. */
export function solidMassFromIntegrals(I: readonly number[], density: number, method: SolidMassProperties['method']): SolidMassProperties {
  if (!(typeof density === 'number' && Number.isFinite(density) && density > 0)) throw new SolidMassError('a positive finite density is required');
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I;
  if (!(V > 0)) throw new SolidMassError('the solid has no positive volume');
  const c: Point = [X / V, Y / V, Z / V], k = density * 1e-15;
  const xx = XX - V * c[0] * c[0], yy = YY - V * c[1] * c[1], zz = ZZ - V * c[2] * c[2];
  const xy = XY - V * c[0] * c[1], xz = XZ - V * c[0] * c[2], yz = YZ - V * c[1] * c[2];
  return { volumeMM3: V, massKG: density * V * 1e-9, centroidMM: c, method,
    inertiaCentroidKgM2: [[k * (yy + zz), -k * xy, -k * xz], [-k * xy, k * (xx + zz), -k * yz], [-k * xz, -k * yz, k * (xx + yy)]] };
}

export function prismaticMassProperties(solid: PrismaticSolid, densityKgPerM3: number): SolidMassProperties {
  const I = Array(10).fill(0) as number[];
  for (const s of solid.slabs) {
    const h = s.z1 - s.z0, h2 = (s.z1 * s.z1 - s.z0 * s.z0) / 2, h3 = (s.z1 ** 3 - s.z0 ** 3) / 3;
    for (const r of s.regions) {
      const [A, Sx, Sy, Sxx, Syy, Sxy] = regionMoments(r);
      I[0] += A * h; I[1] += Sx * h; I[2] += Sy * h; I[3] += A * h2; I[4] += Sxx * h; I[5] += Syy * h; I[6] += A * h3; I[7] += Sxy * h; I[8] += Sx * h2; I[9] += Sy * h2;
    }
  }
  return solidMassFromIntegrals(I, densityKgPerM3, 'closed-form');
}

/**
 * Curved B-reps by quadrature over their surfaces, on meshes of `quadratureSegments` a quarter (8 by
 * default; 0: none) and twice that, extrapolated (Richardson: the error left along trims that are not
 * straight in a face's parameters, and beside poles, falls with the square of the step; faces with none
 * give the same value on both). Otherwise, or when that cannot integrate a face, tetrahedra from the
 * origin over the watertight tessellation (divergence theorem).
 */
export function brepMassProperties(brep: Brep, densityKgPerM3: number, options: { readonly segmentsPerQuarter?: number; readonly quadratureSegments?: number } = {}): SolidMassProperties {
  const curved = brep.faces.some(f => f.surface.degreeU > 1 || f.surface.degreeV > 1);
  const q = options.quadratureSegments ?? 8;
  if (curved && q > 0) {
    let Q: number[] | null = null;
    try {
      // (Integrated without the tessellation, the result does not depend on q: no second pass.)
      const coarse = brepQuadratureIntegrals(brep, q), fine = coarse?.meshed ? brepQuadratureIntegrals(brep, 2 * q) : coarse;
      Q = coarse && fine ? (coarse.meshed ? fine.integrals.map((x, k) => (4 * x - coarse.integrals[k]) / 3) : coarse.integrals) : null;
    } catch { Q = null; }
    if (Q && Q[0] > 0) return solidMassFromIntegrals(Q, densityKgPerM3, 'quadrature');
  }
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: curved ? options.segmentsPerQuarter ?? 64 : 1 }), p = mesh.positionsMM, ix = mesh.indices;
  const I = Array(10).fill(0) as number[];
  for (let t = 0; t < ix.length; t += 3) {
    const a = [p[ix[t] * 3], p[ix[t] * 3 + 1], p[ix[t] * 3 + 2]], b = [p[ix[t + 1] * 3], p[ix[t + 1] * 3 + 1], p[ix[t + 1] * 3 + 2]], c = [p[ix[t + 2] * 3], p[ix[t + 2] * 3 + 1], p[ix[t + 2] * 3 + 2]];
    const D = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    const s = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
    const second = (i: number, j: number) => D / 120 * (a[i] * a[j] + b[i] * b[j] + c[i] * c[j] + s[i] * s[j]);
    I[0] += D / 6; I[1] += D / 24 * s[0]; I[2] += D / 24 * s[1]; I[3] += D / 24 * s[2];
    I[4] += second(0, 0); I[5] += second(1, 1); I[6] += second(2, 2); I[7] += second(0, 1); I[8] += second(0, 2); I[9] += second(1, 2);
  }
  return solidMassFromIntegrals(I, densityKgPerM3, curved ? 'tessellated' : 'planar-exact');
}

/**
 * Mass properties of a body made of pieces that meet only in faces, each given in its own frame and
 * placed by a rotation (its columns: the frame's axes in world) and an offset (mm): masses add, centroids
 * average, each inertia turns with its piece (R I Rᵀ) and moves to the common centroid (parallel axes).
 */
export function combineMassProperties(parts: readonly { readonly props: SolidMassProperties; readonly axes: readonly [Point, Point, Point]; readonly offset: Point }[]): SolidMassProperties {
  if (!parts.length) throw new SolidMassError('no pieces to combine');
  const world = parts.map(({ props, axes, offset }) => {
    const R = [0, 1, 2].map(i => [axes[0][i], axes[1][i], axes[2][i]]), c = props.centroidMM;
    const centroid = [0, 1, 2].map(i => offset[i] + R[i][0] * c[0] + R[i][1] * c[1] + R[i][2] * c[2]) as Point;
    const I = props.inertiaCentroidKgM2, turned = [0, 1, 2].map(i => [0, 1, 2].map(j => { let v = 0; for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) v += R[i][p] * I[p][q] * R[j][q]; return v; }));
    return { m: props.massKG, v: props.volumeMM3, centroid, I: turned };
  });
  const M = world.reduce((a, w) => a + w.m, 0), V = world.reduce((a, w) => a + w.v, 0);
  const C = [0, 1, 2].map(k => world.reduce((a, w) => a + w.m * w.centroid[k], 0) / M) as Point;
  const I = [0, 1, 2].map(i => [0, 1, 2].map(j => world.reduce((a, w) => {
    const d = [0, 1, 2].map(k => (w.centroid[k] - C[k]) * 1e-3), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    return a + w.I[i][j] + w.m * ((i === j ? dd : 0) - d[i] * d[j]);
  }, 0))) as [[number, number, number], [number, number, number], [number, number, number]];
  return { volumeMM3: V, massKG: M, centroidMM: C, inertiaCentroidKgM2: I, method: 'closed-form' };
}
