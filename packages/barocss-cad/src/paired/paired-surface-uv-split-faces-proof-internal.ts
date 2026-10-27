import type { Curve, Model, Point } from '../types.js';
import type { ExactPairedVLinearSurfaceIntersectionResult } from '../exact-proof/exact-paired-vlinear-surface-intersection.js';
import type { SurfaceIsoCurveResult } from '../nurbs/surfaces/surface-isocurve.js';
import type { SourceCurveIntervalExtractionResult } from '../nurbs/source-wide/source-curve-interval-extraction.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';

type F = SectionFraction;
type R = SectionRational;
type Role = 'bottom' | 'rightLow' | 'rightHigh' | 'top' | 'leftLow' | 'leftHigh' | 'sharedCut';
type VertexRole = 'bottomLeft' | 'bottomRight' | 'topRight' | 'topLeft' | 'cutLeft' | 'cutRight';
type Sense = 'forward' | 'reverse';
type SourceRef = { sourceField: 'world.source'; modelField: 'world.model';
  modelName: string; objectIndex: number; curveId: string };
type SupportRef = { sourceId: string; surfaceId: string;
  sourceField: 'request.section.request.assets[0].source'; modelField: 'request.section.originalModels[0]';
  modelName: string; objectIndex: number };
type Vertex = { id: string; role: VertexRole; sourceId: string; surfaceId: string; world: Point; uv: Point };
type Edge = { id: string; role: Role; curve: Curve; vertexIds: [string, string];
  pcurve: { coordinateSystem: 'original-native-uv'; lengthUnit: 'dimensionless'; curve: Curve };
  origin: { kind: 'restricted-isocurve' | 'exact-fixed-u-line' | 'paired-section'; index: number | null };
  sourceRef: SourceRef };
type Use = { id: string; edgeId: string; vertexIds: [string, string]; sense: Sense;
  interval: [number, number]; pcurveId: string };
type Loop = { id: string; uses: [Use, Use, Use, Use] };
type Face = { id: string; sourceId: string; surfaceId: string; outerLoopId: string;
  orientation: Sense; region: 'below-cut' | 'above-cut' };
type World = { source: string; sourceVersion: 0; model: Model };
type EdgeProof = { edgeId: string; role: Role; sourceRef: SourceRef;
  nativeDegree: number; nativeDomain: [number, number]; nativeWeights: number[];
  proofDegree: 4; worldCartesian: F[][]; uvCartesian: F[][];
  composedSurfaceCartesian: F[][]; residuals: F[][]; wholeGap: { exact: F; upper: 0 } };
type RestrictedBoundary = { edgeId: string; isoIndex: 0 | 1; intervalIndex: 0 | 1;
  fixedOriginalV: number; originalDomain: [number, number]; effectiveDomain: [number, number];
  isoCurveId: string; intervalCurveId: string; worldCurveId: string;
  wholeIsoSourceBinding: true; wholeIntervalSourceBinding: true; identityParameterMap: true;
  sourceRestrictionResiduals: F[][] };
type Connector = { edgeId: string; role: 'rightLow' | 'rightHigh' | 'leftLow' | 'leftHigh';
  fixedOriginalU: number; worldEndpoints: Point[]; uvEndpoints: Point[];
  expectedSurfaceEndpoints: F[][]; endpointResiduals: F[][]; wholeAffineResiduals: F[][] };
