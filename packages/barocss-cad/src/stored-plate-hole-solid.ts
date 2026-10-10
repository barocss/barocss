import { buildOwnPlateCircularHole, validateOwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';
import type { OwnPlateCircularHoleBundle, OwnPlateCircularHoleReport } from './own-plate-circular-hole.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Point } from './types.js';

export const StoredPlateHoleSolidDiagnosticCode = { INPUT: 'INPUT', NATIVE: 'NATIVE', GEOMETRY: 'GEOMETRY', TOPOLOGY: 'TOPOLOGY', BUDGET: 'BUDGET', OWNED: 'OWNED', CODEC: 'CODEC', VERSION: 'VERSION' } as const;
type Code = typeof StoredPlateHoleSolidDiagnosticCode[keyof typeof StoredPlateHoleSolidDiagnosticCode];
export class StoredPlateHoleSolidError extends Error {
  readonly code: Code;
  constructor(code: Code, detail: string, cause?: unknown) { super(('Stored plate-hole Solid: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'StoredPlateHoleSolidError'; this.code = code; }
}
export interface StoredPlateHoleSolidGerm { edgeId: string; endpointIndex: 0 | 1 }
export interface StoredPlateHoleSolidCorner { faceId: string; loopId: string; incomingUseId: string; outgoingUseId: string; from: StoredPlateHoleSolidGerm; to: StoredPlateHoleSolidGerm }
export interface StoredPlateHoleSolidVertexLink { vertexId: string; germs: StoredPlateHoleSolidGerm[]; corners: StoredPlateHoleSolidCorner[]; cycle: StoredPlateHoleSolidGerm[] }
export interface StoredPlateHoleSolidCertificate {
  kind: 'restricted-stored-rational-plate-hole-solid'; version: 0; lengthUnit: 'mm'; geometryAuthority: 'stored-coefficient-mathematical-model';
  solid: true; topologyCertified: true; embeddedStoredGeometryCertified: true; materialComponentCount: 1; genus: 1;
  faceCount: 7; vertexCount: 10; edgeCount: 15; loopCount: 9; edgeUseCount: 30;
  planarFaces: { faceId: string; normalAxis: number; normalSign: -1 | 1; useIds: string[]; poleCompositionCount: number }[];
  ringProof: { bottomEdgeId: string; topEdgeId: string; storedMiddleWeight: number; quadrants: { index: number; derivativeNumeratorsX: SectionFraction[]; derivativeNumeratorsY: SectionFraction[] }[] };
  wallProof: { faceId: string; seamEdgeId: string; heightMM: number };
  vertexLinks: StoredPlateHoleSolidVertexLink[]; faceAdjacency: { faceId: string; adjacentFaceIds: string[] }[]; weightedEuler: 0;
  directCounts: { parentValidationCalls: 1; planarUseCount: number; planarPoleCompositions: number; wallUseCount: 4; cornerCount: 30; germCount: 30; rational: ReturnType<SectionRationalContext['counts']> };
}
export interface StoredPlateHoleSolidResult { bundle: OwnPlateCircularHoleBundle; parentReport: OwnPlateCircularHoleReport; certificate: StoredPlateHoleSolidCertificate }
const C = StoredPlateHoleSolidDiagnosticCode;
function check(ok: boolean, code: Code, detail: string): asserts ok { if (!ok) throw new StoredPlateHoleSolidError(code, detail); }
function child<T>(fn: () => T, code: Code, detail: string): T { try { return fn(); } catch (cause) { throw new StoredPlateHoleSolidError(code, detail, cause); } }
const bytes = (value: string) => new TextEncoder().encode(value).length;
/** Read descriptors before values; copy every occurrence, including repeated parent paths. */
function snapshot<T>(input: T): T {
  let remaining = 131072, strings = 0, stringBytes = 0;
  const copy = (v: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, C.BUDGET, 'Own-data occurrence/depth budget exceeded');
    if (typeof v === 'number') { check(Number.isFinite(v), C.INPUT, 'Finite numeric data required'); return v; }
    if (typeof v === 'string') { strings += v.length; check(v.length <= 262144 && strings <= 1048576, C.BUDGET, 'Own-data string length budget exceeded'); stringBytes += bytes(v); check(stringBytes <= 1048576, C.BUDGET, 'Own-data UTF8 string budget exceeded'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    check(typeof v === 'object', C.INPUT, 'Plain data required');
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v), descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, C.INPUT, 'Foreign prototype');
    check(keys.every(k => typeof k === 'string' && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable)), C.INPUT, 'Getters/symbols/hidden fields refuse');
    if (array) { const n = descriptors.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= 1024 && keys.length === n + 1, C.INPUT, 'Dense arrays within1024 required'); return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), C.INPUT, 'Sparse array'); return copy(descriptors[String(i)].value, depth + 1); }); }
    check(keys.length <= 64, C.BUDGET, 'Record field budget exceeded'); return Object.fromEntries((keys as string[]).map(k => [k, copy(descriptors[k].value, depth + 1)]));
  }; return copy(input, 0) as T;
}
function record(value: unknown, keys: string[], code: Code): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'Record required'); const r = value as Record<string, unknown>; check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)), code, 'Exact fields required: ' + keys.join(',')); return r; }
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k])); } return Object.is(a, b);
}
/** Certifies this stored family; all native provider evaluation/refusal semantics stay unchanged. */
export function qualifyStoredPlateHoleSolid(input: OwnPlateCircularHoleBundle): StoredPlateHoleSolidResult {
  const bundle = snapshot(input);
  const parentReport = child(() => validateOwnPlateCircularHoleBundle(bundle), C.NATIVE, 'Actual unchanged parent bundle validation refused');
  const { faces, topology: t, request: r } = bundle;
  check(faces.length === 7 && t.vertices.length === 10 && t.edges.length === 15 && t.loops.length === 9 && t.loops.reduce((n, l) => n + l.uses.length, 0) === 30 && bundle.sourceModels.length === 7, C.BUDGET, 'Fixed native family7/10/15/9/30/7 required');
  const q = new SectionRationalContext((kind, detail) => { throw new StoredPlateHoleSolidError(kind === 'BUDGET' ? C.BUDGET : C.GEOMETRY, detail); });
  const zero = q.rat(0n), two = q.rat(2n), from = (p: Point) => p.map(v => q.from(v)), equal = (a: SectionRational, b: SectionRational) => q.compare(a, b) === 0;
  const pointEqual = (a: Point, b: Point) => a.every((v, i) => equal(q.from(v), q.from(b[i])));
  const edgeMap = new Map(t.edges.map(e => [e.id, e])), vertexMap = new Map(t.vertices.map(v => [v.id, v.point]));
  for (const e of t.edges) for (const i of [0, 1] as const) check(pointEqual(e.curve.controlPoints[i === 0 ? 0 : e.curve.controlPoints.length - 1], vertexMap.get(e.vertexIds[i])!), C.GEOMETRY, 'Exact stored endpoint/declared Vertex agreement required');
  const bottomCap = faces.find(f => f.role === 'bottom-cap')!, topCap = faces.find(f => f.role === 'top-cap')!, wall = faces.find(f => f.role === 'hole-wall')!;
  const ringAt = (id: string) => edgeMap.get(t.loops.find(l => l.id === id)!.uses[0].edgeId)!;
  const bottom = ringAt(bottomCap.innerLoopIds[0]), top = ringAt(topCap.innerLoopIds[0]);
  const knots = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4], ring = bottom.curve;
  check(ring.degree === 2 && ring.controlPoints.length === 9 && same(ring.knots, knots) && ring.weights.every((w, i) => w > 0 && w === (i % 2 ? ring.weights[1] : 1)) && ring.weights[1] === Math.SQRT1_2, C.GEOMETRY, 'Original four positive-weight quadratic spans required');
  check(top.curve.degree === ring.degree && same(top.curve.knots, ring.knots) && same(top.curve.weights, ring.weights) && top.curve.controlPoints.length === 9, C.GEOMETRY, 'Whole top/bottom basis and weights must match');
  const cx = q.from(r.centreMM[0]), cy = q.from(r.centreMM[1]), height = q.from(r.thicknessMM);
  for (const [i, p] of ring.controlPoints.entries()) {
    check(equal(q.from(p[2]), zero) && equal(q.from(top.curve.controlPoints[i][2]), height) && p.slice(0, 2).every((v, axis) => equal(q.from(v), q.from(top.curve.controlPoints[i][axis]))), C.GEOMETRY, 'Exact ring product columns required');
    check(q.compare(q.from(p[0]), zero) > 0 && q.compare(q.from(p[0]), q.from(r.widthMM)) < 0 && q.compare(q.from(p[1]), zero) > 0 && q.compare(q.from(p[1]), q.from(r.heightMM)) < 0, C.GEOMETRY, 'Entire positive-weight ring pole hull must lie strictly inside rectangle');
  }
  check(pointEqual(ring.controlPoints[0], ring.controlPoints[8]), C.GEOMETRY, 'Exact closed stored ring required');
  const cardinal = ring.controlPoints.filter((_, i) => i % 2 === 0), relative = cardinal.slice(0, 4).map(p => [q.sub(q.from(p[0]), cx), q.sub(q.from(p[1]), cy)]);
  check(q.compare(relative[0][0], zero) > 0 && equal(relative[0][1], zero) && equal(relative[1][0], zero) && q.compare(relative[1][1], zero) > 0 && q.compare(relative[2][0], zero) < 0 && equal(relative[2][1], zero) && equal(relative[3][0], zero) && q.compare(relative[3][1], zero) < 0, C.GEOMETRY, 'Distinct CCW cardinal endpoints required');
  const quadrants: StoredPlateHoleSolidCertificate['ringProof']['quadrants'] = [];
  for (let i = 0; i < 4; i++) {
    const p = ring.controlPoints.slice(i * 2, i * 2 + 3), corner = i % 2 === 0 ? [p[0][0], p[2][1]] : [p[2][0], p[0][1]];
    check(equal(q.from(p[1][0]), q.from(corner[0])) && equal(q.from(p[1][1]), q.from(corner[1])), C.GEOMETRY, 'Quadrant tangent-control corner required');
    const derivative = (axis: number) => { const a = q.from(p[0][axis]), b = q.from(p[1][axis]), c = q.from(p[2][axis]), w2 = q.mul(two, q.from(ring.weights[1])); return [q.mul(w2, q.sub(b, a)), q.sub(c, a), q.mul(w2, q.sub(c, b))]; };
    const dx = derivative(0), dy = derivative(1), sx = i < 2 ? -1 : 1, sy = i === 0 || i === 3 ? 1 : -1;
    for (const [d, sign] of [[dx, sx], [dy, sy]] as const) check(d.every(v => q.compare(v, zero) * sign >= 0) && q.compare(d[1], zero) * sign > 0, C.GEOMETRY, 'Strict interior coordinate monotonicity required');
    check(!equal(dx[0], zero) || !equal(dy[0], zero), C.GEOMETRY, 'Regular start tangent required'); check(!equal(dx[2], zero) || !equal(dy[2], zero), C.GEOMETRY, 'Regular end tangent required');
    quadrants.push({ index: i, derivativeNumeratorsX: dx.map(v => q.text(v)), derivativeNumeratorsY: dy.map(v => q.text(v)) });
  }
  // Positive weights put each quadrant inside its pole hull. Strict interior
  // monotonicity separates quadrants; their only shared points are adjacent ends.
  const planarFaces: StoredPlateHoleSolidCertificate['planarFaces'] = []; let planarUseCount = 0, planarPoleCompositions = 0;
  for (const face of faces.filter(f => f.role !== 'hole-wall')) {
    const s = face.surface;
    check(s.degreeU === 1 && s.degreeV === 1 && same(s.knotsU, [0, 0, 1, 1]) && same(s.knotsV, [0, 0, 1, 1]) && s.controlPoints.length === 2 && s.controlPoints.every(row => row.length === 2) && s.weights.every(row => row.every(w => w === 1)), C.GEOMETRY, 'Canonical affine2x2 support required');
    const o = from(s.controlPoints[0][0]), a = from(s.controlPoints[1][0]).map((v, axis) => q.sub(v, o[axis])), b = from(s.controlPoints[0][1]).map((v, axis) => q.sub(v, o[axis]));
    check(from(s.controlPoints[1][1]).every((v, axis) => equal(v, q.add(o[axis], q.add(a[axis], b[axis])))), C.GEOMETRY, 'Support bilinear coefficient must be exactly zero');
    const ua = a.flatMap((v, i) => equal(v, zero) ? [] : [i]), vb = b.flatMap((v, i) => equal(v, zero) ? [] : [i]); check(ua.length === 1 && vb.length === 1 && ua[0] !== vb[0], C.GEOMETRY, 'Nondegenerate original axis chart required');
    const axis = [0, 1, 2].find(i => i !== ua[0] && i !== vb[0])!, dimensions = [r.widthMM, r.heightMM, r.thicknessMM];
    const cross = [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))];
    const sign = q.compare(cross[axis], zero) * (face.orientation === 'forward' ? 1 : -1) as -1 | 1;
    const low = equal(o[axis], zero), high = equal(o[axis], q.from(dimensions[axis])); check(low !== high && sign === (low ? -1 : 1), C.GEOMETRY, 'Exact outward boundary plane required');
    check(face.role === 'bottom-cap' ? axis === 2 && low : face.role === 'top-cap' ? axis === 2 && high : axis !== 2, C.GEOMETRY, 'Actual Face role and outer plane must agree');
    for (const i of [ua[0], vb[0]]) { const values = s.controlPoints.flat().map(p => q.from(p[i])); check(values.every(v => equal(v, zero) || equal(v, q.from(dimensions[i]))) && values.some(v => equal(v, zero)) && values.some(v => equal(v, q.from(dimensions[i]))), C.GEOMETRY, 'Support rectangle must span the entire native plate side/cap'); }
    const loops = t.loops.filter(l => l.faceId === face.id), useIds: string[] = []; let poles = 0;
    check(loops.find(l => l.id === face.outerLoopId)!.uses.length === 4, C.GEOMETRY, 'Four native rectangular outer boundary uses required');
    for (const use of loops.flatMap(l => l.uses)) {
      const e = edgeMap.get(use.edgeId)!, c = use.pcurve.curve;
      check(c.degree === e.curve.degree && same(c.knots, e.curve.knots) && same(c.weights, e.curve.weights) && c.controlPoints.length === e.curve.controlPoints.length && same(use.pcurve.domain, e.sourceParameterRange), C.GEOMETRY, 'Original planar Edge/pcurve basis and domain agreement required');
      for (const [j, p] of c.controlPoints.entries()) { check(equal(q.from(p[2]), zero), C.GEOMETRY, 'UV must remain dimensionless planar'); for (let i = 0; i < 3; i++) check(equal(q.add(o[i], q.add(q.mul(a[i], q.from(p[0])), q.mul(b[i], q.from(p[1])))), q.from(e.curve.controlPoints[j][i])), C.GEOMETRY, 'Exact whole-curve stored pole chart composition refused'); poles++; }
      planarUseCount++; useIds.push(use.id);
    }
    planarPoleCompositions += poles; planarFaces.push({ faceId: face.id, normalAxis: axis, normalSign: sign, useIds, poleCompositionCount: poles });
  }
  const s = wall.surface, wallLoop = t.loops.find(l => l.id === wall.outerLoopId)!;
  check(wall.orientation === 'reverse' && s.degreeU === 2 && s.degreeV === 1 && same(s.knotsU, ring.knots) && same(s.knotsV, [0, 0, 1, 1]) && s.controlPoints.length === 9 && s.controlPoints.every(row => row.length === 2) && s.weights.length === 9, C.GEOMETRY, 'Original reversed product wall required');
  for (let i = 0; i < 9; i++) check(s.weights[i].length === 2 && s.weights[i].every(w => w === ring.weights[i]) && pointEqual(s.controlPoints[i][0], ring.controlPoints[i]) && pointEqual(s.controlPoints[i][1], top.curve.controlPoints[i]), C.GEOMETRY, 'Whole wall stored ring x height product required');
  const seams = [...new Set(wallLoop.uses.filter(u => u.edgeId !== bottom.id && u.edgeId !== top.id).map(u => u.edgeId))]; check(seams.length === 1 && wallLoop.uses.length === 4, C.GEOMETRY, 'One repeated original wall seam required'); const seam = edgeMap.get(seams[0])!;
  check(seam.curve.degree === 1 && same(seam.curve.knots, [0, 0, 1, 1]) && same(seam.curve.weights, [1, 1]) && pointEqual(seam.curve.controlPoints[0], ring.controlPoints[0]) && pointEqual(seam.curve.controlPoints[1], top.curve.controlPoints[0]), C.GEOMETRY, 'Exact product seam endpoints required');
  for (const use of wallLoop.uses) {
    const c = use.pcurve.curve, e = edgeMap.get(use.edgeId)!, ringUse = e.id === bottom.id || e.id === top.id, end = ringUse ? 4 : 1;
    check(c.degree === 1 && same(c.knots, [0, 0, end, end]) && same(c.weights, [1, 1]) && c.controlPoints.length === 2 && same(use.pcurve.domain, [0, end]), C.GEOMETRY, 'Canonical whole wall parameter map required');
    const v = e.id === bottom.id ? 0 : 1, u = c.controlPoints[0][0];
    check(ringUse ? same(c.controlPoints, [[0, v, 0], [4, v, 0]]) : (u === 0 || u === 4) && same(c.controlPoints, [[u, 0, 0], [u, 1, 0]]), C.GEOMETRY, 'Exact u=t ring or v=t seam correspondence required');
  }
  const { vertexLinks, faceAdjacency } = topologyProof(bundle);
  const weightedEuler = t.vertices.length - t.edges.length + faces.reduce((n, f) => n + 1 - f.innerLoopIds.length, 0); check(weightedEuler === 0, C.TOPOLOGY, 'Annular caps require genus-one weighted Euler0');
  const certificate: StoredPlateHoleSolidCertificate = { kind: 'restricted-stored-rational-plate-hole-solid', version: 0, lengthUnit: 'mm', geometryAuthority: 'stored-coefficient-mathematical-model', solid: true, topologyCertified: true, embeddedStoredGeometryCertified: true, materialComponentCount: 1, genus: 1, faceCount: 7, vertexCount: 10, edgeCount: 15, loopCount: 9, edgeUseCount: 30, planarFaces, ringProof: { bottomEdgeId: bottom.id, topEdgeId: top.id, storedMiddleWeight: ring.weights[1], quadrants }, wallProof: { faceId: wall.id, seamEdgeId: seam.id, heightMM: r.thicknessMM }, vertexLinks, faceAdjacency, weightedEuler: 0, directCounts: { parentValidationCalls: 1, planarUseCount, planarPoleCompositions, wallUseCount: 4, cornerCount: 30, germCount: 30, rational: q.counts() } };
  return snapshot({ bundle, parentReport, certificate });
}
function topologyProof(bundle: OwnPlateCircularHoleBundle): Pick<StoredPlateHoleSolidCertificate, 'vertexLinks' | 'faceAdjacency'> {
  const t = bundle.topology, edges = new Map(t.edges.map(e => [e.id, e])), key = (g: StoredPlateHoleSolidGerm) => g.edgeId + ':' + g.endpointIndex;
  const links: StoredPlateHoleSolidVertexLink[] = t.vertices.map(v => ({ vertexId: v.id, germs: t.edges.flatMap(e => e.vertexIds.flatMap((id, i) => id === v.id ? [{ edgeId: e.id, endpointIndex: i as 0 | 1 }] : [])), corners: [], cycle: [] }));
  const uses = new Map<string, { faceId: string; sense: string }[]>();
  for (const loop of t.loops) for (const [i, use] of loop.uses.entries()) {
    const incoming = edges.get(use.edgeId)!, nextUse = loop.uses[(i + 1) % loop.uses.length], outgoing = edges.get(nextUse.edgeId)!;
    const from: StoredPlateHoleSolidGerm = { edgeId: incoming.id, endpointIndex: use.sense === 'forward' ? 1 : 0 }, to: StoredPlateHoleSolidGerm = { edgeId: outgoing.id, endpointIndex: nextUse.sense === 'forward' ? 0 : 1 };
    const id = incoming.vertexIds[from.endpointIndex]; check(id === outgoing.vertexIds[to.endpointIndex], C.TOPOLOGY, 'Directed loop vertex closure required');
    links.find(l => l.vertexId === id)!.corners.push({ faceId: loop.faceId, loopId: loop.id, incomingUseId: use.id, outgoingUseId: nextUse.id, from, to });
    const list = uses.get(use.edgeId) ?? []; list.push({ faceId: loop.faceId, sense: use.sense }); uses.set(use.edgeId, list);
  }
  for (const link of links) {
    check(link.germs.length === 3 && link.corners.length === 3, C.TOPOLOGY, 'Each original vertex requires three endpoint germs and corners');
    for (const g of link.germs) check(link.corners.filter(c => key(c.from) === key(g)).length === 1 && link.corners.filter(c => key(c.to) === key(g)).length === 1, C.TOPOLOGY, 'Exactly one incoming/outgoing arc per germ required');
    let current = link.germs[0]; const seen = new Set<string>();
    for (let i = 0; i < link.germs.length; i++) { check(!seen.has(key(current)), C.TOPOLOGY, 'Vertex link cannot split into smaller cycles'); seen.add(key(current)); link.cycle.push({ ...current }); current = link.corners.find(c => key(c.from) === key(current))!.to; }
    check(key(current) === key(link.germs[0]) && seen.size === link.germs.length, C.TOPOLOGY, 'One oriented vertex-link cycle required');
  }
  const faceAdjacency = bundle.faces.map(f => ({ faceId: f.id, adjacentFaceIds: [] as string[] }));
  for (const e of t.edges) { const pair = uses.get(e.id)!; check(pair.length === 2 && pair[0].sense !== pair[1].sense, C.TOPOLOGY, 'Exactly two opposite uses per Edge required'); for (const [i, use] of pair.entries()) { const row = faceAdjacency.find(f => f.faceId === use.faceId)!; if (!row.adjacentFaceIds.includes(pair[1 - i].faceId)) row.adjacentFaceIds.push(pair[1 - i].faceId); } }
  const queue = [bundle.faces[0].id], reached = new Set(queue); for (let i = 0; i < queue.length; i++) for (const id of faceAdjacency.find(f => f.faceId === queue[i])!.adjacentFaceIds) if (!reached.has(id)) { reached.add(id); queue.push(id); }
  check(reached.size === bundle.faces.length, C.TOPOLOGY, 'Connected native material boundary required'); return { vertexLinks: links, faceAdjacency };
}
export function validateStoredPlateHoleSolid(input: StoredPlateHoleSolidResult): StoredPlateHoleSolidCertificate {
  const owned = snapshot(input); record(owned, ['bundle', 'parentReport', 'certificate'], C.OWNED);
  const rebuilt = child(() => qualifyStoredPlateHoleSolid(owned.bundle), C.OWNED, 'Actual full stored Solid reconstruction refused'); check(same(owned, rebuilt), C.OWNED, 'Owned source/geometry/topology/parent/proof/counter bits changed'); return snapshot(rebuilt.certificate);
}
function jsonSize(text: string): void { check(text.length <= 262144 && bytes(text) <= 262144, C.BUDGET, 'Authored file exceeds262144 UTF16/UTF8 units'); }
export function serializeStoredPlateHoleSolid(input: StoredPlateHoleSolidResult): string {
  validateStoredPlateHoleSolid(input); const owned = snapshot(input);
  const encode = (v: unknown): string => { if (typeof v === 'number') return Object.is(v, -0) ? '-0' : JSON.stringify(v); if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']'; return '{' + Object.entries(v as Record<string, unknown>).map(([k, value]) => JSON.stringify(k) + ':' + encode(value)).join(',') + '}'; };
  const text = encode({ schema: 'barocss-stored-plate-hole-solid', version: 0, request: owned.bundle.request }) + '\n'; jsonSize(text); return text;
}

