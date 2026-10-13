import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from './boolean-extrusion-feature-graph.js';
import type {
  BooleanExtrusionFeatureGraphV0,
  BooleanExtrusionFeatureGraphOptions,
  BooleanExtrusionFeatureGraphResult,
} from './boolean-extrusion-feature-graph.js';
import { createNativeExtrusionPreviewSessionV1 } from './native-extrusion-preview-session-v1.js';
import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import { copyCadData } from './data-copy.js';

/**
 * A ticket is an unforgeable in-memory identity, NOT a persisted authorization.
 * It becomes stale when a newer preview is prepared or any preview is accepted.
 */
export type NativeExtrusionPreviewTicketV1 = Readonly<{ readonly kind: 'native-extrusion-preview-token' }>;
export interface NativeExtrusionPreparedV1 {
  readonly token: NativeExtrusionPreviewTicketV1;
  readonly graphId: string;
  readonly featureId: string;
  readonly baseRevision: number;
  readonly previewDistanceMM: number;
  /** Caller-owned copy, never the private candidate used for acceptance. */
  readonly geometry: CoplanarFaceBooleanExtrusionResult;
}
export interface NativeExtrusionAcceptedV1 {
  readonly graphId: string;
  readonly revision: number;
  readonly executionMode: 'full-native-rebuild-on-accept';
  readonly accepted: BooleanExtrusionFeatureGraphResult;
}

export interface NativeExtrusionPreviewAcceptanceSessionV1 {
  readonly schema: 'barocss-cad-native-extrusion-preview-acceptance-session';
  readonly version: 1;
  readonly graphId: string;
  readonly featureId: string;
  getAccepted(): BooleanExtrusionFeatureGraphResult;
  prepareDistanceMM(distanceMM: number): NativeExtrusionPreparedV1;
  accept(token: NativeExtrusionPreviewTicketV1): NativeExtrusionAcceptedV1;
  cancel(token: NativeExtrusionPreviewTicketV1): void;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => same(value, b[index]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length &&
      keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
  }
  return Object.is(a, b);
}

/**
 * Separate preview and authoritative full-rebuild acceptance. This is an
 * ephemeral Native-only bridge; no editor integration or durable CAS is claimed.
 */
export function createNativeExtrusionPreviewAcceptanceV1(
  document: BooleanExtrusionFeatureGraphV0,
  options: BooleanExtrusionFeatureGraphOptions,
  featureId: string,
): NativeExtrusionPreviewAcceptanceSessionV1 {
  // This accepted state is reconstructed once, then retained as private data.
  // The preview v1 session separately owns its own fully evaluated region.
  let accepted = evaluateBooleanExtrusionFeatureGraph(document, options);
  const preview = createNativeExtrusionPreviewSessionV1(accepted.document, accepted.options, featureId);
  if (preview.graphId !== accepted.document.id || preview.acceptedRevision !== accepted.document.revision)
    throw new TypeError('Native preview and acceptance identities differ');
  const graphId = accepted.document.id;
  let prepared: {
    token: NativeExtrusionPreviewTicketV1;
    baseRevision: number;
    distanceMM: number;
    geometry: CoplanarFaceBooleanExtrusionResult;
  } | null = null;

  const stale = (): never => { throw new Error('STALE native extrusion preview token or revision'); };
  return Object.freeze({
    schema: 'barocss-cad-native-extrusion-preview-acceptance-session' as const,
    version: 1 as const,
    graphId,
    featureId,
    getAccepted(): BooleanExtrusionFeatureGraphResult {
      return copyCadData(accepted);
    },
    prepareDistanceMM(distanceMM: number): NativeExtrusionPreparedV1 {
      // Full native provider admission, not an approximation or UI mesh.
      const geometry = preview.previewDistanceMM(distanceMM);
      const token = Object.freeze({ kind: 'native-extrusion-preview-token' as const });
      const baseRevision = accepted.document.revision;
      prepared = { token, baseRevision, distanceMM, geometry: copyCadData(geometry) };
      return { token, graphId, featureId, baseRevision, previewDistanceMM: distanceMM,
        geometry: copyCadData(geometry) };
    },
    accept(token: NativeExtrusionPreviewTicketV1): NativeExtrusionAcceptedV1 {
      const candidate = prepared;
      if (!candidate || token !== candidate.token || candidate.baseRevision !== accepted.document.revision)
        return stale();
      // Refuse revision overflow and never change accepted state on failure.
      const revision = candidate.baseRevision + 1;
      if (!Number.isSafeInteger(revision) || revision > 1_000_000_000)
        throw new RangeError('Native preview revision budget exceeded');
      const next = updateBooleanExtrusionFeatureGraph(accepted, {
        expectedRevision: candidate.baseRevision,
        revision,
        parameterEdits: [], faceEdits: [], booleanEdits: [],
        distanceEdits: [{ featureId, definition: { kind: 'literal', valueMM: candidate.distanceMM } }],
      });
      const leaf = next.features.find(row => row.featureId === featureId);
      if (!leaf || leaf.kind !== 'normal-extrusion' || !same(leaf.evaluation, candidate.geometry))
        throw new Error('Native preview/full rebuild geometry mismatch; accepted state retained');
      accepted = next;
      prepared = null;
      return { graphId, revision: next.document.revision,
        executionMode: 'full-native-rebuild-on-accept', accepted: copyCadData(next) };
    },
    cancel(token: NativeExtrusionPreviewTicketV1): void {
      if (!prepared || prepared.token !== token) return stale();
      prepared = null;
    },
  });
}
