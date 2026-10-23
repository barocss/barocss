import { compileCadModel } from '../../model-compiler.js';
import type { CadCompileResult } from '../../model-compiler.js';
import type { CadAstValue, CadAstDeclaration } from '../../language/source-ast.js';
import { editSurfaceControlNet } from '../surfaces/surface-control-net.js';
import type { SurfaceControlNetEdits, SurfaceControlNetResult, SurfacePoleField } from '../surfaces/surface-control-net.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Model, Surface } from '../../types.js';
import { same } from '../../structural-equality.js';

export const SourceSurfaceControlNetDiagnosticCode = Object.freeze({ INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET', BINDING: 'BINDING', BUDGET: 'BUDGET', NATIVE: 'NATIVE', OWNED: 'OWNED' } as const);
export type SourceSurfaceControlNetDiagnosticCode = typeof SourceSurfaceControlNetDiagnosticCode[keyof typeof SourceSurfaceControlNetDiagnosticCode];
export class SourceSurfaceControlNetError extends Error {
  readonly code: SourceSurfaceControlNetDiagnosticCode;
  constructor(code: SourceSurfaceControlNetDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Surface control-net: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'SourceSurfaceControlNetError'; this.code = code;
  }
}
export interface SourceSurfaceControlNetRequest { source: string; sourceVersion: 0; surfaceId: string; edits: SurfaceControlNetEdits }
export interface SourceSurfaceControlNetPatch { uIndex: number; vIndex: number; field: SurfacePoleField; startUTF16: number; endUTF16: number; originalText: string; replacementText: string }
export interface SourceSurfaceControlNetReport {
  schema: 'barocss-source-surface-control-net-edit'; version: 0; sourceVersion: 0; modelVersion: 0; lengthUnit: 'mm'; modelName: string; surfaceId: string;
  selectedObjectIndex: number; objectCount: number; requestedPoleCount: number; requestedFieldCount: number; changedPoleCount: number; changedFieldCount: number; patchCount: number; noOp: boolean;
  originalSourceUTF16: number; candidateSourceUTF16: number; originalSourceUTF8: number; candidateSourceUTF8: number;
  preservation: { untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true; unselectedObjectBits: true; selectedSurfaceEqualsActualChild: true };
  directCounts: { originalCompileCount: 1; candidateCompileCount: 1; nativeEditCount: 1 };
  workScope: 'direct-original-and-candidate-compiles-and-native-edit-parent-internal-work-excluded';
  quality: { geometricValidity: 'not-certified'; topologyCertified: false; solid: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; editorDisplayCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumPatches: 64; maximumEdits: 16; maximumModelObjects: 16; maximumSelectedDegree: 3; maximumSelectedGridAxis: 16; selectedCoordinateAbsMM: 10000; sourceUTF16: 262144; sourceUTF8: 262144; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
  budgetFailure: 'atomic-no-partial-source-edit';
}
export interface SourceSurfaceControlNetResult { request: SourceSurfaceControlNetRequest; originalModel: Model; model: Model; source: string; edit: SurfaceControlNetResult; patches: SourceSurfaceControlNetPatch[]; report: SourceSurfaceControlNetReport }

const CODE = SourceSurfaceControlNetDiagnosticCode, FIELDS: SurfacePoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
function check(condition: boolean, code: SourceSurfaceControlNetDiagnosticCode, detail: string): asserts condition { if (!condition) throw new SourceSurfaceControlNetError(code, detail); }
function record(input: unknown, fields: string[], code: SourceSurfaceControlNetDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value or depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numeric data is required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), owned ? CODE.OWNED : CODE.BUDGET, 'Own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) { if (cause instanceof SourceSurfaceControlNetError) throw cause; throw new SourceSurfaceControlNetError(code, 'Own-data snapshot failed', cause); }
}
/** Match the original compiler's UTF-8 accounting, including lone-surrogate replacement. */
function sourceBytes(source: string): number {
  check(source.length <= 262144, CODE.BUDGET, 'Source exceeds262144 UTF-16 code units'); let bytes = 0;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index), next = source.charCodeAt(index + 1);
    if (code < 128) bytes++; else if (code < 2048) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index++; } else bytes += 3;
    check(bytes <= 262144, CODE.BUDGET, 'Source exceeds262144 UTF-8 bytes');
  }
  return bytes;
}
function compile(source: string, stage: string): Extract<CadCompileResult, { ok: true }> {
  let result: CadCompileResult;
  try { result = compileCadModel(source, { sourceVersion: 0 }); } catch (cause) { throw new SourceSurfaceControlNetError(CODE.SOURCE, 'Actual ' + stage + ' Source0 compiler failed', cause); }
  if (!result.ok) throw new SourceSurfaceControlNetError(CODE.SOURCE, 'Actual ' + stage + ' Source0 compilation refused', result); return result;
}
function coefficient(surface: Surface, u: number, v: number, field: SurfacePoleField): number { return field === 'weight' ? surface.weights[u][v] : surface.controlPoints[u][v][field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2]; }
function arrayItem(value: CadAstValue, index: number): CadAstValue {
  check(value.kind === 'array' && Number.isInteger(index) && index >= 0 && index < value.items.length, CODE.BINDING, 'Actual selected AST numeric array path is required'); return value.items[index];
}
function scalar(declaration: CadAstDeclaration, u: number, v: number, field: SurfacePoleField, surface: Surface, source: string): Extract<CadAstValue, { kind: 'number' }> {
  const fields = declaration.fields.filter(value => value.name === (field === 'weight' ? 'weights' : 'control-points'));
  check(fields.length === 1, CODE.BINDING, 'Actual selected scalar field binding must be unique');
  const pole = arrayItem(arrayItem(fields[0].value, u), v), value = field === 'weight' ? pole : arrayItem(pole, field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2);
  check(value.kind === 'number', CODE.BINDING, 'An actual directly authored numeric scalar is required');
  const range = value.range;
  check(Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= declaration.range.start && range.start >= fields[0].value.range.start && range.end <= declaration.range.end && range.end <= fields[0].value.range.end && range.start >= 0 && range.start < range.end && range.end <= source.length, CODE.BINDING, 'Actual scalar UTF-16 exclusive range is invalid');
  const lexeme = source.slice(range.start, range.end), original = coefficient(surface, u, v, field);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) && Object.is(Number(lexeme), value.value) && Object.is(value.value, original), CODE.BINDING, 'Actual source lexeme/AST/native coefficient bits disagree'); return value;
}
function apply(source: string, patches: SourceSurfaceControlNetPatch[]): string {
  let candidate = source;
  for (let index = patches.length - 1; index >= 0; index--) { const patch = patches[index]; check(source.slice(patch.startUTF16, patch.endUTF16) === patch.originalText, CODE.BINDING, 'A retained patch must bind its original scalar text');
    candidate = candidate.slice(0, patch.startUTF16) + patch.replacementText + candidate.slice(patch.endUTF16); }
  return candidate;
}
function verifyUntouchedSpans(original: string, candidate: string, patches: SourceSurfaceControlNetPatch[]): void {
  let originalAt = 0, candidateAt = 0;
  for (const patch of patches) {
    const unchangedLength = patch.startUTF16 - originalAt;
    check(original.slice(originalAt, patch.startUTF16) === candidate.slice(candidateAt, candidateAt + unchangedLength), CODE.BINDING, 'Untouched original source span changed');
    candidateAt += unchangedLength; check(candidate.slice(candidateAt, candidateAt + patch.replacementText.length) === patch.replacementText, CODE.BINDING, 'Candidate changed literal differs from its retained patch');
    candidateAt += patch.replacementText.length; originalAt = patch.endUTF16;
  }
  check(original.slice(originalAt) === candidate.slice(candidateAt), CODE.BINDING, 'Untouched original source suffix changed');
}

