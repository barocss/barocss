import type { CadModelAst, CadSourceRange } from './source-ast.js';
import type { Curve, Surface, Point } from '../types.js';
import type { CadResolvedFunction, CadFunctionCallReceipt, CadFunctionWork } from '../document/function-quantity-semantics.js';
import type { CadResolvedParameter, CadFieldBinding, CadParameterDependency } from '../document/parameter-semantics.js';
export { copyCadData } from '../data-copy.js';
export type { CadResolvedParameter, CadFieldBinding, CadQuantityKind, CadParameterDependency } from '../document/parameter-semantics.js';
export type { CadFunctionQuantity, CadResolvedFunction, CadFunctionCallReceipt, CadFunctionWork } from '../document/function-quantity-semantics.js';
export type CadLiteralIRNode = {
    id: string;
    span: CadSourceRange;
    fieldTypes: Record<string, string>;
} & ({
    kind: 'curve';
    geometry: Curve;
} | {
    kind: 'surface';
    geometry: Surface;
});
export interface CadExtrudeIRNode {
    kind: 'extrude';
    id: string;
    inputId: string;
    vector: Point;
    span: CadSourceRange;
    referenceSpan: CadSourceRange;
    fieldTypes: Record<string, string>;
}
export interface CadModelIR1 {
    schema: 'barocss-cad-ir';
    schemaVersion: 1;
    sourceVersion: 0 | 1;
    name: string;
    lengthUnit: 'mm';
    nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
    dependencies: {
        fromId: string;
        toId: string;
        kind: 'curve-input';
        span: CadSourceRange;
    }[];
}
export interface CadModelIR2 {
    schema: 'barocss-cad-ir';
    schemaVersion: 2;
    sourceVersion: 2;
    name: string;
    lengthUnit: 'mm';
    nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
    dependencies: (CadModelIR1['dependencies'][number] | CadParameterDependency)[];
    parameters: CadResolvedParameter[];
    bindings: CadFieldBinding[];
}
export interface CadModelIR3 {
    schema: 'barocss-cad-ir';
    schemaVersion: 3;
    sourceVersion: 3;
    name: string;
    lengthUnit: 'mm';
    nodes: (CadLiteralIRNode | CadExtrudeIRNode)[];
    dependencies: (CadModelIR1['dependencies'][number] | CadParameterDependency)[];
    parameters: CadResolvedParameter[];
    bindings: CadFieldBinding[];
    functions: CadResolvedFunction[];
    calls: CadFunctionCallReceipt[];
    work: CadFunctionWork;
}
export type CadModelIR = CadModelIR1 | CadModelIR2 | CadModelIR3;
/** All references/quantities/native inputs resolve before any derived lowering. */
export declare function analyzeCadAst(ast: CadModelAst, sourceVersion: 0 | 1 | 2 | 3, _source: string): CadModelIR;
