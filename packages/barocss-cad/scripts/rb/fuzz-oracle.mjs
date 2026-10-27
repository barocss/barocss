// The L4 fuzz's oracle (RB5, K10, D188): a CSG tree's volume and centroid with no kernel code. Rays along z on an
// N × N grid over the tree's box (jittered by irrational fractions of a cell, so no ray runs along a face); along each
// ray every leaf's exact parameter intervals in its own frame (slabs, and the quadratics of cylinders, spheres, cones
// and the rounded box's corner discs), combined by the tree's Booleans and patterns. V and the first moments from the
// rays' lengths and ∫z dz exactly. The lattice (turned off the axes) is integrated at K shifts of its rays within their cells (a Cranley–Patterson
// rotation: each shift's estimate unbiased, its boundary error random); their mean is the value, three standard errors
// of it the error estimate e. (A fixed jitter at N and 2N repeats the rays' offsets from axis-aligned faces: its
// difference said 0 where the boundary error was 0.6 %.)

/** A rigid map: p ↦ R p + t (R row-major 3 × 3). */
const IDENTITY = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
function rotation(axis, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
const mul = (A, B) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]));
const apply = (R, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
/** m, then a rotation about an axis through a pivot (the kernel's `rotate` feature applied after m). */
export function rotated(m, axis, deg, pivot = [0, 0, 0]) {
  const Q = rotation(axis, deg), t = apply(Q, m.t.map((x, k) => x - pivot[k])).map((x, k) => x + pivot[k]);
  return { R: mul(Q, m.R), t };
}
export const translated = (m, o) => ({ R: m.R, t: m.t.map((x, k) => x + o[k]) });
/** The inverse map applied to a ray: its origin and direction in the frame the map takes to the world. */
function pull(m, o, d) {
  const q = [o[0] - m.t[0], o[1] - m.t[1], o[2] - m.t[2]], R = m.R;
  return { o: [R[0] * q[0] + R[3] * q[1] + R[6] * q[2], R[1] * q[0] + R[4] * q[1] + R[7] * q[2], R[2] * q[0] + R[5] * q[1] + R[8] * q[2]],
    d: [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]] };
}

