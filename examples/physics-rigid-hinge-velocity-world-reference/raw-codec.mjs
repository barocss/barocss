export const FRAME_KEYS = Object.freeze({ source: 'sourceBodies', angular: 'angularBodies', motor: 'motorBodies', free: 'freeBodies', postContact: 'postContactBodies', projected: 'projectedBodies' });
export const RAW_FIELDS = Object.freeze([['positionM', 3], ['velocityMps', 3], ['orientation', 4], ['angularVelocityRadps', 3]].map(Object.freeze));
function vector(value, size) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== size || Reflect.ownKeys(value).length !== size + 1) throw new Error('World raw vector is invalid');
  return Array.from({ length: size }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) throw new Error('World raw vector is invalid');
    return descriptor.value;
  });
}
export function rawBodies(bodies) {
  if (!Array.isArray(bodies) || ![2, 4].includes(bodies.length) || Reflect.ownKeys(bodies).length !== bodies.length + 1) throw new Error('World raw frame requires two or four bodies');
  const bytes = Buffer.alloc(bodies.length * 104);
  let offset = 0;
  for (let index = 0; index < bodies.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(bodies, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error('World raw frame requires dense bodies');
    for (const [key, size] of RAW_FIELDS) for (const value of vector(descriptor.value[key], size)) { bytes.writeDoubleLE(value, offset); offset += 8; }
  }
  return bytes;
}
export const rawBodiesHex = bodies => rawBodies(bodies).toString('hex');
export function angularCommandRawHex(commands) {
  if (!Array.isArray(commands) || commands.length > 64 || Reflect.ownKeys(commands).length !== commands.length + 1) throw new Error('World raw commands are invalid');
  const bytes = Buffer.alloc(commands.length * 24);
  for (let index = 0; index < commands.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(commands, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error('World raw commands are invalid');
    const command = descriptor.value;
    const key = command.kind === 'torque' ? 'torqueNm' : command.kind === 'angularImpulse' ? 'angularImpulseNms' : null;
    if (key === null) throw new Error('World raw command kind is invalid');
    vector(command[key], 3).forEach((value, component) => bytes.writeDoubleLE(value, index * 24 + component * 8));
  }
  return bytes.toString('hex');
}
// Relative JSON pointers. JSON preserves finite binary64 values except the zero sign.
export function negativeZeroPaths(value, path = '') {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (value === null || typeof value !== 'object') return [];
  const result = [];
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value')) throw new Error('World zero paths require own data');
    result.push(...negativeZeroPaths(descriptor.value, path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1')));
  }
  return result;
}
export function framesRawHex(frames) {
  return Object.fromEntries(Object.entries(FRAME_KEYS).map(([key, field]) => [key, frames?.[field] == null ? null : rawBodiesHex(frames[field])]));
}
