import type { Curve, Surface } from '../types.js';
import type { PairedRoofDifferenceBodyResult } from './paired-roof-difference-body.js';
import type { PairedSurfaceMaterialBodyResult } from './paired-surface-material-body.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';
import { same } from '../structural-equality.js';

type F = SectionFraction;
type R = SectionRational;
type P = R[][];
type Difference = PairedRoofDifferenceBodyResult;
type Material = PairedSurfaceMaterialBodyResult;
type Domains = { u: [number, number]; v: [number, number] };
type Code = 'PROFILE' | 'BINDING' | 'PARTITION' | 'ORIENTATION' | 'BUDGET' | 'REPRESENTABILITY';
type BoundaryPair = { middleEdgeId: string; middleUseId: string; outputUseIds: [string, string];
  curveId: string; domain: [number, number]; oppositeEffectiveUses: true };

/** Private composition certificate. The public wrapper owns all admission and construction. */
export interface PairedRoofBodySplitProof {
  schema: 'barocss-paired-roof-body-split-proof'; version: 0; certificateId: string;
  parentBodyId: string; outputBodyIds: [string, string];
  authority: { uInterval: [number, number]; nativeADomains: Domains; originalUBMap: { offset: F; scale: F };
    lowY: F; oldLowZ: F; originalBSourceId: string; originalBObjectId: string;
    sameOriginalB: true; sameFootprint: true; sameUnitsAndAxes: true };
  regions: { lowerPower: F[][]; middlePower: F[][]; upperPower: F[][];
    lowerGapBernstein: F[][]; upperGapBernstein: F[][]; minimumLowerGap: F; minimumUpperGap: F;
    lowerFloorResidual: F[][]; interfaceResidual: F[][]; upperRoofResidual: F[][]; gapSumResidual: F[][];
    closedCover: true; disjointInteriors: true };
  interface: { middleFaceId: string; outputFaceIds: [string, string]; sourceId: string; surfaceId: string;
    nativeDomains: Domains; nativeUVResiduals: F[][][]; worldImageResiduals: F[][][];
    boundaryPairs: [BoundaryPair, BoundaryPair, BoundaryPair, BoundaryPair];
    orientations: ['forward', 'reverse']; importReversals: [false, true];
    sameNativeFace: true; oppositeEffectiveOrientations: true };
  volume: { wholeMM3: F; outputsMM3: [F, F]; residual: F; exact: true };
  lineage: { originalBodyId: string; middleBodyId: string; middleFaceId: string;
    outputBodyIds: [string, string];
    outerFaceBindings: [{ wholeFaceId: string; outputIndex: 0; outputFaceId: string },
      { wholeFaceId: string; outputIndex: 1; outputFaceId: string }];
    generatedIds: string[]; unchangedSources: true };
}

export class PairedRoofBodySplitProofError extends Error {
  readonly code: Code;
  constructor(code: Code, detail: string, cause?: unknown) {
    super(('Paired roof Body split proof: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedRoofBodySplitProofError'; this.code = code;
  }
}
function check(condition: boolean, code: Code, detail: string): asserts condition {
  if (!condition) throw new PairedRoofBodySplitProofError(code, detail);
}
/** Copied native numbers, including signed zero, must retain their exact bits. */
function domain(curve: Curve): [number, number] {
  return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
}
function domains(surface: Surface): Domains {
  return { u: [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]],
    v: [surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]] };
}

