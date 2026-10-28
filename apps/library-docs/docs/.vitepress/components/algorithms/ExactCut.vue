<script setup>
// Cutting a face with two faces of a tilted box, in exact rationals. Box A is [0, 10] × [0, 6] × [−3, 0]; its top face
// (z = 0) is cut. Box B is E + x·e − y·n₂ − z·n₁ with E = (0, 7, −1.5), e = (2, −2, 1), n₁ = (2, 1, −2), n₂ = (1, 2, 2),
// x ∈ [0, 3], y, z ∈ [0, 2] (every corner a binary64 value). The page runs polyhedral-boolean.ts's own steps, copied:
// `newellNormal` (exact Newell normal, reduced), `cutPair` (D = Nₐ × N_b, P₀ by Cramer), `intervals` (half-open crossing
// rule) and `overlap`, on BigInt fractions. The arrangement and the triangulation are not rerun here: the two pieces are
// drawn from the computed cuts, and their triangles are the kernel's (dist/brep/brep-tessellate.js
// triangulatePolygonWithHoles on the pieces' rings, scratch script). Through the built kernel, booleanPolyhedra on these two
// boxes keeps exactly these pieces of A's top: (0,0) (5,0) (3,4) (0,5.5) for intersection, the other for union and
// difference.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);

// ---- exact rationals, as in polyhedral-boolean.ts ----
const view = new DataView(new ArrayBuffer(8));
function dyadic(v) {
  if (v === 0) return { m: 0n, k: 0 };
  view.setFloat64(0, v); const bits = view.getBigUint64(0), exp = Number((bits >> 52n) & 2047n), frac = bits & 0xfffffffffffffn;
  let m = exp === 0 ? frac : frac | (1n << 52n), e = (exp === 0 ? 1 : exp) - 1075;
  while (m && !(m & 1n) && e < 0) { m >>= 1n; e++; }
  if (bits >> 63n) m = -m;
  return e >= 0 ? { m: m << BigInt(e), k: 0 } : { m, k: -e };
}
const babs = a => (a < 0n ? -a : a);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) { const r = a % b; a = b; b = r; } return a; };
const q = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const qf = v => { const { m, k } = dyadic(v); return q(m, 1n << BigInt(k)); };
const add = (a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => q(a.n * b.n, a.d * b.d), div = (a, b) => q(a.n * b.d, a.d * b.n);
const sgn = a => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0), num = a => Number(a.n) / Number(a.d);
const cmp = (a, b) => { const x = a.n * b.d, y = b.n * a.d; return x > y ? 1 : x < y ? -1 : 0; };
const vadd = (a, b) => a.map((x, i) => add(x, b[i])), vscale = (a, s) => a.map(x => mul(x, s));
const vcross = (a, b) => [sub(mul(a[1], b[2]), mul(a[2], b[1])), sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
const vdot = (a, b) => add(add(mul(a[0], b[0]), mul(a[1], b[1])), mul(a[2], b[2]));
function face(points) {
  const ring = points.map(p => p.map(qf));
  // Newell normal on the common power-of-two denominator: integers, reduced to coprime ones.
  let K = 0n; for (const p of ring) for (const x of p) { const k = BigInt(x.d.toString(2).length - 1); if (k > K) K = k; }
  const w = ring.map(p => p.map(x => x.n << (K - BigInt(x.d.toString(2).length - 1))));
  let nx = 0n, ny = 0n, nz = 0n;
  for (let k = 0; k < w.length; k++) { const a = w[k], b = w[(k + 1) % w.length]; nx += a[1] * b[2] - a[2] * b[1]; ny += a[2] * b[0] - a[0] * b[2]; nz += a[0] * b[1] - a[1] * b[0]; }
  const g = bgcd(bgcd(nx, ny), nz), normal = [q(nx / g), q(ny / g), q(nz / g)];
  const mag = normal.map(x => Math.abs(num(x))), axis = mag[0] >= mag[1] && mag[0] >= mag[2] ? 0 : mag[1] >= mag[2] ? 1 : 2;
  let i = (axis + 1) % 3, j = (axis + 2) % 3; if (sgn(normal[axis]) < 0) [i, j] = [j, i];
  return { points, ring, normal, offset: vdot(normal, ring[0]), axis, i, j };
}
function intervals(f, P0, D) {
  const ts = [], d2 = [D[f.i], D[f.j]], p2 = [P0[f.i], P0[f.j]];
  const side = p => sgn(sub(mul(d2[0], sub(p[f.j], p2[1])), mul(d2[1], sub(p[f.i], p2[0]))));
  f.ring.forEach((a, k) => {
    const b = f.ring[(k + 1) % f.ring.length]; if ((side(a) > 0) === (side(b) > 0)) return;
    const ba = [sub(b[f.i], a[f.i]), sub(b[f.j], a[f.j])], ap = [sub(a[f.i], p2[0]), sub(a[f.j], p2[1])];
    ts.push(div(sub(mul(ap[0], ba[1]), mul(ap[1], ba[0])), sub(mul(d2[0], ba[1]), mul(d2[1], ba[0]))));
  });
  return ts.sort(cmp);
}
function cutPair(fa, fb) {
  const D = vcross(fa.normal, fb.normal), det = vdot(D, D);
  const P0 = vscale(vadd(vscale(vcross(fb.normal, D), fa.offset), vscale(vcross(D, fa.normal), fb.offset)), div(q(1n), det));
  const ta = intervals(fa, P0, D), tb = intervals(fb, P0, D);
  const lo = cmp(ta[0], tb[0]) > 0 ? ta[0] : tb[0], hi = cmp(ta[1], tb[1]) < 0 ? ta[1] : tb[1];
  return { D, P0, ta, tb, lo, hi, seg: [vadd(P0, vscale(D, lo)), vadd(P0, vscale(D, hi))].map(p => p.map(num)) };
}
const A = face([[0, 0, 0], [10, 0, 0], [10, 6, 0], [0, 6, 0]]);
const B1 = face([[0, 7, -1.5], [-4, 5, 2.5], [2, -1, 5.5], [6, 1, 1.5]]);
const B2 = face([[0, 7, -1.5], [6, 1, 1.5], [4, -3, -2.5], [-2, 3, -5.5]]);
// Box B's eight corners and twelve edges (drawn faint).
const BOXB = (() => {
  const E = [0, 7, -1.5], e = [2, -2, 1], n1 = [2, 1, -2], n2 = [1, 2, 2], c = (x, y, z) => [0, 1, 2].map(i => E[i] + x * e[i] - y * n2[i] - z * n1[i]);
  const out = [];
  for (const [x, y, z] of [[0, 0, 0], [0, 2, 0], [0, 0, 2], [0, 2, 2]]) out.push([c(x, y, z), c(x + 3, y, z)]);
  for (const [x, y, z] of [[0, 0, 0], [3, 0, 0], [0, 0, 2], [3, 0, 2]]) out.push([c(x, y, z), c(x, y + 2, z)]);
  for (const [x, y, z] of [[0, 0, 0], [3, 0, 0], [0, 2, 0], [3, 2, 0]]) out.push([c(x, y, z), c(x, y, z + 2)]);
  return out;
})();
const PAIRS = [cutPair(A, B1), cutPair(A, B2)];

const fq = a => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`).replace('-', '−');
const fv = v => `(${v.map(fq).join(', ')})`;
const fiv = ts => `[${fq(ts[0])}, ${fq(ts[1])}]`;

// The two pieces of A's top, from the cuts (pair 1: (3, 4) → (0, 11/2); pair 2: (5, 0) → (3, 4)); their triangles as
// the kernel's triangulation gives them, the largest first.
const [c1, c2] = PAIRS.map(p => p.seg.map(x => [x[0], x[1]]));
const PIECES = [
  { ring: [[0, 0], c2[0], c2[1], c1[1]], tris: [[3, 0, 1], [1, 2, 3]], where: 'inside B' },
  { ring: [c2[0], [10, 0], [10, 6], [0, 6], c1[1], c1[0]], tris: [[5, 1, 2], [5, 0, 1], [5, 2, 3], [3, 4, 5]], where: 'outside B' },
];
const third = q(1n, 3n);
for (const p of PIECES) {
  const big = p.tris[0].map(k => p.ring[k].map(qf));
  p.point = [0, 1].map(c => mul(add(add(big[0][c], big[1][c]), big[2][c]), third));
}

// ---- picture ----
// A view from azimuth TH, elevation PH (degrees), SC px per unit.
const TH = (30 * Math.PI) / 180, PH = (25 * Math.PI) / 180, SC = 17, OX = 112, OY = 150;
const P3 = ([x, y, z]) => [OX + SC * (x * Math.cos(TH) - y * Math.sin(TH)), OY - SC * (z * Math.cos(PH) + (x * Math.sin(TH) + y * Math.cos(TH)) * Math.sin(PH))];
const P2 = ([x, y]) => [60 + 20 * x, 214 - 20 * y];
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const steps = [
  { label: 'Two faces that may meet', text: 'The top face of box A and one face of a tilted box B. Their boxes overlap, so the pair is cut. Each face carries its exact plane n · x = d: n is the Newell normal of its corners, computed in integers and reduced to coprime numbers; d is n times a corner.', formula: 'A: n = (0, 0, 1), d = 0 &nbsp; B: n = (1, 2, 2), d = 11' },
  { label: 'The line of the two planes', text: 'Its direction is the cross product of the normals. A point on it solves both plane equations plus D · x = 0 (Cramer\'s rule), in fractions: here P<sub>0</sub> = (11/5, 22/5, 0). Points on the line are P<sub>0</sub> + t D.', formula: 'D = n<sub>A</sub> × n<sub>B</sub>, &nbsp; P<sub>0</sub> = (d<sub>A</sub> (n<sub>B</sub> × D) + d<sub>B</sub> (D × n<sub>A</sub>)) / (D · D)' },
  { label: 'Where the line is inside A', text: 'In A\'s own 2D frame, each edge whose ends lie on opposite sides of the line (one end strictly to the left, the other not: the half-open rule, so a corner on the line counts once) gives a crossing parameter t. Sorted and taken in pairs, they are the line\'s intervals inside A.', formula: 't = ((a − P<sub>0</sub>) × (b − a)) / (D × (b − a)) &nbsp; for each edge a → b that changes side' },
  { label: 'Where the line is inside B', text: 'The same for B, in B\'s frame (B\'s normal is largest in y, so B is read in z and x). The ends are fractions of the corners\' exact values.' },
  { label: 'Both at once: the cut', text: 'Where the two intervals overlap the line is on both faces. That segment is added to the cut list of A and of B. Interval ends are compared by cross-multiplication, never rounded.', formula: 'cut = [max(start<sub>A</sub>, start<sub>B</sub>), min(end<sub>A</sub>, end<sub>B</sub>)]' },
  { label: 'The other faces of B', text: 'Every pair is cut the same way. B\'s face with n = (2, 1, −2), d = 10 crosses A from (5, 0, 0) to (3, 4, 0), the point where B\'s edge passes through A. The other four faces of B do not reach A\'s top. (Parallel faces give no line; coplanar faces cut each other along their edges instead.)', formula: 'D = (−1, 2, 0), P<sub>0</sub> = (4, 2, 0), cut t ∈ [−1, 1]' },
  { label: 'Split A in its own plane', text: 'A is read in 2D by dropping the coordinate where its normal is largest (z here; the other two are swapped when that component is negative, so the 2D ring keeps its turning sense). The exact planar arrangement of A\'s ring and its two cuts gives two regions.', formula: 'A plane point is lifted back exactly: z = (d − nₓ x − n<sub>y</sub> y) / n<sub>z</sub>' },
  { label: 'A point inside each piece', text: 'Each region is triangulated; the centroid of its largest triangle, in exact fractions, is a point strictly inside it, lifted back onto the plane. One point decides the whole piece, since no cut crosses it. Classified against B (next section), the first is inside B and the second outside: a union keeps the second, an intersection the first.', formula: '(5/3, 11/6, 0) and (23/3, 10/3, 0)' },
];
const s = useSteps(steps.length, [2600, 2800, 2600, 2400, 2400, 3600, 3000, 3600], root);
const step = computed(() => s.step.value), k = computed(() => ease(s.t.value));
// 3D → 2D blend.
const u = computed(() => (step.value < 6 ? 0 : step.value === 6 ? k.value : 1));
const at = p => lerp(P3(p.length === 3 ? p : [p[0], p[1], 0]), P2(p), u.value);
const pts = list => list.map(p => at(p).map(v => v.toFixed(1)).join(',')).join(' ');
const pts3 = list => list.map(p => P3(p).map(v => v.toFixed(1)).join(',')).join(' ');
const sideEdges = computed(() => A.points.map(p => [P3(p), P3([p[0], p[1], -3])]));
const bottom = pts3(A.points.map(p => [p[0], p[1], -3]));

/** A part of pair n's line, t from a to b, in screen coordinates. */
function span(n, a, b) {
  const { P0, D } = PAIRS[n], p0 = P0.map(num), d = D.map(num), P = t => at([p0[0] + t * d[0], p0[1] + t * d[1], 0]);
  return { a: P(a), b: P(b) };
}
const LINE = [[-4.4, 2.6], [-2.2, 2.6]];
const lines = computed(() => {
  const st = step.value, out = [];
  // Pair 1: line grows in step 1; A's interval in 2; B's in 3; the cut from 4 on.
  // (A line grows from P₀, t = 0, both ways.)
  const p = PAIRS[0], [l0, l1] = LINE[0], grow = st === 1 ? k.value : st > 1 ? 1 : 0;
  if (st >= 1 && st <= 5) out.push({ ...span(0, l0 * grow, l1 * grow), cls: 'line' });
  const iv = (ts, g) => [num(ts[0]), num(ts[0]) + (num(ts[1]) - num(ts[0])) * g];
  if (st >= 2 && st <= 5) out.push({ ...span(0, ...iv(p.ta, st === 2 ? k.value : 1)), cls: 'ia' });
  if (st >= 3 && st <= 5) out.push({ ...span(0, ...iv(p.tb, st === 3 ? k.value : 1)), cls: 'ib' });
  if (st >= 4) out.push({ ...span(0, ...iv([p.lo, p.hi], st === 4 ? k.value : 1)), cls: 'cut' });
  if (st === 5) {
    const q2 = PAIRS[1], g = x => Math.max(0, Math.min(1, (k.value - x) / 0.3));
    const [m0, m1] = LINE[1];
    out.push({ ...span(1, m0 * g(0), m1 * g(0)), cls: 'line' });
    out.push({ ...span(1, ...iv(q2.ta, g(0.25))), cls: 'ia' }, { ...span(1, ...iv(q2.tb, g(0.45))), cls: 'ib' });
    out.push({ ...span(1, ...iv([q2.lo, q2.hi], g(0.7))), cls: 'cut' });
  }
  if (st >= 6) out.push({ ...span(1, num(PAIRS[1].lo), num(PAIRS[1].hi)), cls: 'cut' });
  return out;
});
const ends = computed(() => {
  const st = step.value, list = [];
  if (st >= 4) list.push(...PAIRS[0].seg);
  if (st >= 6 || (st === 5 && k.value > 0.95)) list.push(...PAIRS[1].seg);
  return list.map(p => at(p));
});
const shown = computed(() => (step.value >= 5 ? 1 : 0));
const read = computed(() => {
  const st = step.value, p = PAIRS[st === 5 ? 1 : 0], nB = st === 5 ? B2 : B1, out = [];
  if (st <= 5) {
    out.push(`A: n = ${fv(A.normal)}, d = ${fq(A.offset)}`, `B: n = ${fv(nB.normal)}, d = ${fq(nB.offset)}`);
    if (st >= 1) out.push(`D = ${fv(p.D)}`, `P₀ = ${fv(p.P0)}`);
    if (st >= 2) out.push(`in A: t ∈ ${fiv(p.ta)}`);
    if (st >= 3) out.push(`in B: t ∈ ${fiv(p.tb)}`);
    if (st >= 4) out.push(`cut:  t ∈ ${fiv([p.lo, p.hi])}`);
  } else if (st === 6) out.push('A in (x, y): z dropped', 'cuts: (3, 4) – (0, 11/2)', '      (5, 0) – (3, 4)', 'regions: 2');
  else PIECES.forEach((pc, n) => out.push(`${n + 1}: ${fv(pc.point)} → ${k.value > 0.6 ? pc.where : '…'}`));
  return out;
});
const P0dot = computed(() => (step.value >= 1 && step.value <= 4 ? at(PAIRS[0].P0.map(num)) : null));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Cutting a face: the planes' line, clipped to both faces" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="The top face of a box cut by two faces of a tilted box, then split in its own plane">
        <!-- Box A: its sides faint, its top face the one being cut. -->
        <g :opacity="1 - u" v-if="u < 0.99">
          <polygon :points="bottom" class="boxa" />
          <line v-for="(e, n) in sideEdges" :key="'s' + n" :x1="e[0][0]" :y1="e[0][1]" :x2="e[1][0]" :y2="e[1][1]" class="boxa" />
        </g>
        <polygon :points="pts(A.points)" class="facea" />
        <!-- The two pieces, once A is split. -->
        <g v-if="step >= 6">
          <polygon v-for="(pc, n) in PIECES" :key="'p' + n" :points="pts(pc.ring)" class="piece" :class="'k' + n" :opacity="step === 6 ? k : 1" />
        </g>
        <!-- B's two faces (the one cut first stronger). -->
        <g :opacity="1 - u" v-if="u < 0.99">
          <line v-for="(e, n) in BOXB" :key="'b' + n" :x1="P3(e[0])[0]" :y1="P3(e[0])[1]" :x2="P3(e[1])[0]" :y2="P3(e[1])[1]" class="boxb" />
          <polygon :points="pts3(B2.points)" class="faceb" :class="{ quiet: step < 5 }" />
          <polygon :points="pts3(B1.points)" class="faceb" :class="{ quiet: step === 5 }" />
          <text :x="P3([2, -1, 5.5])[0] - 4" :y="P3([2, -1, 5.5])[1] - 6" class="lab b">B</text>
          <text :x="P3([10, 0, 0])[0] + 4" :y="P3([10, 0, 0])[1] + 12" class="lab a">A</text>
        </g>
        <line v-for="(l, n) in lines" :key="'l' + n" :x1="l.a[0]" :y1="l.a[1]" :x2="l.b[0]" :y2="l.b[1]" :class="l.cls" />
        <circle v-for="(p, n) in ends" :key="'e' + n" :cx="p[0]" :cy="p[1]" r="3" class="end" />
        <g v-if="P0dot"><circle :cx="P0dot[0]" :cy="P0dot[1]" r="3.2" class="p0" /><text :x="P0dot[0] + 6" :y="P0dot[1] + 12" class="small">P₀</text></g>
        <!-- Triangles and the interior points. -->
        <g v-if="step === 7">
          <g v-for="(pc, n) in PIECES" :key="'t' + n">
            <polygon v-for="(tr, m) in pc.tris" :key="m" :points="pts(tr.map(i => pc.ring[i]))" class="tri" :class="{ big: m === 0 }" :opacity="Math.min(1, k * 2)" />
            <circle :cx="at(pc.point.map(num))[0]" :cy="at(pc.point.map(num))[1]" r="3.6" class="inner" :opacity="Math.min(1, k * 3)" />
            <text :x="at(pc.point.map(num))[0] + 6" :y="at(pc.point.map(num))[1] - 5" class="small">{{ n + 1 }}</text>
          </g>
        </g>
        <g class="readout">
          <text v-for="(r, n) in read" :key="'r' + n" :x="step >= 6 ? 160 : 226" :y="16 + 12 * n" xml:space="preserve">{{ r }}</text>
        </g>
        <text v-if="shown && step < 6" x="8" y="234" class="small">second pair: B's face n = (2, 1, −2)</text>
      </svg>
      <template #note>Computed in the page with the kernel's cut code (copied): fractions of BigInt integers, every value
        exact. Only these two faces of B are drawn; its other four faces miss A's top. The arrangement is not rerun here: the
        two regions are drawn from the cuts, and their triangles are the kernel's ear clipping of these rings. The kernel's
        own Boolean of the two boxes keeps exactly these pieces of A's top.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; fill: var(--vp-c-text-2); }
svg .lab { font-size: 12px; font-weight: 700; } svg .lab.a { fill: var(--a); } svg .lab.b { fill: var(--b); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.boxb { stroke: var(--b); stroke-width: 0.8; stroke-dasharray: 3 2; stroke-opacity: 0.7; }
.boxa { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 2; }
.facea { fill: color-mix(in srgb, var(--a) 14%, transparent); stroke: var(--a); stroke-width: 1.6; stroke-linejoin: round; }
.faceb { fill: color-mix(in srgb, var(--b) 16%, transparent); stroke: var(--b); stroke-width: 1.4; stroke-linejoin: round; transition: opacity .3s; }
.faceb.quiet { opacity: 0.45; }
.line { stroke: var(--vp-c-text-2); stroke-width: 1.1; stroke-dasharray: 4 3; }
.ia { stroke: var(--a); stroke-width: 7; stroke-opacity: 0.4; stroke-linecap: round; }
.ib { stroke: var(--b); stroke-width: 3.6; stroke-opacity: 0.75; stroke-linecap: round; }
.cut { stroke: var(--hot); stroke-width: 2.4; stroke-linecap: round; }
.end { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.p0 { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1; }
.piece { stroke: var(--vp-c-text-2); stroke-width: 1; stroke-linejoin: round; }
.piece.k0 { fill: color-mix(in srgb, var(--keep) 30%, transparent); }
.piece.k1 { fill: color-mix(in srgb, var(--a) 22%, transparent); }
.tri { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 2; }
.tri.big { stroke: var(--vp-c-text-1); stroke-dasharray: none; stroke-width: 1.1; }
.inner { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1.2; }
</style>
