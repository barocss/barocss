import { CadAstError } from './language/source-ast.js';
import type { CadModelAst, CadSourceRange } from './language/source-ast.js';
import type { CadModelIR } from './language/semantic-model.js';
import type { Model } from './types.js';
import type { ExtrusionConstruction } from './document/construction-types.js';
export type { CadModelAst, CadSourceRange, CadModelIR };
export type { CadExpression } from './language/source-ast.js';
export type { CadModelIR1, CadModelIR2, CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from './language/semantic-model.js';
export interface CadCompileOptions {
    sourceVersion: 0 | 1 | 2 | 3;
}
export interface CadDiagnostic {
    code: string;
    severity: 'error';
    message: string;
    range: CadSourceRange;
    objectId?: string;
}
export type CadCompileResult = {
    ok: true;
    ast: CadModelAst;
    ir: CadModelIR;
    model: Model;
    constructions: ExtrusionConstruction[];
    diagnostics: [];
} | {
    ok: false;
    diagnostics: CadDiagnostic[];
};
export declare function compileCadStages(source: string, sourceVersion: 0 | 1 | 2 | 3): {
    ok: true;
    ast: CadModelAst;
    ir: CadModelIR;
    model: Model;
    constructions: ExtrusionConstruction[];
} | {
    ok: false;
    error: CadAstError;
};
/** Explicit source dialect, original semantic IR and independent native outputs. */
export declare function compileCadModel(source: string, options: CadCompileOptions): CadCompileResult;
