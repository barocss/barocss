import { parseCadExpression, CAD_EXPRESSION_LIMITS } from './expression-parser.js';
import type { CadExpression } from './expression-parser.js';
import { KernelError } from '../core/barocss-error.js';
export { CAD_EXPRESSION_LIMITS } from './expression-parser.js';
export type { CadExpression, CadCallArgument, CadCallExpression } from './expression-parser.js';

/** UTF-16 offsets, exclusive end, and one-based source coordinates. */
export interface CadSourceRange { start: number; end: number; line: number; column: number; endLine: number; endColumn: number }
export type CadAstValue = CadExpression
  | { kind: 'identifier'; value: string; range: CadSourceRange }
  | { kind: 'reference'; id: string; range: CadSourceRange }
  | { kind: 'array'; items: CadAstValue[]; range: CadSourceRange };
export interface CadAstField { name: string; value: CadAstValue; range: CadSourceRange; nameRange: CadSourceRange }
export interface CadOrdinaryAstDeclaration { kind: 'curve' | 'surface' | 'extrude' | 'parameter'; id: string; range: CadSourceRange; idRange: CadSourceRange; fields: CadAstField[] }
export type CadFormalArgument = { kind: 'formal-argument'; name: string; nameRange: CadSourceRange;
  quantityKind: 'length' | 'scalar'; typeRange: CadSourceRange; defaultExpression: CadExpression | null; range: CadSourceRange };
export type CadFunctionAst = { kind: 'function'; id: string; idRange: CadSourceRange; range: CadSourceRange;
  arguments: CadFormalArgument[]; returnKind: 'length' | 'scalar'; returnTypeRange: CadSourceRange; fields: [CadAstField] };
export type CadAstDeclaration = CadOrdinaryAstDeclaration | CadFunctionAst;
export interface CadModelAst { kind: 'model'; name: string; range: CadSourceRange; nameRange: CadSourceRange; fields: CadAstField[]; declarations: CadAstDeclaration[] }

/** An actual-source parser diagnostic, with no synthetic or partial model. */
/** The source parser's and semantic model's codes. */
export type CadAstCode = 'CYCLE' | 'DEGREE' | 'DIMENSION' | 'DIVISION_ZERO' | 'DUPLICATE' | 'FIELD' | 'FUNCTION_ARGUMENT' | 'FUNCTION_CAPTURE' | 'FUNCTION_RECURSION' | 'FUNCTION_REFERENCE' | 'FUNCTION_TYPE' | 'GEOMETRY' | 'KIND' | 'KNOTS' | 'LIMIT' | 'REFERENCE' | 'SYNTAX' | 'TYPE' | 'UNIT' | 'VALUE' | 'VERSION' | 'WEIGHTS';
export class CadAstError extends KernelError {
  readonly code: CadAstCode;
  readonly detail: string;
  readonly range: CadSourceRange;
  readonly objectId?: string;
  constructor(code: CadAstCode, detail: string, range: CadSourceRange, objectId?: string) {
    super(detail); this.name = 'CadAstError'; this.code = code; this.detail = detail;
    this.range = range; this.objectId = objectId;
  }
}

/** Bounds include rejected duplicate values and stop growth before each push.
 * A maximum legal surface uses 1363 value nodes (1041 poles,273 weights,
 * 46 knots,3 scalar fields). Sixteen use21808 values and at most131
 * model/declaration/field records. Its lexer uses fewer than50000 tokens.
 * Range metadata is inline owned data, not subject to topology's32768 budget.
 */
export const CAD_AST_LIMITS = Object.freeze({ sourceBytes: 262144, values: 65536, nodes: 65536, tokens: 131072, arrayDepth: 3, declarations: 16 });
const curveFields = ['type', 'degree', 'knots', 'control-points', 'weights'];
const surfaceFields = ['type', 'degree-u', 'degree-v', 'knots-u', 'knots-v', 'control-points', 'weights'];
const fieldBounds: Record<string, number[]> = { knots: [70], 'knots-u': [22], 'knots-v': [22], 'control-points': [64, 3], weights: [64] };

