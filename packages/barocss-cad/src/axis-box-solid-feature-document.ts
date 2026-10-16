import { compileCadModel } from './model-compiler.js';
import { buildParametricFace } from './face.js';
import type { FaceIds, FaceBundle } from './face.js';
import { buildAxisBoxShell } from './box-shell.js';
import type { AxisBoxShellIds } from './box-shell.js';
import { validateAxisBoxSolid } from './box-solid.js';
import { buildAxisBoxSolidBoolean } from './axis-box-boolean.js';
import type { AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanOptions, AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import { editSourceSurfaceControlNet } from './source-surface-control-net.js';
import type { SourceSurfaceControlNetResult } from './source-surface-control-net.js';
import type { SurfacePoleEdit } from './surface-control-net.js';
import type { Model, Point, Surface } from './types.js';
import { same } from './structural-equality.js';

export const AxisBoxSolidFeatureDocumentDiagnosticCode = Object.freeze({ INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', REVISION: 'REVISION', BUDGET: 'BUDGET', SOURCE: 'SOURCE', BINDING: 'BINDING', NATIVE: 'NATIVE', BOOLEAN: 'BOOLEAN', CODEC: 'CODEC', OWNED: 'OWNED' } as const);
export type AxisBoxSolidFeatureDocumentDiagnosticCode = typeof AxisBoxSolidFeatureDocumentDiagnosticCode[keyof typeof AxisBoxSolidFeatureDocumentDiagnosticCode];
export class AxisBoxSolidFeatureDocumentError extends Error {
  readonly code: AxisBoxSolidFeatureDocumentDiagnosticCode;
  constructor(code: AxisBoxSolidFeatureDocumentDiagnosticCode, detail: string, cause?: unknown) { super(('Axis-box Solid feature document: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'AxisBoxSolidFeatureDocumentError'; this.code = code; }
}
type Six<T> = [T, T, T, T, T, T];
type Operation = AxisBoxSolidBooleanOptions['operation'];
export interface AxisBoxSolidFeatureDocumentOperand { sourceId: string; sourceVersion: 0; source: string; originMM: Point; sidesMM: Point; supportIds: Six<string>; faceIds: Six<FaceIds>; shellIds: AxisBoxShellIds }
export interface AxisBoxSolidFeatureDocumentV0 { schema: 'barocss-axis-box-solid-feature-document'; version: 0; documentId: string; revision: number; operands: [AxisBoxSolidFeatureDocumentOperand, AxisBoxSolidFeatureDocumentOperand]; feature: { featureId: string; operation: Operation; evaluationId: string; resultIdPrefix: string }; limits: { maximumSourceEdits: 12; maximumScalarPatches: 144; maximumCells: 27; maximumPanels: 72 } }
export interface AxisBoxSolidFeatureDocumentEdit { expectedRevision: number; operandEdits: { sourceId: string; originMM: Point | null; sidesMM: Point | null }[]; operation: Operation | null }
type SourceEdit = { operandIndex: number; surfaceId: string; result: SourceSurfaceControlNetResult };
type Counts = { baseEvaluationCount: number; sourceCompilationCount: number; sourceSurfaceEditCount: number; faceBuildCount: number; derivedBoundaryCurveCount: number; shellBuildCount: number; solidValidationCount: number; booleanEvaluationCount: number };
export interface AxisBoxSolidFeatureDocumentReport {
  schema: 'barocss-axis-box-solid-feature-evaluation'; version: 0; documentId: string; mode: 'build' | 'edit'; previousRevision: number; revision: number; noOp: boolean; changedOperandSourceIds: string[]; operationChanged: boolean; sourceEditCount: number; scalarPatchCount: number; directCounts: Counts;
  quality: { authoredIntentRetained: true; wholeOriginalSourcesRetained: true; derivedBoundariesRebuilt: true; nativeBooleanAuthority: true; persistentTopologyNamingCertified: false; arbitraryCurvedBooleanCertified: false; manufacturingToleranceCertified: false; globalBinary64GeometryEvaluationErrorCertified: false; editorDisplayCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumSourceEdits: 12; maximumScalarPatches: 144; maximumCells: 27; maximumPanels: 72; sourceUTF16: 262144; sourceUTF8: 262144; maximumModelObjects: 16; maximumRevision: 1000000; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144; fileUTF16: 1048576; fileUTF8: 1048576 };
  workScope: 'direct-authored-orchestration-only-inherited-child-validation-and-rebuild-work-excluded'; budgetFailure: 'atomic-no-partial-source-document-or-geometry';
}
export interface AxisBoxSolidFeatureDocumentResult { request: { document: AxisBoxSolidFeatureDocumentV0; edit: AxisBoxSolidFeatureDocumentEdit | null }; document: AxisBoxSolidFeatureDocumentV0; sourceEdits: SourceEdit[]; operands: [AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanAsset]; boolean: AxisBoxSolidBooleanResult; report: AxisBoxSolidFeatureDocumentReport }

const CODE = AxisBoxSolidFeatureDocumentDiagnosticCode, FACE_CORNERS = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
function check(condition: boolean, code: AxisBoxSolidFeatureDocumentDiagnosticCode, detail: string): asserts condition { if (!condition) throw new AxisBoxSolidFeatureDocumentError(code, detail); }
function child<T>(action: () => T, code: AxisBoxSolidFeatureDocumentDiagnosticCode, detail: string): T { try { return action(); } catch (cause) { throw new AxisBoxSolidFeatureDocumentError(code, detail, cause); } }
function record(input: unknown, fields: string[], code: AxisBoxSolidFeatureDocumentDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }
function id(input: unknown, maximum = 48): string { check(typeof input === 'string' && input.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'A bounded ASCII authored ID is required'); return input; }
function tuple(input: unknown, length: number): unknown[] { check(Array.isArray(input) && input.length === length, CODE.INPUT, 'A complete fixed authored tuple is required'); return input; }
function revision(input: unknown): number { check(typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 && input <= 1000000 && !Object.is(input, -0), CODE.REVISION, 'Revision must be a nonnegative safe integer at most1e6 without negativezero'); return input; }
function operation(input: unknown): Operation { check(input === 'union' || input === 'intersection' || input === 'difference', CODE.INPUT, 'An explicit union/intersection/difference operation is required'); return input; }
function bytes(text: string, maximum: number): number { check(text.length <= maximum, CODE.BUDGET, 'UTF-16 text limit exceeded'); let count = 0; for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i), next = text.charCodeAt(i + 1); if (code < 128) count++; else if (code < 2048) count += 2; else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { count += 4; i++; } else count += 3; check(count <= maximum, CODE.BUDGET, 'UTF-8 text limit exceeded'); } return count; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded'); if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; } if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required'); const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required'); check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded fields without getters/symbols/hidden data are required'); ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required'); result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); }); }
    else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)])); ancestors.delete(value); return result;
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof AxisBoxSolidFeatureDocumentError) throw cause; throw new AxisBoxSolidFeatureDocumentError(code, 'Own snapshot failed', cause); }
}
function point(input: unknown, sides = false): Point { const data = tuple(input, 3); check(data.every(value => typeof value === 'number' && Number.isSafeInteger(value) && (!sides || value >= 1 && value <= 10000)), CODE.INPUT, 'Safe integer origin/side triples with sides1..10000 are required'); return data as Point; }
function corners(origin: Point, sides: Point, bounds: boolean): Point[] { const values = Array.from({ length: 8 }, (_, index) => origin.map((value, axis) => index >> axis & 1 ? value + sides[axis] : value) as Point); check(values.every(point => point.every(value => Number.isSafeInteger(value) && (!bounds || Math.abs(value) <= 10000))), CODE.INPUT, 'Exact represented authored Box corners are required'); return values; }
function authored(input: unknown): AxisBoxSolidFeatureDocumentV0 {
  const data = record(input, ['schema', 'version', 'documentId', 'revision', 'operands', 'feature', 'limits']); check(data.schema === 'barocss-axis-box-solid-feature-document' && data.version === 0, CODE.VERSION, 'Only authored feature document schema/version0 is supported'); id(data.documentId); revision(data.revision);
  const limits = record(data.limits, ['maximumSourceEdits', 'maximumScalarPatches', 'maximumCells', 'maximumPanels']); check(limits.maximumSourceEdits === 12 && limits.maximumScalarPatches === 144 && limits.maximumCells === 27 && limits.maximumPanels === 72, CODE.BUDGET, 'Complete fixed authored work limits12/144/27/72 are required');
  const feature = record(data.feature, ['featureId', 'operation', 'evaluationId', 'resultIdPrefix']); id(feature.featureId); id(feature.evaluationId); id(feature.resultIdPrefix, 8); operation(feature.operation);
  const operands = tuple(data.operands, 2).map(value => { const operand = record(value, ['sourceId', 'sourceVersion', 'source', 'originMM', 'sidesMM', 'supportIds', 'faceIds', 'shellIds']); id(operand.sourceId); check(operand.sourceVersion === 0, CODE.VERSION, 'Authored operands must retain sourceVersion0'); check(typeof operand.source === 'string', CODE.INPUT, 'An actual whole Source0 string is required'); bytes(operand.source, 262144); corners(point(operand.originMM), point(operand.sidesMM, true), true);
    const supports = tuple(operand.supportIds, 6).map(value => id(value)); check(new Set(supports).size === 6, CODE.IDENTITY, 'Six explicit Support IDs must be distinct');
    tuple(operand.faceIds, 6).forEach(value => { const ids = record(value, ['faceId', 'loopId', 'vertexIds', 'edgeIds', 'curveIds']); id(ids.faceId); id(ids.loopId); for (const field of ['vertexIds', 'edgeIds', 'curveIds']) tuple(ids[field], 4).forEach(value => id(value)); });
    const shell = record(operand.shellIds, ['shellId', 'faceIds', 'vertexIds', 'edgeIds']); id(shell.shellId); tuple(shell.faceIds, 6).forEach(value => id(value)); tuple(shell.vertexIds, 8).forEach(value => id(value)); tuple(shell.edgeIds, 12).forEach(value => id(value)); return operand as unknown as AxisBoxSolidFeatureDocumentOperand;
  }); check(operands[0].sourceId !== operands[1].sourceId, CODE.IDENTITY, 'The two authored source identities must differ'); return data as unknown as AxisBoxSolidFeatureDocumentV0;
}
function compile(source: string): Model { bytes(source, 262144); const compiled = child(() => compileCadModel(source, { sourceVersion: 0 }), CODE.SOURCE, 'Actual whole authored Source0 compiler failed'); if (!compiled.ok) throw new AxisBoxSolidFeatureDocumentError(CODE.SOURCE, 'Actual whole authored Source0 compilation refused', compiled); check(compiled.model.objects.length <= 16, CODE.BUDGET, 'The whole actual model must retain its existing16-object bound'); return compiled.model; }
function supports(operand: AxisBoxSolidFeatureDocumentOperand, model: Model): Six<Surface> {
  const vertices = corners(operand.originMM, operand.sidesMM, false);
  return operand.supportIds.map((supportId, index) => { const selected = model.objects.find(object => object.id === supportId); check(selected?.kind === 'surface', CODE.BINDING, 'Every explicit authored Support ID must select a real Surface'); const expected = FACE_CORNERS[index].map(corner => vertices[corner]);
    check(selected.degreeU === 1 && selected.degreeV === 1 && selected.controlPoints.length === 2 && selected.controlPoints.every(row => row.length === 2) && selected.knotsU.length === 4 && selected.knotsV.length === 4 && selected.knotsU.every((value, i) => value === (i < 2 ? 0 : 1)) && selected.knotsV.every((value, i) => value === (i < 2 ? 0 : 1)) && selected.weights.every(row => row.length === 2 && row.every(weight => weight === 1)), CODE.BINDING, 'Six canonical degree1/unit-domain/unit-weight Supports are required');
    const net = [[expected[0], expected[3]], [expected[1], expected[2]]]; check(selected.controlPoints.every((row, u) => row.every((p, v) => p.every((value, axis) => value === net[u][v][axis]))), CODE.BINDING, 'The explicit canonical Support orientation must numerically match declared dimensions; original zero bits remain authority'); return selected;
  }) as Six<Surface>;
}
function reconstruct(operand: AxisBoxSolidFeatureDocumentOperand, model: Model): AxisBoxSolidBooleanAsset {
  const selected = supports(operand, model), faces = selected.map((surface, index) => child(() => buildParametricFace(surface, operand.faceIds[index]), CODE.NATIVE, 'Actual full native Face/derived boundaries reconstruction failed')) as Six<FaceBundle>;
  const shell = child(() => buildAxisBoxShell(operand.originMM, operand.sidesMM, faces, operand.shellIds), CODE.NATIVE, 'Actual native Box Shell reconstruction failed'); child(() => validateAxisBoxSolid(shell), CODE.NATIVE, 'Actual reconstructed Box Solid validation failed');
  return { sourceId: operand.sourceId, sourceVersion: 0, source: operand.source, shell };
}
function evaluate(document: AxisBoxSolidFeatureDocumentV0, operands: [AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanAsset]): AxisBoxSolidBooleanResult { return child(() => buildAxisBoxSolidBoolean(operands[0], operands[1], { operation: document.feature.operation, evaluationId: document.feature.evaluationId, resultIdPrefix: document.feature.resultIdPrefix, maximumCells: 27, maximumPanels: 72 }), CODE.BOOLEAN, 'Actual source-bound native Solid Boolean evaluation refused'); }
function report(document: AxisBoxSolidFeatureDocumentV0, mode: 'build' | 'edit', previousRevision: number, noOp: boolean, changedOperandSourceIds: string[], operationChanged: boolean, sourceEdits: SourceEdit[], directCounts: Counts): AxisBoxSolidFeatureDocumentReport {
  return { schema: 'barocss-axis-box-solid-feature-evaluation', version: 0, documentId: document.documentId, mode, previousRevision, revision: document.revision, noOp, changedOperandSourceIds, operationChanged, sourceEditCount: sourceEdits.length, scalarPatchCount: sourceEdits.reduce((count, edit) => count + edit.result.patches.length, 0), directCounts,
    quality: { authoredIntentRetained: true, wholeOriginalSourcesRetained: true, derivedBoundariesRebuilt: true, nativeBooleanAuthority: true, persistentTopologyNamingCertified: false, arbitraryCurvedBooleanCertified: false, manufacturingToleranceCertified: false, globalBinary64GeometryEvaluationErrorCertified: false, editorDisplayCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumSourceEdits: 12, maximumScalarPatches: 144, maximumCells: 27, maximumPanels: 72, sourceUTF16: 262144, sourceUTF8: 262144, maximumModelObjects: 16, maximumRevision: 1000000, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144, fileUTF16: 1048576, fileUTF8: 1048576 }, workScope: 'direct-authored-orchestration-only-inherited-child-validation-and-rebuild-work-excluded', budgetFailure: 'atomic-no-partial-source-document-or-geometry' };
}

