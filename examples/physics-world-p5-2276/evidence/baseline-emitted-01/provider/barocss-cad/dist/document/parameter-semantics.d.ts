import type { CadExpression, CadModelAst, CadSourceRange } from '../language/source-ast.js';
export type CadQuantityKind = 'length' | 'scalar';
export interface CadResolvedParameter {
    id: string;
    quantityKind: CadQuantityKind;
    value: number;
    unit: 'mm' | '1';
    expression: CadExpression;
    span: CadSourceRange;
}
export interface CadFieldBinding {
    objectId: string;
    field: string;
    indices: number[];
    expression: CadExpression;
    value: number;
    quantityKind: CadQuantityKind;
    span: CadSourceRange;
    references: string[];
}
export interface CadParameterDependency {
    fromId: string;
    toId: string;
    kind: 'parameter-input';
    span: CadSourceRange;
}
/** Check the entire reference graph before evaluating any expression. */
export declare function resolveCadParameters(ast: CadModelAst): {
    ast: CadModelAst;
    parameters: CadResolvedParameter[];
    bindings: CadFieldBinding[];
    dependencies: CadParameterDependency[];
};
