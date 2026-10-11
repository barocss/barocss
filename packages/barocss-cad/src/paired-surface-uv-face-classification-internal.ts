import type { PairedSurfaceUVSplitFacesResult } from './paired-surface-uv-split-faces.js';
import type { PairedSurfaceBUVSplitFacesResult } from './paired-surface-b-uv-split-faces.js';
import type { PairedSurfaceUVFaceQuery } from './paired-surface-uv-face-classification.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from './section-rational-internal.js';

type F = SectionFraction;
type R = SectionRational;
type Asset = 0 | 1;
type Sense = 'forward' | 'reverse';
type Material = 'inside' | 'outside' | 'boundary';
type Relation = 'below' | 'on' | 'above' | 'not-applicable';
type Boundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
type Sign = -1 | 0 | 1;
type FaceClassification = { sourceId: string; surfaceId: string; faceId: string;
  region: 'below-cut' | 'above-cut'; orientation: Sense; classification: Material };
type Classification = { queryId: string; assetIndex: Asset;
  window: 'outside' | 'interior' | 'boundary'; windowBoundaries: Boundary[];
  cutRelation: Relation; faces: [FaceClassification, FaceClassification] };
type SourceRef = { assetIndex: Asset; sourceId: string; surfaceId: string; modelName: string; objectIndex: number;
  sourceField: 'request.a.request.section.request.assets[0].source' | 'request.b.request.section.request.assets[1].source';
  modelField: 'request.a.request.section.originalModels[0]' | 'request.b.request.section.originalModels[1]' };
type Support = { reference: SourceRef; parentEvaluationId: string;
  window: { u: [number, number]; v: [number, number] }; faceIds: [string, string]; orientations: [Sense, Sense];
  sharedCutEdgeId: string; worldCurveId: string; pcurveId: string;
  originalUAInterval: [number, number]; uMap: { offset: F; scale: F }; vCoefficients: F[] };
type QueryProof = { queryId: string; assetIndex: Asset; queryUV: [F, F];
  method: 'outside-window' | 'natural-v-boundary' | 'exact-affine-quartic';
  boundSigns: { uMinimum: Sign; uMaximum: Sign; vMinimum: Sign; vMaximum: Sign };
  originalUA: F | null; normalizedParameter: F | null; deCasteljau: F[][];
  cutValue: F | null; vMinusCut: F | null; cutSign: Sign | null; classification: Classification };
type Proof = { schema: 'barocss-paired-surface-uv-face-classification-proof'; version: 0;
  supports: [Support, Support]; sameCompletePairedParent: true; unchangedSharedWorldCurve: true;
  preservedOriginalParameterFrames: true; queries: QueryProof[];
  authority: 'exact-stored-affine-u-quartic-v-on-certified-original-uv-face-windows' };
type DirectCounts = { parentValidationCount: number; queryCount: number;
  affineInversionCount: number; quarticEvaluationCount: number; signComparisonCount: number;
  curveD0Count: 0; curveD1Count: 0; surfaceD0Count: 0; surfaceD1Count: 0;
  sourceCompilationCount: 0; rationalFloatConversionCount: 0 };
type Callbacks = {
  beginQuery(assetIndex: Asset, queryIndex: number): void;
  retainQuery(classification: Classification, proof: QueryProof): void;
  fail(code: 'BINDING' | 'DOMAIN', detail: string, cause?: unknown): never;
};
export type PairedUVFaceQueryProof = QueryProof;
export type PairedUVFaceSupport = Support;
export type PairedUVFaceProof = Proof;
export type PairedUVFaceClassification = Classification;
export type PairedUVFaceDirectCounts = DirectCounts;

