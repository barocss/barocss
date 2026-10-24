// Closed-form geometry for the documentation's two Z-prismatic examples, not a Boolean engine.
export const HEIGHT = 10;
export const RADIUS = 3;
export const OPERATIONS = ['union', 'difference', 'intersect'];

function circlePrimitive(x) {
  const q = Math.max(-RADIUS, Math.min(RADIUS, x));
  return q * Math.sqrt(Math.max(0, RADIUS ** 2 - q ** 2)) + RADIUS ** 2 * Math.asin(q / RADIUS);
}

export function exampleGeometry(shape, x) {
  if (!['box', 'cylinder'].includes(shape) || !Number.isFinite(x)) throw new TypeError('Expected box or cylinder and a finite X position');
  const bArea = shape === 'box' ? 100 : Math.PI * RADIUS ** 2;
  const common = shape === 'box'
    ? Math.max(0, Math.min(10, x + 10) - Math.max(0, x)) * 10
    : Math.max(0, circlePrimitive(10 - x) - circlePrimitive(-x));
  const points = [];
  if (shape === 'cylinder') for (const wall of [0, 10]) {
    const square = RADIUS ** 2 - (wall - x) ** 2;
    if (square < 0) continue;
    const d = Math.sqrt(square);
    points.push([wall, 5 - d]);
    if (d > 0) points.push([wall, 5 + d]);
  }
  return {
    bArea, common, points,
    regions: [
      { id: 'a', label: 'A only', inA: true, inB: false, area: 100 - common },
      { id: 'both', label: 'A and B', inA: true, inB: true, area: common },
      { id: 'b', label: 'B only', inA: false, inB: true, area: bArea - common },
    ],
    areas: { union: 100 + bArea - common, difference: 100 - common, intersect: common },
  };
}

export function keepRegion(operation, region) {
  if (!OPERATIONS.includes(operation)) throw new TypeError('Unknown operation');
  return operation === 'union' ? region.inA || region.inB
    : operation === 'difference' ? region.inA && !region.inB : region.inA && region.inB;
}

export function numberLabel(n) {
  return (Math.abs(n) < 0.0005 ? 0 : n).toFixed(3).replace(/\.?0+$/, '');
}

export const planX = x => 40 + (x + 12) * 8;
export const planY = y => 176 - y * 8;
export const project = (x, y, z) => [132 + 6 * x + 3.4 * y, 160 + 1.7 * x - 2.8 * y - 5.8 * z];
export const polygon = points => points.map(p => p.join(',')).join(' ');

export function cubeFaces(x) {
  return [
    [[x, 0, 0], [x + 10, 0, 0], [x + 10, 0, 10], [x, 0, 10]],
    [[x + 10, 0, 0], [x + 10, 10, 0], [x + 10, 10, 10], [x + 10, 0, 10]],
    [[x, 0, 10], [x + 10, 0, 10], [x + 10, 10, 10], [x, 10, 10]],
  ].map(face => polygon(face.map(p => project(...p))));
}

export function cylinderSide(x) {
  const points = [], start = Math.atan2(3.4, 6) + Math.PI;
  for (let i = 0; i <= 32; i++) {
    const t = start + Math.PI * i / 32;
    points.push(project(x + RADIUS * Math.cos(t), 5 + RADIUS * Math.sin(t), 0));
  }
  for (let i = 32; i >= 0; i--) {
    const t = start + Math.PI * i / 32;
    points.push(project(x + RADIUS * Math.cos(t), 5 + RADIUS * Math.sin(t), HEIGHT));
  }
  return polygon(points);
}
