import { segmentDistance } from '@barocss/cad-model/engine/geom2';
import type { P2 } from '@barocss/cad-model/sketch/profile';

const toleranceCSS = 0.25;
const maxDepth = 9;

/** Flatten quadratic or cubic poles after an affine projection. At most 512 chords. */
export function projectedBezier(poles: readonly P2[]): P2[] {
  if ((poles.length !== 3 && poles.length !== 4) || poles.some(point => !point.every(Number.isFinite))) return [];
  const path = [poles[0]];
  function append(control: readonly P2[], depth: number) {
    const start = control[0], end = control[control.length - 1];
    // The curve stays in the control hull. Use a finite chord to include collinear reversals.
    if (depth === maxDepth || control.slice(1, -1).every(point => segmentDistance(point, start, end) <= toleranceCSS)) {
      path.push(end);
      return;
    }
    const left = [start], right = [end];
    let level = control;
    while (level.length > 1) {
      const previous = level;
      level = previous.slice(1).map((point, i): P2 => [
        previous[i][0] / 2 + point[0] / 2,
        previous[i][1] / 2 + point[1] / 2,
      ]);
      left.push(level[0]);
      right.push(level[level.length - 1]);
    }
    append(left, depth + 1);
    append(right.reverse(), depth + 1);
  }
  append(poles, 0);
  return path;
}
