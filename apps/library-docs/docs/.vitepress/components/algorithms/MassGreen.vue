<script setup>
// Green's theorem on an upright body's section, then the slab's height: regionMoments in
// packages/barocss-cad/src/brep/curved-arrangement.ts and prismaticMassProperties in src/brep/solid-mass.ts. The sums
// below are the kernel's: each segment by 8-point Gauss–Legendre, an arc on pieces of at most 1/16 turn, the same six
// integrands. The section is held as the kernel's prismaticFromProfile holds it (outer ring anticlockwise, the hole as
// two clockwise half circles); for it the built kernel gives A = 678.5398163397449 and, at h = 8, V = 5428.318530717959
// (closed form) and 5428.3185307179665 (its B-rep by quadrature).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const PI = Math.PI, H = 8;
/** num with a minus sign. */
const mn = (v, d) => num(v, d).replace('-', '−');
const SEGS = [
  { kind: 'line', a: [10, 10], b: [40, 10] },
  { kind: 'arc', c: [40, 20], r: 10, t0: -PI / 2, sweep: PI },
  { kind: 'line', a: [40, 30], b: [10, 30] },
  { kind: 'line', a: [10, 30], b: [10, 10] },
  { kind: 'arc', c: [22, 20], r: 5, t0: PI, sweep: -PI },
  { kind: 'arc', c: [22, 20], r: 5, t0: 2 * PI, sweep: -PI },
];
// Gauss–Legendre on [0, 1], 8 points (the kernel's GL8).
const GL8 = (() => {
  const x = [0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363], w = [0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  return [...x.map((v, i) => [(1 - v) / 2, w[i] / 2]), ...x.map((v, i) => [(1 + v) / 2, w[i] / 2])];
})();
const at = (g, u) => g.kind === 'line' ? [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u] : [g.c[0] + g.r * Math.cos(g.t0 + g.sweep * u), g.c[1] + g.r * Math.sin(g.t0 + g.sweep * u)];
/** One segment's six moments [A, ∫x, ∫y, ∫x², ∫y², ∫xy], as regionMoments sums them. */
function moments(g) {
  const m = [0, 0, 0, 0, 0, 0];
  const add = (x, y, dx, dy, w) => {
    m[0] += w * (x * dy - y * dx) / 2; m[1] += w * x * x * dy / 2; m[2] -= w * y * y * dx / 2;
    m[3] += w * x * x * x * dy / 3; m[4] -= w * y * y * y * dx / 3; m[5] += w * x * x * y * dy / 2;
  };
  if (g.kind === 'line') { const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1]; for (const [u, w] of GL8) add(g.a[0] + dx * u, g.a[1] + dy * u, dx, dy, w); return m; }
  const pieces = Math.max(1, Math.ceil(Math.abs(g.sweep) / (PI / 8)));
  for (let k = 0; k < pieces; k++) for (const [u, w] of GL8) {
    const t = g.t0 + g.sweep * (k + u) / pieces, dt = g.sweep / pieces;
    add(g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t), -g.r * Math.sin(t) * dt, g.r * Math.cos(t) * dt, w);
  }
  return m;
}
const M = SEGS.map(moments);
const total = M.reduce((acc, m) => acc.map((v, k) => v + m[k]), [0, 0, 0, 0, 0, 0]);
const [A, Sx, Sy] = total, cx = Sx / A, cy = Sy / A;
const run = [0]; for (const m of M) run.push(run[run.length - 1] + m[0]);
/** The area piece walked so far along a segment, to u (closed form: the picture's running total). */
function partial(g, u) {
  if (g.kind === 'line') return u * (g.a[0] * (g.b[1] - g.a[1]) - g.a[1] * (g.b[0] - g.a[0])) / 2;
  const t = g.t0 + g.sweep * u;
  return (g.r * g.c[0] * (Math.sin(t) - Math.sin(g.t0)) - g.r * g.c[1] * (Math.cos(t) - Math.cos(g.t0)) + g.r * g.r * (t - g.t0)) / 2;
}
// The view: 5 px a millimetre, the origin O at the lower left.
const X = x => 30 + 5 * x, Y = y => 205 - 5 * y, P = p => [X(p[0]), Y(p[1])];
const WX = v => 40 + (v + 200) * 0.28;
const OZ = [2.2, -2.6];
function samples(g, u0, u1) { const n = g.kind === 'line' ? 1 : Math.max(2, Math.ceil(48 * Math.abs(u1 - u0))); return Array.from({ length: n + 1 }, (_, j) => at(g, u0 + (u1 - u0) * j / n)); }
const line = ps => ps.map(P).map(q => q.map(v => v.toFixed(2)).join(',')).join(' ');
const segLine = SEGS.map(g => line(samples(g, 0, 1)));
// Direction marks at each segment's middle.
const arrows = SEGS.map(g => {
  const p = P(at(g, 0.5)), a = P(at(g, 0.47)), b = P(at(g, 0.53)), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n = [-d[1], d[0]];
  return `M${p[0] + 4 * d[0]},${p[1] + 4 * d[1]} L${p[0] - 3 * d[0] + 3 * n[0]},${p[1] - 3 * d[1] + 3 * n[1]} L${p[0] - 3 * d[0] - 3 * n[0]},${p[1] - 3 * d[1] - 3 * n[1]} Z`;
});
const ringPath = (list, off = [0, 0]) => list.map(i => samples(SEGS[i], 0, 1)).map((ps, j) => ps.map(P).map((q, k) => `${j === 0 && k === 0 ? 'M' : 'L'}${(q[0] + off[0]).toFixed(2)},${(q[1] + off[1]).toFixed(2)}`).join(' ')).join(' ') + ' Z';
const sectionPath = (off) => ringPath([0, 1, 2, 3], off) + ' ' + ringPath([4, 5], off);
// Where the extruded walls turn away in this view: two corners, and where the circles' tangents run along the offset.
const tTurn = Math.atan2(-OZ[0], -OZ[1]);
const silhouettes = [[10, 10], [10, 30], at(SEGS[1], (tTurn - SEGS[1].t0) / SEGS[1].sweep), [22 + 5 * Math.cos(tTurn), 20 + 5 * Math.sin(tTurn)], [22 - 5 * Math.cos(tTurn), 20 - 5 * Math.sin(tTurn)]].map(P);

