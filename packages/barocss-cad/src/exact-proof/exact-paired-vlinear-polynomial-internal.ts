import type { Curve, Point, Surface } from '../types.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';

type F = SectionFraction;
type R = SectionRational;
type Domains = { u: [number, number]; v: [number, number] };
type Profile = {
  assetIndex: 0 | 1; degreeU: 1 | 2; degreeV: 1; domain: Domains;
  uniformWeight: F; originalCartesian: F[][][];
  xU: F[]; yU: F[]; yV: F[]; zU: F[]; zUV: F[][]; axisResiduals: F[][][];
};
type Proof = {
  schema: 'barocss-exact-paired-vlinear-surface-intersection'; version: 0;
  parameterDomain: [number, number]; parameterAuthority: 'original-a-u-interval';
  profiles: [Profile, Profile];
  originalUB: { offset: F; scale: F; coefficients: F[] };
  originalVA: F[]; originalVB: F[]; commonDegree: 4;
  worldCartesian: F[][]; pcurveACartesian: F[][]; pcurveBCartesian: F[][];
  composedA: F[][]; composedB: F[][]; residualsA: F[][]; residualsB: F[][];
  chartGaps: { assetIndex: 0 | 1; uMinimum: F[]; uMaximum: F[];
    vMinimum: F[]; vMaximum: F[]; minimumUGap: F; minimumVGap: F }[];
  fixedUJacobianDeterminant: F; uniqueCompleteBranchOnDeclaredInterval: true;
  storedWorldEqualsBothCompositions: true; originalInputsPreserved: true;
  authority: 'exact-stored-source-axis-profile-and-entire-coefficient-composition';
};
export type ExactPairedVLinearProfile = Profile;
export type ExactPairedVLinearProof = Proof;
export interface ExactPairedVLinearDerived {
  world: Curve; pcurveA: Curve; pcurveB: Curve; proof: ExactPairedVLinearProof;
}

/** Known private admission failures; errors from the caller's q are never wrapped. */
export class ExactPairedVLinearPolynomialError extends KernelError {
  readonly code: 'SUPPORT' | 'DOMAIN' | 'BINDING';
  readonly assetIndex: 0 | 1 | null;
  constructor(code: ExactPairedVLinearPolynomialError['code'], detail: string, assetIndex: 0 | 1 | null) {
    super(('Exact paired polynomial: ' + detail).slice(0, 1024));
    this.name = 'ExactPairedVLinearPolynomialError'; this.code = code; this.assetIndex = assetIndex;
  }
}