/** Edit only real changed numeric scalar spans in one selected Surface of the complete authoritative original Source0 file. */
export function editSourceSurfaceControlNet(input: SourceSurfaceControlNetRequest): SourceSurfaceControlNetResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'surfaceId', 'edits']);
  check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit Source0 literal editing is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
  check(typeof data.surfaceId === 'string' && data.surfaceId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.surfaceId), CODE.IDENTITY, 'Selected Surface ASCII ID1..48 is required');
  const request = data as unknown as SourceSurfaceControlNetRequest, originalSourceUTF8 = sourceBytes(request.source), original = compile(request.source, 'original'), originalModel = original.model;
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.surfaceId), selected = originalModel.objects[selectedObjectIndex];
  check(selected?.kind === 'surface', CODE.TARGET, 'The selected ID must identify one existing original Surface');
  const declarations = original.ast.declarations.filter(value => value.id === request.surfaceId), nodes = original.ir.nodes.filter(value => value.id === request.surfaceId);
  check(declarations.length === 1 && declarations[0].kind === 'surface' && nodes.length === 1 && nodes[0].kind === 'surface' && same(nodes[0].geometry, selected) && same(nodes[0].span, declarations[0].range), CODE.BINDING, 'Actual unique Surface AST/IR/native Model binding is required');
  const declaration = declarations[0];
  // Successful Source0 already excludes expressions/implicit/duplicate fields.
  // These are defensive bindings of compiler-owned ranges, not synthetic diagnostics.
  for (let u = 0; u < selected.controlPoints.length; u++) for (let v = 0; v < selected.controlPoints[u].length; v++) for (const field of FIELDS) scalar(declaration, u, v, field, selected, request.source);
  let edit: SurfaceControlNetResult;
  try { edit = editSurfaceControlNet(selected, request.edits); } catch (cause) { throw new SourceSurfaceControlNetError(CODE.NATIVE, 'Actual619 selected Surface control-net edit refused', cause); }
  check(same(edit.original, selected) && edit.surface.id === selected.id && edit.surface.kind === 'surface', CODE.BINDING, 'Actual child must retain the complete original selected Surface and identity');
  const patches: SourceSurfaceControlNetPatch[] = [];
  for (const change of edit.provenance) for (const field of change.changedFields) {
    check(FIELDS.includes(field), CODE.BINDING, 'Actual child changed field must be an existing coordinate or weight');
    const number = scalar(declaration, change.uIndex, change.vIndex, field, selected, request.source), after = coefficient(edit.surface, change.uIndex, change.vIndex, field);
    const before = field === 'weight' ? change.before.weight : change.before.pointMM[field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2], childAfter = field === 'weight' ? change.after.weight : change.after.pointMM[field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2];
    check(Object.is(number.value, before) && Object.is(after, childAfter) && !Object.is(number.value, after), CODE.BINDING, 'Actual child changed field provenance must bind the original and final scalar bits');
    let replacementText: string;
    try { replacementText = curveDecimal(after, 'Source Surface control-net'); } catch (cause) { throw new SourceSurfaceControlNetError(CODE.BINDING, 'Actual CAD decimal emission failed', cause); }
    check(Object.is(Number(replacementText), after), CODE.BINDING, 'Replacement decimal must retain exact accepted binary64 bits');
    patches.push({ uIndex: change.uIndex, vIndex: change.vIndex, field, startUTF16: number.range.start, endUTF16: number.range.end, originalText: request.source.slice(number.range.start, number.range.end), replacementText });
  }
  patches.sort((a, b) => a.startUTF16 - b.startUTF16);
  check(patches.length <= 64 && patches.length === edit.report.changedFieldCount && patches.every((patch, index) => index === 0 || patches[index - 1].endUTF16 <= patch.startUTF16), CODE.BINDING, 'All actual changed scalar patches must be bounded, accounted and nonoverlapping');
  const source = apply(request.source, patches), candidateSourceUTF8 = sourceBytes(source);
  verifyUntouchedSpans(request.source, source, patches); check(source === apply(request.source, patches), CODE.BINDING, 'Candidate must reconstruct exactly from retained original scalar patches');
  const candidate = compile(source, 'candidate'), expected = copyCadData(originalModel); expected.objects[selectedObjectIndex] = copyCadData(edit.surface);
  check(same(candidate.model, expected), CODE.BINDING, 'Complete candidate must retain original Model metadata/order/IDs/siblings and exactly the actual child selected Surface');
  const noOp = patches.length === 0; check(!noOp || source === request.source && same(candidate.model, originalModel), CODE.BINDING, 'Bitwise no-op must retain the exact whole original source and Model');
  const report: SourceSurfaceControlNetReport = {
    schema: 'barocss-source-surface-control-net-edit', version: 0, sourceVersion: 0, modelVersion: 0, lengthUnit: 'mm', modelName: originalModel.name, surfaceId: selected.id, selectedObjectIndex, objectCount: originalModel.objects.length,
    requestedPoleCount: edit.report.requestedPoleCount, requestedFieldCount: edit.provenance.reduce((count, change) => count + change.requestedFields.length, 0), changedPoleCount: edit.report.changedPoleCount, changedFieldCount: edit.report.changedFieldCount, patchCount: patches.length, noOp,
    originalSourceUTF16: request.source.length, candidateSourceUTF16: source.length, originalSourceUTF8, candidateSourceUTF8,
    preservation: { untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true, unselectedObjectBits: true, selectedSurfaceEqualsActualChild: true }, directCounts: { originalCompileCount: 1, candidateCompileCount: 1, nativeEditCount: 1 },
    workScope: 'direct-original-and-candidate-compiles-and-native-edit-parent-internal-work-excluded',
    quality: { geometricValidity: 'not-certified', topologyCertified: false, solid: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumPatches: 64, maximumEdits: 16, maximumModelObjects: 16, maximumSelectedDegree: 3, maximumSelectedGridAxis: 16, selectedCoordinateAbsMM: 10000, sourceUTF16: 262144, sourceUTF8: 262144, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, budgetFailure: 'atomic-no-partial-source-edit',
  };
  return snapshot({ request, originalModel, model: candidate.model, source, edit, patches, report }, true) as SourceSurfaceControlNetResult;
}
/** Re-run the complete public operation once, including the actual child proof and both whole-source compiles. */
export function validateSourceSurfaceControlNetEdit(input: SourceSurfaceControlNetResult): SourceSurfaceControlNetReport {
  const owned = record(snapshot(input, true), ['request', 'originalModel', 'model', 'source', 'edit', 'patches', 'report'], CODE.OWNED) as unknown as SourceSurfaceControlNetResult;
  let expected: SourceSurfaceControlNetResult;
  try { expected = editSourceSurfaceControlNet(owned.request); } catch (cause) { throw new SourceSurfaceControlNetError(CODE.OWNED, 'Whole owned source edit reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned full sources/request/Models/child/patches/report changed'); return snapshot(expected.report, true) as SourceSurfaceControlNetReport;
}
