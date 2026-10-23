import { buildXYCirclePrismShell } from './xy-circle-prism-shell.js';
import type { XYCirclePrismShellResult, XYCirclePrismShellBundle } from './xy-circle-prism-shell.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same } from './core/structural-equality.js';

export const StoredCirclePrismSolidDiagnosticCode = { INPUT: 'INPUT', OWNED: 'OWNED', GEOMETRY: 'GEOMETRY', BUDGET: 'BUDGET', NATIVE: 'NATIVE' } as const;
type Code = typeof StoredCirclePrismSolidDiagnosticCode[keyof typeof StoredCirclePrismSolidDiagnosticCode];
export class StoredCirclePrismSolidError extends Error {
  readonly code: Code;
  constructor(code: Code, detail: string, cause?: unknown) { super(('Stored circle-prism Solid: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'StoredCirclePrismSolidError'; this.code = code; }
}
export interface StoredCirclePrismSolidGerm { edgeId: string; endpointIndex: 0 | 1 }
export interface StoredCirclePrismSolidCorner { faceId: string; loopId: string; incomingUseId: string; outgoingUseId: string; from: StoredCirclePrismSolidGerm; to: StoredCirclePrismSolidGerm }
export interface StoredCirclePrismSolidVertexLink { vertexId: string; germs: StoredCirclePrismSolidGerm[]; corners: StoredCirclePrismSolidCorner[]; cycle: StoredCirclePrismSolidGerm[] }
export interface StoredCirclePrismSolidCertificate {
  kind: 'restricted-stored-rational-circle-prism-solid'; version: 0; lengthUnit: 'mm'; geometryAuthority: 'stored-coefficient-mathematical-model';
  solid: true; topologyCertified: true; embeddedStoredGeometryCertified: true; materialComponentCount: 1; genus: 0;
  faceCount: 3; vertexCount: 2; edgeCount: 3; loopCount: 3; edgeUseCount: 6; eulerCharacteristic: 2;
  planarFaces: { faceId: string; normalSign: -1 | 1; useId: string; poleCompositionCount: 9 }[];
  ringProof: { bottomEdgeId: string; topEdgeId: string; storedMiddleWeight: number; quadrants: { index: number; derivativeNumeratorsX: SectionFraction[]; derivativeNumeratorsY: SectionFraction[] }[] };
  wallProof: { faceId: string; seamEdgeId: string; heightMM: number };
  vertexLinks: StoredCirclePrismSolidVertexLink[]; faceAdjacency: { faceId: string; adjacentFaceIds: string[] }[];
  arithmetic: ReturnType<SectionRationalContext['counts']>;
  directCounts: { parentReconstructionCalls: 1; wholeModelCompilations: 1; capUseCount: 2; capPoleCompositions: 18; wallUseCount: 4; cornerCount: 6; germCount: 6 };
}
export interface StoredCirclePrismSolidResult { parent: XYCirclePrismShellResult; world: { source: string; model: Model }; certificate: StoredCirclePrismSolidCertificate }
const C = StoredCirclePrismSolidDiagnosticCode;
function check(ok: boolean, code: Code, detail: string): asserts ok { if (!ok) throw new StoredCirclePrismSolidError(code, detail); }
function native<T>(fn: () => T, detail: string): T { try { return fn(); } catch (cause) { throw new StoredCirclePrismSolidError(C.NATIVE, detail, cause); } }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
/** Descriptor-first copy counts occurrences; an ancestor set rejects cycles without rejecting aliases. */
function snapshot<T>(input: T): T {
  let remaining = 131072, characters = 0, bytes = 0; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, C.BUDGET, 'Own-data value/depth budget exceeded');
    if (typeof value === 'number') { check(Number.isFinite(value), C.INPUT, 'Finite numeric data required'); return value; }
    if (typeof value === 'string') { characters += value.length; check(value.length <= 262144 && characters <= 1048576, C.BUDGET, 'Own-data string budget exceeded'); bytes += new TextEncoder().encode(value).length; check(bytes <= 1048576, C.BUDGET, 'Own-data UTF8 budget exceeded'); return value; }
    if (value === null || typeof value === 'boolean') return value;
    check(typeof value === 'object', C.INPUT, 'Plain data required');
    check(!ancestors.has(value), C.INPUT, 'Cyclic data refused');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, C.INPUT, 'Foreign prototype');
    check(keys.every(k => typeof k === 'string' && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable)), C.INPUT, 'Accessors, symbols and hidden fields refused');
    ancestors.add(value); let result: unknown;
    if (array) { const n = descriptors.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= 1024 && keys.length === n + 1, C.BUDGET, 'Dense arrays within1024 required'); result = Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), C.INPUT, 'Sparse array'); return copy(descriptors[String(i)].value, depth + 1); }); }
    else { check(keys.length <= 64, C.BUDGET, 'Record field budget exceeded'); result = Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)])); }
    ancestors.delete(value); return result;
  }; return copy(input, 0) as T;
}