/** All exact arithmetic below charges the caller's ONE request-local context. */
function arithmetic(q: SectionRationalContext) {
  const zero = q.integer(0), one = q.integer(1), fractions = new Map<string, R>();
  const read = (value: F): R => {
    check(value.numerator.length <= 5000 && value.denominator.length <= 5000,
      'BUDGET', 'Fraction integer text exceeds the inherited bound');
    check(/^-?(0|[1-9][0-9]*)$/.test(value.numerator) && /^[1-9][0-9]*$/.test(value.denominator),
      'REPRESENTABILITY', 'A retained exact fraction must have supported integer text');
    const key = value.numerator + '/' + value.denominator;
    let result = fractions.get(key);
    if (result === undefined) { result = q.rat(BigInt(value.numerator), BigInt(value.denominator)); fractions.set(key, result); }
    return result;
  };
  const add = (a: R, b: R): R => a.n === 0n ? b : b.n === 0n ? a : q.add(a, b);
  const sub = (a: R, b: R): R => b.n === 0n ? a : a.n === b.n && a.d === b.d ? zero : q.sub(a, b);
  const mul = (a: R, b: R): R => a.n === 0n || b.n === 0n ? zero : a.n === a.d ? b : b.n === b.d ? a : q.mul(a, b);
  const grid = (values: F[][]): P => {
    check(values.length > 0 && values.length <= 5 && values.every(row => row.length > 0 && row.length <= 2),
      'PARTITION', 'Whole region power coefficients must fit the admitted degree4x1 profile');
    return Array.from({ length: 5 }, (_, i) => Array.from({ length: 2 }, (_, j) => values[i]?.[j] ? read(values[i][j]) : zero));
  };
  const constant = (value: R): P => Array.from({ length: 5 }, (_, i) => [i === 0 ? value : zero, zero]);
  const addGrid = (a: P, b: P): P => a.map((row, i) => row.map((v, j) => add(v, b[i][j])));
  const subGrid = (a: P, b: P): P => a.map((row, i) => row.map((v, j) => sub(v, b[i][j])));
  const scaleGrid = (a: P, b: R): P => a.map(row => row.map(v => mul(v, b)));
  const mulGrid = (a: P, b: P): P => {
    const result = constant(zero);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) if (a[i][j].n !== 0n)
      for (let k = 0; k < 5; k++) for (let l = 0; l < 2; l++) if (b[k][l].n !== 0n) {
        check(i + k < 5 && j + l < 2, 'PARTITION', 'Native roof chart composition exceeds degree4x1');
        result[i + k][j + l] = add(result[i + k][j + l], mul(a[i][j], b[k][l]));
      }
    return result;
  };
  const isZero = (values: P): boolean => values.every(row => row.every(value => value.n === 0n));
  const textGrid = (values: P): F[][] => values.map(row => row.map(value => q.text(value)));
  const choose = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
  const bernstein = (power: P, interval: [number, number]): P => {
    const a = q.from(interval[0]), width = q.sub(q.from(interval[1]), a);
    check(q.compare(width, zero) > 0, 'PROFILE', 'The common original-UA interval must be increasing');
    const ap = [one], wp = [one];
    for (let i = 1; i <= 4; i++) { ap.push(mul(ap[i - 1], a)); wp.push(mul(wp[i - 1], width)); }
    const local = constant(zero);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) if (power[i][j].n !== 0n)
      for (let k = 0; k <= i; k++) local[k][j] = add(local[k][j],
        mul(power[i][j], mul(q.integer(choose[i][k]), mul(ap[i - k], wp[k]))));
    return Array.from({ length: 5 }, (_, i) => [0, 1].map(j => {
      let result = zero;
      for (let k = 0; k <= i; k++) for (let l = 0; l <= j; l++) if (local[k][l].n !== 0n)
        result = add(result, mul(local[k][l], q.div(q.integer(choose[i][k]), q.integer(choose[4][k]))));
      return result;
    }));
  };
  const tensor = (values: F[][][], axes: number): R[][][] => {
    check(values.length === 5 && values.every(row => row.length === 2 && row.every(point => point.length === axes)),
      'BINDING', 'A whole native chart/image must retain its complete5x2 coefficient tensor');
    return values.map(row => row.map(point => point.map(read)));
  };
  const tensorResidual = (a: F[][][], b: F[][][], axes: number): F[][][] => {
    const first = tensor(a, axes), second = tensor(b, axes);
    const residual = first.map((row, i) => row.map((point, j) => point.map((value, axis) => sub(value, second[i][j][axis]))));
    check(residual.every(row => row.every(point => point.every(value => value.n === 0n))),
      'BINDING', 'Entire source-qualified native chart and World image must agree coefficient by coefficient');
    return residual.map(row => row.map(point => point.map(value => q.text(value))));
  };
  return { zero, one, read, add, sub, mul, grid, constant, addGrid, subGrid, scaleGrid, mulGrid,
    isZero, textGrid, bernstein, tensor, tensorResidual };
}
type Arithmetic = ReturnType<typeof arithmetic>;

