import { add, sub, dot, scale, rotate } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
export const WITNESS_MESSAGE = 'private feature contact requires valid box witnesses';
export const WITNESS_TOLERANCE_M = 1e-12;
export const DUPLICATE_TOLERANCE_M = 1e-12;
export const basis = (b) => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => rotate(b.orientation, v));
export const extents = (b) => b.shape.halfExtentsM;
export function unit(v) {
    const n = Math.hypot(...v);
    if (!Number.isFinite(n) || n < 1e-12)
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);
    return scale(v, 1 / n);
}
export function point(key, a, b, n) {
    const gap = dot(sub(b, a), n);
    const result = { key, witnessAM: [...a], witnessBM: [...b],
        midpointM: scale(add(a, b), .5), normalGapM: gap, pointPenetrationM: Math.max(0, -gap) };
    if (![...a, ...b, ...result.midpointM, gap, result.pointPenetrationM].every(Number.isFinite)
        || gap > WITNESS_TOLERANCE_M)
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);
    return result;
}
