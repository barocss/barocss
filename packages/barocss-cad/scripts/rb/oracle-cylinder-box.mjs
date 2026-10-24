// An independent oracle (RB4, D25): |A ∩ B| and its first moments for an upright cylinder A and a box B turned
// about X, Y or Z (the kernel's `rotate`: right-handed, about a pivot), by integration that shares nothing with
// the kernel. Along z the inside of A ∩ B is one interval whose ends are linear in (x, y) (a max and a min of the
// slab planes); at fixed x its length, z-moment and y-moment are piecewise polynomials in y of degree ≤ 2 between
// the crossings of those lines, integrated exactly (Simpson). Over x the result is smooth between the kinks (a
// crossing line meeting the disc's rim or another crossing line), so Gauss–Legendre in φ (x = cx − r cos φ,
// smooth at the rim) on the panels between them converges to rounding. `error` is the change from 16 to 24
// points a panel.
//   node scripts/rb/oracle-cylinder-box.mjs   (prints RB4's case: |A ∩ B| = 5.652209677…)

const NEAR = 1e-14;
const ROT = {
  x: (c, s) => [[1, 0, 0], [0, c, -s], [0, s, c]],
  y: (c, s) => [[c, 0, s], [0, 1, 0], [-s, 0, c]],
  z: (c, s) => [[c, -s, 0], [s, c, 0], [0, 0, 1]],
};

/**
 * The slabs lo ≤ a·p ≤ hi bounding A ∩ B but for the disc: the box's three (turned) and the cylinder's z-range.
 * `box` is { min: [x, y, z], max: [x, y, z] } before the turn; `turn` { axis, angle, pivot } or null.
 */
function slabsOf(cylinder, box, turn) {
  const t = (turn?.angle ?? 0) * Math.PI / 180, R = ROT[turn?.axis ?? 'z'](Math.cos(t), Math.sin(t)), pv = turn?.pivot ?? [0, 0, 0];
  const slabs = [{ a: [0, 0, 1], lo: cylinder.z0, hi: cylinder.z1 }];
  for (let k = 0; k < 3; k++) {
    const a = [R[0][k], R[1][k], R[2][k]], shift = a[0] * pv[0] + a[1] * pv[1] + a[2] * pv[2] - pv[k];
    slabs.push({ a, lo: box.min[k] + shift, hi: box.max[k] + shift });
  }
  return slabs;
}

/**
 * At fixed x: the z-lines (z = α y + β, lower or upper), the y-range from vertical slabs, or null when a slab
 * excludes this x. Written into `at` (reused).
 */
function linesAt(slabs, x, at) {
  at.lower.length = 0; at.upper.length = 0; at.ylo = -Infinity; at.yhi = Infinity;
  for (const { a, lo, hi } of slabs) {
    if (Math.abs(a[2]) > NEAR) {
      const l = [-a[1] / a[2], (lo - a[0] * x) / a[2]], u = [-a[1] / a[2], (hi - a[0] * x) / a[2]];
      if (a[2] > 0) { at.lower.push(l); at.upper.push(u); } else { at.lower.push(u); at.upper.push(l); }
    } else if (Math.abs(a[1]) > NEAR) {
      const y0 = (lo - a[0] * x) / a[1], y1 = (hi - a[0] * x) / a[1];
      at.ylo = Math.max(at.ylo, Math.min(y0, y1)); at.yhi = Math.min(at.yhi, Math.max(y0, y1));
    } else if (a[0] * x < lo || a[0] * x > hi) return false;
  }
  return true;
}

const ev = (l, y) => l[0] * y + l[1];
function bounds(at, y, out) {
  let lo = -Infinity, hi = Infinity;
  for (const l of at.lower) lo = Math.max(lo, ev(l, y));
  for (const u of at.upper) hi = Math.min(hi, ev(u, y));
  out[0] = lo; out[1] = hi;
}

const B = [0, 0];
/** ∫ over y of [length, y·length, (u² − l²)/2] at fixed x, inside the disc's chord [ya, yb]: exact. */
function inner(at, ya, yb, sum) {
  sum[0] = sum[1] = sum[2] = 0;
  const lo = Math.max(ya, at.ylo), hi = Math.min(yb, at.yhi);
  if (!(hi > lo)) return;
  const lines = [...at.lower, ...at.upper], cuts = [lo, hi];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const d = lines[i][0] - lines[j][0];
    if (Math.abs(d) > 1e-15) { const y = (lines[j][1] - lines[i][1]) / d; if (y > lo && y < hi) cuts.push(y); }
  }
  cuts.sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], m = (a + b) / 2, h = b - a;
    if (!(h > 0)) continue;
    bounds(at, m, B); if (!(B[1] > B[0])) continue;
    const lm = B[1] - B[0], zm = (B[1] * B[1] - B[0] * B[0]) / 2;
    bounds(at, a, B); const la = B[1] - B[0], za = (B[1] * B[1] - B[0] * B[0]) / 2;
    bounds(at, b, B); const lb = B[1] - B[0], zb = (B[1] * B[1] - B[0] * B[0]) / 2;
    sum[0] += h * (la + 4 * lm + lb) / 6;
    sum[1] += h * (a * la + 4 * m * lm + b * lb) / 6;
    sum[2] += h * (za + 4 * zm + zb) / 6;
  }
}

