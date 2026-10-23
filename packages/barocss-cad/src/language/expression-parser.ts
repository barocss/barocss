import type { CadSourceRange } from './source-ast.js';

export type CadCallArgument = { kind: 'named-argument'; name: string; nameRange: CadSourceRange;
  value: CadExpression; range: CadSourceRange };
export type CadCallExpression = { kind: 'call'; functionId: string; functionRange: CadSourceRange;
  arguments: CadCallArgument[]; range: CadSourceRange };

export type CadExpression = { kind: 'number'; value: number; range: CadSourceRange; unit?: 'mm' | 'cm' | 'm'; unitRange?: CadSourceRange }
  | { kind: 'parameter-reference'; id: string; range: CadSourceRange }
  | { kind: 'unary'; operator: '+' | '-'; operand: CadExpression; operatorRange: CadSourceRange; range: CadSourceRange }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: CadExpression; right: CadExpression; operatorRange: CadSourceRange; range: CadSourceRange }
  | { kind: 'group'; expression: CadExpression; range: CadSourceRange }
  | CadCallExpression;

export const CAD_EXPRESSION_LIMITS = Object.freeze({ nodes: 256, depth: 32, aggregateNodes: 32768, literalMagnitude: 1e12 });
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
interface Parsed { expression: CadExpression; depth: number }

