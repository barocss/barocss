var _a;
import { detect } from '../../packages/barocss-physics/src/collision.js';
import { solvePersistentPoint, warmStartPoint } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { add } from '../../packages/barocss-physics/src/math.js';
import { MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { compatiblePatch, emptyWarmCacheStats } from '../physics-rigid-feature-contact-reference/warm-cache.js';
import { adaptContactGeometry, FEATURE_WITNESS_MESSAGE } from '../physics-rigid-feature-contact-reference/geometry-adapter.js';
export const GLOBAL_CONTACT_SWEEPS = 64;
import { runFullPairPositionPhase, zeroFullPairPositionStats } from './full-pair-phase.js';
export const GLOBAL_PHASE_MESSAGE = 'private global contact island phase order is invalid';
function copyImpulse(impulse) {
    return { normalNs: impulse.normalNs, tangentNs: [...impulse.tangentNs] };
}
/**
 * One ephemeral world-step transaction. The world supplies private working
 * bodies and retains its working array for commit. No Body references escape
 * this class. World admission excludes sensors, CCD, joints and non-box bodies.
 * Velocity geometry is copied once. Positional detects do not build manifolds.
 */
export class FrozenContactIsland {
    #bodies;
    #pairs;
    #prior;
    #patches = [];
    #pointsMap = new Map();
    #pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
    #globalStats = _a.zeroStats();
    #warmStats = emptyWarmCacheStats();
    #positionStats = zeroFullPairPositionStats();
    #attempt = null;
    #pointLedger = [];
    #options;
    #phase = 'assembled';
    static zeroStats() {
        return {
            assemblyTests: 0, patches: 0, facePatches: 0, edgePatches: 0, points: 0, globalSweeps: 0,
            pointUpdates: 0, positionSweeps: 0, positionTests: 0, positionHits: 0,
        };
    }
    constructor(nextBodies, sortedPairs, prior, options = {}) {
        this.#options = { ...options };
        this.#bodies = nextBodies.slice();
        this.#pairs = sortedPairs.map(([a, b]) => [a, b]);
        this.#prior = new Map([...prior].map(([key, impulse]) => [key, copyImpulse(impulse)]));
        for (const [aIndex, bIndex] of this.#pairs) {
            this.#globalStats.assemblyTests++;
            this.#pairStats.eligiblePairs++;
            this.#pairStats.candidatePairs++;
            const a = this.#bodies[aIndex], b = this.#bodies[bIndex];
            const hit = detect(a, b);
            if (!hit)
                continue;
            if (hit.penetration > MAX_STEP_DISPLACEMENT_M) {
                error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
            }
            const actual = adaptContactGeometry(a, b);
            if (!actual)
                error('NUMERIC_LIMIT', FEATURE_WITNESS_MESSAGE);
            const patch = {
                aIndex, bIndex, aId: a.id, bId: b.id, pairKey: `${a.id}\u0000${b.id}`,
                family: actual.family, normal: actual.normal,
                satNormalAtoB: actual.satNormalAtoB, penetrationM: hit.penetration,
                points: actual.points, meanPointM: actual.meanPointM,
            };
            this.#patches.push(patch);
            this.#globalStats.patches++;
            if (patch.family === 'face')
                this.#globalStats.facePatches++;
            else
                this.#globalStats.edgePatches++;
            this.#globalStats.points += patch.points.length;
        }
    }
    /** Initialize every point, warm every eligible patch, then solve globally. */
    solve() {
        this.#requirePhase('assembled');
        const warmRows = [];
        for (const patch of this.#patches) {
            const compatible = compatiblePatch(this.#prior, patch.pairKey, patch.points, patch.family);
            this.#warmStats.testedPatches++;
            if (compatible)
                this.#warmStats.compatiblePatches++;
            else
                this.#warmStats.incompatiblePatches++;
            for (const point of patch.points) {
                const key = `${patch.pairKey}\u0000${point.id}`;
                const prior = compatible ? this.#prior.get(key) : undefined;
                const impulse = prior ? copyImpulse(prior) : { normalNs: 0, tangentNs: [0, 0, 0] };
                this.#pointsMap.set(key, impulse);
                this.#pointLedger.push({
                    aId: patch.aId, bId: patch.bId, aIndex: patch.aIndex, bIndex: patch.bIndex,
                    pairKey: patch.pairKey, pointId: point.id, family: patch.family,
                    pointM: [...point.pointM], normal: [...patch.normal],
                    aPositionM: [...this.#bodies[patch.aIndex].positionM],
                    bPositionM: [...this.#bodies[patch.bIndex].positionM],
                    warm: copyImpulse(impulse), final: copyImpulse(impulse),
                });
                if (prior) {
                    this.#warmStats.reusedPoints++;
                    warmRows.push({ patch, point, impulse });
                }
                else {
                    this.#warmStats.coldPoints++;
                }
            }
        }
        // All initialization and warm starts precede the first point solve.
        for (const { patch, point, impulse } of warmRows) {
            warmStartPoint(this.#bodies[patch.aIndex], this.#bodies[patch.bIndex], point.pointM, patch.normal, impulse);
        }
        for (let sweep = 0; sweep < GLOBAL_CONTACT_SWEEPS; sweep++) {
            this.#globalStats.globalSweeps++;
            for (const patch of this.#patches) {
                const order = sweep % 2 ? [...patch.points].reverse() : patch.points;
                for (const point of order) {
                    const impulse = this.#pointsMap.get(`${patch.pairKey}\u0000${point.id}`);
                    solvePersistentPoint(this.#bodies[patch.aIndex], this.#bodies[patch.bIndex], point.pointM, patch.normal, impulse);
                    this.#globalStats.pointUpdates++;
                }
            }
        }
        for (const point of this.#pointLedger) {
            point.final = copyImpulse(this.#pointsMap.get(`${point.pairKey}\u0000${point.pointId}`));
        }
        this.#phase = 'solved';
    }
    /** Fresh geometry for position-only correction; no new velocity/cache rows. */
    projectPositions() {
        this.#requirePhase('solved');
        const result = runFullPairPositionPhase(this.#bodies, this.#pairs, this.#options);
        this.#positionStats = result.stats;
        this.#attempt = result.attempt;
        this.#globalStats.positionSweeps = 1;
        this.#globalStats.positionTests = result.stats.tests;
        this.#globalStats.positionHits = result.stats.hits;
        this.#phase = 'projected';
    }
    getFullPairPositionStats() { return structuredClone(this.#positionStats); }
    getFullPairPositionAttempt() { return structuredClone(this.#attempt); }
    /** Net step J uses final accumulators, including the warm impulse applied once. */
    getPointLedger() {
        this.#requirePhase('solved');
        return structuredClone(this.#pointLedger);
    }
    getGlobalStats() {
        return { ...this.#globalStats };
    }
    getWarmCacheStats() {
        return { ...this.#warmStats };
    }
    /** Assembly geometry and final accumulated impulses, not final force data. */
    result() {
        this.#requirePhase('projected');
        const contacts = this.#patches.map((patch) => {
            let impulseNs = 0;
            let tangentImpulseNs = [0, 0, 0];
            for (const point of patch.points) {
                const impulse = this.#pointsMap.get(`${patch.pairKey}\u0000${point.id}`);
                impulseNs += impulse.normalNs;
                tangentImpulseNs = add(tangentImpulseNs, impulse.tangentNs);
            }
            return {
                aId: patch.aId, bId: patch.bId, normalAtoB: [...patch.normal],
                pointM: [...patch.meanPointM], penetrationM: patch.penetrationM,
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
    #requirePhase(expected) {
        if (this.#phase !== expected)
            error('NUMERIC_LIMIT', GLOBAL_PHASE_MESSAGE);
    }
}
_a = FrozenContactIsland;
