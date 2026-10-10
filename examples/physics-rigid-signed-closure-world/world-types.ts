import type { Body, PhysicsWorld, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { AdmittedCommands } from '../../packages/barocss-physics/src/validation.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { WarmCacheStats } from '../physics-rigid-feature-contact-reference/warm-cache.js';
import type { GlobalIslandStats } from './global-island.js';
import type { LiveSignedClosureStats, LiveSignedClosureAttempt, LiveSignedClosureOptions } from './closure-types.js';

/** Actual frozen velocity-assembly geometry and current-step accumulators. */
export interface PointLedger {
  aId: string;
  bId: string;
  aIndex: number;
  bIndex: number;
  pairKey: string;
  pointId: string;
  family: 'face' | 'edge';
  pointM: Vec3;
  normal: Vec3;
  aPositionM: Vec3;
  bPositionM: Vec3;
  warm: PointImpulse;
  final: PointImpulse;
}

/** Accepted step only; each frame and action is an independent copied value. */
export interface StepLedger {
  beforeBodies: Body[];
  freeBodies: Body[];
  velocityBodies: Body[];
  finalBodies: Body[];
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  actions: Array<[string, AdmittedCommands]>;
  points: PointLedger[];
}

/** Reached frames only. Null means the later phase has not run. */
export interface StepAttempt {
  stage: 'free-ready' | 'velocity-ready' | 'closure-ready';
  ledger: Omit<StepLedger, 'velocityBodies' | 'finalBodies' | 'points'> & {
    velocityBodies: Body[] | null;
    finalBodies: Body[] | null;
    points: PointLedger[] | null;
  };
}

/** World-only evidence hook; no public configuration or closure-law injection. */
export interface LiveSignedClosureWorldOptions extends LiveSignedClosureOptions {
  observeStepAttempt?: (attempt: StepAttempt) => void;
}

export interface LiveSignedClosureWorld extends PhysicsWorld {
  getLiveSignedClosureStats(): LiveSignedClosureStats;
  getLiveSignedClosureAttempt(): LiveSignedClosureAttempt | null;
  getStepLedger(): StepLedger | null;
  getWarmCacheStats(): WarmCacheStats;
  getWarmCacheSnapshot(): Array<[string, PointImpulse]>;
  getGlobalContactStats(): GlobalIslandStats;
}