/** Gauss–Legendre nodes and weights on [−1, 1]. */
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

/**
 * The (x, y) lines along which the integrand's pieces change: two z-lines crossing (y linear in x, or x = const
 * when they are parallel in y) and the vertical slabs' sides. Each as [p, q, c]: p x + q y = c.
 */
function cellLines(slabs) {
  const z = [], out = [];
  for (const { a, lo, hi } of slabs) {
    if (Math.abs(a[2]) > NEAR) for (const d of [lo, hi]) z.push([a[0] / a[2], a[1] / a[2], d / a[2]]); // z = (d − a0 x − a1 y)/a2
    else if (Math.abs(a[1]) > NEAR || Math.abs(a[0]) > NEAR) for (const d of [lo, hi]) out.push([a[0], a[1], d]);
  }
  for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) {
    const p = z[i][0] - z[j][0], q = z[i][1] - z[j][1], c = z[i][2] - z[j][2];
    if (Math.abs(p) > 1e-15 || Math.abs(q) > 1e-15) out.push([p, q, c]);
  }
  return out;
}

/** The φ (x = cx − r cos φ) at which the pieces change, in (0, π), sorted. */
function kinks(cylinder, slabs) {
  const { cx, cy, r } = cylinder, xs = [], L = cellLines(slabs);
  for (const [p, q, c] of L) {
    if (Math.abs(q) <= 1e-15) { xs.push(c / p); continue; }
    // y = (c − p x)/q on the circle (x − cx)² + (y − cy)² = r².
    const k = -p / q, m = c / q - cy, A = 1 + k * k, Bq = 2 * (k * m - cx), C = cx * cx + m * m - r * r, disc = Bq * Bq - 4 * A * C;
    if (disc >= 0) { const s = Math.sqrt(disc); xs.push((-Bq - s) / (2 * A), (-Bq + s) / (2 * A)); }
  }
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [p1, q1, c1] = L[i], [p2, q2, c2] = L[j], det = p1 * q2 - p2 * q1;
    if (Math.abs(det) > 1e-15) xs.push((c1 * q2 - c2 * q1) / det);
  }
  const phis = [0, Math.PI];
  for (const x of xs) { const u = (cx - x) / r; if (u > -1 && u < 1) phis.push(Math.acos(u)); }
  return phis.sort((a, b) => a - b);
}

function integrate(cylinder, slabs, phis, n) {
  const { cx, cy, r } = cylinder, { x: gx, w: gw } = gaussLegendre(n), at = { lower: [], upper: [], ylo: 0, yhi: 0 }, s = [0, 0, 0];
  let v = 0, mx = 0, my = 0, mz = 0;
  for (let k = 0; k + 1 < phis.length; k++) {
    const a = phis[k], b = phis[k + 1];
    if (!(b - a > 1e-15)) continue;
    for (let i = 0; i < n; i++) {
      const phi = (a + b) / 2 + (b - a) / 2 * gx[i], x = cx - r * Math.cos(phi), w = r * Math.sin(phi), jac = r * Math.sin(phi) * (b - a) / 2 * gw[i];
      if (!linesAt(slabs, x, at)) continue;
      inner(at, cy - w, cy + w, s);
      v += s[0] * jac; mx += x * s[0] * jac; my += s[1] * jac; mz += s[2] * jac;
    }
  }
  return { volume: v, moment: [mx, my, mz] };
}

/**
 * |A ∩ B| for A = { (x − cx)² + (y − cy)² ≤ r², z0 ≤ z ≤ z1 } and B the box { min ≤ p ≤ max } turned by `turn`
 * ({ axis: 'x' | 'y' | 'z', angle, pivot }; null: not turned): { volume, moment: ∫ p, centroid, error }.
 */
export function cylinderBoxIntersection(cylinder, box, turn = null) {
  const slabs = slabsOf(cylinder, box, turn), phis = kinks(cylinder, slabs);
  const a = integrate(cylinder, slabs, phis, 16), b = integrate(cylinder, slabs, phis, 24);
  return { volume: b.volume, moment: b.moment, centroid: b.volume > 0 ? b.moment.map(m => m / b.volume) : null, error: Math.abs(a.volume - b.volume) };
}

/** The cylinder's own volume and moment (closed form). */
export function cylinderMass({ cx, cy, r, z0, z1 }) {
  const volume = Math.PI * r * r * (z1 - z0);
  return { volume, moment: [cx * volume, cy * volume, (z0 + z1) / 2 * volume] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const A = { cx: 2.987, cy: 2.504, r: 4.055, z0: -1.544, z1: -1.544 + 4.56 };
  const r = cylinderBoxIntersection(A, { min: [-3.371, -3.944, 0.247], max: [1.79, 2.502, 0.247 + 4.469] }, { axis: 'x', angle: 80.79 });
  console.log('|A ∩ B|', r.volume.toFixed(12), 'centroid', r.centroid.map(c => c.toFixed(12)).join(' '), 'error', r.error.toExponential(1));
}