/** Trusted exact predicates after public full-parent admission; no native/provider calls. */
export function classifyPairedSurfaceUVQueriesTrusted(
  a: PairedSurfaceUVSplitFacesResult, b: PairedSurfaceBUVSplitFacesResult,
  queries: PairedSurfaceUVFaceQuery[], q: SectionRationalContext, counts: DirectCounts, callbacks: Callbacks,
): { supports: [Support, Support]; classifications: Classification[]; queries: QueryProof[] } {
  const check = (condition: boolean, detail: string): void => {
    if (!condition) callbacks.fail('BINDING', detail);
  };
  const same = (left: unknown, right: unknown): boolean => {
    if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((value, i) => same(value, right[i]));
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      const x = left as Record<string, unknown>, y = right as Record<string, unknown>;
      return Object.keys(x).length === Object.keys(y).length &&
        Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
    }
    return Object.is(left, right);
  };
  // Every root sign comparison, including support admission, charges its actual q.compare call.
  const compare = (left: R, right: R): Sign => {
    counts.signComparisonCount++;
    return q.compare(left, right) as Sign;
  };
  const read = (value: F): R => q.rat(BigInt(value.numerator), BigInt(value.denominator));
  const zero = q.integer(0), one = q.integer(1);
  check(same(a.request.section, b.request.section), 'Both complete original paired-section parents must be bit-identical');
  const section = a.request.section;
  const originalUAInterval = section.request.uAInterval;
  const mapOffset = read(section.proof.originalUB.offset), mapScale = read(section.proof.originalUB.scale);
  check(compare(mapScale, zero) > 0, 'Actual B affine map must keep its certified positive originalUB scale');
  check(same(b.proof.parameterMap.originalUAInterval, originalUAInterval) &&
    compare(read(b.proof.parameterMap.offset), mapOffset) === 0 &&
    compare(read(b.proof.parameterMap.scale), mapScale) === 0 &&
    same(b.proof.parameterMap.originalUBInterval, b.proof.window.u),
  'B native-window/unchanged-UA parameter certificate must bind the actual paired map');
  const parents = [a, b] as const;
  const supports = ([0, 1] as const).map((assetIndex): Support => {
    const parent = parents[assetIndex], asset = section.request.assets[assetIndex];
    const model = section.originalModels[assetIndex], selection = section.report.selections[assetIndex];
    const cut = parent.edges[6], proof = parent.proof, parentSupport = proof.support;
    const uv = assetIndex === 0 ? section.pcurves.a : section.pcurves.b;
    const offset = assetIndex === 0 ? zero : mapOffset, scale = assetIndex === 0 ? one : mapScale;
    const window = proof.window;
    check(parent.edges.length === 7 && cut.role === 'sharedCut' &&
      cut.id === parent.report.sharedCutEdgeId && same(cut.curve, section.world.curve) &&
      same(cut.pcurve.curve, uv.curve) && cut.curve.id === parent.report.sharedWorldCurveId &&
      cut.pcurve.curve.id === parent.report.sharedPcurveId && proof.cut.worldCurveId === cut.curve.id &&
      proof.cut.pcurveId === cut.pcurve.curve.id && proof.cut.parentEvaluationId === section.request.options.evaluationId,
    'Actual shared World/original-UV cut and parent authority must remain unchanged');
    check(parentSupport.sourceId === asset.sourceId && parentSupport.surfaceId === asset.surface.id &&
      parentSupport.modelName === model.name && parentSupport.objectIndex === selection.objectIndex &&
      selection.assetIndex === assetIndex && selection.sourceId === asset.sourceId &&
      selection.surfaceId === asset.surface.id && selection.modelName === model.name &&
      same(model.objects[selection.objectIndex], asset.surface) &&
      parentSupport.sourceField === `request.section.request.assets[${assetIndex}].source` &&
      parentSupport.modelField === `request.section.originalModels[${assetIndex}]` &&
      same(parent.report.support, parentSupport) && same(parent.report.window, window) &&
      same(window.v, selection.nativeDomains.v),
    'Actual original source/Model object selection and original Face-window frame must bind by asset');
    check(parent.world.model.objects.length === 8 && same(parent.world.model.objects[0], asset.surface) &&
      cut.sourceRef.sourceField === 'world.source' && cut.sourceRef.modelField === 'world.model' &&
      cut.sourceRef.modelName === parent.world.model.name && cut.sourceRef.objectIndex === 7 &&
      cut.sourceRef.curveId === cut.curve.id && same(parent.world.model.objects[7], cut.curve),
    'Actual retained WorldModel8 cut/source-qualified reference must resolve');
    check(parent.faces.length === 2 && parent.loops.length === 2 &&
      parent.faces[0].region === 'below-cut' && parent.faces[1].region === 'above-cut' &&
      parent.faces[0].id !== parent.faces[1].id && parent.proof.faceCertificates.length === 2 &&
      parent.faces.every((face, i) => face.sourceId === asset.sourceId && face.surfaceId === asset.surface.id &&
        face.outerLoopId === parent.loops[i].id && proof.faceCertificates[i].faceId === face.id &&
        proof.faceCertificates[i].loopId === face.outerLoopId && proof.faceCertificates[i].region === face.region &&
        proof.faceCertificates[i].orientation === face.orientation && proof.faceCertificates[i].closedDiskCertified &&
        proof.faceCertificates[i].exactWorldSurfaceAgreement),
    'Both real complementary Face references and disk certificates must bind unchanged');
    const curve = uv.curve;
    check(curve.degree === 4 && curve.controlPoints.length === 5 && curve.knots.length === 10 &&
      same([curve.knots[4], curve.knots[5]], originalUAInterval) &&
      curve.weights.every(weight => Object.is(weight, 1)) && proof.cut.degree === 4 &&
      proof.cut.uCoefficients.length === 5 && proof.cut.vCoefficients.length === 5 &&
      proof.cut.lowerGaps.length === 5 && proof.cut.upperGaps.length === 5,
    'Actual originalUV cut must retain its common degree4 native UA basis and full coefficient certificate');
    const uaWidth = q.sub(q.from(originalUAInterval[1]), q.from(originalUAInterval[0]));
    check(compare(uaWidth, zero) > 0 && compare(q.from(window.u[1]), q.from(window.u[0])) > 0 &&
      compare(q.from(window.v[1]), q.from(window.v[0])) > 0,
    'Certified original windows must remain ordered and nonzero');
    for (let i = 0; i < 5; i++) {
      const actualU = q.from(curve.controlPoints[i][0]), actualV = q.from(curve.controlPoints[i][1]);
      const uaCoefficient = q.add(q.from(originalUAInterval[0]), q.mul(uaWidth, q.div(q.integer(i), q.integer(4))));
      check(compare(actualU, q.add(offset, q.mul(scale, uaCoefficient))) === 0 &&
        compare(actualU, read(proof.cut.uCoefficients[i])) === 0 &&
        compare(actualV, read(proof.cut.vCoefficients[i])) === 0 &&
        compare(q.from(curve.controlPoints[i][2]), zero) === 0,
      'Actual stored originalUV coefficients must bind the exact affine frame and cut proof');
      const lowerGap = q.sub(actualV, q.from(window.v[0])), upperGap = q.sub(q.from(window.v[1]), actualV);
      check(compare(lowerGap, zero) > 0 && compare(upperGap, zero) > 0 &&
        compare(lowerGap, read(proof.cut.lowerGaps[i])) === 0 &&
        compare(upperGap, read(proof.cut.upperGaps[i])) === 0,
      'Strict actual V-cut hull gaps and their inherited certificates are required for natural-boundary shortcut');
    }
    for (let i = 0; i < 2; i++) check(compare(q.from(window.u[i]),
      q.add(offset, q.mul(scale, q.from(originalUAInterval[i])))) === 0,
    'Actual A/B selected native-U window must agree with its inherited affine endpoint map');
    return {
      reference: { assetIndex, sourceId: asset.sourceId, surfaceId: asset.surface.id,
        modelName: model.name, objectIndex: selection.objectIndex,
        sourceField: assetIndex === 0 ? 'request.a.request.section.request.assets[0].source' :
          'request.b.request.section.request.assets[1].source',
        modelField: assetIndex === 0 ? 'request.a.request.section.originalModels[0]' :
          'request.b.request.section.originalModels[1]' },
      parentEvaluationId: parent.report.evaluationId,
      window: { u: [...window.u], v: [...window.v] },
      faceIds: [parent.faces[0].id, parent.faces[1].id],
      orientations: [parent.faces[0].orientation, parent.faces[1].orientation],
      sharedCutEdgeId: cut.id, worldCurveId: cut.curve.id, pcurveId: curve.id,
      originalUAInterval: [...originalUAInterval], uMap: { offset: q.text(offset), scale: q.text(scale) },
      vCoefficients: curve.controlPoints.map(point => q.text(q.from(point[1]))),
    };
  }) as [Support, Support];

  const classifications: Classification[] = [], queryProofs: QueryProof[] = [];
  for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
    const query = queries[queryIndex], assetIndex = query.assetIndex, support = supports[assetIndex];
    callbacks.beginQuery(assetIndex, queryIndex);
    counts.queryCount++;
    const u = q.from(query.u), v = q.from(query.v);
    const boundSigns = {
      uMinimum: compare(u, q.from(support.window.u[0])), uMaximum: compare(u, q.from(support.window.u[1])),
      vMinimum: compare(v, q.from(support.window.v[0])), vMaximum: compare(v, q.from(support.window.v[1])),
    };
    const outside = boundSigns.uMinimum < 0 || boundSigns.uMaximum > 0 ||
      boundSigns.vMinimum < 0 || boundSigns.vMaximum > 0;
    const boundaries: Boundary[] = [];
    if (!outside) {
      if (boundSigns.uMinimum === 0) boundaries.push('u-min');
      if (boundSigns.uMaximum === 0) boundaries.push('u-max');
      if (boundSigns.vMinimum === 0) boundaries.push('v-min');
      if (boundSigns.vMaximum === 0) boundaries.push('v-max');
    }
    let method: QueryProof['method'] = 'outside-window', relation: Relation = 'not-applicable';
    let originalUA: R | null = null, normalized: R | null = null;
    let cutValue: R | null = null, vMinusCut: R | null = null, cutSign: Sign | null = null;
    const deCasteljau: F[][] = [];
    if (!outside && (boundSigns.vMinimum === 0 || boundSigns.vMaximum === 0)) {
      method = 'natural-v-boundary'; relation = boundSigns.vMinimum === 0 ? 'below' : 'above';
    } else if (!outside) {
      method = 'exact-affine-quartic';
      if (assetIndex === 1) {
        counts.affineInversionCount++;
        originalUA = q.div(q.sub(u, read(support.uMap.offset)), read(support.uMap.scale));
      } else originalUA = u;
      normalized = q.div(q.sub(originalUA, q.from(support.originalUAInterval[0])),
        q.sub(q.from(support.originalUAInterval[1]), q.from(support.originalUAInterval[0])));
      counts.quarticEvaluationCount++;
      let coefficients = support.vCoefficients.map(read);
      deCasteljau.push(coefficients.map(value => q.text(value)));
      const complement = q.sub(one, normalized);
      while (coefficients.length > 1) {
        coefficients = coefficients.slice(0, -1).map((value, i) =>
          q.add(q.mul(complement, value), q.mul(normalized!, coefficients[i + 1])));
        deCasteljau.push(coefficients.map(value => q.text(value)));
      }
      cutValue = coefficients[0]; vMinusCut = q.sub(v, cutValue); cutSign = compare(vMinusCut, zero);
      relation = cutSign < 0 ? 'below' : cutSign > 0 ? 'above' : 'on';
    }
    const selectedBoundary = boundaries.length > 0;
    const faces = ([0, 1] as const).map((faceIndex): FaceClassification => {
      let classification: Material = 'outside';
      if (relation === 'on') classification = 'boundary';
      else if (relation === (faceIndex === 0 ? 'below' : 'above'))
        classification = selectedBoundary ? 'boundary' : 'inside';
      return { sourceId: support.reference.sourceId, surfaceId: support.reference.surfaceId,
        faceId: support.faceIds[faceIndex], region: faceIndex === 0 ? 'below-cut' : 'above-cut',
        orientation: support.orientations[faceIndex], classification };
    }) as [FaceClassification, FaceClassification];
    const classification: Classification = { queryId: query.queryId, assetIndex,
      window: outside ? 'outside' : boundaries.length ? 'boundary' : 'interior',
      windowBoundaries: boundaries, cutRelation: relation, faces };
    const proof: QueryProof = { queryId: query.queryId, assetIndex, queryUV: [q.text(u), q.text(v)], method,
      boundSigns, originalUA: originalUA === null ? null : q.text(originalUA),
      normalizedParameter: normalized === null ? null : q.text(normalized), deCasteljau,
      cutValue: cutValue === null ? null : q.text(cutValue), vMinusCut: vMinusCut === null ? null : q.text(vMinusCut),
      cutSign, classification };
    classifications.push(classification); queryProofs.push(proof);
    callbacks.retainQuery(classification, proof);
  }
  return { supports, classifications, queries: queryProofs };
}
