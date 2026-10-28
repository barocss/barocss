<script setup>
// Rational weights on the kernel's own test curve (packages/barocss-cad/test/math.test.mjs, 'rational quarter circle'):
// degree 2, knots [0, 0, 0, 1, 1, 1], poles (10, 0), (10, 10), (0, 10). On these knots the kernel's basis is the
// quadratic Bernstein basis, so C(u) = Σ N w P / Σ N w (core/math.ts, curvePoint/projectXYZ) is written out below.
// Kernel numbers (sampleCurve, 129 samples, built dist): weights 1 → max |r − 10| = 0.6066017177982133 mm;
// middle weight √½ → 3.55e-15 mm. The same 129 samples are used here.
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const A = [10, 0], Bp = [10, 10], C = [0, 10], R = 10, COS45 = Math.SQRT1_2;
/** C(u) and its homogeneous numerator for weights (wa, wb, wc). */
function point(u, wb, wa = 1, wc = 1) {
  const n0 = (1 - u) * (1 - u) * wa, n1 = 2 * u * (1 - u) * wb, n2 = u * u * wc, W = n0 + n1 + n2;
  const x = n0 * A[0] + n1 * Bp[0] + n2 * C[0], y = n0 * A[1] + n1 * Bp[1] + n2 * C[1];
  return { c: [x / W, y / W], h: [x, y], W };
}
const SAMPLES = Array.from({ length: 129 }, (_, j) => j / 128);
const deviation = w => SAMPLES.reduce((m, u) => { const c = point(u, w).c; return Math.max(m, Math.abs(Math.hypot(c[0], c[1]) - R)); }, 0);
const fmtDev = d => (d < 1e-12 ? '< 10⁻¹² mm' : `= ${num(d, 3)} mm`);

// The view: 18 px per mm, the circle's centre (the origin) at the lower left.
const X = x => 34 + 18 * x, Y = y => 236 - 18 * y;
const path = ps => ps.map(c => `${X(c[0])},${Y(c[1])}`).join(' ');
const ARC = path(Array.from({ length: 65 }, (_, j) => { const a = (Math.PI / 2) * j / 64; return [R * Math.cos(a), R * Math.sin(a)]; }));
const RAYS = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];

