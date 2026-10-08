import { PhysicsError } from '../types.js';

/** CAD proxy's bundled root entry can carry a distinct Error constructor. */
export function throwCadFluidError(error: unknown): never {
  if (error instanceof PhysicsError) throw error;
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown };
    if ((candidate.code === 'INVALID_CONFIG' || candidate.code === 'STALE_SOURCE')
      && typeof candidate.message === 'string') {
      throw new PhysicsError(candidate.code, candidate.message);
    }
  }
  throw error;
}