/** Evaluate explicit authored sources/dimensions/associations, rebuilding all derived native topology. */
export function buildAxisBoxSolidFeatureDocument(input: AxisBoxSolidFeatureDocumentV0): AxisBoxSolidFeatureDocumentResult {
  const document = authored(snapshot(input)), models = document.operands.map(operand => compile(operand.source)); document.operands.forEach((operand, index) => supports(operand, models[index]));
  const operands = document.operands.map((operand, index) => reconstruct(operand, models[index])) as [AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanAsset], boolean = evaluate(document, operands);
  const result = { request: { document, edit: null }, document, sourceEdits: [], operands, boolean, report: report(document, 'build', document.revision, false, [], false, [], { baseEvaluationCount: 0, sourceCompilationCount: 2, sourceSurfaceEditCount: 0, faceBuildCount: 12, derivedBoundaryCurveCount: 48, shellBuildCount: 2, solidValidationCount: 2, booleanEvaluationCount: 1 }) };
  return snapshot(result, true) as AxisBoxSolidFeatureDocumentResult;
}

/** Stage literal edits and complete topology privately; publish only a complete accepted authored revision. */
export function editAxisBoxSolidFeatureDocument(documentInput: AxisBoxSolidFeatureDocumentV0, editInput: AxisBoxSolidFeatureDocumentEdit): AxisBoxSolidFeatureDocumentResult {
  const input = record(snapshot({ document: documentInput, edit: editInput }), ['document', 'edit']), document = authored(input.document), editData = record(input.edit, ['expectedRevision', 'operandEdits', 'operation']);
  check(revision(editData.expectedRevision) === document.revision, CODE.REVISION, 'Expected revision must equal the current actual authored revision'); check(Array.isArray(editData.operandEdits) && editData.operandEdits.length <= 2, CODE.INPUT, 'At most two unique authored operand edits are supported'); if (editData.operation !== null) operation(editData.operation);
  const targets = new Set<string>(); editData.operandEdits.forEach(value => { const change = record(value, ['sourceId', 'originMM', 'sidesMM']); id(change.sourceId); check(document.operands.some(operand => operand.sourceId === change.sourceId) && !targets.has(change.sourceId as string), CODE.IDENTITY, 'Every operand edit must select one existing unique source'); targets.add(change.sourceId as string); check(change.originMM !== null || change.sidesMM !== null, CODE.INPUT, 'At least one complete origin or side triple is required'); if (change.originMM !== null) point(change.originMM); if (change.sidesMM !== null) point(change.sidesMM, true); });
  const edit = editData as unknown as AxisBoxSolidFeatureDocumentEdit, base = buildAxisBoxSolidFeatureDocument(document), next = snapshot(document) as AxisBoxSolidFeatureDocumentV0, changed: number[] = [];
  for (const change of edit.operandEdits) { const index = next.operands.findIndex(operand => operand.sourceId === change.sourceId), operand = next.operands[index]; if (change.originMM !== null) operand.originMM = change.originMM; if (change.sidesMM !== null) operand.sidesMM = change.sidesMM; corners(operand.originMM, operand.sidesMM, false); if (!same(operand.originMM, document.operands[index].originMM) || !same(operand.sidesMM, document.operands[index].sidesMM)) changed.push(index); }
  changed.sort((a, b) => a - b); if (edit.operation !== null) next.feature.operation = edit.operation; const operationChanged = next.feature.operation !== document.feature.operation, noOp = changed.length === 0 && !operationChanged;
  check(noOp || document.revision < 1000000, CODE.REVISION, 'A genuine authored change cannot exceed the revision cap'); if (!noOp) next.revision = document.revision + 1;
  const sourceEdits: SourceEdit[] = [], operands = base.operands.slice() as [AxisBoxSolidBooleanAsset, AxisBoxSolidBooleanAsset]; let scalarPatchCount = 0;
  for (const index of changed) {
    const original = document.operands[index], operand = next.operands[index], affected = [0, 1, 2].map(axis => !Object.is(original.originMM[axis], operand.originMM[axis]) || !Object.is(original.sidesMM[axis], operand.sidesMM[axis])), previous = corners(original.originMM, original.sidesMM, false), desired = corners(operand.originMM, operand.sidesMM, false);
    const originalSupports = base.operands[index].shell.faces.map(face => face.bundle.geometry.objects[0] as Surface);
    for (let support = 0; support < 6; support++) {
      const surface = originalSupports[support], ordered = FACE_CORNERS[support].map(vertex => desired[vertex]), oldOrdered = FACE_CORNERS[support].map(vertex => previous[vertex]), net = [[ordered[0], ordered[3]], [ordered[1], ordered[2]]], oldNet = [[oldOrdered[0], oldOrdered[3]], [oldOrdered[1], oldOrdered[2]]], poleEdits: SurfacePoleEdit[] = [];
      // Unchanged authored coordinate values keep their original source zero signs.
      for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) { const pole: SurfacePoleEdit = { uIndex: u, vIndex: v }; for (let axis = 0; axis < 3; axis++) if (affected[axis] && !Object.is(oldNet[u][v][axis], net[u][v][axis]) && !Object.is(surface.controlPoints[u][v][axis], net[u][v][axis])) pole[axis === 0 ? 'xMM' : axis === 1 ? 'yMM' : 'zMM'] = net[u][v][axis]; if (Object.keys(pole).length > 2) poleEdits.push(pole); }
      if (poleEdits.length === 0) continue;
      check(sourceEdits.length < 12, CODE.BUDGET, 'The complete source-edit limit12 exceeded');
      const result = child(() => editSourceSurfaceControlNet({ source: operand.source, sourceVersion: 0, surfaceId: operand.supportIds[support], edits: { poleEdits } }), CODE.NATIVE, 'Actual full-source selected-Support literal edit refused');
      scalarPatchCount += result.patches.length; check(scalarPatchCount <= 144, CODE.BUDGET, 'The complete changed scalar patch limit144 exceeded'); sourceEdits.push({ operandIndex: index, surfaceId: operand.supportIds[support], result }); operand.source = result.source;
    }
    operands[index] = reconstruct(operand, compile(operand.source));
  }
  const boolean = noOp ? base.boolean : evaluate(next, operands), sourceIds = changed.map(index => next.operands[index].sourceId), count = changed.length;
  const result = { request: { document, edit }, document: next, sourceEdits, operands, boolean, report: report(next, 'edit', document.revision, noOp, sourceIds, operationChanged, sourceEdits, { baseEvaluationCount: 1, sourceCompilationCount: count, sourceSurfaceEditCount: sourceEdits.length, faceBuildCount: 6 * count, derivedBoundaryCurveCount: 24 * count, shellBuildCount: count, solidValidationCount: count, booleanEvaluationCount: noOp ? 0 : 1 }) };
  return snapshot(result, true) as AxisBoxSolidFeatureDocumentResult;
}

