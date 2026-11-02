import { type Brep } from './brep-core.js';
/** The one solid of `a` and `b` glued along a planar face they share, or null when they share none exactly. */
export declare function glueAtSharedFace(a: Brep, b: Brep, source: Brep['source']): Brep | null;
/**
 * A solid with cavities: `outer`'s one body, and every shell of `inner` (bodies strictly inside it,
 * apart from its boundary and each other) as voids, faces turned inside out.
 */
export declare function withCavities(outer: Brep, inner: Brep, source: Brep['source']): Brep;
