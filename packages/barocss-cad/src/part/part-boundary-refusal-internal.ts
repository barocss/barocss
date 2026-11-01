// Private part-evaluation adapter for D417's proved binding and proof-budget refusals.
import { KernelError } from '../core/barocss-error.js';
type BoundaryRefusal = KernelError & { readonly code: 'GEOMETRY' | 'CAPABILITY' };
export function boundaryBindingRefusal(cause: unknown): BoundaryRefusal | null {
  if (!(cause instanceof KernelError)) return null;
  if (cause.details?.source !== 'brep-boundary-binding') return null;
  if (cause.code !== 'GEOMETRY' && cause.code !== 'CAPABILITY') return null;
  return cause as BoundaryRefusal;
}
