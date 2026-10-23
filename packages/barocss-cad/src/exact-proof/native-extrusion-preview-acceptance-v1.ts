import { evaluateBooleanExtrusionFeatureGraph, updateBooleanExtrusionFeatureGraph } from '../boolean-extrusion-feature-graph.js';
import type {
  BooleanExtrusionFeatureGraphV0,
  BooleanExtrusionFeatureGraphOptions,
  BooleanExtrusionFeatureGraphResult,
} from '../boolean-extrusion-feature-graph.js';
import { extrudeCoplanarFaceBoolean } from '../coplanar-face-boolean-extrusion.js';
import type { CoplanarFaceBooleanExtrusionResult } from '../coplanar-face-boolean-extrusion.js';
import { copyCadData } from '../data-copy.js';
import { same } from '../structural-equality.js';

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
  dispose(): void;
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
  // Evaluate and privately own the entire native graph only once at creation.
  // Neither this private region nor its owning options are returned to callers.
  let accepted: BooleanExtrusionFeatureGraphResult | null = evaluateBooleanExtrusionFeatureGraph(document, options);
  if (typeof featureId !== 'string' || featureId.length === 0 || featureId.length > 48)
    throw new TypeError('Existing bounded native extrusion feature ID required');
  const leaf = accepted.document.features.find(feature => feature.id === featureId);
  if (!leaf || leaf.kind !== 'normal-extrusion')
    throw new RangeError('Existing native extrusion leaf required');
  const region = accepted.features.find(row => row.featureId === leaf.regionFeatureId);
  if (!region || region.kind !== 'coplanar-boolean')
    throw new TypeError('Previously evaluated owned Boolean region required');
  const regionFeatureId = region.featureId;
  let privateRegion: typeof region.evaluation | null = region.evaluation;
  let privateOptions: typeof leaf.options | null = { ...leaf.options };
  let disposed = false;
  const live = (): void => { if (disposed) throw new Error('DISPOSED native extrusion preview session'); };
  const previewDistanceMM = (distanceMM: number): CoplanarFaceBooleanExtrusionResult => {
    live();
    if (typeof distanceMM !== 'number' || !Number.isFinite(distanceMM) ||
        distanceMM <= 0 || distanceMM > 10000)
      throw new RangeError('Finite native extrusion preview distance in (0,10000] mm required');
    // Only the extrusion is newly evaluated for a preview. Its existing
    // native builder still validates the retained private Boolean region.
    return copyCadData(extrudeCoplanarFaceBoolean(privateRegion!, { ...privateOptions!, distanceMM }));
  };
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
      live();
      return copyCadData(accepted!);
    },
    prepareDistanceMM(distanceMM: number): NativeExtrusionPreparedV1 {
      live();
      // Full native provider admission, not an approximation or UI mesh.
      const geometry = previewDistanceMM(distanceMM);
      const token = Object.freeze({ kind: 'native-extrusion-preview-token' as const });
      const baseRevision = accepted!.document.revision;
      prepared = { token, baseRevision, distanceMM, geometry: copyCadData(geometry) };
      return { token, graphId, featureId, baseRevision, previewDistanceMM: distanceMM,
        geometry: copyCadData(geometry) };
    },
    accept(token: NativeExtrusionPreviewTicketV1): NativeExtrusionAcceptedV1 {
      live();
      const candidate = prepared;
      if (!candidate || token !== candidate.token || candidate.baseRevision !== accepted!.document.revision)
        return stale();
      // Refuse revision overflow and never change accepted state on failure.
      const revision = candidate.baseRevision + 1;
      if (!Number.isSafeInteger(revision) || revision > 1_000_000_000)
        throw new RangeError('Native preview revision budget exceeded');
      const next = updateBooleanExtrusionFeatureGraph(accepted!, {
        expectedRevision: candidate.baseRevision,
        revision,
        parameterEdits: [], faceEdits: [], booleanEdits: [],
        distanceEdits: [{ featureId, definition: { kind: 'literal', valueMM: candidate.distanceMM } }],
      });
      const rebuiltRegion = next.features.find(row => row.featureId === regionFeatureId);
      if (!rebuiltRegion || rebuiltRegion.kind !== 'coplanar-boolean' ||
          !same(rebuiltRegion.evaluation, privateRegion))
        throw new Error('Native preview region changed during full rebuild; accepted state retained');
      const rebuiltLeaf = next.features.find(row => row.featureId === featureId);
      if (!rebuiltLeaf || rebuiltLeaf.kind !== 'normal-extrusion' ||
          !same(rebuiltLeaf.evaluation, candidate.geometry))
        throw new Error('Native preview/full rebuild geometry mismatch; accepted state retained');
      accepted = next;
      prepared = null;
      return { graphId, revision: next.document.revision,
        executionMode: 'full-native-rebuild-on-accept', accepted: copyCadData(next) };
    },
    cancel(token: NativeExtrusionPreviewTicketV1): void {
      live();
      if (!prepared || prepared.token !== token) return stale();
      prepared = null;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      accepted = null;
      privateRegion = null;
      privateOptions = null;
      prepared = null;
    },
  });
}
