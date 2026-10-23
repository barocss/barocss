import type { Point, Curve, Surface, Model } from '../types.js';
import type { FaceBundle, FaceIds } from '../core/face.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { PairedSurfaceMaterialBodyRequest } from './paired-surface-material-body.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from '../section-rational-internal.js';

type F = SectionFraction;
type R = SectionRational;
type Sense = 'forward' | 'reverse';
type ClosureRole = 'yMin' | 'zMin' | 'xMin' | 'xMax';
type FaceRole = 'roof' | 'side' | ClosureRole;
type EdgeRole = 'cut' | 'roofYMin' | 'roofXMin' | 'roofXMax' | 'sideZMin' | 'sideXMin' | 'sideXMax' |
  'lowYLowZ' | 'lowYXMin' | 'lowYXMax' | 'lowZXMin' | 'lowZXMax';
type SourceRef = { sourceId: string; sourceField: string; modelField: string; modelName: string; objectIndex: number; objectId: string };
type SourceModel = { sourceId: string; source: string; sourceVersion: 0; model: Model };
type Closure = { role: ClosureRole; lowCurve: Curve; ruled: CompatibleRuledSurfaceResult;
  faceIds: FaceIds; face: FaceBundle; world: SourceModel };
type Closures = [Closure, Closure, Closure, Closure];
type LocalFaceRef = { kind: 'a' | 'b' | 'closure'; closureIndex: number | null; faceId: string; loopId: string;
  supportRef: SourceRef; sourceField: string; modelField: string };
type LocalVertexRef = { face: LocalFaceRef; vertexId: string; world: Point };
type LocalUseRef = { face: LocalFaceRef; edgeId: string; useId: string | null; curveId: string;
  localVertexIds: [string, string]; localCurve: Curve;
  pcurve: { kind: 'native-curve'; curve: Curve } |
    { kind: 'native-line'; domain: [number, number]; uv0: [number, number]; uv1: [number, number] };
  sense: Sense; interval: [number, number]; curveRef: SourceRef };
type ParameterMap = { canonicalDomain: [number, number]; localDomain: [number, number]; offset: F; scale: F;
  localEndpointParameters: [number, number]; endpointResiduals: [F, F]; wholeCurveResiduals: F[][]; proofDegree: 4 };
type GlobalUse = { id: string; faceId: string; loopId: string; edgeId: string; vertexIds: [string, string];
  sense: Sense; origin: LocalUseRef; parameterMap: ParameterMap };
type Vertex = { id: string; world: Point; members: LocalVertexRef[] };
type Edge = { id: string; role: EdgeRole; curve: Curve; curveRef: SourceRef; vertexIds: [string, string];
  parameterRange: [number, number]; uses: [GlobalUse, GlobalUse] };
type Loop = { id: string; faceId: string; uses: [GlobalUse, GlobalUse, GlobalUse, GlobalUse] };
type Face = { id: string; role: FaceRole; support: Surface; supportRef: SourceRef; origin: LocalFaceRef;
  orientation: Sense; outerLoopId: string; loop: Loop };
type Shell = { id: string; faceIds: [string, string, string, string, string, string]; closed: true; oriented: true };
type Body = { id: string; shellIds: [string]; materialCertificateId: string; closed: true; solid: true; restrictedSolidCertified: true };
type Graph = { vertices: Vertex[]; edges: Edge[]; faces: Face[]; shell: Shell; body: Body };
type FaceImage = { faceId: string; role: FaceRole; supportRef: SourceRef; originalSupport: Surface;
  nativeDomains: { u: [number, number]; v: [number, number] };
  cubeRestriction: 't=1' | 's=1' | 's=0' | 't=0' | 'u=uMin' | 'u=uMax';
  chartVariables: ['u', 's'] | ['u', 't'] | ['s', 't'];
  nativeUVPower: F[][][]; actualCartesian: F[][][]; expectedCartesian: F[][][]; residuals: F[][][];
  proofDegrees: { first: 4; second: 1 }; wholeImageEqual: true;
  outward: { axis: 'x' | 'y' | 'z'; sign: -1 | 1; principalCoefficients: F[]; minimumAbsolute: F };
  storedLocalUsesUnchanged: true };
type EdgePair = { edgeId: string; role: EdgeRole; canonicalCurveRef: SourceRef;
  occurrences: [{ useId: string; origin: LocalUseRef; parameterMap: ParameterMap },
    { useId: string; origin: LocalUseRef; parameterMap: ParameterMap }];
  oppositeEffectiveUses: true; exactWholeWorldImage: true };
type Germ = { edgeId: string; endpointIndex: 0 | 1 };
type VertexLink = { vertexId: string; germs: [Germ, Germ, Germ];
  cornerArcs: { faceId: string; incomingUseId: string; outgoingUseId: string; from: Germ; to: Germ }[];
  cycle: Germ[]; connected: true; degreeTwo: true };
type MaterialProof = { certificateId: string; bodyId: string; shellId: string; faceIds: string[]; sourceRefs: SourceRef[];
  profile: { aXIdentity: true; aYIdentity: true; bXShiftIdentity: true; bZIdentity: true;
    originalUBOffset: F; originalUBScale: F; unitPositiveAxes: true; constantPositiveWeights: true;
    bYPower: F[]; aZPower: F[][]; sourceResiduals: F[][][] };
  cubeMap: { domain: { u: [number, number]; s: [0, 1]; t: [0, 1] }; lowY: F; lowZ: F;
    heightYBernstein: F[]; heightZBernstein: F[][]; heightProofUDegree: 4; heightProofSDegree: 1;
    minimumHeightY: F; minimumHeightZ: F; jacobianBernstein: F[][];
    jacobianDegrees: { u: 8; s: 1 }; minimumJacobian: F;
    inverse: 'u=X;s=(Y-lowY)/heightY(u);t=(Z-lowZ)/heightZ(u,s)'; globallyInjective: true };
  faceImages: [FaceImage, FaceImage, FaceImage, FaceImage, FaceImage, FaceImage];
  volume: { exactVolumeMM3: F; integrandBernstein: F[]; degree: 8; integrationResidual: F; unit: 'mm3' };
  sourceDefinedOccupiedRegion: true; wholeBoundaryImage: true; outwardMaterial: true;
  embeddedClosedBoundary: true; restrictedSolidCertified: true; parentFlagsUnchanged: true };
