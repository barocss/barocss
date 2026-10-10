import type { Vec3, Quat } from '../../packages/barocss-physics/src/types.js';
export const PROFILE = 'rigid-capsule-linear-face-v1' as const;
export const RADIUS_M = 0.1;
export const HALF_LENGTH_M = 0.2;
export const TOLERANCE_M = 1e-12;
export const YAW_QUATERNION: Quat = [0, 0.09983341664682815, 0, 0.9950041652780257];
export const ERRORS = {
  profile: 'Private capsule face profile is unsupported',
  movement: 'Private capsule face movement is unsupported',
  numeric: 'Private capsule face result is invalid',
  overlap: 'Initial capsule overlaps a box',
  stale: 'Revision mismatch',
  disposed: 'Private capsule face reference is disposed',
} as const;
export interface Capsule { radiusM: number; halfLengthM: number; orientationXYZW: Quat; angularVelocityRadps: Vec3 }
export interface Box { id: string; centerM: Vec3; halfExtentsM: Vec3; orientationXYZW: Quat; velocityMps: Vec3; angularVelocityRadps: Vec3 }
export interface Snapshot { version: 1; profile: typeof PROFILE; selectedFace: 'negative-x'; revision: string; capsule: Capsule; box: Box }
export interface Movement { revision: string; centerM: Vec3; velocityMps: Vec3; stepSeconds: number }
export interface Hit { bodyId: string; toiFraction: number; normalFixtureToCapsule: Vec3; pointM: Vec3; segmentPointM: Vec3 }
export interface Initial extends Movement { snapshot: Snapshot }
export interface Result { centerM: Vec3; velocityMps: Vec3; hitTimeSeconds: number; remainingTimeSeconds: number; orientationXYZW: Quat; box: Box }
