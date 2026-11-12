import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { modelCrossingSnaps, modelSnaps, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import type { SketchPlane } from '@barocss/cad-model/sketch/plane';

export interface ModelSketchSnaps {
  bodies: readonly BodyResult[];
  hidden: ReadonlySet<number> | undefined;
  planeKey: string;
  crossingBodies: readonly BodyResult[] | undefined;
  points: SnapPoint[];
  crossings: SnapPoint[];
}

export function currentModelSketchSnaps(cache: ModelSketchSnaps | null, bodies: readonly BodyResult[], hidden: ReadonlySet<number> | undefined, planeKey: string | null, crossingBodies?: readonly BodyResult[]): boolean {
  return cache !== null && cache.bodies === bodies && cache.hidden === hidden && cache.planeKey === planeKey && cache.crossingBodies === crossingBodies;
}

/** The viewport supplies a new hidden-index set when it changes the visible bodies. */
export function modelSketchSnaps(cache: ModelSketchSnaps | null, bodies: readonly BodyResult[], hidden: ReadonlySet<number> | undefined, plane: SketchPlane, crossingBodies?: readonly BodyResult[]): ModelSketchSnaps {
  const planeKey = JSON.stringify(plane);
  if (cache && currentModelSketchSnaps(cache, bodies, hidden, planeKey, crossingBodies)) return cache;
  const visible = bodies.flatMap((body, index) => hidden?.has(index) ? [] : [body.mesh]);
  const crossingMeshes = crossingBodies ? bodies.flatMap((body, index) =>
    body === crossingBodies[index] && body.ref?.side === 'solid' && !hidden?.has(index) ? [body.mesh] : []) : [];
  return { bodies, hidden, planeKey, crossingBodies, points: modelSnaps(visible, plane), crossings: modelCrossingSnaps(crossingMeshes, plane) };
}
