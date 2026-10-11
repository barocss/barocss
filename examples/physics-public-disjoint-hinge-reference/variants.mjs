/** Fixed external identity/order mappings. No candidate or reference imports. */
export const BODY_IDS = Object.freeze(['pairA0', 'pairB0', 'pairA1', 'pairB1']);
export const JOINT_IDS = Object.freeze(['hinge0', 'hinge1']);
export const RENAME_BODY_IDS = Object.freeze(['zLeft', 'aRight', 'yLeft', 'bRight']);
export const RENAME_JOINT_IDS = Object.freeze(['jointZulu', 'jointAlpha']);
export const BODY_ORDER = Object.freeze([3, 0, 1, 2]);
export const BODY_INVERSE = Object.freeze([1, 2, 3, 0]);
export const JOINT_ORDER = Object.freeze([1, 0]);
export const VARIANTS = Object.freeze(['RENAME', 'PERMUTE']);
export const BODY_KEYS = Object.freeze(['id', 'kind', 'shape', 'positionM', 'velocityMps', 'orientation', 'angularVelocityRadps', 'inertiaKgM2']);
export const RAW_FIELDS = Object.freeze([['positionM', 3], ['velocityMps', 3], ['orientation', 4], ['angularVelocityRadps', 3]].map(Object.freeze));
const ID_KEYS = new Set(['id', 'bodyId', 'jointId', 'aId', 'bId']);
const BODY_ARRAYS = new Set(['bodies', 'postContactBodies', 'projectedBodies']);
const JOINT_ARRAYS = new Set(['joints', 'jointReports']);
const RAW_KEYS = new Set(['sourceRawHex', 'postContactRawHex', 'projectedRawHex']);
const INPUT_ROOTS = ['config', 'sourceState', 'postContactBodies'];
const rename = Object.fromEntries([...BODY_IDS, ...JOINT_IDS].map((id, index) => [id, [...RENAME_BODY_IDS, ...RENAME_JOINT_IDS][index]]));
const unrename = Object.fromEntries(Object.entries(rename).map(([a, b]) => [b, a]));

function need(test, message = 'saved hinge variant data is invalid') { if (!test) throw new TypeError(message); }
function variantName(variant) { need(VARIANTS.includes(variant), 'unknown fixed saved hinge variant'); }
function own(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  need(descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'saved hinge data must be own data');
  return descriptor.value;
}
function dense(value, size = value?.length) {
  need(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === size &&
    Reflect.ownKeys(value).length === size + 1, 'saved hinge arrays must be dense');
  return Array.from({ length: size }, (_, index) => own(value, String(index)));
}
export function cloneData(value) {
  if (value === null || typeof value !== 'object') {
    need(value === null || ['string', 'boolean', 'number'].includes(typeof value));
    if (typeof value === 'number') need(Number.isFinite(value));
    return value;
  }
  if (Array.isArray(value)) return dense(value).map(cloneData);
  need(Object.getPrototypeOf(value) === Object.prototype);
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    need(typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key));
    result[key] = cloneData(own(value, key));
  }
  return result;
}
const escapePointer = text => text.replaceAll('~', '~0').replaceAll('/', '~1');
function pointerTokens(path) {
  need(typeof path === 'string' && path.startsWith('/') && !/~(?:[^01]|$)/.test(path), 'negative-zero pointer is invalid');
  return path.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}
export function negativeZeroPaths(value, path = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (value === null || typeof value !== 'object') return [];
  const keys = Array.isArray(value) ? dense(value).map((_, index) => String(index)) : Reflect.ownKeys(value);
  const result = [];
  for (const key of keys) {
    need(typeof key === 'string');
    result.push(...negativeZeroPaths(own(value, key), path + '/' + escapePointer(key)));
  }
  return result;
}
export function restoreNegativeZeroPaths(root, paths) {
  dense(paths);
  need(new Set(paths).size === paths.length, 'negative-zero pointers must be unique');
  for (const path of paths) {
    const parts = pointerTokens(path);
    let parent = root;
    for (const key of parts.slice(0, -1)) {
      need(parent !== null && typeof parent === 'object');
      if (Array.isArray(parent)) need(/^(0|[1-9][0-9]*)$/.test(key));
      parent = own(parent, key);
    }
    need(parent !== null && typeof parent === 'object');
    const key = parts.at(-1), value = own(parent, key);
    need(typeof value === 'number' && value === 0, 'negative-zero pointer must name a numeric zero');
    parent[key] = -0;
  }
  return root;
}

