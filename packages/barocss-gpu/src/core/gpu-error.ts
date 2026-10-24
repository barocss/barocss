import { BarocssError } from './barocss-error.js';
/** A refused GPU input: a scene, packet, frame or option outside its contract. */
export class GPUError extends BarocssError {
  constructor(message: string) { super('gpu', message); this.name = 'GPUError'; }
}
/** (R7.3a: what it refuses with is a BarocssError, the package's one refusal shape.) */
export type UpdateResult = { ok: true } | { ok: false; error: BarocssError };
