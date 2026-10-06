/** UTF-16 offsets, exclusive end, and one-based source coordinates. */
export interface CadSourceRange { start: number; end: number; line: number; column: number; endLine: number; endColumn: number }
export type CadAstValue = { kind: 'number'; value: number; range: CadSourceRange }
  | { kind: 'identifier'; value: string; range: CadSourceRange }
  | { kind: 'reference'; id: string; range: CadSourceRange }
  | { kind: 'array'; items: CadAstValue[]; range: CadSourceRange };
export interface CadAstField { name: string; value: CadAstValue; range: CadSourceRange; nameRange: CadSourceRange }
export interface CadAstDeclaration { kind: 'curve' | 'surface' | 'extrude'; id: string; range: CadSourceRange; idRange: CadSourceRange; fields: CadAstField[] }
export interface CadModelAst { kind: 'model'; name: string; range: CadSourceRange; nameRange: CadSourceRange; fields: CadAstField[]; declarations: CadAstDeclaration[] }
export interface LegacyCurveAstError { start: number; end: number; innerOffset: number; innerMessage: string }

/** Internal compatibility evidence; no partial model is adopted by the compiler. */
export class CadAstError extends Error {
  readonly code: string;
  readonly detail: string;
  readonly range: CadSourceRange;
  readonly objectId?: string;
  readonly legacyCurve?: LegacyCurveAstError;
  readonly completedDeclarations: CadAstDeclaration[];
  readonly modelFields: CadAstField[];
  readonly modelName: string;
  constructor(code: string, detail: string, range: CadSourceRange, context: {
    objectId?: string; legacyCurve?: LegacyCurveAstError; completedDeclarations: CadAstDeclaration[]; modelFields: CadAstField[]; modelName: string;
  }) {
    super(detail); this.name = 'CadAstError'; this.code = code; this.detail = detail; this.range = range;
    this.objectId = context.objectId; this.legacyCurve = context.legacyCurve;
    this.completedDeclarations = [...context.completedDeclarations]; this.modelFields = [...context.modelFields]; this.modelName = context.modelName;
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
const prefix = '@model x{version:0;length-unit:mm;';
const fieldBounds: Record<string, number[]> = { knots: [70], 'knots-u': [22], 'knots-v': [22], 'control-points': [64, 3], weights: [64] };

/** Parse only source data; unit/types/native geometry belong to semantics. */
export function parseCadAst(source: string, sourceVersion: 0 | 1): CadModelAst {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  if (sourceVersion !== 0 && sourceVersion !== 1) throw new TypeError('Source version must be 0 or 1');
  const emptyRange = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
  const utf8BytesWithinLimit = (start = 0, end = source.length, extraBytes = 0) => {
    let bytes = extraBytes;
    for (let i = start; i < end; i++) {
      const code = source.charCodeAt(i), next = i + 1 < end ? source.charCodeAt(i + 1) : NaN;
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++; }
      else bytes += 3; // TextEncoder's lone-surrogate replacement has three bytes.
      if (bytes > CAD_AST_LIMITS.sourceBytes) return false;
    }
    return true;
  };
  if (source.length > CAD_AST_LIMITS.sourceBytes || !utf8BytesWithinLimit()) {
    throw new CadAstError('LIMIT', 'Source exceeds 256 KiB', emptyRange, { completedDeclarations: [], modelFields: [], modelName: '' });
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
  let at = 0, tokens = 0, values = 0, nodes = 0, modelName = '', objectId: string | undefined;
  const declarations: CadAstDeclaration[] = [], modelFields: CadAstField[] = [];
  let virtual: { start: number; end: number } | undefined;
  const fail = (code: string, detail: string, start = at, end = Math.min(source.length, start + 1)): never => {
    let legacyCurve: LegacyCurveAstError | undefined;
    if (virtual) {
      const innerOffset = prefix.length + start - virtual.start;
      const innerSource = prefix + source.slice(virtual.start, virtual.end) + '}';
      const lines = innerSource.slice(0, innerOffset).split('\n');
      const innerMessage = `${code} at ${lines.length}:${lines.at(-1)!.length + 1}: ${detail}`;
      legacyCurve = { ...virtual, innerOffset, innerMessage };
      start = Math.max(virtual.start, Math.min(virtual.end - 1, start)); end = Math.min(source.length, start + 1);
    }
    throw new CadAstError(code, detail, range(start, end), { objectId, legacyCurve, completedDeclarations: declarations, modelFields, modelName });
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
  const ident = (): { value: string; range: CadSourceRange } => {
    skip(); const start = at, match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(source.slice(at));
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
  const astValue = (bounds: number[], depth = 0): CadAstValue => {
    skip(); const start = at;
    if (source[at] === '[') {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth) fail('DIMENSION', 'Array nesting exceeds field dimension');
      chargeNode(true); take('['); const items: CadAstValue[] = []; skip();
      if (source[at] !== ']') while (true) {
        if (items.length >= bounds[depth]) fail('LIMIT', 'Array exceeds field limit');
        items.push(astValue(bounds, depth + 1)); skip(); if (source[at] !== ',') break;
        take(','); skip(); if (source[at] === ']') fail('SYNTAX', 'Trailing comma is unsupported');
      }
      take(']'); return { kind: 'array', items, range: range(start, at) };
    }
    const number = numeric(false); if (number) return number;
    const identifier = ident(); chargeNode(true); return { kind: 'identifier', value: identifier.value, range: identifier.range };
  };
  const field = (allowed: string[], surface: boolean, seen: Set<string>, mode: 'literal' | 'model' | 'extrude'): CadAstField => {
    skip(); const start = at, key = ident();
    if (!allowed.includes(key.value)) fail('FIELD', 'Unsupported ' + (sourceVersion === 1 && mode !== 'literal' ? mode === 'model' ? 'model ' : 'extrusion ' : '') + 'field ' + key.value, start, sourceVersion === 1 && mode !== 'literal' ? at : Math.min(source.length, start + 1));
    if (sourceVersion === 1 && mode !== 'literal' && seen.has(key.value)) fail('DUPLICATE', 'Duplicate field ' + key.value, start, at);
    take(':'); let value: CadAstValue;
    if (sourceVersion === 1 && mode === 'model') {
      if (key.value === 'version') value = numeric(true)!;
      else { const identifier = ident(); chargeNode(true); value = { kind: 'identifier', value: identifier.value, range: identifier.range }; }
    } else if (mode === 'extrude') {
      if (key.value === 'curve') { skip(); const refStart = at; take('#'); const ref = ident(); chargeNode(true); value = { kind: 'reference', id: ref.value, range: range(refStart, at) }; }
      else {
        skip(); const vectorStart = at; chargeNode(true); take('[');
        const x = numeric(true)!; take(','); const y = numeric(true)!; take(','); const z = numeric(true)!; take(']');
        value = { kind: 'array', items: [x, y, z], range: range(vectorStart, at) };
      }
    } else {
      const bounds = surface && key.value === 'control-points' ? [16, 16, 3] : surface && key.value === 'weights' ? [16, 16] : fieldBounds[key.value] ?? [];
      value = astValue(bounds);
    }
    take(';');
    if (seen.has(key.value)) fail('DUPLICATE', 'Duplicate field ' + key.value, start, Math.min(source.length, start + 1));
    seen.add(key.value); chargeNode(); return { name: key.value, value, range: range(start, at), nameRange: key.range };
  };
  skip(); const modelStart = at; chargeNode(); take('@');
  if (ident().value !== 'model') fail('SYNTAX', 'Expected @model', sourceVersion === 1 ? 0 : at);
  const modelIdentifier = ident(); modelName = modelIdentifier.value; take('{');
  const headerNames = new Set<string>(), ids = new Set<string>();
  while (true) {
    skip(); if (source[at] === '}') { take('}'); break; }
    objectId = undefined;
    if (source[at] !== '@') { modelFields.push(field(['version', 'length-unit'], false, headerNames, 'model')); continue; }
    if (declarations.length >= CAD_AST_LIMITS.declarations) fail('LIMIT', sourceVersion === 0 ? 'Model exceeds 16 objects' : 'Model exceeds 16 declarations');
    const start = at; take('@'); const kind = ident().value;
    if (!(sourceVersion === 0 ? kind === 'curve' || kind === 'surface' : kind === 'curve' || kind === 'extrude')) fail('KIND', (sourceVersion === 0 ? 'Unsupported object ' : 'Unsupported declaration ') + kind, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at);
    skip(); const idStart = at; take('#'); const identifier = ident(); objectId = identifier.value;
    if (ids.has(objectId)) fail('DUPLICATE', 'Duplicate ID ' + objectId, start, sourceVersion === 0 ? Math.min(source.length, start + 1) : at);
    ids.add(objectId); take('{'); const fields: CadAstField[] = [], seen = new Set<string>();
    if (sourceVersion === 1 && kind === 'curve') {
      // Legacy v1 balances the raw curve block before parsing it in a virtual
      // v0 model. This bounded linear scan preserves that diagnostic precedence.
      let scan = at, depth = 1;
      while (depth > 0) {
        if (scan >= source.length) fail('SYNTAX', 'Unterminated curve declaration', start, source.length);
        if (source.startsWith('/*', scan)) { const end = source.indexOf('*/', scan + 2); if (end < 0) fail('SYNTAX', 'Unterminated comment', scan); scan = end + 2; continue; }
        if (source[scan] === '{') depth++; else if (source[scan] === '}') depth--; scan++;
      }
      virtual = { start, end: scan };
      // The former v1 entry parsed this exact virtual v0 source. Its header can
      // overflow even when a malformed outer model fits the256KiB limit.
      if (!utf8BytesWithinLimit(start, scan, prefix.length + 1)) {
        throw new CadAstError('LIMIT', 'Source exceeds 256 KiB', range(start, Math.min(source.length, start + 1)), {
          objectId, completedDeclarations: declarations, modelFields, modelName,
          legacyCurve: { start, end: scan, innerOffset: 0, innerMessage: 'LIMIT at 1:1: Source exceeds 256 KiB' },
        });
      }
    }
    while (true) {
      skip(); if (source[at] === '}') { take('}'); break; }
      fields.push(field(kind === 'curve' ? curveFields : kind === 'surface' ? surfaceFields : ['curve', 'vector'], kind === 'surface', seen, kind === 'extrude' ? 'extrude' : 'literal'));
    }
    virtual = undefined; chargeNode(); declarations.push({ kind: kind as CadAstDeclaration['kind'], id: objectId, range: range(start, at), idRange: range(idStart, identifier.range.end), fields });
  }
  const modelEnd = at; objectId = undefined; skip(); if (at !== source.length) fail('SYNTAX', 'Unexpected content after model');
  return { kind: 'model', name: modelName, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}
