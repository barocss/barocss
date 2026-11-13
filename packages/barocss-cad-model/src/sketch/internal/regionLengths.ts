import type { LoopSegment, RegionLengths } from '../../engine/doc';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A recipe must describe the same literal native sides and already satisfy its constraints. */
export function matchesRegionLengths(value: unknown, loop: readonly LoopSegment[], sides: readonly string[]): value is RegionLengths {
  const count = loop.length;
  if (count < 3 || sides.length !== count || new Set(sides).size !== count
    || !isRecord(value) || Object.keys(value).length !== 4) return false;
  const { sides: ids, points, lengths, hv } = value;
  if (!Array.isArray(ids) || ids.length !== count || !sides.every((id, i) => id && id === ids[i])
    || !Array.isArray(points) || points.length !== count || !isRecord(lengths)
    || !isRecord(hv) || Object.keys(hv).length !== 2 || !Array.isArray(hv.h) || !Array.isArray(hv.v)) return false;
  if (!loop.every(({ kind, start: [x, y] }, i) => {
    const p = points[i];
    return kind === 'line' && Array.isArray(p) && p.length === 2
      && Number.isFinite(x) && Number.isFinite(y) && p[0] === x && p[1] === y;
  })) return false;
  const locks = [...hv.h, ...hv.v];
  const isIndex = (i: number) => Number.isInteger(i) && i >= 0 && i < count;
  if (!locks.every(isIndex) || new Set(locks).size !== locks.length) return false;
  const entries = Object.entries(lengths);
  const delta = (i: number, axis: number) => points[(i + 1) % count][axis] - points[i][axis];
  const tolerance = 1e-7; // Numerical sketch solver linear residual, in mm.
  return hv.h.every(i => Math.abs(delta(i, 1)) <= tolerance)
    && hv.v.every(i => Math.abs(delta(i, 0)) <= tolerance)
    && entries.length > 0 && entries.every(([key, length]) => {
      const i = Number(key);
      return key === String(i) && isIndex(i) && typeof length === 'number' && Number.isFinite(length) && length >= 0.001
        && Math.abs(Math.hypot(delta(i, 0), delta(i, 1)) - length) <= tolerance;
    });
}
