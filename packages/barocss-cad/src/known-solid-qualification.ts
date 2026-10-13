import { validateAxisBoxSolid } from './box-solid.js';
import { qualifyStoredPlateHoleSolid } from './stored-plate-hole-solid.js';
import type { OwnPlateCircularHoleBundle } from './own-plate-circular-hole.js';

/**
 * Additive, restricted family-aware native Solid qualification facade.
 * Never infer Solid validity from sampled preview meshes.
 *
 * "certified" describes only the named native family and its native report.
 * It is NOT a general B-Rep validator or arbitrary Solid certificate.
 */
export type KnownSolidFamily =
  | 'exact-axis-box-solid-v0'
  | 'restricted-stored-rational-plate-hole-solid';

export type KnownSolidRequest =
  | { readonly family: 'exact-axis-box-solid-v0'; readonly source: unknown }
  | { readonly family: 'restricted-stored-rational-plate-hole-solid'; readonly source: OwnPlateCircularHoleBundle };

export type KnownSolidQualification =
  | {
      readonly status: 'certified';
      readonly kind: 'solid';
      readonly family: KnownSolidFamily;
      readonly method: 'exact-safe-integer' | 'stored-rational-family-proof';
      readonly nativeReport: ReturnType<typeof validateAxisBoxSolid> | ReturnType<typeof qualifyStoredPlateHoleSolid>['certificate'];
    }
  | {
      readonly status: 'refused';
      readonly family: KnownSolidFamily | 'unsupported';
      readonly code: string;
      readonly detail: string;
    };

function diagnostic(error: unknown): { code: string; detail: string } {
  if (error !== null && typeof error === 'object') {
    const value = error as { code?: unknown; message?: unknown };
    return {
      code: typeof value.code === 'string' ? value.code.slice(0, 64) : 'NATIVE_VALIDATION_FAILED',
      detail: typeof value.message === 'string' ? value.message.slice(0, 1024) : 'Native validation refused',
    };
  }
  return { code: 'NATIVE_VALIDATION_FAILED', detail: 'Native validation refused' };
}

/**
 * A discriminated request chooses the authoritative native validator.
 * Do not accept arbitrary family names as proof of geometric membership.
 */
export function qualifyKnownSolid(request: KnownSolidRequest): KnownSolidQualification {
  if (request === null || typeof request !== 'object') {
    return { status: 'refused', family: 'unsupported', code: 'INVALID_REQUEST', detail: 'Tagged native Solid request required' };
  }
  if (request.family === 'exact-axis-box-solid-v0') {
    try {
      return {
        status: 'certified', kind: 'solid', family: request.family,
        method: 'exact-safe-integer', nativeReport: validateAxisBoxSolid(request.source),
      };
    } catch (error) {
      return { status: 'refused', family: request.family, ...diagnostic(error) };
    }
  }
  if (request.family === 'restricted-stored-rational-plate-hole-solid') {
    try {
      return {
        status: 'certified', kind: 'solid', family: request.family,
        method: 'stored-rational-family-proof',
        nativeReport: qualifyStoredPlateHoleSolid(request.source).certificate,
      };
    } catch (error) {
      return { status: 'refused', family: request.family, ...diagnostic(error) };
    }
  }
  return { status: 'refused', family: 'unsupported', code: 'UNSUPPORTED_FAMILY', detail: 'No qualifying native Solid validator for requested family' };
}