/** Original bounded precedence parser. No quantities are evaluated here. */
export function parseCadExpression(cursor: CadExpressionCursor): CadExpression {
  let nodes = 0;
  const depth = (tree: number, ancestors: number) => {
    if (tree + ancestors > CAD_EXPRESSION_LIMITS.depth) cursor.fail('LIMIT', 'Expression exceeds AST depth 32');
  };
  const reserve = () => {
    if (nodes >= CAD_EXPRESSION_LIMITS.nodes) cursor.fail('LIMIT', 'Expression exceeds 256 nodes');
    cursor.reserveNode(); nodes++;
  };
  const consume = (text: string) => {
    cursor.skip(); if (!cursor.source.startsWith(text, cursor.offset())) cursor.fail('SYNTAX', 'Expected ' + text);
    cursor.token(); cursor.advance(text.length);
  };
  const primary = (ancestors: number): Parsed => {
    cursor.skip(); const start = cursor.offset(); depth(1, ancestors);
    if (cursor.source[start] === '(') {
      depth(2, ancestors); reserve(); consume('(');
      const inner = sum(ancestors + 1); consume(')'); depth(inner.depth + 1, ancestors);
      return { expression: { kind: 'group', expression: inner.expression, range: cursor.range(start, cursor.offset()) }, depth: inner.depth + 1 };
    }
    if (cursor.source[start] === '$') {
      reserve(); consume('$');
      // References deliberately do not consume '-', which is subtraction.
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(cursor.offset()));
      if (!match) cursor.fail('SYNTAX', 'Expected parameter identifier');
      cursor.token(); cursor.advance(match[0].length);
      return { expression: { kind: 'parameter-reference', id: match[0], range: cursor.range(start, cursor.offset()) }, depth: 1 };
    }
    if (cursor.allowCalls) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(start));
      if (name) {
        if (name[0].length > 48) cursor.fail('LIMIT', 'Function names exceed 48 characters', start, start + name[0].length);
        reserve(); cursor.token(); cursor.advance(name[0].length);
        const functionRange = cursor.range(start, cursor.offset());
        consume('('); cursor.skip();
        const arguments_: CadCallArgument[] = [], names = new Set<string>();
        let treeDepth = 1;
        if (cursor.source[cursor.offset()] !== ')') while (true) {
          cursor.skip(); const argumentStart = cursor.offset();
          if (arguments_.length >= 4) cursor.fail('LIMIT', 'A call has at most four named arguments', argumentStart);
          const argumentName = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(argumentStart));
          if (!argumentName) cursor.fail('FUNCTION_ARGUMENT', 'A named function argument is required', argumentStart);
          if (argumentName[0].length > 48) cursor.fail('LIMIT', 'Argument names exceed 48 characters', argumentStart, argumentStart + argumentName[0].length);
          cursor.token(); cursor.advance(argumentName[0].length);
          const nameRange = cursor.range(argumentStart, cursor.offset());
          cursor.skip();
          if (cursor.source[cursor.offset()] !== ':') cursor.fail('FUNCTION_ARGUMENT', 'Only named function arguments are supported', argumentStart, cursor.offset());
          if (names.has(argumentName[0])) cursor.fail('FUNCTION_ARGUMENT', 'Duplicate function argument ' + argumentName[0], argumentStart, cursor.offset());
          names.add(argumentName[0]); consume(':');
          cursor.reserveRecord?.();
          const parsed = sum(ancestors + 1);
          treeDepth = Math.max(treeDepth, parsed.depth + 1); depth(treeDepth, ancestors);
          arguments_.push({ kind: 'named-argument', name: argumentName[0], nameRange,
            value: parsed.expression, range: cursor.range(argumentStart, parsed.expression.range.end) });
          cursor.skip(); if (cursor.source[cursor.offset()] !== ',') break;
          consume(','); cursor.skip();
          if (cursor.source[cursor.offset()] === ')') cursor.fail('FUNCTION_ARGUMENT', 'Trailing function argument comma is unsupported');
        }
        consume(')');
        return { expression: { kind: 'call', functionId: name[0], functionRange,
          arguments: arguments_, range: cursor.range(start, cursor.offset()) }, depth: treeDepth };
      }
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(cursor.source.slice(start));
    if (!match) cursor.fail('SYNTAX', 'Expected number, $parameter or parenthesized expression');
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value > CAD_EXPRESSION_LIMITS.literalMagnitude) cursor.fail('VALUE', 'Number magnitude must be finite and at most 1e12', start, start + match[0].length);
    reserve(); cursor.token(); cursor.advance(match[0].length);
    const numberEnd = cursor.offset(); cursor.skip();
    let unit: 'mm' | 'cm' | 'm' | undefined;
    const unitStart = cursor.offset(); let unitEnd = unitStart;
    const suffix = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(unitStart));
    if (suffix) {
      if (suffix[0] !== 'mm' && suffix[0] !== 'cm' && suffix[0] !== 'm') cursor.fail('UNIT', 'Unsupported length unit ' + suffix[0], unitStart, unitStart + suffix[0].length);
      unit = suffix[0]; cursor.token(); cursor.advance(suffix[0].length); unitEnd = cursor.offset();
    }
    const expression: CadExpression = { kind: 'number', value, range: cursor.range(start, unit ? unitEnd : numberEnd) };
    if (unit) { expression.unit = unit; expression.unitRange = cursor.range(unitStart, unitEnd); }
    return { expression, depth: 1 };
  };
  const unary = (ancestors: number): Parsed => {
    cursor.skip(); const start = cursor.offset(), operator = cursor.source[start];
    if (operator !== '+' && operator !== '-') return primary(ancestors);
    depth(2, ancestors); reserve(); consume(operator); const operatorRange = cursor.range(start, start + 1);
    const inner = unary(ancestors + 1); depth(inner.depth + 1, ancestors);
    return { expression: { kind: 'unary', operator, operand: inner.expression, operatorRange, range: cursor.range(start, inner.expression.range.end) }, depth: inner.depth + 1 };
  };
  const binary = (level: 'product' | 'sum', ancestors: number): Parsed => {
    const next = level === 'product' ? unary : product;
    let left = next(ancestors);
    while (true) {
      cursor.skip(); const position = cursor.offset(), operator = cursor.source[position];
      if (!(level === 'product' ? operator === '*' || operator === '/' : operator === '+' || operator === '-')) return left;
      // A left chain increases the actual tree depth even without recursion.
      depth(left.depth + 1, ancestors); reserve(); consume(operator);
      const operatorRange = cursor.range(position, position + 1), right = next(ancestors + 1);
      const treeDepth = Math.max(left.depth, right.depth) + 1; depth(treeDepth, ancestors);
      left = { expression: { kind: 'binary', operator: operator as '+' | '-' | '*' | '/', left: left.expression, right: right.expression, operatorRange, range: cursor.range(left.expression.range.start, right.expression.range.end) }, depth: treeDepth };
    }
  };
  const product = (ancestors: number) => binary('product', ancestors);
  const sum = (ancestors: number) => binary('sum', ancestors);
  return sum(0).expression;
}