const steps = [
  { label: 'Walk the boundary', text: 'An upright body is a stack of slabs, each one section raised from z₀ to z₁. Green\'s theorem turns the section\'s area into a walk round its boundary: the outer ring anticlockwise, each hole clockwise. Every ring is a chain of lines and arcs.', formula: 'A = ∬ dA = ½ ∮ (x dy − y dx)' },
  { label: 'A line', text: `Along a line from a to b, x dy − y dx is the same at every point. The piece is the signed area of the triangle from the origin O to the line; seen from O this one runs clockwise, so it counts negative: ${mn(M[0][0])}.`, formula: 'line a → b: ½ (a<sub>x</sub> b<sub>y</sub> − a<sub>y</sub> b<sub>x</sub>) = ½ (10 · 10 − 10 · 40) = −150' },
  { label: 'An arc', text: `On an arc, x = c<sub>x</sub> + r cos t and y = c<sub>y</sub> + r sin t. The kernel cuts it into pieces of at most 1/16 turn and sums 8 Gauss–Legendre points on each: this half turn is 8 pieces, 64 points, +${num(M[1][0])}. Near its start the arc turns clockwise as seen from O (red), then anticlockwise.`, formula: 'pieces = ⌈|sweep| / (π/8)⌉ &nbsp; ½ ∫ (x y′ − y x′) dt' },
  { label: 'Round the ring', text: `The top line adds +${num(M[2][0])}, the left side ${mn(M[3][0])}. What lies between O and the section was swept once each way and cancels. The ring's sum is its area, 600 + 50π = ${num(run[4])}.` },
  { label: 'A hole walks the other way', text: `The hole's two half circles run clockwise: ${mn(M[4][0])} and +${mn(M[5][0])}, together −25π = ${mn(M[4][0] + M[5][0])}. The section's area is ${num(A)} mm².` },
  { label: 'The other moments, the same walk', text: `Other integrands on the same walk give the first and second moments: ∫x dA = ${num(Sx)} and ∫y dA = ${num(Sy)} mm³, so the centroid is (${num(cx)}, ${num(cy)}). On a line every integrand is a cubic at most, which 8 points integrate exactly; on an arc the error is far below rounding.`, formula: '∫x dA = ½∮x² dy &nbsp; ∫y dA = −½∮y² dx &nbsp; ∫x² dA = ⅓∮x³ dy &nbsp; ∫y² dA = −⅓∮y³ dx &nbsp; ∫xy dA = ½∮x²y dy' },
  { label: 'Times the height', text: `A slab multiplies the section's moments by what z adds, exactly. With h = 8: V = A h = ${num(A * H)} mm³, centroid (${num(cx)}, ${num(cy)}, 4). The method is reported as closed-form. The same body as a B-rep, integrated face by face, gives 5428.3185307179665: 1.4 × 10⁻¹⁵ apart.`, formula: 'V = A h &nbsp; ∫x dV = S<sub>x</sub> h &nbsp; ∫z dV = A (z₁² − z₀²)/2 &nbsp; ∫z² dV = A (z₁³ − z₀³)/3 &nbsp; ∫xz dV = S<sub>x</sub> (z₁² − z₀²)/2' },
];
const s = useSteps(steps.length, [2600, 2600, 3800, 3600, 3400, 2600, 3200], root);
const k = computed(() => ease(s.t.value));
// Which segment is being walked, and how far.
const WALK = { 1: [0], 2: [1], 3: [2, 3], 4: [4, 5] };
const walk = computed(() => {
  const L = WALK[s.step.value];
  if (!L) return s.step.value === 0 ? { i: -1, u: 0, done: 0 } : { i: -1, u: 0, done: SEGS.length };
  const p = Math.min(1, Math.max(0, s.t.value)) * L.length, j = Math.min(L.length - 1, Math.floor(p));
  return { i: L[j], u: ease(Math.min(1, p - j)), done: L[j] };
});
const current = computed(() => walk.value.i >= 0 ? SEGS[walk.value.i] : null);
const sofar = computed(() => walk.value.i >= 0 ? run[walk.value.i] + partial(current.value, walk.value.u) : run[walk.value.done]);
const piece = computed(() => walk.value.i >= 0 ? partial(current.value, walk.value.u) : 0);
const walkedLine = computed(() => current.value && walk.value.u > 0 ? line(samples(current.value, 0, walk.value.u)) : '');
const head = computed(() => current.value ? P(at(current.value, walk.value.u)) : null);
// The fan from O over the walked part of the current segment, one thin triangle a sample, by its sign.
const fan = computed(() => {
  if (!current.value || walk.value.u <= 0) return [];
  const ps = samples(current.value, 0, walk.value.u), out = [];
  for (let j = 0; j + 1 < ps.length; j++) {
    const a = ps[j], b = ps[j + 1], sgn = a[0] * b[1] - a[1] * b[0];
    out.push({ pts: `${X(0)},${Y(0)} ${X(a[0]).toFixed(2)},${Y(a[1]).toFixed(2)} ${X(b[0]).toFixed(2)},${Y(b[1]).toFixed(2)}`, pos: sgn >= 0 });
  }
  return out;
});
// The running sum as a waterfall: one row a segment.
const rows = computed(() => {
  const out = [], w = walk.value, last = w.i >= 0 ? w.i : w.done - 1;
  for (let i = 0; i <= last && i < SEGS.length; i++) {
    const to = i === w.i ? run[i] + partial(SEGS[i], w.u) : run[i + 1];
    out.push({ i, y: 12 + 4.5 * i, from: run[i], to });
  }
  return out;
});
const lift = computed(() => s.step.value === 6 ? H * k.value : 0);
const top = computed(() => sectionPath([OZ[0] * lift.value, OZ[1] * lift.value]));
const sign = v => (v >= 0 ? '+' : '') + mn(v);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Green's theorem on a section, then times its height" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A section of lines and arcs walked round, its signed area summed segment by segment, then extruded">
        <path v-if="s.step.value >= 5" :d="sectionPath([0, 0])" class="region" fill-rule="evenodd" />
        <polygon v-for="(f, j) in fan" :key="'f' + j" :points="f.pts" :class="['fan', f.pos ? 'pos' : 'neg']" />
        <polyline v-for="(d, i) in segLine" :key="'s' + i" :points="d" :class="['edge', i < walk.done || s.step.value >= 5 ? 'walked' : 'todo']" />
        <polyline v-if="walkedLine" :points="walkedLine" class="edge walked" />
        <path v-for="(d, i) in arrows" v-show="s.step.value <= 4" :key="'a' + i" :d="d" class="arrow" />
        <circle :cx="X(0)" :cy="Y(0)" r="3" class="origin" /><text :x="X(0) - 4" :y="Y(0) + 15" class="tag">O</text>
        <g v-if="head">
          <line :x1="X(0)" :y1="Y(0)" :x2="head[0]" :y2="head[1]" class="ray" />
          <circle :cx="head[0]" :cy="head[1]" r="3.6" class="head" />
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 5">
          <line :x1="WX(0)" y1="8" :x2="WX(0)" y2="40" class="axis" />
          <line :x1="WX(A)" y1="8" :x2="WX(A)" y2="40" class="axis dash" />
          <line v-for="r in rows" :key="'r' + r.i" :x1="WX(r.from)" :x2="WX(r.to)" :y1="r.y" :y2="r.y" :class="['bar', r.to >= r.from ? 'pos' : 'neg']" />
          <text :x="WX(0)" y="50" class="tick" text-anchor="middle">0</text>
          <text :x="WX(A)" y="50" class="tick" text-anchor="middle">A</text>
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 4">
          <text x="372" y="198" class="readout" text-anchor="end">this piece {{ sign(piece) }}</text>
          <text x="372" y="214" class="readout strong" text-anchor="end">sum {{ mn(sofar) }}</text>
        </g>
        <g v-if="s.step.value === 5">
          <line :x1="X(cx) - 7" :y1="Y(cy)" :x2="X(cx) + 7" :y2="Y(cy)" class="centroid" /><line :x1="X(cx)" :y1="Y(cy) - 7" :x2="X(cx)" :y2="Y(cy) + 7" class="centroid" />
          <text :x="X(cx) + 6" :y="Y(cy) - 6" class="tag">c</text>
          <text x="372" y="198" class="readout" text-anchor="end">A = {{ num(A) }}</text>
          <text x="372" y="214" class="readout" text-anchor="end">c = ({{ num(cx, 2) }}, {{ num(cy, 2) }})</text>
        </g>
        <g v-if="s.step.value === 6">
          <line v-for="(p, j) in silhouettes" :key="'v' + j" :x1="p[0]" :y1="p[1]" :x2="p[0] + OZ[0] * lift" :y2="p[1] + OZ[1] * lift" class="wall" />
          <path :d="top" class="cap" fill-rule="evenodd" />
          <text x="372" y="198" class="readout" text-anchor="end">h = {{ num(lift, 1) }}</text>
          <text x="372" y="214" class="readout strong" text-anchor="end">V = {{ num(A * lift) }}</text>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's sums (8-point Gauss–Legendre on every segment, arcs on pieces of
        at most 1/16 turn) on this section; its area, centroid and volume match the built kernel's prismaticMassProperties.
        The fans from O are for the picture: where O lies changes the pieces, not their sum. The running total inside a
        segment uses the closed form of the same integral.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.region { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: none; }
