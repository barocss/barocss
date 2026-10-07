import type { SketchCircleLengthDefinition, SketchCircleLengthParameter, SketchCircleGraphFeature, SketchCircleResolvedParameter } from './sketch-circle-feature-graph.js';

// Shared original circle admission and resolution. This module is internal.
export function check(condition: boolean, label: string, path: string, detail: string): asserts condition { if (!condition) throw new Error((label + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 1024)); }

export function guard<T>(label: string, work: () => T): T {
  try { return work(); } catch (error) { const message = error instanceof Error ? error.message : 'invalid document/geometry'; throw new Error((message.startsWith(label) ? message : label + ': ' + message).slice(0, 1024), { cause: error }); }
}

export function snapshot(input: unknown, label: string, rootPath: string): unknown {
  let remaining = 8192;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 10, label, path, 'input exceeds8192 own values/depth10');
    if (typeof value === 'number') { check(Number.isFinite(value), label, path, 'finite data required'); return value; }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') { check(value.length <= 128, label, path, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', label, path, 'plain numeric/string/boolean/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, label, path, 'foreign prototype unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 65 : 12) && keys.every(key => typeof key === 'string' && key.length <= 128), label, path, 'bounded own fields required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), label, path, 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, label, path, 'dense bounded arrays required');
      const output: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), label, path, 'sparse/extra array field'); output.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return output;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, rootPath);
}

export function record(value: unknown, fields: string[], label: string, path: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), label, path, 'own-data record required'); const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), label, path, 'exact fields required: ' + fields.join(',')); return data;
}

export function identifier(value: unknown, label: string, path: string): string { check(typeof value === 'string' && value.length <= 64 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), label, path, 'ASCII ID1..64 required'); return value; }

export function length(value: unknown, label: string, path: string): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000, label, path, 'finite fractional length within±10000mm required'); return value;
}

export function definition(input: unknown, label: string, path: string): SketchCircleLengthDefinition {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), label, path, 'length definition record required');
  const kind = (input as Record<string, unknown>).kind;
  check(kind === 'literal' || kind === 'offset', label, path + '.kind', 'literal/offset length definition required');
  const data = record(input, kind === 'literal' ? ['kind', 'valueMM'] : ['kind', 'parameterId', 'offsetMM'], label, path);
  return kind === 'literal' ? { kind, valueMM: length(data.valueMM, label, path + '.valueMM') }
    : { kind, parameterId: identifier(data.parameterId, label, path + '.parameterId'), offsetMM: length(data.offsetMM, label, path + '.offsetMM') };
}

export function admitParameter(input: unknown, label: string, path: string): SketchCircleLengthParameter {
  const p = record(input, ['id', 'type', 'definition'], label, path), pid = identifier(p.id, label, path + '.id');
  check(p.type === 'length', label + ' parameter #' + pid, path + '.type', 'length parameter required');
  return { id: pid, type: 'length', definition: definition(p.definition, label + ' parameter #' + pid, path + '.definition') };
}

export function admitFeature(input: unknown, label: string, path: string): SketchCircleGraphFeature {
  const f = record(input, ['id', 'kind', 'profileId', 'shellId', 'distanceParameterId', 'suppressed'], label, path), fid = identifier(f.id, label, path + '.id'), owner = label + ' feature #' + fid;
  const profileId = identifier(f.profileId, owner, path + '.profileId'), shellId = identifier(f.shellId, owner, path + '.shellId');
  check(f.kind === 'xy-circle-extrude' && typeof f.suppressed === 'boolean' && profileId.length <= 48 && shellId.length <= 48, owner, path, 'circle extrusion/boolean suppression and used profile/shell IDs<=48 required');
  return { id: fid, kind: 'xy-circle-extrude', profileId, shellId, distanceParameterId: identifier(f.distanceParameterId, owner, path + '.distanceParameterId'), suppressed: f.suppressed };
}