const steps = [
  { label: 'Same points, every weight 1', text: 'Three control points and a weight each. With every weight 1 the curve is a plain quadratic: it starts tangent to P<sub>0</sub>P<sub>1</sub> and ends tangent to P<sub>1</sub>P<sub>2</sub>, like a quarter circle, but it is not one: its distance from the centre is up to 0.607 mm off the radius 10 mm.', formula: 'C(u) = Σ N<sub>i,2</sub>(u) w<sub>i</sub> P<sub>i</sub> / Σ N<sub>i,2</sub>(u) w<sub>i</sub>, &nbsp; w = (1, 1, 1)' },
  { label: 'Lower the middle weight to cos 45°', text: 'A weight scales how strongly its point pulls. Set the middle one to cos 45° = √½ ≈ 0.7071 and every point of the curve lands on the circle: the kernel measures at most 3.6 × 10⁻¹⁵ mm off over 129 samples. For an arc of half-angle θ the middle weight is cos θ.', formula: 'w = (1, cos 45°, 1) = (1, 0.70711, 1)' },
  { label: 'Where the weight acts: the shoulder point', text: 'At u = ½ the formula reduces to a point on the line from M, the midpoint of P<sub>0</sub>P<sub>2</sub>, to P<sub>1</sub>: the fraction w / (1 + w) of the way. A weight of 1 gives ½; √½ gives 0.4142, which puts C(½) at (7.071, 7.071), on the circle.', formula: 'C(½) = (M + w P<sub>1</sub>) / (1 + w), &nbsp; M = (P<sub>0</sub> + P<sub>2</sub>) / 2' },
  { label: 'Heavier pulls, lighter pushes', text: 'Raising the weight draws the curve toward P<sub>1</sub> (a hyperbola, for w &gt; 1); lowering it lets the curve sag toward the chord (an ellipse, for w &lt; 1). The kernel accepts weights in [10⁻⁶, 10⁶]; a point\'s weight 0 or below is refused. Try the slider.', formula: 'w &lt; 1: ellipse &nbsp; w = 1: parabola &nbsp; w &gt; 1: hyperbola' },
  { label: 'Scale every weight: nothing moves', text: 'Multiplying all the weights by one number cancels between the top and the bottom of the quotient, so the curve does not change. The kernel\'s test does it with a factor of 123 over 129 samples.', formula: 'Σ N (c w) P / Σ N (c w) = Σ N w P / Σ N w' },
  { label: 'The homogeneous form: lift, then divide', text: 'Written with the weight as a fourth coordinate, P<sup>w</sup> = (w x, w y, w z, w), the curve\'s top and bottom are one ordinary polynomial B-spline (dashed: its x and y). Dividing by its last coordinate W slides each point along the line through the origin onto the circle. Knot insertion, degree elevation and Bézier span extraction all work on these four numbers and divide at the end.', formula: 'C<sup>w</sup>(u) = Σ N<sub>i,p</sub>(u) P<sub>i</sub><sup>w</sup> = (X, Y, Z, W), &nbsp; C(u) = (X, Y, Z) / W' },
];
const s = useSteps(steps.length, [2600, 3600, 3000, 6400, 3400, 4200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

// A weight the reader sets with the slider holds until the step changes.
const userW = ref(null);
watch(() => s.step.value, () => { userW.value = null; });
function onSlide(e) { s.pause(); userW.value = Math.max(0.2, Math.min(3, +e.target.value)); }
/** The middle weight each step plays: 1 → √½, then up to 3, down to 0.25 and back. */
function scheduled() {
  const t = s.t.value, st = step.value;
  if (st === 0) return 1;
  if (st === 1) return 1 + (COS45 - 1) * k.value;
  if (st === 3) {
    if (t < 0.4) return COS45 + (3 - COS45) * ease(t / 0.4);
    if (t < 0.8) return 3 + (0.25 - 3) * ease((t - 0.4) / 0.4);
    return 0.25 + (COS45 - 0.25) * ease((t - 0.8) / 0.2);
  }
  return COS45;
}
const w = computed(() => (userW.value ?? scheduled()));
const scale = computed(() => (step.value === 4 ? 123 ** k.value : 1));
const curve = computed(() => {
  const m = step.value === 0 ? Math.max(1, Math.round(k.value * 128)) : 128;
  return path(SAMPLES.slice(0, m + 1).map(u => point(u, w.value).c));
});
const dev = computed(() => fmtDev(deviation(w.value)));
const M = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
const half = computed(() => point(0.5, w.value).c);
const frac = computed(() => w.value / (1 + w.value));
const shoulder = computed(() => { const f = step.value === 2 ? frac.value * k.value : frac.value; return [M[0] + f * (Bp[0] - M[0]), M[1] + f * (Bp[1] - M[1])]; });
// Step 6: the numerator curve (x, y of C^w) and points sliding along their rays from it to C.
const numerator = computed(() => path(SAMPLES.map(u => point(u, w.value).h)));
const rays = computed(() => RAYS.map(u => { const q = point(u, w.value), f = k.value; return { h: q.h, c: q.c, m: [q.h[0] + (q.c[0] - q.h[0]) * f, q.h[1] + (q.c[1] - q.h[1]) * f] }; }));
const poles = computed(() => [A, Bp, C]);
const weightsText = computed(() => { const c = scale.value; return `w = (${num(c, 2)}, ${num(c * w.value, 3)}, ${num(c, 2)})`; });
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Rational weights: a quarter circle made exact" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A quadratic rational curve on three control points beside a quarter circle, with the middle weight changing">
        <polyline :points="ARC" class="circle" />
        <line :x1="X(0)" :y1="Y(0)" :x2="X(A[0])" :y2="Y(A[1])" class="radius" />
        <line :x1="X(0)" :y1="Y(0)" :x2="X(C[0])" :y2="Y(C[1])" class="radius" />
        <circle :cx="X(0)" :cy="Y(0)" r="2.5" class="origin" />
        <text :x="X(0) - 4" :y="Y(0) + 12" class="small">O</text>
        <polyline :points="path(poles)" class="polygon" />
        <g v-if="step === 5">
          <polyline :points="numerator" class="numerator" />
          <g v-for="(r, i) in rays" :key="'r' + i">
            <line :x1="X(0)" :y1="Y(0)" :x2="X(r.c[0] * 1.06)" :y2="Y(r.c[1] * 1.06)" class="ray" />
            <circle :cx="X(r.h[0])" :cy="Y(r.h[1])" r="2.2" class="hpt" />
            <circle :cx="X(r.m[0])" :cy="Y(r.m[1])" r="3" class="mpt" />
          </g>
        </g>
        <polyline :points="curve" class="curve" />
        <g v-if="step === 2 || step === 3">
          <line :x1="X(M[0])" :y1="Y(M[1])" :x2="X(Bp[0])" :y2="Y(Bp[1])" class="shoulder-line" />
          <circle :cx="X(M[0])" :cy="Y(M[1])" r="3" class="m" />
          <text :x="X(M[0]) - 6" :y="Y(M[1]) + 14" class="small" text-anchor="end">M</text>
          <circle :cx="X(shoulder[0])" :cy="Y(shoulder[1])" r="4.5" class="point" />
        </g>
        <g v-for="(q, i) in poles" :key="'p' + i">
          <circle :cx="X(q[0])" :cy="Y(q[1])" :r="i === 1 ? 3 + 2.2 * Math.sqrt(w) : 4" class="pole" :class="{ mid: i === 1 }" />
          <text :x="X(q[0]) + (i === 2 ? -4 : 8)" :y="Y(q[1]) + (i === 0 ? 4 : -9)" class="label" :text-anchor="i === 2 ? 'end' : 'start'">P{{ ['₀', '₁', '₂'][i] }}</text>
        </g>
        <!-- Readouts. -->
        <g class="readout">
          <text x="234" y="132">{{ weightsText }}</text>
          <text x="234" y="150">C(½) = ({{ num(half[0], 3) }}, {{ num(half[1], 3) }})</text>
          <text x="234" y="168">w / (1 + w) = {{ num(frac, 4) }}</text>
          <text x="234" y="186">max |r − 10| {{ dev }}</text>
          <text v-if="step === 5" x="234" y="210" class="b">dashed: Σ N w P (x, y)</text>
          <text v-if="step === 5" x="234" y="226" class="keep">solid: (X, Y) / W</text>
        </g>
      </svg>
      <div class="slider">
        <label for="nurbs-weight">middle weight w₁</label>
        <input id="nurbs-weight" type="range" min="0.2" max="3" step="0.01" :value="w" aria-label="Middle control point weight" @input="onSlide">
        <output for="nurbs-weight">{{ num(w, 3) }}</output>
        <button type="button" :aria-pressed="Math.abs(w - COS45) < 1e-9" @click="s.pause(); userW = COS45">cos 45°</button>
      </div>
      <template #note>Computed in the page on the kernel's test curve, with its formula Σ N w P / Σ N w (on knots
        [0, 0, 0, 1, 1, 1] the basis is the quadratic Bernstein basis). The deviation is the largest of 129 equally spaced
        parameters, as in the kernel's test. The slider holds until the next step; the steps then play their own weights.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; }
svg .label { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout .b { fill: var(--b); } .readout .keep { fill: var(--keep); }
.circle { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: 4 3; }
.radius { stroke: var(--vp-c-divider); stroke-width: 1; }
.origin { fill: var(--vp-c-text-3); }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.2; }
.curve { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.numerator { fill: none; stroke: var(--b); stroke-width: 1.8; stroke-dasharray: 4 3; }
.ray { stroke: var(--vp-c-divider); stroke-width: 1; }
.hpt { fill: var(--b); } .mpt { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.shoulder-line { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 3 2; }
.m { fill: var(--hot); }
.point { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2.2; }
.pole { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1.2; } .pole.mid { fill: var(--b); }
.slider { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); }
.slider input { flex: 1 1 140px; min-width: 120px; accent-color: var(--vp-c-brand-1); }
.slider output { font-family: var(--vp-font-family-mono); min-width: 44px; color: var(--vp-c-text-1); }
.slider button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 2px 9px; font-size: 12px; background: var(--vp-c-bg); }
.slider button[aria-pressed="true"] { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.slider button:focus-visible, .slider input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
