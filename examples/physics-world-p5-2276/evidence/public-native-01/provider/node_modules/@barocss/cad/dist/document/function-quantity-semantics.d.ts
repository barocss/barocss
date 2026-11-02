import type { CadModelAst, CadFunctionAst, CadSourceRange } from '../language/source-ast.js';
import type { CadQuantityKind, CadResolvedParameter, CadFieldBinding, CadParameterDependency } from './parameter-semantics.js';
export interface CadFunctionQuantity {
    kind: CadQuantityKind;
    unit: 'mm' | '1';
    value: number;
}
export interface CadResolvedFunction {
    id: string;
    declaration: CadFunctionAst;
    returnKind: CadQuantityKind;
    arguments: {
        name: string;
        quantityKind: CadQuantityKind;
        defaultQuantity: CadFunctionQuantity | null;
    }[];
}
export interface CadFunctionCallReceipt {
    frameId: number;
    parentFrameId: number | null;
    functionId: string;
    depth: number;
    callSpan: CadSourceRange;
    definitionSpan: CadSourceRange;
    owner: {
        objectId: string;
        field: string;
        indices: number[];
    };
    bindings: {
        formalName: string;
        quantity: CadFunctionQuantity;
        origin: 'explicit' | 'default';
        argumentSpan: CadSourceRange | null;
        formalSpan: CadSourceRange;
        defaultSpan: CadSourceRange | null;
    }[];
    result: CadFunctionQuantity;
}
export interface CadFunctionWork {
    limits: {
        maximumFunctions: 8;
        maximumArguments: 4;
        maximumCallDepth: 8;
        maximumCallEntries: 256;
        maximumExpressionEvaluations: 65536;
        maximumDefaultAdmissionEvaluations: 32;
        maximumSuccessUTF16: 16777216;
        maximumSuccessUTF8: 16777216;
        maximumOwnValues: 4194304;
        maximumOwnDepth: 128;
        maximumOwnArray: 65536;
        maximumOwnRecord: 64;
    };
    preflight: {
        callEntries: number;
        expressionEvaluations: number;
        maximumCallDepth: number;
    };
    actual: {
        callEntries: number;
        defaultAdmissionEvaluations: number;
        defaultRuntimeEvaluations: number;
        expressionEvaluations: number;
        maximumCallDepth: number;
    };
    fileSizes: {
        success: {
            utf16: number;
            utf8: number;
        };
    };
    ownValues: number;
}
/** Source3 static qualification and bounded, lexical, frame-local quantity evaluation. */
export declare function resolveCadFunctionParameters(ast: CadModelAst): {
    ast: CadModelAst;
    parameters: CadResolvedParameter[];
    bindings: CadFieldBinding[];
    dependencies: CadParameterDependency[];
    functions: CadResolvedFunction[];
    calls: CadFunctionCallReceipt[];
    work: CadFunctionWork;
};
