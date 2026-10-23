import type { PairedRoofDifferenceBodyResult } from './paired-roof-difference-body.js';
import type { PairedRoofDifferenceBodyWorldPointQuery } from './paired-roof-difference-body-world-points.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';

type F = SectionFraction;
type R = SectionRational;
type FaceRole = 'roof' | 'floor' | 'band' | 'yMin' | 'xMin' | 'xMax';
type Sign = -1 | 0 | 1;
type Stage = 'x' | 'y' | 'z';
type BodySourceRef = PairedRoofDifferenceBodyResult['faces'][number]['supportRef'];
type ParentRef = { parentField: 'request.body'; reference: BodySourceRef };
type BoundaryFace = { parentField: 'request.body'; role: FaceRole; faceId: string; supportRef: BodySourceRef };
type Classification = { queryId: string; status: 'inside' | 'outside' | 'boundary';
  bodyId: string; materialCertificateId: string; boundaryFaces: BoundaryFace[] };
type Constraint = { role: FaceRole; difference: F; sign: Sign };
type QueryProof = { queryId: string; pointExact: [F, F, F];
  decision: 'outside-x' | 'outside-y' | 'outside-z' | 'inside' | 'boundary';
  x: [Constraint, Constraint]; originalUB: F | null; yRoof: F | null; y: [Constraint, Constraint] | null;
  zLower: F | null; zUpper: F | null; z: [Constraint, Constraint] | null; classification: Classification };
type SourceDefinition = { bodyId: string; shellId: string; materialCertificateId: string;
  originalUAInterval: [number, number]; originalUBOffset: F; originalUBScale: F; lowY: F;
  bYOriginalUBPower: F[]; lowerAZOriginalUAVAPower: F[][]; upperAZOriginalUAVAPower: F[][]; sourceRefs: ParentRef[];
  faceRefs: [BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace, BoundaryFace];
  unitAxisSourceAuthority: true; wholeMaterialParentUnchanged: true };
type Proof = { schema: 'barocss-paired-roof-difference-body-world-points-proof'; version: 0;
  source: SourceDefinition; queries: QueryProof[];
  authority: 'exact-source-defined-unit-axis-paired-roof-difference-region' };
type DirectCounts = { bodyValidationCount: number; queryCount: number; yRoofEvaluationCount: number;
  zLowerEvaluationCount: number; zUpperEvaluationCount: number; querySignComparisonCount: number; bindingSignComparisonCount: number; curveD0Count: 0; curveD1Count: 0;
  surfaceD0Count: 0; surfaceD1Count: 0; sourceCompilationCount: 0; rootSolveCount: 0; rationalFloatConversionCount: 0 };
type Callbacks = { beginQuery(queryIndex: number): void; beginStage(stage: Stage): void;
  retainQuery(classification: Classification, proof: QueryProof): void;
  fail(code: 'BINDING' | 'DOMAIN', detail: string, cause?: unknown): never };
export type PairedRoofDifferenceWorldSource = SourceDefinition;
export type PairedRoofDifferenceWorldClassification = Classification;
export type PairedRoofDifferenceWorldQueryProof = QueryProof;
export type PairedRoofDifferenceWorldProof = Proof;
export type PairedRoofDifferenceWorldDirectCounts = DirectCounts;

