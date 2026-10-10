import { prepareBooleanShellBuffers } from '@barocss/gpu';
import type { BooleanShellLeafRef, MeshCamera } from '@barocss/gpu';
import type { ViewerShellState } from './shell-graph.js';
import { prepareScreenTriangleRay } from './screen-triangle.js';

type Vec3 = [number, number, number];
export interface ViewerShellPick {
  ref: BooleanShellLeafRef;
  triangleIndex: number;
  displayPositionScene: Vec3;
  depthScene: number;
  approximate: true;
  ambiguous: boolean;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer Shell pick: ' + message);
}
function point(input: unknown): { xCss: number; yCss: number } {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'point must be plain own data');
  const keys = Reflect.ownKeys(input);
  check(keys.length === 2 && keys.every(key => key === 'xCss' || key === 'yCss'), 'point requires exact xCss/yCss fields');
  const values: number[] = [];
  for (const key of ['xCss', 'yCss']) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    check(field && field.enumerable && 'value' in field && typeof field.value === 'number'
      && Number.isFinite(field.value) && field.value >= 0 && field.value <= 4096, key + ' must be own finite data0..4096');
    values.push(field.value);
  }
  try { structuredClone(input); }
  catch (cause) { throw new RangeError('Viewer Shell pick: point cannot be copied', { cause }); }
  return { xCss: values[0], yCss: values[1] };
}
function compareRef(a: BooleanShellLeafRef, b: BooleanShellLeafRef): number {
  for (const key of ['graphId', 'graphRevision', 'featureId', 'outputSlotId'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}

/** Filled F32 triangle observation only; edges/raster depth/native inverse are not queried. */
export function pickViewerShell(shell: ViewerShellState, input: unknown, camera: MeshCamera,
  mmToSceneUnit: number, backingWidth: number, backingHeight: number,
  cssWidth: number, cssHeight: number): ViewerShellPick | null {
  const query = point(input);
  check(Number.isFinite(cssWidth) && Number.isFinite(cssHeight) && cssWidth > 0 && cssHeight > 0
    && cssWidth <= 4096 && cssHeight <= 4096, 'CSS bounding-box dimensions must be finite positive values≤4096');
  check(query.xCss <= cssWidth && query.yCss <= cssHeight, 'point is outside the canvas CSS bounding box');
  check(Number.isFinite(backingWidth) && Number.isFinite(backingHeight) && backingWidth > 0 && backingHeight > 0,
    'backing dimensions must be finite and positive');
  const ray = prepareScreenTriangleRay(query, camera, backingWidth, backingHeight, cssWidth, cssHeight,
    'Viewer Shell pick: ');
  const candidates: ViewerShellPick[] = [];
  for (const entry of shell.scene.entries) {
    const buffers = prepareBooleanShellBuffers(entry.native, { mmToSceneUnit, translate: [0, 0, 0] });
    let best: ViewerShellPick | null = null;
    const vertex = (index: number): Vec3 => [buffers.positions[index * 3], buffers.positions[index * 3 + 1], buffers.positions[index * 3 + 2]];
    for (let offset = 0; offset < buffers.indices.length; offset += 3) {
      const fraction = ray.intersection(
        vertex(buffers.indices[offset]), vertex(buffers.indices[offset + 1]), vertex(buffers.indices[offset + 2]));
      if (fraction === null) continue;
      const { displayPositionScene, depthScene } = ray.observation(fraction);
      if (depthScene <= 0) continue;
      const triangleIndex = offset / 3;
      if (!best || depthScene < best.depthScene || depthScene === best.depthScene && triangleIndex < best.triangleIndex)
        best = { ref: entry.ref, triangleIndex, displayPositionScene, depthScene, approximate: true, ambiguous: false };
    }
    if (best) candidates.push(best);
  }
  if (!candidates.length) return null;
  const minimum = Math.min(...candidates.map(candidate => candidate.depthScene));
  const eligible = candidates.filter(candidate => ray.finite(candidate.depthScene - minimum) <= 1e-6);
  eligible.sort((a, b) => compareRef(a.ref, b.ref));
  return structuredClone({ ...eligible[0], ambiguous: eligible.length > 1 });
}