type Proof = {
  schema: 'barocss-paired-surface-uv-split-faces-proof'; version: 0;
  support: SupportRef; window: { u: [number, number]; v: [number, number] };
  projection: { xIntercept: F; xDerivative: F; yIntercept: F; yDerivative: F;
    xyDeterminant: F; gramLowerBound: F; nonzero: true; globallyInjectiveOnOriginalA: true };
  cut: { worldCurveId: string; pcurveId: string; parentEvaluationId: string; degree: 4;
    uCoefficients: F[]; uDerivative: F[]; minimumUDerivative: F; vCoefficients: F[];
    lowerGaps: F[]; upperGaps: F[]; minimumLowerGap: F; minimumUpperGap: F; strictVInterior: true };
  restrictions: [RestrictedBoundary, RestrictedBoundary]; connectors: Connector[]; edges: EdgeProof[];
  uvRegions: { lowerArea: F; upperArea: F; windowArea: F; sumResidual: F;
    areaUnit: 'dimensionless-uv2'; closedCoverOfWindow: true; disjointInteriors: true;
    sharedBoundaryOnlyCut: true; outsideWindowUnclaimed: true };
  faceCertificates: { faceId: string; loopId: string; sourceId: string; surfaceId: string;
    region: 'below-cut' | 'above-cut'; orientation: Sense; closedDiskCertified: true;
    exactWorldSurfaceAgreement: true; originalXYProjectionAuthority: true; orientedUVSimpleCycle: true }[];
  wholeModelGapZero: true; originalInputsPreserved: true;
  authority: 'full-exact-paired-section-actual-restricted-isocurves-and-original-a-xy-projection';
};
export type PairedSurfaceUVSplitFacesProof = Proof;
export type PairedSurfaceUVSplitVertex = Vertex;
export type PairedSurfaceUVSplitEdge = Edge;
export type PairedSurfaceUVSplitLoop = Loop;
export type PairedSurfaceUVSplitFace = Face;
export type PairedSurfaceUVSplitWorld = World;