function commonAuthority(whole: Difference, middle: Material, outputs: [Difference, Difference] | null,
  q: SectionRationalContext): PairedRoofBodySplitProof['authority'] {
  const original = whole.request.lower, base = original.request.a.request.section;
  const aDomain = domains(base.request.assets[0].surface), bDomain = domains(base.request.assets[1].surface);
  const reference = original.proof.material, cube = reference.cubeMap;
  const zero = q.integer(0), one = q.integer(1);
  const read = (value: F): R => q.rat(BigInt(value.numerator), BigInt(value.denominator));
  check(q.compare(read(base.proof.originalUB.scale), one) === 0 &&
    q.compare(read(cube.lowY), q.from(aDomain.v[0])) === 0 &&
    q.compare(read(cube.lowZ), q.from(bDomain.v[0])) === 0 &&
    q.compare(q.from(base.request.uAInterval[1]), q.from(base.request.uAInterval[0])) > 0,
  'PROFILE', 'Original native domains, unit UB map and physical low bounds must agree');
  const operands = [original, whole.request.upper, middle,
    ...(outputs === null ? [] : outputs.flatMap(output => [output.request.lower, output.request.upper]))];
  for (const operand of operands) {
    const section = operand.request.a.request.section, material = operand.proof.material, map = material.cubeMap;
    check(same(section, operand.request.b.request.section), 'BINDING', 'Both native faces must retain one complete genuine paired section');
    check(same(section.request.assets[1], base.request.assets[1]) &&
      same(section.originalModels[1], base.originalModels[1]),
    'PROFILE', 'Complete original B source identity, spelling, model siblings and selected support must be unchanged');
    check(same(domains(section.request.assets[0].surface), aDomain) &&
      same(section.request.uAInterval, base.request.uAInterval) &&
      same(section.proof.originalUB, base.proof.originalUB) && same(map.domain, cube.domain) &&
      same(map.lowY, cube.lowY) && same(map.lowZ, cube.lowZ) && same(map.heightYBernstein, cube.heightYBernstein),
    'PROFILE', 'All original A domains, B UV maps, footprints and physical low bounds must be the same');
    check(section.originalModels.every(model => model.version === 0 && model.lengthUnit === 'mm') &&
      operand.request.a.world.model.lengthUnit === 'mm' && operand.request.b.world.model.lengthUnit === 'mm' &&
      section.report.sourceFrame === 'authored-xyz-no-axis-conversion' && operand.report.sourceFrame === 'authored-xyz-no-axis-conversion' &&
      operand.report.lengthUnit === 'mm' && operand.report.uvLengthUnit === 'dimensionless' &&
      material.profile.aXIdentity && material.profile.aYIdentity && material.profile.bXShiftIdentity && material.profile.bZIdentity &&
      material.profile.unitPositiveAxes && material.profile.constantPositiveWeights &&
      same(material.profile.originalUBOffset, base.proof.originalUB.offset) &&
      same(material.profile.originalUBScale, base.proof.originalUB.scale) &&
      same(material.profile.bYPower, reference.profile.bYPower),
    'PROFILE', 'All retained sources must use the same admitted unit-positive XYZ axes and physical footprint');
    check(operand.body.id === material.bodyId && operand.body.materialCertificateId === material.certificateId &&
      operand.body.shellIds.length === 1 && operand.body.shellIds[0] === operand.shell.id && material.shellId === operand.shell.id &&
      operand.body.closed && operand.body.solid && operand.body.restrictedSolidCertified && operand.shell.closed && operand.shell.oriented &&
      map.globallyInjective && material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage &&
      material.outwardMaterial && material.embeddedClosedBoundary && material.restrictedSolidCertified,
    'BINDING', 'Every full material operand must retain its validated injective occupied-region and embedded boundary proof');
    for (const index of [0, 1] as const) {
      const asset = section.request.assets[index], model = section.originalModels[index];
      const matches = model.objects.filter(object => object.id === asset.surface.id);
      check(matches.length === 1 && same(matches[0], asset.surface), 'BINDING', 'Original support must resolve inside its complete retained source Model');
    }
  }
  for (const difference of [whole, ...(outputs ?? [])]) {
    const material = difference.proof.material, map = material.cubeMap;
    check(same(map.domain, cube.domain) && same(map.lowY, cube.lowY) &&
      same(map.heightYBernstein, cube.heightYBernstein) &&
      same(difference.proof.band.originalUAInterval, base.request.uAInterval) &&
      same(difference.proof.band.originalUBMap, { offset: base.proof.originalUB.offset, scale: base.proof.originalUB.scale }) &&
      same(difference.geometry.band.support, base.request.assets[1].surface) &&
      difference.geometry.band.supportRef.sourceId === base.request.assets[1].sourceId &&
      difference.geometry.band.supportRef.objectId === base.request.assets[1].surface.id &&
      difference.report.lengthUnit === 'mm' && difference.report.sourceFrame === 'authored-xyz-no-axis-conversion' &&
      material.profile.unitPositiveAxes && material.profile.commonOriginalB && material.profile.commonFootprint,
    'PROFILE', 'Every difference Body must retain the same original B authority and injective footprint chart');
    check(difference.body.id === material.bodyId && difference.body.materialCertificateId === material.certificateId &&
      material.shellId === difference.shell.id && same(difference.body.shellIds, [difference.shell.id]) &&
      same(difference.shell.faceIds, difference.faces.map(face => face.id)) &&
      difference.body.closed && difference.body.solid && difference.body.restrictedSolidCertified && difference.shell.closed && difference.shell.oriented &&
      map.globallyInjective && material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage &&
      material.outwardMaterial && material.embeddedClosedBoundary && material.restrictedSolidCertified &&
      q.compare(read(map.minimumHeightY), zero) > 0,
    'BINDING', 'Every complete difference must retain its qualified global cube map and embedded closed boundary');
  }
  return { uInterval: [...base.request.uAInterval], nativeADomains: { u: [...aDomain.u], v: [...aDomain.v] },
    originalUBMap: { offset: { ...base.proof.originalUB.offset }, scale: { ...base.proof.originalUB.scale } },
    lowY: { ...cube.lowY }, oldLowZ: { ...cube.lowZ }, originalBSourceId: base.request.assets[1].sourceId,
    originalBObjectId: base.request.assets[1].surface.id, sameOriginalB: true, sameFootprint: true, sameUnitsAndAxes: true };
}

