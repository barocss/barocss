export type Vec3 = [number, number, number];
export type RGB = [number, number, number];
export interface SceneObject {
  id: string;
  type: 'sphere' | 'box';
  color: RGB;
  translate: Vec3;
  radius: number;
  /** Full box extents, not half extents. */
  size: Vec3;
}
export interface Scene {
  version: 0;
  name: string;
  background: RGB;
  objects: SceneObject[];
}
export interface SceneDiagnostic {
  message: string;
  line: number;
  column: number;
  start: number;
  end: number;
}
export class SceneError extends Error {
  readonly diagnostics: SceneDiagnostic[];
  constructor(diagnostics: SceneDiagnostic[]) {
    super(diagnostics.map((item) => `${item.line}:${item.column}: ${item.message}`).join('\n'));
    this.name = 'SceneError';
    this.diagnostics = diagnostics;
  }
}
interface Token { text: string; start: number; end: number }
type Property = 'color' | 'translate' | 'radius' | 'size';
interface Declaration { property: Property; value: number | Vec3; token: Token }
interface Rule { selector: Token; declarations: Declaration[] }
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Parse the independent v0 scene language. Offsets are UTF-16; byte limits use UTF-8. */
export function parseScene(source: string): Scene {
  const fail = (message: string, token: Token): never => {
    const before = source.slice(0, token.start);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    throw new SceneError([{ message, line, column: token.start - lastNewline, start: token.start, end: token.end }]);
  };
  if (typeof source !== 'string') {
    throw new SceneError([{ message: 'Source must be a string', line: 1, column: 1, start: 0, end: 0 }]);
  }
  const eof: Token = { text: '', start: source.length, end: source.length };
  if (new TextEncoder().encode(source).length > 65536) fail('Source exceeds 64 KiB UTF-8', { text: '', start: 0, end: source.length });
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    const character = source[offset]!;
    if (/\s/.test(character)) { offset++; continue; }
    if (source.startsWith('/*', offset)) {
      const end = source.indexOf('*/', offset + 2);
      if (end < 0) fail('Unterminated comment', { text: '', start: offset, end: source.length });
      offset = end + 2;
      continue;
    }
    const start = offset;
    if ('{}:;@'.includes(character)) offset++;
    else {
      while (offset < source.length && !/[\s{}:;@]/.test(source[offset]!) && !source.startsWith('/*', offset)) offset++;
    }
    tokens.push({ text: source.slice(start, offset), start, end: offset });
  }
  let cursor = 0;
  const peek = (): Token => tokens[cursor] ?? eof;
  const take = (): Token => { const token = peek(); if (cursor < tokens.length) cursor++; return token; };
  const expect = (text: string): Token => {
    const token = take();
    if (token.text !== text) fail(`Expected '${text}'`, token);
    return token;
  };
  const identifier = (token: Token): string => {
    if (!IDENTIFIER.test(token.text)) fail('Expected an ASCII identifier', token);
    return token.text;
  };
  const rgb = (values: Token[]): RGB => {
    const token = values[0] ?? peek();
    if (values.length !== 1 || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(token.text)) fail('Expected opaque #rgb or #rrggbb color', token);
    const hex = token.text.slice(1);
    const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16) / 255) as RGB;
  };
  const numeric = (token: Token, positive: boolean): number => {
    if (!NUMBER.test(token.text)) fail('Expected a finite numeric scene value', token);
    const value = Number(token.text);
    if (!Number.isFinite(value) || Math.abs(value) > 1000 || (positive && (value <= 0 || Math.fround(value) <= 0))) fail(positive ? 'Dimension must be positive and at most 1000' : 'Coordinate must be finite and within -1000 to 1000', token);
    return Object.is(value, -0) ? 0 : value;
  };
  const valuesUntilSemicolon = (): Token[] => {
    const result: Token[] = [];
    while (peek().text !== ';') {
      if (!peek().text || '{}'.includes(peek().text)) fail("Expected ';' after declaration", peek());
      result.push(take());
    }
    expect(';');
    return result;
  };
  expect('@'); expect('scene');
  const name = identifier(take());
  expect('{');
  const objects: SceneObject[] = [];
  const ids = new Set<string>();
  let versionSeen = false;
  let backgroundSeen = false;
  let background: RGB = [16 / 255, 24 / 255, 32 / 255];
  while (peek().text !== '}') {
    const token = take();
    if (!token.text) fail("Expected '}' to close scene", token);
    if (token.text === 'sphere' || token.text === 'box') {
      const idToken = take();
      if (!idToken.text.startsWith('#')) fail('Expected object #id', idToken);
      const id = identifier({ ...idToken, text: idToken.text.slice(1) });
      if (ids.has(id)) fail(`Duplicate object ID '${id}'`, idToken);
      expect(';');
      ids.add(id);
      objects.push({ id, type: token.text, color: [224 / 255, 128 / 255, 64 / 255], translate: [0, 0, 0], radius: 1, size: [2, 2, 2] });
      if (objects.length > 32) fail('Scene exceeds 32 objects', token);
    } else if (token.text === 'version' || token.text === 'background') {
      expect(':');
      const values = valuesUntilSemicolon();
      if (token.text === 'version') {
        if (versionSeen) fail('Duplicate scene version', token);
        if (values.length !== 1 || values[0]!.text !== '0') fail('Only scene version 0 is supported', values[0] ?? token);
        versionSeen = true;
      } else {
        if (backgroundSeen) fail('Duplicate scene background', token);
        background = rgb(values);
        backgroundSeen = true;
      }
    } else fail('Unsupported scene declaration', token);
  }
  expect('}');
  if (!versionSeen) fail('Scene requires version: 0;', tokens[1] ?? eof);
  const rules: Rule[] = [];
  let declarationCount = 0;
  while (peek().text) {
    const selector = take();
    if (selector.text !== 'sphere' && selector.text !== 'box') {
      if (!selector.text.startsWith('#') || !IDENTIFIER.test(selector.text.slice(1))) fail('Only sphere, box, and #id selectors are supported', selector);
      if (!ids.has(selector.text.slice(1))) fail(`Unknown object ID '${selector.text.slice(1)}'`, selector);
    }
    expect('{');
    const declarations: Declaration[] = [];
    while (peek().text !== '}') {
      const propertyToken = take();
      if (!propertyToken.text) fail("Expected '}' to close style rule", propertyToken);
      const property = propertyToken.text as Property;
      if (!['color', 'translate', 'radius', 'size'].includes(property)) fail('Unsupported style property', propertyToken);
      const targetType = selector.text.startsWith('#') ? objects.find((object) => object.id === selector.text.slice(1))!.type : selector.text;
      if ((property === 'radius' && targetType !== 'sphere') || (property === 'size' && targetType !== 'box')) fail(`Property '${property}' is not supported for ${targetType}`, propertyToken);
      expect(':');
      const values = valuesUntilSemicolon();
      let value: number | Vec3;
      if (property === 'color') value = rgb(values);
      else {
        const count = property === 'radius' ? 1 : 3;
        if (values.length !== count) fail(`Property '${property}' requires ${count} numeric value${count === 1 ? '' : 's'}`, values[0] ?? propertyToken);
        const numbers = values.map((item) => numeric(item, property !== 'translate'));
        value = property === 'radius' ? numbers[0]! : numbers as Vec3;
      }
      declarations.push({ property, value, token: propertyToken });
      declarationCount++;
      if (declarationCount > 512) fail('Styles exceed 512 total declarations', propertyToken);
    }
    expect('}');
    rules.push({ selector, declarations });
    if (rules.length > 128) fail('Styles exceed 128 rules', selector);
  }
  for (const object of objects) {
    const specificity = new Map<Property, number>();
    for (const rule of rules) {
      const score = rule.selector.text === `#${object.id}` ? 1 : rule.selector.text === object.type ? 0 : -1;
      if (score < 0) continue;
      for (const declaration of rule.declarations) {
        if (score < (specificity.get(declaration.property) ?? -1)) continue;
        specificity.set(declaration.property, score);
        if (declaration.property === 'radius') object.radius = declaration.value as number;
        else object[declaration.property] = [...declaration.value as Vec3] as Vec3;
      }
    }
    Object.freeze(object.color); Object.freeze(object.translate); Object.freeze(object.size); Object.freeze(object);
  }
  Object.freeze(background); Object.freeze(objects);
  return Object.freeze({ version: 0, name, background, objects });
}
