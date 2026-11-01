import type { Body, Vec3 } from './internal-types.js';
export interface PointImpulse {
    normalNs: number;
    tangentNs: Vec3;
}
export declare function warmStartPoint(a: Body, b: Body, pointM: Vec3, normal: Vec3, impulse: PointImpulse): void;
export declare function solvePersistentPoint(a: Body, b: Body, pointM: Vec3, normal: Vec3, impulse: PointImpulse): void;
export declare function correctPersistentPair(a: Body, b: Body, normal: Vec3, penetration: number): void;
