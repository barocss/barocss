import { validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import type { Point } from './types.js';
import { ConvexPlanarSolidMassError, MASS_LIMITS, MassLedger, SectionRationalContext, demand, fields, same, matrix, minors } from './convex-planar-solid-mass-internal.js';
import type { RationalVector, RationalMatrix } from './convex-planar-solid-mass-internal.js';
export { ConvexPlanarSolidMassError, ConvexPlanarSolidMassDiagnosticCode } from './convex-planar-solid-mass-internal.js';

type Vector = [SectionFraction, SectionFraction, SectionFraction];
type Matrix = [Vector, Vector, Vector];
type FloatMatrix = [Point, Point, Point];
type ErrorBound = { exact: SectionFraction; upper: number };
type ErrorVector = [ErrorBound, ErrorBound, ErrorBound];
type ErrorMatrix = [ErrorVector, ErrorVector, ErrorVector];
export interface ConvexPlanarSolidMassOptions { densityKgPerM3: number; maximumFanTriangles: number }
export interface ConvexPlanarSolidMassMeasure {
  solidId: string; volumeMM3: number; massKG: number; centroidMM: Point; inertiaOriginKgM2: FloatMatrix; inertiaCentroidKgM2: FloatMatrix;
  exact: { referenceMM: Vector; volumeMM3: SectionFraction; localFirstMomentsMM4: Vector; localSecondMomentsMM5: Matrix; firstMomentsMM4: Vector; secondMomentsMM5: Matrix; centralSecondMomentsMM5: Matrix; centroidMM: Vector; massKG: SectionFraction; inertiaOriginKgM2: Matrix; inertiaCentroidKgM2: Matrix };
  conversionErrors: { volumeMM3: ErrorBound; massKG: ErrorBound; centroidMM: ErrorVector; inertiaOriginKgM2: ErrorMatrix; inertiaCentroidKgM2: ErrorMatrix };
  positiveDefinite: { exactCentroidLeadingMinors: Vector; storedCentroidLeadingMinors: Vector };
}
export interface ConvexPlanarSolidMassReport {
  schema: 'barocss-convex-planar-solid-mass'; version: 0; solidId: string;
  densityKgPerM3: number; densityExactKgPerM3: SectionFraction;
  units: { density: 'kg/m3'; volume: 'mm3'; centroid: 'mm'; firstMoment: 'mm4'; secondMoment: 'mm5'; mass: 'kg'; inertia: 'kg*m2' };
  unitConversions: { densityKgPerMM3: SectionFraction; inertiaKgM2PerSecondMomentMM5: SectionFraction };
  integration: { reference: 'parent-exact-strict-interior'; faceCount: number; directedUseCount: number; fanTriangles: number; positiveTetrahedra: number; exactParentVolumeAgreement: true };
  directCounts: { parentValidationCount: 1; newGeometryEvaluationCount: 0; finalValueConversions: number; errorBoundConversions: number; retries: 0 };
  parentNativeWork: ConvexPlanarSolidReport['childNativeWork'];
  exactWork: { parent: ConvexPlanarSolidReport['exactWork']; integration: ReturnType<SectionRationalContext['counts']>; contextCount: 2; aggregateOperations: number; aggregateGcdSteps: number; maximumObservedBits: number };
  limits: typeof MASS_LIMITS;
  sourceFrame: 'authored-xyz-no-axis-conversion'; validationScope: 'whole-result-self-consistency-not-authenticity';
  numericPolicy: 'exact-stored-boundary-local-tetrahedral-moments-nearest-even-final-projections';
  snapshotPolicy: 'signed-json-utf8-alias-occurrence-charges-plus-parent-reserve-not-heap-telemetry';
  quality: { exactQualifiedConvexModelMassProperties: true; exactAndStoredCentroidTensorPositiveDefinite: true; parentProofUnchanged: true; densityCertified: false; physicalMaterialCertified: false; curvedSolidPropertiesCertified: false; manufacturingToleranceCertified: false; globalGeometryEvaluationErrorCertified: false; principalAxesCertified: false; historicalRevisionAuthenticityCertified: false; ownership: 'independent-copied-cpu-data-gc' };
}
export interface ConvexPlanarSolidMassResult { solid: ConvexPlanarSolidResult; options: ConvexPlanarSolidMassOptions; measure: ConvexPlanarSolidMassMeasure; report: ConvexPlanarSolidMassReport }

function settings(value: unknown): ConvexPlanarSolidMassOptions {
  const input = fields(value, ['densityKgPerM3', 'maximumFanTriangles']);
  demand(typeof input.densityKgPerM3 === 'number' && Number.isFinite(input.densityKgPerM3) && input.densityKgPerM3 > 0 && input.densityKgPerM3 <= MASS_LIMITS.maximumDensityKgPerM3, 'INPUT', 'Explicit positive finite density at most 1000000 kg/m3 required');
  demand(Number.isInteger(input.maximumFanTriangles) && (input.maximumFanTriangles as number) >= 1 && (input.maximumFanTriangles as number) <= MASS_LIMITS.fanTriangles, 'BUDGET', 'Fan budget integer 1..40 required'); return input as unknown as ConvexPlanarSolidMassOptions;
}
function inventory(value: unknown, maximum: number): { solid: ConvexPlanarSolidResult; fanTriangles: number; uses: number } {
  const input = fields(value, ['request', 'graph', 'supports', 'certificate', 'report']), graph = fields(input.graph, ['vertices', 'edges', 'faces', 'vertexLinks']);
  const array = (value: unknown, min: number, max: number): unknown[] => { demand(Array.isArray(value) && value.length >= min && value.length <= max, 'BUDGET', 'Complete bounded parent inventory required'); return value; };
  const faces = array(graph.faces, 4, MASS_LIMITS.faces); array(graph.vertices, 4, MASS_LIMITS.vertices); array(graph.edges, 6, MASS_LIMITS.edges);
  let uses = 0, fanTriangles = 0;
  for (const face of faces) { const f = fields(face, ['sourceId', 'faceId', 'surfaceId', 'loopId', 'vertexIds', 'edgeIds']), n = array(f.vertexIds, 3, 8).length; demand(array(f.edgeIds, 3, 8).length === n, 'BINDING', 'Complete original directed facet inventory required'); uses += n; fanTriangles += n - 2; }
  const request = fields(input.request, ['assets', 'edgePairs', 'options']);
  demand(array(request.assets, 4, MASS_LIMITS.faces).length === faces.length && array(request.edgePairs, 6, MASS_LIMITS.edges).length * 2 === uses, 'BINDING', 'Parent graph/request inventory mismatch');
  demand(uses <= MASS_LIMITS.directedUses && fanTriangles <= maximum, 'BUDGET', 'Complete facet fan exceeds requested budget before parent work');
  return { solid: input as unknown as ConvexPlanarSolidResult, fanTriangles, uses };
}
function build(solidInput: ConvexPlanarSolidResult, optionsInput: ConvexPlanarSolidMassOptions, ledger: MassLedger): ConvexPlanarSolidMassResult {
  const options = settings(optionsInput), { solid, fanTriangles, uses } = inventory(solidInput, options.maximumFanTriangles);
  let parent: ConvexPlanarSolidReport;
  try { parent = validateConvexPlanarSolid(solid); } catch (cause) { throw new ConvexPlanarSolidMassError('PARENT', 'Complete source-qualified native Solid reconstruction refused', cause); }
  demand(parent.childNativeWork.completeFaceReconstructionCount <= MASS_LIMITS.faceReconstructions && parent.childNativeWork.totalD1Count <= MASS_LIMITS.nativeD1Calls, 'BUDGET', 'Cumulative parent native work exceeds mass profile');
  const q = new SectionRationalContext((code, detail) => { throw new ConvexPlanarSolidMassError(code, detail); }), zero = q.integer(0);
  const fraction = (f: SectionFraction) => q.rat(BigInt(f.numerator), BigInt(f.denominator));
  const vectorText = (v: SectionRational[]) => v.map(value => q.text(value)) as Vector, matrixText = (m: RationalMatrix) => m.map(vectorText) as Matrix;
  const reference = solid.certificate.strictInteriorMM.map(fraction) as RationalVector;
  const points = new Map(solid.graph.vertices.map(vertex => [vertex.id, vertex.pointMM.map((v, i) => q.sub(q.from(v), reference[i])) as RationalVector]));
  let volume = zero, first: RationalVector = [zero, zero, zero], second = matrix(() => zero), integrated = 0;
  const dot = (a: RationalVector, b: RationalVector) => q.sum(a.map((v, i) => q.mul(v, b[i])));
  const cross = (a: RationalVector, b: RationalVector): RationalVector => [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))];
  for (const face of solid.graph.faces) {
    const a = points.get(face.vertexIds[0])!;
    for (let k = 1; k + 1 < face.vertexIds.length; k++) {
      demand(++integrated <= options.maximumFanTriangles, 'BUDGET', 'Cumulative facet fan budget exceeded');
      const b = points.get(face.vertexIds[k])!, c = points.get(face.vertexIds[k + 1])!, determinant = dot(a, cross(b, c));
      demand(determinant.n > 0n, 'BINDING', 'Every original outward facet tetrahedron must have strictly positive signed volume');
      const v = q.div(determinant, q.integer(6)), sum = a.map((x, i) => q.sum([x, b[i], c[i]])) as RationalVector;
      volume = q.add(volume, v);
      first = first.map((x, i) => q.add(x, q.div(q.mul(v, sum[i]), q.integer(4)))) as RationalVector;
      second = matrix((i, j) => q.add(second[i][j], q.div(q.mul(v, q.add(q.mul(sum[i], sum[j]), q.sum([q.mul(a[i], a[j]), q.mul(b[i], b[j]), q.mul(c[i], c[j])]))), q.integer(20))));
    }
  }
  demand(integrated === fanTriangles && q.compare(volume, fraction(solid.certificate.volumeMM3)) === 0 && volume.n > 0n, 'BINDING', 'Exact original boundary integral must equal qualified parent volume');
  const localCentroid = first.map(v => q.div(v, volume)) as RationalVector, centroid = localCentroid.map((v, i) => q.add(v, reference[i])) as RationalVector;
  const central = matrix((i, j) => q.sub(second[i][j], q.div(q.mul(first[i], first[j]), volume)));
  const worldFirst = first.map((v, i) => q.add(v, q.mul(volume, reference[i]))) as RationalVector;
  const worldSecond = matrix((i, j) => q.sum([second[i][j], q.mul(reference[i], first[j]), q.mul(reference[j], first[i]), q.mul(volume, q.mul(reference[i], reference[j]))]));
  const density = q.from(options.densityKgPerM3), massFactor = q.div(density, q.integer(1000000000)), inertiaFactor = q.div(density, q.integer(1000000000000000)), mass = q.mul(volume, massFactor);
  const inertiaOf = (moments: RationalMatrix): RationalMatrix => { const trace = q.sum([moments[0][0], moments[1][1], moments[2][2]]); return matrix((i, j) => q.mul(inertiaFactor, i === j ? q.sub(trace, moments[i][i]) : q.neg(moments[i][j]))); };
  const inertia = inertiaOf(central), centroidNorm2 = dot(centroid, centroid);
  const originInertia = matrix((i, j) => q.add(inertia[i][j], q.mul(q.div(mass, q.integer(1000000)), i === j ? q.sub(centroidNorm2, q.mul(centroid[i], centroid[i])) : q.neg(q.mul(centroid[i], centroid[j])))));
  const rawOriginInertia = inertiaOf(worldSecond);
  demand(originInertia.every((row, i) => row.every((value, j) => q.compare(value, rawOriginInertia[i][j]) === 0)), 'BINDING', 'Exact parallel-axis origin inertia must equal raw-boundary second moments');
  const exactMinors = minors(q, inertia); demand(exactMinors.every(v => v.n > 0n), 'BINDING', 'Exact centroid tensor must be strictly positive definite');
  let conversions = 0;
  const convert = (exact: SectionRational): { value: number; error: ErrorBound } => {
    demand(++conversions <= MASS_LIMITS.finalValueConversions, 'BUDGET', 'Final projection budget exceeded');
    const value = q.nearest(exact); demand(Number.isFinite(value) && (exact.n === 0n || value !== 0), 'REPRESENTABILITY', 'Nonzero final property underflow or overflow refused');
    return { value, error: q.bound(q.abs(q.sub(exact, q.from(value)))) };
  };
  const projectMatrix = (exact: RationalMatrix): { value: FloatMatrix; error: ErrorMatrix } => {
    const value: FloatMatrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], error = [[], [], []] as unknown as ErrorMatrix;
    for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) { const projected = convert(exact[i][j]); value[i][j] = value[j][i] = projected.value; error[i][j] = error[j][i] = projected.error; } return { value, error };
  };
  const projectedVolume = convert(volume), projectedMass = convert(mass), projectedCentroid = centroid.map(convert), projectedInertia = projectMatrix(inertia), projectedOrigin = projectMatrix(originInertia);
  const storedMinors = minors(q, projectedInertia.value.map(row => row.map(v => q.from(v))) as RationalMatrix);
  demand(storedMinors.every(v => v.n > 0n), 'REPRESENTABILITY', 'Stored binary64 centroid tensor must remain strictly positive definite');
  const measure: ConvexPlanarSolidMassMeasure = {
    solidId: parent.solidId, volumeMM3: projectedVolume.value, massKG: projectedMass.value, centroidMM: projectedCentroid.map(v => v.value) as Point, inertiaOriginKgM2: projectedOrigin.value, inertiaCentroidKgM2: projectedInertia.value,
    exact: { referenceMM: vectorText(reference), volumeMM3: q.text(volume), localFirstMomentsMM4: vectorText(first), localSecondMomentsMM5: matrixText(second), firstMomentsMM4: vectorText(worldFirst), secondMomentsMM5: matrixText(worldSecond), centralSecondMomentsMM5: matrixText(central), centroidMM: vectorText(centroid), massKG: q.text(mass), inertiaOriginKgM2: matrixText(originInertia), inertiaCentroidKgM2: matrixText(inertia) },
    conversionErrors: { volumeMM3: projectedVolume.error, massKG: projectedMass.error, centroidMM: projectedCentroid.map(v => v.error) as ErrorVector, inertiaOriginKgM2: projectedOrigin.error, inertiaCentroidKgM2: projectedInertia.error },
    positiveDefinite: { exactCentroidLeadingMinors: vectorText(exactMinors), storedCentroidLeadingMinors: vectorText(storedMinors) },
  };
  const densityExact = q.text(density), densityKgPerMM3 = q.text(massFactor), inertiaKgM2PerSecondMomentMM5 = q.text(inertiaFactor), counts = q.counts();
  demand(counts.floatSearchSteps <= MASS_LIMITS.floatSearchSteps && counts.operations + parent.exactWork.operations <= MASS_LIMITS.aggregateRationalOperations && counts.gcdSteps + parent.exactWork.gcdSteps <= MASS_LIMITS.aggregateGcdSteps, 'BUDGET', 'Aggregate parent/integration exact work exceeded');
  const report: ConvexPlanarSolidMassReport = {
    schema: 'barocss-convex-planar-solid-mass', version: 0, solidId: parent.solidId, densityKgPerM3: options.densityKgPerM3, densityExactKgPerM3: densityExact,
    units: { density: 'kg/m3', volume: 'mm3', centroid: 'mm', firstMoment: 'mm4', secondMoment: 'mm5', mass: 'kg', inertia: 'kg*m2' }, unitConversions: { densityKgPerMM3, inertiaKgM2PerSecondMomentMM5 },
    integration: { reference: 'parent-exact-strict-interior', faceCount: solid.graph.faces.length, directedUseCount: uses, fanTriangles: integrated, positiveTetrahedra: integrated, exactParentVolumeAgreement: true },
    directCounts: { parentValidationCount: 1, newGeometryEvaluationCount: 0, finalValueConversions: conversions, errorBoundConversions: conversions, retries: 0 }, parentNativeWork: parent.childNativeWork,
    exactWork: { parent: parent.exactWork, integration: counts, contextCount: 2, aggregateOperations: counts.operations + parent.exactWork.operations, aggregateGcdSteps: counts.gcdSteps + parent.exactWork.gcdSteps, maximumObservedBits: Math.max(counts.maximumObservedBits, parent.exactWork.maximumObservedBits) },
    limits: MASS_LIMITS, sourceFrame: 'authored-xyz-no-axis-conversion', validationScope: 'whole-result-self-consistency-not-authenticity', numericPolicy: 'exact-stored-boundary-local-tetrahedral-moments-nearest-even-final-projections', snapshotPolicy: 'signed-json-utf8-alias-occurrence-charges-plus-parent-reserve-not-heap-telemetry',
    quality: { exactQualifiedConvexModelMassProperties: true, exactAndStoredCentroidTensorPositiveDefinite: true, parentProofUnchanged: true, densityCertified: false, physicalMaterialCertified: false, curvedSolidPropertiesCertified: false, manufacturingToleranceCertified: false, globalGeometryEvaluationErrorCertified: false, principalAxesCertified: false, historicalRevisionAuthenticityCertified: false, ownership: 'independent-copied-cpu-data-gc' },
  };
  return ledger.copy({ solid, options, measure, report });
}
/** Exact rational moments of one complete qualified convex planar boundary and declared uniform density. */
export function measureConvexPlanarSolidMass(solid: ConvexPlanarSolidResult, options: ConvexPlanarSolidMassOptions): ConvexPlanarSolidMassResult {
  const ledger = new MassLedger(), input = ledger.copy({ solid, options }); return build(input.solid, input.options, ledger);
}
/** Rebuild once with one parent validation; report and complete retained authority must match bit-for-bit. */
export function validateConvexPlanarSolidMass(input: ConvexPlanarSolidMassResult): ConvexPlanarSolidMassReport {
  const ledger = new MassLedger(), owned = fields(ledger.copy(input), ['solid', 'options', 'measure', 'report']) as unknown as ConvexPlanarSolidMassResult;
  const rebuilt = build(owned.solid, owned.options, ledger);
  demand(same(owned, rebuilt), 'OWNED', 'Complete retained source, moments, projections or work report differs from reconstruction'); return ledger.copy(rebuilt.report);
}
