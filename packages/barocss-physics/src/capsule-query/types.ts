import type { Vec3, Quat } from '../types.js';

export interface CapsuleQueryBoxV1 {
  id: string;
  centerM: Vec3;
  halfExtentsM: Vec3;
  orientationXYZW: Quat;
}
export interface CapsuleQuerySceneV1 {
  version: 1;
  profile: 'upright-capsule-box-v1';
  revision: string;
  boxes: CapsuleQueryBoxV1[];
}
export interface CapsuleSweepInputV1 {
  revision: string;
  centerM: Vec3;
  displacementM: Vec3;
  excludeId: string | null;
}
export interface CapsuleSweepHitV1 {
  bodyId: string;
  toiFraction: number;
  /** Dimensionless world unit vector from the box to the capsule. */
  normalFixtureToCapsule: Vec3;
  pointM: Vec3;
  /** Point on the capsule centreline, not its surface. */
  segmentPointM: Vec3;
  /** Advancement count for the selected hit, not total query work. */
  iterations: number;
}
export interface UprightCapsuleQuery {
  sweep(input: CapsuleSweepInputV1): CapsuleSweepHitV1 | null;
  getSnapshot(): CapsuleQuerySceneV1;
  dispose(): void;
}
