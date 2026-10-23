import { validateCurve, validateSurface } from './math.js';
import type { Curve, Point, Surface } from '../types.js';

export type SurfaceBoundary = 'v-min' | 'u-max' | 'v-max' | 'u-min';
export interface SurfaceBoundaryOptions { boundary: SurfaceBoundary; id: string }

function optionsData(options: SurfaceBoundaryOptions): SurfaceBoundaryOptions {
  if (options === null || typeof options !== 'object') throw new Error('Boundary options are required');
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('Boundary options must be plain data');
  const keys = Reflect.ownKeys(options);
  if (keys.length !== 2 || !keys.includes('boundary') || !keys.includes('id')) throw new Error('Boundary options require only boundary and id');
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (!('value' in descriptors.boundary) || !('value' in descriptors.id)) throw new Error('Boundary options cannot contain accessors');
  const boundary = descriptors.boundary.value, id = descriptors.id.value;
  if (boundary !== 'v-min' && boundary !== 'u-max' && boundary !== 'v-max' && boundary !== 'u-min') throw new Error('Unsupported surface boundary');
  if (typeof id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) throw new Error('Boundary curve ID must be a supported identifier');
  return { boundary, id };
}

function reverseKnots(knots: number[], degree: number, count: number): number[] {
  const a = knots[degree], b = knots[count];
  const result = knots.slice().reverse().map(knot => {
    if (knot === a) return b;
    if (knot === b) return a;
    // a+b-k without an overflowing a+b or an overflowing long interval.
    const difference = a - knot;
    const reflected = Number.isFinite(difference) ? difference + b : a + (b - knot);
    if (!Number.isFinite(reflected) || reflected <= a || reflected >= b) throw new Error('Reflected knot is not representable inside the original domain');
    return reflected;
  });
  for (let i = 1; i < result.length; i++) {
    const originalEqual = knots[knots.length - i] === knots[knots.length - i - 1];
    if (result[i] < result[i - 1] || (result[i] === result[i - 1]) !== originalEqual) throw new Error('Reflection collapsed or reordered distinct knots');
  }
  return result;
}

/** Four geometric parameter boundaries, with no trim/wire/topology claim. */
export function extractSurfaceBoundary(surface: Surface, options: SurfaceBoundaryOptions): Curve {
  validateSurface(surface);
  const { boundary, id } = optionsData(options);
  const variesU = boundary === 'v-min' || boundary === 'v-max';
  const decreasing = boundary === 'v-max' || boundary === 'u-min';
  const countU = surface.controlPoints.length, countV = surface.controlPoints[0].length;
  const count = variesU ? countU : countV;
  const degree = variesU ? surface.degreeU : surface.degreeV;
  const sourceKnots = variesU ? surface.knotsU : surface.knotsV;
  const knots = decreasing ? reverseKnots(sourceKnots, degree, count) : [...sourceKnots];
  const controlPoints: Point[] = [], weights: number[] = [];
  for (let i = 0; i < count; i++) {
    const index = decreasing ? count - 1 - i : i;
    const row = variesU ? index : boundary === 'u-max' ? countU - 1 : 0;
    const column = variesU ? boundary === 'v-max' ? countV - 1 : 0 : index;
    const point = surface.controlPoints[row][column];
    controlPoints.push([point[0], point[1], point[2]]);
    weights.push(surface.weights[row][column]);
  }
  const curve: Curve = { kind: 'curve', id, degree, knots, controlPoints, weights };
  validateCurve(curve);
  return curve;
}
