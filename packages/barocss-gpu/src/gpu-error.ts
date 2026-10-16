/** A refused GPU input: a scene, packet, frame or option outside its contract. */
export class GPUError extends Error {
  constructor(message: string) { super(message); this.name = 'GPUError'; }
}
export type UpdateResult = { ok: true } | { ok: false; error: Error };
