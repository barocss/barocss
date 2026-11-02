import type { Brep, BrepFace } from './brep-core.js';
/** Null means no contradiction proved; it NEVER certifies a binding or an unsupported family. */
export declare function faceBoundaryContradiction(brep: Brep, face: BrepFace): string | null;
/** Internal producer registration. Does NOT freeze anything, and rejects mutable/foreign eligibility bindings. */
export declare function registerImmutableMeshPlaneExclusion(brep: Brep): boolean;
/** Before caches/fallbacks/export: immutable producer exclusion or CURRENT mutable eligibility, never stale identity. */
export declare function assertBoundaryBindings(brep: Brep): void;
