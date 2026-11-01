import type { Body, Vec3 } from './types.js';
export declare function solvePairMatrix(columns: Vec3[], target: Vec3): Vec3;
export declare function applyPairAngle(body: Body, angle: Vec3, dt: number): void;
/** Move two dynamic anchors together with equal and opposite generalized impulses. */
export declare function projectDynamicPairAnchors(a: Body, b: Body, anchorA: Vec3, anchorB: Vec3, dt: number): void;
