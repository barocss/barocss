import { parseCadAst, CadAstError } from './source-ast.js';
import type { CadModelAst, CadSourceRange } from './source-ast.js';
import { analyzeCadAst, copyCadData } from './semantic-model.js';
import type { CadModelIR } from './semantic-model.js';
import { lowerCadIR } from './lower-model.js';
import type { Model } from './types.js';
import type { ExtrusionConstruction } from './construction-types.js';

export type { CadModelAst, CadSourceRange, CadModelIR };
export type { CadExpression } from './source-ast.js';
export type { CadModelIR1, CadModelIR2, CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from './semantic-model.js';
export interface CadCompileOptions { sourceVersion: 0 | 1 | 2 | 3 }
export interface CadDiagnostic { code: string; severity: 'error'; message: string; range: CadSourceRange; objectId?: string }
export type CadCompileResult = { ok: true; ast: CadModelAst; ir: CadModelIR; model: Model; constructions: ExtrusionConstruction[]; diagnostics: [] }
  | { ok: false; diagnostics: CadDiagnostic[] };

export function compileCadStages(source: string, sourceVersion: 0 | 1 | 2 | 3):
  { ok: true; ast: CadModelAst; ir: CadModelIR; model: Model; constructions: ExtrusionConstruction[] } | { ok: false; error: CadAstError } {
  try {
    const ast = parseCadAst(source, sourceVersion);
    const ir = analyzeCadAst(ast, sourceVersion, source);
    const lowered = lowerCadIR(ir);
    return { ok: true, ast, ir, ...lowered };
  } catch (error) { if (error instanceof CadAstError) return { ok: false, error }; throw error; }
}
function programmingFailure(code: string, message: string): CadCompileResult {
  return { ok: false, diagnostics: [{ code, severity: 'error', message, range: { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 } }] };
}
function diagnosticFailure(error: CadAstError): CadCompileResult {
  const diagnostic: CadDiagnostic = { code: error.code, severity: 'error', message: error.detail, range: { ...error.range } };
  if (error.objectId !== undefined) diagnostic.objectId = error.objectId;
  return { ok: false, diagnostics: [diagnostic] };
}
/** Measure each retained occurrence without allocating a complete JSON string. */
function settleSource3Success(success: Extract<CadCompileResult, { ok: true }>): void {
  if (success.ir.schemaVersion !== 3) return;
  const work = success.ir.work, limits = work.limits;
  const fail = (message: string): never => { throw new CadAstError('LIMIT', message, success.ast.range, success.ast.name); };
  const measure = () => {
    let utf16 = 0, utf8 = 0, ownValues = 0;
    const token = (text: string) => {
      utf16 += text.length;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 128) utf8++;
        else if (code < 2048) utf8 += 2;
        else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { utf8 += 4; i++; }
        else utf8 += 3;
      }
      if (utf16 > limits.maximumSuccessUTF16 || utf8 > limits.maximumSuccessUTF8) fail('Complete Source3 success exceeds its file envelope');
    };
    const visit = (value: unknown, depth: number): void => {
      if (++ownValues > limits.maximumOwnValues || depth > limits.maximumOwnDepth) fail('Complete Source3 success exceeds its owned-data envelope');
      if (value === null) { token('null'); return; }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) fail('Source3 success must retain finite numbers');
        token(Object.is(value, -0) ? '-0' : JSON.stringify(value)); return;
      }
      if (typeof value === 'string' || typeof value === 'boolean') { token(JSON.stringify(value)); return; }
      if (Array.isArray(value)) {
        if (value.length > limits.maximumOwnArray) fail('Source3 success array exceeds its owned-data limit');
        token('[');
        value.forEach((item, index) => { if (index) token(','); visit(item, depth + 1); });
        token(']'); return;
      }
      if (typeof value !== 'object') fail('Source3 success must contain only plain compiler data');
      const record = value as Record<string, unknown>, keys = Object.keys(record);
      if (keys.length > limits.maximumOwnRecord) fail('Source3 success record exceeds its owned-data limit');
      token('{');
      keys.forEach((key, index) => { if (index) token(','); token(JSON.stringify(key)); token(':'); visit(record[key], depth + 1); });
      token('}');
    };
    visit(success, 0); token('\n');
    return { utf16, utf8, ownValues };
  };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = measure();
    if (size.utf16 === work.fileSizes.success.utf16 && size.utf8 === work.fileSizes.success.utf8 && size.ownValues === work.ownValues) { settled = true; break; }
    work.fileSizes.success = { utf16: size.utf16, utf8: size.utf8 }; work.ownValues = size.ownValues;
  }
  const final = measure();
  if (!settled || final.utf16 !== work.fileSizes.success.utf16 || final.utf8 !== work.fileSizes.success.utf8 || final.ownValues !== work.ownValues) fail('Source3 success sizes must settle within eight passes');
}
/** Explicit source dialect, original semantic IR and independent native outputs. */
export function compileCadModel(source: string, options: CadCompileOptions): CadCompileResult {
  if (typeof source !== 'string') return programmingFailure('TYPE', 'Source must be a string');
  if (!options || typeof options !== 'object' || Array.isArray(options)) return programmingFailure('OPTIONS', 'An explicit sourceVersion option is required');
  const prototype = Object.getPrototypeOf(options), descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(options);
  if ((prototype !== Object.prototype && prototype !== null) || keys.length !== 1 || keys[0] !== 'sourceVersion' || !descriptors.sourceVersion || !('value' in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || (descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1 && descriptors.sourceVersion.value !== 2 && descriptors.sourceVersion.value !== 3)) return programmingFailure('OPTIONS', 'Only own sourceVersion: 0, 1, 2 or 3 data is supported');
  const result = compileCadStages(source, descriptors.sourceVersion.value as 0 | 1 | 2 | 3);
  if (!result.ok) {
    return diagnosticFailure(result.error);
  }
  if (descriptors.sourceVersion.value === 3) {
    const success: Extract<CadCompileResult, { ok: true }> = { ...result, diagnostics: [] };
    try { settleSource3Success(success); }
    catch (error) { if (error instanceof CadAstError) return diagnosticFailure(error); throw error; }
    return copyCadData(success);
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}