type Proof = { schema: 'barocss-paired-surface-material-body-proof'; version: 0; correspondence: EdgePair[];
  vertexClasses: { vertexId: string; members: LocalVertexRef[] }[]; vertexLinks: VertexLink[];
  faceAdjacency: { faceId: string; adjacentFaceIds: string[] }[]; sourceInventory: SourceRef[];
  eulerCharacteristic: 2; connectedFaceGraph: true; material: MaterialProof };
export type PairedSurfaceMaterialBodyClosure = Closure;
export type PairedSurfaceMaterialBodyClosures = Closures;
export type PairedSurfaceMaterialBodyGraph = Graph;
export type PairedSurfaceMaterialBodyProof = Proof;
export type PairedSurfaceMaterialBodySourceRef = SourceRef;
export type PairedSurfaceMaterialBodyLocalFaceRef = LocalFaceRef;
export type PairedSurfaceMaterialBodyLocalVertexRef = LocalVertexRef;
export type PairedSurfaceMaterialBodyLocalUseRef = LocalUseRef;
export type PairedSurfaceMaterialBodyParameterMap = ParameterMap;
export type PairedSurfaceMaterialBodyGlobalUse = GlobalUse;
export type PairedSurfaceMaterialBodyVertex = Vertex;
export type PairedSurfaceMaterialBodyEdge = Edge;
export type PairedSurfaceMaterialBodyLoop = Loop;
export type PairedSurfaceMaterialBodyFace = Face;
export type PairedSurfaceMaterialBodyShell = Shell;
export type PairedSurfaceMaterialBodyBody = Body;

