import type { ConvexPlanarSolidSplitResult } from '../convex-planar-solid-split.js';

/** Non-authoritative projection of the existing qualified native Split lineage. */
export interface SplitFaceIdentity {
  readonly sourceId: string;
  readonly faceId: string;
  readonly surfaceId: string;
  readonly loopId: string;
}
export interface SplitFaceEvolution {
  readonly parent: SplitFaceIdentity;
  readonly outcomes: readonly {
    readonly side: 'negative' | 'positive';
    readonly role: 'retained' | 'clipped' | 'deleted';
    readonly output: SplitFaceIdentity | null;
  }[];
  /** More than one surviving output means no unique implicit persistent reference. */
  readonly resolution: 'unique' | 'ambiguous' | 'deleted';
}
export interface SplitEvolutionReceipt {
  readonly schema: 'barocss-cad-split-face-evolution';
  readonly version: 0;
  readonly operationId: string;
  readonly sourceFamily: 'convex-planar-solid-split';
  readonly nativeStatus: 'split' | 'outside' | 'tangent';
  readonly namingCertified: false;
  readonly faces: readonly SplitFaceEvolution[];
  readonly generatedCaps: readonly {
    readonly side: 'negative' | 'positive';
    readonly output: SplitFaceIdentity;
  }[];
}
const id = (f: SplitFaceIdentity) => [f.sourceId, f.faceId, f.surfaceId, f.loopId].join('\u0000');
const copy = (f: SplitFaceIdentity): SplitFaceIdentity =>
  ({ sourceId: f.sourceId, faceId: f.faceId, surfaceId: f.surfaceId, loopId: f.loopId });

/**
 * Read, don't reclassify, actual native lineage. A face split into two outputs
 * is explicitly ambiguous, not auto-matched to a geometrically nearest face.
 *
 * The caller must first qualify a result with validateConvexPlanarSolidSplit.
 * This is an informational projection, NOT independent geometry validation.
 */
export function projectConvexPlanarSplitFaceEvolution(
  split: ConvexPlanarSolidSplitResult,
): SplitEvolutionReceipt {
  if (!split || split.report?.schema !== 'barocss-convex-planar-solid-split' ||
      !Array.isArray(split.lineage?.faces))
    throw new TypeError('Qualified native convex planar Split result required');
  const groups = new Map<string, { parent: SplitFaceIdentity; outcomes: SplitFaceEvolution['outcomes'][number][] }>();
  const caps: { side: 'negative' | 'positive'; output: SplitFaceIdentity }[] = [];
  for (const face of split.lineage.faces) {
    if (face.role === 'cap') {
      if (face.parent !== null || face.output === null) throw new Error('Invalid native cap lineage');
      caps.push({ side: face.side, output: copy(face.output) });
      continue;
    }
    if (face.parent === null) throw new Error('Missing native parent face lineage');
    if ((face.role === 'deleted') !== (face.output === null))
      throw new Error('Invalid native deletion/output lineage');
    const key = id(face.parent);
    let group = groups.get(key);
    if (!group) {
      group = { parent: copy(face.parent), outcomes: [] };
      groups.set(key, group);
    }
    if (group.outcomes.some(x => x.side === face.side && x.output?.faceId === face.output?.faceId && x.role === face.role))
      throw new Error('Duplicate native face evolution record');
    group.outcomes.push({ side: face.side, role: face.role, output: face.output === null ? null : copy(face.output) });
  }
  const faces = [...groups.values()].map(g => {
    const surviving = g.outcomes.filter(o => o.output !== null);
    return {
      parent: g.parent,
      outcomes: g.outcomes,
      resolution: (surviving.length === 0 ? 'deleted' : surviving.length === 1 ? 'unique' : 'ambiguous') as SplitFaceEvolution['resolution'],
    };
  });
  return {
    schema: 'barocss-cad-split-face-evolution', version: 0,
    operationId: split.report.operationId,
    sourceFamily: 'convex-planar-solid-split',
    nativeStatus: split.report.status,
    namingCertified: false,
    faces,
    generatedCaps: caps,
  };
}
