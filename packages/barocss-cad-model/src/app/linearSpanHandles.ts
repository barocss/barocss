import { CadPartLimits } from '@barocss/cad';
import type { Axis } from '../engine/doc';
import { linearSpanSpacing } from '../engine/linearSpanPattern';
import type { Vec3 } from '../engine/mesh';
import type { HandleSpec } from './commands';

export function linearSpanHandles(seed: { min: Vec3; max: Vec3 }, axis: Axis, span: number, count: number,
  maxCount: number = CadPartLimits.copies): HandleSpec[] {
  const k = 'xyz'.indexOf(axis);
  const input = linearSpanSpacing(span, count, maxCount);
  if (k < 0 || 'code' in input) return [];
  const centre = seed.min.map((v, i) => (v + seed.max[i]) / 2) as Vec3;
  const dir: Vec3 = [0, 0, 0];
  dir[k] = 1;
  const at = (d: number): Vec3 => {
    const point: Vec3 = [...centre];
    point[k] = d;
    return point;
  };
  return [
    { key: 'span', at: at(centre[k] + span), dir },
    { key: 'count', at: at(seed.max[k] + span), dir, scale: 1 / Math.max(1, input.spacing), min: 2, max: maxCount, unit: '', screenOffset: 16 },
  ];
}
