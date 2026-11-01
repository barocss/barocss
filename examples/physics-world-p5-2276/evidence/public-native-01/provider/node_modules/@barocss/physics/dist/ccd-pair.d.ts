import type { Body, PhysicsCcdHit } from './internal-types.js';
/** Stop two linearly swept dynamic spheres at their first relative entry. */
export declare function sweepSpherePair(markedStart: Body, markedEnd: Body, otherStart: Body, otherEnd: Body): PhysicsCcdHit | null;