/** Called after the two owned parent validations and before either old output builder. */
export function preflightPairedRoofBodySplitTrusted(whole: Difference, middle: Material, q: SectionRationalContext): void {
  // Positivity remains the unchanged builders' construction admission. No outputs or native observations are made here.
  commonAuthority(whole, middle, null, q);
}

type BoundFace = { body: Difference | Material; operand: Material;
  face: Difference['faces'][number] | Material['faces'][number];
  image: Difference['proof']['material']['faceImages'][number] | Material['proof']['material']['faceImages'][number];
  native: Material['request']['a']['faces'][number]; loop: Material['request']['a']['loops'][number];
  path: string; reversal: boolean };
function bindFace(body: Difference | Material, role: 'roof' | 'floor', operand: Material,
  kind: 'a' | 'lower' | 'upper', path: string): BoundFace {
  const parent = operand.request.a, native = parent.faces[0], section = parent.request.section;
  const selected = body.faces.filter(face => face.role === role), loops = parent.loops.filter(loop => loop.id === native.outerLoopId);
  check(selected.length === 1 && loops.length === 1, 'BINDING', 'A unique real imported Face and original native A Loop must resolve');
  const face = selected[0], loop = loops[0], support = section.request.assets[0], model = parent.world.model;
  const reversal = role === 'floor';
  const ref = { sourceId: support.sourceId, sourceField: path + '.source', modelField: path + '.model',
    modelName: model.name, objectIndex: 0, objectId: support.surface.id };
  check(face.origin.kind === kind && face.origin.closureIndex === null && face.origin.faceId === native.id &&
    face.origin.loopId === loop.id && face.origin.sourceField === ref.sourceField && face.origin.modelField === ref.modelField &&
    same(face.origin.supportRef, ref) && same(face.supportRef, ref) && same(face.support, support.surface) &&
    same(model.objects[0], support.surface) && parent.world.sourceVersion === 0 &&
    native.sourceId === support.sourceId && native.surfaceId === support.surface.id && native.region === 'below-cut' &&
    face.outerLoopId === face.loop.id && face.loop.faceId === face.id,
  'BINDING', 'Imported Face must resolve the actual native A source, support, selected Face and complete Loop');
  check(native.orientation === 'forward' && face.orientation === (reversal ? 'reverse' : 'forward') &&
    ('importReversal' in face ? face.importReversal === reversal : !reversal),
  'ORIENTATION', 'The native A orientation must be forward with exactly one floor import reversal');
  const order = reversal ? loop.uses.slice().reverse() : loop.uses;
  check(face.loop.uses.length === 4 && loop.uses.length === 4 &&
    face.loop.uses.every((use, index) => use.origin.useId === order[index].id && use.origin.edgeId === order[index].edgeId),
  'ORIENTATION', 'Real output loops must retain original native use order, reversing only the floor import');
  const images = body.proof.material.faceImages.filter(image => image.faceId === face.id);
  check(images.length === 1, 'BINDING', 'Actual Face must resolve its retained whole-image certificate');
  const image = images[0];
  check(image.role === role && same(image.supportRef, ref) && same(image.originalSupport, face.support) &&
    same(image.nativeDomains, domains(face.support)) && same(image.chartVariables, ['u', 's']) &&
    image.cubeRestriction === (reversal ? 't=0' : 't=1') && image.proofDegrees.first === 4 && image.proofDegrees.second === 1 &&
    image.wholeImageEqual && image.storedLocalUsesUnchanged &&
    ('importReversal' in image ? image.importReversal === reversal : !reversal),
  'BINDING', 'Face image must certify this exact native source, chart and cube restriction');
  check(image.outward.axis === 'z' && image.outward.sign === (reversal ? -1 : 1),
    'ORIENTATION', 'Native imported roof/floor normals must have opposite effective Z orientation');
  return { body, operand, face, image, native, loop, path, reversal };
}