/** Whole source-axis reduction, actual stored Curve construction and full coefficient binding. */
export function deriveExactPairedVLinearPolynomialsTrusted(
  surfaces: [Surface, Surface], domains: [Domains, Domains], uAInterval: [number, number],
  ids: { worldCurveId: string; pcurveAId: string; pcurveBId: string }, q: SectionRationalContext,
): ExactPairedVLinearDerived {
  const require = (condition: boolean, code: ExactPairedVLinearPolynomialError['code'],
    detail: string, assetIndex: 0 | 1 | null): void => {
    if (!condition) throw new ExactPairedVLinearPolynomialError(code, detail, assetIndex);
  };
  const zero = q.integer(0), one = q.integer(1);
  const trim = (values: R[]): R[] => {
    let length = values.length;
    while (length > 1 && values[length - 1].n === 0n) length--;
    return values.slice(0, length);
  };
  const add = (a: R[], b: R[]): R[] => trim(Array.from({ length: Math.max(a.length, b.length) },
    (_, i) => q.add(a[i] ?? zero, b[i] ?? zero)));
  const scale = (a: R[], value: R): R[] => trim(a.map(item => q.mul(item, value)));
  const mul = (a: R[], b: R[]): R[] => {
    const result = Array.from({ length: a.length + b.length - 1 }, () => zero);
    for (let i = 0; i < a.length; i++) if (a[i].n !== 0n)
      for (let j = 0; j < b.length; j++) if (b[j].n !== 0n)
        result[i + j] = q.add(result[i + j], q.mul(a[i], b[j]));
    return trim(result);
  };
  const compose = (outer: R[], inner: R[]): R[] => {
    let result: R[] = [zero];
    for (let i = outer.length - 1; i >= 0; i--) result = add(mul(result, inner), [outer[i]]);
    return result;
  };
  const combinations = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
  const bernsteinPower = (coefficients: R[], nativeDomain: [number, number]): R[] => {
    const degree = coefficients.length - 1, normalized: R[] = [];
    for (let k = 0; k <= degree; k++) {
      let difference = zero;
      for (let j = 0; j <= k; j++) {
        const term = q.mul(q.integer(combinations[k][j]), coefficients[j]);
        difference = q.add(difference, (k - j) % 2 ? q.neg(term) : term);
      }
      normalized.push(q.mul(q.integer(combinations[degree][k]), difference));
    }
    const width = q.sub(q.from(nativeDomain[1]), q.from(nativeDomain[0]));
    return compose(trim(normalized), [q.div(q.neg(q.from(nativeDomain[0])), width), q.div(one, width)]);
  };
  const intervalWidth = q.sub(q.from(uAInterval[1]), q.from(uAInterval[0]));
  require(q.compare(intervalWidth, zero) > 0, 'DOMAIN', 'Ordered nonzero original-UA interval required', 0);
  require(q.compare(q.from(uAInterval[0]), q.from(domains[0].u[0])) >= 0 &&
    q.compare(q.from(uAInterval[1]), q.from(domains[0].u[1])) <= 0,
  'DOMAIN', 'Requested interval must stay inside original A.U without clipping', 0);
  const powerBernstein4 = (power: R[]): R[] => {
    require(power.length <= 5, 'BINDING', 'Complete composed degree must not exceed four', null);
    const local = compose(power, [q.from(uAInterval[0]), intervalWidth]);
    return Array.from({ length: 5 }, (_, i) => {
      let coefficient = zero;
      for (let k = 0; k <= i && k < local.length; k++)
        coefficient = q.add(coefficient, q.mul(local[k],
          q.div(q.integer(combinations[i][k]), q.integer(combinations[4][k]))));
      return coefficient;
    });
  };
  const textVector = (values: R[]): F[] => values.map(value => q.text(value));
  const textGrid = (values: R[][]): F[][] => values.map(textVector);
  const textTensor = (values: R[][][]): F[][][] => values.map(textGrid);
  type AxisTensor = R[][][]; // actual U power, actual V power, Cartesian axis
  const tensors: [AxisTensor, AxisTensor] = [[], []];
  const profiles: Profile[] = [];

  for (const assetIndex of [0, 1] as const) {
    const surface = surfaces[assetIndex], domain = domains[assetIndex], p = surface.degreeU;
    require((p === 1 || p === 2) && surface.degreeV === 1 && surface.controlPoints.length === p + 1 &&
      surface.controlPoints.every(row => row.length === 2) && surface.weights.length === p + 1 &&
      surface.weights.every(row => row.length === 2), 'SUPPORT', 'Single degree1..2 by degree1 grid required', assetIndex);
    require(surface.knotsU.length === 2 * (p + 1) && surface.knotsV.length === 4 &&
      surface.knotsU.every((value, i) => Object.is(value, domain.u[i <= p ? 0 : 1])) &&
      surface.knotsV.every((value, i) => Object.is(value, domain.v[i < 2 ? 0 : 1])),
    'SUPPORT', 'Actual single clamped original bases and domain bits required', assetIndex);
    const weight = surface.weights[0][0];
    require(Number.isFinite(weight) && weight > 0 &&
      surface.weights.every(row => row.every(value => Object.is(value, weight))),
    'SUPPORT', 'Whole original weights must be uniformly positive before denominator cancellation', assetIndex);
    require(domain.u[0] < domain.u[1] && domain.v[0] < domain.v[1],
      'DOMAIN', 'Ordered nonzero original domains required', assetIndex);
    const original = surface.controlPoints.map(row => row.map(point => point.map(value => q.from(value))));
    const tensor = Array.from({ length: p + 1 }, () =>
      Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => zero)));
    for (let axis = 0; axis < 3; axis++) {
      const columns = [0, 1].map(v => bernsteinPower(original.map(row => row[v][axis]), domain.u));
      const dv = q.sub(q.from(domain.v[1]), q.from(domain.v[0]));
      for (let i = 0; i <= p; i++) {
        const slope = q.div(q.sub(columns[1][i] ?? zero, columns[0][i] ?? zero), dv);
        tensor[i][0][axis] = q.sub(columns[0][i] ?? zero, q.mul(q.from(domain.v[0]), slope));
        tensor[i][1][axis] = slope;
      }
    }
    const residuals = tensor.map((row, i) => row.map((point, j) => point.map((value, axis) => {
      const forbidden = axis === 0 ? j !== 0 || i > 1
        : axis === 1 ? assetIndex === 0 ? i !== 0 : j !== 0
        : assetIndex === 1 && i !== 0;
      return forbidden ? value : zero;
    })));
    require(residuals.every(row => row.every(point => point.every(value => value.n === 0n))),
      'SUPPORT', 'Every forbidden or mixed source-axis power coefficient must be exactly zero', assetIndex);
    require(tensor[1][0][0].n !== 0n && (assetIndex === 0 ? tensor[0][1][1] : tensor[0][1][2]).n !== 0n,
      'SUPPORT', 'Exact affine X and designated V slopes must be nonzero without direction normalization', assetIndex);
    tensors[assetIndex] = tensor;
    profiles.push({ assetIndex, degreeU: p as 1 | 2, degreeV: 1,
      domain: { u: [...domain.u], v: [...domain.v] }, uniformWeight: q.text(q.from(weight)),
      originalCartesian: textTensor(original), xU: textVector(tensor.map(row => row[0][0])),
      yU: textVector(tensor.map(row => row[0][1])), yV: textVector([zero, tensor[0][1][1]]),
      zU: textVector(tensor.map(row => row[0][2])), zUV: textGrid(tensor.map(row => row.map(point => point[2]))),
      axisResiduals: textTensor(residuals) });
  }

  const [a, b] = tensors, originalUA: R[] = [zero, one];
  const xA = a.map(row => row[0][0]), yB = b.map(row => row[0][1]);
  const offset = q.div(q.sub(a[0][0][0], b[0][0][0]), b[1][0][0]);
  const mapScale = q.div(a[1][0][0], b[1][0][0]);
  const originalUB: R[] = [offset, mapScale], worldY = compose(yB, originalUB);
  const originalVA = scale(add(worldY, [q.neg(a[0][0][1])]), q.div(one, a[0][1][1]));
  const composeTensor = (tensor: AxisTensor, u: R[], v: R[]): R[][] => [0, 1, 2].map(axis =>
    add(compose(tensor.map(row => row[0][axis]), u), mul(compose(tensor.map(row => row[1][axis]), u), v)));
  const intendedA = composeTensor(a, originalUA, originalVA), worldZ = intendedA[2];
  const originalVB = scale(add(worldZ, [q.neg(b[0][0][2])]), q.div(one, b[0][1][2]));
  const zeroPoly: R[] = [zero];
  const intendedWorld = [trim(xA), worldY, worldZ];
  const intendedUVs = [[originalUA, originalVA, zeroPoly], [originalUB, originalVB, zeroPoly]];
  const toGrid = (axisCoefficients: R[][]): R[][] =>
    Array.from({ length: 5 }, (_, i) => axisCoefficients.map(axis => axis[i]));
  const bernsteinGrid = (axisPowers: R[][]): R[][] => toGrid(axisPowers.map(powerBernstein4));
  let conversionAttempts = 0;
  const makeCurve = (id: string, axisPowers: R[][]): Curve => {
    const coordinates = bernsteinGrid(axisPowers).map(row => row.map(value => {
      conversionAttempts++;
      return q.exactFloat(value);
    }) as Point);
    return { kind: 'curve', id, degree: 4,
      knots: [...Array<number>(5).fill(uAInterval[0]), ...Array<number>(5).fill(uAInterval[1])],
      controlPoints: coordinates, weights: Array<number>(5).fill(1) };
  };
  const world = makeCurve(ids.worldCurveId, intendedWorld);
  const pcurveA = makeCurve(ids.pcurveAId, intendedUVs[0]);
  const pcurveB = makeCurve(ids.pcurveBId, intendedUVs[1]);
  require(conversionAttempts === 45, 'BINDING', 'Exactly45 final coordinate conversion attempts required', null);

  // Recompose from actual stored pcurve coefficients, not only the intended symbolic maps.
  const storedGrid = (curve: Curve): R[][] => curve.controlPoints.map(point => point.map(value => q.from(value)));
  const actualWorld = storedGrid(world), actualA = storedGrid(pcurveA), actualB = storedGrid(pcurveB);
  const actualPowers = (grid: R[][]): R[][] => [0, 1, 2].map(axis =>
    bernsteinPower(grid.map(row => row[axis]), uAInterval));
  const aPowers = actualPowers(actualA), bPowers = actualPowers(actualB);
  const composedA = bernsteinGrid(composeTensor(a, aPowers[0], aPowers[1]));
  const composedB = bernsteinGrid(composeTensor(b, bPowers[0], bPowers[1]));
  const residuals = (composed: R[][]): R[][] => actualWorld.map((row, i) =>
    row.map((value, axis) => q.sub(value, composed[i][axis])));
  const residualsA = residuals(composedA), residualsB = residuals(composedB);
  require([...residualsA, ...residualsB].every(row => row.every(value => value.n === 0n)),
    'BINDING', 'Entire actual stored World must equal both whole source compositions exactly', null);

  const minimum = (values: R[]): R => values.reduce((best, value) => q.compare(value, best) < 0 ? value : best);
  const chartGaps = ([actualA, actualB] as const).map((grid, index) => {
    const assetIndex = index as 0 | 1, domain = domains[assetIndex];
    const uMinimum = grid.map(row => q.sub(row[0], q.from(domain.u[0])));
    const uMaximum = grid.map(row => q.sub(q.from(domain.u[1]), row[0]));
    const vMinimum = grid.map(row => q.sub(row[1], q.from(domain.v[0])));
    const vMaximum = grid.map(row => q.sub(q.from(domain.v[1]), row[1]));
    const minimumUGap = minimum([...uMinimum, ...uMaximum]);
    const minimumVGap = minimum([...vMinimum, ...vMaximum]);
    require(q.compare(minimumUGap, zero) >= 0 && q.compare(minimumVGap, zero) >= 0,
      'DOMAIN', 'Whole actual original UV Bernstein hull must remain in its original chart inclusively', assetIndex);
    return { assetIndex, uMinimum: textVector(uMinimum), uMaximum: textVector(uMaximum),
      vMinimum: textVector(vMinimum), vMaximum: textVector(vMaximum),
      minimumUGap: q.text(minimumUGap), minimumVGap: q.text(minimumVGap) };
  });
  const determinant = q.neg(q.mul(q.mul(a[0][1][1], b[1][0][0]), b[0][1][2]));
  require(determinant.n !== 0n, 'BINDING', 'Exact fixed-UA coupled Jacobian determinant must be nonzero', null);
  const proof: Proof = { schema: 'barocss-exact-paired-vlinear-surface-intersection', version: 0,
    parameterDomain: [...uAInterval], parameterAuthority: 'original-a-u-interval',
    profiles: profiles as [Profile, Profile],
    originalUB: { offset: q.text(offset), scale: q.text(mapScale), coefficients: textVector(actualB.map(row => row[0])) },
    originalVA: textVector(actualA.map(row => row[1])), originalVB: textVector(actualB.map(row => row[1])), commonDegree: 4,
    worldCartesian: textGrid(actualWorld), pcurveACartesian: textGrid(actualA), pcurveBCartesian: textGrid(actualB),
    composedA: textGrid(composedA), composedB: textGrid(composedB),
    residualsA: textGrid(residualsA), residualsB: textGrid(residualsB), chartGaps,
    fixedUJacobianDeterminant: q.text(determinant), uniqueCompleteBranchOnDeclaredInterval: true,
    storedWorldEqualsBothCompositions: true, originalInputsPreserved: true,
    authority: 'exact-stored-source-axis-profile-and-entire-coefficient-composition' };
  return { world, pcurveA, pcurveB, proof };
}