// Complete native shapes are admitted before reconstruction. Numeric truth and
// fixed semantic counts are then checked against the actual canonical parent.
type Shape = (value: unknown) => void;
const num: Shape = v => check(typeof v === 'number' && Number.isFinite(v), C.INPUT, 'Number required');
const str: Shape = v => check(typeof v === 'string', C.INPUT, 'String required');
const bool: Shape = v => check(typeof v === 'boolean', C.INPUT, 'Boolean required');
const oneOf = (...values: (string | number | boolean)[]): Shape => v => check(values.some(x => Object.is(v, x)), C.INPUT, 'Unsupported discriminator');
const rec = (fields: Record<string, Shape>): Shape => v => { check(v !== null && typeof v === 'object' && !Array.isArray(v), C.INPUT, 'Record required'); const r = v as Record<string, unknown>; check(Object.keys(r).length === Object.keys(fields).length && Object.keys(fields).every(k => Object.hasOwn(r, k)), C.INPUT, 'Exact nested fields required: ' + Object.keys(fields).join(',')); for (const [k, f] of Object.entries(fields)) f(r[k]); };
const list = (item: Shape, length?: number): Shape => v => { check(Array.isArray(v) && (length === undefined || v.length === length), C.INPUT, 'Array arity mismatch'); v.forEach(item); };
const pair = list(num, 2), point = list(num, 3), sense = oneOf('forward', 'reverse'), bounds = rec({ min: point, max: point });
const curveShape = rec({ kind: oneOf('curve'), id: str, degree: num, knots: list(num), controlPoints: list(point), weights: list(num) });
const surfaceShape = rec({ kind: oneOf('surface'), id: str, degreeU: num, degreeV: num, knotsU: list(num), knotsV: list(num), controlPoints: list(list(point)), weights: list(list(num)) });
const geometryShape: Shape = v => { check(v !== null && typeof v === 'object', C.INPUT, 'Geometry record required'); ((v as { kind?: unknown }).kind === 'curve' ? curveShape : surfaceShape)(v); };
const modelShape = rec({ name: str, version: oneOf(0), lengthUnit: oneOf('mm'), objects: list(geometryShape) });
const pcurveShape = rec({ coordinateSystem: oneOf('uv'), domain: pair, curve: curveShape });
const requestShape = rec({ kind: oneOf('circle'), id: str, center: pair, radius: num });
const vertexShape = rec({ id: str, point });
const edgeShape = rec({ id: str, curveId: str, vertexIds: list(str, 2), sourceParameterRange: pair });
const domainsShape = rec({ u: pair, v: pair });
const profileReportShape = rec({ kind: oneOf('circle'), plane: oneOf('xy'), lengthUnit: oneOf('mm'), centerMM: pair, radiusMM: num, startQuadrant: num, spanCount: num, controlPointCount: num, parameterDomain: rec({ min: num, max: num }), endpointClosed: bool, periodic: bool, regionCertified: bool, solid: bool });
const profileShape = rec({ source: str, sourceVersion: oneOf(0), model: modelShape, curve: curveShape, report: profileReportShape });
const faceLimits = rec({ authoredIdCharacters: num, derivedIdCharacters: num, snapshotValues: num, snapshotDepth: num, arrayElements: num, recordFields: num, stringCharacters: num, evaluationComparisonMM: num, derivativeComparisonRelative: num, planeToleranceMM: num, boundaryToleranceMM: num });
const faceReportShape = rec({ trimFamily: oneOf('xy-circle-planar-face-v0'), sourceCurveId: str, faceId: str, surfaceId: str, outerLoopId: str, edgeId: str, pcurveId: str, seamVertexId: str, nativeDomain: pair, uvDomain: pair, surfaceDomain: domainsShape, centerMM: pair, radiusMM: num, boundsMM: bounds, vertexCount: num, edgeCount: num, loopUseCount: num, nativeObjectCount: num, referenceDiskAreaMM2: num, incidenceValid: bool, periodic: bool, geometricValidity: oneOf('not-certified'), topologyCertified: bool, solid: bool, limits: faceLimits });
const baseFaceShape = rec({ profile: profileShape, bundle: rec({ construction: requestShape, geometry: modelShape, topology: rec({ version: oneOf(0), kind: oneOf('xy-circle-planar-face'), sourceCurveId: str, face: rec({ id: str, surfaceId: str, outerLoopId: str, orientation: oneOf('forward') }), vertices: list(vertexShape), edges: list(edgeShape), loop: rec({ id: str, uses: list(rec({ edgeId: str, sense: oneOf('forward'), pcurve: pcurveShape })) }) }) }), report: faceReportShape });
const useShape = rec({ id: str, edgeId: str, sense, pcurve: pcurveShape });
const shellShape = rec({ construction: rec({ profile: requestShape, shellId: str, heightMM: num }), geometry: modelShape, topology: rec({ version: oneOf(0), kind: oneOf('xy-circle-prism-shell'), id: str, sourceCurveId: str, vertices: list(vertexShape), edges: list(edgeShape), faces: list(rec({ id: str, surfaceId: str, outerLoopId: str, orientation: sense, role: oneOf('bottom-cap', 'top-cap', 'wall') })), loops: list(rec({ id: str, faceId: str, uses: list(useShape) })) }) });
const shellReportShape = rec({ trimFamily: oneOf('xy-circle-prism-shell-v0'), sourceCurveId: str, shellId: str, heightMM: num, centerMM: pair, radiusMM: num, baseFaceReport: faceReportShape, geometryIds: rec({ bottomCurveId: str, topCurveId: str, seamCurveId: str, bottomSurfaceId: str, topSurfaceId: str, wallSurfaceId: str }), domains: rec({ bottomCurve: pair, topCurve: pair, seamCurve: pair, bottomSurface: domainsShape, topSurface: domainsShape, wallSurface: domainsShape }), vertexCount: num, edgeCount: num, edgeUseCount: num, faceCount: num, loopCount: num, nativeObjectCount: num, boundsMM: bounds, edgeIncidence: list(rec({ edgeId: str, uses: list(rec({ faceId: str, loopId: str, useId: str, sense })) })), loopObservations: list(rec({ loopId: str, faceId: str, useCount: num, closed: bool })), normalObservations: list(rec({ faceId: str, surfaceId: str, uv: pair, pointMM: point, normal: point })), referenceVolumeMM3: num, referenceLateralAreaMM2: num, referenceBoundaryAreaMM2: num, incidenceValid: bool, candidateClosedShell: bool, periodic: bool, geometricValidity: oneOf('not-certified'), topologyCertified: bool, solid: bool, limits: rec({ authoredIdCharacters: num, derivedIdCharacters: num, snapshotValues: num, snapshotDepth: num, arrayElements: num, recordFields: num, stringCharacters: num, evaluationComparisonMM: num }) });
const parentShape = rec({ profile: profileShape, baseFace: baseFaceShape, bundle: shellShape, report: shellReportShape });
const germShape = rec({ edgeId: str, endpointIndex: oneOf(0, 1) });
const fractionShape = rec({ numerator: str, denominator: str });
const arithmeticShape = rec({ operations: num, gcdSteps: num, floatSearchSteps: num, floatConversions: num, maximumObservedBits: num });
const certificateShape = rec({ kind: oneOf('restricted-stored-rational-circle-prism-solid'), version: oneOf(0), lengthUnit: oneOf('mm'), geometryAuthority: oneOf('stored-coefficient-mathematical-model'), solid: bool, topologyCertified: bool, embeddedStoredGeometryCertified: bool, materialComponentCount: num, genus: num, faceCount: num, vertexCount: num, edgeCount: num, loopCount: num, edgeUseCount: num, eulerCharacteristic: num, planarFaces: list(rec({ faceId: str, normalSign: oneOf(-1, 1), useId: str, poleCompositionCount: num })), ringProof: rec({ bottomEdgeId: str, topEdgeId: str, storedMiddleWeight: num, quadrants: list(rec({ index: num, derivativeNumeratorsX: list(fractionShape), derivativeNumeratorsY: list(fractionShape) })) }), wallProof: rec({ faceId: str, seamEdgeId: str, heightMM: num }), vertexLinks: list(rec({ vertexId: str, germs: list(germShape), corners: list(rec({ faceId: str, loopId: str, incomingUseId: str, outgoingUseId: str, from: germShape, to: germShape })), cycle: list(germShape) })), faceAdjacency: list(rec({ faceId: str, adjacentFaceIds: list(str) })), arithmetic: arithmeticShape, directCounts: rec({ parentReconstructionCalls: num, wholeModelCompilations: num, capUseCount: num, capPoleCompositions: num, wallUseCount: num, cornerCount: num, germCount: num }) });
const resultShape = rec({ parent: parentShape, world: rec({ source: str, model: modelShape }), certificate: certificateShape });

