import { validateStoredPlateHoleSolid } from './stored-plate-hole-solid.js';
import type { StoredPlateHoleSolidResult } from './stored-plate-hole-solid.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Point } from './types.js';

export const StoredPlateHolePointDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', SOLID: 'SOLID', ARITHMETIC: 'ARITHMETIC', OWNED: 'OWNED', CODEC: 'CODEC', VERSION: 'VERSION' } as const);
type Code = typeof StoredPlateHolePointDiagnosticCode[keyof typeof StoredPlateHolePointDiagnosticCode];
export class StoredPlateHolePointError extends Error {
  readonly code: Code;
  constructor(code: Code, detail: string, cause?: unknown) { super(('Stored plate-hole point: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'StoredPlateHolePointError'; this.code = code; }
}
export interface StoredPlateHolePointQuery { queryId: string; pointMM: Point }
export interface StoredPlateHolePointOptions { evaluationId: string; maximumQueries: 8 }
type BoxPosition = 'below' | 'minimum' | 'interior' | 'maximum' | 'above';
export interface StoredPlateHolePointProof {
  queryId: string; boxPositions: [BoxPosition, BoxPosition, BoxPosition]; quadrant: 0 | 1 | 2 | 3 | null;
  normalized: { x: SectionFraction; y: SectionFraction } | null; holeStatus: 'inside' | 'outside' | 'boundary' | 'not-tested';
  branch: 'box-outside' | 'beyond-cardinal-box' | 'below-chord' | 'on-chord' | 'positive-conic'; conic: SectionFraction | null;
  faceTestCount: number; edgeTestCount: number; vertexTestCount: number;
}
export interface StoredPlateHolePointClassification {
  queryId: string; status: 'inside' | 'outside' | 'boundary'; bodyIds: string[];
  boundary: {
    faces: { faceId: string; surfaceId: string; sourceModelFaceId: string; role: StoredPlateHoleSolidResult['bundle']['faces'][number]['role'] }[];
    edges: { edgeId: string; curveId: string; vertexIds: [string, string]; kind: 'outer-line' | 'bottom-ring' | 'top-ring' | 'wall-seam'; useIds: string[] }[];
    vertexIds: string[];
  };
}
export interface StoredPlateHolePointReport {
  schema: 'barocss-stored-plate-hole-solid-point-classification'; version: 0; evaluationId: string; bodyId: string; lengthUnit: 'mm'; sourceFrame: 'authored-xyz'; authority: 'stored-coefficient-conic-product-material';
  queryCount: number; counts: { inside: number; outside: number; boundary: number };
  quality: { restrictedStoredMaterialCertified: true; generalCurvedSolidCertified: false; toleranceUsed: false; rayUsed: false; nativeD0EqualityAuthority: false; parentUnchanged: true };
  directCounts: { solidValidationCount: 1; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; surfacePointEvaluationCount: 0; surfaceDerivativeEvaluationCount: 0; sourceCompilationCount: 0; faceTests: number; edgeTests: number; vertexTests: number };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  limits: { maximumQueries: 8; faceTests: 56; edgeTests: 120; vertexTests: 80; rationalOperations: 200000; gcdSteps: 200000; rationalBits: 8192; ownOccurrences: 131072; ownDepth: 32; arrayEntries: 1024; recordFields: 64; stringUnits: 262144; aggregateStringUnits: 1048576; fileUTF16: 262144; fileUTF8: 262144 };
}
export interface StoredPlateHolePointResult { solid: StoredPlateHoleSolidResult; queries: StoredPlateHolePointQuery[]; options: StoredPlateHolePointOptions; classifications: StoredPlateHolePointClassification[]; proof: StoredPlateHolePointProof[]; report: StoredPlateHolePointReport }
const C = StoredPlateHolePointDiagnosticCode;
function check(ok: boolean, code: Code, detail: string): asserts ok { if (!ok) throw new StoredPlateHolePointError(code, detail); }
function child<T>(fn: () => T, code: Code, detail: string): T { try { return fn(); } catch (cause) { throw new StoredPlateHolePointError(code, detail, cause); } }
const bytes = (text: string) => new TextEncoder().encode(text).length;
function snapshot<T>(input: T): T {
  let remaining = 131072, units = 0, utf8 = 0;
  const copy = (v: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, C.BUDGET, 'Own occurrence/depth limit');
    if (typeof v === 'number') { check(Number.isFinite(v), C.INPUT, 'Finite numeric data required'); return v; }
    if (typeof v === 'string') { units += v.length; check(v.length <= 262144 && units <= 1048576, C.BUDGET, 'Own string length limit'); utf8 += bytes(v); check(utf8 <= 1048576, C.BUDGET, 'Own UTF8 limit'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    check(typeof v === 'object', C.INPUT, 'Plain data required'); const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v), d = Object.getOwnPropertyDescriptors(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, C.INPUT, 'Foreign prototype');
    check(keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in d[k] && (array && k === 'length' || d[k].enumerable)), C.INPUT, 'Getters/symbols/hidden fields refuse');
    if (array) { const n = d.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= 1024 && keys.length === n + 1, C.INPUT, 'Dense arrays within1024 required'); return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(d, String(i)), C.INPUT, 'Sparse array'); return copy(d[String(i)].value, depth + 1); }); }
    check(keys.length <= 64, C.BUDGET, 'Record field limit'); return Object.fromEntries((keys as string[]).map(k => [k, copy(d[k].value, depth + 1)]));
  }; return copy(input, 0) as T;
}
function record(v: unknown, keys: string[], code: Code = C.INPUT): Record<string, unknown> { check(v !== null && typeof v === 'object' && !Array.isArray(v), code, 'Record required'); const r = v as Record<string, unknown>; check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)), code, 'Exact fields required: ' + keys.join(',')); return r; }
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k])); } return Object.is(a, b);
}
function id(v: unknown): string { check(typeof v === 'string' && v.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v), C.IDENTITY, 'ASCII identifier1..48 required'); return v; }
/** Exact material predicates on the qualified stored ring x height product. */
export function classifyStoredPlateHoleSolidPoints(solidInput: StoredPlateHoleSolidResult, queriesInput: StoredPlateHolePointQuery[], optionsInput: StoredPlateHolePointOptions): StoredPlateHolePointResult {
  const owned = snapshot({ solid: solidInput, queries: queriesInput, options: optionsInput }), { solid, queries, options } = owned;
  record(options, ['evaluationId', 'maximumQueries']); const evaluationId = id(options.evaluationId); check(Object.is(options.maximumQueries, 8), C.BUDGET, 'Fixed maximumQueries8 required'); check(Array.isArray(queries) && queries.length >= 1 && queries.length <= 8, C.BUDGET, 'One through eight queries required');
  const ids = [evaluationId]; for (const query of queries) { record(query, ['queryId', 'pointMM']); ids.push(id(query.queryId)); check(Array.isArray(query.pointMM) && query.pointMM.length === 3 && query.pointMM.every(v => typeof v === 'number' && Number.isFinite(v)), C.INPUT, 'Finite original XYZ tuple required'); }
  check(new Set(ids).size === ids.length, C.IDENTITY, 'Query and evaluation IDs must be distinct');
  child(() => validateStoredPlateHoleSolid(solid), C.SOLID, 'Actual full qualified Solid validation refused');
  const { bundle, certificate } = solid, { request, topology: t } = bundle;
  const reserved = new Set([request.bodyId, request.featureId, ...Object.values(request.parameterIds), t.id, ...t.vertices.map(v => v.id), ...t.edges.flatMap(e => [e.id, e.curve.id]), ...bundle.faces.flatMap(f => [f.id, f.surface.id]), ...t.loops.flatMap(l => [l.id, ...l.uses.flatMap(u => [u.id, u.pcurve.curve.id])]), ...bundle.sourceModels.flatMap(s => [s.faceId, s.model.name, ...s.model.objects.map(o => o.id)])]);
  check(ids.every(v => !reserved.has(v)), C.IDENTITY, 'Evaluation/query IDs must not reuse original native/context IDs');
  const q = new SectionRationalContext((kind, detail) => { throw new StoredPlateHolePointError(kind === 'BUDGET' ? C.BUDGET : C.ARITHMETIC, detail); });
  const zero = q.rat(0n), one = q.rat(1n), four = q.rat(4n), eq = (a: SectionRational, b: SectionRational) => q.compare(a, b) === 0;
  const bottom = t.edges.find(e => e.id === certificate.ringProof.bottomEdgeId)!, top = t.edges.find(e => e.id === certificate.ringProof.topEdgeId)!, ring = bottom.curve;
  const cx = q.from(request.centreMM[0]), cy = q.from(request.centreMM[1]), w = q.from(certificate.ringProof.storedMiddleWeight), w4 = q.mul(four, q.mul(w, w));
  const rx = [q.sub(q.from(ring.controlPoints[0][0]), cx), q.sub(cx, q.from(ring.controlPoints[4][0]))], ry = [q.sub(q.from(ring.controlPoints[2][1]), cy), q.sub(cy, q.from(ring.controlPoints[6][1]))];
  const maximum = [request.widthMM, request.heightMM, request.thicknessMM].map(v => q.from(v));
  const position = (v: SectionRational, i: number): BoxPosition => q.compare(v, zero) < 0 ? 'below' : eq(v, zero) ? 'minimum' : q.compare(v, maximum[i]) < 0 ? 'interior' : eq(v, maximum[i]) ? 'maximum' : 'above';
  const classifications: StoredPlateHolePointClassification[] = [], proof: StoredPlateHolePointProof[] = []; let faceTests = 0, edgeTests = 0, vertexTests = 0;
  for (const query of queries) {
    const p = query.pointMM.map(v => q.from(v)), boxPositions = p.map(position) as StoredPlateHolePointProof['boxPositions'];
    const row: StoredPlateHolePointProof = { queryId: query.queryId, boxPositions, quadrant: null, normalized: null, holeStatus: 'not-tested', branch: 'box-outside', conic: null, faceTestCount: 0, edgeTestCount: 0, vertexTestCount: 0 };
    let status: StoredPlateHolePointClassification['status'] = 'outside';
    if (!boxPositions.some(v => v === 'below' || v === 'above')) {
      const dx = q.sub(p[0], cx), dy = q.sub(p[1], cy), negativeX = q.compare(dx, zero) < 0, negativeY = q.compare(dy, zero) < 0;
      row.quadrant = negativeY ? negativeX ? 2 : 3 : negativeX ? 1 : 0;
      const x = q.div(q.abs(dx), rx[negativeX ? 1 : 0]), y = q.div(q.abs(dy), ry[negativeY ? 1 : 0]); row.normalized = { x: q.text(x), y: q.text(y) };
      if (q.compare(x, one) > 0 || q.compare(y, one) > 0) { row.branch = 'beyond-cardinal-box'; row.holeStatus = 'outside'; }
      else {
        const sum = q.add(x, y), chord = q.compare(sum, one);
        if (chord < 0) { row.branch = 'below-chord'; row.holeStatus = 'inside'; }
        else if (chord === 0) { row.branch = 'on-chord'; row.holeStatus = eq(x, zero) || eq(y, zero) ? 'boundary' : 'inside'; }
        else { row.branch = 'positive-conic'; const a = q.sub(sum, one), f = q.sub(q.mul(a, a), q.mul(w4, q.mul(q.sub(one, x), q.sub(one, y)))); row.conic = q.text(f); const sign = q.compare(f, zero); row.holeStatus = sign < 0 ? 'inside' : sign > 0 ? 'outside' : 'boundary'; }
      }
      status = row.holeStatus === 'inside' ? 'outside' : row.holeStatus === 'boundary' || boxPositions.some(v => v === 'minimum' || v === 'maximum') ? 'boundary' : 'inside';
    }
    const boundary: StoredPlateHolePointClassification['boundary'] = { faces: [], edges: [], vertexIds: [] };
    if (status === 'boundary') {
      for (const face of bundle.faces) {
        row.faceTestCount++; const plane = certificate.planarFaces.find(f => f.faceId === face.id);
        const matches = face.role === 'hole-wall' ? row.holeStatus === 'boundary' : plane !== undefined && eq(p[plane.normalAxis], q.from(face.surface.controlPoints[0][0][plane.normalAxis]));
        if (matches) { const context = bundle.sourceModels.find(s => s.faceId === face.id)!; boundary.faces.push({ faceId: face.id, surfaceId: face.surface.id, sourceModelFaceId: context.faceId, role: face.role }); }
      }
      for (const edge of t.edges) {
        row.edgeTestCount++; let matches: boolean; let kind: StoredPlateHolePointClassification['boundary']['edges'][number]['kind'];
        if (edge.id === bottom.id || edge.id === top.id) { kind = edge.id === bottom.id ? 'bottom-ring' : 'top-ring'; matches = row.holeStatus === 'boundary' && eq(p[2], q.from(edge.curve.controlPoints[0][2])); }
        else {
          kind = edge.id === certificate.wallProof.seamEdgeId ? 'wall-seam' : 'outer-line'; const a = edge.curve.controlPoints[0], b = edge.curve.controlPoints[1];
          matches = p.every((v, i) => { const first = q.from(a[i]), last = q.from(b[i]); if (eq(first, last)) return eq(v, first); return q.compare(first, last) < 0 ? q.compare(v, first) >= 0 && q.compare(v, last) <= 0 : q.compare(v, last) >= 0 && q.compare(v, first) <= 0; });
        }
        if (matches) { const uses = t.loops.flatMap(l => l.uses.filter(u => u.edgeId === edge.id)); check(uses.length === 2 && uses[0].sense !== uses[1].sense, C.SOLID, 'Actual matched Edge must retain two opposite original uses'); boundary.edges.push({ edgeId: edge.id, curveId: edge.curve.id, vertexIds: [...edge.vertexIds], kind, useIds: uses.map(u => u.id) }); }
      }
      for (const vertex of t.vertices) { row.vertexTestCount++; if (p.every((v, i) => eq(v, q.from(vertex.point[i])))) { check(boundary.edges.some(e => e.vertexIds.includes(vertex.id)), C.SOLID, 'Matched original Vertex must belong to an actual matched Edge'); boundary.vertexIds.push(vertex.id); } }
      check(boundary.faces.length > 0, C.SOLID, 'Material boundary must bind an actual original Face');
    }
    faceTests += row.faceTestCount; edgeTests += row.edgeTestCount; vertexTests += row.vertexTestCount; proof.push(row); classifications.push({ queryId: query.queryId, status, bodyIds: status === 'outside' ? [] : [request.bodyId], boundary });
  }
  check(faceTests <= 56 && edgeTests <= 120 && vertexTests <= 80, C.BUDGET, 'Complete boundary test budget exceeded');
  const counts = { inside: 0, outside: 0, boundary: 0 }; for (const row of classifications) counts[row.status]++;
  const report: StoredPlateHolePointReport = { schema: 'barocss-stored-plate-hole-solid-point-classification', version: 0, evaluationId, bodyId: request.bodyId, lengthUnit: 'mm', sourceFrame: 'authored-xyz', authority: 'stored-coefficient-conic-product-material', queryCount: queries.length, counts, quality: { restrictedStoredMaterialCertified: true, generalCurvedSolidCertified: false, toleranceUsed: false, rayUsed: false, nativeD0EqualityAuthority: false, parentUnchanged: true }, directCounts: { solidValidationCount: 1, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0, faceTests, edgeTests, vertexTests }, rationalCounts: q.counts(), limits: { maximumQueries: 8, faceTests: 56, edgeTests: 120, vertexTests: 80, rationalOperations: 200000, gcdSteps: 200000, rationalBits: 8192, ownOccurrences: 131072, ownDepth: 32, arrayEntries: 1024, recordFields: 64, stringUnits: 262144, aggregateStringUnits: 1048576, fileUTF16: 262144, fileUTF8: 262144 } };
  return snapshot({ solid, queries, options, classifications, proof, report });
}
export function validateStoredPlateHoleSolidPoints(input: StoredPlateHolePointResult): StoredPlateHolePointReport {
  const owned = snapshot(input); record(owned, ['solid', 'queries', 'options', 'classifications', 'proof', 'report'], C.OWNED); const rebuilt = child(() => classifyStoredPlateHoleSolidPoints(owned.solid, owned.queries, owned.options), C.OWNED, 'Actual full stored material query reconstruction refused'); check(same(owned, rebuilt), C.OWNED, 'Owned source/Solid/query/material/proof/provenance/count bits changed'); return snapshot(rebuilt.report);
}
function jsonSize(text: string): void { check(text.length <= 262144 && bytes(text) <= 262144, C.BUDGET, 'Whole point file UTF16/UTF8 limit'); }
export function serializeStoredPlateHoleSolidPoints(input: StoredPlateHolePointResult): string {
  validateStoredPlateHoleSolidPoints(input); const owned = snapshot(input);
  const encode = (v: unknown): string => { if (typeof v === 'number') return Object.is(v, -0) ? '-0' : JSON.stringify(v); if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']'; return '{' + Object.entries(v as Record<string, unknown>).map(([k, value]) => JSON.stringify(k) + ':' + encode(value)).join(',') + '}'; };
  const text = encode({ schema: 'barocss-stored-plate-hole-solid-points', version: 0, solid: owned.solid, queries: owned.queries, options: owned.options }) + '\n'; jsonSize(text); return text;
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
export function parseStoredPlateHoleSolidPoints(text: string): StoredPlateHolePointResult {
  check(typeof text === 'string', C.CODEC, 'Whole point JSON text required'); jsonSize(text); let value: unknown;
  try { scanJSON(text); value = JSON.parse(text); } catch (cause) { if (cause instanceof StoredPlateHolePointError) throw cause; throw new StoredPlateHolePointError(C.CODEC, 'Actual JSON syntax/value parsing refused', cause); }
  const file = record(snapshot(value), ['schema', 'version', 'solid', 'queries', 'options'], C.CODEC); check(file.schema === 'barocss-stored-plate-hole-solid-points' && Object.is(file.version, 0), C.VERSION, 'Whole point schema/version0 required'); return classifyStoredPlateHoleSolidPoints(file.solid as StoredPlateHoleSolidResult, file.queries as StoredPlateHolePointQuery[], file.options as StoredPlateHolePointOptions);
}
