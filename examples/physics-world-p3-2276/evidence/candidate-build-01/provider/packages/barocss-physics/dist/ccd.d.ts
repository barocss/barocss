import type { Body, PhysicsCcdHit, Vec3 } from './internal-types.js';
export type CcdProfile = {
    kind: 'none';
} | {
    kind: 'static-boxes';
    sphereIndex: number;
    fixtures: Body[];
} | {
    kind: 'sphere-pair';
    sphereIndex: number;
    otherIndex: number;
} | {
    kind: 'box-pair';
    boxIndex: number;
    fixtureIndex: number;
};
export declare function admitCcd(bodies: Body[], jointCount: number, gravity: Vec3): CcdProfile;
export declare function sweepSphere(previous: Body, candidate: Body, fixtures: Body[]): PhysicsCcdHit | null;
