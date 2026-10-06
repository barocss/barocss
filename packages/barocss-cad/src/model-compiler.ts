import { parseCadAst, CadAstError } from './source-ast.js';
import type { CadModelAst, CadSourceRange } from './source-ast.js';
import { analyzeCadAst, copyCadData } from './semantic-model.js';
import type { CadModelIR } from './semantic-model.js';
import { lowerCadIR } from './lower-model.js';
import type { Model } from './types.js';
import type { ExtrusionConstruction } from './compiler.js';

export type { CadModelAst, CadSourceRange, CadModelIR };
export interface CadCompileOptions { sourceVersion: 0 | 1 }
export interface CadDiagnostic { code: string; severity: 'error'; message: string; range: CadSourceRange; objectId?: string }
export type CadCompileResult = { ok: true; ast: CadModelAst; ir: CadModelIR; model: Model; constructions: ExtrusionConstruction[]; diagnostics: [] }
  | { ok: false; diagnostics: CadDiagnostic[] };

export function compileCadStages(source: string, sourceVersion: 0 | 1):
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
/** Explicit source dialect, original semantic IR and independent native outputs. */
export function compileCadModel(source: string, options: CadCompileOptions): CadCompileResult {
  if (typeof source !== 'string') return programmingFailure('TYPE', 'Source must be a string');
  if (!options || typeof options !== 'object' || Array.isArray(options)) return programmingFailure('OPTIONS', 'An explicit sourceVersion option is required');
  const prototype = Object.getPrototypeOf(options), descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(options);
  if ((prototype !== Object.prototype && prototype !== null) || keys.length !== 1 || keys[0] !== 'sourceVersion' || !descriptors.sourceVersion || !('value' in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || (descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1)) return programmingFailure('OPTIONS', 'Only own sourceVersion: 0 or 1 data is supported');
  const result = compileCadStages(source, descriptors.sourceVersion.value as 0 | 1);
  if (!result.ok) {
    const error = result.error;
    const diagnostic: CadDiagnostic = { code: error.code, severity: 'error', message: error.detail, range: { ...error.range } };
    if (error.objectId !== undefined) diagnostic.objectId = error.objectId;
    return { ok: false, diagnostics: [diagnostic] };
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}
