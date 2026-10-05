import type { Curve, Model, Point, Surface } from './types.js';
import { CadSyntaxError, parseModel, type SourceSpan } from './parser.js';
import { extrudeCurve } from './extrusion.js';

export interface ExtrusionConstruction {
  outputId: string;
  inputId: string;
  operation: 'extrude';
  vector: Point;
  span: SourceSpan;
  referenceSpan: SourceSpan;
}
export interface ConstructionResult {
  sourceVersion: 1;
  model: Model;
  constructions: ExtrusionConstruction[];
}
export class ConstructionSyntaxError extends CadSyntaxError {
  readonly span: SourceSpan;
  constructor(code: string, message: string, source: string, start: number, end: number) {
    super(code, message, source, start);
    this.name = 'ConstructionSyntaxError';
    this.span = { start, end, line: this.line, column: this.column };
  }
}
type Declaration = { kind: 'curve'; id: string; curve: Curve; span: SourceSpan }
  | { kind: 'extrude'; id: string; inputId: string; vector: Point; span: SourceSpan; referenceSpan: SourceSpan };

/** Compile explicitly selected source v1 into the unchanged native geometry v0. */
export function compileConstruction(source: string): ConstructionResult {
  if (typeof source !== 'string') throw new TypeError('Source must be a string');
  if (source.length > 262144 || new TextEncoder().encode(source).length > 262144) {
    throw new ConstructionSyntaxError('LIMIT', 'Source exceeds 256 KiB', '', 0, 0);
  }
  let at = 0;
  const span = (start: number, end: number): SourceSpan => {
    const lines = source.slice(0, start).split('\n');
    return { start, end, line: lines.length, column: lines.at(-1)!.length + 1 };
  };
  const fail: (code: string, message: string, start?: number, end?: number) => never = (code, message, start = at, end = Math.min(source.length, start + 1)) => {
    throw new ConstructionSyntaxError(code, message, source, start, end);
  };
  const skip = () => {
    while (at < source.length) {
      if (/\s/.test(source[at])) { at++; continue; }
      if (source.startsWith('/*', at)) {
        const end = source.indexOf('*/', at + 2);
        if (end < 0) fail('SYNTAX', 'Unterminated comment');
        at = end + 2; continue;
      }
      break;
    }
  };
  const take = (token: string) => { skip(); if (!source.startsWith(token, at)) fail('SYNTAX', 'Expected ' + token); at += token.length; };
  const ident = () => {
    skip(); const match = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(source.slice(at));
    if (!match) return fail('SYNTAX', 'Expected identifier');
    at += match[0].length; return match[0];
  };
  const number = () => {
    skip(); const start = at;
    const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(at));
    if (!match) return fail('VALUE', 'Expected finite decimal literal');
    at += match[0].length; const value = Number(match[0]);
    if (!Number.isFinite(value)) fail('VALUE', 'Number must be finite', start, at);
    return value;
  };
  take('@'); if (ident() !== 'model') fail('SYNTAX', 'Expected @model', 0);
  const name = ident(); take('{');
  const metadata = new Map<string, { value: number | string; span: SourceSpan }>();
  const ids = new Set<string>();
  const declarations: Declaration[] = [];
  while (true) {
    skip(); if (source[at] === '}') { at++; break; }
    if (source[at] !== '@') {
      const start = at, key = ident();
      if (key !== 'version' && key !== 'length-unit') fail('FIELD', 'Unsupported model field ' + key, start, at);
      if (metadata.has(key)) fail('DUPLICATE', 'Duplicate field ' + key, start, at);
      take(':'); const value = key === 'version' ? number() : ident(); take(';');
      metadata.set(key, { value, span: span(start, at) }); continue;
    }
    if (declarations.length >= 16) fail('LIMIT', 'Model exceeds 16 declarations');
    const start = at; take('@'); const kind = ident();
    if (kind !== 'curve' && kind !== 'extrude') fail('KIND', 'Unsupported declaration ' + kind, start, at);
    take('#'); const id = ident();
    if (ids.has(id)) fail('DUPLICATE', 'Duplicate ID ' + id, start, at);
    ids.add(id); take('{');
    if (kind === 'curve') {
      // Preserve the original v0 parser and its exact curve semantics. This
      // compact wrapper is no larger than the required v1 model header.
      let depth = 1;
      while (depth > 0) {
        if (at >= source.length) fail('SYNTAX', 'Unterminated curve declaration', start, source.length);
        if (source.startsWith('/*', at)) {
          const end = source.indexOf('*/', at + 2);
          if (end < 0) fail('SYNTAX', 'Unterminated comment');
          at = end + 2; continue;
        }
        if (source[at] === '{') depth++;
        else if (source[at] === '}') depth--;
        at++;
      }
      const prefix = '@model x{version:0;length-unit:mm;';
      let curve: Curve;
      try { curve = parseModel(prefix + source.slice(start, at) + '}').objects[0] as Curve; }
      catch (error) {
        if (error instanceof CadSyntaxError) {
          const position = Math.max(start, Math.min(at - 1, start + error.offset - prefix.length));
          fail(error.code, 'Invalid curve ' + id + ': ' + error.message, position);
        }
        throw error;
      }
      declarations.push({ kind, id, curve, span: span(start, at) }); continue;
    }
    let inputId: string | undefined, vector: Point | undefined, referenceSpan: SourceSpan | undefined;
    const fields = new Set<string>();
    while (true) {
      skip(); if (source[at] === '}') { at++; break; }
      const fieldStart = at, key = ident();
      if (key !== 'curve' && key !== 'vector') fail('FIELD', 'Unsupported extrusion field ' + key, fieldStart, at);
      if (fields.has(key)) fail('DUPLICATE', 'Duplicate field ' + key, fieldStart, at);
      fields.add(key); take(':');
      if (key === 'curve') {
        skip(); const referenceStart = at; take('#'); inputId = ident();
        referenceSpan = span(referenceStart, at);
      } else {
        take('['); const x = number(); take(','); const y = number(); take(','); const z = number(); take(']');
        vector = [x, y, z];
      }
      take(';');
    }
    if (inputId === undefined || vector === undefined || referenceSpan === undefined) fail('FIELD', 'Extrusion requires curve and vector fields', start, at);
    declarations.push({ kind: 'extrude', id, inputId, vector, referenceSpan, span: span(start, at) });
  }
  skip(); if (at !== source.length) fail('SYNTAX', 'Unexpected content after model');
  const version = metadata.get('version'), unit = metadata.get('length-unit');
  if (version?.value !== 1) fail('VERSION', 'compileConstruction requires version: 1', version?.span.start ?? 0);
  if (unit?.value !== 'mm') fail('UNIT', 'length-unit: mm is required', unit?.span.start ?? 0);
  if (!declarations.length) fail('GEOMETRY', 'Model must contain geometry', 0);
  const byId = new Map(declarations.map(declaration => [declaration.id, declaration]));
  const objects: (Curve | Surface)[] = [], constructions: ExtrusionConstruction[] = [];
  for (const declaration of declarations) {
    if (declaration.kind === 'curve') { objects.push(declaration.curve); continue; }
    const input = byId.get(declaration.inputId);
    if (!input || input.kind !== 'curve') fail('REFERENCE', 'Reference ' + declaration.inputId + ' must name a declared curve', declaration.referenceSpan.start, declaration.referenceSpan.end);
    let surface: Surface;
    try { surface = extrudeCurve(input.curve, { id: declaration.id, vector: declaration.vector }); }
    catch (error) { return fail('GEOMETRY', (error as Error).message, declaration.span.start, declaration.span.end); }
    objects.push(surface);
    constructions.push({ outputId: declaration.id, inputId: declaration.inputId, operation: 'extrude',
      vector: [...declaration.vector], span: { ...declaration.span }, referenceSpan: { ...declaration.referenceSpan } });
  }
  return { sourceVersion: 1, model: { name, version: 0, lengthUnit: 'mm', objects }, constructions };
}
