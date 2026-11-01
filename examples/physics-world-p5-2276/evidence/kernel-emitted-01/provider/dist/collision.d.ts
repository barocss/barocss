import type { Body, Hit, PhysicsContact, Vec3 } from './internal-types.js';
export declare function detect(a: Body, b: Body): Hit | null;
export declare function sphereOverlaps(center: Vec3, radius: number, body: Body): boolean;
export declare function rayDistance(origin: Vec3, direction: Vec3, body: Body): number | null;
export declare function solve(a: Body, b: Body, hit: Hit): {
    normalImpulseNs: number;
    tangentImpulseNs: Vec3;
};
export declare function validateResult(bodies: Body[], contacts: PhysicsContact[]): void;