/** Mutate only the three input roots. Do not inspect actual or its pointer list. */
export function restoreInputSigns(request) {
  const paths = own(request, 'negativeZeroPaths');
  for (const key of INPUT_ROOTS) restoreNegativeZeroPaths(own(request, key), own(paths, key));
  return request;
}
export function permuteRawHex(hex, order = BODY_ORDER) {
  need(typeof hex === 'string' && /^[0-9a-f]{832}$/.test(hex), 'raw body frame must be lowercase 416-byte hex');
  need(dense(order, 4).every(index => Number.isInteger(index) && index >= 0 && index < 4) && new Set(order).size === 4);
  // Exactly 104 bytes (208 hex characters) per body; never regenerate raw from JSON.
  return order.map(index => hex.slice(index * 208, (index + 1) * 208)).join('');
}
export function remapNegativeZeroPaths(paths, root, variant, inverse = false) {
  variantName(variant); dense(paths);
  if (variant === 'RENAME') return [...paths];
  need([...INPUT_ROOTS, 'actual'].includes(root));
  // old index -> new index is the inverse of the selected array read order.
  const bodyIndexes = inverse ? BODY_ORDER : BODY_INVERSE;
  return paths.map(path => {
    const parts = pointerTokens(path);
    let at = null, indexes = null;
    if (root === 'postContactBodies') { at = 0; indexes = bodyIndexes; }
    else if (BODY_ARRAYS.has(parts[0])) { at = 1; indexes = bodyIndexes; }
    else if (JOINT_ARRAYS.has(parts[0])) { at = 1; indexes = JOINT_ORDER; }
    if (at !== null) {
      need(/^(0|[1-9][0-9]*)$/.test(parts[at]) && Number(parts[at]) < indexes.length);
      parts[at] = String(indexes[Number(parts[at])]);
    }
    return '/' + parts.map(escapePointer).join('/');
  });
}
function transform(value, variant, inverse, key = '') {
  if (value === null || typeof value !== 'object') {
    if (variant === 'RENAME' && ID_KEYS.has(key) && typeof value === 'string')
      return (inverse ? unrename : rename)[value] ?? value;
    if (variant === 'PERMUTE' && RAW_KEYS.has(key)) return permuteRawHex(value, inverse ? BODY_INVERSE : BODY_ORDER);
    return cloneData(value);
  }
  if (Array.isArray(value)) {
    const items = dense(value).map(item => transform(item, variant, inverse));
    if (variant === 'PERMUTE' && BODY_ARRAYS.has(key)) {
      dense(items, 4); return (inverse ? BODY_INVERSE : BODY_ORDER).map(index => items[index]);
    }
    if (variant === 'PERMUTE' && JOINT_ARRAYS.has(key)) { dense(items, 2); return JOINT_ORDER.map(index => items[index]); }
    return items;
  }
  need(Object.getPrototypeOf(value) === Object.prototype);
  const result = {};
  for (const field of Reflect.ownKeys(value)) {
    need(typeof field === 'string' && !['__proto__', 'constructor', 'prototype'].includes(field));
    result[field] = transform(own(value, field), variant, inverse, field);
  }
  return result;
}
export function mapOriginalToVariant(value, variant) { variantName(variant); return transform(value, variant, false); }
export function restoreOriginalFromVariant(value, variant) { variantName(variant); return transform(value, variant, true); }

/** Verify finite JSON values first; raw alone restores only the zero sign. */
export function restoreBodyRawSigns(bodies, hex) {
  dense(bodies, 4); need(typeof hex === 'string' && /^[0-9a-f]{832}$/.test(hex));
  const bytes = Buffer.from(hex, 'hex');
  let offset = 0;
  for (const body of bodies) for (const [key, length] of RAW_FIELDS) {
    const values = own(body, key); dense(values, length);
    for (let index = 0; index < length; index++) {
      const expected = bytes.readDoubleLE(offset); offset += 8;
      need(Number.isFinite(expected) && typeof values[index] === 'number' && values[index] === expected,
        'saved body JSON/raw numeric values differ');
      if (expected === 0) values[index] = expected;
    }
  }
  return bodies;
}
function publicBody(body) { return Object.fromEntries(BODY_KEYS.map(key => [key, cloneData(own(body, key))])); }
export function makeSavedPhaseRequest(bank, snapshot, variant, actual = null) {
  variantName(variant); need(['FIRST', 'LIMIT', 'FINAL'].includes(snapshot));
  const entry = own(own(bank, 'snapshots'), snapshot), original = cloneData(own(entry, 'originalRequest'));
  // These are historical roots, not the new actual. Keep all original proof objects untouched.
  for (const [root, paths] of Object.entries(original.negativeZeroPaths)) restoreNegativeZeroPaths(original[root], paths);
  restoreBodyRawSigns(original.sourceState.bodies, entry.sourceRawHex);
  restoreBodyRawSigns(original.attempt.frames.postContactBodies, entry.postContactRawHex);
  const inputs = { config: original.config, sourceState: original.sourceState,
    sourceRawHex: entry.sourceRawHex, postContactBodies: original.attempt.frames.postContactBodies.map(publicBody),
    postContactRawHex: entry.postContactRawHex };
  const mapped = mapOriginalToVariant(inputs, variant);
  const request = { version: 1, op: 'saved-postcontact', snapshot, variant, ...mapped,
    actual: cloneData(actual), negativeZeroPaths: {} };
  for (const root of [...INPUT_ROOTS, 'actual']) request.negativeZeroPaths[root] = negativeZeroPaths(request[root]);
  // Independent pointer remapping is kept separate from raw chunk remapping.
  for (const root of INPUT_ROOTS) {
    const remapped = remapNegativeZeroPaths(negativeZeroPaths(inputs[root]), root, variant).sort();
    need(JSON.stringify(remapped) === JSON.stringify([...request.negativeZeroPaths[root]].sort()), 'zero pointer remapping mismatch');
  }
  return request;
}

export function variantReceipt(request) {
  const variant = own(request, 'variant'); variantName(variant);
  return { snapshot: own(request, 'snapshot'), variant, bodyOrder: variant === 'PERMUTE' ? [...BODY_ORDER] : [0, 1, 2, 3],
    bodyInverse: variant === 'PERMUTE' ? [...BODY_INVERSE] : [0, 1, 2, 3],
    jointOrder: variant === 'PERMUTE' ? [...JOINT_ORDER] : [0, 1], bytesPerBody: 104,
    sourceRawHex: own(request, 'sourceRawHex'), postContactRawHex: own(request, 'postContactRawHex'),
    negativeZeroPaths: Object.fromEntries(INPUT_ROOTS.map(root => [root, [...own(own(request, 'negativeZeroPaths'), root)]])) };
}