/** Whole Source0 retains native object order/IDs and every coefficient's bits. */
function compileWorld(model: Model): StoredCirclePrismSolidResult['world'] {
  const spelling = (v: unknown): string => Array.isArray(v) ? '[' + v.map(spelling).join(',') + ']' : curveDecimal(v as number, 'Stored circle-prism Solid');
  const declarations = model.objects.map(o => o.kind === 'curve'
    ? `@curve #${o.id} { type:nurbs; degree:${o.degree}; knots:${spelling(o.knots)}; control-points:${spelling(o.controlPoints)}; weights:${spelling(o.weights)}; }`
    : `@surface #${o.id} { type:nurbs; degree-u:${o.degreeU}; degree-v:${o.degreeV}; knots-u:${spelling(o.knotsU)}; knots-v:${spelling(o.knotsV)}; control-points:${spelling(o.controlPoints)}; weights:${spelling(o.weights)}; }`);
  const source = `@model ${model.name} { version:0; length-unit:mm; ${declarations.join(' ')} }\n`;
  check(source.length <= 262144, C.BUDGET, 'Whole model Source0 length exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'Actual whole model compilation threw');
  if (!compiled.ok) throw new StoredCirclePrismSolidError(C.NATIVE, 'Actual whole model Source0 refused', compiled);
  check(same(model, compiled.model), C.OWNED, 'Whole Source0 changed original world object identity/order/coefficient bits');
  return { source, model: compiled.model };
}

/** Qualifies only this exact stored product family, independently of the parent's sampled report. */
export function qualifyStoredCirclePrismSolid(input: XYCirclePrismShellResult): StoredCirclePrismSolidResult {
  const owned = snapshot(input); parentShape(owned);
  const construction = owned.bundle.construction;
  const parent = native(() => buildXYCirclePrismShell(construction.profile, { shellId: construction.shellId, heightMM: construction.heightMM }), 'Original complete parent reconstruction refused');
  check(same(owned, parent), C.OWNED, 'Complete original parent/source/report/native binding changed');
  const { geometry, topology: t } = parent.bundle;
  check(geometry.objects.length === 6 && t.vertices.length === 2 && t.edges.length === 3 && t.faces.length === 3 && t.loops.length === 3 && t.loops.reduce((n, l) => n + l.uses.length, 0) === 6, C.GEOMETRY, 'Fixed native2/3/3/3/6 shell required');
  const [ring, top, seam, bottomPlane, topPlane, wall] = geometry.objects as [Curve, Curve, Curve, Surface, Surface, Surface];
  const q = new SectionRationalContext((kind, detail) => { throw new StoredCirclePrismSolidError(kind === 'BUDGET' ? C.BUDGET : C.GEOMETRY, detail); });
  const zero = q.rat(0n), one = q.rat(1n), two = q.rat(2n), height = q.from(construction.heightMM);
  const equal = (a: SectionRational, b: SectionRational) => q.compare(a, b) === 0;
  const pointEqual = (a: Point, b: Point) => a.every((v, axis) => equal(q.from(v), q.from(b[axis])));
  const knots = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4];
  check(q.compare(height, zero) > 0 && ring.kind === 'curve' && ring.degree === 2 && ring.controlPoints.length === 9 && ring.weights.length === 9 && same(ring.knots, knots) && ring.weights.every((w, i) => w > 0 && w === (i % 2 ? Math.SQRT1_2 : 1)), C.GEOMETRY, 'Original positive-weight four-quadrant ring required');
  check(top.kind === 'curve' && top.degree === 2 && top.controlPoints.length === 9 && same(top.knots, ring.knots) && same(top.weights, ring.weights), C.GEOMETRY, 'Matching top ring basis required');
  for (const [i, p] of ring.controlPoints.entries()) check(equal(q.from(p[2]), zero) && equal(q.from(top.controlPoints[i][2]), height) && p.slice(0, 2).every((v, axis) => equal(q.from(v), q.from(top.controlPoints[i][axis]))), C.GEOMETRY, 'Exact ring x height product required');
  check(pointEqual(ring.controlPoints[0], ring.controlPoints[8]), C.GEOMETRY, 'Stored ring closure required');
  const cx = q.from(construction.profile.center[0]), cy = q.from(construction.profile.center[1]);
  const cardinal = [0, 2, 4, 6].map(i => [q.sub(q.from(ring.controlPoints[i][0]), cx), q.sub(q.from(ring.controlPoints[i][1]), cy)]);
  check(q.compare(cardinal[0][0], zero) > 0 && equal(cardinal[0][1], zero) && equal(cardinal[1][0], zero) && q.compare(cardinal[1][1], zero) > 0 && q.compare(cardinal[2][0], zero) < 0 && equal(cardinal[2][1], zero) && equal(cardinal[3][0], zero) && q.compare(cardinal[3][1], zero) < 0, C.GEOMETRY, 'Distinct CCW cardinal endpoints required');
  const quadrants: StoredCirclePrismSolidCertificate['ringProof']['quadrants'] = [];
  for (let i = 0; i < 4; i++) {
    const p = ring.controlPoints.slice(i * 2, i * 2 + 3), corner = i % 2 === 0 ? [p[0][0], p[2][1]] : [p[2][0], p[0][1]];
    check(p[1].slice(0, 2).every((v, axis) => equal(q.from(v), q.from(corner[axis]))), C.GEOMETRY, 'Exact quadrant tangent corner required');
    const derivative = (axis: number) => { const a = q.from(p[0][axis]), b = q.from(p[1][axis]), c = q.from(p[2][axis]), w2 = q.mul(two, q.from(ring.weights[1])); return [q.mul(w2, q.sub(b, a)), q.sub(c, a), q.mul(w2, q.sub(c, b))]; };
    const dx = derivative(0), dy = derivative(1), sx = i < 2 ? -1 : 1, sy = i === 0 || i === 3 ? 1 : -1;
    for (const [d, sign] of [[dx, sx], [dy, sy]] as const) check(d.every(v => q.compare(v, zero) * sign >= 0) && q.compare(d[1], zero) * sign > 0, C.GEOMETRY, 'Strict interior quarter monotonicity required');
    check(!equal(dx[0], zero) || !equal(dy[0], zero), C.GEOMETRY, 'Regular start tangent required'); check(!equal(dx[2], zero) || !equal(dy[2], zero), C.GEOMETRY, 'Regular end tangent required');
    quadrants.push({ index: i, derivativeNumeratorsX: dx.map(v => q.text(v)), derivativeNumeratorsY: dy.map(v => q.text(v)) });
  }
  // Positive rational weights contain each open quarter in its separate quadrant.
  // Monotone quarters share only adjacent ends, proving the piecewise Jordan ring.
  const edges = new Map(t.edges.map(e => [e.id, e])), vertices = new Map(t.vertices.map(v => [v.id, v.point]));
  const byCurve = (id: string) => t.edges.find(e => e.curveId === id)!;
  const bottomEdge = byCurve(ring.id), topEdge = byCurve(top.id), seamEdge = byCurve(seam.id);
  for (const e of t.edges) { const c = geometry.objects.find(o => o.id === e.curveId) as Curve; for (const endpoint of [0, 1] as const) check(pointEqual(c.controlPoints[endpoint ? c.controlPoints.length - 1 : 0], vertices.get(e.vertexIds[endpoint])!), C.GEOMETRY, 'Exact declared endpoint binding required'); }
  const planarFaces: StoredCirclePrismSolidCertificate['planarFaces'] = [];
  for (const [index, s] of [bottomPlane, topPlane].entries()) {
    const face = t.faces.find(f => f.surfaceId === s.id)!, loop = t.loops.find(l => l.id === face.outerLoopId)!, edge = index ? topEdge : bottomEdge, worldCurve = index ? top : ring;
    check(s.kind === 'surface' && s.degreeU === 1 && s.degreeV === 1 && same(s.knotsU, [0, 0, 1, 1]) && same(s.knotsV, [0, 0, 1, 1]) && s.controlPoints.length === 2 && s.controlPoints.every(row => row.length === 2) && same(s.weights, [[1, 1], [1, 1]]), C.GEOMETRY, 'Affine native2x2 cap required');
    const origin = s.controlPoints[0][0].map(v => q.from(v)), a = s.controlPoints[1][0].map((v, axis) => q.sub(q.from(v), origin[axis])), b = s.controlPoints[0][1].map((v, axis) => q.sub(q.from(v), origin[axis]));
    check(s.controlPoints[1][1].every((v, axis) => equal(q.from(v), q.add(origin[axis], q.add(a[axis], b[axis])))), C.GEOMETRY, 'Zero bilinear cap coefficient required');
    check(q.compare(a[0], zero) > 0 && equal(a[1], zero) && equal(a[2], zero) && q.compare(b[1], zero) > 0 && equal(b[0], zero) && equal(b[2], zero) && equal(origin[2], index ? height : zero), C.GEOMETRY, 'Positive native XY cap chart required');
    check(face.role === (index ? 'top-cap' : 'bottom-cap') && face.orientation === (index ? 'forward' : 'reverse') && loop.uses.length === 1 && loop.uses[0].edgeId === edge.id && loop.uses[0].sense === (index ? 'forward' : 'reverse'), C.GEOMETRY, 'Oriented Jordan disk cap required');
    const use = loop.uses[0], c = use.pcurve.curve;
    check(c.degree === worldCurve.degree && same(c.knots, worldCurve.knots) && same(c.weights, worldCurve.weights) && c.controlPoints.length === 9 && same(use.pcurve.domain, edge.sourceParameterRange), C.GEOMETRY, 'Matching whole cap trim basis required');
    for (const [j, p] of c.controlPoints.entries()) {
      check(equal(q.from(p[2]), zero) && p.slice(0, 2).every(v => q.compare(q.from(v), zero) >= 0 && q.compare(q.from(v), one) <= 0), C.GEOMETRY, 'Whole positive-weight trim hull must fit finite [0,1]² chart');
      for (let axis = 0; axis < 3; axis++) {
        const residual = q.sub(q.add(origin[axis], q.add(q.mul(a[axis], q.from(p[0])), q.mul(b[axis], q.from(p[1])))), q.from(worldCurve.controlPoints[j][axis]));
        if (!equal(residual, zero)) throw new StoredCirclePrismSolidError(C.GEOMETRY, 'Exact cap pole composition refused', freeze({ faceId: face.id, useId: use.id, poleIndex: j, axis, residual: q.text(residual) }));
      }
    }
    planarFaces.push({ faceId: face.id, normalSign: index ? 1 : -1, useId: use.id, poleCompositionCount: 9 });
  }
  const wallFace = t.faces.find(f => f.surfaceId === wall.id)!, wallLoop = t.loops.find(l => l.id === wallFace.outerLoopId)!;
  check(wallFace.role === 'wall' && wallFace.orientation === 'forward' && wall.degreeU === 2 && wall.degreeV === 1 && same(wall.knotsU, ring.knots) && same(wall.knotsV, [0, 0, 1, 1]) && wall.controlPoints.length === 9 && wall.weights.length === 9, C.GEOMETRY, 'Forward ring x height wall required');
  for (let i = 0; i < 9; i++) check(wall.controlPoints[i].length === 2 && wall.weights[i].length === 2 && wall.weights[i].every(w => w === ring.weights[i]) && pointEqual(wall.controlPoints[i][0], ring.controlPoints[i]) && pointEqual(wall.controlPoints[i][1], top.controlPoints[i]), C.GEOMETRY, 'Exact whole wall product coefficients required');
  check(seam.degree === 1 && same(seam.knots, [0, 0, 1, 1]) && same(seam.weights, [1, 1]) && seam.controlPoints.length === 2 && pointEqual(seam.controlPoints[0], ring.controlPoints[0]) && pointEqual(seam.controlPoints[1], top.controlPoints[0]), C.GEOMETRY, 'Exact native product seam required');
  check(wallLoop.uses.length === 4 && wallLoop.uses.filter(u => u.edgeId === seamEdge.id).length === 2, C.GEOMETRY, 'One twice-used seam required');
  for (const use of wallLoop.uses) {
    const c = use.pcurve.curve, edge = edges.get(use.edgeId)!, ringUse = edge.id === bottomEdge.id || edge.id === topEdge.id, end = ringUse ? 4 : 1;
    check(c.degree === 1 && same(c.knots, [0, 0, end, end]) && same(c.weights, [1, 1]) && c.controlPoints.length === 2 && same(use.pcurve.domain, [0, end]), C.GEOMETRY, 'Whole wall trim parameter map required');
    const v = edge.id === bottomEdge.id ? 0 : 1, u = c.controlPoints[0][0];
    check(ringUse ? same(c.controlPoints, [[0, v, 0], [4, v, 0]]) : edge.id === seamEdge.id && (u === 0 || u === 4) && same(c.controlPoints, [[u, 0, 0], [u, 1, 0]]), C.GEOMETRY, 'Exact u=t ring/v=t seam correspondence required');
  }
  // Jordan disk x a positive interval has disjoint cap/wall interiors and an
  // injective wall away from its identified seam; tangent x +Z is outward.
  const { vertexLinks, faceAdjacency } = topologyProof(parent.bundle);
  check(t.vertices.length - t.edges.length + t.faces.length === 2, C.GEOMETRY, 'Embedded product boundary requires Euler2');
  const world = compileWorld(geometry);
  const certificate: StoredCirclePrismSolidCertificate = { kind: 'restricted-stored-rational-circle-prism-solid', version: 0, lengthUnit: 'mm', geometryAuthority: 'stored-coefficient-mathematical-model', solid: true, topologyCertified: true, embeddedStoredGeometryCertified: true, materialComponentCount: 1, genus: 0, faceCount: 3, vertexCount: 2, edgeCount: 3, loopCount: 3, edgeUseCount: 6, eulerCharacteristic: 2, planarFaces, ringProof: { bottomEdgeId: bottomEdge.id, topEdgeId: topEdge.id, storedMiddleWeight: ring.weights[1], quadrants }, wallProof: { faceId: wallFace.id, seamEdgeId: seamEdge.id, heightMM: construction.heightMM }, vertexLinks, faceAdjacency, arithmetic: q.counts(), directCounts: { parentReconstructionCalls: 1, wholeModelCompilations: 1, capUseCount: 2, capPoleCompositions: 18, wallUseCount: 4, cornerCount: 6, germCount: 6 } };
  return freeze(snapshot({ parent, world, certificate }));
}

