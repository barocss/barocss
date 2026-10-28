<script setup>
// The curve case of Catmull–Clark (packages/barocss-cad/src/features/subd-sd2.ts, `refine`, the rules it uses on sharp
// edges): every edge gets its midpoint, every vertex moves to (a + 6v + b)/8. Repeated, the polygon converges to the
// uniform cubic B-spline whose control polygon it started as. Everything is computed here, in the page, on one closed
// polygon in the figure's own units.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const P = [[62, 170], [58, 80], [138, 40], [210, 92], [298, 46], [336, 150], [206, 212]];
const n = P.length;
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
/** One step: each vertex to (a + 6v + b)/8, then the midpoint of the edge after it. */
function refineClosed(Q) {
  const m = Q.length, out = [];
  for (let i = 0; i < m; i++) {
    const a = Q[(i + m - 1) % m], v = Q[i], b = Q[(i + 1) % m];
    out.push([(a[0] + 6 * v[0] + b[0]) / 8, (a[1] + 6 * v[1] + b[1]) / 8], mid(v, b));
  }
  return out;
}
/** The same polygon with its midpoints added (where the next step starts from). */
function withMidpoints(Q) { const m = Q.length, out = []; for (let i = 0; i < m; i++) out.push(Q[i], mid(Q[i], Q[(i + 1) % m])); return out; }
const LEVELS = [P]; for (let l = 1; l <= 4; l++) LEVELS.push(refineClosed(LEVELS[l - 1]));
const STARTS = LEVELS.map(withMidpoints);
// The uniform cubic B-spline of P: span i (s from i to i + 1) from P(i − 1) … P(i + 2).
const basis = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
function C(s) {
  s = ((s % n) + n) % n;
  const i = Math.min(n - 1, Math.floor(s)), b = basis(s - i);
  let x = 0, y = 0;
  for (let a = 0; a < 4; a++) { const p = P[(i - 1 + a + n) % n]; x += b[a] * p[0]; y += b[a] * p[1]; }
  return [x, y];
}
const CURVE = Array.from({ length: 32 * n + 1 }, (_, k) => C(k / 32));
const CURVE_LENGTH = CURVE.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - CURVE[i][0], p[1] - CURVE[i][1]), 0);
// How far each level's points are from the curve at their own parameter (point m of level l sits at s = m / 2^l),
// and how far their limit positions, (a + 4v + b)/6, are from it.
const far = LEVELS.map((Q, l) => Math.max(...Q.map((q, m) => Math.hypot(q[0] - C(m / 2 ** l)[0], q[1] - C(m / 2 ** l)[1]))));
const limitMiss = Math.max(...LEVELS.slice(1).flatMap((Q, l) => Q.map((v, m) => {
  const a = Q[(m + Q.length - 1) % Q.length], b = Q[(m + 1) % Q.length], c = C(m / 2 ** (l + 1));
  return Math.hypot((a[0] + 4 * v[0] + b[0]) / 6 - c[0], (a[1] + 4 * v[1] + b[1]) / 6 - c[1]);
})));
const SUB = '₀₁₂₃₄₅₆';
const poly = Q => Q.map(p => `${p[0]},${p[1]}`).join(' ');
const ring = Q => poly([...Q, Q[0]]);
const SPAN = 2;
const SPAN_CURVE = CURVE.slice(32 * SPAN, 32 * (SPAN + 1) + 1);