function identicalNativeImage(first: BoundFace, second: BoundFace, math: Arithmetic): void {
  const a = first.operand.request.a, b = second.operand.request.a;
  // Paths qualify different parents. Resolve both first; never compare their literal sourceField strings.
  check(same(first.native, second.native) && same(first.loop, second.loop) && same(a.world, b.world) &&
    same(a.request.section.request.assets[0], b.request.section.request.assets[0]) &&
    same(a.request.section.originalModels[0], b.request.section.originalModels[0]) &&
    same(first.face.support, second.face.support) && same(first.image.nativeDomains, second.image.nativeDomains),
  'BINDING', 'Retained native Face, complete source/model siblings and native domains must be identical');
  math.tensorResidual(first.image.nativeUVPower, second.image.nativeUVPower, 2);
  math.tensorResidual(first.image.actualCartesian, second.image.actualCartesian, 3);
  for (const binding of [first, second]) {
    math.tensorResidual(binding.image.actualCartesian, binding.image.expectedCartesian, 3);
    check(math.tensor(binding.image.residuals, 3).every(row => row.every(point => point.every(value => value.n === 0n))),
      'BINDING', 'Retained entire face-image residual must be exactly zero');
  }
}

function roofPower(binding: BoundFace, math: Arithmetic): P {
  const coefficients = binding.operand.proof.material.profile.aZPower;
  check(coefficients.length <= 3 && coefficients.every(row => row.length === 2),
    'PROFILE', 'Admitted native A roof must retain its full degree2x1 or lower power coefficients');
  const uv = math.tensor(binding.image.nativeUVPower, 2);
  const u = uv.map(row => row.map(point => point[0])), v = uv.map(row => row.map(point => point[1]));
  let result = math.constant(math.zero), uPower = math.constant(math.one);
  for (let i = 0; i < coefficients.length; i++) {
    result = math.addGrid(result, math.scaleGrid(uPower, math.read(coefficients[i][0])));
    result = math.addGrid(result, math.scaleGrid(math.mulGrid(uPower, v), math.read(coefficients[i][1])));
    if (i + 1 < coefficients.length) uPower = math.mulGrid(uPower, u);
  }
  return result;
}

