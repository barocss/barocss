<script setup>
// The nearest point of a general 2D curve segment in the curve arrangement (packages/barocss-cad/src/brep/curved-
// arrangement.ts, paramOf and goldenNearest): the nearest of the segment's CURVE_SAMPLES + 1 = 65 samples, then 60 steps
// of golden-section search on the squared distance over the two chords beside it, the answer the middle of the last
// bracket. The curve is a sinusoid, the shape a plane's cut takes in a cylinder's (angle × radius, height) domain; its
// units are the figure's. Everything is computed here, at load, with the kernel's constants.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const f = u => [34 + 312 * u, 72 - 46 * Math.sin(2 * Math.PI * u)];
const P = [150, 50];
const d2 = u => { const q = f(u); return (q[0] - P[0]) ** 2 + (q[1] - P[1]) ** 2; };
const N = 64, G = 0.6180339887;
const SAMPLES = Array.from({ length: N + 1 }, (_, k) => f(k / N));
// The scan, with the best so far after each sample (for the sweep in step 2).
const BEST = [];
{ let b = 0, bd = Infinity; for (let k = 0; k <= N; k++) { const v = d2(k / N); if (v < bd) { bd = v; b = k; } BEST.push(b); } }
const K = BEST[N], LO = Math.max(0, (K - 1) / N), HI = Math.min(1, (K + 1) / N);
// The 60 steps: each bracket, its two inner points and which side was kept.
const ITER = [];
{
  let lo = LO, hi = HI;
  for (let i = 0; i < 60; i++) {
    const m1 = hi - (hi - lo) * G, m2 = lo + (hi - lo) * G, left = d2(m1) < d2(m2);
    ITER.push({ lo, hi, m1, m2, left });
    if (left) hi = m2; else lo = m1;
  }
  ITER.push({ lo, hi });
}
const LAST = ITER[60], U = (LAST.lo + LAST.hi) / 2, DU = Math.sqrt(d2(U)), DK = Math.sqrt(d2(K / N));
const sci = x => { const e = Math.floor(Math.log10(x)), m = x / 10 ** e; return `${m.toFixed(1)} × 10<sup>${e < 0 ? '−' : ''}${Math.abs(e)}</sup>`; };

const steps = [
  { label: 'A curve given as a function', text: 'In the curve arrangement — the 2D face domains a Boolean splits — a segment may be a general curve: a function f(t) over t₀ → t₁, and nothing else, no derivatives. <code>paramOf</code> finds the parameter u ∈ [0, 1] of its point nearest p: for a point on it (a crossing, a vertex) the place to split it, for any point its distance (<code>segDistance</code>).', formula: 'minimise d²(u) = ‖f(t₀ + (t₁ − t₀) u) − p‖²' },
  { label: 'Nearest of 65 samples', text: `The segment's 65 samples (CURVE_SAMPLES = 64 chords), made once per segment and kept, are scanned for the one nearest p: here sample ${K}, ${num(DK, 2)} from p.` },
  { label: 'A bracket of two chords', text: `The search runs over the chords either side of that sample, cut to [0, 1]: u from ${K - 1}/64 to ${K + 1}/64. Below, d² over the whole curve, then over the bracket. Inside it d² has one minimum, so long as the samples follow the curve's turns.`, formula: '[lo, hi] = [max(0, (k − 1)/64), min(1, (k + 1)/64)]' },
  { label: 'Two inner points', text: 'Two points divide the bracket in the golden ratio, one from each end. Both are evaluated on the curve and their squared distances compared.', formula: 'm₁ = hi − 0.6180339887 (hi − lo) &nbsp; m₂ = lo + 0.6180339887 (hi − lo)' },
  { label: 'Keep the lower side', text: 'The minimum cannot lie beyond the inner point that is farther from p: if d²(m₁) &lt; d²(m₂) the bracket ends at m₂, else it starts at m₁. Each step keeps 0.618 of the bracket, whatever the curve, and needs no derivative.', formula: 'd²(m₁) &lt; d²(m₂) ? hi ← m₂ : lo ← m₁' },
  { label: 'Sixty steps, then the middle', text: `After 60 steps the bracket is 0.618⁶⁰ ≈ 2.9 × 10⁻¹³ of its first width: here ${sci(LAST.hi - LAST.lo)} in u. The answer is its middle, u = ${num(U, 9)}, ${num(DU, 4)} from p (the nearest sample was ${num(DK, 4)}). The cost is fixed: both inner points are evaluated at every step, 120 evaluations of f a search, besides the samples made once.`, formula: 'u = (lo + hi) / 2 &nbsp; after 60 steps' },
];
const s = useSteps(steps.length, [2600, 3400, 3000, 2600, 5600, 3000], root);
const k = computed(() => ease(s.t.value));

