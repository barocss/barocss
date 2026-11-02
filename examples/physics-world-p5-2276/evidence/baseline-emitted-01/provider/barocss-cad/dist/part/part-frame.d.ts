import { type BeadJointRef } from '../frame-sheet/frame-weldment.js';
import { type XY } from '../brep/curved-arrangement.js';
import { type Point } from '../types.js';
import { type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import { type SideTags } from '../document/side-names.js';
import { CadPartError } from './part-model.js';
import type { Part, Result, CadPartFeature, Tools } from './part-model.js';
/** A frame or weldment feature's evaluation (part-model.ts's operation() for these kinds). */
export declare function frameOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result;
/** A member's section ready to extrude: its loops and roles, and (a kind's) its closed-form area, centroid and box. */
type MemberShape = {
    readonly kind: string;
    readonly label: string;
    readonly outer: readonly ProfileSegmentInput[];
    readonly holes: readonly (readonly ProfileSegmentInput[])[];
    readonly tags?: SideTags;
    readonly outerNames?: readonly string[];
    readonly holeNames?: readonly (readonly string[])[];
    readonly areaMM2?: number;
    readonly centroid?: XY;
    readonly box?: {
        readonly min: XY;
        readonly max: XY;
    };
    readonly derived?: Readonly<Record<string, string>>;
};
/** A member's section placed on its line: the (mirrored) shape, area, centroid, box, the line's direction, the frame, the line's section point. */
type MemberPlace = {
    readonly shape: MemberShape;
    readonly area: number;
    readonly centroid: XY;
    readonly box: {
        readonly min: XY;
        readonly max: XY;
    };
    readonly u: Point;
    readonly F: {
        x: Point;
        y: Point;
        fallback?: Point;
    };
    readonly q: XY;
};
/** A frame member as built (FRk1): its section placed on its line, its length, how far each end runs on, its faces' prefix. */
export type MemberPlaced = {
    readonly place: MemberPlace;
    readonly lengthMM: number;
    readonly extend: readonly [number, number];
    readonly at: string;
};
/** A gusset as built (FRk2): its corner's frame (p, n; ua, ey along member A; ub, wb along member B), its corner, legs, clip, thickness, offset. */
export type GussetPlaced = {
    readonly p: Point;
    readonly n: Point;
    readonly ua: Point;
    readonly ey: Point;
    readonly ub: Point;
    readonly wb: Point;
    readonly xV: number;
    readonly yV: number;
    readonly s: number;
    readonly legs: readonly [number, number];
    readonly clip: number;
    readonly t: number;
    readonly offset: number;
    readonly members: readonly [number, number];
};
export type EndpointBead = Extract<CadPartFeature, {
    kind: 'weld-bead';
}> & {
    readonly on: BeadJointRef;
};
export declare function isEndpointBead(f: CadPartFeature): f is EndpointBead;
/** Peer edits invalidate an owned result even when its own authored feature has not changed. */
export declare function endpointContext(features: readonly CadPartFeature[], frame: string, parameters: Readonly<Record<string, number>>): unknown;
/** Discover the actual graph first, then plan every component before exposing either participant. */
export declare function planEndpointBeads(features: readonly CadPartFeature[], byMember: ReadonlyMap<number, Part>, frame: string, parameters: Readonly<Record<string, number>>): Map<string, Result | CadPartError>;
export {};
