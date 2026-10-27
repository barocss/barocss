import { validateAxisBoxSolid } from '../core/box-solid.js';
import { qualifyStoredPlateHoleSolid } from '../stored-plate-hole-solid.js';
import type { OwnPlateCircularHoleBundle } from '../own-plate-circular-hole.js';

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

export type KnownTopologyKind = 'wire' | 'sheet' | 'shell' | 'solid';
export type KnownTopologyCheck = 'incidence' | 'orientation' | 'trim' | 'closure';
export type KnownSolidRefusalReason = 'invalid-request' | 'unsupported-kind' | 'unsupported-family' | 'native-validation';

export type KnownSolidRequest =
  | { readonly kind?: 'solid'; readonly family: 'exact-axis-box-solid-v0'; readonly source: unknown }
  | { readonly kind?: 'solid'; readonly family: 'restricted-stored-rational-plate-hole-solid'; readonly source: OwnPlateCircularHoleBundle }
  | { readonly kind: 'wire' | 'sheet' | 'shell'; readonly source?: unknown; readonly family?: string };

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
      readonly requestedKind: KnownTopologyKind | 'unknown';
      readonly reason: KnownSolidRefusalReason;
      /** These checks are not certified by this facade after refusal. */
      readonly notCertifiedChecks: readonly KnownTopologyCheck[];
      readonly code: string;
      readonly detail: string;
    };

const NOT_CERTIFIED_CHECKS = ['incidence', 'orientation', 'trim', 'closure'] as const;

function tag(request: object, key: 'kind' | 'family'): unknown {
  const field = Object.getOwnPropertyDescriptor(request, key);
  return field && 'value' in field ? field.value : undefined;
}

function source(request: object): unknown {
  const field = Object.getOwnPropertyDescriptor(request, 'source');
  return field && 'value' in field ? field.value : undefined;
}

function refused(
  requestedKind: KnownTopologyKind | 'unknown', family: KnownSolidFamily | 'unsupported',
  reason: KnownSolidRefusalReason, code: string, detail: string,
): Extract<KnownSolidQualification, { status: 'refused' }> {
  return { status: 'refused', requestedKind, family, reason, notCertifiedChecks: [...NOT_CERTIFIED_CHECKS], code, detail };
}

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
    return refused('unknown', 'unsupported', 'invalid-request', 'INVALID_REQUEST', 'Tagged native topology request required');
  }
  const kind = tag(request, 'kind');
  if (kind === 'wire' || kind === 'sheet' || kind === 'shell') {
    return refused(kind, 'unsupported', 'unsupported-kind', `UNSUPPORTED_${kind.toUpperCase()}`,
      `${kind} incidence, orientation, trim and closure qualification is not implemented`);
  }
  if (kind !== undefined && kind !== 'solid') {
    return refused('unknown', 'unsupported', 'unsupported-kind', 'UNSUPPORTED_KIND', 'No native validator for requested topology kind');
  }
  const family = tag(request, 'family');
  if (family === 'exact-axis-box-solid-v0') {
    try {
      return {
        status: 'certified', kind: 'solid', family,
        method: 'exact-safe-integer', nativeReport: validateAxisBoxSolid(source(request)),
      };
    } catch (error) {
      const { code, detail } = diagnostic(error);
      return refused('solid', family, 'native-validation', code, detail);
    }
  }
  if (family === 'restricted-stored-rational-plate-hole-solid') {
    try {
      return {
        status: 'certified', kind: 'solid', family,
        method: 'stored-rational-family-proof',
        nativeReport: qualifyStoredPlateHoleSolid(source(request) as OwnPlateCircularHoleBundle).certificate,
      };
    } catch (error) {
      const { code, detail } = diagnostic(error);
      return refused('solid', family, 'native-validation', code, detail);
    }
  }
  return refused('solid', 'unsupported', 'unsupported-family', 'UNSUPPORTED_FAMILY',
    'No qualifying native Solid validator for requested family');
}
