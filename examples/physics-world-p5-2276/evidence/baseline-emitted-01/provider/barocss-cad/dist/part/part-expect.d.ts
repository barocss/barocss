import type { Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import type { CadPartErrorCode } from './part-model.js';
/** What a stored name looked like (cad-model's rematch.ts `Signature`): an edge straight or not, a face planar or not. */
export interface CadPartNameSignature {
    readonly kind: 'line' | 'curve' | 'plane' | 'curved';
    /** An edge's midpoint (of its two ends), a face's centroid. */
    readonly at: readonly [number, number, number];
    /** A straight edge's direction (either way), a planar face's normal. */
    readonly dir?: readonly [number, number, number] | null;
    /** An edge's chord, a face's area: carried, not judged. */
    readonly size: number;
    /** A cylindrical or spherical face's radius. */
    readonly radius?: number;
}
type Sig = {
    kind: CadPartNameSignature['kind'];
    at: Point;
    dir: Point | null;
    radius?: number;
};
/** The names a feature stores, by kind: a fillet's or chamfer's edges, a shell's open faces, a draft's faces. */
export declare function storedNames(f: {
    readonly kind: string;
} & Record<string, unknown>): {
    names: readonly string[];
    edges: boolean;
} | null;
/** A feature's `expect`, checked as data: an entry per name the feature uses, each a signature. */
export declare function expectOf(f: {
    readonly kind: string;
} & Record<string, unknown>, fail: (code: CadPartErrorCode, detail: string) => never): ReadonlyMap<string, Sig> | null;
/** Each edge name's signature on a body: its pieces joined as the display joins them (straight: the extreme ends; curved: the chain's free ends). */
export declare function edgeSignatures(brep: Brep): Map<string, Sig>;
/** Each face name's signature on a body: planar or curved, its area centroid and normal over its tessellation, its radius. */
export declare function faceSignatures(brep: Brep): Map<string, Sig>;
/**
 * Refuses when a stored name resolves to other geometry than it named: (a) the named edge or face is not alike its
 * expectation, or (b) another one alike it is clearly nearer the expectation (at half the named one's distance or less).
 * A name not on the body is left to the feature's own refusal.
 */
export declare function checkExpected(brep: Brep, expect: ReadonlyMap<string, Sig>, edges: boolean, kind: string, fail: (code: CadPartErrorCode, detail: string) => never): void;
export {};
