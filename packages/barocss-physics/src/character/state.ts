import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import { DT, PROFILE } from './profile.js';
import { clone, norm } from './math.js';
import type { CharacterState, CapsuleControllerStateV1, ErrorRecord } from './types.js';

export function initialState(positionM: Vec3, sceneRevision: string): CharacterState {
  return {
    stepIndex: 0, timeSeconds: 0, positionM: [...positionM], velocityMps: [0, 0, 0],
    fallVelocityYMps: 0, orientationXYZW: [0, 0, 0, 1], grounded: false, support: null,
    blocked: false, assist: null, sceneRevision, queryCount: 0,
    lastQueries: [], lastSegments: [], gravityPrediction: null,
  };
}
export function projectState(state: CharacterState): CapsuleControllerStateV1 {
  return {
    version: 1, profile: PROFILE, sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
    timeSeconds: state.timeSeconds, positionM: [...state.positionM], velocityMps: [...state.velocityMps],
    orientationXYZW: [...state.orientationXYZW], fallVelocityYMps: state.fallVelocityYMps,
    grounded: state.grounded, support: clone(state.support), blocked: state.blocked,
    assist: clone(state.assist), queryCount: state.queryCount,
  };
}
export function validateState(position: Vec3, velocity: Vec3, request: Vec3, previous: CharacterState): void {
  if (position.some(value => !Number.isFinite(value) || Math.abs(value) > 5) ||
      velocity.some(value => !Number.isFinite(value)) || norm(velocity) > 20) {
    throw new PhysicsError('NUMERIC_LIMIT', 'Controller state exceeds its bound');
  }
  const actual = position.map((value, index) => value - previous.positionM[index]);
  const horizontal = Math.hypot(actual[0], actual[2]), allowed = Math.hypot(request[0], request[2]) * DT;
  if (horizontal > allowed + 1e-9 || Math.abs(actual[1]) > .1 + 1e-6) {
    throw new PhysicsError('NUMERIC_LIMIT', 'Controller movement exceeds its bound');
  }
}
export function errorRecord(error: unknown): ErrorRecord {
  const value = error as { name?: string; code?: string; message?: string };
  return { name: value.name ?? 'Error', code: value.code, message: value.message ?? String(error) };
}
