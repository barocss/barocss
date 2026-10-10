import type { Body, PhysicsContact, PhysicsPairStats, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { detect } from '../../packages/barocss-physics/src/collision.js';
import { solvePersistentPoint, warmStartPoint, type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { add } from '../../packages/barocss-physics/src/math.js';
import { MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { compatiblePatch, emptyWarmCacheStats, type WarmCacheStats } from '../physics-rigid-feature-contact-reference/warm-cache.js';
import { adaptContactGeometry, FEATURE_WITNESS_MESSAGE, type VelocityGeometryPoint } from '../physics-rigid-feature-contact-reference/geometry-adapter.js';

export const GLOBAL_CONTACT_SWEEPS = 64;
import { runCoupledPositionPhase } from './coupled-phase.js';
import { zeroCoupledStats, type CoupledPositionStats, type CoupledAttempt, type CoupledOptions } from './phase-types.js';
export const GLOBAL_PHASE_MESSAGE = 'private global contact island phase order is invalid';

export type ContactPair = readonly [number, number];

export interface GlobalIslandStats {
  assemblyTests: number;
  patches: number;
  facePatches: number;
  edgePatches: number;
  points: number;
  globalSweeps: number;
  pointUpdates: number;
  positionSweeps: number;
  positionTests: number;
  /** Non-null fresh positional detects, including zero-penetration hits. */
  positionHits: number;
}

/** Detached copies become the world's accepted data only after its validation. */
export interface GlobalIslandResult {
  contacts: PhysicsContact[];
  pointsMap: Map<string, PointImpulse>;
  pairStats: PhysicsPairStats;
  globalStats: GlobalIslandStats;
  warmCacheStats: WarmCacheStats;
}

interface FrozenPatch {
  aIndex: number;
  bIndex: number;
  aId: string;
  bId: string;
  pairKey: string;
  family: 'face' | 'edge';
  normal: Vec3;
  satNormalAtoB: Vec3;
  penetrationM: number;
  points: VelocityGeometryPoint[];
  meanPointM: Vec3;
}

interface WarmRow {
  patch: FrozenPatch;
  point: VelocityGeometryPoint;
  impulse: PointImpulse;
}

function copyImpulse(impulse: PointImpulse): PointImpulse {
  return { normalNs: impulse.normalNs, tangentNs: [...impulse.tangentNs] as Vec3 };
}

/**
 * One ephemeral world-step transaction. The world supplies private working
 * bodies and retains its working array for commit. No Body references escape
 * this class. World admission excludes sensors, CCD, joints and non-box bodies.
 * Velocity geometry is copied once. Positional detects do not build manifolds.
 */
export class FrozenContactIsland {
  readonly #bodies: Body[];
  readonly #pairs: ContactPair[];
  readonly #prior: ReadonlyMap<string, PointImpulse>;
  readonly #patches: FrozenPatch[] = [];
  readonly #pointsMap = new Map<string, PointImpulse>();
  readonly #pairStats: PhysicsPairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  readonly #globalStats = FrozenContactIsland.zeroStats();
  readonly #warmStats = emptyWarmCacheStats();
  #coupledStats = zeroCoupledStats();
  #attempt: CoupledAttempt | null = null;
  readonly #options: CoupledOptions;
  #phase: 'assembled' | 'solved' | 'projected' = 'assembled';

  static zeroStats(): GlobalIslandStats {
    return {
      assemblyTests: 0, patches: 0, facePatches: 0, edgePatches: 0, points: 0, globalSweeps: 0,
      pointUpdates: 0, positionSweeps: 0, positionTests: 0, positionHits: 0,
    };
  }

  constructor(nextBodies: Body[], sortedPairs: readonly ContactPair[], prior: ReadonlyMap<string, PointImpulse>, options: CoupledOptions = {}) {
    this.#options = { ...options };
    this.#bodies = nextBodies.slice();
    this.#pairs = sortedPairs.map(([a, b]) => [a, b] as ContactPair);
    this.#prior = new Map([...prior].map(([key, impulse]) => [key, copyImpulse(impulse)]));
    for (const [aIndex, bIndex] of this.#pairs) {
      this.#globalStats.assemblyTests++;
      this.#pairStats.eligiblePairs++;
      this.#pairStats.candidatePairs++;
      const a = this.#bodies[aIndex], b = this.#bodies[bIndex];
      const hit = detect(a, b);
      if (!hit) continue;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) {
        error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
      }
      const actual = adaptContactGeometry(a, b);
      if (!actual) error('NUMERIC_LIMIT', FEATURE_WITNESS_MESSAGE);
      const patch: FrozenPatch = {
        aIndex, bIndex, aId: a.id, bId: b.id, pairKey: `${a.id}\u0000${b.id}`,
        family: actual.family, normal: actual.normal,
        satNormalAtoB: actual.satNormalAtoB, penetrationM: hit.penetration,
        points: actual.points, meanPointM: actual.meanPointM,
      };
      this.#patches.push(patch);
      this.#globalStats.patches++;
      if (patch.family === 'face') this.#globalStats.facePatches++;
      else this.#globalStats.edgePatches++;
      this.#globalStats.points += patch.points.length;
    }
  }

  /** Initialize every point, warm every eligible patch, then solve globally. */
  solve(): void {
    this.#requirePhase('assembled');
    const warmRows: WarmRow[] = [];
    for (const patch of this.#patches) {
      const compatible = compatiblePatch(this.#prior, patch.pairKey, patch.points, patch.family);
      this.#warmStats.testedPatches++;
      if (compatible) this.#warmStats.compatiblePatches++;
      else this.#warmStats.incompatiblePatches++;
      for (const point of patch.points) {
        const key = `${patch.pairKey}\u0000${point.id}`;
        const prior = compatible ? this.#prior.get(key) : undefined;
        const impulse = prior ? copyImpulse(prior) : { normalNs: 0, tangentNs: [0, 0, 0] as Vec3 };
        this.#pointsMap.set(key, impulse);
        if (prior) {
          this.#warmStats.reusedPoints++;
          warmRows.push({ patch, point, impulse });
        } else {
          this.#warmStats.coldPoints++;
        }
      }
    }
    // All initialization and warm starts precede the first point solve.
    for (const { patch, point, impulse } of warmRows) {
      warmStartPoint(this.#bodies[patch.aIndex], this.#bodies[patch.bIndex],
        point.pointM, patch.normal, impulse);
    }
    for (let sweep = 0; sweep < GLOBAL_CONTACT_SWEEPS; sweep++) {
      this.#globalStats.globalSweeps++;
      for (const patch of this.#patches) {
        const order = sweep % 2 ? [...patch.points].reverse() : patch.points;
        for (const point of order) {
          const impulse = this.#pointsMap.get(`${patch.pairKey}\u0000${point.id}`)!;
          solvePersistentPoint(this.#bodies[patch.aIndex], this.#bodies[patch.bIndex],
            point.pointM, patch.normal, impulse);
          this.#globalStats.pointUpdates++;
        }
      }
    }
    this.#phase = 'solved';
  }

  /** Fresh geometry for position-only correction; no new velocity/cache rows. */
  projectPositions(): void {
    this.#requirePhase('solved');
    const result = runCoupledPositionPhase(this.#bodies, this.#pairs, this.#options);
    this.#coupledStats = result.stats;
    this.#attempt = result.attempt;
    this.#globalStats.positionSweeps = 1;
    this.#globalStats.positionTests = result.stats.tests;
    this.#globalStats.positionHits = result.stats.hits;
    this.#phase = 'projected';
  }

  getCoupledPositionStats(): CoupledPositionStats { return { ...this.#coupledStats }; }
  getCoupledPositionAttempt(): CoupledAttempt | null { return structuredClone(this.#attempt); }

  getGlobalStats(): GlobalIslandStats {
    return { ...this.#globalStats };
  }

  getWarmCacheStats(): WarmCacheStats {
    return { ...this.#warmStats };
  }

  /** Assembly geometry and final accumulated impulses, not final force data. */
  result(): GlobalIslandResult {
    this.#requirePhase('projected');
    const contacts = this.#patches.map((patch): PhysicsContact => {
      let impulseNs = 0;
      let tangentImpulseNs: Vec3 = [0, 0, 0];
      for (const point of patch.points) {
        const impulse = this.#pointsMap.get(`${patch.pairKey}\u0000${point.id}`)!;
        impulseNs += impulse.normalNs;
        tangentImpulseNs = add(tangentImpulseNs, impulse.tangentNs);
      }
      return {
        aId: patch.aId, bId: patch.bId, normalAtoB: [...patch.normal] as Vec3,
        pointM: [...patch.meanPointM] as Vec3, penetrationM: patch.penetrationM,
        impulseNs, tangentImpulseNs,
      };
    });
    return {
      contacts,
      pointsMap: new Map([...this.#pointsMap].map(([key, impulse]) => [key, copyImpulse(impulse)])),
      pairStats: { ...this.#pairStats },
      globalStats: this.getGlobalStats(),
      warmCacheStats: this.getWarmCacheStats(),
    };
  }

  #requirePhase(expected: 'assembled' | 'solved' | 'projected'): void {
    if (this.#phase !== expected) error('NUMERIC_LIMIT', GLOBAL_PHASE_MESSAGE);
  }
}