const steps = [
  { label: 'A control polygon', text: 'Seven points P<sub>0</sub> … P<sub>6</sub>, joined in a closed loop. Subdivision makes a finer polygon from it with two rules, then does it again. The surface case is the same rules on a grid of quads, so the curve comes first.' },
  { label: 'Edge points: the midpoints', text: 'Every edge gets a new point halfway along it.', formula: 'E<sub>i</sub> = ½ P<sub>i</sub> + ½ P<sub>i+1</sub>' },
  { label: 'Vertex points: each old point moves', text: 'Every old point moves toward its two neighbours, three quarters itself and an eighth of each. The polygon now has twice the points and its corners are cut.', formula: 'V<sub>i</sub> = ⅛ P<sub>i−1</sub> + ¾ P<sub>i</sub> + ⅛ P<sub>i+1</sub>' },
  { label: 'Again, and again', text: `The same two rules on the new polygon, three more times: 14, 28, 56 and 112 points. The largest distance from the limit curve falls by about four each time: ${far.slice(0, 5).map(d => num(d, 2)).join(' → ')} (figure units).` },
  { label: 'The limit, drawn directly', text: `The curve in green is not the polygon refined further. It is the uniform cubic B-spline of the seven first points, evaluated from its formula. The refined polygons close in on it, and every refined point's limit position, (a + 4v + b)/6, lies on it already (to ${limitMiss.toExponential(0)} here, rounding).`, formula: 'C(s) = Σ<sub>a=0..3</sub> b<sub>a</sub>(t) P<sub>i−1+a</sub>, &nbsp; i = ⌊s⌋, t = s − i' },
  { label: 'One span, four points', text: 'Each span of the curve depends on four consecutive points only, with weights that sum to 1. A surface patch is the same thing in two directions: four by four points, sixteen in all.', formula: 'b<sub>0</sub> = (1 − t)³/6 &nbsp; b<sub>1</sub> = (3t³ − 6t² + 4)/6<br>b<sub>2</sub> = (−3t³ + 3t² + 3t + 1)/6 &nbsp; b<sub>3</sub> = t³/6' },
];
const s = useSteps(steps.length, [2000, 2200, 2600, 5600, 3000, 4200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
/** The polygon on screen: the start, its midpoints, the morph of one step, or the steps after it. */
const shown = computed(() => {
  const i = step.value;
  if (i <= 1) return P;
  if (i === 2) return STARTS[0].map((p, m) => lerp(p, LEVELS[1][m], k.value));
  if (i === 3) {
    const u = Math.min(2.999, 3 * k.value), l = 1 + Math.floor(u), f = ease(u - Math.floor(u));
    return STARTS[l].map((p, m) => lerp(p, LEVELS[l + 1][m], f));
  }
  return LEVELS[4];
});
const midR = computed(() => (step.value === 1 ? Math.max(0, 3.6 * k.value) : 3.6));
const moving = computed(() => lerp(P[2], LEVELS[1][4], step.value === 2 ? k.value : 1));
const reveal = computed(() => (step.value === 4 ? CURVE_LENGTH * (1 - k.value) : 0));
const t = computed(() => (step.value === 5 ? k.value : 0.5));
const onSpan = computed(() => C(SPAN + t.value));
const weights = computed(() => basis(t.value));
const LABEL_OFF = [[-16, 4], [-14, -6], [-4, -10], [2, 16], [4, -10], [8, 4], [-4, 16]];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Subdividing a polygon: the limit is a cubic B-spline" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A closed control polygon refined by midpoint and vertex rules, converging to its cubic B-spline">
        <polygon :points="poly(P)" class="cage" :class="{ faint: step >= 2 }" />
        <polyline v-if="step >= 4" :points="poly(CURVE)" class="curve" :stroke-dasharray="CURVE_LENGTH" :stroke-dashoffset="reveal" />
        <polyline v-if="step === 5" :points="poly(SPAN_CURVE)" class="span" />
        <polygon v-if="step >= 2 && step <= 4" :points="poly(shown)" class="refined" :class="{ faint: step >= 4 }" />
        <g v-if="step <= 1 || step === 5">
          <circle v-for="(p, i) in P" :key="'p' + i" :cx="p[0]" :cy="p[1]" r="3.6" class="pt" :class="{ dim: step === 5 && (i < SPAN - 1 || i > SPAN + 2), four: step === 5 && i >= SPAN - 1 && i <= SPAN + 2 }" />
          <text v-for="(p, i) in P" :key="'l' + i" :x="p[0] + LABEL_OFF[i][0]" :y="p[1] + LABEL_OFF[i][1]" class="tag">P{{ SUB[i] }}</text>
        </g>
        <g v-if="step === 1">
          <circle v-for="(p, i) in P" :key="'m' + i" :cx="mid(p, P[(i + 1) % n])[0]" :cy="mid(p, P[(i + 1) % n])[1]" :r="midR" class="edge-pt" />
          <text :x="mid(P[1], P[2])[0] - 26" :y="mid(P[1], P[2])[1] - 6" class="w">½ ½</text>
        </g>
        <g v-if="step === 2">
          <line :x1="P[1][0]" :y1="P[1][1]" :x2="moving[0]" :y2="moving[1]" class="pull" />
          <line :x1="P[3][0]" :y1="P[3][1]" :x2="moving[0]" :y2="moving[1]" class="pull" />
          <circle v-for="(p, i) in P" :key="'o' + i" :cx="p[0]" :cy="p[1]" r="2.4" class="ghost" />
          <text :x="P[2][0] - 6" :y="P[2][1] - 9" class="w">¾</text>
          <text :x="P[1][0] - 18" :y="P[1][1] + 4" class="w">⅛</text>
          <text :x="P[3][0] + 6" :y="P[3][1] + 14" class="w">⅛</text>
        </g>
        <g v-if="step === 2 || step === 3">
          <circle v-for="(p, i) in shown" :key="'r' + i" :cx="p[0]" :cy="p[1]" :r="step === 3 && shown.length > 40 ? 1.4 : 2.6" :class="i % 2 ? 'edge-pt' : 'vert-pt'" />
        </g>
        <g v-if="step === 5">
          <line v-for="a in 4" :key="'wl' + a" :x1="onSpan[0]" :y1="onSpan[1]" :x2="P[SPAN - 2 + a][0]" :y2="P[SPAN - 2 + a][1]" class="pull" :style="{ opacity: 0.2 + 1.2 * weights[a - 1] }" />
          <circle :cx="onSpan[0]" :cy="onSpan[1]" r="4.2" class="on" />
          <g v-for="a in 4" :key="'bar' + a">
            <rect :x="16 + 22 * (a - 1)" :y="222 - 50 * weights[a - 1]" width="14" :height="Math.max(0, 50 * weights[a - 1])" class="bar" />
            <text :x="17 + 22 * (a - 1)" y="234" class="tag small">b{{ SUB[a - 1] }}</text>
          </g>
          <text x="104" y="222" class="tag">t = {{ num(t, 2) }}</text>
        </g>
        <text x="12" y="20" class="name">{{ step <= 1 || step === 5 ? '7 points' : `${shown.length} points` }}</text>
      </svg>
      <template #note>Computed in the page on this polygon, in the figure's units. On a surface the same rules apply along
        a crease or a boundary (midpoints, (a + 6v + b)/8); inside, Catmull–Clark adds face points and weighs the
        neighbours differently, but on a regular grid it is this curve rule in each direction.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.cage { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.3; stroke-linejoin: round; }
.cage.faint { stroke: var(--vp-c-text-3); stroke-width: 0.9; stroke-dasharray: 3 3; }
.refined { fill: none; stroke: var(--a); stroke-width: 1.4; stroke-linejoin: round; }
.refined.faint { opacity: 0.45; stroke-width: 1; }
.curve { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linejoin: round; }
.span { fill: none; stroke: var(--b); stroke-width: 4.2; stroke-linecap: round; opacity: 0.85; }
.pt { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1; }
.pt.dim { opacity: 0.3; } .pt.four { fill: var(--b); }
.ghost { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.edge-pt { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.vert-pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.pull { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 3 2; }
.on { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.bar { fill: var(--b); opacity: 0.8; }
.tag { font-weight: 600; } .tag.small { font-size: 10px; }
.w { fill: var(--b); font-weight: 700; font-size: 12px; }
.name { font-weight: 700; fill: var(--vp-c-text-1); }
</style>
