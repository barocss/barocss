// A public entry's refusal of a caller's input (R7.3a batch 3). The shared validators under these entries (the mesh
// packet's, the camera's, the lighting's, the scene's records) stay plain RangeErrors and Errors: the engine and native
// paths wrap them as the cause of their own coded classes, and flows check that cause. The package's entries are
// wrapped once instead (index.ts), so a caller of one gets a coded BarocssError, the plain one kept as its cause.
import { BarocssError, refusalText } from './barocss-error.js';

export type GpuInputErrorCode =
  | 'MESH_PACKET_INVALID' | 'MESH_OPTIONS_INVALID' | 'MESH_INVALID' | 'CAMERA_INVALID'
  | 'PRIMITIVE_FRAME_INVALID' | 'FACE_PREVIEW_INVALID' | 'SCENE_INVALID';

export class GpuInputError extends BarocssError {
  constructor(readonly code: GpuInputErrorCode, message: string, cause?: unknown) {
    super(code, message, cause === undefined ? undefined : { cause });
    this.name = 'GpuInputError';
  }
}

/** A plain Error recoded as a GpuInputError of `code` (its words, the plain one its cause); a BarocssError as it is. */
export function recoded(code: GpuInputErrorCode, error: Error): Error {
  return error instanceof BarocssError ? error : new GpuInputError(code, refusalText(error), error);
}

/** `fn` as a public entry: a plain Error it throws becomes a GpuInputError of `code`, with the same words and the plain
 *  one as its cause. A BarocssError, and anything that isn't an Error, passes through. Made once per entry, at load. */
export function refusing<F extends (...args: never[]) => unknown>(code: GpuInputErrorCode, fn: F): F {
  return function entry(this: unknown, ...args: Parameters<F>): ReturnType<F> {
    try { return fn.apply(this, args) as ReturnType<F>; }
    catch (error) {
      throw error instanceof Error ? recoded(code, error) : error;
    }
  } as F;
}