/** Bound lexical admission and duplicate keys before the built-in JSON syntax/value parser. */
function scanJSON(text: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = []; let remaining = 131072;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (/[ \n\r\t]/.test(c)) continue; const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 1024, C.BUDGET, 'JSON array exceeds1024 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, C.BUDGET, 'JSON lexical value/key budget exceeded');
    if (c === '"') {
      let end = i + 1; for (; end < text.length; end++) { if (text[end] === '\\') end++; else if (text[end] === '"') break; } check(end < text.length, C.CODEC, 'Unterminated JSON string');
      const value: unknown = JSON.parse(text.slice(i, end + 1)); check(typeof value === 'string' && value.length <= 262144, C.BUDGET, 'JSON string budget exceeded'); let next = end + 1; while (next < text.length && /[ \n\r\t]/.test(text[next])) next++;
      if (text[next] === ':') { check(parent?.kind === '{', C.CODEC, 'JSON object key must belong to an object'); check(!parent.keys.has(value), C.CODEC, 'Duplicate JSON object key'); parent.keys.add(value); check(parent.keys.size <= 64, C.BUDGET, 'JSON record exceeds64 fields'); } i = end; continue;
    }
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 32, C.BUDGET, 'JSON depth exceeds32'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), C.CODEC, 'Unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++;
  }
  check(stack.length === 0, C.CODEC, 'Unclosed JSON container');
}
export function parseStoredPlateHoleSolid(text: string): StoredPlateHoleSolidResult {
  check(typeof text === 'string', C.CODEC, 'Authored JSON text is required'); jsonSize(text); let value: unknown;
  try { scanJSON(text); value = JSON.parse(text); } catch (cause) { if (cause instanceof StoredPlateHoleSolidError) throw cause; throw new StoredPlateHoleSolidError(C.CODEC, 'Actual JSON syntax/value parsing refused', cause); }
  const file = record(snapshot(value), ['schema', 'version', 'request'], C.CODEC);
  check(file.schema === 'barocss-stored-plate-hole-solid' && file.version === 0, C.VERSION, 'Stored plate-hole authored schema/version0 required');
  const built = child(() => buildOwnPlateCircularHole(file.request as OwnPlateCircularHoleBundle['request']), C.NATIVE, 'Actual authored parent construction refused'); return qualifyStoredPlateHoleSolid(built.bundle);
}
