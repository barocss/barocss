import type { Vec3 } from './internal-types.js';
export interface SlabHit {
    fraction: number;
    normalLocal: Vec3;
}
export declare function sweepBox(start: Vec3, end: Vec3, halfExtents: Vec3): SlabHit | null;
