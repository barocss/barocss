import {compileMeshMaterial, evaluateAuthoredMaterial, AuthoredMaterialEvaluationError} from '@barocss/gpu';
import type {AuthoredMaterialSample, GpuDiagnostic, MeshMaterialDiagnostic} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';

export const RENDER_MATERIAL_LIMITS = Object.freeze({sourceBytes: 65536, fileBytes: 262144, uniforms: 16, historyEntries: 64, historyBytes: 4194304});
export interface RenderMaterialDocument {
  readonly format: 'barocss-render-editor-material';
  readonly version: 0;
  readonly profile: 'mesh-opaque-fragment-v0';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly shaderSource: string;
  /** Original supplied overrides; omitted defaults stay omitted. */
  readonly uniforms: Readonly<Record<string, number>>;
}
export interface RenderMaterialPreparation {readonly document: RenderMaterialDocument; readonly sample: AuthoredMaterialSample}
const bytes = (text: string) => new TextEncoder().encode(text).length;
function refuse(code: 'DOCUMENT_INPUT' | 'DOCUMENT_VERSION' | 'DOCUMENT_BYTES', message: string): never {throw new RenderEditorError(code, message);}
function own(input: unknown, keys?: readonly string[]): Record<string, unknown> {
  try {
    if (input === null || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) refuse('DOCUMENT_INPUT', 'Material data requires a plain own record.');
    const names = Reflect.ownKeys(input);
    if (keys && (names.length !== keys.length || names.some(name => typeof name !== 'string' || !keys.includes(name)))) refuse('DOCUMENT_INPUT', 'Material document has missing or unsupported fields.');
    if (!keys && names.length > RENDER_MATERIAL_LIMITS.uniforms) refuse('DOCUMENT_INPUT', 'Material exceeds 16 supplied uniforms.');
    const entries = names.map(name => {
      const descriptor = Object.getOwnPropertyDescriptor(input, name);
      if (typeof name !== 'string' || !descriptor || !('value' in descriptor) || !descriptor.enumerable) refuse('DOCUMENT_INPUT', 'Material data refuses hidden fields, symbols and accessors.');
      return [name, descriptor.value] as const;
    });
    return Object.fromEntries(entries);
  } catch (cause) {
    if (cause instanceof RenderEditorError) throw cause;
    const error = normalizeRenderEditorError(cause);
    Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;
  }
}
/** Private shared draft snapshot; actual providers qualify accepted ranges and finite values. */
export function copyRenderMaterialUniforms(input: unknown): Readonly<Record<string, number>> {
  const record = own(input);
  if (Object.values(record).some(value => typeof value !== 'number')) refuse('DOCUMENT_INPUT', 'Supplied material uniforms require numbers.');
  return Object.freeze(record) as Readonly<Record<string, number>>;
}
export function validateRenderMaterialSourceInput(source: unknown): asserts source is string {
  if (typeof source !== 'string') refuse('DOCUMENT_INPUT', 'Shader source must be text.');
  if (source.length > RENDER_MATERIAL_LIMITS.sourceBytes || bytes(source) > RENDER_MATERIAL_LIMITS.sourceBytes) refuse('DOCUMENT_BYTES', 'Shader source exceeds 65536 UTF-8 bytes.');
}
function diagnostic(source: string, value: MeshMaterialDiagnostic): GpuDiagnostic {
  const before = source.slice(0, value.start), lines = before.split(/\r\n|\r|\n/);
  return {code: value.code, severity: 'error', message: value.message, range: {start: value.start, end: value.end, line: lines.length, column: lines[lines.length - 1].length + 1}};
}
/** Reconstruct the actual material; no canonical IR or sample is accepted from a file. */
export function prepareRenderMaterialDocument(input: unknown): RenderMaterialPreparation {
  const data = own(input, ['format', 'version', 'profile', 'documentId', 'title', 'revision', 'shaderSource', 'uniforms']);
  if (data.format !== 'barocss-render-editor-material') refuse('DOCUMENT_INPUT', 'This file is not a material document.');
  if (data.version !== 0 || data.profile !== 'mesh-opaque-fragment-v0') refuse('DOCUMENT_VERSION', 'Unsupported material version or profile.');
  if (typeof data.documentId !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(data.documentId)) refuse('DOCUMENT_INPUT', 'Material document ID requires 1..64 ASCII characters.');
  if (typeof data.title !== 'string' || !data.title.trim() || [...data.title].length > 128 || data.title.length > 256 || bytes(data.title) > 512) refuse('DOCUMENT_INPUT', 'Material title is empty or exceeds its limit.');
  if (typeof data.revision !== 'number' || !Number.isInteger(data.revision) || data.revision < 0 || data.revision > 2147483647) refuse('DOCUMENT_INPUT', 'Material revision exceeds its integer range.');
  validateRenderMaterialSourceInput(data.shaderSource);
  const uniforms = copyRenderMaterialUniforms(data.uniforms);
  const document: RenderMaterialDocument = Object.freeze({format: 'barocss-render-editor-material', version: 0, profile: 'mesh-opaque-fragment-v0', documentId: data.documentId, title: data.title, revision: data.revision, shaderSource: data.shaderSource, uniforms});
  const compiled = compileMeshMaterial(document.shaderSource);
  if (!compiled.ok) {
    const error = new RenderEditorError('SOURCE_REFUSED', 'Correct the material shader source.', compiled.diagnostics.map(value => diagnostic(document.shaderSource, value)));
    Object.defineProperty(error, 'cause', {value: compiled.diagnostics, configurable: true}); throw error;
  }
  try {
    const sample = evaluateAuthoredMaterial({material: compiled.material, uniforms});
    return Object.freeze({document, sample});
  } catch (cause) {
    const error = new RenderEditorError('SOURCE_REFUSED', 'Material values could not be applied.', [{code: cause instanceof AuthoredMaterialEvaluationError ? cause.code : 'MATERIAL', severity: 'error', message: cause instanceof Error ? cause.message : 'Material evaluation refused.', range: null, dataPath: 'uniforms'}]);
    Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;
  }
}
export function validateRenderMaterialDocument(input: unknown): RenderMaterialDocument {return prepareRenderMaterialDocument(input).document;}
export function parseRenderMaterialDocument(text: string): RenderMaterialDocument {
  if (typeof text !== 'string') refuse('DOCUMENT_INPUT', 'Material JSON must be text.');
  if (text.length > RENDER_MATERIAL_LIMITS.fileBytes || bytes(text) > RENDER_MATERIAL_LIMITS.fileBytes) refuse('DOCUMENT_BYTES', 'Material file exceeds 262144 UTF-8 bytes.');
  let input: unknown;
  try {input = JSON.parse(text);} catch (cause) {const error = normalizeRenderEditorError(cause); Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;}
  return validateRenderMaterialDocument(input);
}
export function serializeRenderMaterialDocument(input: RenderMaterialDocument): string {
  const document = validateRenderMaterialDocument(input);
  const rows = Object.entries(document).map(([key, value]) => {
    const literal = key === 'uniforms' ? '{' + Object.entries(document.uniforms).map(([name, number]) => JSON.stringify(name) + ': ' + (Object.is(number, -0) ? '-0' : JSON.stringify(number))).join(', ') + '}' : JSON.stringify(value);
    return '  ' + JSON.stringify(key) + ': ' + literal;
  });
  const text = '{\n' + rows.join(',\n') + '\n}\n';
  if (bytes(text) > RENDER_MATERIAL_LIMITS.fileBytes) refuse('DOCUMENT_BYTES', 'Serialized material file exceeds 262144 UTF-8 bytes.');
  return text;
}

/** Owned-copy assignment: portable identity never replaces the target's authorship. */
export function deriveRenderMaterialAssignment(target: RenderMaterialDocument, portable: RenderMaterialDocument): RenderMaterialDocument {
  const destination = prepareRenderMaterialDocument(target).document;
  const source = prepareRenderMaterialDocument(portable).document;
  return prepareRenderMaterialDocument({...destination, shaderSource: source.shaderSource, uniforms: source.uniforms}).document;
}
