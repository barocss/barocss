import type { Curve, Surface, Model, Point } from '../types.js';
import type { FaceIds, FaceBundle } from '../face.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { PairedRoofDifferenceBodyRequest } from './paired-roof-difference-body.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';
import type {
  PairedRoofDifferenceGeometry, PairedRoofDifferenceBand, PairedRoofDifferenceClosures,
  PairedRoofDifferenceSourceRef, PairedRoofDifferenceSourceModel,
} from './paired-roof-difference-body-proof-internal.js';

type R = SectionRational;
type P = R[][];
type FaceRole = 'roof' | 'floor' | 'band' | 'yMin' | 'xMin' | 'xMax';
type Code = 'INPUT' | 'IDENTITY' | 'PARENT' | 'PROFILE' | 'SOURCE' | 'NATIVE' | 'CLOSURE' |
  'TOPOLOGY' | 'MATERIAL' | 'ORIENTATION' | 'DOMAIN' | 'REPRESENTABILITY' | 'BINDING' | 'BUDGET' | 'FILE' | 'OWNED';

export interface PairedRoofDifferenceConstructionCallbacks {
  validateCurve(curve: Curve, kind: 'band-world' | 'band-uv', edgeIndex: 0 | 1): void;
  buildRuled(first: Curve, second: Curve, options: { surfaceId: string }, closureIndex: 0 | 1 | 2): CompatibleRuledSurfaceResult;
  buildFace(surface: Surface, ids: FaceIds, closureIndex: 0 | 1 | 2): FaceBundle;
  adopt(model: Model, sourceId: string, kind: 'band' | 'closure', closureIndex: 0 | 1 | 2 | null): PairedRoofDifferenceSourceModel;
  prefix(partial: unknown): void;
}

/** This leaf does not catch failures from the caller's q or native callbacks. */
export class PairedRoofDifferenceConstructionError extends Error {
  readonly code: Code;
  readonly edgeIndex: number | null;
  readonly faceRole: FaceRole | null;
  constructor(code: Code, detail: string, edgeIndex: number | null = null, faceRole: FaceRole | null = null) {
    super(('Paired roof difference construction: ' + detail).slice(0, 1024));
    this.name = 'PairedRoofDifferenceConstructionError'; this.code = code;
    this.edgeIndex = edgeIndex; this.faceRole = faceRole;
  }
}

