import { buildProfileLoop, buildExtrudedProfileSolid, measureExtrudedProfileSolid, exportExtrudedProfileSolidStl } from './features/extruded-profile-solid.js';
import type { ProfileLoop, ProfileSegmentInput, ExtrudedProfileSolidResult, ExtrudedProfileMass } from './features/extruded-profile-solid.js';

export type ModelingProfileRequest =
  | { readonly operation: 'loop'; readonly segments: readonly ProfileSegmentInput[] }
  | { readonly operation: 'solid'; readonly loop: ProfileLoop; readonly id: string; readonly heightMM: number; readonly fromMM?: number }
  | { readonly operation: 'mass'; readonly solid: ExtrudedProfileSolidResult; readonly densityKgPerM3: number }
  | { readonly operation: 'stl'; readonly solid: ExtrudedProfileSolidResult; readonly segmentsPerQuarter: number };
type Response<R> = R extends { operation: 'loop' } ? ProfileLoop : R extends { operation: 'solid' } ? ExtrudedProfileSolidResult
  : R extends { operation: 'mass' } ? ExtrudedProfileMass : Uint8Array;

/** Private single entry to the line+arc extruded-profile kernel for the model graph. */
export function runModelingProfile<R extends ModelingProfileRequest>(request: R): Response<R> {
  const r = request as ModelingProfileRequest;
  const result = r.operation === 'loop' ? buildProfileLoop(r.segments)
    : r.operation === 'solid' ? buildExtrudedProfileSolid(r.loop, { id: r.id, height: r.heightMM, ...(r.fromMM === undefined ? {} : { from: r.fromMM }) })
      : r.operation === 'mass' ? measureExtrudedProfileSolid(r.solid, { density: r.densityKgPerM3 })
        : exportExtrudedProfileSolidStl(r.solid, { segmentsPerQuarter: r.segmentsPerQuarter });
  return result as Response<R>;
}