// The top view uses the figure's units directly; the plot below maps a window of u.
const pt = q => `${q[0]},${q[1]}`;
const CURVE = Array.from({ length: 241 }, (_, i) => pt(f(i / 240))).join(' ');
const piece = (a, b) => Array.from({ length: 13 }, (_, i) => pt(f(a + (b - a) * i / 12))).join(' ');
const PX0 = 34, PX1 = 346, PY0 = 152, PY1 = 222;
const win = computed(() => {
  const st = s.step.value, z = st < 2 ? 0 : st === 2 ? k.value : 1;
  return { a: LO * z, b: 1 + (HI - 1) * z };
});
const plot = computed(() => {
  const { a, b } = win.value, vs = Array.from({ length: 121 }, (_, i) => d2(a + (b - a) * i / 120));
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const x = u => PX0 + (PX1 - PX0) * (u - a) / (b - a), y = v => PY1 - (PY1 - PY0) * (v - lo) / span;
  return { x, y, line: vs.map((v, i) => `${PX0 + (PX1 - PX0) * i / 120},${y(v)}`).join(' ') };
});
const cx = u => Math.min(PX1 + 6, Math.max(PX0 - 6, plot.value.x(u)));
// Which bracket is shown, and its ends: lerped from one step's to the next while step 5 plays ten of them.
const SHOWN = 10;
const at = computed(() => {
  const st = s.step.value;
  if (st <= 3) return { i: 0, lo: LO, hi: HI };
  if (st === 4) {
    const x = k.value * SHOWN, i = Math.min(SHOWN - 1, Math.floor(x)), w = Math.min(1, (x - i) * 1.6);
    return { i, lo: ITER[i].lo + (ITER[i + 1].lo - ITER[i].lo) * w, hi: ITER[i].hi + (ITER[i + 1].hi - ITER[i].hi) * w };
  }
  return { i: 60, lo: LAST.lo, hi: LAST.hi };
});
const inner = computed(() => ITER[Math.min(59, at.value.i)]);
const scanned = computed(() => (s.step.value === 1 ? Math.round(k.value * N) : s.step.value > 1 ? N : -1));
const bestNow = computed(() => (scanned.value >= 0 ? BEST[scanned.value] : -1));
/** The plot's u labels: the whole curve, then the bracket. */
const ends = computed(() => (s.step.value < 2 || (s.step.value === 2 && k.value < 0.5) ? ['0', '1'] : [`${K - 1}/64`, `${K + 1}/64`]));
const widthText = computed(() => { const w = at.value.hi - at.value.lo; return w > 1e-3 ? num(w, 5) : w.toExponential(2); });
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The nearest point of a 2D curve: golden-section search" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A sinusoidal curve with 65 samples, a point beside it, and a golden-section search shrinking its bracket, with the squared distance plotted below">
        <polyline :points="CURVE" class="curve" />
        <circle v-for="(q, i) in SAMPLES" :key="'s' + i" :cx="q[0]" :cy="q[1]" r="1.4" :class="['sample', { seen: i <= scanned }]" />
        <g v-if="s.step.value === 1 && scanned >= 0">
          <line :x1="P[0]" :y1="P[1]" :x2="SAMPLES[scanned][0]" :y2="SAMPLES[scanned][1]" class="probe" />
        </g>
        <g v-if="bestNow >= 0">
          <line :x1="P[0]" :y1="P[1]" :x2="SAMPLES[bestNow][0]" :y2="SAMPLES[bestNow][1]" class="best-line" />
          <circle :cx="SAMPLES[bestNow][0]" :cy="SAMPLES[bestNow][1]" r="3.6" class="best" />
        </g>
        <polyline v-if="s.step.value >= 2" :points="piece(at.lo, at.hi)" class="bracket-piece" />
        <g v-if="s.step.value === 3 || s.step.value === 4">
          <circle :cx="f(inner.m1)[0]" :cy="f(inner.m1)[1]" r="2" class="m" /><circle :cx="f(inner.m2)[0]" :cy="f(inner.m2)[1]" r="2" class="m" />
        </g>
        <g v-if="s.step.value === 5">
          <line :x1="P[0]" :y1="P[1]" :x2="f(U)[0]" :y2="f(U)[1]" class="found-line" :style="{ opacity: k }" />
          <circle :cx="f(U)[0]" :cy="f(U)[1]" r="3.4" class="found" :style="{ opacity: k }" />
        </g>
        <circle :cx="P[0]" :cy="P[1]" r="4" class="p" /><text :x="P[0] + 7" :y="P[1] + 11" class="tag">p</text>
        <text x="34" y="128" class="small">f(t) and its 65 samples</text>
        <!-- the squared distance over the window -->
        <line :x1="PX0" :x2="PX1" :y1="PY1" :y2="PY1" class="axis" />
        <text :x="PX0" y="144" class="small">d²(u)</text>
        <g v-if="s.step.value >= 2">
          <rect :x="cx(at.lo)" :y="PY0 - 4" :width="Math.max(0.6, cx(at.hi) - cx(at.lo))" :height="PY1 - PY0 + 4" class="bracket" />
        </g>
        <polyline :points="plot.line" class="dist" />
        <g v-if="s.step.value === 3 || s.step.value === 4">
          <line :x1="cx(inner.m1)" :x2="cx(inner.m1)" :y1="PY0 - 4" :y2="PY1" class="mline" />
          <line :x1="cx(inner.m2)" :x2="cx(inner.m2)" :y1="PY0 - 4" :y2="PY1" class="mline" />
          <circle :cx="cx(inner.m1)" :cy="plot.y(d2(inner.m1))" r="3" :class="['m', { lower: inner.left }]" />
          <circle :cx="cx(inner.m2)" :cy="plot.y(d2(inner.m2))" r="3" :class="['m', { lower: !inner.left }]" />
          <text :x="cx(inner.m1)" :y="PY1 + 11" class="small mid">m₁</text><text :x="cx(inner.m2)" :y="PY1 + 11" class="small mid">m₂</text>
        </g>
        <text v-if="s.step.value >= 4" :x="PX1" y="144" class="small end">step {{ at.i }} of 60 · width {{ widthText }}</text>
        <g v-if="s.step.value === 5">
          <line :x1="cx(U)" :x2="cx(U)" :y1="PY0 - 4" :y2="PY1" class="found-line" />
          <circle :cx="cx(U)" :cy="plot.y(d2(U))" r="3.4" class="found" />
        </g>
        <text :x="PX0" y="236" class="small">{{ ends[0] }}</text>
        <text :x="PX1" y="236" class="small end">{{ ends[1] }}</text>
        <text :x="(PX0 + PX1) / 2" y="236" class="small mid">u</text>
      </svg>
      <template #note>Computed in the page with the kernel's search and constants on a sinusoid — the shape a plane's cut
        takes in a cylinder's (angle × radius, height) domain — in the figure's own units. Step 5 plays the first ten of
        the 60 steps. The bracket in the top view is the part of the curve still searched.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; } .end { text-anchor: end; } .mid { text-anchor: middle; }
.curve { fill: none; stroke: var(--a); stroke-width: 1.8; }
.sample { fill: var(--vp-c-bg); stroke: var(--a); stroke-width: 0.8; } .sample.seen { fill: var(--a); }
.probe { stroke: var(--vp-c-text-3); stroke-width: 0.8; }
.best-line { stroke: var(--b); stroke-width: 1; stroke-dasharray: 3 2; }
.best { fill: none; stroke: var(--b); stroke-width: 1.6; }
.bracket-piece { fill: none; stroke: var(--keep); stroke-width: 4; stroke-linecap: round; opacity: 0.8; }
.p { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.tag { fill: var(--hot); font-weight: 700; }
.axis { stroke: var(--vp-c-divider); stroke-width: 1; }
.bracket { fill: var(--keep); fill-opacity: 0.12; stroke: var(--keep); stroke-width: 0.8; }
.dist { fill: none; stroke: var(--b); stroke-width: 1.8; }
.mline { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 2; }
.m { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.4; } .m.lower { fill: var(--keep); stroke: var(--keep); }
.found-line { stroke: var(--keep); stroke-width: 1.2; stroke-dasharray: 3 2; }
.found { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
</style>
