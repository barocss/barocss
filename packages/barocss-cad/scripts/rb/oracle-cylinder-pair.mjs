// An independent oracle (D25): |A ∩ B| of two cylinders whose axes cross at an angle α, long enough that their
// caps stay clear. Sliced by planes parallel to both axes at a distance t from them, each cylinder leaves a strip
// 2√(r² − t²) wide; the two strips cross in a parallelogram of area 4√(a² − t²)√(b² − t²) / sin α. So
// |A ∩ B| = ∫ 4√(a² − t²)√(b² − t²) dt / sin α over |t| ≤ min(a, b) (16 r³ / (3 sin α) when a = b), by
// Gauss–Legendre in φ (t = b sin φ: smooth). The centroid is where the axes cross (point symmetry).
//   node scripts/rb/oracle-cylinder-pair.mjs

function gaussLegendre(n) {
  const x = [], w = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      d = n * (t * p1 - p0) / (t * t - 1); const dt = p1 / d; t -= dt;
      if (Math.abs(dt) < 1e-16) break;
    }
    x.push(t); w.push(2 / ((1 - t * t) * d * d));
  }
  return { x, w };
}

/** |A ∩ B| for crossing axes at `angleDegrees`, radii a and b. */
export function crossedCylinders(a, b, angleDegrees) {
  const r = Math.min(a, b), R = Math.max(a, b), sinA = Math.sin(angleDegrees * Math.PI / 180), { x, w } = gaussLegendre(48);
  let v = 0;
  // t = r sin φ, φ ∈ [−π/2, π/2]: 4 √(R² − t²) · r cos φ · r cos φ dφ.
  for (let i = 0; i < x.length; i++) { const phi = x[i] * Math.PI / 2, t = r * Math.sin(phi); v += 4 * Math.sqrt(R * R - t * t) * r * r * Math.cos(phi) ** 2 * w[i] * Math.PI / 2; }
  return v / sinA;
}

/**
 * A part document for it: A upright about (cx, cy), B a cylinder about the same vertical line turned about X
 * by the angle (pivot at the origin), both centred on the point where their axes cross. Returns the document
 * features and that point.
 */
export function crossedCylinderFeatures({ a, b, angleDegrees, cx, cy, by }) {
  const t = angleDegrees * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  // B's axis before the turn: x = cx, y = by; after it, (cx, by c − z s, by s + z c), on A's axis at z = (by c − cy)/s.
  const zb = (by * c - cy) / s, meet = [cx, cy, by * s + zb * c], half = 2 * (a + b) / s + a + b;
  return { meet, features: [
    { id: 'As', kind: 'sketch', profile: 'circle', center: [cx, cy], radius: a }, { id: 'A', kind: 'extrude', sketch: 'As', height: 2 * half, from: meet[2] - half },
    { id: 'Bs', kind: 'sketch', profile: 'circle', center: [cx, by], radius: b }, { id: 'B0', kind: 'extrude', sketch: 'Bs', height: 2 * half, from: zb - half },
    { id: 'B', kind: 'rotate', target: 'B0', axis: 'x', angleDegrees, pivot: [0, 0, 0] },
  ] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [a, b, ang] of [[2, 2, 90], [2, 2, 30], [3, 1.7, 60]]) console.log(a, b, ang, crossedCylinders(a, b, ang).toFixed(12), a === b ? (16 * a ** 3 / (3 * Math.sin(ang * Math.PI / 180))).toFixed(12) : '');
}