/** Parse only source data; unit/types/native geometry belong to semantics. */
export function parseCadAst(source: string, sourceVersion: 0 | 1 | 2 | 3): CadModelAst {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  if (sourceVersion !== 0 && sourceVersion !== 1 && sourceVersion !== 2 && sourceVersion !== 3) throw new TypeError('Source version must be 0, 1, 2 or 3');
  const emptyRange = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
  const utf8BytesWithinLimit = () => {
    let bytes = 0;
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i), next = source.charCodeAt(i + 1);
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; }
      else bytes += 3; // TextEncoder's lone-surrogate replacement has three bytes.
      if (bytes > CAD_AST_LIMITS.sourceBytes) return false;
    }
    return true;
  };
  if (source.length > CAD_AST_LIMITS.sourceBytes || !utf8BytesWithinLimit()) {
    throw new CadAstError('LIMIT', 'Source exceeds 256 KiB', emptyRange);
  }
  // At most sourceBytes+1 line starts; no oversized UTF8 temporary is allocated.
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
  const location = (offset: number) => {
    let low = 0, high = lineStarts.length;
    while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (lineStarts[mid] <= offset) low = mid; else high = mid; }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  const range = (start: number, end: number): CadSourceRange => {
    const first = location(start), last = location(end);
    return { start, end, ...first, endLine: last.line, endColumn: last.column };
  };
  let at = 0, tokens = 0, values = 0, nodes = 0, expressionNodes = 0, geometryCount = 0, parameterCount = 0, functionCount = 0, objectId: string | undefined;
  const declarations: CadAstDeclaration[] = [], modelFields: CadAstField[] = [];
  const fail = (code: CadAstCode, detail: string, start = at, end = Math.min(source.length, start + 1)): never => {
    throw new CadAstError(code, detail, range(start, end), objectId);
  };
  const chargeToken = () => { if (tokens >= CAD_AST_LIMITS.tokens) fail('LIMIT', 'Source exceeds AST token limit'); tokens++; };
  const chargeNode = (isValue = false) => {
    if (nodes >= CAD_AST_LIMITS.nodes || isValue && values >= CAD_AST_LIMITS.values) fail('LIMIT', 'Source exceeds AST value/node limit');
    nodes++; if (isValue) values++;
  };
  const skip = () => {
    while (at < source.length) {
      if (/\s/.test(source[at])) { at++; continue; }
      if (source.startsWith('/*', at)) { const end = source.indexOf('*/', at + 2); if (end < 0) fail('SYNTAX', 'Unterminated comment'); at = end + 2; continue; }
      break;
    }
  };
  const take = (token: string) => { skip(); if (!source.startsWith(token, at)) fail('SYNTAX', 'Expected ' + token); chargeToken(); at += token.length; };
  const ident = (parameter = false): { value: string; range: CadSourceRange } => {
    skip(); const start = at, match = (parameter ? /^[A-Za-z_][A-Za-z0-9_]*/ : /^[A-Za-z_][A-Za-z0-9_-]*/).exec(source.slice(at));
    if (!match) return fail('SYNTAX', 'Expected identifier'); chargeToken(); at += match[0].length;
    return { value: match[0], range: range(start, at) };
  };
  const numeric = (required: boolean): CadAstValue | undefined => {
    skip(); const start = at, match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at));
    if (!match) { if (required) fail('VALUE', 'Expected finite decimal literal'); return undefined; }
    chargeToken(); at += match[0].length; const value = Number(match[0]);
    if (!Number.isFinite(value)) fail('VALUE', 'Number must be finite', required ? start : at, required ? at : Math.min(source.length, at + 1));
    chargeNode(true); return { kind: 'number', value, range: range(start, at) };
  };
  const expression = (): CadExpression => parseCadExpression({
    source, offset: () => at, advance: (count) => { at += count; }, skip,
    allowCalls: sourceVersion === 3, reserveRecord: () => chargeNode(),
    token: chargeToken, range, fail,
    reserveNode: () => {
      if (expressionNodes >= CAD_EXPRESSION_LIMITS.aggregateNodes) fail('LIMIT', 'Model exceeds 32768 aggregate expression nodes');
      chargeNode(true); expressionNodes++;
    },
  });
  const astValue = (bounds: number[], depth = 0, expressions = false): CadAstValue => {
    skip(); const start = at;
    if (source[at] === '[') {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth) fail('DIMENSION', 'Array nesting exceeds field dimension');
      chargeNode(true); take('['); const items: CadAstValue[] = []; skip();
      if (source[at] !== ']') while (true) {
        if (items.length >= bounds[depth]) fail('LIMIT', 'Array exceeds field limit');
        items.push(astValue(bounds, depth + 1, expressions)); skip(); if (source[at] !== ',') break;
        take(','); skip(); if (source[at] === ']') fail('SYNTAX', 'Trailing comma is unsupported');
      }
      take(']'); return { kind: 'array', items, range: range(start, at) };
    }
    if (expressions) return expression();
    const number = numeric(false); if (number) return number;
    const identifier = ident(); chargeNode(true); return { kind: 'identifier', value: identifier.value, range: identifier.range };
  };
  const field = (allowed: string[], surface: boolean, seen: Set<string>, mode: 'literal' | 'model' | 'extrude' | 'parameter' | 'function'): CadAstField => {
    skip(); const start = at, key = ident();
    if (!allowed.includes(key.value)) fail('FIELD', 'Unsupported ' + (sourceVersion === 1 && mode !== 'literal' ? mode === 'model' ? 'model ' : 'extrusion ' : '') + 'field ' + key.value, start, sourceVersion === 1 && mode !== 'literal' ? at : Math.min(source.length, start + 1));
    if (sourceVersion === 1 && mode !== 'literal' && seen.has(key.value)) fail('DUPLICATE', 'Duplicate field ' + key.value, start, at);
    take(':'); let value: CadAstValue;
    if (sourceVersion >= 1 && mode === 'model') {
      if (key.value === 'version') value = numeric(true)!;
      else { const identifier = ident(); chargeNode(true); value = { kind: 'identifier', value: identifier.value, range: identifier.range }; }
    } else if ((sourceVersion >= 2 && mode === 'parameter' && key.value === 'value') || mode === 'function') {
      value = expression();
    } else if (mode === 'extrude') {
      if (key.value === 'curve') { skip(); const refStart = at; take('#'); const ref = ident(); chargeNode(true); value = { kind: 'reference', id: ref.value, range: range(refStart, at) }; }
      else {
        skip(); const vectorStart = at; chargeNode(true); take('[');
        const x = sourceVersion >= 2 ? expression() : numeric(true)!; take(','); const y = sourceVersion >= 2 ? expression() : numeric(true)!; take(','); const z = sourceVersion >= 2 ? expression() : numeric(true)!; take(']');
        value = { kind: 'array', items: [x, y, z], range: range(vectorStart, at) };
      }
    } else {
      const bounds = surface && key.value === 'control-points' ? [16, 16, 3] : surface && key.value === 'weights' ? [16, 16] : fieldBounds[key.value] ?? [];
      value = astValue(bounds, 0, sourceVersion >= 2 && mode === 'literal' && key.value !== 'type');
    }
    take(';');
    if (seen.has(key.value)) fail('DUPLICATE', 'Duplicate field ' + key.value, start, Math.min(source.length, start + 1));
    seen.add(key.value); chargeNode(); return { name: key.value, value, range: range(start, at), nameRange: key.range };
  };
  skip(); const modelStart = at; chargeNode(); take('@');
  if (ident().value !== 'model') fail('SYNTAX', 'Expected @model', sourceVersion === 1 ? 0 : at);
  const modelIdentifier = ident(); take('{');
  const headerNames = new Set<string>(), ids = new Set<string>();
  while (true) {
    skip(); if (source[at] === '}') { take('}'); break; }
    objectId = undefined;
    if (source[at] !== '@') { modelFields.push(field(['version', 'length-unit'], false, headerNames, 'model')); continue; }
    const start = at; take('@'); const kind = ident().value;
    if (!(sourceVersion === 0 ? kind === 'curve' || kind === 'surface' : sourceVersion === 1 ? kind === 'curve' || kind === 'extrude' : kind === 'curve' || kind === 'surface' || kind === 'extrude' || kind === 'parameter' || sourceVersion === 3 && kind === 'function')) fail('KIND', (sourceVersion === 0 ? 'Unsupported object ' : 'Unsupported declaration ') + kind, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at);
    if (kind === 'function' ? functionCount >= 8 : kind === 'parameter' ? parameterCount >= 64 : geometryCount >= CAD_AST_LIMITS.declarations)
      fail('LIMIT', kind === 'function' ? 'Model exceeds 8 functions' : kind === 'parameter' ? 'Model exceeds 64 parameters' : 'Model exceeds 16 geometry declarations', start);
    skip(); const idStart = at; take('#'); const identifier = ident(kind === 'parameter' || kind === 'function'); objectId = identifier.value;
    if (ids.has(objectId)) fail('DUPLICATE', 'Duplicate ID ' + objectId, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at);
    ids.add(objectId);
    if (kind === 'function') {
      if (identifier.value.length > 48) fail('LIMIT', 'Function names exceed 48 characters', identifier.range.start, identifier.range.end);
      functionCount++;
      take('('); skip();
      const arguments_: CadFormalArgument[] = [], formalNames = new Set<string>();
      if (source[at] !== ')') while (true) {
        skip(); const formalStart = at;
        if (arguments_.length >= 4) fail('LIMIT', 'A function has at most four formal arguments', formalStart);
        const name = ident(true);
        if (name.value.length > 48) fail('LIMIT', 'Formal names exceed 48 characters', name.range.start, name.range.end);
        if (formalNames.has(name.value)) fail('FUNCTION_ARGUMENT', 'Duplicate formal argument ' + name.value, name.range.start, name.range.end);
        formalNames.add(name.value); take(':');
        const type = ident();
        if (type.value !== 'length' && type.value !== 'scalar') fail('FUNCTION_TYPE', 'Formal type must be length or scalar', type.range.start, type.range.end);
        const quantityKind = type.value === 'length' ? 'length' : 'scalar';
        chargeNode();
        skip(); let defaultExpression: CadExpression | null = null;
        if (source[at] === '=') { take('='); defaultExpression = expression(); }
        arguments_.push({ kind: 'formal-argument', name: name.value, nameRange: name.range,
          quantityKind, typeRange: type.range, defaultExpression,
          range: range(formalStart, defaultExpression?.range.end ?? type.range.end) });
        skip(); if (source[at] !== ',') break;
        take(','); skip();
        if (source[at] === ')') fail('FUNCTION_ARGUMENT', 'Trailing formal comma is unsupported');
      }
      take(')'); take(':');
      const returnType = ident();
      if (returnType.value !== 'length' && returnType.value !== 'scalar') fail('FUNCTION_TYPE', 'Function return type must be length or scalar', returnType.range.start, returnType.range.end);
      const returnKind = returnType.value === 'length' ? 'length' : 'scalar';
      take('{'); const fields: CadAstField[] = [], seen = new Set<string>();
      while (true) {
        skip(); if (source[at] === '}') { take('}'); break; }
        fields.push(field(['return'], false, seen, 'function'));
      }
      if (fields.length !== 1) fail('FIELD', 'A function requires exactly one return expression', start, at);
      chargeNode();
      declarations.push({ kind: 'function', id: objectId, range: range(start, at), idRange: range(idStart, identifier.range.end),
        arguments: arguments_, returnKind, returnTypeRange: returnType.range, fields: fields as [CadAstField] });
      continue;
    }
    if (kind === 'parameter') parameterCount++; else geometryCount++;
    take('{'); const fields: CadAstField[] = [], seen = new Set<string>();
    while (true) {
      skip(); if (source[at] === '}') { take('}'); break; }
      fields.push(field(kind === 'curve' ? curveFields : kind === 'surface' ? surfaceFields : kind === 'parameter' ? ['type', 'value'] : ['curve', 'vector'], kind === 'surface', seen, kind === 'extrude' ? 'extrude' : kind === 'parameter' ? 'parameter' : 'literal'));
    }
    chargeNode(); declarations.push({ kind: kind as CadOrdinaryAstDeclaration['kind'], id: objectId, range: range(start, at), idRange: range(idStart, identifier.range.end), fields });
  }
  const modelEnd = at; objectId = undefined; skip(); if (at !== source.length) fail('SYNTAX', 'Unexpected content after model');
  return { kind: 'model', name: modelIdentifier.value, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}
