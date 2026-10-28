// The kernel's 2D sketch solver (packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts), copied line by
// line for the figures of /how/sketch-solver: qr (column-pivoted Householder least squares), evaluate (residuals and
// their hand-written Jacobian rows) and the damped loop of solve. Run on the figures' sketches, its iterates are
// bit-identical to the kernel's own (checked by running both from a script against packages/barocss-cad/dist). The
// admission checks, branch guards and the report are left out. The three sketch figures import these, and
// apps/library-docs/samples/how-ports.test.mjs runs them against the kernel's own solver.
const wrap = a => { const w = Math.atan2(Math.sin(a), Math.cos(a)); return w === -Math.PI ? Math.PI : w; };
export function qr(matrix, rhs, n) {
  const a = matrix.map(row => [...row]), b = [...rhs], m = a.length, order = Array.from({ length: n }, (_, i) => i), diagonals = [];
  for (let k = 0; k < Math.min(m, n); k++) {
    let pivot = k, largest = -1;
    for (let j = k; j < n; j++) { const norm = Math.hypot(...a.slice(k).map(row => row[j])); if (norm > largest) { largest = norm; pivot = j; } }
    if (pivot !== k) { for (const row of a) [row[k], row[pivot]] = [row[pivot], row[k]]; [order[k], order[pivot]] = [order[pivot], order[k]]; }
    const norm = Math.hypot(...a.slice(k).map(row => row[k]));
    if (norm === 0) { diagonals.push(0); continue; }
    const alpha = a[k][k] >= 0 ? -norm : norm, v = a.slice(k).map(row => row[k]); v[0] -= alpha;
    const length = Math.hypot(...v); for (let i = 0; i < v.length; i++) v[i] /= length;
    for (let j = k; j < n; j++) { let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * a[k + i][j]; for (let i = 0; i < v.length; i++) a[k + i][j] -= 2 * v[i] * dot; }
    let dot = 0; for (let i = 0; i < v.length; i++) dot += v[i] * b[k + i]; for (let i = 0; i < v.length; i++) b[k + i] -= 2 * v[i] * dot;
    a[k][k] = alpha; for (let i = k + 1; i < m; i++) a[i][k] = 0; diagonals.push(Math.abs(alpha));
  }
  const threshold = Math.max(1, ...diagonals) * 1e-10, rank = diagonals.filter(d => d > threshold).length, z = Array(n).fill(0);
  for (let i = rank - 1; i >= 0; i--) { let value = b[i]; for (let j = i + 1; j < rank; j++) value -= a[i][j] * z[j]; z[i] = value / a[i][i]; }
  const solution = Array(n).fill(0); for (let i = 0; i < n; i++) solution[order[i]] = z[i];
  return { solution, rank };
}
/**
 * A sketch here: `points` (ids in order, x then y of each in the unknowns), `segments` { id: [startId, endId] } and
 * `constraints` in the kernel's document form. Null where the kernel refuses a candidate (a segment under 0.001 mm).
 */
