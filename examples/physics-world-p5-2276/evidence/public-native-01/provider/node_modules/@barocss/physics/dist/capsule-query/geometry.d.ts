import type { Vec3, Quat } from '../internal-types.js';
import type { CapsuleQueryBoxV1 } from './types.js';
import { RADIUS_M, HALF_LENGTH_M } from './profile.js';
export { RADIUS_M, HALF_LENGTH_M };
interface SegmentBoxWitness {
    distanceM: number;
    normalM: Vec3 | null;
    pointM: Vec3;
    segmentM: Vec3;
}
export declare function matrix(q: Quat): [Vec3, Vec3, Vec3];
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare function closestCandidate(center: Vec3, box: CapsuleQueryBoxV1): SegmentBoxWitness;
