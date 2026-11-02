import type { CadExpression } from './expression-parser.js';
import { KernelError } from '../core/barocss-error.js';
export { CAD_EXPRESSION_LIMITS } from './expression-parser.js';
export type { CadExpression, CadCallArgument, CadCallExpression } from './expression-parser.js';
/** UTF-16 offsets, exclusive end, and one-based source coordinates. */
export interface CadSourceRange {
    start: number;
    end: number;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
}
export type CadAstValue = CadExpression | {
    kind: 'identifier';
    value: string;
    range: CadSourceRange;
} | {
    kind: 'reference';
    id: string;
    range: CadSourceRange;
} | {
    kind: 'array';
    items: CadAstValue[];
    range: CadSourceRange;
};
export interface CadAstField {
    name: string;
    value: CadAstValue;
    range: CadSourceRange;
    nameRange: CadSourceRange;
}
export interface CadOrdinaryAstDeclaration {
    kind: 'curve' | 'surface' | 'extrude' | 'parameter';
    id: string;
    range: CadSourceRange;
    idRange: CadSourceRange;
    fields: CadAstField[];
}
export type CadFormalArgument = {
    kind: 'formal-argument';
    name: string;
    nameRange: CadSourceRange;
    quantityKind: 'length' | 'scalar';
    typeRange: CadSourceRange;
    defaultExpression: CadExpression | null;
    range: CadSourceRange;
};
export type CadFunctionAst = {
    kind: 'function';
    id: string;
    idRange: CadSourceRange;
    range: CadSourceRange;
    arguments: CadFormalArgument[];
    returnKind: 'length' | 'scalar';
    returnTypeRange: CadSourceRange;
    fields: [CadAstField];
};
export type CadAstDeclaration = CadOrdinaryAstDeclaration | CadFunctionAst;
export interface CadModelAst {
    kind: 'model';
    name: string;
    range: CadSourceRange;
    nameRange: CadSourceRange;
    fields: CadAstField[];
    declarations: CadAstDeclaration[];
}
/** An actual-source parser diagnostic, with no synthetic or partial model. */
/** The source parser's and semantic model's codes. */
export type CadAstCode = 'CYCLE' | 'DEGREE' | 'DIMENSION' | 'DIVISION_ZERO' | 'DUPLICATE' | 'FIELD' | 'FUNCTION_ARGUMENT' | 'FUNCTION_CAPTURE' | 'FUNCTION_RECURSION' | 'FUNCTION_REFERENCE' | 'FUNCTION_TYPE' | 'GEOMETRY' | 'KIND' | 'KNOTS' | 'LIMIT' | 'REFERENCE' | 'SYNTAX' | 'TYPE' | 'UNIT' | 'VALUE' | 'VERSION' | 'WEIGHTS';
export declare class CadAstError extends KernelError {
    readonly code: CadAstCode;
    readonly detail: string;
    readonly range: CadSourceRange;
    readonly objectId?: string;
    constructor(code: CadAstCode, detail: string, range: CadSourceRange, objectId?: string);
}
/** Bounds include rejected duplicate values and stop growth before each push.
 * A maximum legal surface uses 1363 value nodes (1041 poles,273 weights,
 * 46 knots,3 scalar fields). Sixteen use21808 values and at most131
 * model/declaration/field records. Its lexer uses fewer than50000 tokens.
 * Range metadata is inline owned data, not subject to topology's32768 budget.
 */
export declare const CAD_AST_LIMITS: Readonly<{
    sourceBytes: 262144;
    values: 65536;
    nodes: 65536;
    tokens: 131072;
    arrayDepth: 3;
    declarations: 16;
}>;
/** Parse only source data; unit/types/native geometry belong to semantics. */
export declare function parseCadAst(source: string, sourceVersion: 0 | 1 | 2 | 3): CadModelAst;
