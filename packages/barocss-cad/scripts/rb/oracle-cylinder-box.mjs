// An independent oracle for RB4's counterexample: |A ∩ B| of an upright cylinder and a box turned about X, by
// integrating the exact inside length over the cylinder's disc (inner integral exact, piecewise linear; outer by
// Gauss–Legendre in an angle). Run: node scripts/rb/oracle-cylinder-box.mjs (prints the value at three resolutions).
const cx = 2.987, cy = 2.504, r = 4.055, z0 = -1.544, z1 = -1.544 + 4.56;
const bx0 = -3.371, bx1 = -3.371 + 5.161, by0 = -3.944, by1 = -3.944 + 6.446, bz0 = 0.247, bz1 = 0.247 + 4.469, th = 80.79 * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
// For fixed y the inside z-interval: lower = max(z0, (by0 − y c)/s, (y s + bz0)/c), upper = min(z1, (by1 − y c)/s, (y s + bz1)/c)
// (s, c > 0). Each bound is linear in y: the length max(0, upper − lower) is piecewise linear; integrate it exactly.
const lowers = [[0, z0], [-c / s, by0 / s], [s / c, bz0 / c]], uppers = [[0, z1], [-c / s, by1 / s], [s / c, bz1 / c]];
const ev = (l, y) => l[0] * y + l[1];
function inner(ya, yb) {
  const lines = [...lowers, ...uppers], cuts = [ya, yb];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const d = lines[i][0] - lines[j][0]; if (Math.abs(d) > 1e-15) { const y = (lines[j][1] - lines[i][1]) / d; if (y > ya && y < yb) cuts.push(y); } }
  cuts.sort((a, b) => a - b);
  const len = y => Math.max(0, Math.min(...uppers.map(l => ev(l, y))) - Math.max(...lowers.map(l => ev(l, y))));
  let v = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1]; if (b <= a) continue;
    // Within a piece the length is linear, unless it crosses zero: split at that crossing (max(0, ·)).
    const la = len(a), lb = len(b), ma = Math.min(...uppers.map(l => ev(l, a))) - Math.max(...lowers.map(l => ev(l, a))), mb = Math.min(...uppers.map(l => ev(l, b))) - Math.max(...lowers.map(l => ev(l, b)));
    if ((ma > 0) === (mb > 0) || ma === 0 || mb === 0) v += (la + lb) / 2 * (b - a);
    else { const yz = a + (b - a) * ma / (ma - mb); v += (ma > 0 ? la * (yz - a) : lb * (b - yz)) / 2; }
  }
  return v;
}
// x over [max(cx − r, bx0), min(cx + r, bx1)] by Gauss–Legendre in φ, x = cx − r cos φ (smooth at the disc's edge).
function gl(n) { const x = [], w = []; for (let i = 1; i <= n; i++) { let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0; for (let it = 0; it < 100; it++) { let p0 = 1, p1 = t; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } d = n * (t * p1 - p0) / (t * t - 1); const dt = p1 / d; t -= dt; if (Math.abs(dt) < 1e-16) break; } x.push(t); w.push(2 / ((1 - t * t) * d * d)); } return { x, w }; }
const xlo = Math.max(cx - r, bx0), xhi = Math.min(cx + r, bx1), p0 = Math.acos((cx - xlo) / r), p1 = Math.acos((cx - xhi) / r);
for (const [panels, n] of [[200, 16], [800, 16], [3200, 16]]) {
  const { x: gx, w: gw } = gl(n); let v = 0;
  for (let k = 0; k < panels; k++) { const a = p0 + (p1 - p0) * k / panels, b = p0 + (p1 - p0) * (k + 1) / panels;
    for (let i = 0; i < n; i++) { const phi = (a + b) / 2 + (b - a) / 2 * gx[i], x = cx - r * Math.cos(phi), w = r * Math.sin(phi), dxdphi = r * Math.sin(phi); v += inner(cy - w, cy + w) * dxdphi * (b - a) / 2 * gw[i]; } }
  console.log(panels, n, v.toFixed(9));
}
