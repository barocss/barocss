import { part, param, sewSpec, type RawNurbsSurface, type SewOptions, type FeatureSpec } from '../dist/api/index.js';
const surface = {
  degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
  controlPoints: [[[0, 0, 0], [0, 10, 0]], [[20, 0, 0], [20, 10, 0]]], weights: [[1, 1], [1, 1]],
} as const satisfies RawNurbsSurface;
const surfaces: readonly RawNurbsSurface[] = [surface, surface];
const options: SewOptions = { tol: 0.01 };
part().sew(surfaces, options).sew(surfaces);
const spec: Extract<FeatureSpec, { command: 'sew' }> = sewSpec(surfaces);
const tuple: readonly [number, number, number] = spec.surfaces[0].controlPoints[0][0];
void tuple;
// @ts-expect-error Sew tolerance cannot store a parameter reference.
part().sew(surfaces, { tol: param('T') });
// @ts-expect-error Sew tolerance is numeric.
sewSpec(surfaces, { tol: '0.01' });
// @ts-expect-error Owned snapshot coefficients are readonly.
spec.surfaces[0].controlPoints[0][0][0] = 1;
// @ts-expect-error Owned snapshot order is readonly.
spec.surfaces.reverse();
