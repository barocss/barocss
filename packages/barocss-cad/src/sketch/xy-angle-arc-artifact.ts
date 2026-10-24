import { buildXYAngleArc } from './xy-angle-arc.js';
import type { XYAngleArcResult } from './xy-angle-arc.js';
import { compileCadModel } from '../model-compiler.js';
import { evaluateCurve } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import type { Point } from '../types.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

export const XYAngleArcArtifactDiagnosticCode = Object.freeze({ INPUT: 'INPUT', REQUEST: 'REQUEST', SOURCE: 'SOURCE', BINDING: 'BINDING', STRUCTURE: 'STRUCTURE', ASSOCIATION: 'ASSOCIATION', OBSERVATION: 'OBSERVATION', BUDGET: 'BUDGET', OWNED: 'OWNED', CODEC: 'CODEC', VERSION: 'VERSION' } as const);
type Code = typeof XYAngleArcArtifactDiagnosticCode[keyof typeof XYAngleArcArtifactDiagnosticCode];
export class XYAngleArcArtifactError extends KernelError {
  readonly code: Code;
  constructor(code: Code, detail: string, cause?: unknown) { super(('XY angle-arc artifact: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYAngleArcArtifactError'; this.code = code; }
}
export interface XYAngleArcArtifactFieldRule { path: string; rule: 'exact' | 'original-source-model-bit-binding' | 'bounded-association'; unit: 'identity' | 'mm' | 'mm-per-native-parameter' | 'rad' | 'dimensionless'; absoluteTolerance: number }
export interface XYAngleArcArtifactReport {
  schema: 'barocss-xy-angle-arc-artifact-verification'; version: 0; curveId: string; lengthUnit: 'mm'; angleUnit: 'rad';
  originalArtifactRetained: true; originalSourceBindingExact: true; numericalAssociationAccepted: true; provenanceAuthenticated: false; globalExactCircleCertified: false; sameRuntimeBitReplay: false; nativeParameterIsAngle: false;
  fieldRules: XYAngleArcArtifactFieldRule[]; fieldCount: number; exactFieldCount: number; associatedFieldCount: number;
  originalD1EvaluatedCount: number; originalD1RefusalCount: number;
  directCounts: { requestReplayCount: 1; originalSourceCompilationCount: 1; originalCurveD0Count: number; originalCurveD1Attempts: number };
  limits: { coefficientXYMM: 2e-10; pointXYMM: 2e-10; weight: 2e-13; analyticAngleRad: 2e-12; derivativeXYMMPerParameter: 2e-9; pointRadialResidualMM: 2e-10; derivativeResidualMMPerParameter: 2e-9; tangentResidual: 2e-12; originalSampleGuard: 1e-7; relativeTolerance: 0; maximumFields: 2048; maximumNativeQueries: 17; sourceUTF16: 262144; sourceUTF8: 262144; fileUTF16: 262144; fileUTF8: 262144; ownOccurrences: 131072; ownDepth: 32; arrayEntries: 2048; recordFields: 64; aggregateStringUnits: 1048576 };
}
export interface XYAngleArcArtifactVerification { artifact: XYAngleArcResult; report: XYAngleArcArtifactReport }
const C = XYAngleArcArtifactDiagnosticCode;
function check(ok: boolean, code: Code, detail: string): asserts ok { if (!ok) throw new XYAngleArcArtifactError(code, detail); }
function child<T>(fn: () => T, code: Code, detail: string): T { try { return fn(); } catch (cause) { throw new XYAngleArcArtifactError(code, detail, cause); } }
const bytes = (text: string) => new TextEncoder().encode(text).length;
function snapshot<T>(input: T): T {
  let remaining = 131072, stringUnits = 0, stringBytes = 0;
  const copy = (v: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 32, C.BUDGET, 'Own-data occurrence/depth limit');
    if (typeof v === 'number') { check(Number.isFinite(v), C.INPUT, 'Finite numeric data required'); return v; }
    if (typeof v === 'string') { stringUnits += v.length; check(v.length <= 262144 && stringUnits <= 1048576, C.BUDGET, 'Own-data string length limit'); stringBytes += bytes(v); check(stringBytes <= 1048576, C.BUDGET, 'Own-data UTF8 string limit'); return v; }
    if (v === null || typeof v === 'boolean') return v;
    check(typeof v === 'object', C.INPUT, 'Plain data required'); const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v), d = Object.getOwnPropertyDescriptors(v);
    check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, C.INPUT, 'Foreign prototype');
    check(keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in d[k] && (array && k === 'length' || d[k].enumerable)), C.INPUT, 'Getters/symbols/hidden/long fields refuse');
    if (array) { const n = d.length.value as number; check(Number.isInteger(n) && n >= 0 && n <= 2048 && keys.length === n + 1, C.INPUT, 'Dense arrays within2048 required'); return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(d, String(i)), C.INPUT, 'Sparse array'); return copy(d[String(i)].value, depth + 1); }); }
    check(keys.length <= 64, C.BUDGET, 'Record field limit'); return Object.fromEntries((keys as string[]).map(k => [k, copy(d[k].value, depth + 1)]));
  }; return copy(input, 0) as T;
}
function record(v: unknown, keys: string[], code: Code): Record<string, unknown> { check(v !== null && typeof v === 'object' && !Array.isArray(v), code, 'Record required'); const r = v as Record<string, unknown>; check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)), code, 'Exact fields required: ' + keys.join(',')); return r; }
/** Only these named numeric fields permit bounded association. All other leaves are exact. */
function fieldRule(path: string): XYAngleArcArtifactFieldRule {
  const rule: XYAngleArcArtifactFieldRule = { path, rule: 'exact', unit: 'identity', absoluteTolerance: 0 };
  if (path === 'source') return { ...rule, rule: 'original-source-model-bit-binding' };
  let unit: XYAngleArcArtifactFieldRule['unit'] = 'identity', limit = 0, match: RegExpMatchArray | null;
  if (/^(?:curve|model\.objects\[0\])\.controlPoints\[\d+\]\[[01]\]$/.test(path)) { unit = 'mm'; limit = 2e-10; }
  else if ((match = path.match(/^(?:curve|model\.objects\[0\])\.weights\[(\d+)\]$/)) && Number(match[1]) % 2 === 1 || /^report\.spans\[\d+\]\.middleWeight$/.test(path)) { unit = 'dimensionless'; limit = 2e-13; }
  else if (/^report\.observations\[\d+\]\.analyticAngleRad$/.test(path)) { unit = 'rad'; limit = 2e-12; }
  else if (/^report\.observations\[\d+\]\.(?:pointMM|analyticPointMM|d1\.value\.point)\[[01]\]$/.test(path)) { unit = 'mm'; limit = 2e-10; }
  else if (/^report\.observations\[\d+\]\.d1\.value\.derivative\[[01]\]$/.test(path)) { unit = 'mm-per-native-parameter'; limit = 2e-9; }
  else if (/^report\.(?:observations\[\d+\]\.(?:pointDifferenceMM|radialResidualMM)|maximumPointDifferenceMM|maximumRadialResidualMM)$/.test(path)) { unit = 'mm'; limit = 2e-10; }
  else if (/^report\.(?:observations\[\d+\]\.derivativeDifferenceMM|maximumDerivativeDifferenceMM)$/.test(path)) { unit = 'mm-per-native-parameter'; limit = 2e-9; }
  else if (/^report\.(?:observations\[\d+\]\.tangentRadialResidual|maximumTangentRadialResidual)$/.test(path)) { unit = 'dimensionless'; limit = 2e-12; }
  return limit === 0 ? rule : { path, rule: 'bounded-association', unit, absoluteTolerance: limit };
}
function associated(a: number, b: number, limit: number, code: Code, path: string): void { check(Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0 || Object.is(a, b)) && Math.abs(a - b) <= limit, code, 'Bounded association refused at ' + path); }
function fields(original: unknown, reference: unknown, path: string, rows: XYAngleArcArtifactFieldRule[]): void {
  if (Array.isArray(reference)) { check(Array.isArray(original) && original.length === reference.length, C.STRUCTURE, 'Array shape changed at ' + path); for (let i = 0; i < reference.length; i++) fields(original[i], reference[i], path + '[' + i + ']', rows); return; }
  if (reference !== null && typeof reference === 'object') { check(original !== null && typeof original === 'object' && !Array.isArray(original), C.STRUCTURE, 'Record shape changed at ' + path); const r = reference as Record<string, unknown>, o = record(original, Object.keys(r), C.STRUCTURE); for (const k of Object.keys(r)) fields(o[k], r[k], path ? path + '.' + k : k, rows); return; }
  check(rows.length < 2048, C.BUDGET, 'Whole-field comparison limit'); const rule = fieldRule(path);
  if (rule.rule === 'bounded-association' && reference !== null) { check(typeof original === 'number' && typeof reference === 'number', C.STRUCTURE, 'Numeric field required at ' + path); associated(original, reference, rule.absoluteTolerance, C.ASSOCIATION, path); }
  else if (rule.rule !== 'original-source-model-bit-binding') check(Object.is(original, reference), C.STRUCTURE, 'Exact field changed at ' + path);
  rows.push(reference === null ? { path, rule: 'exact', unit: 'identity', absoluteTolerance: 0 } : rule);
}
const distance = (a: Point, b: Point) => Math.hypot(...a.map((v, i) => v - b[i]));
/** Verify a complete original artifact without replacing its source, coefficients or report. */
export function verifyXYAngleArcArtifact(input: XYAngleArcResult): XYAngleArcArtifactVerification {
  const artifact = snapshot(input); record(artifact, ['request', 'source', 'sourceVersion', 'model', 'curve', 'report'], C.STRUCTURE);
  const reference = child(() => buildXYAngleArc(artifact.request), C.REQUEST, 'Actual original request replay refused');
  check(typeof artifact.source === 'string' && artifact.sourceVersion === 0, C.STRUCTURE, 'Original Source0 required'); check(artifact.source.length <= 262144 && bytes(artifact.source) <= 262144, C.BUDGET, 'Original source UTF16/UTF8 limit');
  const compiled = child(() => compileCadModel(artifact.source, { sourceVersion: 0 }), C.SOURCE, 'Actual original source compiler refused');
  if (!compiled.ok) throw new XYAngleArcArtifactError(C.SOURCE, 'Actual original source diagnostics refused', compiled.diagnostics);
  check(same(compiled.model, artifact.model) && artifact.model.objects.length === 1 && same(artifact.curve, artifact.model.objects[0]), C.BINDING, 'Exact complete original Source0/Model/Curve bit binding required');
  const fieldRules: XYAngleArcArtifactFieldRule[] = []; fields(artifact, reference, '', fieldRules);
  const { curve, report: saved, request } = artifact;
  check(curve.controlPoints.every(p => p.every(v => Math.abs(v) <= 10000)) && curve.weights.every((w, i) => i % 2 === 0 ? Object.is(w, 1) : w >= .7 && w <= 1), C.STRUCTURE, 'Original XY arc coefficient profile required');
  check(saved.spans.every(span => Object.is(span.middleWeight, curve.weights[2 * span.index + 1])), C.OBSERVATION, 'Saved span weight must exactly bind original Curve odd weight');
  if (saved.endpointClosed) check(same(curve.controlPoints[0], curve.controlPoints.at(-1)), C.BINDING, 'Original full-turn seam endpoint bits must match');
  const observations = saved.observations;
  const maxima = { maximumPointDifferenceMM: Math.max(...observations.map(o => o.pointDifferenceMM)), maximumRadialResidualMM: Math.max(...observations.map(o => o.radialResidualMM)), maximumDerivativeDifferenceMM: Math.max(0, ...observations.map(o => o.derivativeDifferenceMM ?? 0)), maximumTangentRadialResidual: Math.max(0, ...observations.map(o => o.tangentRadialResidual ?? 0)) };
  for (const k of Object.keys(maxima) as (keyof typeof maxima)[]) check(Object.is(saved[k], maxima[k]), C.OBSERVATION, 'Saved maximum must exactly equal its saved residual array: ' + k);
  let evaluated = 0, refused = 0;
  for (const o of observations) {
    for (const v of [o.pointDifferenceMM, o.radialResidualMM, o.derivativeDifferenceMM, o.tangentRadialResidual]) if (v !== null) check(v >= 0 && v <= 1e-7, C.OBSERVATION, 'Saved residual outside original sampled acceptance guard');
    const actual = child(() => evaluateCurve(curve, o.parameter), C.OBSERVATION, 'Actual original Curve D0 refused'); for (let i = 0; i < 3; i++) associated(actual[i], o.pointMM[i], 2e-10, C.OBSERVATION, 'originalD0');
    const radial: Point = [o.pointMM[0] - request.centerMM[0], o.pointMM[1] - request.centerMM[1], o.pointMM[2]], radialNorm = Math.hypot(...radial);
    associated(o.pointDifferenceMM, distance(o.pointMM, o.analyticPointMM), 2e-10, C.OBSERVATION, 'saved point residual'); associated(o.radialResidualMM, Math.abs(radialNorm - request.radiusMM), 2e-10, C.OBSERVATION, 'saved radial residual');
    let d1: ReturnType<typeof evaluateCurveD1>;
    try { d1 = evaluateCurveD1(curve, o.parameter); } catch (cause) {
      if (!(o.d1.status === 'native-refused' && cause instanceof Error && cause.message === o.d1.reason && cause.name === o.d1.nativeErrorName)) throw new XYAngleArcArtifactError(C.OBSERVATION, 'Original native C0 refusal union changed', cause); refused++; continue;
    }
    check(o.d1.status === 'evaluated', C.OBSERVATION, 'Original derivative unexpectedly evaluated'); evaluated++;
    for (let i = 0; i < 3; i++) { associated(d1.point[i], o.d1.value.point[i], 2e-10, C.OBSERVATION, 'originalD1point'); associated(d1.derivative[i], o.d1.value.derivative[i], 2e-9, C.OBSERVATION, 'originalD1derivative'); }
    const derivative = o.d1.value.derivative, tangentNorm = Math.hypot(...derivative); check(radialNorm > 0 && tangentNorm > 0, C.OBSERVATION, 'Original saved tangent/radial norms must be positive');
    const tangent = Math.abs(radial.reduce((sum, v, i) => sum + v * derivative[i], 0)) / (radialNorm * tangentNorm); associated(o.tangentRadialResidual!, tangent, 2e-12, C.OBSERVATION, 'saved normalized tangent residual');
    check(Math.sign(request.sweepAngleRad) * (radial[0] * derivative[1] - radial[1] * derivative[0]) > 0, C.OBSERVATION, 'Original saved tangent direction changed');
  }
  check(evaluated === saved.derivativeEvaluationCount && refused === saved.derivativeRefusalCount && evaluated + refused === observations.length, C.OBSERVATION, 'Original actual native D1 counts changed');
  const associatedFieldCount = fieldRules.filter(r => r.rule === 'bounded-association').length;
  const report: XYAngleArcArtifactReport = { schema: 'barocss-xy-angle-arc-artifact-verification', version: 0, curveId: curve.id, lengthUnit: 'mm', angleUnit: 'rad', originalArtifactRetained: true, originalSourceBindingExact: true, numericalAssociationAccepted: true, provenanceAuthenticated: false, globalExactCircleCertified: false, sameRuntimeBitReplay: false, nativeParameterIsAngle: false, fieldRules, fieldCount: fieldRules.length, exactFieldCount: fieldRules.length - associatedFieldCount, associatedFieldCount, originalD1EvaluatedCount: evaluated, originalD1RefusalCount: refused, directCounts: { requestReplayCount: 1, originalSourceCompilationCount: 1, originalCurveD0Count: observations.length, originalCurveD1Attempts: observations.length }, limits: { coefficientXYMM: 2e-10, pointXYMM: 2e-10, weight: 2e-13, analyticAngleRad: 2e-12, derivativeXYMMPerParameter: 2e-9, pointRadialResidualMM: 2e-10, derivativeResidualMMPerParameter: 2e-9, tangentResidual: 2e-12, originalSampleGuard: 1e-7, relativeTolerance: 0, maximumFields: 2048, maximumNativeQueries: 17, sourceUTF16: 262144, sourceUTF8: 262144, fileUTF16: 262144, fileUTF8: 262144, ownOccurrences: 131072, ownDepth: 32, arrayEntries: 2048, recordFields: 64, aggregateStringUnits: 1048576 } };
  return snapshot({ artifact, report });
}
export function validateXYAngleArcArtifactVerification(input: XYAngleArcArtifactVerification): XYAngleArcArtifactReport {
  const owned = snapshot(input); record(owned, ['artifact', 'report'], C.OWNED); const rebuilt = child(() => verifyXYAngleArcArtifact(owned.artifact), C.OWNED, 'Actual full original artifact verification refused'); check(same(owned, rebuilt), C.OWNED, 'Owned original artifact or portable field rules/counts changed'); return snapshot(rebuilt.report);
}
function jsonSize(text: string): void { check(text.length <= 262144 && bytes(text) <= 262144, C.BUDGET, 'Whole artifact file UTF16/UTF8 limit'); }
export function serializeXYAngleArcArtifact(input: XYAngleArcResult): string {
  const accepted = verifyXYAngleArcArtifact(input).artifact;
  const encode = (v: unknown): string => { if (typeof v === 'number') return Object.is(v, -0) ? '-0' : JSON.stringify(v); if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(encode).join(',') + ']'; return '{' + Object.entries(v as Record<string, unknown>).map(([k, value]) => JSON.stringify(k) + ':' + encode(value)).join(',') + '}'; };
  const text = encode({ schema: 'barocss-xy-angle-arc-artifact', version: 0, artifact: accepted }) + '\n'; jsonSize(text); return text;
}

/** Bound lexical admission and duplicate keys before the built-in JSON syntax/value parser. */
function scanJSON(text: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = []; let remaining = 131072;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (/[ \n\r\t]/.test(c)) continue; const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 2048, C.BUDGET, 'JSON array exceeds2048 elements'); parent.nextValue = false; }
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
export function parseXYAngleArcArtifact(text: string): XYAngleArcArtifactVerification {
  check(typeof text === 'string', C.CODEC, 'Whole artifact JSON text required'); jsonSize(text); let value: unknown;
  try { scanJSON(text); value = JSON.parse(text); } catch (cause) { if (cause instanceof XYAngleArcArtifactError) throw cause; throw new XYAngleArcArtifactError(C.CODEC, 'Actual JSON syntax/value parsing refused', cause); }
  const file = record(snapshot(value), ['schema', 'version', 'artifact'], C.CODEC); check(file.schema === 'barocss-xy-angle-arc-artifact' && Object.is(file.version, 0), C.VERSION, 'Whole artifact schema/version0 required'); return verifyXYAngleArcArtifact(file.artifact as XYAngleArcResult);
}
