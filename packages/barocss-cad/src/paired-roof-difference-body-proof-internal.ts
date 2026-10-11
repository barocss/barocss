import type { Point, Curve, Surface, Model } from './types.js';
import type { FaceBundle, FaceIds } from './face.js';
import type { CompatibleRuledSurfaceResult } from './compatible-ruled-surface.js';
import type { PairedRoofDifferenceBodyRequest } from './paired-roof-difference-body.js';
import type { SectionFraction, SectionRational, SectionRationalContext } from './section-rational-internal.js';
type F = SectionFraction;
type R = SectionRational;
type Sense = 'forward' | 'reverse';
type Code = 'INPUT' | 'IDENTITY' | 'PARENT' | 'PROFILE' | 'SOURCE' | 'NATIVE' | 'CLOSURE' | 'TOPOLOGY' | 'MATERIAL' | 'ORIENTATION' | 'DOMAIN' | 'REPRESENTABILITY' | 'BINDING' | 'BUDGET' | 'FILE' | 'OWNED';
type ClosureRole='yMin'|'xMin'|'xMax'; type FaceRole='roof'|'floor'|'band'|ClosureRole;
type EdgeRole='lowerCut'|'upperCut'|'lowerYMin'|'upperYMin'|'lowerXMin'|'upperXMin'|'lowerXMax'|'upperXMax'|'yMinXMin'|'yMinXMax'|'bandXMin'|'bandXMax';
type SourceRef={sourceId:string;sourceField:string;modelField:string;modelName:string;objectIndex:number;objectId:string};
type SourceModel={sourceId:string;source:string;sourceVersion:0;model:Model};
type BandVertex={id:string;role:'lowerLeft'|'lowerRight'|'upperRight'|'upperLeft';world:Point;uv:Point};
type BandEdge={id:string;role:'lowerCut'|'right'|'upperCut'|'left';curve:Curve;vertexIds:[string,string];pcurve:{coordinateSystem:'original-native-uv';lengthUnit:'dimensionless';curve:Curve};curveRef:SourceRef;origin:{kind:'borrowed-paired-cut'|'fixed-original-ub-line';operand:'lower'|'upper'|null;sourceField:string|null}};
type BandUse={id:string;edgeId:string;vertexIds:[string,string];sense:Sense;interval:[number,number];pcurveId:string};
type BandLoop={id:string;uses:[BandUse,BandUse,BandUse,BandUse]};
type BandFace={id:string;sourceId:string;surfaceId:string;outerLoopId:string;orientation:'reverse';region:'between-two-cuts'};
type Band={world:SourceModel;support:Surface;supportRef:SourceRef;vertices:[BandVertex,BandVertex,BandVertex,BandVertex];edges:[BandEdge,BandEdge,BandEdge,BandEdge];loop:BandLoop;face:BandFace};
type Closure={role:ClosureRole;ruled:CompatibleRuledSurfaceResult;faceIds:FaceIds;face:FaceBundle;world:SourceModel};
type Closures=[Closure,Closure,Closure]; type Geometry={band:Band;closures:Closures};
type LocalFaceRef={kind:'lower'|'upper'|'band'|'closure';closureIndex:number|null;faceId:string;loopId:string;supportRef:SourceRef;sourceField:string;modelField:string};
type LocalVertexRef={face:LocalFaceRef;vertexId:string;world:Point};
type LocalUseRef={face:LocalFaceRef;edgeId:string;useId:string|null;curveId:string;localVertexIds:[string,string];localCurve:Curve;pcurve:{kind:'native-curve';curve:Curve}|{kind:'native-line';domain:[number,number];uv0:[number,number];uv1:[number,number]};sense:Sense;interval:[number,number];curveRef:SourceRef};
type ParameterMap={canonicalDomain:[number,number];localDomain:[number,number];offset:F;scale:F;localEndpointParameters:[number,number];endpointResiduals:[F,F];wholeCurveResiduals:F[][];proofDegree:4};
type GlobalUse={id:string;faceId:string;loopId:string;edgeId:string;vertexIds:[string,string];sense:Sense;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean};
type Vertex={id:string;world:Point;members:LocalVertexRef[]};
type Edge={id:string;role:EdgeRole;curve:Curve;curveRef:SourceRef;vertexIds:[string,string];parameterRange:[number,number];uses:[GlobalUse,GlobalUse]};
type Loop={id:string;faceId:string;uses:[GlobalUse,GlobalUse,GlobalUse,GlobalUse]};
type Face={id:string;role:FaceRole;support:Surface;supportRef:SourceRef;origin:LocalFaceRef;orientation:Sense;outerLoopId:string;loop:Loop;importReversal:boolean};
type Shell={id:string;faceIds:[string,string,string,string,string,string];closed:true;oriented:true};
type Body={id:string;shellIds:[string];materialCertificateId:string;closed:true;solid:true;restrictedSolidCertified:true};
type Graph={vertices:Vertex[];edges:Edge[];faces:Face[];shell:Shell;body:Body};
type FaceImage={faceId:string;role:FaceRole;supportRef:SourceRef;originalSupport:Surface;nativeDomains:{u:[number,number];v:[number,number]};cubeRestriction:'t=1'|'t=0'|'s=1'|'s=0'|'u=uMin'|'u=uMax';chartVariables:['u','s']|['u','t']|['s','t'];nativeUVPower:F[][][];actualCartesian:F[][][];expectedCartesian:F[][][];residuals:F[][][];proofDegrees:{first:4;second:1};wholeImageEqual:true;outward:{axis:'x'|'y'|'z';sign:-1|1;principalCoefficients:F[];minimumAbsolute:F};storedLocalUsesUnchanged:true;importReversal:boolean};
type EdgePair={edgeId:string;role:EdgeRole;canonicalCurveRef:SourceRef;occurrences:[{useId:string;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean},{useId:string;origin:LocalUseRef;parameterMap:ParameterMap;importReversal:boolean}];oppositeEffectiveUses:true;exactWholeWorldImage:true};
type Germ={edgeId:string;endpointIndex:0|1};
type VertexLink={vertexId:string;germs:[Germ,Germ,Germ];cornerArcs:{faceId:string;incomingUseId:string;outgoingUseId:string;from:Germ;to:Germ}[];cycle:Germ[];connected:true;degreeTwo:true};
type MaterialProof={certificateId:string;bodyId:string;shellId:string;faceIds:string[];sourceRefs:SourceRef[];
 profile:{lowerAXIdentity:true;lowerAYIdentity:true;upperAXIdentity:true;upperAYIdentity:true;bXShiftIdentity:true;bZIdentity:true;originalUBOffset:F;originalUBScale:F;unitPositiveAxes:true;constantPositiveWeights:true;commonOriginalB:true;commonFootprint:true;bYPower:F[];lowerAZPower:F[][];upperAZPower:F[][];sourceResiduals:F[][][]};
 cubeMap:{domain:{u:[number,number];s:[0,1];t:[0,1]};lowY:F;floorPower:F[][];gapPower:F[][];heightYBernstein:F[];gapBernstein:F[][];heightProofUDegree:4;heightProofSDegree:1;minimumHeightY:F;minimumGap:F;jacobianBernstein:F[][];jacobianDegrees:{u:8;s:1};minimumJacobian:F;inverse:'u=X;s=(Y-lowY)/heightY(u);t=(Z-floor(u,s))/gap(u,s)';globallyInjective:true};
 faceImages:[FaceImage,FaceImage,FaceImage,FaceImage,FaceImage,FaceImage];
 volume:{exactVolumeMM3:F;integrandBernstein:F[];degree:8;integrationResidual:F;unit:'mm3'};
 conservation:{lowerVolumeMM3:F;upperVolumeMM3:F;differenceVolumeMM3:F;residual:F;exact:true};
 operation:'regularized-upper-minus-lower';sourceDefinedOccupiedRegion:true;wholeBoundaryImage:true;outwardMaterial:true;embeddedClosedBoundary:true;restrictedSolidCertified:true;parentFlagsUnchanged:true};
