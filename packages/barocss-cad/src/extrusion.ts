import { validateCurve } from './math.js';
import type { Curve, Point, Surface } from './types.js';

export interface ExtrusionOptions {
  id: string;
  vector: Point;
}

interface Dyadic { integer: bigint; exponent: number }

// A finite binary64 number is an exact integer times a power of two. Exact
// determinants prevent underflow or cancellation from classifying a narrow
// non-collinear construction as wholly collapsed. No geometric epsilon is used.
function dyadic(value: number): Dyadic {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const exponentBits = Number((bits >> 52n) & 2047n);
  const fraction = bits & ((1n << 52n) - 1n);
  const integer = exponentBits === 0 ? fraction : (1n << 52n) | fraction;
  return {
    integer: bits >> 63n === 0n ? integer : -integer,
    exponent: exponentBits === 0 ? -1074 : exponentBits - 1023 - 52,
  };
}

function difference(a: Dyadic, b: Dyadic): Dyadic {
  const exponent = Math.min(a.exponent, b.exponent);
  return {
    integer: (a.integer << BigInt(a.exponent - exponent)) - (b.integer << BigInt(b.exponent - exponent)),
    exponent,
  };
}

function product(a: Dyadic, b: Dyadic): Dyadic {
  return { integer: a.integer * b.integer, exponent: a.exponent + b.exponent };
}

function equal(a: Dyadic, b: Dyadic): boolean {
  return difference(a, b).integer === 0n;
}

function whollyCollinear(curve: Curve, vector: Point): boolean {
  const direction = vector.map(dyadic);
  const origin = curve.controlPoints[0].map(dyadic);
  for (let index = 1; index < curve.controlPoints.length; index++) {
    const offset = curve.controlPoints[index].map((value, axis) => difference(dyadic(value), origin[axis]));
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      if (!equal(product(offset[axis], direction[next]), product(offset[next], direction[axis]))) return false;
    }
  }
  return true;
}

/**
 * Construct an open rational surface S(u,v) = C(u) + vD, v in [0,1].
 * Output poles use binary64 addition. This operation supplies no caps, solid
 * topology or regularity certificate; a folded/singular surface can fail preview.
 */
export function extrudeCurve(curve: Curve, options: ExtrusionOptions): Surface {
  validateCurve(curve);
  if (curve.controlPoints.length > 16) throw new Error('Extrusion supports at most 16 curve control points');
  if (!options || typeof options !== 'object') throw new Error('Extrusion options are required');
  const { id, vector } = options;
  if (typeof id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id) || id === curve.id) {
    throw new Error('Extrusion output ID must be a supported ASCII identifier distinct from the curve ID');
  }
  if (!Array.isArray(vector) || vector.length !== 3) throw new Error('Extrusion vector must have three coordinates');
  let nonzero = false;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(vector[axis])) throw new Error('Extrusion vector must be finite');
    nonzero ||= vector[axis] !== 0;
  }
  if (!nonzero) throw new Error('Extrusion vector must be nonzero');
  let translated = false;
  // Preflight every translated pole before allocating the output geometry.
  for (const point of curve.controlPoints) {
    for (let axis = 0; axis < 3; axis++) {
      const value = point[axis] + vector[axis];
      if (!Number.isFinite(value) || Math.abs(value) > 1e6) throw new Error('Extruded coordinates must be finite and within 1e6 mm');
      translated ||= value !== point[axis];
    }
  }
  if (!translated) throw new Error('Extrusion vector produces no representable pole displacement');
  if (whollyCollinear(curve, vector)) throw new Error('Extrusion is wholly collapsed: all pole displacements are collinear with the vector');
  return {
    kind: 'surface', id, degreeU: curve.degree, degreeV: 1,
    knotsU: [...curve.knots], knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point): Point[] => [
      [point[0], point[1], point[2]],
      [point[0] + vector[0], point[1] + vector[1], point[2] + vector[2]],
    ]),
    weights: curve.weights.map((weight) => [weight, weight]),
  };
}
