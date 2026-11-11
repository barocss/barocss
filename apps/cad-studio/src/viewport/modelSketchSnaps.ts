import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { modelSnaps, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import type { SketchPlane } from '@barocss/cad-model/sketch/plane';

export interface ModelSketchSnaps {
  bodies: readonly BodyResult[];
  hidden: ReadonlySet<number> | undefined;
  planeKey: string;
  points: SnapPoint[];
}

export function currentModelSketchSnaps(cache: ModelSketchSnaps | null, bodies: readonly BodyResult[], hidden: ReadonlySet<number> | undefined, planeKey: string | null): boolean {
  return cache !== null && cache.bodies === bodies && cache.hidden === hidden && cache.planeKey === planeKey;
}

/** The viewport supplies a new hidden-index set when it changes the visible bodies. */
export function modelSketchSnaps(cache: ModelSketchSnaps | null, bodies: readonly BodyResult[], hidden: ReadonlySet<number> | undefined, plane: SketchPlane): ModelSketchSnaps {
  const planeKey = JSON.stringify(plane);
  if (cache && currentModelSketchSnaps(cache, bodies, hidden, planeKey)) return cache;
  const visible = bodies.flatMap((body, index) => hidden?.has(index) ? [] : [body.mesh]);
  return { bodies, hidden, planeKey, points: modelSnaps(visible, plane) };
}
