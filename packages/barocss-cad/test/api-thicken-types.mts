import { part, param, thickenSpec, type RawNurbsSurface, type ThickenOptions, type FeatureSpec } from '../dist/api/index.js';
const surface = {
  degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[0, 0, 0], [0, 10, 0]], [[20, 0, 0], [20, 10, 0]]], weights: [[1, 1], [1, 1]],
} as const satisfies RawNurbsSurface;
const options: ThickenOptions = { t: param('T'), side: 'both' };
part().parameter('T', 2).thicken(surface, options);
const spec: Extract<FeatureSpec, { command: 'thicken' }> = thickenSpec(surface, { t: 2 });
const tuple: readonly [number, number, number] = spec.surface.controlPoints[0][0];
void tuple;
// @ts-expect-error The snapshot has no mutable coefficient arrays.
spec.surface.controlPoints[0][0][0] = 1;
// @ts-expect-error Only thickness takes a parameter.
part().thicken(surface, { t: 2, side: param('T') });
// @ts-expect-error Side is a closed enum.
thickenSpec(surface, { t: 2, side: 'other' });