function topologyProof(bundle: XYCirclePrismShellBundle): Pick<StoredCirclePrismSolidCertificate, 'vertexLinks' | 'faceAdjacency'> {
  const t = bundle.topology, edges = new Map(t.edges.map(e => [e.id, e])), key = (g: StoredCirclePrismSolidGerm) => g.edgeId + ':' + g.endpointIndex;
  check(edges.size === t.edges.length && new Set(t.vertices.map(v => v.id)).size === t.vertices.length && new Set(t.faces.map(f => f.id)).size === t.faces.length && new Set(t.loops.map(l => l.id)).size === t.loops.length, C.GEOMETRY, 'Distinct native topology identities required');
  const vertexLinks: StoredCirclePrismSolidVertexLink[] = t.vertices.map(v => ({ vertexId: v.id, germs: t.edges.flatMap(e => e.vertexIds.flatMap((id, i) => id === v.id ? [{ edgeId: e.id, endpointIndex: i as 0 | 1 }] : [])), corners: [], cycle: [] }));
  const uses = new Map<string, { faceId: string; sense: string }[]>(), useIds = new Set<string>();
  for (const face of t.faces) check(t.loops.filter(l => l.faceId === face.id).length === 1 && t.loops.some(l => l.id === face.outerLoopId && l.faceId === face.id), C.GEOMETRY, 'One fully bound native disk chart loop per face required');
  for (const loop of t.loops) for (const [i, use] of loop.uses.entries()) {
    check(!useIds.has(use.id), C.GEOMETRY, 'Duplicate native use'); useIds.add(use.id);
    const incoming = edges.get(use.edgeId), nextUse = loop.uses[(i + 1) % loop.uses.length], outgoing = edges.get(nextUse.edgeId);
    check(!!incoming && !!outgoing, C.GEOMETRY, 'Orphan edge use');
    const from: StoredCirclePrismSolidGerm = { edgeId: incoming.id, endpointIndex: use.sense === 'forward' ? 1 : 0 }, to: StoredCirclePrismSolidGerm = { edgeId: outgoing.id, endpointIndex: nextUse.sense === 'forward' ? 0 : 1 };
    const id = incoming.vertexIds[from.endpointIndex], link = vertexLinks.find(v => v.vertexId === id);
    check(id === outgoing.vertexIds[to.endpointIndex] && !!link, C.GEOMETRY, 'Directed endpoint-germ closure required');
    link.corners.push({ faceId: loop.faceId, loopId: loop.id, incomingUseId: use.id, outgoingUseId: nextUse.id, from, to });
    const list = uses.get(use.edgeId) ?? []; list.push({ faceId: loop.faceId, sense: use.sense }); uses.set(use.edgeId, list);
  }
  for (const link of vertexLinks) {
    check(link.germs.length === 3 && link.corners.length === 3, C.GEOMETRY, 'Three distinct endpoint germs/corners per vertex required');
    for (const g of link.germs) check(link.corners.filter(c => key(c.from) === key(g)).length === 1 && link.corners.filter(c => key(c.to) === key(g)).length === 1, C.GEOMETRY, 'One incoming/outgoing corner per germ required');
    let current = link.germs[0]; const seen = new Set<string>();
    for (let i = 0; i < link.germs.length; i++) { check(!seen.has(key(current)), C.GEOMETRY, 'Split vertex-link cycle'); seen.add(key(current)); link.cycle.push({ ...current }); current = link.corners.find(c => key(c.from) === key(current))!.to; }
    check(key(current) === key(link.germs[0]) && seen.size === link.germs.length, C.GEOMETRY, 'One oriented three-germ cycle required');
  }
  const faceAdjacency = t.faces.map(f => ({ faceId: f.id, adjacentFaceIds: [] as string[] }));
  for (const e of t.edges) { const pair = uses.get(e.id); check(!!pair && pair.length === 2 && pair[0].sense !== pair[1].sense, C.GEOMETRY, 'Exactly two opposite uses per native edge required'); for (const [i, use] of pair.entries()) { const row = faceAdjacency.find(f => f.faceId === use.faceId); check(!!row, C.GEOMETRY, 'Orphan face use'); if (!row.adjacentFaceIds.includes(pair[1 - i].faceId)) row.adjacentFaceIds.push(pair[1 - i].faceId); } }
  const queue = [t.faces[0].id], reached = new Set(queue); for (let i = 0; i < queue.length; i++) for (const id of faceAdjacency.find(f => f.faceId === queue[i])!.adjacentFaceIds) if (!reached.has(id)) { reached.add(id); queue.push(id); }
  check(reached.size === t.faces.length && useIds.size === 6, C.GEOMETRY, 'Connected complete native boundary required'); return { vertexLinks, faceAdjacency };
}

export function validateStoredCirclePrismSolid(input: StoredCirclePrismSolidResult): StoredCirclePrismSolidCertificate {
  const owned = snapshot(input); resultShape(owned);
  const rebuilt = qualifyStoredCirclePrismSolid(owned.parent);
  check(same(owned, rebuilt), C.OWNED, 'Complete owned parent/world/proof/counter bits changed');
  return freeze(snapshot(rebuilt.certificate));
}