export class PairedSurfaceMaterialBodyProofError extends Error {
  readonly code: 'PROFILE' | 'DOMAIN' | 'TOPOLOGY' | 'MATERIAL' | 'ORIENTATION' | 'BINDING' | 'REPRESENTABILITY';
  readonly edgeIndex: number | null; readonly faceRole: FaceRole | null;
  constructor(code: PairedSurfaceMaterialBodyProofError['code'], detail: string,
    edgeIndex: number | null = null, faceRole: FaceRole | null = null, cause?: unknown) {
    super(('Paired Surface material proof: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedSurfaceMaterialBodyProofError'; this.code = code;
    this.edgeIndex = edgeIndex; this.faceRole = faceRole;
  }
}

/** Entire actual boundary/graph/source-defined material proof; no provider or qFloat calls. */
export function provePairedSurfaceMaterialBodyTrusted(
  request: PairedSurfaceMaterialBodyRequest, closures: Closures, graph: Graph, q: SectionRationalContext,
): Proof {
  function check(condition: boolean, code: PairedSurfaceMaterialBodyProofError['code'], detail: string,
    edgeIndex: number | null = null, faceRole: FaceRole | null = null): asserts condition {
    if (!condition) throw new PairedSurfaceMaterialBodyProofError(code, detail, edgeIndex, faceRole);
  }
  const same = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
      return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
    }
    return Object.is(a, b);
  };
  const zero = q.integer(0), one = q.integer(1);
  // Request-local exact lifts and trivial identities reuse this SAME bounded q.
  const numbers = new Map<number, R>(), integers = new Map<number, R>(), fractions = new Map<string, R>();
  const from = (value: number): R => {
    let result = numbers.get(value);
    if (result === undefined) { result = q.from(value); numbers.set(value, result); }
    return result;
  };
  const integer = (value: number): R => {
    let result = integers.get(value);
    if (result === undefined) { result = q.integer(value); integers.set(value, result); }
    return result;
  };
  const read = (f: F): R => {
    const key = f.numerator + '/' + f.denominator;
    let result = fractions.get(key);
    if (result === undefined) { result = q.rat(BigInt(f.numerator), BigInt(f.denominator)); fractions.set(key, result); }
    return result;
  };
  const addR = (a: R, b: R): R => a.n === 0n ? b : b.n === 0n ? a : q.add(a, b);
  const subR = (a: R, b: R): R => b.n === 0n ? a : a.n === b.n && a.d === b.d ? zero : q.sub(a, b);
  const mulR = (a: R, b: R): R => a.n === 0n || b.n === 0n ? zero :
    a.n === a.d ? b : b.n === b.d ? a : a.n === -a.d ? q.neg(b) : b.n === -b.d ? q.neg(a) : q.mul(a, b);
  const ratios = new Map<string, R>();
  const divR = (a: R, b: R): R => {
    if (b.n !== 0n && a.n === 0n) return zero;
    if (b.n === b.d) return a;
    const key = a.n + '/' + a.d + ':' + b.n + '/' + b.d;
    let result = ratios.get(key);
    if (result === undefined) { result = q.div(a, b); ratios.set(key, result); }
    return result;
  };
  const equal = (a: R, b: R): boolean => q.compare(a, b) === 0;
  const text = (v: R[]): F[] => v.map(x => q.text(x));
  const textGrid = (v: R[][]): F[][] => v.map(text);
  const textTensor = (v: R[][][]): F[][][] => v.map(textGrid);
  const minimum = (v: R[]): R => v.reduce((a, b) => q.compare(a, b) < 0 ? a : b);
  type P = R[][];
  const at = (p: P, i: number, j: number): R => p[i]?.[j] ?? zero;
  const normalize = (p: P): P => {
    let n = p.length, m = Math.max(1, ...p.map(row => row.length));
    while (n > 1 && p[n - 1].every(x => x.n === 0n)) n--;
    while (m > 1 && p.slice(0, n).every(row => (row[m - 1]?.n ?? 0n) === 0n)) m--;
    return Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => at(p, i, j)));
  };
  const constant = (v: R): P => [[v]];
  const U: P = [[zero], [one]], V: P = [[zero, one]];
  const add = (a: P, b: P): P => normalize(Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    Array.from({ length: Math.max(a[0].length, b[0].length) }, (_, j) => addR(at(a, i, j), at(b, i, j)))));
  const scale = (p: P, k: R): P => normalize(p.map(row => row.map(v => mulR(v, k))));
  const sub = (a: P, b: P): P => add(a, scale(b, q.neg(one)));
  const mul = (a: P, b: P): P => {
    const result = Array.from({ length: a.length + b.length - 1 }, () => Array.from({ length: a[0].length + b[0].length - 1 }, () => zero));
    for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i].length; j++) if (a[i][j].n !== 0n)
      for (let k = 0; k < b.length; k++) for (let l = 0; l < b[k].length; l++) if (b[k][l].n !== 0n)
        result[i + k][j + l] = addR(result[i + k][j + l], mulR(a[i][j], b[k][l]));
    return normalize(result);
  };
  const compose = (p: P, u: P, v: P): P => {
    if (u === U && v === V) return p;
    let result = constant(zero);
    for (let i = p.length - 1; i >= 0; i--) {
      let row = constant(zero);
      for (let j = p[i].length - 1; j >= 0; j--) row = add(mul(row, v), constant(p[i][j]));
      result = add(mul(result, u), row);
    }
    return result;
  };
  const derivative = (p: P, axis: 0 | 1): P => axis === 0 ? p.length <= 1 ? constant(zero) :
    normalize(p.slice(1).map((row, i) => row.map(v => mulR(integer(i + 1), v)))) :
    normalize(p.map(row => row.slice(1).map((v, j) => mulR(integer(j + 1), v))));
  const binomial = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    let result = 1; for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i; return result;
  };
  const bernsteinPower = (values: R[]): R[] => Array.from({ length: values.length }, (_, k) => {
    let result = zero;
    for (let j = 0; j <= k; j++) {
      const term = mulR(integer(binomial(k, j)), values[j]);
      result = addR(result, (k - j) % 2 ? q.neg(term) : term);
    }
    return mulR(integer(binomial(values.length - 1, k)), result);
  });
  const bernstein = (p: P, n: number, m: number, first: [number, number]): R[][] => {
    const local = first[0] === 0 && first[1] === 1 ? p :
      compose(p, [[from(first[0])], [subR(from(first[1]), from(first[0]))]], V);
    check(local.length <= n + 1 && local[0].length <= m + 1, 'MATERIAL', 'Whole proof polynomial degree exceeds the frozen bound');
    return Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => {
      let value = zero;
      for (let k = 0; k <= i && k < local.length; k++) for (let l = 0; l <= j && l < local[k].length; l++) if (local[k][l].n !== 0n)
        value = addR(value, mulR(local[k][l], mulR(divR(integer(binomial(i, k)), integer(binomial(n, k))),
          divR(integer(binomial(j, l)), integer(binomial(m, l))))));
      return value;
    }));
  };
  const tensorGrid = (axes: R[][][]): R[][][] => axes[0].map((row, i) => row.map((_, j) => axes.map(axis => axis[i][j])));
  const domain = (curve: Curve): [number, number] => [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
  const surfaceDomain = (s: Surface) => ({ u: [s.knotsU[s.degreeU], s.knotsU[s.controlPoints.length]] as [number, number],
    v: [s.knotsV[s.degreeV], s.knotsV[s.controlPoints[0].length]] as [number, number] });
  const surfaceCache = new WeakMap<Surface, P[]>();
  const liftSurface = (surface: Surface): P[] => {
    const cached = surfaceCache.get(surface); if (cached) return cached;
    const d = surfaceDomain(surface), weight = surface.weights[0][0];
    check(surface.degreeU >= 1 && surface.degreeU <= 2 && surface.degreeV === 1 &&
      surface.controlPoints.length === surface.degreeU + 1 && surface.controlPoints.every(row => row.length === 2) &&
      weight > 0 && surface.weights.every(row => row.every(w => Object.is(w, weight))), 'PROFILE', 'Actual support must be one constant-positive-weight Bezier Udegree≤2/V1');
    const result = [0, 1, 2].map(axis => {
      const up = [0, 1].map(j => bernsteinPower(surface.controlPoints.map(row => from(row[j][axis]))));
      const normalized = up[0].map((value, i) => [value, subR(up[1][i], value)]);
      return compose(normalized, [[divR(q.neg(from(d.u[0])), subR(from(d.u[1]), from(d.u[0])))],
        [divR(one, subR(from(d.u[1]), from(d.u[0])))]],
        [[divR(q.neg(from(d.v[0])), subR(from(d.v[1]), from(d.v[0]))), divR(one, subR(from(d.v[1]), from(d.v[0])))]]);
    });
    surfaceCache.set(surface, result); return result;
  };

  check(same(request.a.request.section, request.b.request.section), 'BINDING', 'Both full Face parents must retain the SAME complete exact paired section');
  const section = request.a.request.section, aSurface = section.request.assets[0].surface, bSurface = section.request.assets[1].surface;
  const aPower = liftSurface(aSurface), bPower = liftSurface(bSurface), window = section.request.uAInterval;
  const offset = read(section.proof.originalUB.offset), ubScale = read(section.proof.originalUB.scale);
  check(equal(ubScale, one), 'PROFILE', 'First material profile requires originalUB scale exactly one');
  const profileResiduals = [sub(aPower[0], U), sub(aPower[1], V), constant(zero),
    sub(bPower[0], sub(U, constant(offset))), constant(zero), sub(bPower[2], V)];
  check(profileResiduals.every(p => p.every(row => row.every(v => v.n === 0n))) &&
    bPower[1].every(row => row.slice(1).every(v => v.n === 0n)),
  'PROFILE', 'Actual full unit physical-axis/forbidden-term source coefficients must be zero');
  const originalResiduals = [aSurface, bSurface].flatMap((s, index) => Array.from({ length: s.degreeU + 1 }, (_, i) =>
    [0, 1].map(j => [0, 1, 2].map(axis => {
      const forbidden = index === 0 ? axis === 0 ? sub(aPower[0], U) : axis === 1 ? sub(aPower[1], V) : constant(zero)
        : axis === 0 ? sub(bPower[0], sub(U, constant(offset))) : axis === 2 ? sub(bPower[2], V)
          : j === 1 ? bPower[1] : constant(zero);
      return at(forbidden, i, j);
    }))));
  const lowY = from(surfaceDomain(aSurface).v[0]), lowZ = from(surfaceDomain(bSurface).v[0]);
  const roofY = compose(bPower[1], add(U, constant(offset)), constant(zero));
  const heightY = sub(roofY, constant(lowY));
  const cubeY = add(constant(lowY), mul(heightY, V));
  const heightZ = sub(compose(aPower[2], U, cubeY), constant(lowZ));
  const hyBern = bernstein(heightY, 4, 0, window).map(row => row[0]);
  const hzBern = bernstein(heightZ, 4, 1, window);
  check(hyBern.every(v => q.compare(v, zero) > 0) && hzBern.every(row => row.every(v => q.compare(v, zero) > 0)),
    'MATERIAL', 'Every whole Bernstein4 height coefficient must be strictly positive');
  const jacobian = mul(heightY, heightZ), jacBern = bernstein(jacobian, 8, 1, window);
  check(jacBern.every(row => row.every(v => q.compare(v, zero) > 0)), 'MATERIAL', 'Entire positive Jacobian hull required');

  const faceRoles: FaceRole[] = ['roof', 'side', 'yMin', 'zMin', 'xMin', 'xMax'];
  const closureRoles: ClosureRole[] = ['yMin', 'zMin', 'xMin', 'xMax'];
  const edgeRoles: EdgeRole[] = ['cut', 'roofYMin', 'roofXMin', 'roofXMax', 'sideZMin', 'sideXMin', 'sideXMax',
    'lowYLowZ', 'lowYXMin', 'lowYXMax', 'lowZXMin', 'lowZXMax'];
  check(graph.vertices.length === 8 && graph.edges.length === 12 && graph.faces.length === 6 && closures.length === 4 &&
    graph.faces.every((f, i) => f.role === faceRoles[i]) && graph.edges.every((e, i) => e.role === edgeRoles[i]) &&
    closures.every((c, i) => c.role === closureRoles[i]), 'TOPOLOGY', 'Exact ordered8V/12E/6F/four-closure graph required');
  check(request.a.faces[0].orientation === 'forward' && request.b.faces[0].orientation === 'reverse' &&
    graph.faces.every((f, i) => f.orientation === (i === 1 ? 'reverse' : 'forward')),
  'ORIENTATION', 'Selected stored parent and outward-factory closure orientations must be imported unchanged');
  check(same(graph.shell.faceIds, graph.faces.map(f => f.id)) && same(graph.body.shellIds, [graph.shell.id]) &&
    graph.shell.closed && graph.shell.oriented && graph.body.closed && graph.body.solid && graph.body.restrictedSolidCertified,
  'TOPOLOGY', 'Actual Shell/Body identity must bind this complete six-Face graph');
  const inventory = new Map<string, SourceRef>();
  const path = (name: string): unknown => {
    const parts = name.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? [];
    let value: unknown = { request, closures };
    for (const part of parts) {
      check(value !== null && typeof value === 'object' && Object.hasOwn(value, part), 'BINDING', 'Source reference path must resolve actual retained data');
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };
  const resolve = (ref: SourceRef): Curve | Surface => {
    const parentMatch = /^request\.(a|b)\.world\.source$/.exec(ref.sourceField);
    const originalMatch = /^request\.(a|b)\.request\.section\.request\.assets\[(0|1)\]\.source$/.exec(ref.sourceField);
    const closureMatch = /^closures\[(0|1|2|3)\]\.(world|ruled)\.source$/.exec(ref.sourceField);
    let modelField: string, sourceId: string;
    if (parentMatch) {
      const side = parentMatch[1] as 'a' | 'b', index = side === 'a' ? 0 : 1;
      modelField = `request.${side}.world.model`; sourceId = section.request.assets[index].sourceId;
    } else if (originalMatch) {
      const side = originalMatch[1], index = Number(originalMatch[2]);
      modelField = `request.${side}.request.section.originalModels[${index}]`; sourceId = section.request.assets[index].sourceId;
    } else {
      check(closureMatch !== null, 'BINDING', 'Only actual original/trimmed/closure source paths are permitted');
      const index = Number(closureMatch[1]); modelField = `closures[${index}].${closureMatch[2]}.model`;
      sourceId = closures[index].world.sourceId;
    }
    check(ref.sourceId === sourceId && ref.modelField === modelField && typeof path(ref.sourceField) === 'string',
      'BINDING', 'Actual source-qualified reference field/source identity changed');
    const model = path(ref.modelField) as Model;
    check(model.name === ref.modelName && Number.isInteger(ref.objectIndex) && ref.objectIndex >= 0 &&
      ref.objectIndex < model.objects.length && model.objects[ref.objectIndex].id === ref.objectId,
    'BINDING', 'Actual native Model/name/object selector must resolve');
    inventory.set([ref.sourceId, ref.sourceField, ref.modelField, ref.modelName, ref.objectIndex, ref.objectId].join('|'), { ...ref });
    return model.objects[ref.objectIndex];
  };
  const localDefinitions = graph.faces.map((face, index) => {
    const origin = face.origin;
    if (index < 2) {
      const parent = index === 0 ? request.a : request.b, selected = parent.faces[0], loop = parent.loops[0];
      check(origin.kind === (index === 0 ? 'a' : 'b') && origin.closureIndex === null && origin.faceId === selected.id &&
        origin.loopId === loop.id && selected.surfaceId === face.support.id && same(face.support, index === 0 ? aSurface : bSurface),
      'BINDING', 'Actual selected trimmed Face origin/support must resolve', null, face.role);
      check(same(resolve(face.supportRef), face.support) && same(origin.supportRef, face.supportRef) &&
        origin.sourceField === face.supportRef.sourceField && origin.modelField === face.supportRef.modelField,
      'BINDING', 'Actual trimmed support source binding required', null, face.role);
      return { origin, vertices: parent.vertices.filter(v => loop.uses.some(use => use.vertexIds.includes(v.id)))
        .map(v => ({ id: v.id, world: v.world })), uses: loop.uses.map(use => {
        const edge = parent.edges.find(e => e.id === use.edgeId);
        check(edge !== undefined, 'BINDING', 'Actual trimmed local Use edge must resolve');
        return { edgeId: edge.id, useId: use.id, curve: edge.curve, vertices: use.vertexIds,
          pcurve: { kind: 'native-curve' as const, curve: edge.pcurve.curve }, sense: use.sense, interval: use.interval };
      }) };
    }
    const closure = closures[index - 2], parent = closure.face, model = closure.world.model;
    check(origin.kind === 'closure' && origin.closureIndex === index - 2 && origin.faceId === parent.topology.face.id &&
      origin.loopId === parent.topology.loop.id && parent.topology.face.orientation === 'forward' &&
      same(model, parent.geometry) && model.objects.length === 5 && same(face.support, closure.ruled.surface) &&
      same(resolve(face.supportRef), face.support) && same(origin.supportRef, face.supportRef) &&
      origin.sourceField === face.supportRef.sourceField && origin.modelField === face.supportRef.modelField,
    'BINDING', 'Actual forward closure Face/Ruled/Model5/source binding required', null, face.role);
    const columns = index === 2 ? [closure.lowCurve, request.a.edges[0].curve]
      : index === 3 ? [request.b.edges[0].curve, closure.lowCurve]
        : index === 4 ? [request.a.edges[4].curve, closure.lowCurve] : [closure.lowCurve, request.a.edges[1].curve];
    const s = face.support;
    check(columns.every(c => c.degree === s.degreeU && same(c.knots, s.knotsU)) &&
      s.controlPoints.every((row, i) => row.every((point, j) => same(point, columns[j].controlPoints[i]))) &&
      s.weights.every((row, i) => row.every((weight, j) => Object.is(weight, columns[j].weights[i]))) &&
      same(closure.ruled.first, columns[0]) && same(closure.ruled.second, columns[1]) &&
      closure.ruled.sourceVersion === 0 && closure.ruled.model.objects.length === 3 &&
      closure.ruled.model.objects.some(o => same(o, columns[0])) &&
      closure.ruled.model.objects.some(o => same(o, columns[1])) &&
      closure.ruled.model.objects.some(o => same(o, s)),
    'BINDING', 'Actual frozen outward Ruled factory column ordering and every pole/weight required', null, face.role);
    return { origin, vertices: parent.topology.vertices.map(v => ({ id: v.id, world: v.point })),
      uses: parent.topology.loop.uses.map(use => {
        const edge = parent.topology.edges.find(e => e.id === use.edgeId);
        check(edge !== undefined, 'BINDING', 'Actual natural local Use edge must resolve');
        const curve = model.objects.find(o => o.id === edge.curveId);
        check(curve !== undefined && curve.kind === 'curve', 'BINDING', 'Actual natural Curve must resolve');
        return { edgeId: edge.id, useId: null, curve, vertices: edge.vertexIds,
          pcurve: { kind: 'native-line' as const, domain: use.pcurve.domain, uv0: use.pcurve.uv0, uv1: use.pcurve.uv1 },
          sense: use.sense, interval: domain(curve) };
      }) };
  });
  // Whole Source image equality for each restriction of the actual occupied cube.
  const faceImages = graph.faces.map((face, index): FaceImage => {
    const first: [number, number] = index < 4 ? window : [0, 1];
    const hzTop = heightZ, hzSide = compose(heightZ, U, constant(one));
    let nativeU: P, nativeV: P, expected: P[], restriction: FaceImage['cubeRestriction'], variables: FaceImage['chartVariables'];
    if (index === 0) {
      nativeU = U; nativeV = cubeY; expected = [U, cubeY, add(constant(lowZ), hzTop)]; restriction = 't=1'; variables = ['u', 's'];
    } else if (index === 1) {
      nativeU = add(U, constant(offset)); nativeV = add(constant(lowZ), mul(hzSide, V));
      expected = [U, roofY, nativeV]; restriction = 's=1'; variables = ['u', 't'];
    } else if (index === 2) {
      nativeU = U; nativeV = V; const h = compose(heightZ, U, constant(zero));
      expected = [U, constant(lowY), add(constant(lowZ), mul(h, V))]; restriction = 's=0'; variables = ['u', 't'];
    } else if (index === 3) {
      nativeU = add(U, constant(offset)); nativeV = sub(constant(one), V);
      expected = [U, cubeY, constant(lowZ)]; restriction = 't=0'; variables = ['u', 's'];
    } else {
      const c = from(window[index === 4 ? 0 : 1]), y = compose(cubeY, constant(c), U), h = compose(heightZ, constant(c), U);
      nativeU = U; nativeV = index === 4 ? sub(constant(one), V) : V;
      expected = [constant(c), y, add(constant(lowZ), mul(h, V))];
      restriction = index === 4 ? 'u=uMin' : 'u=uMax'; variables = ['s', 't'];
    }
    const axes = liftSurface(face.support), actual = axes.map(p => compose(p, nativeU, nativeV));
    const actualBern = tensorGrid(actual.map(p => bernstein(p, 4, 1, first)));
    const expectedBern = tensorGrid(expected.map(p => bernstein(p, 4, 1, first)));
    const residuals = actualBern.map((row, i) => row.map((point, j) => point.map((value, k) => subR(value, expectedBern[i][j][k]))));
    check(residuals.every(row => row.every(point => point.every(v => v.n === 0n))), 'REPRESENTABILITY',
      'Every actual whole Source Face image must equal its entire cube restriction', null, face.role);
    const native = surfaceDomain(face.support);
    const domains = [native.u, native.v], uvMaps = [nativeU, nativeV];
    for (let k = 0; k < 2; k++) {
      const coefficients = bernstein(uvMaps[k], 4, 1, first).flat();
      check(coefficients.every(v => q.compare(v, from(domains[k][0])) >= 0 && q.compare(v, from(domains[k][1])) <= 0),
      'DOMAIN', 'Entire native Face chart restriction must remain inside its actual support domain', null, face.role);
    }
    const su = axes.map(p => derivative(p, 0)), sv = axes.map(p => derivative(p, 1));
    const axis: 'x' | 'y' | 'z' = index === 0 || index === 3 ? 'z' : index === 1 || index === 2 ? 'y' : 'x';
    const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2, i = (k + 1) % 3, j = (k + 2) % 3;
    let principal = compose(sub(mul(su[i], sv[j]), mul(su[j], sv[i])), nativeU, nativeV);
    if (face.orientation === 'reverse') principal = scale(principal, q.neg(one));
    check(principal.every(row => row.slice(1).every(v => v.n === 0n)), 'ORIENTATION', 'Frozen outward principal component must be independent of second chart coordinate', null, face.role);
    const sign: -1 | 1 = index === 0 || index === 1 || index === 5 ? 1 : -1;
    const coefficients = bernstein(principal, 4, 0, first).map(row => row[0]);
    const magnitudes = coefficients.map(v => mulR(integer(sign), v));
    check(magnitudes.every(v => q.compare(v, zero) > 0), 'ORIENTATION', 'Actual source normal must be strictly outward with encoded parent orientation applied once', null, face.role);
    const uvPower = Array.from({ length: 5 }, (_, u) => Array.from({ length: 2 }, (_, v) => [at(nativeU, u, v), at(nativeV, u, v)]));
    return { faceId: face.id, role: face.role, supportRef: { ...face.supportRef }, originalSupport: face.support,
      nativeDomains: native, cubeRestriction: restriction, chartVariables: variables, nativeUVPower: textTensor(uvPower),
      actualCartesian: textTensor(actualBern), expectedCartesian: textTensor(expectedBern), residuals: textTensor(residuals),
      proofDegrees: { first: 4, second: 1 }, wholeImageEqual: true,
      outward: { axis, sign, principalCoefficients: text(coefficients), minimumAbsolute: q.text(minimum(magnitudes)) }, storedLocalUsesUnchanged: true };
  }) as MaterialProof['faceImages'];

  const curveCache = new WeakMap<Curve, P[]>();
  const liftCurve = (curve: Curve): P[] => {
    const cached = curveCache.get(curve); if (cached) return cached;
    const d = domain(curve), w = curve.weights[0];
    check(curve.degree >= 1 && curve.degree <= 4 && curve.controlPoints.length === curve.degree + 1 &&
      curve.knots.length === 2 * (curve.degree + 1) && d[0] < d[1] && w > 0 &&
      curve.knots.every((v, i) => Object.is(v, d[i <= curve.degree ? 0 : 1])) &&
      curve.weights.length === curve.controlPoints.length && curve.weights.every(v => Object.is(v, w)),
    'BINDING', 'Actual native edge must be single Bezier with constant positive weights before cancellation');
    const result = [0, 1, 2].map(axis => bernsteinPower(curve.controlPoints.map(point => from(point[axis]))).map(v => [v]));
    curveCache.set(curve, result); return result;
  };
  const pcurvePower = (use: LocalUseRef): P[] => {
    if (use.pcurve.kind === 'native-curve') {
      check(same(domain(use.pcurve.curve), domain(use.localCurve)), 'BINDING', 'Actual native World/pcurve domains must match');
      const values = liftCurve(use.pcurve.curve);
      check(values[2].every(row => row.every(v => v.n === 0n)), 'BINDING', 'Native pcurve embedded Z must remain zero');
      return values.slice(0, 2);
    }
    check(same(use.pcurve.domain, domain(use.localCurve)), 'BINDING', 'Natural pcurve must retain actual native Curve domain');
    return [0, 1].map(axis => [[from(use.pcurve.kind === 'native-line' ? use.pcurve.uv0[axis] : 0)],
      [subR(from(use.pcurve.kind === 'native-line' ? use.pcurve.uv1[axis] : 0), from(use.pcurve.kind === 'native-line' ? use.pcurve.uv0[axis] : 0))]]);
  };
  const curveGrid = (axes: P[]): R[][] => {
    const controls = axes.map(p => bernstein(p, 4, 0, [0, 1]).map(row => row[0]));
    return Array.from({ length: 5 }, (_, i) => controls.map(row => row[i]));
  };
  const pointEqual = (a: Point, b: Point): boolean => a.every((v, i) => equal(from(v), from(b[i])));
  const memberKey = (faceIndex: number, vertexId: string): string => faceIndex + ':' + vertexId;
  const classes = new Map<string, Vertex>();
  check(new Set(graph.vertices.map(v => v.id)).size === 8 && new Set(graph.edges.map(e => e.id)).size === 12 &&
    new Set(graph.faces.map(f => f.id)).size === 6, 'TOPOLOGY', 'Fresh global topology identities must be unique');
  for (let vertexIndex = 0; vertexIndex < graph.vertices.length; vertexIndex++) {
    const vertex = graph.vertices[vertexIndex];
    check(vertex.members.length === 3 && vertex.members.some(m => same(m.world, vertex.world)),
      'TOPOLOGY', 'Each actual global vertex must copy an existing local point and have three members');
    const x = from(window[vertexIndex % 2]), y = vertexIndex >= 4 ? compose(roofY, constant(x), constant(zero))[0][0] : lowY;
    const z = vertexIndex % 4 >= 2 ? compose(aPower[2], constant(x), constant(y))[0][0] : lowZ;
    check([x, y, z].every((v, k) => equal(v, from(vertex.world[k]))), 'BINDING', 'Actual global vertex must be the intended whole-cube corner');
    for (const member of vertex.members) {
      const fi = graph.faces.findIndex(f => same(f.origin, member.face));
      check(fi >= 0, 'BINDING', 'Actual local vertex Face reference must resolve');
      const local = localDefinitions[fi].vertices.find(v => v.id === member.vertexId);
      check(local !== undefined && same(member.world, local.world) && pointEqual(vertex.world, member.world),
        'BINDING', 'Each local vertex record must retain its exact source point');
      const key = memberKey(fi, member.vertexId);
      check(!classes.has(key), 'TOPOLOGY', 'Every local corner must belong to exactly one vertex class');
      classes.set(key, vertex);
    }
  }
  check(classes.size === 24 && localDefinitions.every((d, fi) => d.vertices.length === 4 && d.vertices.every(v => classes.has(memberKey(fi, v.id)))),
    'TOPOLOGY', 'All24 actual Face corner occurrences must be covered once');
  const allUseIds = new Set<string>(), occurrenceKeys = new Set<string>();
  const correspondence = graph.edges.map((edge, edgeIndex): EdgePair => {
    const canonicalDomain = domain(edge.curve), canonicalPower = liftCurve(edge.curve), canonicalGrid = curveGrid(canonicalPower);
    check(same(edge.parameterRange, canonicalDomain) && same(resolve(edge.curveRef), edge.curve) &&
      same(edge.curve, edge.uses[0].origin.localCurve) && same(edge.curveRef, edge.uses[0].origin.curveRef) &&
      edge.uses.length === 2 && edge.vertexIds[0] !== edge.vertexIds[1],
    'BINDING', 'Canonical edge must retain its actual first source occurrence and native domain', edgeIndex);
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const vertex = graph.vertices.find(v => v.id === edge.vertexIds[endpoint]);
      const point = edge.curve.controlPoints[endpoint === 0 ? 0 : edge.curve.controlPoints.length - 1];
      check(vertex !== undefined && pointEqual(point, vertex.world), 'BINDING', 'Canonical clamped Curve endpoints must bind global vertices', edgeIndex);
    }
    for (const use of edge.uses) {
      const fi = graph.faces.findIndex(f => f.id === use.faceId), origin = use.origin;
      check(fi >= 0 && use.edgeId === edge.id && use.loopId === graph.faces[fi].loop.id &&
        same(origin.face, graph.faces[fi].origin) && !allUseIds.has(use.id),
      'TOPOLOGY', 'Actual global Use/Face/Loop/source incidence must resolve once', edgeIndex);
      const raw = localDefinitions[fi].uses.find(u => u.edgeId === origin.edgeId);
      check(raw !== undefined && raw.useId === origin.useId && raw.curve.id === origin.curveId &&
        same(raw.curve, origin.localCurve) && same(raw.vertices, origin.localVertexIds) && same(raw.pcurve, origin.pcurve) &&
        raw.sense === origin.sense && same(raw.interval, origin.interval) &&
        origin.curveRef.sourceField === origin.face.sourceField && origin.curveRef.modelField === origin.face.modelField &&
        origin.curveRef.sourceId === origin.face.supportRef.sourceId && same(resolve(origin.curveRef), origin.localCurve),
      'BINDING', 'Every local Curve/pcurve/Use/source record must be the unmodified actual parent occurrence', edgeIndex);
      const key = fi + ':' + origin.edgeId;
      check(!occurrenceKeys.has(key), 'TOPOLOGY', 'Each actual local boundary occurrence is paired once', edgeIndex);
      occurrenceKeys.add(key); allUseIds.add(use.id);
      const localDomain = domain(origin.localCurve), map = use.parameterMap;
      const a = read(map.offset), b = read(map.scale), sign = q.compare(b, zero);
      check(sign !== 0 && same(map.canonicalDomain, canonicalDomain) && same(map.localDomain, localDomain) && map.proofDegree === 4,
        'BINDING', 'Actual exact affine local/canonical parameter map required', edgeIndex);
      const localEndpoints: [number, number] = sign > 0 ? localDomain : [localDomain[1], localDomain[0]];
      check(same(map.localEndpointParameters, localEndpoints), 'BINDING', 'Mapped endpoint parameters must copy real local native endpoint bits', edgeIndex);
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const error = subR(addR(a, mulR(b, from(canonicalDomain[endpoint]))), from(localEndpoints[endpoint]));
        check(error.n === 0n && equal(error, read(map.endpointResiduals[endpoint])), 'BINDING', 'Exact affine endpoint correspondence must be zero', edgeIndex);
      }
      const cw = subR(from(canonicalDomain[1]), from(canonicalDomain[0])), lw = subR(from(localDomain[1]), from(localDomain[0]));
      const normalizedMap: P = [[divR(subR(addR(a, mulR(b, from(canonicalDomain[0]))), from(localDomain[0])), lw)], [divR(mulR(b, cw), lw)]];
      const localPower = liftCurve(origin.localCurve), mapped = curveGrid(localPower.map(p => compose(p, normalizedMap, constant(zero))));
      const residuals = canonicalGrid.map((row, i) => row.map((v, k) => subR(v, mapped[i][k])));
      check(residuals.every(row => row.every(v => v.n === 0n)) && map.wholeCurveResiduals.length === 5 &&
        residuals.every((row, i) => row.every((v, k) => equal(v, read(map.wholeCurveResiduals[i][k])))),
      'REPRESENTABILITY', 'Entire actual World Curves must match after the declared exact parameter map', edgeIndex);
      const uv = pcurvePower(origin), support = liftSurface(graph.faces[fi].support);
      const modelImage = curveGrid(support.map(p => compose(p, uv[0], uv[1]))), ownImage = curveGrid(localPower);
      check(ownImage.every((row, i) => row.every((v, k) => equal(v, modelImage[i][k]))),
        'REPRESENTABILITY', 'Every actual local pcurve must whole-compose to its World edge on its actual support', edgeIndex);
      const sense: Sense = (origin.sense === 'forward') === (sign > 0) ? 'forward' : 'reverse';
      const vertexIds = sense === 'forward' ? edge.vertexIds : [edge.vertexIds[1], edge.vertexIds[0]];
      check(use.sense === sense && same(use.vertexIds, vertexIds) && origin.localVertexIds.every((id, i) => classes.get(memberKey(fi, id))?.id === use.vertexIds[i]),
        'ORIENTATION', 'Existing local traversal composed with map sign must give global Use direction exactly once', edgeIndex);
    }
    check(edge.uses[0].faceId !== edge.uses[1].faceId && edge.uses[0].sense !== edge.uses[1].sense &&
      same(edge.uses[0].vertexIds, edge.uses[1].vertexIds.slice().reverse()),
    'TOPOLOGY', 'Each actual edge must have two opposite effective Uses', edgeIndex);
    return { edgeId: edge.id, role: edge.role, canonicalCurveRef: { ...edge.curveRef },
      occurrences: edge.uses.map(use => ({ useId: use.id, origin: use.origin, parameterMap: use.parameterMap })) as EdgePair['occurrences'],
      oppositeEffectiveUses: true, exactWholeWorldImage: true };
  });
  check(allUseIds.size === 24 && occurrenceKeys.size === 24, 'TOPOLOGY', 'All24 actual boundary Uses must be covered');
  const faceAdjacency = graph.faces.map((face, fi) => {
    check(face.loop.faceId === face.id && face.outerLoopId === face.loop.id && face.loop.uses.length === 4 &&
      localDefinitions[fi].uses.length === 4, 'TOPOLOGY', 'Each actual Face must bind its complete four-Use Loop');
    for (let i = 0; i < 4; i++) {
      const use = face.loop.uses[i], edge = graph.edges.find(e => e.id === use.edgeId);
      check(edge !== undefined && edge.uses.some(u => same(u, use)) && use.faceId === face.id &&
        use.vertexIds[1] === face.loop.uses[(i + 1) % 4].vertexIds[0] && use.origin.edgeId === localDefinitions[fi].uses[i].edgeId,
      'TOPOLOGY', 'Actual stored local Use order must be unchanged and close the global Face');
    }
    check(new Set(face.loop.uses.map(u => u.vertexIds[0])).size === 4, 'TOPOLOGY', 'Each Face loop must retain four distinct corners');
    return { faceId: face.id, adjacentFaceIds: graph.faces.filter(other => other.id !== face.id &&
      graph.edges.some(e => e.uses.some(u => u.faceId === face.id) && e.uses.some(u => u.faceId === other.id))).map(f => f.id) };
  });
  const connected = new Set<string>([graph.faces[0].id]), pending = [graph.faces[0].id];
  while (pending.length) {
    const id = pending.pop()!;
    for (const neighbor of faceAdjacency.find(f => f.faceId === id)!.adjacentFaceIds) if (!connected.has(neighbor)) { connected.add(neighbor); pending.push(neighbor); }
  }
  check(connected.size === 6 && graph.vertices.length - graph.edges.length + graph.faces.length === 2,
    'TOPOLOGY', 'Actual six-Face graph must be connected with Euler characteristic2');
  const germKey = (g: Germ): string => g.edgeId + ':' + g.endpointIndex;
  const vertexLinks = graph.vertices.map((vertex): VertexLink => {
    const germs = graph.edges.flatMap(edge => edge.vertexIds.flatMap((id, endpoint) => id === vertex.id ? [{ edgeId: edge.id, endpointIndex: endpoint as 0 | 1 }] : []));
    check(germs.length === 3, 'TOPOLOGY', 'Each cube vertex must have three actual edge germs');
    const arcs: VertexLink['cornerArcs'] = [];
    for (const face of graph.faces) for (let i = 0; i < 4; i++) {
      const outgoing = face.loop.uses[i], incoming = face.loop.uses[(i + 3) % 4];
      if (outgoing.vertexIds[0] !== vertex.id) continue;
      check(incoming.vertexIds[1] === vertex.id, 'TOPOLOGY', 'Actual corner arc must join incoming/outgoing Uses');
      const from = germs.find(g => g.edgeId === incoming.edgeId), to = germs.find(g => g.edgeId === outgoing.edgeId);
      check(from !== undefined && to !== undefined && germKey(from) !== germKey(to), 'TOPOLOGY', 'Corner germ arc must bind two actual edges');
      arcs.push({ faceId: face.id, incomingUseId: incoming.id, outgoingUseId: outgoing.id, from, to });
    }
    check(arcs.length === 3 && germs.every(g => arcs.filter(a => germKey(a.from) === germKey(g)).length === 1 &&
      arcs.filter(a => germKey(a.to) === germKey(g)).length === 1), 'TOPOLOGY', 'Actual germ graph must have degree2 and three corner arcs');
    const cycle: Germ[] = [germs[0]];
    for (let i = 0; i < 2; i++) {
      const arc = arcs.find(a => germKey(a.from) === germKey(cycle[cycle.length - 1]))!;
      check(!cycle.some(g => germKey(g) === germKey(arc.to)), 'TOPOLOGY', 'Vertex link may not split into a short cycle'); cycle.push(arc.to);
    }
    check(germKey(arcs.find(a => germKey(a.from) === germKey(cycle[2]))!.to) === germKey(cycle[0]),
      'TOPOLOGY', 'Three-germ link must close as one connected cycle');
    return { vertexId: vertex.id, germs: germs as [Germ, Germ, Germ], cornerArcs: arcs, cycle, connected: true, degreeTwo: true };
  });
  const width = subR(from(window[1]), from(window[0]));
  const integrand = jacBern.map(row => divR(addR(row[0], row[1]), integer(2)));
  const exactVolume = divR(mulR(width, q.sum(integrand)), integer(9));
  const power = (x: R, n: number): R => { let value = one; for (let i = 0; i < n; i++) value = mulR(value, x); return value; };
  let directVolume = zero;
  for (let i = 0; i < jacobian.length; i++) for (let j = 0; j < jacobian[i].length; j++) if (jacobian[i][j].n !== 0n)
    directVolume = addR(directVolume, mulR(jacobian[i][j], divR(subR(power(from(window[1]), i + 1), power(from(window[0]), i + 1)),
      integer((i + 1) * (j + 1)))));
  const integrationResidual = subR(exactVolume, directVolume);
  check(integrationResidual.n === 0n && q.compare(exactVolume, zero) > 0, 'MATERIAL', 'Exact full occupied volume integration must agree and be positive');
  const sourceInventory = Array.from(inventory.values());
  const material: MaterialProof = { certificateId: graph.body.materialCertificateId, bodyId: graph.body.id,
    shellId: graph.shell.id, faceIds: graph.faces.map(f => f.id), sourceRefs: sourceInventory,
    profile: { aXIdentity: true, aYIdentity: true, bXShiftIdentity: true, bZIdentity: true,
      originalUBOffset: q.text(offset), originalUBScale: q.text(ubScale), unitPositiveAxes: true, constantPositiveWeights: true,
      bYPower: text(Array.from({ length: bSurface.degreeU + 1 }, (_, i) => at(bPower[1], i, 0))),
      aZPower: textGrid(Array.from({ length: aSurface.degreeU + 1 }, (_, i) => [at(aPower[2], i, 0), at(aPower[2], i, 1)])),
      sourceResiduals: textTensor(originalResiduals) },
    cubeMap: { domain: { u: [...window], s: [0, 1], t: [0, 1] }, lowY: q.text(lowY), lowZ: q.text(lowZ),
      heightYBernstein: text(hyBern), heightZBernstein: textGrid(hzBern), heightProofUDegree: 4, heightProofSDegree: 1,
      minimumHeightY: q.text(minimum(hyBern)), minimumHeightZ: q.text(minimum(hzBern.flat())),
      jacobianBernstein: textGrid(jacBern), jacobianDegrees: { u: 8, s: 1 }, minimumJacobian: q.text(minimum(jacBern.flat())),
      inverse: 'u=X;s=(Y-lowY)/heightY(u);t=(Z-lowZ)/heightZ(u,s)', globallyInjective: true },
    faceImages, volume: { exactVolumeMM3: q.text(exactVolume), integrandBernstein: text(integrand), degree: 8,
      integrationResidual: q.text(integrationResidual), unit: 'mm3' }, sourceDefinedOccupiedRegion: true,
    wholeBoundaryImage: true, outwardMaterial: true, embeddedClosedBoundary: true, restrictedSolidCertified: true, parentFlagsUnchanged: true };
  return { schema: 'barocss-paired-surface-material-body-proof', version: 0, correspondence,
    vertexClasses: graph.vertices.map(v => ({ vertexId: v.id, members: v.members })), vertexLinks, faceAdjacency,
    sourceInventory, eulerCharacteristic: 2, connectedFaceGraph: true, material };
}
