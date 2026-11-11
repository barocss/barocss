// Studio scales raw STEP coordinates to millimetres using the declared length unit.
import { MM_PER_FOOT, MM_PER_INCH } from '../util/units';
import { refusal } from './refusal';
export interface StepUnit { name: string; to: number; declared: boolean }

const SI: Record<string, number> = { '': 1000, MILLI: 1, CENTI: 10, DECI: 100, KILO: 1e6, MICRO: 1e-3 };
const NAMED: Record<string, number> = { INCH: MM_PER_INCH, FOOT: MM_PER_FOOT, MM: 1, MILLIMETRE: 1, CM: 10, METRE: 1000 };
const LABEL: Record<string, string> = { '': 'metres', MILLI: 'millimetres', CENTI: 'centimetres', DECI: 'decimetres', KILO: 'kilometres', MICRO: 'micrometres' };

function* lengthUnitStatements(text: string): Iterable<string> {
  let start = 0;
  let hasLength = false;
  // Skip comments and quoted strings before looking for statement separators or entity names.
  for (const { 0: token, index } of text.matchAll(/\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*(?:'|$)|;|\bLENGTH_UNIT\b/gi)) {
    if (token === ';') {
      if (hasLength) yield text.slice(start, index);
      start = index + 1;
      hasLength = false;
    } else if (token.toUpperCase() === 'LENGTH_UNIT') hasLength = true;
  }
  if (hasLength) yield text.slice(start);
}

function lengthUnitComponents(statement: string) {
  const tokens = (statement.match(/\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|#\d+|\.[A-Z0-9_]+\.|[A-Z_][A-Z0-9_]*|\S/gi) ?? [])
    .filter(token => !token.startsWith('/*'));
  if (!/^#\d+$/.test(tokens[0] ?? '') || tokens[1] !== '=' || tokens[2] !== '(') return;
  let depth = 1;
  let length = false;
  let conversionName: string | undefined;
  let siPrefix: string | undefined;
  for (let i = 3; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '(') depth++;
    if (token === ')') depth--;
    if (depth === 0) break;
    if (depth !== 1 || tokens[i + 1] !== '(') continue;
    switch (token.toUpperCase()) {
      case 'LENGTH_UNIT':
        length = tokens[i + 2] === ')';
        break;
      case 'CONVERSION_BASED_UNIT': {
        const name = tokens[i + 2];
        if (name?.startsWith("'")) conversionName = name.slice(1, -1).replace(/''/g, "'").trim();
        break;
      }
      case 'SI_UNIT': {
        const prefix = tokens[i + 2];
        if (tokens[i + 3] !== ',' || tokens[i + 4]?.toUpperCase() !== '.METRE.' || tokens[i + 5] !== ')') break;
        if (prefix === '$') siPrefix = '';
        else if (/^\.\w+\.$/.test(prefix ?? '')) siPrefix = prefix.slice(1, -1).toUpperCase();
        break;
      }
    }
  }
  if (length) return { conversionName, siPrefix };
}

export function stepLengthUnit(text: string): StepUnit {
  let named: StepUnit | undefined;
  let si: StepUnit | undefined;
  // Check every declaration before returning a factor. Unit selection still applies to the whole file.
  for (const statement of lengthUnitStatements(text)) {
    const components = lengthUnitComponents(statement);
    if (!components) continue;
    const { conversionName, siPrefix } = components;
    if (conversionName !== undefined) {
      const key = conversionName.toUpperCase();
      if (!Object.hasOwn(NAMED, key)) {
        throw refusal('NOT_READ', 'STEP declares an unsupported conversion-based length unit ' + (conversionName || '(empty name)') + '.');
      }
      named ??= { name: key === 'INCH' ? 'inches' : key === 'FOOT' ? 'feet' : key.toLowerCase(), to: NAMED[key], declared: true };
    }
    if (siPrefix !== undefined) {
      if (!Object.hasOwn(SI, siPrefix)) throw refusal('NOT_READ', 'STEP declares an unsupported SI length prefix ' + siPrefix + '. The file is not read as millimetres.');
      si ??= { name: LABEL[siPrefix], to: SI[siPrefix], declared: true };
    }
  }
  return named ?? si ?? { name: 'millimetres', to: 1, declared: false };
}
