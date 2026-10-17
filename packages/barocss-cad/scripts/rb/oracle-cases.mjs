// The exact-oracle families (D25): part documents with their exact volumes and centroids, from the independent
// integrations of oracle-cylinder-box.mjs and oracle-cylinder-pair.mjs. Used by seed.mjs (the corpus), by
// property.mjs (random members, nightly) and for the conformance fixtures.
import { cylinderBoxIntersection, cylinderMass } from './oracle-cylinder-box.mjs';
import { crossedCylinders, crossedCylinderFeatures } from './oracle-cylinder-pair.mjs';

const ROT = { x: (c, s) => [[1, 0, 0], [0, c, -s], [0, s, c]], y: (c, s) => [[c, 0, s], [0, 1, 0], [-s, 0, c]], z: (c, s) => [[c, -s, 0], [s, c, 0], [0, 0, 1]] };
/** RB4's counterexample's cylinder and box (the box before its turn). */
export const RB4_CYLINDER = { cx: 2.987, cy: 2.504, r: 4.055, z0: -1.544, z1: -1.544 + 4.56 };
export const RB4_BOX = { min: [-3.371, -3.944, 0.247], max: [1.79, 2.502, 0.247 + 4.469] };

/**
 * The cylinder moved so its wall reaches `gap` into the turned box past the box's outermost edge on one side
 * (gap < 0: clear of it by that much): the edge grazes the wall. An X turn keeps the box's edges along x, so
 * the wall comes in along y; a Y or Z turn, along x.
 */
export function grazing(cylinder, box, axis, angleDegrees, gap) {
  const t = angleDegrees * Math.PI / 180, R = ROT[axis](Math.cos(t), Math.sin(t)), corners = [];
  for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) {
    const p = [i ? box.max[0] : box.min[0], j ? box.max[1] : box.min[1], k ? box.max[2] : box.min[2]];
    corners.push(R.map(row => row[0] * p[0] + row[1] * p[1] + row[2] * p[2]));
  }
  const side = axis === 'x' ? 1 : 0, c = corners.reduce((m, q) => q[side] < m[side] ? q : m);
  const z = axis === 'z' ? (box.min[2] + box.max[2]) / 2 : c[2], r = cylinder.r, out = { r, z0: z - 2.3, z1: z + 2.6 };
  if (axis === 'x') return { ...out, cy: c[1] + gap - r, cx: (box.min[0] + box.max[0]) / 2 + 0.37 };
  return { ...out, cx: c[0] + gap - r, cy: axis === 'y' ? (box.min[1] + box.max[1]) / 2 + 0.37 : c[1] };
}

/**
 * An upright cylinder (`cylinder`: cx, cy, r, z0, z1) and a box (`box`: min, max) turned about `axis` by
 * `angleDegrees` (pivot at the origin), combined by `op` ('intersect' | 'difference'): the document's
 * features and the exact { volume, centroid } (volume 0: no output).
 */
export function cylinderBoxCase(cylinder, box, axis, angleDegrees, op) {
  const turn = { axis, angleDegrees }, meet = cylinderBoxIntersection(cylinder, box, turn), whole = cylinderMass(cylinder);
  const exact = op === 'intersect' ? meet : { volume: whole.volume - meet.volume, moment: whole.moment.map((m, k) => m - meet.moment[k]) };
  const features = [
    { id: 'As', kind: 'sketch', profile: 'circle', center: [cylinder.cx, cylinder.cy], radius: cylinder.r }, { id: 'A', kind: 'extrude', sketch: 'As', height: cylinder.z1 - cylinder.z0, from: cylinder.z0 },
    { id: 'Bs', kind: 'sketch', profile: 'rectangle', min: box.min.slice(0, 2), max: box.max.slice(0, 2) }, { id: 'B0', kind: 'extrude', sketch: 'Bs', height: box.max[2] - box.min[2], from: box.min[2] },
    { id: 'B', kind: 'rotate', target: 'B0', axis, angleDegrees, pivot: [0, 0, 0] }, { id: 'X', kind: op, target: 'A', tool: 'B' },
  ];
  return { features, volume: exact.volume, centroid: exact.volume > 0 ? exact.moment.map(m => m / exact.volume) : null, error: meet.error };
}

/** Two cylinders (radii a, b) whose axes cross at `angleDegrees`, intersected: features and the exact values. */
export function crossedCase(a, b, angleDegrees, at = { cx: 1.237, cy: -0.481, by: 0.913 }) {
  const { meet, features } = crossedCylinderFeatures({ a, b, angleDegrees, ...at });
  return { features: [...features, { id: 'X', kind: 'intersect', target: 'A', tool: 'B' }], volume: crossedCylinders(a, b, angleDegrees), centroid: meet };
}

/**
 * How closely a case's volume can be expected: relative 1e-6 (the quadrature's stated accuracy, D25), but not
 * below 1e-12 mm³ (binary64 rounding of coordinates ~10 mm, cubed): a sliver's volume is known absolutely.
 */
export const VOLUME_TOL = { relTol: 1e-6, absTol: 1e-12 };