export class PairedSurfaceUVSplitFacesProofError extends KernelError {
  readonly code: 'SUPPORT' | 'DOMAIN' | 'REGION' | 'REPRESENTABILITY' | 'BINDING';
  readonly edgeIndex: number | null;
  readonly role: Role | null;
  constructor(code: PairedSurfaceUVSplitFacesProofError['code'], detail: string,
    edgeIndex: number | null, role: Role | null, cause?: unknown) {
    super(('Paired UV Face proof: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedSurfaceUVSplitFacesProofError'; this.code = code;
    this.edgeIndex = edgeIndex; this.role = role;
  }
}

/** Exact actual-source/image/region proof; no native calls or coordinate conversion. */
export function provePairedSurfaceUVSplitFacesTrusted(
  section: ExactPairedVLinearSurfaceIntersectionResult,
  isoCurves: [SurfaceIsoCurveResult, SurfaceIsoCurveResult],
  intervals: [SourceCurveIntervalExtractionResult, SourceCurveIntervalExtractionResult],
  world: World, vertices: Vertex[], edges: Edge[], loops: [Loop, Loop], faces: [Face, Face],
  q: SectionRationalContext,
): Proof {
  function check(condition: boolean, code: PairedSurfaceUVSplitFacesProofError['code'], detail: string,
    edgeIndex: number | null = null): asserts condition {
    if (!condition) throw new PairedSurfaceUVSplitFacesProofError(code, detail,
      edgeIndex, edgeIndex === null ? null : edges[edgeIndex]?.role ?? null);
  }
  const same = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((value, i) => same(value, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      return Object.keys(left).length === Object.keys(right).length &&
        Object.keys(left).every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
    }
    return Object.is(a, b);
  };
  const zero = q.integer(0), one = q.integer(1), four = q.integer(4);
  const text = (values: R[]): F[] => values.map(value => q.text(value));
  const textGrid = (values: R[][]): F[][] => values.map(text);
  const equal = (a: R, b: R): boolean => q.compare(a, b) === 0;
  const trim = (values: R[]): R[] => {
    let length = values.length;
    while (length > 1 && values[length - 1].n === 0n) length--;
    return values.slice(0, length);
  };
  const add = (a: R[], b: R[]): R[] => trim(Array.from({ length: Math.max(a.length, b.length) },
    (_, i) => q.add(a[i] ?? zero, b[i] ?? zero)));
  const mul = (a: R[], b: R[]): R[] => {
    const values = Array.from({ length: a.length + b.length - 1 }, () => zero);
    for (let i = 0; i < a.length; i++) if (a[i].n !== 0n)
      for (let j = 0; j < b.length; j++) if (b[j].n !== 0n)
        values[i + j] = q.add(values[i + j], q.mul(a[i], b[j]));
    return trim(values);
  };
  const compose = (outer: R[], inner: R[]): R[] => {
    let value = [zero];
    for (let i = outer.length - 1; i >= 0; i--) value = add(mul(value, inner), [outer[i]]);
    return value;
  };
  const choose = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
  const toPower = (coefficients: R[]): R[] => {
    const degree = coefficients.length - 1;
    check(degree >= 1 && degree <= 4, 'SUPPORT', 'Proof supports actual Bezier degrees1..4 only');
    return trim(Array.from({ length: degree + 1 }, (_, k) => {
      let value = zero;
      for (let j = 0; j <= k; j++) {
        const term = q.mul(q.integer(choose[k][j]), coefficients[j]);
        value = q.add(value, (k - j) % 2 ? q.neg(term) : term);
      }
      return q.mul(q.integer(choose[degree][k]), value);
    }));
  };
  const toBernstein4 = (power: R[], edgeIndex: number | null = null): R[] => {
    check(power.length <= 5, 'BINDING', 'Whole source composition exceeds proof degree4', edgeIndex);
    return Array.from({ length: 5 }, (_, i) => q.sum(power.slice(0, i + 1).map((value, k) =>
      q.mul(value, q.div(q.integer(choose[i][k]), q.integer(choose[4][k]))))));
  };
  const grid = (axes: R[][]): R[][] => Array.from({ length: 5 }, (_, i) => axes.map(axis => axis[i]));
  const minimum = (values: R[]): R => values.reduce((best, value) => q.compare(value, best) < 0 ? value : best);
  const domain = (curve: Curve): [number, number] => [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
  const pointEqual = (a: Point, b: Point): boolean => a.every((value, i) => equal(q.from(value), q.from(b[i])));
  const source = section.request.assets[0], surface = source.surface;
  const original = section.originalModels[0], selection = section.report.selections[0];
  const uvDomain = selection.nativeDomains, window = section.request.uAInterval;
  check(same(selection.nativeDomains, section.proof.profiles[0].domain) &&
    same(original.objects[selection.objectIndex], surface) && selection.sourceId === source.sourceId &&
    selection.surfaceId === surface.id && selection.modelName === original.name,
  'BINDING', 'Complete original-A selection/profile/source-qualified Model binding required');
  const support: SupportRef = { sourceId: source.sourceId, surfaceId: surface.id,
    sourceField: 'request.section.request.assets[0].source', modelField: 'request.section.originalModels[0]',
    modelName: original.name, objectIndex: selection.objectIndex };
  check(window[0] < window[1] && window[0] >= uvDomain.u[0] && window[1] <= uvDomain.u[1] &&
    (window[0] > uvDomain.u[0] || window[1] < uvDomain.u[1]),
  'DOMAIN', 'A proper original-UA subwindow is required without endpoint healing');
  check(surface.degreeU >= 1 && surface.degreeU <= 2 && surface.degreeV === 1 &&
    surface.controlPoints.length === surface.degreeU + 1 && surface.controlPoints.every(row => row.length === 2),
  'SUPPORT', 'Actual original A must remain one Udegree1..2/Vdegree1 Bezier graph');
  const uniform = surface.weights[0][0];
  check(uniform > 0 && surface.weights.every(row => row.every(weight => Object.is(weight, uniform))),
    'SUPPORT', 'Original constant positive weights must be checked before cancellation');

  // Recover the complete source tensor in actual original U and V coordinates.
  const p = surface.degreeU, du = q.sub(q.from(uvDomain.u[1]), q.from(uvDomain.u[0]));
  const dv = q.sub(q.from(uvDomain.v[1]), q.from(uvDomain.v[0]));
  const originalUMap = [q.div(q.neg(q.from(uvDomain.u[0])), du), q.div(one, du)];
  const tensor = Array.from({ length: p + 1 }, () => Array.from({ length: 2 }, () => [zero, zero, zero]));
  for (let axis = 0; axis < 3; axis++) {
    const columns = [0, 1].map(v => compose(toPower(surface.controlPoints.map(row => q.from(row[v][axis]))), originalUMap));
    for (let i = 0; i <= p; i++) {
      const slope = q.div(q.sub(columns[1][i] ?? zero, columns[0][i] ?? zero), dv);
      tensor[i][0][axis] = q.sub(columns[0][i] ?? zero, q.mul(q.from(uvDomain.v[0]), slope));
      tensor[i][1][axis] = slope;
    }
  }
  check(tensor.every((row, i) => row.every((point, j) =>
    (j === 0 && i <= 1 || point[0].n === 0n) && (i === 0 || point[1].n === 0n))),
  'SUPPORT', 'ALL forbidden original X/Y tensor terms must be zero');
  const x0 = tensor[0][0][0], x1 = tensor[1][0][0], y0 = tensor[0][0][1], y1 = tensor[0][1][1];
  const determinant = q.mul(x1, y1);
  check(determinant.n !== 0n, 'SUPPORT', 'Signed original XY projection must be exactly nonzero');
  const sourceCompose = (u: R[], v: R[]): R[][] => [0, 1, 2].map(axis =>
    add(compose(tensor.map(row => row[0][axis]), u), mul(compose(tensor.map(row => row[1][axis]), u), v)));
  const atPoint = (uv: Point): R[] => sourceCompose([q.from(uv[0])], [q.from(uv[1])]).map(axis => axis[0]);
  const roles: Role[] = ['bottom', 'rightLow', 'rightHigh', 'top', 'leftLow', 'leftHigh', 'sharedCut'];
  const vertexRoles: VertexRole[] = ['bottomLeft', 'bottomRight', 'topRight', 'topLeft', 'cutLeft', 'cutRight'];
  check(edges.length === 7 && vertices.length === 6 && loops.length === 2 && faces.length === 2 &&
    edges.every((edge, i) => edge.role === roles[i]) && vertices.every((vertex, i) => vertex.role === vertexRoles[i]),
  'BINDING', 'Canonical6Vertex/7Edge/twoFace role order required');
  check(world.sourceVersion === 0 && world.source.length > 0 && world.model.objects.length === 8 &&
    same(world.model.objects[0], surface), 'BINDING', 'Actual adopted Model8 must retain untouched originalA at object0');
  for (let i = 0; i < 7; i++) {
    const edge = edges[i], ref = edge.sourceRef;
    check(same(world.model.objects[i + 1], edge.curve) && ref.sourceField === 'world.source' &&
      ref.modelField === 'world.model' && ref.modelName === world.model.name && ref.objectIndex === i + 1 &&
      ref.curveId === edge.curve.id, 'BINDING', 'Actual WorldModel8 Curve/source-qualified reference changed', i);
  }
  check(same(edges[6].curve, section.world.curve) && same(edges[6].pcurve.curve, section.pcurves.a.curve),
    'BINDING', 'Shared World cut and original-A UV must remain wholly unchanged', 6);

  const pairs: [number, number][] = [[0, 1], [1, 5], [5, 2], [3, 2], [0, 4], [4, 3], [4, 5]];
  const edgeProofs = edges.map((edge, edgeIndex): EdgeProof => {
    const nativeDomain = domain(edge.curve), uvCurve = edge.pcurve.curve;
    check(edge.pcurve.coordinateSystem === 'original-native-uv' && edge.pcurve.lengthUnit === 'dimensionless' &&
      same(domain(uvCurve), nativeDomain), 'BINDING', 'Actual World and original-UV native parameters must match', edgeIndex);
    const lift = (curve: Curve): R[][] => {
      const d = domain(curve), weight = curve.weights[0];
      check(curve.degree >= 1 && curve.degree <= 4 && curve.controlPoints.length === curve.degree + 1 &&
        curve.knots.length === 2 * (curve.degree + 1) && d[0] < d[1] &&
        curve.knots.every((value, i) => Object.is(value, d[i <= curve.degree ? 0 : 1])) && weight > 0 &&
        curve.weights.length === curve.controlPoints.length && curve.weights.every(value => Object.is(value, weight)),
      'SUPPORT', 'Actual edge/UV must be single Bezier with constant positive weights before cancellation', edgeIndex);
      return [0, 1, 2].map(axis => toPower(curve.controlPoints.map(point => q.from(point[axis]))));
    };
    const worldPowers = lift(edge.curve), uvPowers = lift(uvCurve);
    check(uvPowers[2].every(value => value.n === 0n), 'BINDING', 'UV embedded Z must be exactly zero', edgeIndex);
    const width = q.sub(q.from(window[1]), q.from(window[0]));
    if (edgeIndex === 0 || edgeIndex === 3 || edgeIndex === 6) {
      check(same(nativeDomain, window) && uvPowers[0].length === 2 &&
        equal(uvPowers[0][0], q.from(window[0])) && equal(uvPowers[0][1], width),
      'BINDING', 'Natural/cut UV must retain exact original-U identity over actual window bits', edgeIndex);
      if (edgeIndex === 6) check(uvPowers[1].length <= 3, 'BINDING', 'Inherited cut originalV must have actual degree≤2', edgeIndex);
      else check(uvPowers[1].length === 1 && equal(uvPowers[1][0], q.from(uvDomain.v[edgeIndex === 0 ? 0 : 1])),
        'BINDING', 'Restricted natural UV must keep actual original fixedV', edgeIndex);
    } else {
      const expectedU = window[edgeIndex === 1 || edgeIndex === 2 ? 1 : 0];
      check(same(nativeDomain, [0, 1]) && edge.curve.degree === 1 && uvCurve.degree === 1 &&
        uvPowers[0].length === 1 && equal(uvPowers[0][0], q.from(expectedU)) && uvPowers[1].length <= 2,
      'BINDING', 'Actual side must remain fixed originalU and affine originalV on native[0,1]', edgeIndex);
    }
    check(same(edge.vertexIds, pairs[edgeIndex].map(index => vertices[index].id)),
      'BINDING', 'Actual canonical edge endpoints must follow the selected role incidence', edgeIndex);
    for (let j = 0; j < 2; j++) {
      const vertex = vertices[pairs[edgeIndex][j]], pole = j === 0 ? 0 : edge.curve.controlPoints.length - 1;
      const uvPole = j === 0 ? 0 : uvCurve.controlPoints.length - 1;
      check(same(vertex.world, edge.curve.controlPoints[pole]) && pointEqual(vertex.uv, uvCurve.controlPoints[uvPole]),
        'BINDING', 'Actual clamped World/UV endpoints must bind shared vertices without welding', edgeIndex);
    }
    const storedWorld = grid(worldPowers.map(power => toBernstein4(power, edgeIndex)));
    const storedUV = grid(uvPowers.map(power => toBernstein4(power, edgeIndex)));
    const composed = grid(sourceCompose(uvPowers[0], uvPowers[1]).map(power => toBernstein4(power, edgeIndex)));
    const residuals = storedWorld.map((row, i) => row.map((value, axis) => q.sub(value, composed[i][axis])));
    check(residuals.every(row => row.every(value => value.n === 0n)), 'REPRESENTABILITY',
      'Every actual stored World coefficient must equal original-A UV composition; no interval repair', edgeIndex);
    return { edgeId: edge.id, role: edge.role, sourceRef: { ...edge.sourceRef }, nativeDegree: edge.curve.degree,
      nativeDomain, nativeWeights: [...edge.curve.weights], proofDegree: 4, worldCartesian: textGrid(storedWorld),
      uvCartesian: textGrid(storedUV), composedSurfaceCartesian: textGrid(composed), residuals: textGrid(residuals),
      wholeGap: { exact: q.text(zero), upper: 0 } };
  });

  const restrictions = ([0, 1] as const).map((index: 0 | 1) => {
    const edgeIndex = index === 0 ? 0 : 3, edge = edges[edgeIndex], iso = isoCurves[index], interval = intervals[index];
    check(same(iso.original, surface) && iso.sourceVersion === 0 && iso.source.length > 0 &&
      iso.model.objects.length === 1 && same(iso.model.objects[0], iso.curve) &&
      iso.provenance.fixedAxis === 'v' && iso.provenance.varyingAxis === 'u' &&
      Object.is(iso.provenance.parameter, uvDomain.v[index]) && iso.provenance.endpoint === (index === 0 ? 'min' : 'max') &&
      same(iso.curve.controlPoints, surface.controlPoints.map(row => row[index])) &&
      same(iso.curve.weights, surface.weights.map(row => row[index])) && same(iso.curve.knots, surface.knotsU),
    'BINDING', 'Whole actual original-V iso column/source/model binding required', edgeIndex);
    check(interval.request.source === iso.source && interval.request.sourceVersion === 0 &&
      interval.request.curveId === iso.curve.id && same(interval.request.interval, window) &&
      interval.request.maximumObservations === 256 && same(interval.originalModel, iso.model) &&
      same(interval.originalCurve, iso.curve) && interval.source.length > 0 && interval.model.objects.length === 1 &&
      same(interval.model.objects[0], interval.curve) && same(interval.curve, edge.curve) &&
      same(interval.provenance.plan.effectiveInterval, window) && same(domain(interval.curve), window) &&
      interval.provenance.parameterMap.kind === 'identity' && interval.provenance.parameterMap.formula === 'u=t' &&
      interval.provenance.parameterMap.d1Factor === 1,
    'BINDING', 'Full real1378 source/model/effective endpoint bits and actual identity restriction required', edgeIndex);
    check(edge.origin.kind === 'restricted-isocurve' && edge.origin.index === index,
      'BINDING', 'Actual restricted natural origin role changed', edgeIndex);
    return { edgeId: edge.id, isoIndex: index, intervalIndex: index, fixedOriginalV: uvDomain.v[index],
      originalDomain: [...uvDomain.u] as [number, number], effectiveDomain: [...window] as [number, number],
      isoCurveId: iso.curve.id, intervalCurveId: interval.curve.id, worldCurveId: edge.curve.id,
      wholeIsoSourceBinding: true as const, wholeIntervalSourceBinding: true as const,
      identityParameterMap: true as const, sourceRestrictionResiduals: edgeProofs[edgeIndex].residuals.map(row => row.map(value => ({ ...value }))) };
  }) as [RestrictedBoundary, RestrictedBoundary];
  const connectors = [1, 2, 4, 5].map((edgeIndex): Connector => {
    const edge = edges[edgeIndex], uvEndpoints = edge.pcurve.curve.controlPoints;
    check(edge.origin.kind === 'exact-fixed-u-line' && edge.origin.index === [1, 2, 4, 5].indexOf(edgeIndex),
      'BINDING', 'Actual side-line origin must be explicit', edgeIndex);
    const expected = uvEndpoints.map(atPoint), endpointResiduals = edge.curve.controlPoints.map((point, j) =>
      point.map((value, axis) => q.sub(q.from(value), expected[j][axis])));
    check(endpointResiduals.every(row => row.every(value => value.n === 0n)), 'REPRESENTABILITY',
      'Actual side endpoints must equal original Surface exactly without snap', edgeIndex);
    return { edgeId: edge.id, role: edge.role as Connector['role'],
      fixedOriginalU: window[edgeIndex === 1 || edgeIndex === 2 ? 1 : 0],
      worldEndpoints: edge.curve.controlPoints.map(point => [...point] as Point),
      uvEndpoints: uvEndpoints.map(point => [...point] as Point), expectedSurfaceEndpoints: textGrid(expected),
      endpointResiduals: textGrid(endpointResiduals),
      wholeAffineResiduals: edgeProofs[edgeIndex].residuals.map(row => row.map(value => ({ ...value }))) };
  });
  check(edges[6].origin.kind === 'paired-section' && edges[6].origin.index === null,
    'BINDING', 'Shared cut origin must retain actual paired-section authority', 6);

  for (const vertex of vertices) {
    check(vertex.sourceId === source.sourceId && vertex.surfaceId === surface.id &&
      vertex.uv[0] >= window[0] && vertex.uv[0] <= window[1] && vertex.uv[1] >= uvDomain.v[0] &&
      vertex.uv[1] <= uvDomain.v[1] && equal(q.from(vertex.uv[2]), zero),
    'BINDING', 'All actual vertices must retain source-bound original chart coordinates');
    check(atPoint(vertex.uv).every((value, axis) => equal(value, q.from(vertex.world[axis]))),
      'REPRESENTABILITY', 'Entire actual corner must equal originalA model restriction exactly');
  }
  check(new Set(vertices.map(vertex => vertex.id)).size === 6 && new Set(edges.map(edge => edge.id)).size === 7 &&
    vertices.every((vertex, i) => vertices.slice(0, i).every(other => !pointEqual(vertex.world, other.world))),
  'REGION', 'Six distinct actual World vertices and seven canonical edges required');
  const cutUV = edges[6].pcurve.curve, cutU = cutUV.controlPoints.map(point => q.from(point[0]));
  const cutV = cutUV.controlPoints.map(point => q.from(point[1]));
  const width = q.sub(q.from(window[1]), q.from(window[0]));
  check(cutUV.degree === 4 && edges[6].curve.degree === 4, 'BINDING', 'Unchanged paired cut degree4 required', 6);
  const uDerivative = cutU.slice(0, -1).map((value, i) => q.div(q.mul(four, q.sub(cutU[i + 1], value)), width));
  check(uDerivative.every(value => equal(value, one)), 'BINDING', 'Actual cut native-U derivative must be exactly identity', 6);
  const lowerGaps = cutV.map(value => q.sub(value, q.from(uvDomain.v[0])));
  const upperGaps = cutV.map(value => q.sub(q.from(uvDomain.v[1]), value));
  const minimumLowerGap = minimum(lowerGaps), minimumUpperGap = minimum(upperGaps);
  check(q.compare(minimumLowerGap, zero) > 0 && q.compare(minimumUpperGap, zero) > 0,
    'REGION', 'Strict whole V-gap hulls are required for BOTH complementary disks', 6);

  const orientation = faces[0].orientation;
  check((orientation === 'forward' || orientation === 'reverse') && faces[1].orientation === orientation &&
    faces[0].region === 'below-cut' && faces[1].region === 'above-cut' && faces[0].id !== faces[1].id && loops[0].id !== loops[1].id,
  'BINDING', 'Two ordered Faces must share exactly one requested orientation policy');
  const canonical: [number, Sense][][] = [[[0, 'forward'], [1, 'forward'], [6, 'reverse'], [4, 'reverse']],
    [[6, 'forward'], [2, 'forward'], [3, 'reverse'], [5, 'reverse']]];
  const allUseIds = new Set<string>();
  const faceCertificates = faces.map((face, faceIndex) => {
    const loop = loops[faceIndex];
    check(face.sourceId === source.sourceId && face.surfaceId === surface.id && face.outerLoopId === loop.id &&
      loop.uses.length === 4, 'BINDING', 'Actual Face/Loop must bind untouched originalA support');
    const expected = orientation === 'forward' ? canonical[faceIndex] : canonical[faceIndex].slice().reverse()
      .map(([index, sense]): [number, Sense] => [index, sense === 'forward' ? 'reverse' : 'forward']);
    for (let i = 0; i < 4; i++) {
      const [edgeIndex, sense] = expected[i], edge = edges[edgeIndex], use = loop.uses[i], d = domain(edge.curve);
      const pair = sense === 'forward' ? edge.vertexIds : [edge.vertexIds[1], edge.vertexIds[0]];
      check(use.edgeId === edge.id && use.sense === sense && same(use.vertexIds, pair) &&
        same(use.interval, sense === 'forward' ? d : [d[1], d[0]]) && use.pcurveId === edge.pcurve.curve.id &&
        use.vertexIds[1] === loop.uses[(i + 1) % 4].vertexIds[0] && !allUseIds.has(use.id),
      'BINDING', 'Actual oriented native UV cycle/interval must reverse ONCE and close on common vertices', edgeIndex);
      allUseIds.add(use.id);
    }
    check(new Set(loop.uses.map(use => use.vertexIds[0])).size === 4, 'REGION', 'Each disk has four distinct actual corners');
    return { faceId: face.id, loopId: loop.id, sourceId: source.sourceId, surfaceId: surface.id,
      region: face.region, orientation, closedDiskCertified: true as const, exactWorldSurfaceAgreement: true as const,
      originalXYProjectionAuthority: true as const, orientedUVSimpleCycle: true as const };
  });
  const sharedUses = loops.flatMap(loop => loop.uses).filter(use => use.edgeId === edges[6].id);
  check(sharedUses.length === 2 && sharedUses[0].sense !== sharedUses[1].sense &&
    same(sharedUses[0].interval, sharedUses[1].interval.slice().reverse()) &&
    same(sharedUses[0].vertexIds, sharedUses[1].vertexIds.slice().reverse()),
  'BINDING', 'Canonical shared cut must have two opposite EFFECTIVE Uses', 6);
  const integratedCut = q.div(q.mul(width, q.sum(cutV)), q.integer(5));
  const lowerArea = q.sub(integratedCut, q.mul(width, q.from(uvDomain.v[0])));
  const upperArea = q.sub(q.mul(width, q.from(uvDomain.v[1])), integratedCut);
  const windowArea = q.mul(width, dv), sumResidual = q.sub(q.add(lowerArea, upperArea), windowArea);
  check(q.compare(lowerArea, zero) > 0 && q.compare(upperArea, zero) > 0 && sumResidual.n === 0n,
    'REGION', 'Exact complementary UV areas must be positive and sum to the selected rectangular window');
  return { schema: 'barocss-paired-surface-uv-split-faces-proof', version: 0, support,
    window: { u: [...window], v: [...uvDomain.v] },
    projection: { xIntercept: q.text(x0), xDerivative: q.text(x1), yIntercept: q.text(y0), yDerivative: q.text(y1),
      xyDeterminant: q.text(determinant), gramLowerBound: q.text(q.mul(determinant, determinant)),
      nonzero: true, globallyInjectiveOnOriginalA: true },
    cut: { worldCurveId: edges[6].curve.id, pcurveId: cutUV.id, parentEvaluationId: section.request.options.evaluationId,
      degree: 4, uCoefficients: text(cutU), uDerivative: text(uDerivative), minimumUDerivative: q.text(minimum(uDerivative)),
      vCoefficients: text(cutV), lowerGaps: text(lowerGaps), upperGaps: text(upperGaps),
      minimumLowerGap: q.text(minimumLowerGap), minimumUpperGap: q.text(minimumUpperGap), strictVInterior: true },
    restrictions, connectors, edges: edgeProofs,
    uvRegions: { lowerArea: q.text(lowerArea), upperArea: q.text(upperArea), windowArea: q.text(windowArea),
      sumResidual: q.text(sumResidual), areaUnit: 'dimensionless-uv2', closedCoverOfWindow: true,
      disjointInteriors: true, sharedBoundaryOnlyCut: true, outsideWindowUnclaimed: true },
    faceCertificates, wholeModelGapZero: true, originalInputsPreserved: true,
    authority: 'full-exact-paired-section-actual-restricted-isocurves-and-original-a-xy-projection' };
}
