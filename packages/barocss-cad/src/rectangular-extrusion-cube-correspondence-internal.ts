import type { ConvexPlanarFaceExtrusionResult } from './convex-planar-face-extrusion.js';
import type { CompatibleRuledSurfaceResult } from './compatible-ruled-surface.js';
import type { QualifiedTranslatedStripBodyResult, QualifiedTranslatedStripBodyReport } from './qualified-translated-strip-body.js';
import type { ClosedExactPatchShellResult } from './closed-exact-patch-shell.js';
import type { SectionRationalContext, SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Curve, Surface, Point } from './types.js';
import { same } from './structural-equality.js';

type Fraction = SectionFraction;
type Role = 'lower' | 'upper' | 'base' | 'cap' | 'uMin' | 'uMax';
type Axis = 'u' | 't' | 'w';
type R = SectionRational;
type Vector = [R, R, R];
type Domains = { u: [number, number]; v: [number, number] };
export interface RectangularExtrusionSupport {
  role: 'lower' | 'upper'; sourceId: string; inputCurves: [Curve, Curve]; ruled: CompatibleRuledSurfaceResult;
}
export interface RectangularExtrusionQualifiedRef {
  sourceField: string; modelField: string; sourceId: string | null;
  modelName: string; objectIndex: number; objectId: string;
}
type AffineUV = { offset: [Fraction, Fraction]; matrix: [[Fraction, Fraction], [Fraction, Fraction]]; actualDomain: Domains };
type FaceImage = {
  role: Role; bodyFaceId: string; parentAssetIndex: number; parentFaceId: string;
  bodySupport: RectangularExtrusionQualifiedRef; parentSupport: RectangularExtrusionQualifiedRef;
  cubeAxes: [Axis, Axis]; fixedCubeAxis: Axis; fixedCubeValue: 0 | 1;
  bodyUV: AffineUV; parentUV: AffineUV; degree: [number, number];
  bodyCartesian: Fraction[][][]; parentCartesian: Fraction[][][]; residuals: Fraction[][][];
  wholeImageEqual: true; outwardAxis: 'x' | 'y' | 'z'; outwardSign: -1 | 1;
  parentOrientation: 'forward'; bodyOrientation: 'forward' | 'reverse';
};
type EdgeImage = {
  bodyEdgeId: string; bodyCurve: RectangularExtrusionQualifiedRef; parentPairIndex: number;
  parentPair: ClosedExactPatchShellResult['pairs'][number]; parentCanonicalCurve: RectangularExtrusionQualifiedRef;
  bodyParameterMap: { domain: [number, number]; offset: Fraction; scale: Fraction };
  parentParameterMap: { domain: [number, number]; offset: Fraction; scale: Fraction };
  degree: number; bodyCartesian: Fraction[][]; parentCartesian: Fraction[][]; residuals: Fraction[][];
  wholeImageEqual: true; bodyVertexIds: [string, string]; parentVertexIds: [string, string];
};
type VertexImage = { bodyVertexId: string; parentVertexId: string; bodyWorld: Point; parentWorld: Point;
  residuals: [Fraction, Fraction, Fraction] };
export interface RectangularExtrusionCubeProof {
  schema: 'barocss-rectangular-face-extrusion-material-correspondence'; version: 0;
  cube: { domains: { u: [0, 1]; t: [0, 1]; w: [0, 1] };
    formula: 'Phi(u,t,w)=[x0+DX*u,y0+DY*w,D*t]'; x0: Fraction; y0: Fraction; dx: Fraction; dy: Fraction;
    distance: Fraction; jacobianAbsolute: Fraction; strictlyPositive: true; roofV: Fraction;
    supportHeight: Fraction; derivedSectionWeight: Fraction };
  supportDerivation: { role: 'lower' | 'upper'; bottomParentBoundaryIndex: 0 | 2;
    inputPoints: [Point[], Point[]]; expectedPoints: Fraction[][][]; residuals: Fraction[][][];
    actualTranslation: [Fraction, Fraction, Fraction] }[];
  faces: FaceImage[]; edges: EdgeImage[]; vertices: VertexImage[];
  volume: { expectedExactMM3: Fraction; qualifiedExactMM3: Fraction; residual: Fraction;
    inheritedVolumeMM3: number; inheritedConversionError: QualifiedTranslatedStripBodyReport['conversionError'] };
  exactOccupiedRegionEqual: true; parentFlagsUnchanged: true;
  authority: 'existing-qualified-material-plus-exact-entire-cube-skin-correspondence';
}
type AffineSurface = { a: Vector; b: Vector; c: Vector; domains: Domains };
type AffineCurve = { a: Vector; b: Vector; domain: [number, number] };
type Chart = { offset: [R, R]; matrix: [[R, R], [R, R]] };
function check(value: boolean, detail: string): asserts value {
  if (!value) throw new Error(('Rectangular extrusion correspondence: ' + detail).slice(0, 1024));
}

