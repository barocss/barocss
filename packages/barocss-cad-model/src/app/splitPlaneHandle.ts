import type { HandleSpec } from './commands';

/** The authored equation is normal · point = at, so one world mm changes At by |normal|. */
export function splitPlaneHandle(
  box: { min: readonly number[]; max: readonly number[] },
  normal: readonly [number, number, number],
  at: number,
): HandleSpec[] {
  const length = Math.hypot(...normal);
  if (!Number.isFinite(length) || length <= 1e-9 || !Number.isFinite(at)) return [];
  const centre: HandleSpec['at'] = [0, 0, 0], dir: HandleSpec['dir'] = [0, 0, 0];
  let lo = 0, hi = 0, projection = 0;
  for (const axis of [0, 1, 2] as const) {
    const a = normal[axis] * box.min[axis], b = normal[axis] * box.max[axis];
    lo += Math.min(a, b);
    hi += Math.max(a, b);
    centre[axis] = (box.min[axis] + box.max[axis]) / 2;
    dir[axis] = normal[axis] / length;
    projection += dir[axis] * centre[axis];
  }
  const min = lo + 0.5 * length, max = hi - 0.5 * length;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return [];
  const shift = at / length - projection;
  const root: HandleSpec['at'] = [centre[0] + dir[0] * shift, centre[1] + dir[1] * shift, centre[2] + dir[2] * shift];
  return [{ key: 'at', at: root, dir, scale: length, min, max, step: 0.5 }];
}
