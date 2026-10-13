import type { GPUBufferHandle } from './webgpu-platform.js';

/** One buffer, one cleanup attempt per operation even across loss/timeout/late map completion. */
export interface PrimitiveReadbackLease {
  readonly buffer: GPUBufferHandle;
  unmapped: boolean;
  destroyed: boolean;
  /** Retain failures even when owner teardown runs before the readback finally. */
  readonly failures: unknown[];
}

/** Always attempt both operations; preserve failures for the caller to aggregate. */
export function releasePrimitiveReadback(lease: PrimitiveReadbackLease | null): unknown[] {
  if (!lease) return [];
  const failures = lease.failures;
  if (!lease.unmapped) {
    lease.unmapped = true;
    try { lease.buffer.unmap(); } catch (cause) { failures.push(cause); }
  }
  if (!lease.destroyed) {
    lease.destroyed = true;
    try { lease.buffer.destroy(); } catch (cause) { failures.push(cause); }
  }
  return failures.slice();
}