/** Validate all original intent, actual staged source edits and complete regenerated native receipts. */
export function validateAxisBoxSolidFeatureDocument(input: AxisBoxSolidFeatureDocumentResult): AxisBoxSolidFeatureDocumentReport {
  const owned = record(snapshot(input, true), ['request', 'document', 'sourceEdits', 'operands', 'boolean', 'report'], CODE.OWNED) as unknown as AxisBoxSolidFeatureDocumentResult; record(owned.request, ['document', 'edit'], CODE.OWNED);
  let expected: AxisBoxSolidFeatureDocumentResult; try { expected = owned.request.edit === null ? buildAxisBoxSolidFeatureDocument(owned.request.document) : editAxisBoxSolidFeatureDocument(owned.request.document, owned.request.edit); } catch (cause) { throw new AxisBoxSolidFeatureDocumentError(CODE.OWNED, 'Whole owned authored source/native reconstruction refused', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned original/final intent/source patches/topology/Boolean/proofs/counters changed'); return snapshot(expected.report, true) as AxisBoxSolidFeatureDocumentReport;
}
function json(value: unknown): string { if (typeof value === 'number' && Object.is(value, -0)) return '-0'; if (Array.isArray(value)) return '[' + value.map(json).join(',') + ']'; if (value !== null && typeof value === 'object') return '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + json(item)).join(',') + '}'; const encoded = JSON.stringify(value); check(typeof encoded === 'string', CODE.CODEC, 'Accepted authored values must have a complete JSON encoding'); return encoded; }
/** Persist authored data only, after one actual complete semantic/native evaluation. */
export function serializeAxisBoxSolidFeatureDocument(input: AxisBoxSolidFeatureDocumentV0): string { const accepted = buildAxisBoxSolidFeatureDocument(input), text = json(accepted.document); bytes(text, 1048576); return text; }
/** Decode an authored file and evaluate it through the actual complete native orchestration. */
export function parseAxisBoxSolidFeatureDocument(text: string): AxisBoxSolidFeatureDocumentResult { check(typeof text === 'string', CODE.CODEC, 'Authored file text must be a string'); bytes(text, 1048576); let decoded: unknown; try { decoded = JSON.parse(text); } catch (cause) { throw new AxisBoxSolidFeatureDocumentError(CODE.CODEC, 'Actual authored JSON parser refused', cause); } return buildAxisBoxSolidFeatureDocument(decoded as AxisBoxSolidFeatureDocumentV0); }