.edge { fill: none; stroke-linejoin: round; stroke-linecap: round; }
.edge.todo { stroke: var(--vp-c-text-3); stroke-width: 1.2; }
.edge.walked { stroke: var(--a); stroke-width: 2.4; }
.arrow { fill: var(--a); }
.fan { stroke: none; } .fan.pos { fill: color-mix(in srgb, var(--keep) 30%, transparent); } .fan.neg { fill: color-mix(in srgb, var(--hot) 30%, transparent); }
.origin { fill: var(--vp-c-text-1); }
.ray { stroke: var(--vp-c-text-2); stroke-width: 1; stroke-dasharray: 3 2; }
.head { fill: var(--vp-c-bg); stroke: var(--a); stroke-width: 2; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; } .axis.dash { stroke-dasharray: 3 2; }
.bar { stroke-width: 3.2; stroke-linecap: round; } .bar.pos { stroke: var(--keep); } .bar.neg { stroke: var(--hot); }
.tick { font-size: 10px; }
.tag { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-2); } .readout.strong { fill: var(--vp-c-text-1); }
.centroid { stroke: var(--b); stroke-width: 2; }
.wall { stroke: var(--a); stroke-width: 1.2; }
.cap { fill: color-mix(in srgb, var(--a) 22%, transparent); stroke: var(--a); stroke-width: 1.6; }
</style>