export function evaluate(sk, x) {
  const n = x.length, at = id => 2 * sk.points.indexOf(id);
  const seg = id => { const [s, e] = sk.segments[id], a = at(s), b = at(e); return { a, b, dx: x[b] - x[a], dy: x[b + 1] - x[a + 1] }; };
  for (const id in sk.segments) { const v = seg(id); if (!(Math.hypot(v.dx, v.dy) >= 0.001)) return null; }
  const jacobian = [], residuals = [], owner = [];
  const add = (c, actual, target, rad, terms) => {
    const row = Array(n).fill(0); for (const [i, v] of terms) row[i] += v;
    jacobian.push(row); residuals.push(rad ? wrap(actual - target) : actual - target); owner.push({ id: c.id, rad });
  };
  for (const c of sk.constraints) {
    if (c.kind === 'fixed') { const a = at(c.pointId); for (let k = 0; k < 2; k++) add(c, x[a + k], c.target[k], false, [[a + k, 1]]); }
    else if (c.kind === 'coincident') { const a = at(c.pointA), b = at(c.pointB); for (let k = 0; k < 2; k++) add(c, x[b + k] - x[a + k], 0, false, [[b + k, 1], [a + k, -1]]); }
    else if (c.kind === 'equal-length') {
      const a = seg(c.segmentA), b = seg(c.segmentB), la = Math.hypot(a.dx, a.dy), lb = Math.hypot(b.dx, b.dy);
      add(c, la - lb, 0, false, [[a.a, -a.dx / la], [a.a + 1, -a.dy / la], [a.b, a.dx / la], [a.b + 1, a.dy / la], [b.a, b.dx / lb], [b.a + 1, b.dy / lb], [b.b, -b.dx / lb], [b.b + 1, -b.dy / lb]]);
    } else if (c.kind === 'signed-angle') {
      const a = seg(c.segmentA), b = seg(c.segmentB), aa = a.dx * a.dx + a.dy * a.dy, bb = b.dx * b.dx + b.dy * b.dy;
      add(c, wrap(Math.atan2(b.dy, b.dx) - Math.atan2(a.dy, a.dx)), c.angle, true,
        [[a.a, -a.dy / aa], [a.a + 1, a.dx / aa], [a.b, a.dy / aa], [a.b + 1, -a.dx / aa], [b.a, b.dy / bb], [b.a + 1, -b.dx / bb], [b.b, -b.dy / bb], [b.b + 1, b.dx / bb]]);
    } else {
      const v = seg(c.segmentId);
      if (c.kind === 'length') { const l = Math.hypot(v.dx, v.dy); add(c, l, c.length, false, [[v.a, -v.dx / l], [v.a + 1, -v.dy / l], [v.b, v.dx / l], [v.b + 1, v.dy / l]]); }
      else { const k = c.kind === 'horizontal' ? 1 : 0; add(c, k === 1 ? v.dy : v.dx, 0, false, [[v.b + k, 1], [v.a + k, -1]]); }
    }
  }
  return { jacobian, residuals, owner, objective: residuals.reduce((s, r) => s + r * r, 0) };
}
const satisfied = e => e.residuals.every((r, i) => Math.abs(r) <= (e.owner[i].rad ? 1e-9 : 1e-7));
/** The kernel's damped loop, keeping each accepted iterate (x, ‖r‖, λ after it, tries), then the rank of J there. */
export function solveTrace(sk, x0) {
  let x = [...x0], current = evaluate(sk, x), damping = 1e-3, iterations = 0;
  const its = [{ x, norm: Math.sqrt(current.objective), damping, tries: 0 }];
  while (!satisfied(current) && iterations < 100) {
    iterations++; let accepted = false, tries = 0;
    for (let trial = 0; trial < 12; trial++) {
      tries++;
      const matrix = [...current.jacobian.map(row => [...row]), ...x.map((_, i) => x.map((__, j) => i === j ? Math.sqrt(damping) : 0))];
      const step = qr(matrix, [...current.residuals.map(r => -r), ...x.map(() => 0)], x.length).solution;
      const candidate = x.map((v, i) => v + step[i]), next = evaluate(sk, candidate);
      if (next && next.objective < current.objective) { x = candidate; current = next; damping = Math.max(1e-12, damping / 3); accepted = true; break; }
      damping = Math.min(1e12, damping * 10);
    }
    its.push({ x, norm: Math.sqrt(current.objective), damping, tries });
    if (!accepted && damping === 1e12) break;
  }
  const rank = qr(current.jacobian, current.residuals.map(() => 0), x.length).rank;
  return { its, ok: satisfied(current), rank, rows: current.residuals.length, dof: x.length - rank, final: current };
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 3.9×10⁻¹⁰ style, for the figures' readouts. */
export function sci(v, d = 2) {
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v))), m = +(v / 10 ** e).toFixed(d - 1);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  if (e >= -2 && e <= 2) return (+v.toPrecision(d + 1)).toString();
  return `${m.toFixed(d - 1)}×10${String(e).split('').map(c => SUP[c]).join('')}`;
}
