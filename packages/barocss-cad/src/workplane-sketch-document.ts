import { admitWorkplaneSketchFrame } from './workplane-sketch-frame-internal.js';
import type { WorkplaneSketchFrameReport } from './workplane-sketch-frame-internal.js';
import { evaluateXYSketchDocument, updateXYSketchDocument } from './xy-sketch-document.js';
import type { XYSketchDocumentV0, XYSketchDocumentEdit, XYSketchDocumentResult, XYSketchEvaluatedProfile } from './xy-sketch-document.js';
import { transformNativeGeometryAffine, validateAffineGeometryTransform } from './affine-geometry-transform.js';
import type { CadAffineMatrix3x4, AffineGeometryTransformResult } from './affine-geometry-transform.js';
import type { Point } from './types.js';
import { same } from './structural-equality.js';

export const WorkplaneSketchDocumentDiagnosticCode = Object.freeze({ INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', FRAME: 'FRAME', BINDING: 'BINDING', BUDGET: 'BUDGET', LOCAL: 'LOCAL', AFFINE: 'AFFINE', CODEC: 'CODEC', OWNED: 'OWNED' } as const);
export type WorkplaneSketchDocumentDiagnosticCode = typeof WorkplaneSketchDocumentDiagnosticCode[keyof typeof WorkplaneSketchDocumentDiagnosticCode];
export class WorkplaneSketchDocumentError extends Error { readonly code: WorkplaneSketchDocumentDiagnosticCode; constructor(code: WorkplaneSketchDocumentDiagnosticCode, detail: string, cause?: unknown) { super(('Workplane Sketch document: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'WorkplaneSketchDocumentError'; this.code = code; } }
export interface WorkplaneSketchFrame { id: string; originMM: Point; uAxis: Point; vAxis: Point; normalAxis: Point }
type WorldBinding = { profileId: string; worldCurveId: string };
const DOCUMENT_LIMITS = { maximumProfiles: 8, maximumAffineObservations: 127, maximumAggregateObservations: 1016, maximumWorldPointBindings: 136, maximumAggregateSourceUTF16: 4194304, maximumAggregateSourceUTF8: 4194304, maximumJSONUTF16: 262144, maximumJSONUTF8: 262144, frameTolerance: 0.000000001 } as const;
export interface WorkplaneSketchDocumentV0 { format: 'barocss-workplane-sketch'; version: 0; id: string; lengthUnit: 'mm'; plane: WorkplaneSketchFrame; localSketch: XYSketchDocumentV0; worldBindings: WorldBinding[]; limits: typeof DOCUMENT_LIMITS }
export interface WorkplaneSketchDocumentEdit { plane: WorkplaneSketchFrame | null; localEdits: XYSketchDocumentEdit[]; worldBindings: WorldBinding[] | null }
type FrameReport = WorkplaneSketchFrameReport;
type WorldPointBinding = { profileId: string; pointId: string; localCurveId: string; worldCurveId: string; poleIndex: number; parameter: number; localPointMM: Point; worldPointMM: Point; observedLocalPointMM: Point; observedWorldPointMM: Point; isClosing: boolean; affineMappingIndex: number; planeResidualMM: number };
export interface WorkplaneSketchDocumentReport {
  schema: 'barocss-workplane-sketch-document-evaluation'; version: 0; documentId: string; mode: 'evaluate' | 'update'; noOp: boolean; planeId: string; localSketchId: string; profileCount: number; authoredPointCount: number; worldCurveIds: string[]; worldPointBindingCount: number; aggregateObservationCount: number; aggregateSourceUTF16: number; aggregateSourceUTF8: number; maximumPlaneResidualMM: number;
  directCounts: { baseEvaluationCount: 0 | 1; frameValidationCount: 1; localEvaluationCount: 0 | 1; localUpdateCount: 0 | 1; affineTransformCount: number; affineOwnedValidationCount: number; worldPointBindingCount: number; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; sourceCompilationCount: 0 };
  quality: { localIntentRetained: true; nativeWorldCurveChildrenRetained: true; properFrameNumericallyAccepted: true; exactRigidFrameCertified: false; authoredPointWorldBindingsRetained: true; persistentTopologyNamingCertified: false; constraintsCertified: false; regionCertified: false; face: false; solid: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; editorDisplayCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: typeof DOCUMENT_LIMITS & { maximumAuthoredPoints: 128; maximumLocalEdits: 8; maximumPolylinePoints: 64; localAuthoredIdCharacters: 64; nativeCurveIdCharacters: 48; coordinateAbsMM: 10000; parameterAbs: 10000; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
  workScope: 'direct-workplane-orchestration-parent-and-native-child-work-excluded'; budgetFailure: 'atomic-no-partial-workplane-sketch-world-geometry';
}
export interface WorkplaneSketchDocumentResult { request: { document: WorkplaneSketchDocumentV0; edit: WorkplaneSketchDocumentEdit | null }; document: WorkplaneSketchDocumentV0; local: XYSketchDocumentResult; planeReport: FrameReport; matrix: CadAffineMatrix3x4; profiles: { profileId: string; worldCurveId: string; local: XYSketchEvaluatedProfile; affine: AffineGeometryTransformResult }[]; worldPointBindings: WorldPointBinding[]; report: WorkplaneSketchDocumentReport }
const CODE = WorkplaneSketchDocumentDiagnosticCode;
function check(condition: boolean, code: WorkplaneSketchDocumentDiagnosticCode, detail: string): asserts condition { if (!condition) throw new WorkplaneSketchDocumentError(code, detail); }
function child<T>(action: () => T, code: WorkplaneSketchDocumentDiagnosticCode, detail: string): T { try { return action(); } catch (cause) { throw new WorkplaneSketchDocumentError(code, detail, cause); } }
function record(input: unknown, fields: string[], code: WorkplaneSketchDocumentDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded'); if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; } if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required'); const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required'); check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded fields without getters/symbols/hidden data are required'); ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required'); result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); }); }
    else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)])); ancestors.delete(value); return result;
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof WorkplaneSketchDocumentError) throw cause; throw new WorkplaneSketchDocumentError(code, 'Own snapshot failed', cause); }
}
function bytes(text: string): number { let count = 0; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (c < 128) count++; else if (c < 2048) count += 2; else if (c >= 0xd800 && c <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { count += 4; i++; } else count += 3; } return count; }
function identifier(value: unknown, maximum: number, code: WorkplaneSketchDocumentDiagnosticCode = CODE.IDENTITY): string { check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), code, 'A bounded ASCII identifier is required'); return value; }
function frame(input: WorkplaneSketchFrame): { plane: WorkplaneSketchFrame; report: FrameReport; matrix: CadAffineMatrix3x4 } { return admitWorkplaneSketchFrame(input, (code, detail) => { throw new WorkplaneSketchDocumentError(code, detail); }); }
function admit(input: unknown): WorkplaneSketchDocumentV0 {
  const data = record(snapshot(input), ['format', 'version', 'id', 'lengthUnit', 'plane', 'localSketch', 'worldBindings', 'limits']); check(data.format === 'barocss-workplane-sketch' && data.version === 0 && data.lengthUnit === 'mm', CODE.VERSION, 'Explicit workplane Sketch0/mm is required'); identifier(data.id, 64);
  record(data.limits, Object.keys(DOCUMENT_LIMITS)); check(same(data.limits, DOCUMENT_LIMITS), CODE.BUDGET, 'The fixed authored limits must match exactly');
  check(Array.isArray(data.worldBindings) && data.worldBindings.length <= 8, CODE.BUDGET, 'At most8 complete world bindings are required');
  for (const binding of data.worldBindings) { const row = record(binding, ['profileId', 'worldCurveId']); identifier(row.profileId, 64); identifier(row.worldCurveId, 48); }
  return data as unknown as WorkplaneSketchDocumentV0;
}
function bind(document: WorkplaneSketchDocumentV0, local: XYSketchDocumentResult): void {
  check(document.worldBindings.length === local.profiles.length, CODE.BINDING, 'Every current local profile needs exactly one world binding'); const localIds = new Set(local.profiles.flatMap(profile => [profile.profileId, profile.evaluation.curve.id])), profileIds = new Set<string>(), worldIds = new Set<string>();
  for (const profile of local.profiles) identifier(profile.evaluation.curve.id, 48, CODE.BINDING);
  for (const binding of document.worldBindings) { check(local.profiles.some(profile => profile.profileId === binding.profileId) && !profileIds.has(binding.profileId) && !worldIds.has(binding.worldCurveId) && !localIds.has(binding.worldCurveId), CODE.BINDING, 'World IDs must be unique, explicitly current and disjoint from all local Curve/profile IDs'); profileIds.add(binding.profileId); worldIds.add(binding.worldCurveId); }
}
function build(document: WorkplaneSketchDocumentV0, local: XYSketchDocumentResult, admittedFrame: ReturnType<typeof frame>, request: WorkplaneSketchDocumentResult['request'], mode: 'evaluate' | 'update', localUpdateCount: 0 | 1): WorkplaneSketchDocumentResult {
  document.localSketch = local.document; bind(document, local); const worldPointBindings: WorldPointBinding[] = []; let aggregateObservationCount = 0, aggregateSourceUTF16 = 0, aggregateSourceUTF8 = 0;
  const profiles = local.profiles.map(profile => {
    const binding = document.worldBindings.find(binding => binding.profileId === profile.profileId)!;
    const affine = child(() => transformNativeGeometryAffine(profile.evaluation.curve, admittedFrame.matrix, { geometryId: binding.worldCurveId, maximumObservations: 127 }), CODE.AFFINE, 'Actual native affine Curve regeneration refused');
    child(() => validateAffineGeometryTransform(affine), CODE.AFFINE, 'Actual affine child owned validation refused');
    const original = profile.evaluation.curve, world = affine.geometry; check(world.kind === 'curve' && same(affine.original, original) && world.id === binding.worldCurveId && world.degree === original.degree && same(world.knots, original.knots) && same(world.weights, original.weights) && world.controlPoints.length === original.controlPoints.length && same(affine.matrix, admittedFrame.matrix), CODE.BINDING, 'Actual affine Curve must preserve the complete original basis/weights/pole order');
    const authored = local.document.profiles.find(intent => intent.id === profile.profileId)!;
    for (const point of profile.pointBindings) {
      const affineMappingIndex = affine.report.coefficientMappings.findIndex(mapping => mapping.controlPoint.length === 1 && Object.is(mapping.controlPoint[0], point.poleIndex)); check(affineMappingIndex >= 0, CODE.BINDING, 'Each actual local pole must bind an actual affine coefficient mapping'); const mapping = affine.report.coefficientMappings[affineMappingIndex];
      const observation = affine.report.observations.find(observation => observation.kind === 'curve' && Object.is(observation.parameter, point.parameter)); check(observation?.kind === 'curve', CODE.BINDING, 'Each unchanged local source parameter must bind an actual affine observation');
      const localPointMM = original.controlPoints[point.poleIndex], worldPointMM = world.controlPoints[point.poleIndex]; check(point.curveId === original.id && same(mapping.originalPointMM, localPointMM) && same(mapping.targetPointMM, worldPointMM), CODE.BINDING, 'Local/world point coefficients must retain actual child bits');
      const distance = (a: Point, b: Point) => Math.hypot(...a.map((n, axis) => n - b[axis])); check(distance(localPointMM, observation.originalPointMM) <= 1e-7 && distance(worldPointMM, observation.actualPointMM) <= 1e-7, CODE.BINDING, 'Authored pole and actual native observation must agree within1e-7mm');
      const isClosing = authored.kind === 'rectangle' && point.poleIndex === 4; if (isClosing) check(same(localPointMM, original.controlPoints[0]) && same(worldPointMM, world.controlPoints[0]) && point.pointId === authored.cornerIds[0], CODE.BINDING, 'The actual rectangle closing pole must retain first-corner bits and identity');
      const delta = worldPointMM.map((n, axis) => n - document.plane.originMM[axis]), planeResidualMM = Math.abs(document.plane.normalAxis[0] * delta[0] + document.plane.normalAxis[1] * delta[1] + document.plane.normalAxis[2] * delta[2]); check(Number.isFinite(planeResidualMM), CODE.BINDING, 'Observed plane residual must remain finite');
      worldPointBindings.push({ profileId: profile.profileId, pointId: point.pointId, localCurveId: point.curveId, worldCurveId: binding.worldCurveId, poleIndex: point.poleIndex, parameter: point.parameter, localPointMM, worldPointMM, observedLocalPointMM: observation.originalPointMM, observedWorldPointMM: observation.actualPointMM, isClosing, affineMappingIndex, planeResidualMM });
    }
    aggregateObservationCount += affine.report.observationCount; for (const source of [profile.evaluation.source, affine.source]) { aggregateSourceUTF16 += source.length; aggregateSourceUTF8 += bytes(source); }
    check(aggregateObservationCount <= 1016 && aggregateSourceUTF16 <= 4194304 && aggregateSourceUTF8 <= 4194304 && worldPointBindings.length <= 136, CODE.BUDGET, 'Complete world bindings/observations/source aggregates exceed fixed limits');
    return { profileId: profile.profileId, worldCurveId: binding.worldCurveId, local: profile, affine };
  });
  const report: WorkplaneSketchDocumentReport = {
    schema: 'barocss-workplane-sketch-document-evaluation', version: 0, documentId: document.id, mode, noOp: mode === 'update' && same(document, request.document), planeId: document.plane.id, localSketchId: local.document.id, profileCount: profiles.length, authoredPointCount: local.report.authoredPointCount, worldCurveIds: profiles.map(profile => profile.worldCurveId), worldPointBindingCount: worldPointBindings.length, aggregateObservationCount, aggregateSourceUTF16, aggregateSourceUTF8, maximumPlaneResidualMM: Math.max(0, ...worldPointBindings.map(binding => binding.planeResidualMM)),
    directCounts: { baseEvaluationCount: mode === 'update' ? 1 : 0, frameValidationCount: 1, localEvaluationCount: mode === 'evaluate' ? 1 : 0, localUpdateCount, affineTransformCount: profiles.length, affineOwnedValidationCount: profiles.length, worldPointBindingCount: worldPointBindings.length, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, sourceCompilationCount: 0 },
    quality: { localIntentRetained: true, nativeWorldCurveChildrenRetained: true, properFrameNumericallyAccepted: true, exactRigidFrameCertified: false, authoredPointWorldBindingsRetained: true, persistentTopologyNamingCertified: false, constraintsCertified: false, regionCertified: false, face: false, solid: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { ...DOCUMENT_LIMITS, maximumAuthoredPoints: 128, maximumLocalEdits: 8, maximumPolylinePoints: 64, localAuthoredIdCharacters: 64, nativeCurveIdCharacters: 48, coordinateAbsMM: 10000, parameterAbs: 10000, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-workplane-orchestration-parent-and-native-child-work-excluded', budgetFailure: 'atomic-no-partial-workplane-sketch-world-geometry',
  };
  return snapshot({ request, document, local, planeReport: admittedFrame.report, matrix: admittedFrame.matrix, profiles, worldPointBindings, report }, true) as WorkplaneSketchDocumentResult;
}
export function evaluateWorkplaneSketchDocument(input: WorkplaneSketchDocumentV0): WorkplaneSketchDocumentResult {
  const document = admit(input), request = snapshot({ document, edit: null }) as WorkplaneSketchDocumentResult['request'], admittedFrame = frame(document.plane), local = child(() => evaluateXYSketchDocument(document.localSketch), CODE.LOCAL, 'Actual local XY Sketch evaluation refused'); return build(document, local, admittedFrame, request, 'evaluate', 0);
}
export function updateWorkplaneSketchDocument(input: WorkplaneSketchDocumentV0, editInput: WorkplaneSketchDocumentEdit): WorkplaneSketchDocumentResult {
  const original = admit(input), edit = record(snapshot(editInput), ['plane', 'localEdits', 'worldBindings']) as unknown as WorkplaneSketchDocumentEdit; check(Array.isArray(edit.localEdits) && edit.localEdits.length <= 8, CODE.BUDGET, 'At most8 actual local edit operations are supported');
  const request = snapshot({ document: original, edit }) as WorkplaneSketchDocumentResult['request'], base = evaluateWorkplaneSketchDocument(original), staged = snapshot(original) as WorkplaneSketchDocumentV0; if (edit.plane !== null) staged.plane = edit.plane; if (edit.worldBindings !== null) staged.worldBindings = edit.worldBindings;
  const document = admit(staged), admittedFrame = frame(document.plane), local = edit.localEdits.length ? child(() => updateXYSketchDocument(base.local.document, edit.localEdits), CODE.LOCAL, 'Actual local XY Sketch update refused') : base.local; bind(document, local);
  const oldWorldIds = new Set(original.worldBindings.map(binding => binding.worldCurveId)); for (const binding of document.worldBindings) { const old = original.worldBindings.find(old => old.profileId === binding.profileId); check(old ? binding.worldCurveId === old.worldCurveId : !oldWorldIds.has(binding.worldCurveId), CODE.BINDING, 'Retained world IDs must be stable and new profiles cannot reuse any old world ID'); }
  return build(document, local, admittedFrame, request, 'update', edit.localEdits.length ? 1 : 0);
}
export function validateWorkplaneSketchDocument(input: WorkplaneSketchDocumentResult): WorkplaneSketchDocumentReport {
  const owned = record(snapshot(input, true), ['request', 'document', 'local', 'planeReport', 'matrix', 'profiles', 'worldPointBindings', 'report'], CODE.OWNED) as unknown as WorkplaneSketchDocumentResult; record(owned.request, ['document', 'edit'], CODE.OWNED);
  const rebuilt = child(() => owned.request.edit === null ? evaluateWorkplaneSketchDocument(owned.request.document) : updateWorkplaneSketchDocument(owned.request.document, owned.request.edit), CODE.OWNED, 'Whole authored workplane/actual native child reconstruction refused'); check(same(owned, rebuilt), CODE.OWNED, 'Owned frame/intent/local/world/source/proof/binding/refusal/count bits changed'); return snapshot(rebuilt.report, true) as WorkplaneSketchDocumentReport;
}
function jsonSize(text: string): void { check(text.length <= 262144 && bytes(text) <= 262144, CODE.BUDGET, 'Authored JSON must remain within262144 UTF-16 and UTF-8 units'); }
export function serializeWorkplaneSketchDocument(input: WorkplaneSketchDocumentV0): string {
  const accepted = evaluateWorkplaneSketchDocument(input).document;
  const encode = (value: unknown): string => { if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value); if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(encode).join(',') + ']'; return '{' + Object.entries(value as Record<string, unknown>).map(([key, field]) => JSON.stringify(key) + ':' + encode(field)).join(',') + '}'; };
  const text = encode(accepted) + '\n'; jsonSize(text); return text;
}
/** Bound lexical admission and duplicate keys before the built-in JSON syntax/value parser. */
function scanJSON(text: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = []; let remaining = 1048576;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (/[ \n\r\t]/.test(c)) continue; const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 8192, CODE.BUDGET, 'JSON array exceeds8192 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, CODE.BUDGET, 'JSON lexical value/key budget exceeded');
    if (c === '"') {
      let end = i + 1; for (; end < text.length; end++) { if (text[end] === '\\') end++; else if (text[end] === '"') break; } check(end < text.length, CODE.CODEC, 'Unterminated JSON string');
      const value: unknown = JSON.parse(text.slice(i, end + 1)); check(typeof value === 'string' && value.length <= 262144, CODE.BUDGET, 'JSON string budget exceeded'); let next = end + 1; while (next < text.length && /[ \n\r\t]/.test(text[next])) next++;
      if (text[next] === ':') { check(parent?.kind === '{', CODE.CODEC, 'JSON object key must belong to an object'); check(!parent.keys.has(value), CODE.CODEC, 'Duplicate JSON object key'); parent.keys.add(value); check(parent.keys.size <= 64, CODE.BUDGET, 'JSON record exceeds64 fields'); } i = end; continue;
    }
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 64, CODE.BUDGET, 'JSON depth exceeds64'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), CODE.CODEC, 'Unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++;
  }
  check(stack.length === 0, CODE.CODEC, 'Unclosed JSON container');
}
export function parseWorkplaneSketchDocument(text: string): WorkplaneSketchDocumentV0 {
  check(typeof text === 'string', CODE.CODEC, 'Authored JSON text is required'); jsonSize(text); let value: unknown;
  try { scanJSON(text); value = JSON.parse(text); } catch (cause) { if (cause instanceof WorkplaneSketchDocumentError) throw cause; throw new WorkplaneSketchDocumentError(CODE.CODEC, 'Actual built-in JSON syntax/value parsing refused', cause); }
  return evaluateWorkplaneSketchDocument(value as WorkplaneSketchDocumentV0).document;
}