export function resolve(parameters: SketchCircleLengthParameter[], label: string): SketchCircleResolvedParameter[] {
  const byId = new Map(parameters.map(p => [p.id, p])), pending = new Set(parameters.map(p => p.id)), values = new Map<string, number>(), result: SketchCircleResolvedParameter[] = [];
  for (const p of parameters) if (p.definition.kind === 'offset') {
    check(byId.has(p.definition.parameterId), label + ' parameter #' + p.id, '$.parameters.definition.parameterId #' + p.definition.parameterId, 'missing length dependency');
    check(p.definition.parameterId !== p.id, label + ' parameter #' + p.id, '$.parameters.definition.parameterId', 'self dependency #' + p.id + ' -> #' + p.id);
  }
  while (pending.size) {
    // Choose the first authored currently ready node, including newly ready nodes.
    const p = parameters.find(p => pending.has(p.id) && (p.definition.kind === 'literal' || values.has(p.definition.parameterId)));
    if (!p) {
      const chain: string[] = []; let current = parameters.find(p => pending.has(p.id))!.id;
      while (!chain.includes(current)) { chain.push(current); const d = byId.get(current)!.definition; check(d.kind === 'offset', label, '$.parameters', 'unresolved dependency must be an offset'); current = d.parameterId; }
      const cycle = [...chain.slice(chain.indexOf(current)), current];
      check(false, label, '$.parameters', 'cyclic length dependency: ' + cycle.map(id => '#' + id).join(' -> '));
    }
    const d = p.definition, valueMM = d.kind === 'literal' ? d.valueMM : values.get(d.parameterId)! + d.offsetMM;
    length(valueMM, label + ' parameter #' + p.id, '$.parameters.resolvedValueMM');
    values.set(p.id, valueMM); pending.delete(p.id);
    result.push({ id: p.id, type: 'length', valueMM, dependencyIds: d.kind === 'offset' ? [d.parameterId] : [], order: result.length });
  }
  return result;
}

export function admitJSONText(text: string, label: string): void {
  const stack: { kind: '{' | '['; keys: Set<string>; count: number; nextValue: boolean }[] = [];
  let remaining = 8192;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue;
    const parent = stack.at(-1);
    if (parent?.kind === '[' && parent.nextValue && c !== ']' && c !== ',') { check(++parent.count <= 64, label, '$text[' + i + ']', 'JSON array exceeds64 elements'); parent.nextValue = false; }
    if (c === '"' || c === '{' || c === '[' || c === '-' || /[0-9tfn]/.test(c)) check(--remaining >= 0, label, '$text', 'JSON exceeds8192 lexical values/keys');
    if (c === '"') {
      let end = i + 1;
      for (; end < text.length; end++) { if (text[end] === '\\') end++; else if (text[end] === '"') break; }
      check(end < text.length && end - i <= 769, label, '$text[' + i + ']', 'unterminated/oversized JSON string');
      const value: unknown = JSON.parse(text.slice(i, end + 1)); check(typeof value === 'string' && value.length <= 128, label, '$text[' + i + ']', 'JSON string exceeds128 characters');
      let next = end + 1; while (next < text.length && /[ \n\r\t]/.test(text[next])) next++;
      if (text[next] === ':') {
        check(parent?.kind === '{', label, '$text[' + i + ']', 'JSON object key outside object');
        check(!parent.keys.has(value), label, '$text[' + i + ']', 'duplicate JSON field ' + value); parent.keys.add(value);
        check(parent.keys.size <= 12, label, '$text[' + i + ']', 'JSON object exceeds12 fields');
      }
      i = end; continue;
    }
    if (c === '{' || c === '[') { stack.push({ kind: c, keys: new Set(), count: 0, nextValue: true }); check(stack.length <= 10, label, '$text[' + i + ']', 'JSON nesting exceeds admitted depth10'); }
    else if (c === '}' || c === ']') { check(parent?.kind === (c === '}' ? '{' : '['), label, '$text[' + i + ']', 'unbalanced JSON container'); stack.pop(); }
    else if (c === ',' && parent?.kind === '[') parent.nextValue = true;
    else if (c === '-' || /[0-9tfn]/.test(c)) { while (i + 1 < text.length && !/[ \n\r\t,}\]]/.test(text[i + 1])) i++; }
  }
  check(stack.length === 0, label, '$text', 'unclosed JSON container');
}