/** Whole stored-coefficient proof only. No geometry, source, parent or native sampler calls. */
export function proveRectangularExtrusionBodyCorrespondenceTrusted(parent: ConvexPlanarFaceExtrusionResult,
  supports: [RectangularExtrusionSupport, RectangularExtrusionSupport], body: QualifiedTranslatedStripBodyResult,
  q: SectionRationalContext): RectangularExtrusionCubeProof {
  const zero = q.integer(0), one = q.integer(1), two = q.integer(2), half = q.div(one, two);
  const v = (point: Point): Vector => point.map(value => q.from(value)) as Vector;
  const add = (a: Vector, b: Vector): Vector => a.map((value, i) => q.add(value, b[i])) as Vector;
  const sub = (a: Vector, b: Vector): Vector => a.map((value, i) => q.sub(value, b[i])) as Vector;
  const scale = (a: Vector, b: R): Vector => a.map(value => q.mul(value, b)) as Vector;
  const text = (a: Vector): [Fraction, Fraction, Fraction] => a.map(value => q.text(value)) as [Fraction, Fraction, Fraction];
  const read = (fraction: Fraction): R => q.rat(BigInt(fraction.numerator), BigInt(fraction.denominator));
  const equal = (a: R, b: R): boolean => q.compare(a, b) === 0;
  const equalV = (a: Vector, b: Vector): boolean => a.every((value, i) => equal(value, b[i]));
  const requireZero = (a: Vector, detail: string): void => check(a.every(value => value.n === 0n), detail);
  const unique = <T>(values: T[], detail: string): T => { check(values.length === 1, detail); return values[0]; };
  const pointCopy = (point: Point): Point => point.slice() as Point;
  const power = (values: R[]): R[] => values.length === 2
    ? [values[0], q.sub(values[1], values[0]), zero]
    : [values[0], q.mul(two, q.sub(values[1], values[0])), q.add(q.sub(values[0], q.mul(two, values[1])), values[2])];
  const surfaceCache = new WeakMap<Surface, AffineSurface>();
  const surfaceAffine = (surface: Surface, parentSupport = false): AffineSurface => {
    const cached = surfaceCache.get(surface); if (cached) return cached;
    const pu = surface.degreeU, pv = surface.degreeV;
    check(Number.isInteger(pu) && Number.isInteger(pv) && pu >= 1 && pu <= 2 && pv >= 1 && pv <= 2 &&
      surface.controlPoints.length === pu + 1 && surface.controlPoints.every(row => row.length === pv + 1), 'Complete degree1..2 tensor support required');
    if (parentSupport) check(pu === 1 && pv === 1 && surface.weights.every(row => row.every(weight => Object.is(weight, 1))), 'Parent supports must retain degree1/unit weights');
    const weight = surface.weights[0][0];
    check(weight > 0 && surface.weights.length === pu + 1 && surface.weights.every(row => row.length === pv + 1 && row.every(value => Object.is(value, weight))), 'Uniform positive weights must cancel exactly');
    check(surface.knotsU.length === 2 * (pu + 1) && surface.knotsV.length === 2 * (pv + 1), 'A complete single-span tensor basis is required');
    const domains: Domains = { u: [surface.knotsU[pu], surface.knotsU[pu + 1]], v: [surface.knotsV[pv], surface.knotsV[pv + 1]] };
    for (const [knots, degree, domain] of [[surface.knotsU, pu, domains.u], [surface.knotsV, pv, domains.v]] as const)
      check(domain[0] < domain[1] && knots.slice(0, degree + 1).every(value => Object.is(value, domain[0])) &&
        knots.slice(degree + 1).every(value => Object.is(value, domain[1])), 'Actual tensor domains/clamp bits must be complete');
    const grid = surface.controlPoints.map(row => row.map(v));
    const up = Array.from({ length: 3 }, () => Array.from({ length: pv + 1 }, () => [zero, zero, zero] as Vector));
    for (let j = 0; j <= pv; j++) for (let axis = 0; axis < 3; axis++) {
      const coefficients = power(grid.map(row => row[j][axis]));
      for (let i = 0; i < 3; i++) up[i][j][axis] = coefficients[i];
    }
    const coefficients = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => [zero, zero, zero] as Vector));
    for (let i = 0; i < 3; i++) for (let axis = 0; axis < 3; axis++) {
      const column = power(up[i].map(point => point[axis]));
      for (let j = 0; j < 3; j++) coefficients[i][j][axis] = column[j];
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!(i === 0 && j === 0 || i === 1 && j === 0 || i === 0 && j === 1))
      requireZero(coefficients[i][j], 'Every actual higher and mixed tensor coefficient must be exactly zero');
    const b = scale(coefficients[1][0], q.div(one, q.sub(q.from(domains.u[1]), q.from(domains.u[0]))));
    const c = scale(coefficients[0][1], q.div(one, q.sub(q.from(domains.v[1]), q.from(domains.v[0]))));
    const a = sub(sub(coefficients[0][0], scale(b, q.from(domains.u[0]))), scale(c, q.from(domains.v[0])));
    const result = { a, b, c, domains }; surfaceCache.set(surface, result); return result;
  };
  const curveCache = new WeakMap<Curve, AffineCurve>();
  const curveAffine = (curve: Curve): AffineCurve => {
    const cached = curveCache.get(curve); if (cached) return cached;
    const degree = curve.degree;
    check((degree === 1 || degree === 2) && curve.controlPoints.length === degree + 1 && curve.knots.length === 2 * (degree + 1), 'Whole degree1..2 single-span edge required');
    const weight = curve.weights[0]; check(weight > 0 && curve.weights.length === degree + 1 && curve.weights.every(value => Object.is(value, weight)), 'Actual edge must have constant positive weights');
    const domain: [number, number] = [curve.knots[degree], curve.knots[degree + 1]];
    check(domain[0] < domain[1] && curve.knots.slice(0, degree + 1).every(value => Object.is(value, domain[0])) &&
      curve.knots.slice(degree + 1).every(value => Object.is(value, domain[1])), 'Edge clamp/domain bits must be complete');
    const points = curve.controlPoints.map(v), base = points[0], derivative: R[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const coefficients = power(points.map(point => point[axis]));
      check(coefficients[2].n === 0n, 'Actual quadratic edge coefficients must reduce exactly to a line');
      derivative.push(q.div(coefficients[1], q.sub(q.from(domain[1]), q.from(domain[0]))));
    }
    const b = derivative as Vector, a = sub(base, scale(b, q.from(domain[0]))), result = { a, b, domain };
    curveCache.set(curve, result); return result;
  };
  const cross = (a: Vector, b: Vector): Vector => [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])),
    q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))];
  const compose = (affine: AffineSurface, chart: Chart): [Vector, Vector, Vector] => [
    add(add(affine.a, scale(affine.b, chart.offset[0])), scale(affine.c, chart.offset[1])),
    add(scale(affine.b, chart.matrix[0][0]), scale(affine.c, chart.matrix[1][0])),
    add(scale(affine.b, chart.matrix[0][1]), scale(affine.c, chart.matrix[1][1])),
  ];
  const chartText = (chart: Chart, domain: Domains): AffineUV => ({ offset: chart.offset.map(value => q.text(value)) as [Fraction, Fraction],
    matrix: chart.matrix.map(row => row.map(value => q.text(value))) as AffineUV['matrix'], actualDomain: { u: domain.u.slice() as [number, number], v: domain.v.slice() as [number, number] } });

  const originalPlane = parent.request.face.plane, originalAffine = surfaceAffine(originalPlane, true);
  check(same(originalAffine.domains, { u: [0, 1], v: [0, 1] }) && parent.request.face.topology.face.orientation === 'forward' &&
    parent.request.options.direction === 'positive-z', 'Actual forward unit-chart XY parent is required');
  const x0 = q.from(originalPlane.controlPoints[0][0][0]), y0 = q.from(originalPlane.controlPoints[0][0][1]);
  const dx = q.sub(q.from(originalPlane.controlPoints[1][0][0]), x0), dy = q.sub(q.from(originalPlane.controlPoints[0][1][1]), y0);
  const distance = q.from(parent.request.options.distanceMM), supportHeight = q.mul(two, distance), jacobian = q.mul(q.mul(dx, dy), distance);
  check(q.compare(dx, zero) > 0 && q.compare(dy, zero) > 0 && q.compare(distance, zero) > 0 && q.compare(distance, q.integer(5000)) <= 0,
    'Exact positive rectangle extents and bounded positive-Z distance are required');
  check(equalV(originalAffine.a, [x0, y0, zero]) && equalV(originalAffine.b, [dx, zero, zero]) && equalV(originalAffine.c, [zero, dy, zero]),
    'The entire original affine support must equal the admitted XY rectangle');
  const sectionWeight = q.mul(q.integer(4), jacobian);
  check(q.compare(sectionWeight, q.from(1e-6)) >= 0 && q.compare(sectionWeight, q.from(1e6)) <= 0, 'Actual section weights must retain the unchanged native range');
  check(parent.shell.assets.length === 6 && parent.shell.graph.faces.length === 6 && parent.shell.graph.edges.length === 12 && parent.shell.graph.vertices.length === 8 &&
    parent.shell.report.solid === false && parent.shell.report.embeddedManifoldCertified === false && parent.report.quality.solid === false,
    'Full original abstract Shell and false material flags must remain unchanged');
  const material = body.proof.material;
  check(body.vertices.length === 8 && body.edges.length === 12 && body.faces.length === 6 && body.faces.every(face => face.loop.uses.length === 4) &&
    body.models.length === 2 && body.models[0].model.objects.length === 16 && body.models[1].model.objects.length === 2 && body.proof.geometryCatalog.length === 18 &&
    material.restrictedSolidCertified && material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage && material.outwardMaterial && material.embeddedClosedBoundary &&
    material.cubeMap.globallyInjective && material.cubeMap.continuous && body.body.restrictedSolidCertified && body.body.solid &&
    body.body.materialCertificateId === material.certificateId && body.body.id === material.bodyId && body.shell.id === material.shellId,
    'Only a complete real qualified Body and bound whole-material certificate is admissible');
  check(material.spans.length === 1 && material.sixFaceImages.length === 6, 'The canonical one-span rectangle material images must be complete');
  const lowerWall = body.volume.lowerWall, upperWall = body.volume.upperWall;
  const sections = [lowerWall.binding.section, upperWall.binding.section];
  const roof = lowerWall.binding.pcurve.curve, rho = q.from(roof.controlPoints[0][1]);
  check(roof.degree === 2 && roof.weights.every(weight => Object.is(weight, 1)) &&
    roof.controlPoints.every(point => equal(q.from(point[1]), rho)) && equal(rho, half) &&
    same(lowerWall.binding.pcurve.curve.knots, upperWall.binding.pcurve.curve.knots) &&
    same(lowerWall.binding.pcurve.curve.controlPoints, upperWall.binding.pcurve.curve.controlPoints) &&
    same(lowerWall.binding.pcurve.curve.weights, upperWall.binding.pcurve.curve.weights), 'Actual stored roof curves must give the exact common half-cut');
  const roofLine = curveAffine(roof);
  check(same(roofLine.domain, [0, 1]) && equalV(roofLine.a, [zero, rho, zero]) && equalV(roofLine.b, [one, zero, zero]),
    'The entire stored unit-weight roof must be the canonical affine UV graph');
  check(same(material.cubeMap.nativeDomains, { u: [0, 1], v: [0, 1] }) && equal(read(material.cubeMap.h), dy) &&
    equal(read(material.cubeMap.z0), zero) && equal(read(material.cubeMap.zDerivative), supportHeight) &&
    equal(read(material.cubeMap.minimumXDerivative), dx) && equal(read(material.cubeMap.minimumRoofHeight), rho) &&
    equal(read(material.cubeMap.minimumJacobianAbsolute), jacobian) && material.spans[0].roofV.every(value => equal(read(value), rho)),
    'Actual injective material cube coefficients must reduce to the intended normalized rectangular cube');
  const topAsset = parent.shell.assets[1], topSurface = unique(topAsset.face.geometry.objects.filter(object =>
    object.kind === 'surface' && object.id === topAsset.face.topology.face.surfaceId), 'Original roof must resolve in its complete Source/Model5') as Surface;
  for (const section of sections) {
    check(section.planeAsset.sourceId === topAsset.sourceId && section.planeAsset.source === topAsset.source && same(section.planeAsset.surface, topSurface) &&
      same(section.originalModels[1], topAsset.face.geometry), 'Both sections must retain the unchanged complete original top asset');
    check(section.world.curve.weights.every(weight => equal(q.from(weight), sectionWeight)) &&
      section.pcurves.plane.curve.weights.every(weight => equal(q.from(weight), sectionWeight)), 'Actual complete World/PlaneUV weights must equal the source-derived weight');
  }
  const supportDerivation: RectangularExtrusionCubeProof['supportDerivation'] = [];
  for (let index = 0; index < 2; index++) {
    const support = supports[index], y = index === 0 ? y0 : q.add(y0, dy), boundaryIndex = index === 0 ? 0 : 2;
    check(support.role === (index === 0 ? 'lower' : 'upper') && same(support.inputCurves[0], support.ruled.first) &&
      same(support.inputCurves[1], support.ruled.second) && same(support.ruled.model.objects, [support.ruled.first, support.ruled.second, support.ruled.surface]),
      'Full ordered support inputs must bind the actual complete ruled Model3');
    const oldPoints = parent.request.face.loop.edges[boundaryIndex].controlPoints;
    check(same(support.inputCurves[0].controlPoints, index === 0 ? oldPoints : [...oldPoints].reverse()), 'Canonical bottom input must copy the actual original boundary bits');
    const expected: Vector[][] = [[ [x0, y, zero], [q.add(x0, dx), y, zero] ],
      [ [x0, y, supportHeight], [q.add(x0, dx), y, supportHeight] ]];
    const actual = support.inputCurves.map(curve => {
      check(curve.degree === 1 && same(curve.knots, [0, 0, 1, 1]) && curve.weights.every(weight => Object.is(weight, 1)) && curve.controlPoints.length === 2,
        'New canonical input Lines must retain the unit degree1 profile');
      return curve.controlPoints.map(v);
    });
    const residuals = actual.map((line, i) => line.map((point, j) => sub(point, expected[i][j])));
    residuals.flat().forEach(point => requireZero(point, 'Every new support input coefficient must equal the exact original/extended line'));
    const translated = sub(actual[1][0], actual[0][0]);
    check(equalV(translated, [zero, zero, supportHeight]) && equalV(sub(actual[1][1], actual[0][1]), translated), 'Both exact input-pole translations must equal the retained support height');
    const affine = surfaceAffine(support.ruled.surface);
    check(same(affine.domains, { u: [0, 1], v: [0, 1] }) && equalV(affine.a, [x0, y, zero]) &&
      equalV(affine.b, [dx, zero, zero]) && equalV(affine.c, [zero, zero, supportHeight]), 'The entire actual ruled support must be the canonical overshoot plane');
    check(sections[index].surfaceAsset.sourceId === support.sourceId && sections[index].surfaceAsset.source === support.ruled.source &&
      same(sections[index].surfaceAsset.surface, support.ruled.surface) && same(sections[index].originalModels[0], support.ruled.model), 'New section source/Surface/Model3 must bind its actual full support');
    supportDerivation.push({ role: support.role, bottomParentBoundaryIndex: boundaryIndex as 0 | 2,
      inputPoints: support.inputCurves.map(curve => curve.controlPoints.map(pointCopy)) as [Point[], Point[]],
      expectedPoints: expected.map(line => line.map(text)), residuals: residuals.map(line => line.map(text)), actualTranslation: text(translated) });
  }
  const parentRef = (assetIndex: number, objectId: string): RectangularExtrusionQualifiedRef => {
    const asset = parent.shell.assets[assetIndex], objectIndex = asset.face.geometry.objects.findIndex(object => object.id === objectId);
    check(objectIndex >= 0, 'Every parent geometry reference must resolve in its actual qualified Model5');
    return { sourceField: 'request.extrusion.shell.assets[' + assetIndex + '].source', modelField: 'request.extrusion.shell.assets[' + assetIndex + '].face.geometry',
      sourceId: asset.sourceId, modelName: asset.face.geometry.name, objectIndex, objectId };
  };
  const bodyRef = (reference: { sourceModelId: string; objectId: string }): RectangularExtrusionQualifiedRef => {
    const modelIndex = body.models.findIndex(entry => entry.model.name === reference.sourceModelId);
    check(modelIndex >= 0, 'Every Body ref must identify an actual Model.name');
    const model = body.models[modelIndex], objectIndex = model.model.objects.findIndex(object => object.id === reference.objectId);
    const catalog = unique(body.proof.geometryCatalog.filter(entry => entry.objectId === reference.objectId && entry.sourceModelId === reference.sourceModelId), 'Every Body object must have one actual catalog ref');
    check(objectIndex >= 0 && catalog.objectIndex === objectIndex && catalog.sourceId === model.sourceId, 'Body catalog/source/member qualification must agree');
    return { sourceField: 'body.models[' + modelIndex + '].source', modelField: 'body.models[' + modelIndex + '].model',
      sourceId: model.sourceId, modelName: model.model.name, objectIndex, objectId: reference.objectId };
  };
  const phi = (u: R, t: R, w: R): Vector => [q.add(x0, q.mul(dx, u)), q.add(y0, q.mul(dy, w)), q.mul(distance, t)];
  const identity: Chart = { offset: [zero, zero], matrix: [[one, zero], [zero, one]] };
  const wallChart: Chart = { offset: [zero, zero], matrix: [[one, zero], [zero, rho]] };
  const endChart: Chart = { offset: [zero, zero], matrix: [[rho, zero], [zero, one]] };
  const plans: { role: Role; asset: number; axes: [Axis, Axis]; fixed: Axis; value: 0 | 1; oldChart: Chart; newChart: Chart; axis: 'x' | 'y' | 'z'; sign: -1 | 1; orientation: 'forward' | 'reverse' }[] = [
    { role: 'lower', asset: 2, axes: ['u', 't'], fixed: 'w', value: 0, oldChart: identity, newChart: wallChart, axis: 'y', sign: -1, orientation: 'forward' },
    { role: 'upper', asset: 4, axes: ['u', 't'], fixed: 'w', value: 1, oldChart: { offset: [one, zero], matrix: [[q.neg(one), zero], [zero, one]] }, newChart: wallChart, axis: 'y', sign: 1, orientation: 'reverse' },
    { role: 'base', asset: 0, axes: ['u', 'w'], fixed: 't', value: 0, oldChart: { offset: [zero, zero], matrix: [[zero, one], [one, zero]] }, newChart: identity, axis: 'z', sign: -1, orientation: 'reverse' },
    { role: 'cap', asset: 1, axes: ['u', 'w'], fixed: 't', value: 1, oldChart: identity, newChart: identity, axis: 'z', sign: 1, orientation: 'forward' },
    { role: 'uMin', asset: 5, axes: ['t', 'w'], fixed: 'u', value: 0, oldChart: { offset: [one, zero], matrix: [[zero, q.neg(one)], [one, zero]] }, newChart: endChart, axis: 'x', sign: -1, orientation: 'forward' },
    { role: 'uMax', asset: 3, axes: ['t', 'w'], fixed: 'u', value: 1, oldChart: { offset: [zero, zero], matrix: [[zero, one], [one, zero]] }, newChart: endChart, axis: 'x', sign: 1, orientation: 'reverse' },
  ];
  const faces: FaceImage[] = [];
  const nativeFaceAffines = new Map<string, AffineSurface>();
  const cubeRoleByParentFace = new Map<string, Role>();
  const outward = (affine: AffineSurface, orientation: 'forward' | 'reverse', axis: 'x' | 'y' | 'z', sign: -1 | 1): void => {
    const normal = scale(cross(affine.b, affine.c), orientation === 'forward' ? one : q.neg(one)), index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    check(normal.every((value, i) => i === index || value.n === 0n) && q.compare(q.mul(normal[index], q.integer(sign)), zero) > 0,
      'Actual oriented native support must have the required nonzero outward axis sign');
  };
  for (const plan of plans) {
    const face = unique(body.faces.filter(value => value.role === plan.role), 'Every material Face role must occur exactly once');
    const asset = parent.shell.assets[plan.asset], parentFace = asset.face.topology.face;
    const oldSupport = unique(asset.face.geometry.objects.filter(object => object.kind === 'surface' && object.id === parentFace.surfaceId), 'Every parent Face must resolve its actual support') as Surface;
    const oldAffine = surfaceAffine(oldSupport, true), newAffine = surfaceAffine(face.nativeSurface);
    check(same(oldAffine.domains, { u: [0, 1], v: [0, 1] }) && parentFace.orientation === 'forward' && face.orientation === plan.orientation,
      'Actual orientations and old canonical native domains must agree with the selected role');
    const expectedDomain = plan.role === 'uMin' || plan.role === 'uMax' ? { u: [0, roof.controlPoints[0][1]], v: [0, 1] } : { u: [0, 1], v: [0, 1] };
    check(same(newAffine.domains, expectedDomain), 'Actual Body support native domains must match inherited wall/base/cap/end restrictions');
    const image = unique(material.sixFaceImages.filter(value => value.faceId === face.id && value.role === plan.role), 'Every whole material image must bind its actual Face role');
    check(same(image.actualSurface, face.nativeSurface) && same(image.supportRef, face.supportRef) && image.orientation === face.orientation &&
      image.chartBoundaryAuthority.wholeClosedDomain && image.coefficientResiduals.flat(2).every(value => read(value).n === 0n), 'Complete inherited material support/source/image identity is required');
    if (plan.role === 'cap') check(same(face.nativeSurface, topSurface) && material.plane.capMap.entireStripImage && material.plane.capMap.commonUStrictBijection,
      'The whole cap must retain the actual original top Plane and its certified full strip bijection');
    const old = compose(oldAffine, plan.oldChart), fresh = compose(newAffine, plan.newChart);
    const bodyCartesian: Fraction[][][] = [], parentCartesian: Fraction[][][] = [], residuals: Fraction[][][] = [];
    for (let i = 0; i < 3; i++) {
      const br: Fraction[][] = [], pr: Fraction[][] = [], rr: Fraction[][] = [];
      for (let j = 0; j < 3; j++) {
        const s = q.div(q.integer(i), two), r = q.div(q.integer(j), two);
        const cube: Record<Axis, R> = { u: zero, t: zero, w: zero }; cube[plan.fixed] = q.integer(plan.value); cube[plan.axes[0]] = s; cube[plan.axes[1]] = r;
        const expected = phi(cube.u, cube.t, cube.w), newCoefficient = add(add(fresh[0], scale(fresh[1], s)), scale(fresh[2], r)), oldCoefficient = add(add(old[0], scale(old[1], s)), scale(old[2], r));
        requireZero(sub(newCoefficient, expected), 'All elevated Body tensor coefficients must equal the entire cube restriction');
        requireZero(sub(oldCoefficient, expected), 'All elevated parent tensor coefficients must equal the entire cube restriction');
        const delta = sub(newCoefficient, oldCoefficient); requireZero(delta, 'Whole Face coefficient correspondence must be exact');
        br.push(text(newCoefficient)); pr.push(text(oldCoefficient)); rr.push(text(delta));
      }
      bodyCartesian.push(br); parentCartesian.push(pr); residuals.push(rr);
    }
    outward(newAffine, face.orientation, plan.axis, plan.sign); outward(oldAffine, 'forward', plan.axis, plan.sign);
    const oldGraphFace = unique(parent.shell.graph.faces.filter(value => value.sourceId === asset.sourceId && value.faceId === parentFace.id), 'Each original graph Face must resolve its actual qualified asset');
    check(oldGraphFace.edgeIds.length === 4, 'Each actual parent Face must retain its four shared Edges');
    nativeFaceAffines.set(face.id, newAffine); cubeRoleByParentFace.set(parentFace.id, plan.role);
    faces.push({ role: plan.role, bodyFaceId: face.id, parentAssetIndex: plan.asset, parentFaceId: parentFace.id,
      bodySupport: bodyRef(face.supportRef), parentSupport: parentRef(plan.asset, oldSupport.id), cubeAxes: plan.axes.slice() as [Axis, Axis],
      fixedCubeAxis: plan.fixed, fixedCubeValue: plan.value, bodyUV: chartText(plan.newChart, newAffine.domains), parentUV: chartText(plan.oldChart, oldAffine.domains),
      degree: [2, 2], bodyCartesian, parentCartesian, residuals, wholeImageEqual: true, outwardAxis: plan.axis, outwardSign: plan.sign,
      parentOrientation: 'forward', bodyOrientation: face.orientation });
  }
  const capProof = material.spans[0].cap;
  check(capProof.degree === 2 && capProof.commonUCoefficients.length === 3 && capProof.lowerPlaneUV.length === 3 && capProof.upperPlaneUV.length === 3 &&
    equal(read(capProof.separation), one), 'The actual cap must cover the complete common unit chart');
  for (let i = 0; i < 3; i++) {
    const u = q.div(q.integer(i), two);
    check(equal(read(capProof.commonUCoefficients[i]), u) &&
      equalV(capProof.lowerPlaneUV[i].map(read) as Vector, [u, zero, zero]) &&
      equalV(capProof.upperPlaneUV[i].map(read) as Vector, [u, one, zero]), 'All actual degree2 cap-UV coefficients must cover the whole original roof rectangle');
  }
  check(capProof.mappingResiduals.lower.flat().every(value => read(value).n === 0n) && capProof.mappingResiduals.upper.flat().every(value => read(value).n === 0n),
    'Actual whole cap Plane/World binding residuals must remain zero');

  type Corner = { bits: [number, number, number]; key: string; world: Vector; bodyId: string; parentId: string };
  const corners: Corner[] = [], vertices: VertexImage[] = [];
  for (const u of [0, 1]) for (const t of [0, 1]) for (const w of [0, 1]) {
    const expected = phi(q.integer(u), q.integer(t), q.integer(w));
    const fresh = unique(body.vertices.filter(vertex => equalV(v(vertex.world), expected)), 'Every cube corner must resolve exactly one actual Body vertex');
    const old = unique(parent.shell.graph.vertices.filter(vertex => equalV(v(vertex.representative.pointMM), expected)), 'Every cube corner must resolve exactly one actual old vertex class');
    check(fresh.members.length === 3 && old.members.length === 3 && fresh.members.every(member => equalV(v(member.world), expected)) &&
      old.members.every(member => equalV(v(member.pointMM), expected)), 'The full three-Face corner memberships must preserve exact world identity');
    const residual = sub(v(fresh.world), v(old.representative.pointMM)); requireZero(residual, 'Whole cube vertex correspondence must have zero exact residual');
    corners.push({ bits: [u, t, w], key: '' + u + t + w, world: expected, bodyId: fresh.id, parentId: old.id });
    vertices.push({ bodyVertexId: fresh.id, parentVertexId: old.id, bodyWorld: pointCopy(fresh.world), parentWorld: pointCopy(old.representative.pointMM), residuals: text(residual) });
  }
  check(new Set(corners.map(corner => corner.bodyId)).size === 8 && new Set(corners.map(corner => corner.parentId)).size === 8,
    'All eight corner correspondences must be bijective without changing either graph');
  const bodyCorner = new Map(corners.map(corner => [corner.bodyId, corner])), parentCorner = new Map(corners.map(corner => [corner.parentId, corner]));
  const corner = (bits: [number, number, number]): Corner => unique(corners.filter(value => same(value.bits, bits)), 'Every canonical bit corner must resolve');
  const cycleEqual = (a: string[], b: string[]): boolean => a.length === b.length && a.some((_, offset) => a.every((value, index) => value === b[(index + offset) % b.length]));
  for (const link of faces) {
    const fresh = unique(body.faces.filter(face => face.id === link.bodyFaceId), 'Body Face graph reference must resolve');
    const asset = parent.shell.assets[link.parentAssetIndex], old = unique(parent.shell.graph.faces.filter(face => face.faceId === link.parentFaceId && face.sourceId === asset.sourceId), 'Parent Face graph reference must resolve');
    const newCycle = fresh.loop.uses.map(use => {
      const a = bodyCorner.get(use.vertexIds[0]), b = bodyCorner.get(use.vertexIds[1]);
      check(a !== undefined && b !== undefined && use.vertexIds[1] === fresh.loop.uses[(fresh.loop.uses.indexOf(use) + 1) % 4].vertexIds[0], 'Actual oriented Body loop endpoints must remain closed');
      return a.key;
    });
    const oldCycle = old.vertexClassIds.map(id => {
      const value = parentCorner.get(id); check(value !== undefined, 'Every parent Face corner class must resolve'); return value.key;
    });
    check(cycleEqual(newCycle, oldCycle), 'Mapped actual outward Face cycles must agree up to rotation, never a second reversal');
  }
  type BodyEdge = QualifiedTranslatedStripBodyResult['edges'][number];
  const edgePlans: { role: BodyEdge['role']; start: [number, number, number]; end: [number, number, number] }[] = [
    { role: 'lowerBottom', start: [0, 0, 0], end: [1, 0, 0] }, { role: 'upperBottom', start: [0, 0, 1], end: [1, 0, 1] },
    { role: 'lowerCut', start: [0, 1, 0], end: [1, 1, 0] }, { role: 'upperCut', start: [0, 1, 1], end: [1, 1, 1] },
    { role: 'lowerLeft', start: [0, 0, 0], end: [0, 1, 0] }, { role: 'lowerRight', start: [1, 0, 0], end: [1, 1, 0] },
    { role: 'upperLeft', start: [0, 0, 1], end: [0, 1, 1] }, { role: 'upperRight', start: [1, 0, 1], end: [1, 1, 1] },
    { role: 'capLeft', start: [0, 1, 0], end: [0, 1, 1] }, { role: 'capRight', start: [1, 1, 0], end: [1, 1, 1] },
    { role: 'baseLeft', start: [0, 0, 0], end: [0, 0, 1] }, { role: 'baseRight', start: [1, 0, 0], end: [1, 0, 1] },
  ];
  type ParameterMap = { domain: [number, number]; offset: R; scale: R; direction: -1 | 1 };
  const parameterMap = (affine: AffineCurve, start: Vector, end: Vector): ParameterMap => {
    const first = add(affine.a, scale(affine.b, q.from(affine.domain[0]))), last = add(affine.a, scale(affine.b, q.from(affine.domain[1])));
    const forward = equalV(first, start) && equalV(last, end), reversed = equalV(first, end) && equalV(last, start);
    check(forward !== reversed, 'Actual complete curve endpoints must resolve exactly one positive cube edge direction');
    return { domain: affine.domain.slice() as [number, number], offset: q.from(affine.domain[forward ? 0 : 1]),
      scale: q.sub(q.from(affine.domain[forward ? 1 : 0]), q.from(affine.domain[forward ? 0 : 1])), direction: forward ? 1 : -1 };
  };
  const edges: EdgeImage[] = [], parentEdgeToBody = new Map<string, string>();
  for (const plan of edgePlans) {
    const start = corner(plan.start), end = corner(plan.end), fresh = unique(body.edges.filter(edge => edge.role === plan.role), 'Every canonical Body Edge role must occur once');
    const old = unique(parent.shell.graph.edges.filter(edge => edge.vertexClassIds.includes(start.parentId) && edge.vertexClassIds.includes(end.parentId)), 'Every cube edge must resolve one actual parent pair');
    const pair = parent.shell.pairResults[old.pairIndex];
    check(pair !== undefined && pair.sharedEdges.length === 1 && pair.sharedEdges[0].id === old.childEdgeId, 'Global old edge must bind the retained actual child pair');
    const shared = pair.sharedEdges[0], assetIndex = parent.shell.assets.findIndex(asset => asset.sourceId === shared.canonical.sourceId);
    check(assetIndex >= 0, 'Old canonical Curve must resolve its actual source-qualified asset');
    const canonical = unique(parent.shell.assets[assetIndex].face.geometry.objects.filter(object => object.kind === 'curve' && object.id === shared.canonical.curveId), 'Old canonical curve source member must be unique') as Curve;
    check(canonical.degree === 1 && canonical.weights.every(weight => Object.is(weight, 1)), 'Actual original rectangle edges must remain degree1/unit weights');
    const newAffine = curveAffine(fresh.curve), oldAffine = curveAffine(canonical), newMap = parameterMap(newAffine, start.world, end.world), oldMap = parameterMap(oldAffine, start.world, end.world);
    const descending = plan.role === 'lowerLeft' || plan.role === 'upperLeft' || plan.role === 'capLeft';
    check(newMap.direction === (descending ? -1 : 1) && same(fresh.parameterRange, newAffine.domain), 'Actual Body curve direction/domain must retain the selected edge role');
    check(same(fresh.vertexIds, newMap.direction === 1 ? [start.bodyId, end.bodyId] : [end.bodyId, start.bodyId]) &&
      same(old.vertexClassIds, oldMap.direction === 1 ? [start.parentId, end.parentId] : [end.parentId, start.parentId]), 'Actual raw graph endpoints must agree with native Curve order and canonical proof maps');
    const reference = bodyRef(fresh.curveRef), modelEntry = body.models.find(entry => entry.model.name === reference.modelName)!;
    check(same(modelEntry.model.objects[reference.objectIndex], fresh.curve), 'Whole Body canonical Curve must equal its actual source model member');
    const bodyCartesian: Fraction[][] = [], parentCartesian: Fraction[][] = [], residuals: Fraction[][] = [];
    for (let i = 0; i < 3; i++) {
      const tau = q.div(q.integer(i), two), expected = add(start.world, scale(sub(end.world, start.world), tau));
      const newCoefficient = add(newAffine.a, scale(newAffine.b, q.add(newMap.offset, q.mul(newMap.scale, tau))));
      const oldCoefficient = add(oldAffine.a, scale(oldAffine.b, q.add(oldMap.offset, q.mul(oldMap.scale, tau))));
      requireZero(sub(newCoefficient, expected), 'All Body edge coefficients must equal the complete positive cube edge');
      requireZero(sub(oldCoefficient, expected), 'All old canonical edge coefficients must equal the complete positive cube edge');
      const delta = sub(newCoefficient, oldCoefficient); requireZero(delta, 'Whole edge polynomial correspondence must be exact');
      bodyCartesian.push(text(newCoefficient)); parentCartesian.push(text(oldCoefficient)); residuals.push(text(delta));
    }
    check(fresh.uses.length === 2 && shared.uses.length === 2 && fresh.uses[0].sense !== fresh.uses[1].sense &&
      shared.uses[0].effectiveSense !== shared.uses[1].effectiveSense, 'Both graphs must retain opposite effective Uses for every shared edge');
    const newRoles: Role[] = [], oldRoles: Role[] = [];
    for (const use of fresh.uses) {
      const faceLink = unique(faces.filter(face => face.bodyFaceId === use.faceId), 'Every Body Use must resolve its whole Face correspondence');
      const asset = parent.shell.assets[faceLink.parentAssetIndex], oldUse = unique(shared.uses.filter(value => value.sourceId === asset.sourceId && value.faceId === faceLink.parentFaceId), 'Every Body use must map to one qualified old pair Use');
      check((use.sense === 'forward' ? 1 : -1) * newMap.direction === (oldUse.effectiveSense === 'forward' ? 1 : -1) * oldMap.direction,
        'Actual effective shared-edge traversals must agree after canonical parameter maps');
      check(same(use.interval, use.sense === 'forward' ? fresh.parameterRange : [fresh.parameterRange[1], fresh.parameterRange[0]]) &&
        same(use.vertexIds, use.sense === 'forward' ? fresh.vertexIds : [fresh.vertexIds[1], fresh.vertexIds[0]]), 'Stored Body Use intervals/endpoints must retain actual orientation once');
      const uv = curveAffine(use.pcurve.curve), support = nativeFaceAffines.get(use.faceId)!;
      check(same(uv.domain, newAffine.domain) && uv.a[2].n === 0n && uv.b[2].n === 0n, 'Complete Body pcurve must retain its actual native edge domain');
      const worldA = add(add(support.a, scale(support.b, uv.a[0])), scale(support.c, uv.a[1]));
      const worldB = add(scale(support.b, uv.b[0]), scale(support.c, uv.b[1]));
      requireZero(sub(worldA, newAffine.a), 'Entire Body pcurve/support constant coefficient must equal the shared World curve');
      requireZero(sub(worldB, newAffine.b), 'Entire Body pcurve/support linear coefficient must equal the shared World curve');
      const oldFaceSupport = unique(asset.face.geometry.objects.filter(object => object.kind === 'surface' && object.id === oldUse.surfaceId), 'Old pair Use support must resolve') as Surface;
      const oldSupportAffine = surfaceAffine(oldFaceSupport, true), curve = unique(asset.face.geometry.objects.filter(object => object.kind === 'curve' && object.id === oldUse.curveId), 'Old pair native curve must resolve') as Curve;
      const sourceCurve = curveAffine(curve), pcurve = oldUse.pcurve;
      check(same(pcurve.domain, sourceCurve.domain), 'Old pair pcurve domain must match its actual source Curve');
      const span = q.sub(q.from(pcurve.domain[1]), q.from(pcurve.domain[0]));
      const ub = pcurve.uv1.map((value, i) => q.div(q.sub(q.from(value), q.from(pcurve.uv0[i])), span));
      const ua = pcurve.uv0.map((value, i) => q.sub(q.from(value), q.mul(ub[i], q.from(pcurve.domain[0]))));
      const sourceA = add(add(oldSupportAffine.a, scale(oldSupportAffine.b, ua[0])), scale(oldSupportAffine.c, ua[1]));
      const sourceB = add(scale(oldSupportAffine.b, ub[0]), scale(oldSupportAffine.c, ub[1]));
      requireZero(sub(sourceA, sourceCurve.a), 'Whole original pcurve/support constant coefficient must equal its actual World Curve');
      requireZero(sub(sourceB, sourceCurve.b), 'Whole original pcurve/support linear coefficient must equal its actual World Curve');
      const reversed = oldUse.parameterMap.kind === 'reversed', offset = reversed ? q.add(q.from(sourceCurve.domain[0]), q.from(sourceCurve.domain[1])) : zero;
      requireZero(sub(add(sourceA, scale(sourceB, offset)), oldAffine.a), 'Actual old pair parameter reflection must preserve the whole canonical World constant');
      requireZero(sub(scale(sourceB, reversed ? q.neg(one) : one), oldAffine.b), 'Actual old pair parameter reflection must preserve the whole canonical World derivative');
      newRoles.push(faceLink.role); const oldRole = cubeRoleByParentFace.get(oldUse.faceId); check(oldRole !== undefined, 'All old incident Face roles must resolve'); oldRoles.push(oldRole);
    }
    check(same([...newRoles].sort(), [...oldRoles].sort()), 'Both incident Face roles must match across each physical cube edge');
    check(!parentEdgeToBody.has(old.id), 'A parent edge cannot correspond to multiple Body edges'); parentEdgeToBody.set(old.id, fresh.id);
    edges.push({ bodyEdgeId: fresh.id, bodyCurve: reference, parentPairIndex: old.pairIndex,
      parentPair: { first: { ...parent.shell.pairs[old.pairIndex].first }, second: { ...parent.shell.pairs[old.pairIndex].second } },
      parentCanonicalCurve: parentRef(assetIndex, canonical.id), bodyParameterMap: { domain: newMap.domain, offset: q.text(newMap.offset), scale: q.text(newMap.scale) },
      parentParameterMap: { domain: oldMap.domain, offset: q.text(oldMap.offset), scale: q.text(oldMap.scale) }, degree: 2, bodyCartesian, parentCartesian, residuals,
      wholeImageEqual: true, bodyVertexIds: [start.bodyId, end.bodyId], parentVertexIds: [start.parentId, end.parentId] });
  }
  check(edges.length === 12 && parentEdgeToBody.size === 12 && new Set(edges.map(edge => edge.bodyEdgeId)).size === 12, 'All twelve complete edges must correspond bijectively');
  for (const entry of corners) {
    const oldLink = unique(parent.shell.graph.vertexLinks.filter(link => link.vertexClassId === entry.parentId), 'Each old vertex link must resolve');
    const newLink = unique(body.proof.vertexLinks.filter(link => link.vertexId === entry.bodyId), 'Each qualified Body vertex link must resolve');
    const mapped = oldLink.incidentEdgeIds.map(id => parentEdgeToBody.get(id));
    check(mapped.every(id => id !== undefined) && mapped.length === 3 && newLink.germs.length === 3 &&
      same([...mapped].sort(), newLink.germs.map(germ => germ.edgeId).sort()) && oldLink.cornerArcs.length === 3 && newLink.cornerArcs.length === 3,
      'Mapped vertex links must retain their three actual edge germs and three Face arcs');
  }
  const expectedVolume = jacobian, qualifiedVolume = read(body.volume.total.exactVolumeMM3), residual = q.sub(expectedVolume, qualifiedVolume);
  check(residual.n === 0n && equal(read(material.volume.exactVolumeMM3), expectedVolume) && equal(read(material.volume.recomputedExactVolumeMM3), expectedVolume) &&
    equal(read(body.report.exactVolumeMM3), expectedVolume) && Object.is(body.report.volumeMM3, body.volume.total.volumeMM3) &&
    same(body.report.conversionError, body.volume.total.conversionError) && Object.is(material.volume.volumeMM3, body.report.volumeMM3) &&
    same(material.volume.conversionError, body.report.conversionError) && material.parentFlagsUnchanged && q.counts().floatConversions === 0,
    'All actual material/exact-volume authorities must agree with the whole occupied cube without new float conversion');
  return { schema: 'barocss-rectangular-face-extrusion-material-correspondence', version: 0,
    cube: { domains: { u: [0, 1], t: [0, 1], w: [0, 1] }, formula: 'Phi(u,t,w)=[x0+DX*u,y0+DY*w,D*t]',
      x0: q.text(x0), y0: q.text(y0), dx: q.text(dx), dy: q.text(dy), distance: q.text(distance), jacobianAbsolute: q.text(jacobian),
      strictlyPositive: true, roofV: q.text(rho), supportHeight: q.text(supportHeight), derivedSectionWeight: q.text(sectionWeight) },
    supportDerivation, faces, edges, vertices,
    volume: { expectedExactMM3: q.text(expectedVolume), qualifiedExactMM3: q.text(qualifiedVolume), residual: q.text(residual),
      inheritedVolumeMM3: body.report.volumeMM3, inheritedConversionError: {
        exact: { ...body.report.conversionError.exact }, upper: body.report.conversionError.upper } },
    exactOccupiedRegionEqual: true, parentFlagsUnchanged: true,
    authority: 'existing-qualified-material-plus-exact-entire-cube-skin-correspondence' };
}
