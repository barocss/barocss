import { emptyDoc, type StudioDoc } from '../../src/engine/doc';
import type { GravityExperimentOptions } from '../../src/api/experimentInput';

export const KEY = 'base~rod';
export const options = (angle = 0, gravity: [number, number, number] = [0, 0, -9806.65]): GravityExperimentOptions => ({ values: { [KEY]: angle }, gravity });

/** The original gravity experiment's pure authored fixture; importing it executes no tests or calculations. */
export function rodDoc(): StudioDoc {
  const rod: StudioDoc = { ...emptyDoc(), nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, -5], max: [100, 5] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, 0, -5] },
  ], bodies: { b1: { material: 'al6061' } } };
  return { ...emptyDoc(), instances: [{ id: 'rod', name: 'Rod', doc: rod, position: [0, 0, 0], rotation: [0, 0, 0] }],
    mates: [
      { id: 'axis', kind: 'concentric', a: { part: 'base', face: 'origin:xz', at: {} }, b: { part: 'rod', face: 'origin:xz', at: {} } },
      { id: 'seat', kind: 'coincident', a: { part: 'base', face: 'origin:xz' }, b: { part: 'rod', face: 'origin:xz' } },
    ], robot: { version: 1, base: 'base' } };
}
