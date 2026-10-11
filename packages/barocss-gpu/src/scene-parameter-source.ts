import { parseAffineSceneAst } from './scene-front.js';
import type { AffineSceneAst, SceneAst, SceneToken, SourceRange } from './scene-front.js';
import { lowerAffineSceneAst } from './affine-scene-source.js';
import type { AffineScene2 } from './affine-scene-source.js';
import type { SceneShaders } from './compiler.js';
import { SceneError } from './scene-types.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';

export type SceneParameterCode = 'INPUT' | 'SYNTAX' | 'TYPE' | 'RANGE' | 'BUDGET' | 'SCENE';
export interface SceneParameterDiagnostic extends SourceRange { code: SceneParameterCode; message: string }
export class SceneParameterSourceError extends Error {
  readonly diagnostics: SceneParameterDiagnostic[];
  constructor(readonly code: SceneParameterCode, diagnostics: SceneParameterDiagnostic[], cause?: unknown) {
    const owned = diagnostics.map(d => ({ code: d.code, message: d.message.slice(0, 1024),
      start: d.start, end: d.end, line: d.line, column: d.column }));
    super(owned.map(d => `${d.line}:${d.column}: ${d.message}`).join('\n').slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SceneParameterSourceError';
    this.diagnostics = freezeGpuData(owned);
  }
}
type Quantity = 'scalar' | 'length' | 'angle';
export interface SceneParameterDeclaration {
  kind: 'parameter'; name: SceneToken; quantity: SceneToken; literal: SceneToken; range: SourceRange;
}
export interface ParameterizedAffineSceneAst {
  schema: 'barocss-gpu-parameterized-affine-scene-ast'; schemaVersion: 0; sourceVersion: 2;
  source: string; header: SceneToken; name: SceneToken; range: SourceRange;
  declarations: (SceneAst['declarations'][number] | SceneParameterDeclaration)[];
  rules: SceneAst['rules'];
}
export interface SceneParameter {
  name: string; quantity: Quantity; unit: 'dimensionless' | 'scene' | 'deg'; value: number;
  definition: SourceRange; uses: SourceRange[];
}
export interface CompiledParameterizedAffineSceneSource {
  readonly format: 'barocss-gpu-parameterized-affine-scene-source'; readonly version: 0;
  readonly profile: 'source2-typed-literal-parameters-v0'; readonly source: string;
  readonly ast: ParameterizedAffineSceneAst; readonly parameters: SceneParameter[];
  readonly scene: AffineScene2; readonly shaders: SceneShaders;
}
const NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;
const REFERENCE = /^\$([A-Za-z_][A-Za-z0-9_-]{0,31})$/;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const NUMERIC_UNIT = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)([A-Za-z_][A-Za-z0-9_-]*)$/;
const SHAPES = ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'];
const RESERVED = new Set(['scene', 'param', 'version', 'background', 'scalar', 'length', 'angle', ...SHAPES]);
type Definition = { declaration: SceneParameterDeclaration; quantity: Quantity; value: number; uses: SourceRange[] };
function fail(code: SceneParameterCode, message: string, range: SourceRange): never {
  throw new SceneParameterSourceError(code, [{ code, message, ...range }]);
}
function sourceRanges(source: string): (start: number, end: number) => SourceRange {
  const newlines: number[] = [];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') newlines.push(i);
  return (start, end) => {
    let low = 0, high = newlines.length;
    while (low < high) { const middle = (low + high) >>> 1; if (newlines[middle] < start) low = middle + 1; else high = middle; }
    return { start, end, line: low + 1, column: start - (low ? newlines[low - 1] : -1) };
  };
}
/** One bounded original-token scan; parentheses are needed only for the new declarations. */
function scan(source: string, range: (start: number, end: number) => SourceRange): SceneToken[] {
  const tokens: SceneToken[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (/\s/.test(source[offset])) { offset++; continue; }
    if (source.startsWith('//', offset)) {
      offset += 2; while (offset < source.length && !/[\r\n\u2028\u2029]/.test(source[offset])) offset++;
      continue;
    }
    if (source.startsWith('/*', offset)) {
      const end = source.indexOf('*/', offset + 2);
      if (end < 0) fail('SYNTAX', 'Unterminated comment', range(offset, source.length));
      offset = end + 2; continue;
    }
    const start = offset;
    if ('{}:;@()'.includes(source[offset])) offset++;
    else while (offset < source.length && !/[\s{}:;@()]/.test(source[offset]) &&
      !source.startsWith('/*', offset) && !source.startsWith('//', offset)) offset++;
    if (tokens.length === 65536) fail('BUDGET', 'Parameterized scene token limit exceeded', range(start, offset));
    tokens.push({ text: source.slice(start, offset), range: range(start, offset) });
  }
  return tokens;
}
function literalValue(quantity: Quantity, literal: SceneToken): number {
  const expected = quantity === 'length' ? 'scene' : quantity === 'angle' ? 'deg' : '';
  const text = literal.text;
  let numeric = text;
  if (expected) {
    if (!text.endsWith(expected) || !NUMBER.test(text.slice(0, -expected.length))) {
      if (NUMBER.test(text) || NUMERIC_UNIT.test(text)) fail('TYPE', `Parameter ${quantity} requires ${expected} units`, literal.range);
      fail('SYNTAX', 'Parameter initializer requires one signed numeric literal', literal.range);
    }
    numeric = text.slice(0, -expected.length);
  } else if (!NUMBER.test(text)) {
    if (NUMERIC_UNIT.test(text)) fail('TYPE', 'Scalar parameter requires a dimensionless literal', literal.range);
    fail('SYNTAX', 'Parameter initializer requires one signed numeric literal', literal.range);
  }
  const value = Number(numeric), maximum = quantity === 'angle' ? 360 : 1000;
  if (!Number.isFinite(value) || Math.abs(value) > maximum) fail('RANGE', `Parameter ${quantity} must be finite within ${maximum}`, literal.range);
  return value === 0 ? 0 : value;
}
function definitions(source: string, tokens: SceneToken[], range: (start: number, end: number) => SourceRange): Definition[] {
  const eof: SceneToken = { text: '', range: range(source.length, source.length) };
  let cursor = 0, phase: 'headers' | 'parameters' | 'objects' = 'headers';
  const peek = () => tokens[cursor] ?? eof;
  const take = () => { const token = peek(); if (cursor < tokens.length) cursor++; return token; };
  const expect = (text: string) => { const token = take(); if (token.text !== text) fail('SYNTAX', `Expected '${text}'`, token.range); return token; };
  const rejectReference = (token: SceneToken) => { if (token.text.includes('$')) fail('TYPE', 'Parameter references require style coefficient slots', token.range); };
  expect('@'); expect('scene'); rejectReference(take()); expect('{');
  const result: Definition[] = [], names = new Map<string, Definition>();
  while (peek().text !== '}') {
    const token = peek();
    if (!token.text) fail('SYNTAX', "Expected '}' to close scene", token.range);
    if (token.text === 'version' || token.text === 'background') {
      if (phase !== 'headers') fail('SYNTAX', 'Scene headers must precede parameters and objects', token.range);
      take(); expect(':');
      while (peek().text !== ';') {
        const value = peek();
        if (!value.text || '{}'.includes(value.text)) fail('SYNTAX', "Expected ';' after header", value.range);
        rejectReference(take());
      }
      expect(';'); continue;
    }
    if (token.text === '@') {
      const start = take();
      if (peek().text !== 'param') fail('SYNTAX', 'Only @param declarations are supported inside this scene profile', peek().range);
      if (phase === 'objects') fail('SYNTAX', 'Parameters must precede object declarations', start.range);
      phase = 'parameters'; take(); const name = take();
      if (!NAME.test(name.text)) fail('SYNTAX', 'Parameter name requires ASCII1..32', name.range);
      if (RESERVED.has(name.text)) fail('TYPE', 'Parameter name is reserved', name.range);
      if (names.has(name.text)) fail('TYPE', 'Duplicate parameter name', name.range);
      if (result.length === 16) fail('BUDGET', 'Scene exceeds16 parameter declarations', name.range);
      expect(':'); const quantity = take();
      if (quantity.text !== 'scalar' && quantity.text !== 'length' && quantity.text !== 'angle') fail('TYPE', 'Parameter quantity requires scalar, length, or angle', quantity.range);
      expect('('); const literal = take(), value = literalValue(quantity.text, literal); expect(')'); const end = expect(';');
      const declaration: SceneParameterDeclaration = { kind: 'parameter', name, quantity, literal, range: range(start.range.start, end.range.end) };
      const definition: Definition = { declaration, quantity: quantity.text, value, uses: [] };
      result.push(definition); names.set(name.text, definition); continue;
    }
    if (SHAPES.includes(token.text)) {
      phase = 'objects'; take(); rejectReference(take()); expect(';'); continue;
    }
    fail('SYNTAX', 'Unsupported scene declaration', token.range);
  }
  expect('}');
  // A new declaration in/after a style is never silently removed by masking.
  for (; cursor < tokens.length; cursor++) if (tokens[cursor].text === '@' && tokens[cursor + 1]?.text === 'param')
    fail('SYNTAX', 'Parameters must be declared before scene objects and styles', tokens[cursor].range);
  return result;
}
function baseWork(ast: AffineSceneAst): number {
  let count = 0;
  for (const declaration of ast.declarations) count += declaration.kind === 'object' ? 1 : 1 + declaration.field.literals.length;
  for (const rule of ast.rules) { count++; for (const field of rule.declarations) count += 1 + field.literals.length; }
  return count;
}
function slot(property: string): Quantity | undefined {
  if (['radius', 'height', 'size', 'translate', 'start', 'end', 'major-radius', 'minor-radius'].includes(property)) return 'length';
  if (['rotate-x', 'rotate-y', 'rotate-z'].includes(property)) return 'angle';
  return property === 'scale' ? 'scalar' : undefined;
}
function delegated<T>(action: () => T, fallback: SourceRange): T {
  try { return action(); } catch (cause) {
    const diagnostics: SceneParameterDiagnostic[] = cause instanceof SceneError
      ? cause.diagnostics.map(d => ({ code: 'SCENE', message: d.message, start: d.start, end: d.end, line: d.line, column: d.column }))
      : [{ code: 'SCENE', message: cause instanceof Error ? cause.message : 'Actual Source2 compiler refused', ...fallback }];
    throw new SceneParameterSourceError('SCENE', diagnostics, cause);
  }
}
/** Count the complete signed representation before copying/final freezing, without a giant joined string. */
function boundedResult(value: unknown, range: SourceRange): void {
  let utf16 = 0, utf8 = 0;
  const append = (text: string) => { utf16 += text.length; utf8 += new TextEncoder().encode(text).length;
    if (utf16 > 2097152 || utf8 > 2097152) fail('BUDGET', 'Complete parameterized scene result exceeds2MiB', range); };
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { append(Object.is(item, -0) ? '-0' : JSON.stringify(item)); return; }
    if (item === null || typeof item !== 'object') { append(JSON.stringify(item)); return; }
    if (Array.isArray(item)) { append('['); item.forEach((child, index) => { if (index) append(','); visit(child); }); append(']'); return; }
    append('{'); Object.entries(item).forEach(([key, child], index) => { if (index) append(','); append(JSON.stringify(key)); append(':'); visit(child); }); append('}');
  };
  visit(value);
}
/** Explicit source-only opt-in; original authored AST and derived Scene2 are separate owned data. */
export function compileParameterizedAffineSceneSource(input: unknown): CompiledParameterizedAffineSceneSource {
  if (typeof input !== 'string') fail('INPUT', 'Complete parameterized scene source must be text', { start: 0, end: 0, line: 1, column: 1 });
  const source = input;
  if (source.length > 65536 || new TextEncoder().encode(source).length > 65536)
    fail('BUDGET', 'Parameterized scene source exceeds64KiB UTF16/UTF8', { start: 0, end: source.length, line: 1, column: 1 });
  const range = sourceRanges(source), tokens = scan(source, range), declared = definitions(source, tokens, range);
  // Indexed UTF16 units are essential: code-point iteration would shift every
  // original range after a surrogate pair in a comment preceding parameters.
  const masked = source.split('');
  for (const definition of declared) for (let i = definition.declaration.range.start; i < definition.declaration.range.end; i++)
    if (!/[\r\n\u2028\u2029]/.test(masked[i])) masked[i] = ' ';
  const base = delegated(() => parseAffineSceneAst(masked.join('')), range(0, 0));
  let work = baseWork(base) + 4 * declared.length, uses = 0;
  if (work > 4096) fail('BUDGET', 'Parameterized scene exceeds4096 cumulative AST work nodes', base.range);
  const byName = new Map(declared.map(definition => [definition.declaration.name.text, definition]));
  const replacements = new Map<SceneToken, string>();
  for (const rule of base.rules) {
    if (rule.selector.text.includes('$')) fail('TYPE', 'Parameter references require style coefficient slots', rule.selector.range);
    for (const field of rule.declarations) {
      if (field.property.text.includes('$')) fail('TYPE', 'Parameter references require style coefficient values', field.property.range);
      for (const token of field.literals) if (token.text.includes('$')) {
        const match = REFERENCE.exec(token.text);
        if (!match) fail('TYPE', 'Parameter reference requires one exact $NAME token', token.range);
        const expected = slot(field.property.text);
        if (!expected) fail('TYPE', 'Parameter references are unsupported in this field', token.range);
        const definition = byName.get(match[1]);
        if (!definition) fail('TYPE', 'Unknown parameter reference', token.range);
        if (definition.quantity !== expected) fail('TYPE', `Parameter ${definition.quantity} cannot fill a ${expected} slot`, token.range);
        if (++uses > 1536) fail('BUDGET', 'Parameterized scene exceeds1536 reference uses', token.range);
        if (++work > 4096) fail('BUDGET', 'Parameterized scene exceeds4096 cumulative AST work nodes', token.range);
        definition.uses.push(token.range);
        replacements.set(token, String(definition.value) + (expected === 'angle' ? 'deg' : ''));
      }
    }
  }
  // Copy only after cumulative work admission. Numeric text is private derived
  // data at the original reference range, never a changed original AST token.
  const resolved: AffineSceneAst = { ...copyGpuData(base), source,
    rules: base.rules.map(rule => ({ ...copyGpuData(rule), declarations: rule.declarations.map(field => ({ ...copyGpuData(field),
      literals: field.literals.map(token => ({ text: replacements.get(token) ?? token.text, range: { ...token.range } })),
    })) })),
  };
  const lowered = delegated(() => lowerAffineSceneAst(resolved), range(0, 0));
  for (const shader of Object.values(lowered.shaders)) if (shader.length > 65536 || new TextEncoder().encode(shader).length > 65536)
    fail('BUDGET', 'Complete parameterized scene shader exceeds64KiB', base.range);
  const ast: ParameterizedAffineSceneAst = { schema: 'barocss-gpu-parameterized-affine-scene-ast', schemaVersion: 0, sourceVersion: 2, source,
    header: base.header, name: base.name, range: base.range,
    declarations: [...base.declarations, ...declared.map(definition => definition.declaration)].sort((a, b) => a.range.start - b.range.start), rules: base.rules };
  const parameters: SceneParameter[] = declared.map(definition => ({ name: definition.declaration.name.text, quantity: definition.quantity,
    unit: definition.quantity === 'length' ? 'scene' : definition.quantity === 'angle' ? 'deg' : 'dimensionless', value: definition.value,
    definition: definition.declaration.range, uses: definition.uses }));
  const result: CompiledParameterizedAffineSceneSource = { format: 'barocss-gpu-parameterized-affine-scene-source', version: 0,
    profile: 'source2-typed-literal-parameters-v0', source, ast, parameters, scene: lowered.scene, shaders: lowered.shaders };
  boundedResult(result, base.range);
  return freezeGpuData(copyGpuData(result));
}
