import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';

/** Strictly bounded admission of the four REPRESENTED IEEE-754 endpoints. */
export type ExactSegmentPointsV1 =
  | { readonly status: 'admitted'; readonly points: readonly [Binary64PointV1, Binary64PointV1, Binary64PointV1, Binary64PointV1] }
  | { readonly status: 'unsupported'; readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' | 'degenerate-segment' };

/** Never use caller endpoints again after this snapshot; Proxies may lie on get. */
function ownPointSnapshot(value: unknown): Binary64PointV1 | null {
  if (value === null || typeof value !== 'object') return null;
  try {
    if (Array.isArray(value)) return null; // revoked Proxy may throw
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const own = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(own); // one observed own descriptor inventory
    if (keys.length !== 2 || !['x', 'y'].every(k => Object.hasOwn(own, k) &&
      'value' in own[k] && own[k].enumerable && typeof own[k].value === 'number')) return null;
    return { x: own.x.value as number, y: own.y.value as number };
  } catch {
    return null; // throwing Proxy reflection traps fail closed
  }
}

export function snapshotExactSegmentPointsV1(
  a: unknown, b: unknown, c: unknown, d: unknown,
  maxAbsCoordinateMM = 10000,
): ExactSegmentPointsV1 {
  if (typeof maxAbsCoordinateMM !== 'number' || !Number.isFinite(maxAbsCoordinateMM) ||
      maxAbsCoordinateMM <= 0 || maxAbsCoordinateMM > 10000)
    return { status: 'unsupported', reason: 'invalid-input' };
  const pa = ownPointSnapshot(a), pb = ownPointSnapshot(b),
    pc = ownPointSnapshot(c), pd = ownPointSnapshot(d);
  if (!pa || !pb || !pc || !pd)
    return { status: 'unsupported', reason: 'invalid-input' };
  const points = [pa, pb, pc, pd] as const;
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return { status: 'unsupported', reason: 'non-finite-coordinate' };
  if (points.some(p => Math.abs(p.x) > maxAbsCoordinateMM || Math.abs(p.y) > maxAbsCoordinateMM))
    return { status: 'unsupported', reason: 'out-of-range-coordinate' };
  if (pa.x === pb.x && pa.y === pb.y || pc.x === pd.x && pc.y === pd.y)
    return { status: 'unsupported', reason: 'degenerate-segment' };
  return { status: 'admitted', points };
}