function resolveUse(binding: BoundFace, raw: Material['request']['a']['loops'][number]['uses'][number],
  q: SectionRationalContext, math: Arithmetic) {
  const parent = binding.operand.request.a;
  const matches = parent.edges.filter(edge => edge.id === raw.edgeId);
  check(matches.length === 1, 'BINDING', 'Original middle native edge must resolve exactly once');
  const edge = matches[0], nativeDomain = domain(edge.curve);
  // Native Use intervals are directed; the increasing Curve/pcurve domain is unchanged.
  const directedNativeInterval = raw.sense === 'forward' ? nativeDomain : [nativeDomain[1], nativeDomain[0]];
  const uses = binding.face.loop.uses.filter(use => use.origin.useId === raw.id && use.origin.edgeId === edge.id);
  check(uses.length === 1, 'BINDING', 'Original native edge/use must resolve once in the actual imported Face');
  const use = uses[0], origin = use.origin;
  const curveRef = { sourceId: parent.request.section.request.assets[0].sourceId,
    sourceField: binding.path + '.source', modelField: binding.path + '.model', modelName: parent.world.model.name,
    objectIndex: edge.sourceRef.objectIndex, objectId: edge.curve.id };
  check(same(origin.face, binding.face.origin) && origin.useId === raw.id && origin.edgeId === edge.id &&
    origin.curveId === edge.curve.id && same(origin.curveRef, curveRef) &&
    same(parent.world.model.objects[curveRef.objectIndex], edge.curve) &&
    same(origin.localCurve, edge.curve) && same(origin.pcurve, { kind: 'native-curve', curve: edge.pcurve.curve }) &&
    raw.pcurveId === edge.pcurve.curve.id && same(origin.localVertexIds, raw.vertexIds) && origin.sense === raw.sense &&
    same(origin.interval, raw.interval) && same(raw.interval, directedNativeInterval) && same(domain(edge.pcurve.curve), nativeDomain),
  'BINDING', 'Actual imported Curve, native domain, pcurve and local traversal must equal the original native occurrence');
  const globalEdges = binding.body.edges.filter(global => global.id === use.edgeId);
  check(globalEdges.length === 1 && use.faceId === binding.face.id && use.loopId === binding.face.loop.id &&
    globalEdges[0].uses.filter(candidate => same(candidate, use)).length === 1,
  'BINDING', 'Actual imported Use must resolve its own Body edge and Face incidence');
  const globalEdge = globalEdges[0], map = use.parameterMap;
  const scale = math.read(map.scale), offset = math.read(map.offset), sign = q.compare(scale, math.zero);
  check(sign !== 0 && same(map.localDomain, nativeDomain) && same(map.canonicalDomain, domain(globalEdge.curve)) &&
    same(globalEdge.parameterRange, map.canonicalDomain), 'BINDING', 'Actual Use must retain its exact nonzero native/canonical parameter map');
  const mappedEnds = sign > 0 ? nativeDomain : [nativeDomain[1], nativeDomain[0]];
  check(same(map.localEndpointParameters, mappedEnds), 'BINDING', 'Exact map endpoints must retain original native parameter bits');
  for (let i = 0; i < 2; i++) {
    const residual = q.sub(q.add(offset, q.mul(scale, q.from(map.canonicalDomain[i]))), q.from(mappedEnds[i]));
    check(residual.n === 0n && math.read(map.endpointResiduals[i]).n === 0n,
      'BINDING', 'Actual affine parameter correspondence must bind both native endpoints exactly');
  }
  const reversal = 'importReversal' in use ? use.importReversal : false;
  const effective = (use.sense === 'forward' ? 1 : -1) * sign;
  const expected = (raw.sense === 'forward' ? 1 : -1) * (binding.reversal ? -1 : 1);
  check(reversal === binding.reversal && effective === expected, 'ORIENTATION',
    'Effective native traversal must compose the canonical map sign and exactly the existing floor reversal');
  const originalOrder = binding.reversal ? raw.vertexIds.slice().reverse() : raw.vertexIds;
  for (let i = 0; i < 2; i++) {
    const nativeVertex = parent.vertices.find(vertex => vertex.id === originalOrder[i]);
    const vertex = binding.body.vertices.find(candidate => candidate.id === use.vertexIds[i]);
    check(nativeVertex !== undefined && vertex !== undefined && same(nativeVertex.world, vertex.world) &&
      vertex.members.some(member => same(member.face, binding.face.origin) && member.vertexId === nativeVertex.id && same(member.world, nativeVertex.world)),
    'BINDING', 'Effective Use endpoints must bind the actual native vertices in this independently copied Body');
  }
  return { use, edge, effective, nativeDomain };
}