// ---- leaves, each in its own frame -------------------------------------------------------------------------
/** The roots t of a t² + b t + c = 0, pushed into `out`. */
function roots(a, b, c, out) {
  if (Math.abs(a) < 1e-300) { if (Math.abs(b) > 1e-300) out.push(-c / b); return; }
  const D = b * b - 4 * a * c; if (D < 0) return;
  const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(D)); out.push(q / a); if (q !== 0) out.push(c / q);
}
function slab(o, d, lo, hi, out) { if (Math.abs(d) > 1e-300) out.push((lo - o) / d, (hi - o) / d); }
/** A circle of radius r about (cx, cy) in the xy plane, crossed by the ray. */
function disc(o, d, cx, cy, r, out) { roots(d[0] * d[0] + d[1] * d[1], 2 * ((o[0] - cx) * d[0] + (o[1] - cy) * d[1]), (o[0] - cx) ** 2 + (o[1] - cy) ** 2 - r * r, out); }
const inRect = (p, x0, y0, x1, y1) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
const corners = L => [[L.r, L.r], [L.w - L.r, L.r], [L.w - L.r, L.d - L.r], [L.r, L.d - L.r]];
/** Per leaf kind: breakpoints along the ray (local o, d), the inside test, its local box. */
export const LEAVES = {
  // A box [0, w] × [0, d] × [0, h].
  box: { cuts(L, o, d, out) { slab(o[0], d[0], 0, L.w, out); slab(o[1], d[1], 0, L.d, out); slab(o[2], d[2], 0, L.h, out); },
    inside: (L, p) => p[0] >= 0 && p[0] <= L.w && p[1] >= 0 && p[1] <= L.d && p[2] >= 0 && p[2] <= L.h, box: L => [[0, 0, 0], [L.w, L.d, L.h]] },
  // A cylinder about z, radius r, from z 0 to h.
  cyl: { cuts(L, o, d, out) { disc(o, d, 0, 0, L.r, out); slab(o[2], d[2], 0, L.h, out); },
    inside: (L, p) => p[2] >= 0 && p[2] <= L.h && p[0] * p[0] + p[1] * p[1] <= L.r * L.r, box: L => [[-L.r, -L.r, 0], [L.r, L.r, L.h]] },
  // A ball of radius r about the origin.
  sphere: { cuts(L, o, d, out) { roots(d[0] * d[0] + d[1] * d[1] + d[2] * d[2], 2 * (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]), o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - L.r * L.r, out); },
    inside: (L, p) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2] <= L.r * L.r, box: L => [[-L.r, -L.r, -L.r], [L.r, L.r, L.r]] },
  // A cone or frustum about z: radius r1 at z 0, r2 at z h.
  cone: { cuts(L, o, d, out) {
      const k = (L.r2 - L.r1) / L.h, a0 = L.r1 + k * o[2], a1 = k * d[2];
      roots(d[0] * d[0] + d[1] * d[1] - a1 * a1, 2 * (o[0] * d[0] + o[1] * d[1] - a0 * a1), o[0] * o[0] + o[1] * o[1] - a0 * a0, out); slab(o[2], d[2], 0, L.h, out);
    }, inside: (L, p) => { if (p[2] < 0 || p[2] > L.h) return false; const rho = L.r1 + (L.r2 - L.r1) * p[2] / L.h; return rho >= 0 && p[0] * p[0] + p[1] * p[1] <= rho * rho; },
    box: L => { const r = Math.max(L.r1, L.r2); return [[-r, -r, 0], [r, r, L.h]]; } },
  // The box with its four vertical edges rounded r (a fillet of side_i|side_j): in xy two rectangles and four discs.
  rbox: { cuts(L, o, d, out) {
      slab(o[0], d[0], 0, L.w, out); slab(o[1], d[1], 0, L.d, out); slab(o[2], d[2], 0, L.h, out); slab(o[0], d[0], L.r, L.w - L.r, out); slab(o[1], d[1], L.r, L.d - L.r, out);
      for (const [cx, cy] of corners(L)) disc(o, d, cx, cy, L.r, out);
    }, inside: (L, p) => {
      if (p[2] < 0 || p[2] > L.h) return false;
      if (inRect(p, L.r, 0, L.w - L.r, L.d) || inRect(p, 0, L.r, L.w, L.d - L.r)) return true;
      return corners(L).some(([cx, cy]) => (p[0] - cx) ** 2 + (p[1] - cy) ** 2 <= L.r * L.r);
    }, box: L => [[0, 0, 0], [L.w, L.d, L.h]] },
  // The box shelled t inward (the kernel's `shell`: every face offset t; open top: the inner box runs out through the top).
  hbox: { cuts(L, o, d, out) {
      slab(o[0], d[0], 0, L.w, out); slab(o[1], d[1], 0, L.d, out); slab(o[2], d[2], 0, L.h, out);
      slab(o[0], d[0], L.t, L.w - L.t, out); slab(o[1], d[1], L.t, L.d - L.t, out); slab(o[2], d[2], L.t, L.open ? L.h + 1 : L.h - L.t, out);
    }, inside: (L, p) => LEAVES.box.inside(L, p) && !(p[0] > L.t && p[0] < L.w - L.t && p[1] > L.t && p[1] < L.d - L.t && p[2] > L.t && (L.open || p[2] < L.h - L.t)),
    box: L => [[0, 0, 0], [L.w, L.d, L.h]] },
};
/** A leaf's placement: its rotations in order (about axes through the origin), then its move. */
export function placementOf(leaf) {
  let m = IDENTITY; for (const r of leaf.rot ?? []) m = rotated(m, r.axis, r.deg); return translated(m, leaf.move ?? [0, 0, 0]);
}
/** A pattern node's copies, each a map of its child's result. */
export function copiesOf(p) {
  return Array.from({ length: p.count }, (_, k) => {
    if (p.kind === 'linear') { const o = [0, 0, 0]; o['xyz'.indexOf(p.axis)] = p.spacing * k; return translated(IDENTITY, o); }
    return rotated(IDENTITY, p.axis, p.deg * k, p.pivot ?? [0, 0, 0]);
  });
}

