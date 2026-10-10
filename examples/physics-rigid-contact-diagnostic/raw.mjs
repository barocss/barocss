import { createHash } from 'node:crypto';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function fields(states, ids) {
  const bytes = Buffer.alloc(states.length * ids.length * 13 * 8);
  let offset = 0;
  for (const state of states) for (const id of ids) {
    const body = state.bodies.find(body => body.id === id);
    for (const value of [...body.positionM, ...body.velocityMps, ...body.orientation, ...body.angularVelocityRadps]) {
      if (!Number.isFinite(value)) throw new Error('nonfinite trace field');
      bytes.writeDoubleLE(value, offset);
      offset += 8;
    }
  }
  return bytes;
}