/** Compose already owned-validated full parents and the two genuine old-builder outputs. */
export function provePairedRoofBodySplitTrusted(whole: Difference, middle: Material,
  outputs: [Difference, Difference], certificateId: string, generatedIds: string[],
  q: SectionRationalContext): PairedRoofBodySplitProof {
  const math = arithmetic(q), [lower, upper] = outputs;
  check(same(lower.request.lower, whole.request.lower) && same(lower.request.upper, middle) &&
    same(upper.request.lower, middle) && same(upper.request.upper, whole.request.upper),
  'BINDING', 'Both genuinely built outputs must retain their exact complete original operands');
  const authority = commonAuthority(whole, middle, outputs, q);
  check(generatedIds.length === 256 && new Set(generatedIds).size === 256 && generatedIds[1] === certificateId &&
    same(generatedIds.slice(2, 129), lower.report.reservedIds) && same(generatedIds.slice(129), upper.report.reservedIds),
  'BINDING', 'Composition lineage must retain the exact256 preflighted wrapper/output roles');
  const middleFace = bindFace(middle, 'roof', middle, 'a', 'request.a.world');
  const cutLower = bindFace(lower, 'roof', middle, 'upper', 'request.upper.request.a.world');
  const cutUpper = bindFace(upper, 'floor', middle, 'lower', 'request.lower.request.a.world');
  identicalNativeImage(middleFace, cutLower, math); identicalNativeImage(middleFace, cutUpper, math);
  const nativeUVResiduals = math.tensorResidual(cutLower.image.nativeUVPower, cutUpper.image.nativeUVPower, 2);
  const worldImageResiduals = math.tensorResidual(cutLower.image.actualCartesian, cutUpper.image.actualCartesian, 3);
  const wholeFloor = bindFace(whole, 'floor', whole.request.lower, 'lower', 'request.lower.request.a.world');
  const outputFloor = bindFace(lower, 'floor', whole.request.lower, 'lower', 'request.lower.request.a.world');
  const wholeRoof = bindFace(whole, 'roof', whole.request.upper, 'upper', 'request.upper.request.a.world');
  const outputRoof = bindFace(upper, 'roof', whole.request.upper, 'upper', 'request.upper.request.a.world');
  identicalNativeImage(wholeFloor, outputFloor, math); identicalNativeImage(wholeRoof, outputRoof, math);
  const boundaryPairs = middleFace.loop.uses.map((raw): BoundaryPair => {
    const original = resolveUse(middleFace, raw, q, math);
    const first = resolveUse(cutLower, raw, q, math), second = resolveUse(cutUpper, raw, q, math);
    check(same(first.edge, original.edge) && same(second.edge, original.edge),
      'BINDING', 'Both output cut occurrences must borrow the same unchanged original native edge and pcurve');
    check(first.effective === original.effective && second.effective === -original.effective,
      'ORIENTATION', 'The two actual output cut Uses must be opposite in the SAME original native parameter');
    return { middleEdgeId: original.edge.id, middleUseId: raw.id, outputUseIds: [first.use.id, second.use.id],
      curveId: original.edge.curve.id, domain: [...original.nativeDomain], oppositeEffectiveUses: true };
  }) as PairedRoofBodySplitProof['interface']['boundaryPairs'];
  for (const [original, retained] of [[wholeFloor, outputFloor], [wholeRoof, outputRoof]])
    for (const raw of original.loop.uses) {
      const first = resolveUse(original, raw, q, math), second = resolveUse(retained, raw, q, math);
      check(first.effective === second.effective, 'ORIENTATION', 'Retained outer native Face Uses must keep the whole Body orientation');
    }

  const wholeMap = whole.proof.material.cubeMap, lowMap = lower.proof.material.cubeMap, highMap = upper.proof.material.cubeMap;
  const floor = math.grid(wholeMap.floorPower), wholeGap = math.grid(wholeMap.gapPower), roof = math.addGrid(floor, wholeGap);
  const l0 = math.grid(lowMap.floorPower), g0 = math.grid(lowMap.gapPower);
  const l1 = math.grid(highMap.floorPower), g1 = math.grid(highMap.gapPower), mid = roofPower(middleFace, math);
  // These are coefficient identities over the ENTIRE common injective (u,s) footprint, never point samples.
  const lowerFloorResidual = math.subGrid(l0, floor), lowRoof = math.addGrid(l0, g0);
  const interfaceResidual = math.subGrid(lowRoof, l1), upperRoofResidual = math.subGrid(math.addGrid(l1, g1), roof);
  const gapSumResidual = math.subGrid(math.addGrid(g0, g1), wholeGap);
  check([lowerFloorResidual, interfaceResidual, upperRoofResidual, gapSumResidual,
    math.subGrid(lowRoof, mid), math.subGrid(l1, mid)].every(math.isZero),
  'PARTITION', 'Every floor, middle, roof and gap-sum power coefficient must give exact closed cover');
  const midBernstein = math.bernstein(mid, authority.uInterval);
  const midImage = math.tensor(middleFace.image.actualCartesian, 3);
  const height = math.grid(middle.proof.material.cubeMap.heightZBernstein), oldLowZ = math.read(authority.oldLowZ);
  check(midBernstein.every((row, i) => row.every((value, j) => math.sub(value, midImage[i][j][2]).n === 0n &&
    math.sub(value, math.add(height[i][j], oldLowZ)).n === 0n)),
  'BINDING', 'Entire middle native roof polynomial must bind its validated World image and occupied cube height');
  const lowerGap = math.bernstein(g0, authority.uInterval), upperGap = math.bernstein(g1, authority.uInterval);
  for (const [actual, declared] of [[lowerGap, lowMap.gapBernstein], [upperGap, highMap.gapBernstein]] as [P, F[][]][]) {
    check(declared.length === 5 && declared.every(row => row.length === 2),
      'PARTITION', 'Each complete gap must retain exactly5x2 Bernstein coefficients');
    const retained = math.grid(declared);
    check(actual.every((row, i) => row.every((value, j) => q.compare(value, math.zero) > 0 && math.sub(value, retained[i][j]).n === 0n)),
      'PARTITION', 'Both entire admitted gap Bernstein hulls must be strictly positive');
  }
  const minimum = (values: P): R => values.flat().reduce((a, b) => q.compare(a, b) < 0 ? a : b);
  const minimumLowerGap = minimum(lowerGap), minimumUpperGap = minimum(upperGap);
  check(math.sub(minimumLowerGap, math.read(lowMap.minimumGap)).n === 0n &&
    math.sub(minimumUpperGap, math.read(highMap.minimumGap)).n === 0n,
  'PARTITION', 'Exact strict gap minima must match the two genuine output cube proofs');
  // Positive gaps plus the common injective footprint prove disjoint interiors and intersection exactly Z=M.
  // Embedded, source-defined parent/output boundary proofs above lift that pointwise identity to whole regions.
  const wholeVolume = math.read(whole.proof.material.volume.exactVolumeMM3);
  const outputVolumes = outputs.map(output => math.read(output.proof.material.volume.exactVolumeMM3)) as [R, R];
  const residual = q.sub(q.add(outputVolumes[0], outputVolumes[1]), wholeVolume);
  check(residual.n === 0n && q.compare(wholeVolume, math.zero) > 0 && outputVolumes.every(value => q.compare(value, math.zero) > 0) &&
    math.sub(wholeVolume, math.read(whole.report.exactVolumeMM3)).n === 0n &&
    outputs.every((output, i) => math.sub(outputVolumes[i], math.read(output.report.exactVolumeMM3)).n === 0n),
  'PARTITION', 'Fresh exact positive output-volume sum must equal the original occupied difference volume');
  return { schema: 'barocss-paired-roof-body-split-proof', version: 0, certificateId, parentBodyId: whole.body.id,
    outputBodyIds: [lower.body.id, upper.body.id], authority,
    regions: { lowerPower: math.textGrid(floor), middlePower: math.textGrid(mid), upperPower: math.textGrid(roof),
      lowerGapBernstein: math.textGrid(lowerGap), upperGapBernstein: math.textGrid(upperGap),
      minimumLowerGap: q.text(minimumLowerGap), minimumUpperGap: q.text(minimumUpperGap),
      lowerFloorResidual: math.textGrid(lowerFloorResidual), interfaceResidual: math.textGrid(interfaceResidual),
      upperRoofResidual: math.textGrid(upperRoofResidual), gapSumResidual: math.textGrid(gapSumResidual),
      closedCover: true, disjointInteriors: true },
    interface: { middleFaceId: middleFace.native.id, outputFaceIds: [cutLower.face.id, cutUpper.face.id],
      sourceId: middleFace.native.sourceId, surfaceId: middleFace.native.surfaceId,
      nativeDomains: { u: [...middleFace.image.nativeDomains.u], v: [...middleFace.image.nativeDomains.v] },
      nativeUVResiduals, worldImageResiduals, boundaryPairs, orientations: ['forward', 'reverse'],
      importReversals: [false, true], sameNativeFace: true, oppositeEffectiveOrientations: true },
    volume: { wholeMM3: q.text(wholeVolume), outputsMM3: [q.text(outputVolumes[0]), q.text(outputVolumes[1])],
      residual: q.text(residual), exact: true },
    lineage: { originalBodyId: whole.body.id, middleBodyId: middle.body.id, middleFaceId: middleFace.native.id,
      outputBodyIds: [lower.body.id, upper.body.id], outerFaceBindings: [
        { wholeFaceId: wholeFloor.face.id, outputIndex: 0, outputFaceId: outputFloor.face.id },
        { wholeFaceId: wholeRoof.face.id, outputIndex: 1, outputFaceId: outputRoof.face.id }],
      generatedIds: generatedIds.slice(), unchangedSources: true } };
}