/** Actual two-cut B disk and three natural closures. No parent validation or global graph. */
export function constructPairedRoofDifferenceGeometryTrusted(
  request: PairedRoofDifferenceBodyRequest, q: SectionRationalContext,
  callbacks: PairedRoofDifferenceConstructionCallbacks,
): PairedRoofDifferenceGeometry {
  function check(condition: boolean, code: Code, detail: string,
    edgeIndex: number | null = null, faceRole: FaceRole | null = null): asserts condition {
    if (!condition) throw new PairedRoofDifferenceConstructionError(code, detail, edgeIndex, faceRole);
  }
  const same = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((value, i) => same(value, b[i]));
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
      return Object.keys(x).length === Object.keys(y).length &&
        Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
    }
    return Object.is(a, b);
  };
  const zero = q.integer(0), one = q.integer(1);
  const numbers = new Map<number, R>(), integers = new Map<number, R>(), fractions = new Map<string, R>();
  const from = (value: number): R => {
    let r = numbers.get(value); if (r === undefined) { r = q.from(value); numbers.set(value, r); } return r;
  };
  const integer = (value: number): R => {
    let r = integers.get(value); if (r === undefined) { r = q.integer(value); integers.set(value, r); } return r;
  };
  const read = (f: SectionFraction): R => {
    const key = f.numerator + '/' + f.denominator;
    let r = fractions.get(key); if (r === undefined) { r = q.rat(BigInt(f.numerator), BigInt(f.denominator)); fractions.set(key, r); } return r;
  };
  const addR = (a: R, b: R): R => a.n === 0n ? b : b.n === 0n ? a : q.add(a, b);
  const subR = (a: R, b: R): R => b.n === 0n ? a : a.n === b.n && a.d === b.d ? zero : q.sub(a, b);
  const mulR = (a: R, b: R): R => a.n === 0n || b.n === 0n ? zero :
    a.n === a.d ? b : b.n === b.d ? a : q.mul(a, b);
  const divR = (a: R, b: R): R => b.n !== 0n && a.n === 0n ? zero : b.n === b.d ? a : q.div(a, b);
  const equal = (a: R, b: R): boolean => q.compare(a, b) === 0;
  const at = (p: P, i: number, j: number): R => p[i]?.[j] ?? zero;
  const normalize = (p: P): P => {
    let n = p.length, m = Math.max(1, ...p.map(row => row.length));
    while (n > 1 && p[n - 1].every(v => v.n === 0n)) n--;
    while (m > 1 && p.slice(0, n).every(row => (row[m - 1]?.n ?? 0n) === 0n)) m--;
    return Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => at(p, i, j)));
  };
  const constant = (value: R): P => [[value]];
  const U: P = [[zero], [one]], V: P = [[zero, one]];
  const add = (a: P, b: P): P => normalize(Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    Array.from({ length: Math.max(a[0].length, b[0].length) }, (_, j) => addR(at(a, i, j), at(b, i, j)))));
  const sub = (a: P, b: P): P => add(a, b.map(row => row.map(v => q.neg(v))));
  const mul = (a: P, b: P): P => {
    const result = Array.from({ length: a.length + b.length - 1 }, () => Array.from({ length: a[0].length + b[0].length - 1 }, () => zero));
    for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].length; j++) if (a[i][j].n !== 0n)
      for (let k = 0; k < b.length; k++) for (let l = 0; l < b[k].length; l++) if (b[k][l].n !== 0n)
        result[i + k][j + l] = addR(result[i + k][j + l], mulR(a[i][j], b[k][l]));
    return normalize(result);
  };
  const compose = (p: P, u: P, v: P): P => {
    let result = constant(zero);
    for (let i = p.length - 1; i >= 0; i--) {
      let row = constant(zero);
      for (let j = p[i].length - 1; j >= 0; j--) row = add(mul(row, v), constant(p[i][j]));
      result = add(mul(result, u), row);
    }
    return result;
  };
  const choose = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
  const toPower = (values: R[]): R[] => Array.from({ length: values.length }, (_, k) => {
    let value = zero;
    for (let j = 0; j <= k; j++) {
      const term = mulR(integer(choose[k][j]), values[j]);
      value = addR(value, (k - j) % 2 ? q.neg(term) : term);
    }
    return mulR(integer(choose[values.length - 1][k]), value);
  });
  const surfaceDomain = (s: Surface) => ({
    u: [s.knotsU[s.degreeU], s.knotsU[s.controlPoints.length]] as [number, number],
    v: [s.knotsV[s.degreeV], s.knotsV[s.controlPoints[0].length]] as [number, number],
  });
  const curveDomain = (curve: Curve): [number, number] => [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
  const lift = (surface: Surface): P[] => {
    const d = surfaceDomain(surface), weight = surface.weights[0][0];
    check(surface.degreeU >= 1 && surface.degreeU <= 2 && surface.degreeV === 1 &&
      surface.controlPoints.length === surface.degreeU + 1 && surface.controlPoints.every(row => row.length === 2) &&
      weight > 0 && surface.weights.every(row => row.every(w => Object.is(w, weight))),
    'PROFILE', 'Actual supports require one positive constant-weight Bezier Udegree1..2/Vdegree1');
    check(surface.knotsU.length === 2 * (surface.degreeU + 1) && surface.knotsV.length === 4 &&
      surface.knotsU.every((k, i) => equal(from(k), from(d.u[i <= surface.degreeU ? 0 : 1]))) &&
      surface.knotsV.every((k, i) => equal(from(k), from(d.v[i < 2 ? 0 : 1]))) &&
      q.compare(from(d.u[1]), from(d.u[0])) > 0 && q.compare(from(d.v[1]), from(d.v[0])) > 0,
    'PROFILE', 'Actual support knots must be a single clamped nonzero native rectangle');
    return [0, 1, 2].map(axis => {
      const up = [0, 1].map(j => toPower(surface.controlPoints.map(row => from(row[j][axis]))));
      const normalized = up[0].map((value, i) => [value, subR(up[1][i], value)]);
      const widthU = subR(from(d.u[1]), from(d.u[0])), widthV = subR(from(d.v[1]), from(d.v[0]));
      return compose(normalized,
        [[divR(q.neg(from(d.u[0])), widthU)], [divR(one, widthU)]],
        [[divR(q.neg(from(d.v[0])), widthV), divR(one, widthV)]]);
    });
  };
  const { lower, upper } = request;
  const lowerSection = lower.request.b.request.section, upperSection = upper.request.b.request.section;
  check(same(lower.request.a.request.section, lowerSection) && same(upper.request.a.request.section, upperSection),
    'BINDING', 'Each full operand must retain one unchanged paired-section recipe');
  check(same(lowerSection.request.assets[1], upperSection.request.assets[1]) &&
    same(lowerSection.originalModels[1], upperSection.originalModels[1]),
  'PROFILE', 'Both operands require the same complete original B asset and Model');
  const lowerA = lowerSection.request.assets[0].surface, upperA = upperSection.request.assets[0].surface;
  const bSupport = lowerSection.request.assets[1].surface;
  const lowerPower = lift(lowerA), upperPower = lift(upperA), bPower = lift(bSupport);
  const offset = read(lowerSection.proof.originalUB.offset);
  check(equal(read(lowerSection.proof.originalUB.scale), one) &&
    equal(read(upperSection.proof.originalUB.scale), one) && equal(read(upperSection.proof.originalUB.offset), offset),
  'PROFILE', 'Both original UB maps must retain the same exact offset and scale one');
  const zeroPolynomial = (p: P): boolean => p.every(row => row.every(v => v.n === 0n));
  check(zeroPolynomial(sub(lowerPower[0], U)) && zeroPolynomial(sub(lowerPower[1], V)) &&
    zeroPolynomial(sub(upperPower[0], U)) && zeroPolynomial(sub(upperPower[1], V)) &&
    zeroPolynomial(sub(bPower[0], sub(U, constant(offset)))) && zeroPolynomial(sub(bPower[2], V)) &&
    bPower[1].every(row => row.slice(1).every(v => v.n === 0n)),
  'PROFILE', 'Whole actual sources require unit X/Y axes and B.Y independent of original V');
  const window = lowerSection.request.uAInterval, lowerDomain = surfaceDomain(lowerA), upperDomain = surfaceDomain(upperA);
  check(same(window, upperSection.request.uAInterval) && same(lowerDomain, upperDomain) &&
    same(lower.request.b.report.window, upper.request.b.report.window) &&
    equal(read(lower.proof.material.cubeMap.lowY), from(lowerDomain.v[0])) &&
    equal(read(upper.proof.material.cubeMap.lowY), from(lowerDomain.v[0])) &&
    equal(read(lower.proof.material.cubeMap.lowZ), read(upper.proof.material.cubeMap.lowZ)),
  'PROFILE', 'Both operands require identical native footprint domains, low Y, old low Z and UA window');
  check(q.compare(from(window[1]), from(window[0])) > 0 &&
    q.compare(from(window[0]), from(lowerDomain.u[0])) >= 0 && q.compare(from(window[1]), from(lowerDomain.u[1])) <= 0,
  'DOMAIN', 'Actual shared original-UA window must be nonzero and contained without clipping');
  const heightY = sub(compose(bPower[1], add(U, constant(offset)), V), constant(from(lowerDomain.v[0])));
  const cubeY = add(constant(from(lowerDomain.v[0])), mul(heightY, V));
  const gap = sub(compose(upperPower[2], U, cubeY), compose(lowerPower[2], U, cubeY));
  const bernstein = (p: P, secondDegree: 0 | 1): R[][] => {
    const local = compose(p, [[from(window[0])], [subR(from(window[1]), from(window[0]))]], V);
    check(local.length <= 5 && local[0].length <= secondDegree + 1,
      'PROFILE', 'Whole strict roof proof must fit Bernstein Udegree4 and Sdegree0/1');
    return Array.from({ length: 5 }, (_, i) => Array.from({ length: secondDegree + 1 }, (_, j) => {
      let value = zero;
      for (let k = 0; k <= i && k < local.length; k++) for (let l = 0; l <= j && l < local[k].length; l++)
        if (local[k][l].n !== 0n) value = addR(value, mulR(local[k][l], mulR(
          divR(integer(choose[i][k]), integer(choose[4][k])),
          divR(integer(choose[j][l]), integer(choose[secondDegree][l])))));
      return value;
    }));
  };
  check(bernstein(heightY, 0).every(row => q.compare(row[0], zero) > 0),
    'PROFILE', 'Every whole height-Y Bernstein4 coefficient must be strictly positive');
  check(bernstein(gap, 1).every(row => row.every(value => q.compare(value, zero) > 0)),
    'PROFILE', 'Every whole upper-minus-lower roof-gap Bernstein4x1 coefficient must be strictly positive');

  const lowerCut = lower.request.b.edges.find(edge => edge.role === 'sharedCut');
  const upperCut = upper.request.b.edges.find(edge => edge.role === 'sharedCut');
  check(lowerCut !== undefined && upperCut !== undefined, 'BINDING', 'Actual paired B cut edges must resolve');
  check(new Set([lowerCut.curve.id, upperCut.curve.id, lowerCut.pcurve.curve.id, upperCut.pcurve.curve.id]).size === 4,
    'IDENTITY', 'Borrowed lower/upper World and UV Curve IDs must already be distinct');
  check(same(lowerCut.curve, lowerSection.world.curve) && same(upperCut.curve, upperSection.world.curve) &&
    same(lowerCut.pcurve.curve, lowerSection.pcurves.b.curve) && same(upperCut.pcurve.curve, upperSection.pcurves.b.curve) &&
    same(curveDomain(lowerCut.curve), window) && same(curveDomain(upperCut.curve), window),
  'BINDING', 'Both borrowed World/B-UV cuts retain their complete actual original-UA recipes');
  const columns = [
    [lower.request.a.edges[0].curve, upper.request.a.edges[0].curve],
    [upper.request.a.edges[4].curve, lower.request.a.edges[4].curve],
    [lower.request.a.edges[1].curve, upper.request.a.edges[1].curve],
  ] as const;
  columns.forEach(([first, second], index) => check(first.id !== second.id && first.degree === second.degree &&
    same(first.knots, second.knots) && same(first.weights, second.weights) && first.controlPoints.length === second.controlPoints.length,
  'PROFILE', 'Natural closure columns require distinct IDs and exactly compatible native bases/weights', null,
    (['yMin', 'xMin', 'xMax'] as const)[index]));

  // All source/profile/gap/compatibility admission above precedes the first native callback.
  const p = request.options.resultIdPrefix;
  const pointCopy = (point: Point): Point => [point[0], point[1], point[2]];
  const corner = (operand: typeof lower, role: 'cutLeft' | 'cutRight') => {
    const vertex = operand.request.b.vertices.find(value => value.role === role);
    check(vertex !== undefined, 'BINDING', 'Actual borrowed cut endpoint must resolve'); return vertex;
  };
  const rawCorners = [corner(lower, 'cutLeft'), corner(lower, 'cutRight'), corner(upper, 'cutRight'), corner(upper, 'cutLeft')] as const;
  const cornerRoles = ['lowerLeft', 'lowerRight', 'upperRight', 'upperLeft'] as const;
  const vertices = rawCorners.map((value, i) => ({ id: p + '_band_v' + i, role: cornerRoles[i],
    world: pointCopy(value.world), uv: pointCopy(value.uv) })) as PairedRoofDifferenceBand['vertices'];
  const line = (id: string, a: Point, b: Point): Curve => ({ kind: 'curve', id, degree: 1,
    knots: [0, 0, 1, 1], controlPoints: [pointCopy(a), pointCopy(b)], weights: [1, 1] });
  const connectors = [line(p + '_band_w0', vertices[1].world, vertices[2].world),
    line(p + '_band_w1', vertices[0].world, vertices[3].world)] as const;
  const uvConnectors = [line(p + '_band_uv0', vertices[1].uv, vertices[2].uv),
    line(p + '_band_uv1', vertices[0].uv, vertices[3].uv)] as const;
  const curves = [lowerCut.curve, connectors[0], upperCut.curve, connectors[1]] as const;
  const uvCurves = [lowerCut.pcurve.curve, uvConnectors[0], upperCut.pcurve.curve, uvConnectors[1]] as const;
  const curveEndpoints = [[0, 1], [1, 2], [3, 2], [0, 3]] as const;
  for (let i = 0; i < 4; i++) {
    const [a, b] = curveEndpoints[i], curve = curves[i], uv = uvCurves[i];
    check(same(curve.controlPoints[0], vertices[a].world) && same(curve.controlPoints[curve.controlPoints.length - 1], vertices[b].world) &&
      same(uv.controlPoints[0], vertices[a].uv) && same(uv.controlPoints[uv.controlPoints.length - 1], vertices[b].uv),
    'BINDING', 'Actual band endpoint bits must bind borrowed clamped cuts and connector lines', i, 'band');
  }
  for (const [lowerIndex, upperIndex] of [[0, 3], [1, 2]] as const) {
    check(equal(from(vertices[lowerIndex].uv[0]), from(vertices[upperIndex].uv[0])) &&
      equal(from(vertices[lowerIndex].world[0]), from(vertices[upperIndex].world[0])) &&
      equal(from(vertices[lowerIndex].world[1]), from(vertices[upperIndex].world[1])),
    'BINDING', 'Actual connector lines must retain fixed original UB and the same physical XY', null, 'band');
  }
  const borrowedRef = (operand: 'lower' | 'upper'): PairedRoofDifferenceSourceRef => {
    const input = request[operand].request.b, cut = operand === 'lower' ? lowerCut : upperCut;
    const objectIndex = input.world.model.objects.findIndex(object => object.id === cut.curve.id);
    check(objectIndex >= 0 && same(input.world.model.objects[objectIndex], cut.curve),
      'BINDING', 'Borrowed cut must resolve in its complete original B World Model');
    return { sourceId: input.request.section.request.assets[1].sourceId,
      sourceField: 'request.' + operand + '.request.b.world.source',
      modelField: 'request.' + operand + '.request.b.world.model',
      modelName: input.world.model.name, objectIndex, objectId: cut.curve.id };
  };
  const lowerCutRef = borrowedRef('lower'), upperCutRef = borrowedRef('upper');
  callbacks.prefix({ vertices, connectors, uvConnectors });
  for (const i of [0, 1] as const) {
    callbacks.validateCurve(connectors[i], 'band-world', i); callbacks.prefix({ vertices, connectors, uvConnectors });
    callbacks.validateCurve(uvConnectors[i], 'band-uv', i); callbacks.prefix({ vertices, connectors, uvConnectors });
  }
  const model: Model = { name: p + '_band_model', version: 0, lengthUnit: 'mm', objects: [bSupport, ...curves] };
  const world = callbacks.adopt(model, p + '_band_source', 'band', null);
  check(world.sourceId === p + '_band_source' && world.sourceVersion === 0 && same(world.model, model),
    'BINDING', 'Actual adopted B-band Source must preserve the complete World Model5', null, 'band');
  const worldRef = (index: number, objectId: string): PairedRoofDifferenceSourceRef => ({
    sourceId: world.sourceId, sourceField: 'geometry.band.world.source', modelField: 'geometry.band.world.model',
    modelName: world.model.name, objectIndex: index, objectId,
  });
  const selection = lowerSection.report.selections[1];
  const supportRef: PairedRoofDifferenceSourceRef = { sourceId: selection.sourceId,
    sourceField: 'request.lower.request.b.request.section.request.assets[1].source',
    modelField: 'request.lower.request.b.request.section.originalModels[1]', modelName: selection.modelName,
    objectIndex: selection.objectIndex, objectId: bSupport.id };
  const edgeRoles = ['lowerCut', 'right', 'upperCut', 'left'] as const;
  const edges = curves.map((curve, i) => ({ id: p + '_band_e' + i, role: edgeRoles[i], curve,
    vertexIds: [vertices[curveEndpoints[i][0]].id, vertices[curveEndpoints[i][1]].id] as [string, string],
    pcurve: { coordinateSystem: 'original-native-uv' as const, lengthUnit: 'dimensionless' as const, curve: uvCurves[i] },
    curveRef: i === 0 ? lowerCutRef : i === 2 ? upperCutRef : worldRef(i + 1, curve.id), origin: i === 0 || i === 2 ? {
      kind: 'borrowed-paired-cut' as const, operand: i === 0 ? 'lower' as const : 'upper' as const,
      sourceField: 'request.' + (i === 0 ? 'lower' : 'upper') + '.request.b.edges[' +
        (i === 0 ? lower.request.b.edges.indexOf(lowerCut) : upper.request.b.edges.indexOf(upperCut)) + '].curve',
    } : { kind: 'fixed-original-ub-line' as const, operand: null, sourceField: null },
  })) as PairedRoofDifferenceBand['edges'];
  const use = (edgeIndex: number, sense: 'forward' | 'reverse', index: number): PairedRoofDifferenceBand['loop']['uses'][number] => ({
    id: p + '_band_use' + index, edgeId: edges[edgeIndex].id,
    vertexIds: sense === 'forward' ? [...edges[edgeIndex].vertexIds] : [edges[edgeIndex].vertexIds[1], edges[edgeIndex].vertexIds[0]],
    sense, interval: curveDomain(edges[edgeIndex].curve), pcurveId: edges[edgeIndex].pcurve.curve.id,
  });
  const band: PairedRoofDifferenceBand = { world, support: bSupport, supportRef, vertices, edges,
    loop: { id: p + '_band_l', uses: [use(3, 'forward', 0), use(2, 'forward', 1), use(1, 'reverse', 2), use(0, 'reverse', 3)] },
    face: { id: p + '_band_f', sourceId: selection.sourceId, surfaceId: bSupport.id,
      outerLoopId: p + '_band_l', orientation: 'reverse', region: 'between-two-cuts' } };
  const closures: PairedRoofDifferenceClosures[number][] = [];
  callbacks.prefix({ band, closures });
  for (const i of [0, 1, 2] as const) {
    const [first, second] = columns[i], role = (['yMin', 'xMin', 'xMax'] as const)[i];
    const ruled = callbacks.buildRuled(first, second, { surfaceId: p + '_c' + i + '_s' }, i);
    callbacks.prefix({ band, closures, ruled });
    const ids = (kind: string): [string, string, string, string] => [p + '_c' + i + '_' + kind + '0',
      p + '_c' + i + '_' + kind + '1', p + '_c' + i + '_' + kind + '2', p + '_c' + i + '_' + kind + '3'];
    const faceIds: FaceIds = { faceId: p + '_c' + i + '_f', loopId: p + '_c' + i + '_l',
      vertexIds: ids('v'), edgeIds: ids('e'), curveIds: ids('b') };
    const face = callbacks.buildFace(ruled.surface, faceIds, i);
    callbacks.prefix({ band, closures, ruled, face });
    const closureWorld = callbacks.adopt(face.geometry, p + '_c' + i + '_source', 'closure', i);
    check(closureWorld.sourceId === p + '_c' + i + '_source' && closureWorld.sourceVersion === 0 &&
      same(closureWorld.model, face.geometry) && closureWorld.model.objects.length === 5,
    'BINDING', 'Actual natural closure Source must preserve the complete FaceModel5', null, role);
    closures.push({ role, ruled, faceIds, face, world: closureWorld });
    callbacks.prefix({ band, closures });
  }
  return { band, closures: [closures[0], closures[1], closures[2]] };
}