type BandEdgeProof={edgeId:string;curveRef:SourceRef;nativeDomain:[number,number];worldCartesian:F[][];uvCartesian:F[][];composedSurfaceCartesian:F[][];residuals:F[][];proofDegree:4;wholeImageEqual:true};
type BandProof={supportRef:SourceRef;originalUAInterval:[number,number];originalUBMap:{offset:F;scale:F};lowerWorldCurveRef:SourceRef;upperWorldCurveRef:SourceRef;lowerPcurve:Curve;upperPcurve:Curve;edges:[BandEdgeProof,BandEdgeProof,BandEdgeProof,BandEdgeProof];gapBernstein:F[];minimumGap:F;xzDeterminant:F;closedDiskCertified:true;originalBUnchanged:true;borrowedCutsUnchanged:true};
type Proof={schema:'barocss-paired-roof-difference-body-proof';version:0;band:BandProof;correspondence:EdgePair[];vertexClasses:{vertexId:string;members:LocalVertexRef[]}[];vertexLinks:VertexLink[];faceAdjacency:{faceId:string;adjacentFaceIds:string[]}[];sourceInventory:SourceRef[];eulerCharacteristic:2;connectedFaceGraph:true;material:MaterialProof};
export type PairedRoofDifferenceGeometry = Geometry;
export type PairedRoofDifferenceBand = Band;
export type PairedRoofDifferenceClosure = Closure;
export type PairedRoofDifferenceClosures = Closures;
export type PairedRoofDifferenceGraph = Graph;
export type PairedRoofDifferenceProof = Proof;
export type PairedRoofDifferenceSourceRef = SourceRef;
export type PairedRoofDifferenceSourceModel = SourceModel;
export type PairedRoofDifferenceLocalFaceRef = LocalFaceRef;
export type PairedRoofDifferenceLocalVertexRef = LocalVertexRef;
export type PairedRoofDifferenceLocalUseRef = LocalUseRef;
export type PairedRoofDifferenceParameterMap = ParameterMap;
export type PairedRoofDifferenceGlobalUse = GlobalUse;
export type PairedRoofDifferenceVertex = Vertex;
export type PairedRoofDifferenceEdge = Edge;
export type PairedRoofDifferenceLoop = Loop;
export type PairedRoofDifferenceFace = Face;
export type PairedRoofDifferenceShell = Shell;
export type PairedRoofDifferenceBody = Body;
export class PairedRoofDifferenceProofError extends Error {
  readonly code: Code;
  readonly edgeIndex: number | null; readonly faceRole: FaceRole | null;
  constructor(code: PairedRoofDifferenceProofError['code'], detail: string,
    edgeIndex: number | null = null, faceRole: FaceRole | null = null, cause?: unknown) {
    super(('Paired roof difference proof: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'PairedRoofDifferenceProofError'; this.code = code;
    this.edgeIndex = edgeIndex; this.faceRole = faceRole;
  }
}

/** Entire actual boundary/graph/source-defined material proof; no provider or qFloat calls. */
export function provePairedRoofDifferenceBodyTrusted(
  request: PairedRoofDifferenceBodyRequest, geometry: Geometry, graph: Graph, q: SectionRationalContext,
): Proof {
  function check(condition: boolean, code: PairedRoofDifferenceProofError['code'], detail: string,
    edgeIndex: number | null = null, faceRole: FaceRole | null = null): asserts condition {
    if (!condition) throw new PairedRoofDifferenceProofError(code, detail, edgeIndex, faceRole);
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
      surface.knotsU.length === 2 * (surface.degreeU + 1) && surface.knotsV.length === 4 &&
      d.u[0] < d.u[1] && d.v[0] < d.v[1] &&
      surface.knotsU.every((value, i) => Object.is(value, d.u[i <= surface.degreeU ? 0 : 1])) &&
      surface.knotsV.every((value, i) => Object.is(value, d.v[i <= surface.degreeV ? 0 : 1])) &&
      surface.weights.length === surface.controlPoints.length && surface.weights.every(row => row.length === 2) && weight > 0 && surface.weights.every(row => row.every(w => Object.is(w, weight))), 'PROFILE', 'Actual support must be one constant-positive-weight Bezier Udegree≤2/V1');
    const result = [0, 1, 2].map(axis => {
      const up = [0, 1].map(j => bernsteinPower(surface.controlPoints.map(row => from(row[j][axis]))));
      const normalized = up[0].map((value, i) => [value, subR(up[1][i], value)]);
      return compose(normalized, [[divR(q.neg(from(d.u[0])), subR(from(d.u[1]), from(d.u[0])))],
        [divR(one, subR(from(d.u[1]), from(d.u[0])))]],
        [[divR(q.neg(from(d.v[0])), subR(from(d.v[1]), from(d.v[0]))), divR(one, subR(from(d.v[1]), from(d.v[0])))]]);
    });
    surfaceCache.set(surface, result); return result;
  };

  const closures = geometry.closures, band = geometry.band;
  const lower = request.lower, upper = request.upper;
  const lowerSection = lower.request.a.request.section, upperSection = upper.request.a.request.section;
  check(same(lowerSection, lower.request.b.request.section) && same(upperSection, upper.request.b.request.section),
    'BINDING', 'Each full operand must retain one complete paired section');
  const lowerA = lowerSection.request.assets[0].surface, upperA = upperSection.request.assets[0].surface;
  const bSurface = lowerSection.request.assets[1].surface;
  check(same(lowerSection.request.assets[1], upperSection.request.assets[1]) &&
    same(lowerSection.originalModels[1], upperSection.originalModels[1]) &&
    same(lowerSection.request.uAInterval, upperSection.request.uAInterval) &&
    same(surfaceDomain(lowerA), surfaceDomain(upperA)) &&
    same(lowerSection.proof.originalUB, upperSection.proof.originalUB),
    'PROFILE', 'Full original B source/model/support and physical footprint must agree');
  const lowerPower = liftSurface(lowerA), upperPower = liftSurface(upperA), bPower = liftSurface(bSurface);
  const window = lowerSection.request.uAInterval;
  const offset = read(lowerSection.proof.originalUB.offset), ubScale = read(lowerSection.proof.originalUB.scale);
  check(equal(ubScale, one) && window[0] < window[1], 'PROFILE', 'Original UB map must have exact unit scale and positive UA window');
  const residualAxes = [
    [sub(lowerPower[0], U), sub(lowerPower[1], V), constant(zero)],
    [sub(upperPower[0], U), sub(upperPower[1], V), constant(zero)],
    [sub(bPower[0], sub(U, constant(offset))), constant(zero), sub(bPower[2], V)],
  ];
  check(residualAxes.flat().every(p => p.every(row => row.every(v => v.n === 0n))) &&
    bPower[1].every(row => row.slice(1).every(v => v.n === 0n)),
    'PROFILE', 'All original unit-axis and forbidden source-power terms must be exact');
  const originalResiduals = [lowerA, upperA, bSurface].flatMap((surface, index) =>
    Array.from({ length: surface.degreeU + 1 }, (_, i) => [0, 1].map(j => [0, 1, 2].map(axis =>
      at(index === 2 && axis === 1 && j === 1 ? bPower[1] : residualAxes[index][axis], i, j)))));
  const lowY = from(surfaceDomain(lowerA).v[0]), lowZ = from(surfaceDomain(bSurface).v[0]);
  check(equal(read(lower.proof.material.cubeMap.lowY), lowY) && equal(read(upper.proof.material.cubeMap.lowY), lowY) &&
    equal(read(lower.proof.material.cubeMap.lowZ), lowZ) && equal(read(upper.proof.material.cubeMap.lowZ), lowZ),
    'PROFILE', 'Both complete operands must retain the same physical lowY and oldlowZ');
  const roofY = compose(bPower[1], add(U, constant(offset)), constant(zero));
  const heightY = sub(roofY, constant(lowY)), cubeY = add(constant(lowY), mul(heightY, V));
  const floor = compose(lowerPower[2], U, cubeY), roof = compose(upperPower[2], U, cubeY), gap = sub(roof, floor);
  const hyBern = bernstein(heightY, 4, 0, window).map(row => row[0]);
  const gapBern = bernstein(gap, 4, 1, window);
  check(hyBern.every(v => q.compare(v, zero) > 0) && gapBern.every(row => row.every(v => q.compare(v, zero) > 0)),
    'MATERIAL', 'Every HY Bernstein4 and gap Bernstein4x1 coefficient must be strictly positive');
  const jacobian = mul(heightY, gap), jacBern = bernstein(jacobian, 8, 1, window);
  check(jacBern.every(row => row.every(v => q.compare(v, zero) > 0)), 'MATERIAL', 'Entire degree8x1 Jacobian hull must be positive');
  const faceRoles: FaceRole[] = ['roof', 'floor', 'band', 'yMin', 'xMin', 'xMax'];
  const closureRoles: ClosureRole[] = ['yMin', 'xMin', 'xMax'];
  const edgeRoles: EdgeRole[] = ['lowerCut', 'upperCut', 'lowerYMin', 'upperYMin', 'lowerXMin', 'upperXMin',
    'lowerXMax', 'upperXMax', 'yMinXMin', 'yMinXMax', 'bandXMin', 'bandXMax'];
  check(graph.vertices.length === 8 && graph.edges.length === 12 && graph.faces.length === 6 && closures.length === 3 &&
    graph.faces.every((f, i) => f.role === faceRoles[i]) && graph.edges.every((e, i) => e.role === edgeRoles[i]) &&
    closures.every((c, i) => c.role === closureRoles[i]), 'TOPOLOGY', 'Ordered8V/12E/6F/three-closure graph required');
  check(lower.request.a.faces[0].orientation === 'forward' && upper.request.a.faces[0].orientation === 'forward' &&
    band.face.orientation === 'reverse' && graph.faces.every((f, i) =>
      f.orientation === (i === 1 || i === 2 ? 'reverse' : 'forward') && f.importReversal === (i === 1)),
    'ORIENTATION', 'Only the new floor import reverses the raw forward parent traversal');
  check(same(graph.shell.faceIds, graph.faces.map(f => f.id)) && same(graph.body.shellIds, [graph.shell.id]) &&
    graph.shell.closed && graph.shell.oriented && graph.body.closed && graph.body.solid && graph.body.restrictedSolidCertified,
    'TOPOLOGY', 'Shell/Body must bind this complete graph');
  const inventory = new Map<string, SourceRef>();
  const path = (name: string): unknown => {
    check(/^(request\.(lower|upper)|geometry\.(band|closures))([.\[\]A-Za-z_0-9])*$/.test(name),
      'BINDING', 'Only full retained request/geometry paths are permitted');
    const parts = name.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? [];
    let value: unknown = { request, geometry };
    for (const part of parts) {
      check(value !== null && typeof value === 'object' && Object.hasOwn(value, part), 'BINDING', 'Source path must resolve retained data');
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };
  const resolve = (ref: SourceRef): Curve | Surface => {
    const operandWorld = /^request\.(lower|upper)\.request\.(a|b)\.world\.source$/.exec(ref.sourceField);
    const operandOriginal = /^request\.(lower|upper)\.request\.(a|b)\.request\.section\.request\.assets\[(0|1)\]\.source$/.exec(ref.sourceField);
    const bandWorld = ref.sourceField === 'geometry.band.world.source';
    const closureMatch = /^geometry\.closures\[(0|1|2)\]\.(world|ruled)\.source$/.exec(ref.sourceField);
    let sourceId: string, modelField: string;
    if (operandWorld) {
      const operand = operandWorld[1] === 'lower' ? lower : upper, side = operandWorld[2] as 'a' | 'b';
      sourceId = operand.request[side].request.section.request.assets[side === 'a' ? 0 : 1].sourceId;
      modelField = ref.sourceField.replace(/\.source$/, '.model');
    } else if (operandOriginal) {
      const operand = operandOriginal[1] === 'lower' ? lower : upper, side = operandOriginal[2] as 'a' | 'b';
      const index = Number(operandOriginal[3]); sourceId = operand.request[side].request.section.request.assets[index].sourceId;
      modelField = `request.${operandOriginal[1]}.request.${side}.request.section.originalModels[${index}]`;
    } else if (bandWorld) {
      sourceId = band.world.sourceId; modelField = 'geometry.band.world.model';
    } else {
      check(closureMatch !== null, 'BINDING', 'Reference must select an actual qualified World/original/Ruled source');
      const index = Number(closureMatch[1]); sourceId = closures[index].world.sourceId;
      modelField = `geometry.closures[${index}].${closureMatch[2]}.model`;
    }
    check(ref.sourceId === sourceId && ref.modelField === modelField && typeof path(ref.sourceField) === 'string',
      'BINDING', 'Source identity and full model path must agree');
    const model = path(ref.modelField) as Model;
    check(model.name === ref.modelName && Number.isInteger(ref.objectIndex) && ref.objectIndex >= 0 &&
      ref.objectIndex < model.objects.length && model.objects[ref.objectIndex].id === ref.objectId,
      'BINDING', 'Model name/index/object ID must select actual retained object');
    inventory.set([ref.sourceId, ref.sourceField, ref.modelField, ref.modelName, ref.objectIndex, ref.objectId].join('|'), { ...ref });
    return model.objects[ref.objectIndex];
  };
  // Inventory includes each actual original support and both retained Ruled source columns.
  for (const operand of ['lower', 'upper'] as const) for (const side of ['a', 'b'] as const) {
    const parent = request[operand].request[side], index = side === 'a' ? 0 : 1;
    const asset = parent.request.section.request.assets[index], model = parent.request.section.originalModels[index];
    const objectIndex = model.objects.findIndex(object => object.id === asset.surface.id);
    const ref: SourceRef = { sourceId: asset.sourceId,
      sourceField: `request.${operand}.request.${side}.request.section.request.assets[${index}].source`,
      modelField: `request.${operand}.request.${side}.request.section.originalModels[${index}]`,
      modelName: model.name, objectIndex, objectId: asset.surface.id };
    check(same(resolve(ref), asset.surface), 'BINDING', 'Each original source support must resolve its complete selected model');
  }
  for (const [index, closure] of closures.entries()) for (const [objectIndex, object] of closure.ruled.model.objects.entries()) {
    resolve({ sourceId: closure.world.sourceId, sourceField: `geometry.closures[${index}].ruled.source`,
      modelField: `geometry.closures[${index}].ruled.model`, modelName: closure.ruled.model.name,
      objectIndex, objectId: object.id });
  }
  const localDefinitions = graph.faces.map((face, index) => {
    const origin = face.origin;
    check(same(resolve(face.supportRef), face.support) && same(origin.supportRef, face.supportRef) &&
      (index === 2 ? origin.sourceField === 'geometry.band.world.source' && origin.modelField === 'geometry.band.world.model'
        : origin.sourceField === face.supportRef.sourceField && origin.modelField === face.supportRef.modelField),
      'BINDING', 'Actual support and local Face source must agree', null, face.role);
    if (index < 2) {
      const parent = index === 0 ? upper.request.a : lower.request.a;
      const selected = parent.faces[0], loop = parent.loops.find(l => l.id === selected.outerLoopId);
      check(loop !== undefined && origin.kind === (index === 0 ? 'upper' : 'lower') && origin.closureIndex === null &&
        origin.faceId === selected.id && origin.loopId === loop.id && selected.surfaceId === face.support.id &&
        same(face.support, index === 0 ? upperA : lowerA) &&
        origin.sourceField === `request.${index === 0 ? 'upper' : 'lower'}.request.a.world.source`,
        'BINDING', 'Roof/floor must retain the selected raw A below-cut Face', null, face.role);
      return { origin, vertices: parent.vertices.filter(v => loop.uses.some(use => use.vertexIds.includes(v.id)))
        .map(v => ({ id: v.id, world: v.world })), uses: loop.uses.map(use => {
        const edge = parent.edges.find(e => e.id === use.edgeId);
        check(edge !== undefined, 'BINDING', 'Raw A Use must resolve edge');
        return { edgeId: edge.id, useId: use.id, curve: edge.curve, vertices: use.vertexIds,
          pcurve: { kind: 'native-curve' as const, curve: edge.pcurve.curve }, sense: use.sense, interval: use.interval };
      }) };
    }
    if (index === 2) {
      check(origin.kind === 'band' && origin.closureIndex === null && origin.faceId === band.face.id &&
        origin.loopId === band.loop.id && band.face.outerLoopId === band.loop.id &&
        band.face.surfaceId === band.support.id && band.face.sourceId === band.supportRef.sourceId &&
        band.face.region === 'between-two-cuts' && same(face.support, band.support) &&
        same(face.supportRef, band.supportRef) && origin.sourceField === 'geometry.band.world.source',
        'BINDING', 'Band Face must resolve actual two-cut geometry');
      return { origin, vertices: band.vertices.map(v => ({ id: v.id, world: v.world })), uses: band.loop.uses.map(use => {
        const edge = band.edges.find(e => e.id === use.edgeId);
        check(edge !== undefined && use.pcurveId === edge.pcurve.curve.id, 'BINDING', 'Band Use must select actual edge/pcurve');
        return { edgeId: edge.id, useId: use.id, curve: edge.curve, vertices: use.vertexIds,
          pcurve: { kind: 'native-curve' as const, curve: edge.pcurve.curve }, sense: use.sense, interval: use.interval };
      }) };
    }
    const closure = closures[index - 3], parent = closure.face, model = closure.world.model;
    check(origin.kind === 'closure' && origin.closureIndex === index - 3 && origin.faceId === parent.topology.face.id &&
      origin.loopId === parent.topology.loop.id && parent.topology.face.orientation === 'forward' &&
      same(model, parent.geometry) && model.objects.length === 5 && same(face.support, closure.ruled.surface) &&
      origin.sourceField === `geometry.closures[${index - 3}].world.source`,
      'BINDING', 'Closure must retain real forward Face/Model5');
    const columns = index === 3 ? [lower.request.a.edges[0].curve, upper.request.a.edges[0].curve]
      : index === 4 ? [upper.request.a.edges[4].curve, lower.request.a.edges[4].curve]
        : [lower.request.a.edges[1].curve, upper.request.a.edges[1].curve];
    const support = face.support;
    check(columns[0].id !== columns[1].id && columns.every(c => c.degree === support.degreeU && same(c.knots, support.knotsU)) &&
      support.controlPoints.every((row, i) => row.every((point, j) => same(point, columns[j].controlPoints[i]))) &&
      support.weights.every((row, i) => row.every((weight, j) => Object.is(weight, columns[j].weights[i]))) &&
      same(closure.ruled.first, columns[0]) && same(closure.ruled.second, columns[1]) &&
      closure.ruled.sourceVersion === 0 && closure.world.sourceVersion === 0 && closure.ruled.model.objects.length === 3 &&
      closure.ruled.model.objects.every((object, i) => same(object, i === 2 ? support : columns[i])),
      'BINDING', 'All actual Ruled Model3 poles/weights and outward column order must agree');
    return { origin, vertices: parent.topology.vertices.map(v => ({ id: v.id, world: v.point })),
      uses: parent.topology.loop.uses.map(use => {
        const edge = parent.topology.edges.find(e => e.id === use.edgeId);
        check(edge !== undefined, 'BINDING', 'Natural Use edge must resolve');
        const curve = model.objects.find(o => o.id === edge.curveId);
        check(curve !== undefined && curve.kind === 'curve', 'BINDING', 'Natural Curve must resolve');
        return { edgeId: edge.id, useId: null, curve, vertices: edge.vertexIds,
          pcurve: { kind: 'native-line' as const, domain: use.pcurve.domain, uv0: use.pcurve.uv0, uv1: use.pcurve.uv1 },
          sense: use.sense, interval: domain(curve) };
      }) };
  });
  // Whole Source image equality for each restriction of the actual occupied cube.
  const faceImages = graph.faces.map((face, index): FaceImage => {
    const first: [number, number] = index < 4 ? window : [0, 1];
    let nativeU: P, nativeV: P, expected: P[], restriction: FaceImage['cubeRestriction'], variables: FaceImage['chartVariables'];
    if (index === 0 || index === 1) {
      nativeU = U; nativeV = cubeY; expected = [U, cubeY, index === 0 ? roof : floor];
      restriction = index === 0 ? 't=1' : 't=0'; variables = ['u', 's'];
    } else if (index === 2) {
      nativeU = add(U, constant(offset)); nativeV = add(compose(floor, U, constant(one)), mul(compose(gap, U, constant(one)), V));
      expected = [U, roofY, nativeV]; restriction = 's=1'; variables = ['u', 't'];
    } else if (index === 3) {
      nativeU = U; nativeV = V;
      expected = [U, constant(lowY), add(compose(floor, U, constant(zero)), mul(compose(gap, U, constant(zero)), V))];
      restriction = 's=0'; variables = ['u', 't'];
    } else {
      const c = from(window[index === 4 ? 0 : 1]);
      nativeU = U; nativeV = index === 4 ? sub(constant(one), V) : V;
      expected = [constant(c), compose(cubeY, constant(c), U),
        add(compose(floor, constant(c), U), mul(compose(gap, constant(c), U), V))];
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
    const axis: 'x' | 'y' | 'z' = index < 2 ? 'z' : index < 4 ? 'y' : 'x';
    const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2, i = (k + 1) % 3, j = (k + 2) % 3;
    let principal = compose(sub(mul(su[i], sv[j]), mul(su[j], sv[i])), nativeU, nativeV);
    if (face.orientation === 'reverse') principal = scale(principal, q.neg(one));
    check(principal.every(row => row.slice(1).every(v => v.n === 0n)), 'ORIENTATION', 'Frozen outward principal component must be independent of second chart coordinate', null, face.role);
    const sign: -1 | 1 = index === 0 || index === 2 || index === 5 ? 1 : -1;
    const coefficients = bernstein(principal, 4, 0, first).map(row => row[0]);
    const magnitudes = coefficients.map(v => mulR(integer(sign), v));
    check(magnitudes.every(v => q.compare(v, zero) > 0), 'ORIENTATION', 'Actual source normal must be strictly outward with encoded parent orientation applied once', null, face.role);
    const uvPower = Array.from({ length: 5 }, (_, u) => Array.from({ length: 2 }, (_, v) => [at(nativeU, u, v), at(nativeV, u, v)]));
    return { faceId: face.id, role: face.role, supportRef: { ...face.supportRef }, originalSupport: face.support,
      nativeDomains: native, cubeRestriction: restriction, chartVariables: variables, nativeUVPower: textTensor(uvPower),
      actualCartesian: textTensor(actualBern), expectedCartesian: textTensor(expectedBern), residuals: textTensor(residuals),
      proofDegrees: { first: 4, second: 1 }, wholeImageEqual: true,
      outward: { axis, sign, principalCoefficients: text(coefficients), minimumAbsolute: q.text(minimum(magnitudes)) }, storedLocalUsesUnchanged: true, importReversal: face.importReversal };
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
  const bandRoles: BandEdge['role'][] = ['lowerCut', 'right', 'upperCut', 'left'];
  const bandVertexRoles: BandVertex['role'][] = ['lowerLeft', 'lowerRight', 'upperRight', 'upperLeft'];
  check(band.world.sourceVersion === 0 && same(band.support, bSurface) && same(resolve(band.supportRef), bSurface) &&
    band.supportRef.sourceField === 'request.lower.request.b.request.section.request.assets[1].source' &&
    band.supportRef.modelField === 'request.lower.request.b.request.section.originalModels[1]' && band.world.model.objects.length === 5 &&
    same(band.world.model.objects[0], bSurface) && band.edges.length === 4 && band.vertices.length === 4 &&
    band.edges.every((edge, i) => edge.role === bandRoles[i] && same(band.world.model.objects[i + 1], edge.curve)) &&
    band.vertices.every((vertex, i) => vertex.role === bandVertexRoles[i]),
    'BINDING', 'Actual band World Model5 must retain untouched B and all four World boundaries');
  const cutInputs = [lower.request.b.edges[6], upper.request.b.edges[6]];
  check(cutInputs[0].curve.id !== cutInputs[1].curve.id && cutInputs[0].pcurve.curve.id !== cutInputs[1].pcurve.curve.id,
    'BINDING', 'Borrowed World and UV cut identities must be distinct');
  for (const [index, bandIndex] of [0, 2].entries()) {
    const edge = band.edges[bandIndex], operand = index === 0 ? 'lower' : 'upper';
    check(same(edge.curve, cutInputs[index].curve) && same(edge.pcurve.curve, cutInputs[index].pcurve.curve) &&
      edge.origin.kind === 'borrowed-paired-cut' && edge.origin.operand === operand &&
      edge.origin.sourceField === `request.${operand}.request.b.edges[6].curve` &&
      edge.curveRef.sourceField === `request.${operand}.request.b.world.source` && same(resolve(edge.curveRef), edge.curve) &&
      same(domain(edge.curve), window) && same(domain(edge.pcurve.curve), window),
      'BINDING', 'Borrowed native cuts must retain full original B recipe provenance and UA domain');
  }
  const bandEdgeProofs = band.edges.map((edge, i): BandEdgeProof => {
    check(same(resolve(edge.curveRef), edge.curve) && edge.pcurve.coordinateSystem === 'original-native-uv' &&
      edge.pcurve.lengthUnit === 'dimensionless' && same(domain(edge.curve), domain(edge.pcurve.curve)),
      'BINDING', 'Band World/UV/source domain binding required', i);
    const world = liftCurve(edge.curve), uv = liftCurve(edge.pcurve.curve);
    check(uv[2].every(row => row.every(value => value.n === 0n)), 'BINDING', 'Band pcurve embedded Z is zero', i);
    const image = bPower.map(p => compose(p, uv[0], uv[1]));
    const worldGrid = curveGrid(world), uvGrid = curveGrid(uv), imageGrid = curveGrid(image);
    const residuals = worldGrid.map((row, j) => row.map((value, axis) => subR(value, imageGrid[j][axis])));
    check(residuals.every(row => row.every(value => value.n === 0n)), 'REPRESENTABILITY', 'Whole band World/pcurve/B image identity required', i);
    const normalizedUA = [[from(window[0])], [subR(from(window[1]), from(window[0]))]];
    const expectedUV = i === 0 || i === 2
      ? [add(normalizedUA, constant(offset)), compose(i === 0 ? floor : roof, normalizedUA, constant(one)), constant(zero)]
      : [constant(addR(from(window[i === 1 ? 1 : 0]), offset)),
        add(compose(floor, constant(from(window[i === 1 ? 1 : 0])), constant(one)),
          mul(compose(gap, constant(from(window[i === 1 ? 1 : 0])), constant(one)), U)), constant(zero)];
    check(curveGrid(expectedUV).every((row, j) => row.every((value, axis) => equal(value, uvGrid[j][axis]))),
      'BINDING', 'Band pcurve must equal the full lower/upper cut or fixed-UB connector', i);
    if (i === 1 || i === 3) check(edge.origin.kind === 'fixed-original-ub-line' && edge.origin.operand === null &&
      edge.origin.sourceField === null && edge.curveRef.sourceField === 'geometry.band.world.source' &&
      edge.curve.degree === 1 && edge.pcurve.curve.degree === 1 && same(domain(edge.curve), [0, 1]),
      'BINDING', 'Connector must retain actual fixed-UB native line identity', i);
    const bd = surfaceDomain(bSurface);
    check(uvGrid.every(point => q.compare(point[0], from(bd.u[0])) >= 0 && q.compare(point[0], from(bd.u[1])) <= 0 &&
      q.compare(point[1], from(bd.v[0])) >= 0 && q.compare(point[1], from(bd.v[1])) <= 0),
      'DOMAIN', 'Entire band UV curve must remain inside original B domain', i);
    const expectedVertexIds = i === 0 ? [band.vertices[0].id, band.vertices[1].id]
      : i === 1 ? [band.vertices[1].id, band.vertices[2].id]
        : i === 2 ? [band.vertices[3].id, band.vertices[2].id] : [band.vertices[0].id, band.vertices[3].id];
    check(same(edge.vertexIds, expectedVertexIds), 'TOPOLOGY', 'Band native endpoint order must be lower to upper or increasing UA', i);
    for (const endpoint of [0, 1]) {
      const vertex = band.vertices.find(v => v.id === edge.vertexIds[endpoint]);
      const cp = endpoint === 0 ? 0 : edge.curve.controlPoints.length - 1;
      const up = endpoint === 0 ? 0 : edge.pcurve.curve.controlPoints.length - 1;
      check(vertex !== undefined && vertex.world.every((value, axis) => equal(from(value), from(edge.curve.controlPoints[cp][axis]))) &&
        vertex.uv.every((value, axis) => equal(from(value), from(edge.pcurve.curve.controlPoints[up][axis]))),
        'BINDING', 'Band vertices must bind actual clamped World/UV endpoint bits', i);
    }
    return { edgeId: edge.id, curveRef: { ...edge.curveRef }, nativeDomain: domain(edge.curve),
      worldCartesian: textGrid(worldGrid), uvCartesian: textGrid(uvGrid), composedSurfaceCartesian: textGrid(imageGrid),
      residuals: textGrid(residuals), proofDegree: 4, wholeImageEqual: true };
  }) as BandProof['edges'];
  const bandOrder = [3, 2, 1, 0], bandSenses: Sense[] = ['forward', 'forward', 'reverse', 'reverse'];
  check(band.loop.uses.length === 4 && band.loop.uses.every((use, i) => {
    const edge = band.edges[bandOrder[i]], ids = bandSenses[i] === 'forward' ? edge.vertexIds : edge.vertexIds.slice().reverse();
    return use.edgeId === edge.id && use.sense === bandSenses[i] && same(use.vertexIds, ids) &&
      same(use.interval, domain(edge.curve)) && use.pcurveId === edge.pcurve.curve.id &&
      use.vertexIds[1] === band.loop.uses[(i + 1) % 4].vertexIds[0];
  }), 'ORIENTATION', 'Band must retain its encoded reverse four-Use loop');
  const bandGap = bernstein(compose(gap, U, constant(one)), 4, 0, window).map(row => row[0]);
  check(bandGap.every(value => q.compare(value, zero) > 0), 'MATERIAL', 'Whole two-cut band gap must be positive');
  const determinant = subR(mulR(at(bPower[0], 1, 0), at(bPower[2], 0, 1)), mulR(at(bPower[0], 0, 1), at(bPower[2], 1, 0)));
  check(equal(determinant, one), 'PROFILE', 'Original B XZ determinant must equal positive one');
  const bandProof: BandProof = { supportRef: { ...band.supportRef }, originalUAInterval: [...window],
    originalUBMap: { offset: q.text(offset), scale: q.text(ubScale) }, lowerWorldCurveRef: { ...band.edges[0].curveRef },
    upperWorldCurveRef: { ...band.edges[2].curveRef }, lowerPcurve: band.edges[0].pcurve.curve,
    upperPcurve: band.edges[2].pcurve.curve, edges: bandEdgeProofs, gapBernstein: text(bandGap),
    minimumGap: q.text(minimum(bandGap)), xzDeterminant: q.text(determinant), closedDiskCertified: true,
    originalBUnchanged: true, borrowedCutsUnchanged: true };
  const pointEqual = (a: Point, b: Point): boolean => a.every((v, i) => equal(from(v), from(b[i])));
  const memberKey = (faceIndex: number, vertexId: string): string => faceIndex + ':' + vertexId;
  const classes = new Map<string, Vertex>();
  check(new Set(graph.vertices.map(v => v.id)).size === 8 && new Set(graph.edges.map(e => e.id)).size === 12 &&
    new Set(graph.faces.map(f => f.id)).size === 6, 'TOPOLOGY', 'Fresh global topology identities must be unique');
  for (let vertexIndex = 0; vertexIndex < graph.vertices.length; vertexIndex++) {
    const vertex = graph.vertices[vertexIndex];
    check(vertex.members.length === 3 && vertex.members.some(m => same(m.world, vertex.world)),
      'TOPOLOGY', 'Each actual global vertex must copy an existing local point and have three members');
    const x = from(window[vertexIndex % 2]), y = vertexIndex % 4 >= 2 ? compose(roofY, constant(x), constant(zero))[0][0] : lowY;
    const z = compose(vertexIndex < 4 ? lowerPower[2] : upperPower[2], constant(x), constant(y))[0][0];
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
    const endpointRoles = [[2, 3], [6, 7], [0, 1], [4, 5], [0, 2], [4, 6], [1, 3], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const expectedEndpoints = endpointRoles[edgeIndex].map(index => graph.vertices[index].id);
    check(edge.vertexIds.every(id => expectedEndpoints.includes(id)) && new Set(edge.vertexIds).size === 2 &&
      (edgeIndex >= 4 || same(canonicalDomain, window)), 'BINDING', 'Each edge role must bind its two intended cube corners and native domain', edgeIndex);
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
        (fi === 2 || (origin.curveRef.sourceField === origin.face.sourceField && origin.curveRef.modelField === origin.face.modelField &&
        origin.curveRef.sourceId === origin.face.supportRef.sourceId)) && same(resolve(origin.curveRef), origin.localCurve),
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
      check(use.importReversal === (fi === 1), 'ORIENTATION', 'Only floor Uses have one import reversal', edgeIndex);
      const forward = (origin.sense === 'forward') === (sign > 0);
      const sense: Sense = forward !== use.importReversal ? 'forward' : 'reverse';
      const vertexIds = sense === 'forward' ? edge.vertexIds : [edge.vertexIds[1], edge.vertexIds[0]];
      check(use.sense === sense && same(use.vertexIds, vertexIds) && (use.importReversal ? origin.localVertexIds.slice().reverse() : origin.localVertexIds).every((id, i) => classes.get(memberKey(fi, id))?.id === use.vertexIds[i]),
        'ORIENTATION', 'Existing local traversal composed with map sign must give global Use direction exactly once', edgeIndex);
    }
    check(edge.uses[0].faceId !== edge.uses[1].faceId && edge.uses[0].sense !== edge.uses[1].sense &&
      same(edge.uses[0].vertexIds, edge.uses[1].vertexIds.slice().reverse()),
    'TOPOLOGY', 'Each actual edge must have two opposite effective Uses', edgeIndex);
    return { edgeId: edge.id, role: edge.role, canonicalCurveRef: { ...edge.curveRef },
      occurrences: edge.uses.map(use => ({ useId: use.id, origin: use.origin, parameterMap: use.parameterMap, importReversal: use.importReversal })) as EdgePair['occurrences'],
      oppositeEffectiveUses: true, exactWholeWorldImage: true };
  });
  check(allUseIds.size === 24 && occurrenceKeys.size === 24, 'TOPOLOGY', 'All24 actual boundary Uses must be covered');
  const faceAdjacency = graph.faces.map((face, fi) => {
    check(face.loop.faceId === face.id && face.outerLoopId === face.loop.id && face.loop.uses.length === 4 &&
      localDefinitions[fi].uses.length === 4, 'TOPOLOGY', 'Each actual Face must bind its complete four-Use Loop');
    for (let i = 0; i < 4; i++) {
      const use = face.loop.uses[i], edge = graph.edges.find(e => e.id === use.edgeId);
      check(edge !== undefined && edge.uses.some(u => same(u, use)) && use.faceId === face.id &&
        use.vertexIds[1] === face.loop.uses[(i + 1) % 4].vertexIds[0] && use.origin.edgeId === localDefinitions[fi].uses[fi === 1 ? 3 - i : i].edgeId,
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
  const lowerVolume = read(lower.proof.material.volume.exactVolumeMM3), upperVolume = read(upper.proof.material.volume.exactVolumeMM3);
  const occupiedVolume = (z: P): R => {
    const hull = bernstein(mul(heightY, sub(z, constant(lowZ))), 8, 1, window);
    return divR(mulR(width, hull.reduce((sum, row) => addR(sum, divR(addR(row[0], row[1]), integer(2))), zero)), integer(9));
  };
  check(equal(lowerVolume, occupiedVolume(floor)) && equal(upperVolume, occupiedVolume(roof)),
    'BINDING', 'Both operand volumes must bind all actual original source coefficients');
  const conservationResidual = subR(addR(lowerVolume, exactVolume), upperVolume);
  check(conservationResidual.n === 0n, 'MATERIAL', 'Lower occupied volume plus exact difference must equal upper occupied volume');
  const material: MaterialProof = { certificateId: graph.body.materialCertificateId, bodyId: graph.body.id,
    shellId: graph.shell.id, faceIds: graph.faces.map(f => f.id), sourceRefs: sourceInventory,
    profile: { lowerAXIdentity: true, lowerAYIdentity: true, upperAXIdentity: true, upperAYIdentity: true,
      bXShiftIdentity: true, bZIdentity: true, originalUBOffset: q.text(offset), originalUBScale: q.text(ubScale),
      unitPositiveAxes: true, constantPositiveWeights: true, commonOriginalB: true, commonFootprint: true,
      bYPower: text(Array.from({ length: bSurface.degreeU + 1 }, (_, i) => at(bPower[1], i, 0))),
      lowerAZPower: textGrid(Array.from({ length: lowerA.degreeU + 1 }, (_, i) => [at(lowerPower[2], i, 0), at(lowerPower[2], i, 1)])),
      upperAZPower: textGrid(Array.from({ length: upperA.degreeU + 1 }, (_, i) => [at(upperPower[2], i, 0), at(upperPower[2], i, 1)])),
      sourceResiduals: textTensor(originalResiduals) },
    cubeMap: { domain: { u: [...window], s: [0, 1], t: [0, 1] }, lowY: q.text(lowY),
      floorPower: textGrid(floor), gapPower: textGrid(gap), heightYBernstein: text(hyBern), gapBernstein: textGrid(gapBern),
      heightProofUDegree: 4, heightProofSDegree: 1, minimumHeightY: q.text(minimum(hyBern)), minimumGap: q.text(minimum(gapBern.flat())),
      jacobianBernstein: textGrid(jacBern), jacobianDegrees: { u: 8, s: 1 }, minimumJacobian: q.text(minimum(jacBern.flat())),
      inverse: 'u=X;s=(Y-lowY)/heightY(u);t=(Z-floor(u,s))/gap(u,s)', globallyInjective: true },
    faceImages, volume: { exactVolumeMM3: q.text(exactVolume), integrandBernstein: text(integrand), degree: 8,
      integrationResidual: q.text(integrationResidual), unit: 'mm3' },
    conservation: { lowerVolumeMM3: q.text(lowerVolume), upperVolumeMM3: q.text(upperVolume),
      differenceVolumeMM3: q.text(exactVolume), residual: q.text(conservationResidual), exact: true },
    operation: 'regularized-upper-minus-lower', sourceDefinedOccupiedRegion: true, wholeBoundaryImage: true,
    outwardMaterial: true, embeddedClosedBoundary: true, restrictedSolidCertified: true, parentFlagsUnchanged: true };
  return { schema: 'barocss-paired-roof-difference-body-proof', version: 0, band: bandProof, correspondence,
    vertexClasses: graph.vertices.map(v => ({ vertexId: v.id, members: v.members })), vertexLinks, faceAdjacency,
    sourceInventory, eulerCharacteristic: 2, connectedFaceGraph: true, material };
}
