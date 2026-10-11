import {createHash} from 'node:crypto';

export const RAW_FIELDS = Object.freeze([
  ['positionM', 3], ['velocityMps', 3], ['orientation', 4], ['angularVelocityRadps', 3],
].map(Object.freeze));
export const FRAME_LABELS = Object.freeze({
  source: 'sourceBodies', angular: 'angularBodies', motor: 'motorBodies',
  free: 'freeBodies', projected: 'projectedBodies',
});

function dataVector(value, size) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
    value.length !== size || Reflect.ownKeys(value).length !== size + 1) {
    throw new Error('hinge raw vector is invalid');
  }
  const values = [];
  for (let index = 0; index < size; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
      typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) {
      throw new Error('hinge raw vector is invalid');
    }
    values.push(descriptor.value);
  }
  return values;
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function rawBodies(bodies) {
  if (!Array.isArray(bodies) || bodies.length !== 2 || !Object.hasOwn(bodies, 0) ||
    !Object.hasOwn(bodies, 1)) throw new Error('hinge raw frame requires two bodies');
  const bytes = Buffer.alloc(208);
  let offset = 0;
  for (const body of bodies) {
    for (const [field, size] of RAW_FIELDS) {
      for (const value of dataVector(body[field], size)) {
        bytes.writeDoubleLE(value, offset); offset += 8;
      }
    }
  }
  return bytes;
}

export function rawCommands(commands) {
  if (!Array.isArray(commands) || commands.length > 64 ||
    Reflect.ownKeys(commands).length !== commands.length + 1 ||
    !Array.from({length: commands.length}, (_, i) => Object.hasOwn(commands, i)).every(Boolean)) {
    throw new Error('hinge raw commands are invalid');
  }
  const bytes = Buffer.alloc(commands.length * 24);
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    const key = command.kind === 'angularImpulse' ? 'angularImpulseNms' :
      command.kind === 'torque' ? 'torqueNm' : null;
    if (!key) throw new Error('hinge raw command kind is invalid');
    const values = dataVector(command[key], 3);
    for (let component = 0; component < 3; component++) bytes.writeDoubleLE(values[component], index * 24 + component * 8);
  }
  return bytes;
}

export function framesToRaw(frames) {
  return Object.fromEntries(Object.entries(FRAME_LABELS).map(([label, field]) =>
    [label, frames?.[field] == null ? null : rawBodies(frames[field])]));
}

export function zeroWitness(bytes) {
  const zeros = [];
  for (let offset = 0; offset < bytes.length; offset += 8) {
    const value = bytes.readDoubleLE(offset);
    if (value === 0) zeros.push({scalarIndex: offset / 8, negative: Object.is(value, -0)});
  }
  return zeros;
}

export function rawEvidence(bytes) {
  return bytes === null ? null : {bytes: bytes.length, sha256: digest(bytes),
    hex: bytes.toString('hex'), zeroWitness: zeroWitness(bytes)};
}

// JSON round-trips every finite binary64 number except the sign of zero.
// These paths preserve that sign for non-body fields, including report/work.
export function negativeZeroPaths(value, path = '$') {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (value === null || typeof value !== 'object') return [];
  const paths = [];
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new Error('hinge zero witness requires own data');
    }
    paths.push(...negativeZeroPaths(descriptor.value, path + '.' + key));
  }
  return paths;
}
