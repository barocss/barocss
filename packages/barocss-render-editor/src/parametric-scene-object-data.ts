import {RenderEditorError} from './errors.js';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RenderEditorError('DOCUMENT_INPUT', message);
}

/** Bounded command arguments only. Aliases are copied independently; provider validation stays with commands. */
export function copyRenderParametricObjectData(input: unknown): unknown {
  const active = new Set<object>(), encoder = new TextEncoder();
  let values = 0;
  const text = (value: string) => {
    check(value.length <= 512 && encoder.encode(value).length <= 512, 'Object argument key or string exceeds 512 UTF-16 units or UTF-8 bytes.');
    return value;
  };
  const copy = (value: unknown, depth: number): unknown => {
    check(++values <= 256 && depth <= 8, 'Object argument exceeds its value or depth limit.');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return text(value);
    if (typeof value === 'number') { check(Number.isFinite(value), 'Object argument numbers must be finite.'); return value; }
    check(typeof value === 'object' && !active.has(value), 'Object arguments refuse unsupported or cyclic values.');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      'Object arguments require ordinary records and arrays.');
    active.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, 'length');
        check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0 && length.value <= 16,
          'Object argument array exceeds 16 entries.');
        const keys = Reflect.ownKeys(value);
        check(keys.length === length.value + 1 && keys.every(key => key === 'length' || typeof key === 'string'
          && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value), 'Object argument arrays must be dense without extra fields.');
        return Array.from({length: length.value}, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          check(descriptor && 'value' in descriptor && descriptor.enumerable, 'Object argument array entries require own enumerable data.');
          return copy(descriptor.value, depth + 1);
        });
      }
      const keys = Reflect.ownKeys(value);
      check(keys.length <= 16, 'Object argument record exceeds 16 fields.');
      return Object.fromEntries(keys.map(key => {
        check(typeof key === 'string', 'Object argument symbol fields are unsupported.');
        text(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        check(descriptor && 'value' in descriptor && descriptor.enumerable, 'Object argument record fields require own enumerable data.');
        return [key, copy(descriptor.value, depth + 1)];
      }));
    } finally { active.delete(value); }
  };
  try { return copy(input, 0); }
  catch (cause) {
    if (cause instanceof RenderEditorError) throw cause;
    const error = new RenderEditorError('DOCUMENT_INPUT', 'Object argument own-data inspection failed.');
    Object.defineProperty(error, 'cause', {value: cause, configurable: true}); throw error;
  }
}
