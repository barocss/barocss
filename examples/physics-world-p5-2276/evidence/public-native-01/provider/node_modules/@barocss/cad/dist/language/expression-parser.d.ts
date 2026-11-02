import type { CadSourceRange } from './source-ast.js';
export type CadCallArgument = {
    kind: 'named-argument';
    name: string;
    nameRange: CadSourceRange;
    value: CadExpression;
    range: CadSourceRange;
};
export type CadCallExpression = {
    kind: 'call';
    functionId: string;
    functionRange: CadSourceRange;
    arguments: CadCallArgument[];
    range: CadSourceRange;
};
export type CadExpression = {
    kind: 'number';
    value: number;
    range: CadSourceRange;
    unit?: 'mm' | 'cm' | 'm';
    unitRange?: CadSourceRange;
} | {
    kind: 'parameter-reference';
    id: string;
    range: CadSourceRange;
} | {
    kind: 'unary';
    operator: '+' | '-';
    operand: CadExpression;
    operatorRange: CadSourceRange;
    range: CadSourceRange;
} | {
    kind: 'binary';
    operator: '+' | '-' | '*' | '/';
    left: CadExpression;
    right: CadExpression;
    operatorRange: CadSourceRange;
    range: CadSourceRange;
} | {
    kind: 'group';
    expression: CadExpression;
    range: CadSourceRange;
} | CadCallExpression;
export declare const CAD_EXPRESSION_LIMITS: Readonly<{
    nodes: 256;
    depth: 32;
    aggregateNodes: 32768;
    literalMagnitude: 1000000000000;
}>;
/** Callbacks belong to the original parser, never to authored source. */
export interface CadExpressionCursor {
    source: string;
    offset(): number;
    advance(count: number): void;
    skip(): void;
    token(): void;
    reserveNode(): void;
    /** Source3 only; callers retain legacy grammar when omitted or false. */
    allowCalls?: boolean;
    reserveRecord?(): void;
    range(start: number, end: number): CadSourceRange;
    fail(code: string, detail: string, start?: number, end?: number): never;
}
/** Original bounded precedence parser. No quantities are evaluated here. */
export declare function parseCadExpression(cursor: CadExpressionCursor): CadExpression;