// ---- intervals ------------------------------------------------------------------------------------------------
function union(A, B) { const all = [...A, ...B].sort((x, y) => x[0] - y[0]), out = []; for (const iv of all) { const l = out[out.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else out.push([iv[0], iv[1]]); } return out; }
function intersect(A, B) { const out = []; let i = 0, j = 0; while (i < A.length && j < B.length) { const lo = Math.max(A[i][0], B[j][0]), hi = Math.min(A[i][1], B[j][1]); if (hi > lo) out.push([lo, hi]); if (A[i][1] < B[j][1]) i++; else j++; } return out; }
function minus(A, B) { const out = []; for (const [a0, a1] of A) { let lo = a0; for (const [b0, b1] of B) { if (b1 <= lo || b0 >= a1) continue; if (b0 > lo) out.push([lo, b0]); lo = Math.max(lo, b1); if (lo >= a1) break; } if (lo < a1) out.push([lo, a1]); } return out; }
/** A leaf's intervals along the ray (o, d) in its parent's frame, over [T0, T1]. */
function leafIntervals(leaf, o, d, T0, T1) {
  const def = LEAVES[leaf.kind], r = pull(leaf.place, o, d), cuts = [T0, T1];
  def.cuts(leaf, r.o, r.d, cuts);
  const ts = cuts.filter(t => t >= T0 && t <= T1).sort((a, b) => a - b), out = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1]; if (!(b > a)) continue;
    const m = (a + b) / 2;
    if (def.inside(leaf, [r.o[0] + r.d[0] * m, r.o[1] + r.d[1] * m, r.o[2] + r.d[2] * m])) { const l = out[out.length - 1]; if (l && l[1] === a) l[1] = b; else out.push([a, b]); }
  }
  return out;
}
/** A node's intervals along a ray given in its frame. */
function nodeIntervals(node, o, d, T0, T1) {
  if (node.leaf) return leafIntervals(node.leaf, o, d, T0, T1);
  if (node.pattern) { let acc = []; for (const m of node.copies) { const r = pull(m, o, d); acc = union(acc, nodeIntervals(node.child, r.o, r.d, T0, T1)); } return acc; }
  const A = nodeIntervals(node.a, o, d, T0, T1), B = nodeIntervals(node.b, o, d, T0, T1);
  return node.op === 'union' ? union(A, B) : node.op === 'intersect' ? intersect(A, B) : minus(A, B);
}
/** A copy of the tree with every leaf placed and every pattern's copies, and the tree's world box. */
function prepare(node, outer, box) {
  if (node.leaf) {
    const leaf = { ...node.leaf, place: placementOf(node.leaf) }, [lo, hi] = LEAVES[leaf.kind].box(leaf);
    for (let c = 0; c < 8; c++) {
      const q = [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]], p = apply(leaf.place.R, q).map((x, k) => x + leaf.place.t[k]), w = apply(outer.R, p).map((x, k) => x + outer.t[k]);
      for (let k = 0; k < 3; k++) { box.lo[k] = Math.min(box.lo[k], w[k]); box.hi[k] = Math.max(box.hi[k], w[k]); }
    }
    return { leaf };
  }
  if (node.pattern) {
    const copies = copiesOf(node.pattern); let child;
    for (const m of copies) child = prepare(node.child, { R: mul(outer.R, m.R), t: apply(outer.R, m.t).map((x, k) => x + outer.t[k]) }, box);
    return { pattern: node.pattern, copies, child };
  }
  return { op: node.op, a: prepare(node.a, outer, box), b: prepare(node.b, outer, box) };
}
const THETA = 0.4, COS = Math.cos(THETA), SIN = Math.sin(THETA);
/**
 * V and the first moments over a square lattice of z rays turned 0.4 rad about z (about n² of them in the box), each
 * ray at (sx, sy) within its cell. Turned, its rows run along no face an agent snaps to the axes: a lattice aligned
 * with a box's sides counts whole rows in or out, an error of the cell's width all along them.
 */
function integrate(tree, box, n, sx, sy) {
  const span = Math.max(1, ...box.hi.map((x, k) => x - box.lo[k])), wx = box.hi[0] - box.lo[0], wy = box.hi[1] - box.lo[1];
  const h = Math.sqrt(Math.max(wx * wy, 1e-6 * span * span)) / n, cx = (box.lo[0] + box.hi[0]) / 2, cy = (box.lo[1] + box.hi[1]) / 2, R = Math.hypot(wx, wy) / 2, m = Math.ceil(2 * R / h) + 1;
  const T0 = box.lo[2] - span, T1 = box.hi[2] + span, d = [0, 0, 1];
  let V = 0, Mx = 0, My = 0, Mz = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    const u = -R + h * (i + sx), v = -R + h * (j + sy), x = cx + u * COS - v * SIN, y = cy + u * SIN + v * COS;
    if (x < box.lo[0] || x > box.hi[0] || y < box.lo[1] || y > box.hi[1]) continue;
    for (const [a, b] of nodeIntervals(tree, [x, y, 0], d, T0, T1)) { const L = b - a; V += L; Mx += x * L; My += y * L; Mz += (b * b - a * a) / 2; }
  }
  const A = h * h;
  return { V: V * A, M: [Mx * A, My * A, Mz * A] };
}
/** The shifts: a fixed low-discrepancy sequence (the same oracle for the same tree). */
const SHIFTS = Array.from({ length: 8 }, (_, k) => [(0.5 + 0.6180339887498949 * (k + 1)) % 1, (0.5 + 0.7548776662466927 * (k + 1)) % 1]);
/** The oracle: V and the centroid as the mean over `K` shifted grids of n × n rays, and their errors e (3 standard errors). */
export function oracle(tree, n = 128, K = 6) {
  const box = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }, placed = prepare(tree, IDENTITY, box);
  const runs = SHIFTS.slice(0, K).map(([sx, sy]) => integrate(placed, box, n, sx, sy));
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length, se = list => { const m = mean(list); return Math.sqrt(list.reduce((a, b) => a + (b - m) ** 2, 0) / (list.length - 1) / list.length); };
  const V = mean(runs.map(r => r.V)), M = [0, 1, 2].map(k => mean(runs.map(r => r.M[k])));
  const cs = runs.map(r => r.V > 0 ? r.M.map(m => m / r.V) : [0, 0, 0]);
  return { volumeMM3: V, centroidMM: V > 0 ? M.map(m => m / V) : [0, 0, 0], e: 3 * se(runs.map(r => r.V)), eCentroid: Math.max(...[0, 1, 2].map(k => 3 * se(cs.map(c => c[k])))), n, K, box };
}