/** Exact World predicates on one publicly validated complete material Body. */
export function classifyPairedRoofDifferenceBodyWorldQueriesTrusted(
  body: PairedRoofDifferenceBodyResult, queries: PairedRoofDifferenceBodyWorldPointQuery[],
  q: SectionRationalContext, counts: DirectCounts, callbacks: Callbacks,
): { source: SourceDefinition; classifications: Classification[]; queries: QueryProof[] } {
  const check = (condition: boolean, detail: string): void => { if (!condition) callbacks.fail('BINDING', detail); };
  const same = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((value, i) => same(value, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
      return Object.keys(x).length === Object.keys(y).length &&
        Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
    }
    return Object.is(a, b);
  };
  const compare = (a: R, b: R): Sign => { counts.bindingSignComparisonCount++; return q.compare(a, b) as Sign; };
  const fractionCache = new Map<string, R>();
  const read = (f: F): R => {
    check(f.numerator.length <= 5000 && f.denominator.length <= 5000 &&
      /^-?(0|[1-9][0-9]*)$/.test(f.numerator) && /^[1-9][0-9]*$/.test(f.denominator),
    'Bounded canonical rational source coefficients required');
    const key = f.numerator + '/' + f.denominator;
    let result = fractionCache.get(key);
    if (result === undefined) { result = q.rat(BigInt(f.numerator), BigInt(f.denominator)); fractionCache.set(key, result); }
    return result;
  };
  const zero = q.integer(0), one = q.integer(1);
  const material = body.proof.material, profile = material.profile;
  const lower = body.request.lower, upper = body.request.upper;
  const paired = lower.request.a.request.section, upperPaired = upper.request.a.request.section;
  check(same(paired, lower.request.b.request.section) && same(upperPaired, upper.request.b.request.section) && material.bodyId === body.body.id &&
    material.shellId === body.shell.id && material.certificateId === body.body.materialCertificateId &&
    body.body.closed && body.body.solid && body.body.restrictedSolidCertified &&
    material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage && material.outwardMaterial &&
    material.embeddedClosedBoundary && material.restrictedSolidCertified && material.parentFlagsUnchanged &&
    material.cubeMap.globallyInjective && profile.lowerAXIdentity && profile.lowerAYIdentity && profile.upperAXIdentity && profile.upperAYIdentity &&
    profile.commonOriginalB && profile.commonFootprint && profile.bXShiftIdentity &&
    profile.bZIdentity && profile.unitPositiveAxes && profile.constantPositiveWeights,
  'Actual full material Body/source-defined certificate and unit-axis authority required');
  check(same(paired.request.assets[1], upperPaired.request.assets[1]) &&
    same(paired.originalModels[1], upperPaired.originalModels[1]) &&
    same(paired.request.uAInterval, upperPaired.request.uAInterval) &&
    same(paired.proof.originalUB, upperPaired.proof.originalUB) &&
    same(paired.report.selections[0].nativeDomains, upperPaired.report.selections[0].nativeDomains),
  'Both complete operands must bind the same original B, original footprint and UB map');
  const offset = read(profile.originalUBOffset), ubScale = read(profile.originalUBScale);
  check(compare(ubScale, one) === 0 && compare(read(paired.proof.originalUB.scale), one) === 0 &&
    compare(offset, read(paired.proof.originalUB.offset)) === 0,
  'Original UB map must retain the actual certified unit scale and offset');
  for (const [operandIndex, section] of [paired, upperPaired].entries()) {
    const aProfile = section.proof.profiles[0], bProfile = section.proof.profiles[1];
    check(compare(read(aProfile.xU[0]), zero) === 0 && compare(read(aProfile.xU[1]), one) === 0 &&
      aProfile.xU.slice(2).every(f => compare(read(f), zero) === 0) &&
      aProfile.yU.every(f => compare(read(f), zero) === 0) && compare(read(aProfile.yV[0]), zero) === 0 &&
      compare(read(aProfile.yV[1]), one) === 0 && compare(read(bProfile.xU[0]), q.neg(offset)) === 0 &&
      compare(read(bProfile.xU[1]), one) === 0 && bProfile.xU.slice(2).every(f => compare(read(f), zero) === 0) &&
      bProfile.yV.every(f => compare(read(f), zero) === 0) && compare(read(bProfile.zUV[0][0]), zero) === 0 &&
      compare(read(bProfile.zUV[0][1]), one) === 0 &&
      bProfile.zUV.slice(1).every(row => row.every(f => compare(read(f), zero) === 0)),
    'Both original UA/VA roof profiles and original UB/VB band profile must prove physical unit axes');
    const zPower = operandIndex === 0 ? profile.lowerAZPower : profile.upperAZPower;
    check(profile.bYPower.length >= 1 && profile.bYPower.length <= 3 && zPower.length >= 1 && zPower.length <= 3 &&
      profile.bYPower.length === bProfile.yU.length && zPower.length === aProfile.zUV.length &&
      profile.bYPower.every((f, i) => compare(read(f), read(bProfile.yU[i])) === 0) &&
      zPower.every((row, i) => row.length === 2 && row.every((f, j) => compare(read(f), read(aProfile.zUV[i][j])) === 0)),
    'Original native-coordinate source coefficients and bounded degrees must match each retained roof');
    for (const index of [0, 1] as const) {
      const asset = section.request.assets[index], model = section.originalModels[index], selection = section.report.selections[index];
      const sourceProfile = section.proof.profiles[index], surface = asset.surface;
      check(selection.assetIndex === index && selection.sourceId === asset.sourceId && selection.surfaceId === surface.id &&
        selection.modelName === model.name && same(model.objects[selection.objectIndex], surface) &&
        same(sourceProfile.domain, selection.nativeDomains) && sourceProfile.degreeU === surface.degreeU &&
        sourceProfile.degreeV === surface.degreeV && sourceProfile.originalCartesian.length === surface.controlPoints.length,
      'Actual original Surface selection/profile/whole Model context must bind');
      const weight = surface.weights[0][0];
      check(weight > 0 && surface.weights.every(row => row.every(value => Object.is(value, weight))) &&
        compare(read(sourceProfile.uniformWeight), q.from(weight)) === 0 &&
        surface.controlPoints.every((row, i) => row.length === sourceProfile.originalCartesian[i].length &&
          row.every((point, j) => point.every((value, axis) => compare(q.from(value), read(sourceProfile.originalCartesian[i][j][axis])) === 0))),
      'Whole selected control grid and positive constant weights must match inherited source polynomials');
    }
  }
  const window = material.cubeMap.domain.u, lowY = read(material.cubeMap.lowY);
  check(same(window, paired.request.uAInterval) && same(material.cubeMap.domain.s, [0, 1]) &&
    same(material.cubeMap.domain.t, [0, 1]) && compare(q.from(window[1]), q.from(window[0])) > 0 &&
    compare(lowY, q.from(paired.report.selections[0].nativeDomains.v[0])) === 0 &&
    compare(lowY, read(lower.proof.material.cubeMap.lowY)) === 0 &&
    compare(lowY, read(upper.proof.material.cubeMap.lowY)) === 0 &&
    compare(read(material.cubeMap.minimumHeightY), zero) > 0 &&
    compare(read(material.cubeMap.minimumGap), zero) > 0 && compare(read(material.cubeMap.minimumJacobian), zero) > 0,
  'Actual occupied window, low Y and strict positive variable-floor material authority required');
  const resolve = (ref: BodySourceRef): unknown => {
    let value: unknown = body;
    for (const part of ref.modelField.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? []) {
      check(value !== null && typeof value === 'object' && Object.hasOwn(value, part), 'Actual parent Model reference path must resolve');
      value = (value as Record<string, unknown>)[part];
    }
    const model = value as { name: string; objects: { id: string }[] };
    check(model.name === ref.modelName && Number.isInteger(ref.objectIndex) && ref.objectIndex >= 0 &&
      ref.objectIndex < model.objects.length && model.objects[ref.objectIndex].id === ref.objectId,
    'Actual source-qualified Model/name/object selector must bind');
    let source: unknown = body;
    for (const part of ref.sourceField.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? []) {
      check(source !== null && typeof source === 'object' && Object.hasOwn(source, part), 'Actual parent source reference path must resolve');
      source = (source as Record<string, unknown>)[part];
    }
    check(typeof source === 'string', 'Actual retained native source string required');
    return model.objects[ref.objectIndex];
  };
  const roles: FaceRole[] = ['roof', 'floor', 'band', 'yMin', 'xMin', 'xMax'];
  check(body.faces.length === 6 && material.faceImages.length === 6 && same(material.faceIds, body.faces.map(f => f.id)) &&
    same(body.shell.faceIds, body.faces.map(f => f.id)), 'Actual six Face/Shell/material identities must bind');
  const faceRefs = roles.map((role, i): BoundaryFace => {
    const face = body.faces[i], image = material.faceImages[i];
    check(face.role === role && image.role === role && image.faceId === face.id && image.wholeImageEqual &&
      image.storedLocalUsesUnchanged && same(image.supportRef, face.supportRef) &&
      same(image.originalSupport, face.support) && same(resolve(face.supportRef), face.support),
    'Every actual boundary role/Face/whole source image must resolve without guessing IDs');
    return { parentField: 'request.body', role, faceId: face.id, supportRef: { ...face.supportRef } };
  }) as SourceDefinition['faceRefs'];
  const sourceRefs = material.sourceRefs.map((reference): ParentRef => {
    resolve(reference); return { parentField: 'request.body', reference: { ...reference } };
  });
  const source: SourceDefinition = { bodyId: body.body.id, shellId: body.shell.id,
    materialCertificateId: material.certificateId, originalUAInterval: [...window],
    originalUBOffset: q.text(offset), originalUBScale: q.text(ubScale), lowY: q.text(lowY),
    bYOriginalUBPower: profile.bYPower.map(f => ({ ...f })),
    lowerAZOriginalUAVAPower: profile.lowerAZPower.map(row => row.map(f => ({ ...f }))),
    upperAZOriginalUAVAPower: profile.upperAZPower.map(row => row.map(f => ({ ...f }))), sourceRefs, faceRefs,
    unitAxisSourceAuthority: true, wholeMaterialParentUnchanged: true };
  const yCoefficients = profile.bYPower.map(read), lowerCoefficients = profile.lowerAZPower.map(row => row.map(read)),
    upperCoefficients = profile.upperAZPower.map(row => row.map(read));
  const horner = (values: R[], argument: R): R => {
    let result = zero;
    for (let i = values.length - 1; i >= 0; i--) result = q.add(q.mul(result, argument), values[i]);
    return result;
  };
  const constraint = (role: FaceRole, difference: R): Constraint => {
    counts.querySignComparisonCount++;
    return { role, difference: q.text(difference), sign: q.compare(difference, zero) as Sign };
  };
  const classifications: Classification[] = [], queryProofs: QueryProof[] = [];
  for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
    const query = queries[queryIndex]; callbacks.beginQuery(queryIndex); counts.queryCount++;
    callbacks.beginStage('x');
    const [x, y, z] = query.pointMM.map(value => q.from(value));
    const xConstraints: [Constraint, Constraint] = [constraint('xMin', q.sub(x, q.from(window[0]))),
      constraint('xMax', q.sub(q.from(window[1]), x))];
    let originalUB: R | null = null, yRoof: R | null = null, zLower: R | null = null, zUpper: R | null = null;
    let yConstraints: [Constraint, Constraint] | null = null, zConstraints: [Constraint, Constraint] | null = null;
    let decision: QueryProof['decision'] = 'outside-x';
    if (xConstraints.every(c => c.sign >= 0)) {
      callbacks.beginStage('y'); originalUB = q.add(x, offset); counts.yRoofEvaluationCount++;
      yRoof = horner(yCoefficients, originalUB);
      yConstraints = [constraint('yMin', q.sub(y, lowY)), constraint('band', q.sub(yRoof, y))];
      decision = 'outside-y';
      if (yConstraints.every(c => c.sign >= 0)) {
        callbacks.beginStage('z'); counts.zLowerEvaluationCount++;
        zLower = horner(lowerCoefficients.map(row => horner(row, y)), x);
        counts.zUpperEvaluationCount++;
        zUpper = horner(upperCoefficients.map(row => horner(row, y)), x);
        zConstraints = [constraint('floor', q.sub(z, zLower)), constraint('roof', q.sub(zUpper, z))];
        decision = zConstraints.some(c => c.sign < 0) ? 'outside-z' : 'inside';
      }
    }
    const boundaryFaces: BoundaryFace[] = [];
    if (decision === 'inside') {
      const zeroRoles = new Set([...xConstraints, ...yConstraints!, ...zConstraints!].filter(c => c.sign === 0).map(c => c.role));
      for (const face of source.faceRefs) if (zeroRoles.has(face.role)) boundaryFaces.push({ ...face, supportRef: { ...face.supportRef } });
      if (boundaryFaces.length) decision = 'boundary';
    }
    const classification: Classification = { queryId: query.queryId,
      status: decision === 'inside' ? 'inside' : decision === 'boundary' ? 'boundary' : 'outside', bodyId: source.bodyId,
      materialCertificateId: source.materialCertificateId, boundaryFaces };
    const proof: QueryProof = { queryId: query.queryId, pointExact: [q.text(x), q.text(y), q.text(z)], decision,
      x: xConstraints, originalUB: originalUB === null ? null : q.text(originalUB),
      yRoof: yRoof === null ? null : q.text(yRoof), y: yConstraints,
      zLower: zLower === null ? null : q.text(zLower), zUpper: zUpper === null ? null : q.text(zUpper), z: zConstraints, classification };
    classifications.push(classification); queryProofs.push(proof); callbacks.retainQuery(classification, proof);
  }
  return { source, classifications, queries: queryProofs };
}
