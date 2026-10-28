// The kernel's cubic Bernstein root solver (packages/barocss-cad/src/intersect/own-cubic-bernstein-roots.ts,
// solveCubicBernsteinRoots) with the degree-1/2 solver of own-homogeneous-bernstein-roots.ts that it uses for the
// derivative, ported for the figures of /how/curve-roots on their success path, keeping every bisection bracket.
// apps/library-docs/samples/how-ports.test.mjs runs it against the kernel's own solver.
const EPS = Number.EPSILON;
/** Bernstein polynomial with coefficients c at t, by de Casteljau's repeated averaging (the kernel's recurrence). */
export function bern(c, t) {
  let row = c.slice();
  for (let d = row.length - 1; d > 0; d--) { const p = row; row = p.slice(0, d).map((l, i) => (1 - t) * l + t * p[i + 1]); }
  return row[0];
}
/** The kernel's degree-1/2 solver: sign exclusion, discriminant, split at the vertex, bisection. */
export function quadRoots(v, width) {
  if (v.every(x => x > 0) || v.every(x => x < 0)) return [];
  const [f0, f1, f2] = v, q = v.length === 3, fN = v.at(-1);
  const a = q ? f0 - 2 * f1 + f2 : 0, b = q ? 2 * (f1 - f0) : f1 - f0;
  if (a === 0 && b === 0) return [];
  const measure = t => { const s = 1 - t; return q ? f0 * s * s + 2 * f1 * s * t + f2 * t * t : f0 * s + f1 * t; };
  if (a !== 0 && f0 !== 0 && fN !== 0) {
    const bb = b * b, ac = 4 * a * f0, d = bb - ac, unc = 32 * EPS * (Math.abs(bb) + Math.abs(ac));
    if (d < -unc) return []; if (!(d > unc)) return null;
  }
  const vertex = a !== 0 ? -b / (2 * a) : NaN, cuts = [0, ...(vertex > 0 && vertex < 1 ? [vertex] : []), 1], roots = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    let lo = cuts[k], hi = cuts[k + 1]; const fl = lo === 0 ? f0 : measure(lo), fh = hi === 1 ? fN : measure(hi);
    if (fl === 0 || fh === 0 || Math.sign(fl) === Math.sign(fh)) continue;
    let it = 0;
    while (hi - lo > width && it < 64) { const mid = lo + (hi - lo) / 2, fm = measure(mid); if (fm === 0) { const l = lo + (mid - lo) / 2, r = mid + (hi - mid) / 2; lo = l; hi = r; } else if (Math.sign(fm) === Math.sign(fl)) lo = mid; else hi = mid; it++; }
    roots.push({ t: lo + (hi - lo) / 2, bracket: [lo, hi], iterations: it });
  }
  return roots;
}
/** The kernel's cubic solver on its success path, keeping every bracket of the bisection for the figure. */
export function cubicRoots(c, target) {
  const scale = Math.max(...c.map(Math.abs)), n = c.map(x => x / scale), der = [0, 1, 2].map(i => 3 * (n[i + 1] - n[i]));
  const guard = 64 * EPS * Math.max(1, ...n.map(Math.abs)), sg = x => (Math.abs(x) <= guard ? 0 : x < 0 ? -1 : 1);
  const L = Math.max(...der.map(Math.abs)), lip = L + guard * Math.max(1, L), crit = [];
  for (const r of quadRoots(der, target)) {
    const radius = Math.max(r.t - r.bracket[0], r.bracket[1] - r.t), value = bern(n, r.t);
    crit.push({ t: r.t, bracket: r.bracket, value, margin: lip * radius + guard, iterations: r.iterations });
  }
  const pieces = []; let cur = 0;
  for (const k of crit) { pieces.push([cur, k.bracket[0]]); cur = k.bracket[1]; } pieces.push([cur, 1]);
  const mono = pieces.map(([l0, h0]) => {
    let lo = l0, hi = h0; const ls = sg(bern(n, lo)), rs = sg(bern(n, hi)), trace = [[lo, hi]];
    if (ls === rs) return { domain: [l0, h0], ls, rs, trace: null };
    let it = 0;
    while (hi - lo > target && it < 64) { const mid = lo + (hi - lo) * 0.5, ms = sg(bern(n, mid)); if (ms === 0) { const a = lo + (mid - lo) * 0.5, b = mid + (hi - mid) * 0.5; lo = a; hi = b; } else if (ms === ls) lo = mid; else hi = mid; it++; trace.push([lo, hi]); }
    return { domain: [l0, h0], ls, rs, trace, t: lo + (hi - lo) * 0.5, iterations: it };
  });
  return { scale, n, der, guard, L, crit, mono, roots: mono.filter(m => m.trace) };
}
