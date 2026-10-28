<script setup>
// Knot insertion, splitting, de Casteljau and degree elevation on the kernel's test curve "wave"
// (packages/barocss-cad-model/test/fit.test.ts): degree 3, knots [0,0,0,0,0.5,1,1,1,1], poles (0,0) (5,10) (10,−10)
// (15,10) (20,0). Every polygon below was produced by the built kernel (packages/barocss-cad/dist):
//   insertCurveKnot(wave, { knot: 0.25, insertions: 1 | 2 | 3 })  → STAGES (alphas from provenance.steps; max observed
//     change 1.83e-15, 1.78e-15, 1.78e-15 mm; guarded knots [] → [0.25] after the third)
//   splitCurveAtParameter(wave, { parameter: 0.25 })               → LOWER (poles 0..3) and the upper piece (poles 3..7)
//   insertCurveKnot(LOWER, { knot: 0.125, insertions: 3 })         → every alpha 0.5, the de Casteljau points below
//   elevateSourceCurveDegree(LOWER, targetDegree 4)                → ELEVATED (maximum point difference 0)
// The curve itself is drawn with the kernel's basis evaluation (core/math.ts basisInto), ported.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const p = 3, KNOTS = [0, 0, 0, 0, 0.5, 1, 1, 1, 1], WAVE = [[0, 0], [5, 10], [10, -10], [15, 10], [20, 0]];
const STAGES = [
  { gens: [[1, 0.5], [2, 0.25], [3, 0.25]], to: [[0, 0], [2.5, 5], [6.25, 5], [11.25, -5], [15, 10], [20, 0]] },
  { gens: [[2, 0.5], [3, 0.25]], to: [[0, 0], [2.5, 5], [4.375, 5], [7.5, 2.5], [11.25, -5], [15, 10], [20, 0]] },
  { gens: [[3, 0.5]], to: [[0, 0], [2.5, 5], [4.375, 5], [5.9375, 3.75], [7.5, 2.5], [11.25, -5], [15, 10], [20, 0]] },
];
const POLYS = [WAVE, ...STAGES.map(st => st.to)];
const LOWER = POLYS[3].slice(0, 4), UPPER = POLYS[3].slice(3);
const ELEVATED = [[0, 0], [1.875, 3.75], [3.4375, 5], [4.765625, 4.6875], [5.9375, 3.75]];
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
// De Casteljau at ½ on LOWER: the levels of midpoints (equal to the kernel's three insertions at 0.125).
const DC = [LOWER];
for (let l = 1; l <= p; l++) DC.push(DC[l - 1].slice(1).map((q, i) => lerp(DC[l - 1][i], q, 0.5)));

/** The kernel's basisInto, for the curve's own points. */
function basisAt(u) {
  const n = WAVE.length; let span = n - 1;
  if (u !== KNOTS[n]) { let lo = p, hi = n; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (KNOTS[mid] <= u) lo = mid; else hi = mid; } span = lo; }
  const N = [1], L = [0], R = [0];
  for (let j = 1; j <= p; j++) {
    L[j] = u - KNOTS[span + 1 - j]; R[j] = KNOTS[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) { const d = R[r + 1] + L[j - r], prev = N[r]; N[r] = saved + (d === 0 ? 0 : R[r + 1] / d) * prev; saved = (d === 0 ? 0 : L[j - r] / d) * prev; }
    N[j] = saved;
  }
  return { start: span - p, N };
}
const curveAt = u => { const b = basisAt(u); let w = 0, x = 0, y = 0; b.N.forEach((v, i) => { w += v; x += v * WAVE[b.start + i][0]; y += v * WAVE[b.start + i][1]; }); return [x / w, y / w]; };
const US = Array.from({ length: 161 }, (_, j) => j / 160);
const CURVE = US.map(curveAt), LOWER_PTS = US.filter(u => u <= 0.25).map(curveAt), UPPER_PTS = US.filter(u => u >= 0.25).map(curveAt);

const steps = [
  { label: 'A cubic with one interior knot', text: 'The curve is a cubic (p = 3) with five control points and knots [0, 0, 0, 0, 0.5, 1, 1, 1, 1]. We insert the knot ū = 0.25, the marked point: the knot vector gains an entry and the polygon a point, and the curve must not move.' },
  { label: 'Insert once: new points on three edges', text: 'ū lies in the span [u<sub>3</sub>, u<sub>4</sub>) = [0, 0.5). The p points P<sub>1</sub>, P<sub>2</sub>, P<sub>3</sub> whose basis functions are nonzero there are replaced by points on the polygon\'s edges, each a fraction α<sub>i</sub> of the way from P<sub>i−1</sub> to P<sub>i</sub>. Each α is where ū falls in that point\'s knot interval.', formula: 'Q<sub>i</sub> = α<sub>i</sub> P<sub>i</sub> + (1 − α<sub>i</sub>) P<sub>i−1</sub>, &nbsp; α<sub>i</sub> = (ū − u<sub>i</sub>) / (u<sub>i+p</sub> − u<sub>i</sub>) &nbsp; α = ½, ¼, ¼' },
  { label: 'The new polygon, the same curve', text: 'P<sub>0</sub>, Q<sub>1</sub>, Q<sub>2</sub>, Q<sub>3</sub>, P<sub>3</sub>, P<sub>4</sub>: six points on ten knots. The kernel blends in homogeneous coordinates (w x, w y, w z, w), copies untouched points bit for bit, and then compares the two curves at every knot and every span midpoint: here the largest change is 1.8 × 10⁻¹⁵ mm, against a limit of 10⁻⁷ mm.', formula: 'knots [0, 0, 0, 0, 0.25, 0.5, 1, 1, 1, 1] &nbsp; 6 poles' },
  { label: 'Insert again: the knot doubled', text: 'The same rule on the new polygon. With ū already present once (multiplicity s = 1) only p − s = 2 points are replaced, with α = ½ and ¼. Each insertion lowers the curve\'s smoothness at ū by one order.' },
  { label: 'A third time: a control point on the curve', text: 'At multiplicity 3 = p, one new point is made (α = ½), and it is the curve point C(0.25) = (5.9375, 3.75) itself. The curve now has a possible corner there: the kernel reports 0.25 as a <em>guarded knot</em> and refuses a fourth insertion (the multiplicity may not exceed the degree).', formula: 'knots [0, 0, 0, 0, 0.25, 0.25, 0.25, 0.5, 1, 1, 1, 1] &nbsp; 8 poles' },
  { label: 'Split at the shared point', text: 'Splitting a curve at a parameter is this: insert it until its multiplicity is p, then cut the polygon at the point that lies on the curve. Each half takes its share of the poles and of the knots, clamped at the cut by one extra copy.', formula: 'lower: knots [0, 0, 0, 0, 0.25, 0.25, 0.25, 0.25], 4 poles &nbsp; upper: [0.25 ×4, 0.5, 1 ×4], 5 poles' },
  { label: 'A Bézier piece halves by de Casteljau', text: 'The lower piece has one span: it is a Bézier curve. The kernel halves such a span by inserting its midpoint p times; on a single span every α is ½, which is exactly de Casteljau\'s construction: midpoints of the edges, midpoints of those, and so on down to the point on the curve.', formula: 'P<sub>i</sub><sup>(r)</sup> = ½ (P<sub>i</sub><sup>(r−1)</sup> + P<sub>i+1</sub><sup>(r−1)</sup>), &nbsp; left: P<sub>0</sub><sup>(0)</sup> … P<sub>0</sub><sup>(3)</sup>, right: P<sub>0</sub><sup>(3)</sup> … P<sub>3</sub><sup>(0)</sup>' },
  { label: 'Raise the degree, keep the curve', text: 'The same Bézier piece as a degree-4 curve: five points instead of four, the ends kept, each inner point on an edge of the old polygon. Degree elevation is offered on a single Bézier span or on a chain of them (every interior knot of multiplicity p), one degree at a time, up to degree 5. The kernel measured no change at its check points.', formula: 'Q<sub>i</sub> = (i / (p + 1)) P<sub>i−1</sub> + (1 − i / (p + 1)) P<sub>i</sub>, &nbsp; i = 1 … p' },
];
const s = useSteps(steps.length, [2600, 3600, 3000, 4200, 4200, 3000, 5200, 4200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
const clamp01 = x => Math.max(0, Math.min(1, x));

// The view: the full curve (16 px per mm across, 8 px per mm up), then a zoom on the lower piece (40 px per mm).
const zoom = computed(() => (step.value === 6 ? ease(clamp01(2 * s.t.value)) : step.value === 7 ? 1 : 0));
const V = computed(() => { const z = zoom.value; return q => [(30 + 16 * q[0]) * (1 - z) + (60 + 40 * q[0]) * z, (118 - 8 * q[1]) * (1 - z) + (215 - 40 * q[1]) * z]; });
const line = (ps, dx = 0) => ps.map(q => { const v = V.value(q); return `${v[0] + dx},${v[1]}`; }).join(' ');
const at = q => V.value(q);

// Which polygon and which new points each step shows.
const stage = computed(() => ({ 1: 0, 2: 0, 3: 1, 4: 2 })[step.value] ?? -1);
const sliding = computed(() => {
  const st = stage.value; if (st < 0 || step.value === 2) return [];
  const from = POLYS[st], f = step.value === 1 ? k.value : ease(clamp01(s.t.value / 0.55));
  return STAGES[st].gens.map(([i, a]) => ({ left: from[i - 1], right: from[i], q: lerp(from[i - 1], from[i], a * f), a }));
});
const swap = computed(() => (step.value === 2 ? k.value : step.value === 3 || step.value === 4 ? ease(clamp01((s.t.value - 0.55) / 0.45)) : 0));
const oldPoly = computed(() => (step.value <= 1 ? POLYS[0] : step.value <= 4 ? POLYS[stage.value] : null));
const newPoly = computed(() => (step.value >= 2 && step.value <= 4 ? POLYS[stage.value + 1] : null));
const split = computed(() => (step.value === 5 ? 10 * k.value : step.value > 5 ? 10 : 0));
const multiplicity = computed(() => (step.value <= 1 ? 0 : step.value === 2 ? 1 : step.value === 3 ? (swap.value > 0.5 ? 2 : 1) : step.value === 4 ? (swap.value > 0.5 ? 3 : 2) : 3));
const ticks = computed(() => [{ u: 0, label: '0 ×4' }, ...(multiplicity.value ? [{ u: 0.25, label: multiplicity.value > 1 ? `0.25 ×${multiplicity.value}` : '0.25', hot: true }] : []), { u: 0.5, label: '0.5' }, { u: 1, label: '1 ×4' }]);
const T = u => 30 + 320 * u;
// De Casteljau levels appear one after the other in the second half of step 7.
const dcShown = computed(() => (step.value !== 6 ? [] : [1, 2, 3].map(l => ({ l, f: ease(clamp01((s.t.value - 0.5 - 0.15 * (l - 1)) / 0.15)) })).filter(x => x.f > 0)));
const halves = computed(() => (step.value === 6 && s.t.value >= 0.95 ? { left: [DC[0][0], DC[1][0], DC[2][0], DC[3][0]], right: [DC[3][0], DC[2][1], DC[1][2], DC[0][3]] } : null));
const elev = computed(() => (step.value === 7 ? ELEVATED.map((q, i) => (i === 0 || i === 4 ? q : lerp(LOWER[i], q, k.value))) : null));
const readout = computed(() => ({
  2: '6 poles · max change 1.8 × 10⁻¹⁵ mm', 3: '7 poles · max change 1.8 × 10⁻¹⁵ mm', 4: '8 poles · guarded knot 0.25',
  5: 'two curves, sharing (5.9375, 3.75)', 6: 'each half: one Bézier span, 4 poles', 7: '5 poles, degree 4 · change 0 mm',
})[step.value] ?? '');
const ALPHA = { 0.5: '½', 0.25: '¼' };
// Labels of the original poles: offsets from the point, and the anchor.
const LABELS = [[-7, 4, 'end'], [0, -9, 'middle'], [9, 4, 'start'], [0, -9, 'middle'], [8, 4, 'start']];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Knot insertion, splitting and degree elevation" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A cubic curve whose control polygon is refined by inserting a knot three times, then split, subdivided and degree-elevated">
        <!-- The knot axis (faded out in the zoom). -->
        <g :style="{ opacity: 1 - zoom }">
          <line :x1="T(0)" y1="212" :x2="T(1)" y2="212" class="axis" />
          <g v-for="tk in ticks" :key="tk.u">
            <line :x1="T(tk.u)" y1="208" :x2="T(tk.u)" y2="216" class="axis" :class="{ hot: tk.hot }" />
            <text :x="T(tk.u)" y="228" class="small" :class="{ hotText: tk.hot }" text-anchor="middle">{{ tk.label }}</text>
          </g>
          <text :x="T(1) + 8" y="215" class="small">u</text>
        </g>

        <!-- The curve: whole, or as two pieces once split; only the lower piece in the zoom. -->
        <polyline v-if="split === 0" :points="line(CURVE)" class="curve" />
        <g v-else>
          <polyline :points="line(LOWER_PTS, -split)" class="curve lower" />
          <polyline :points="line(UPPER_PTS, split)" class="curve upper" :style="{ opacity: 1 - zoom }" />
        </g>

        <!-- Polygons. -->
        <polyline v-if="oldPoly" :points="line(oldPoly)" class="polygon" :class="{ old: swap > 0 }" :style="{ opacity: 1 - 0.6 * swap }" />
        <polyline v-if="newPoly" :points="line(newPoly)" class="polygon new" :style="{ opacity: swap }" />
        <g v-if="step >= 5">
          <polyline :points="line(LOWER, -split)" class="polygon" :class="{ old: step === 7 }" :style="{ stroke: step === 7 ? undefined : 'var(--a)' }" />
          <polyline :points="line(UPPER, split)" class="polygon" :style="{ stroke: 'var(--b)', opacity: 1 - zoom }" />
        </g>
        <template v-for="(ps, j) in [oldPoly, newPoly]" :key="'v' + j">
          <circle v-for="(q, i) in (ps || [])" :key="i" :cx="at(q)[0]" :cy="at(q)[1]" r="3.4" class="pole" :style="{ opacity: j === 0 ? 1 - swap : swap }" />
        </template>
        <g v-if="step === 5 || (step === 6 && zoom < 1)">
          <circle v-for="(q, i) in UPPER" :key="'u' + i" :cx="at(q)[0] + split" :cy="at(q)[1]" r="3.4" class="pole b" :style="{ opacity: 1 - zoom }" />
        </g>
        <g v-if="step >= 5">
          <circle v-for="(q, i) in LOWER" :key="'l' + i" :cx="at(q)[0] - split" :cy="at(q)[1]" r="3.4" class="pole a" />
        </g>

        <!-- New points sliding along their edges. -->
        <g v-for="(g, i) in sliding" :key="'g' + i">
          <line :x1="at(g.left)[0]" :y1="at(g.left)[1]" :x2="at(g.right)[0]" :y2="at(g.right)[1]" class="edge" />
          <circle :cx="at(g.q)[0]" :cy="at(g.q)[1]" r="4" class="gen" />
          <text v-if="step === 1" :x="at(g.q)[0] + 7" :y="at(g.q)[1] + (i === 2 ? 14 : -7)" class="small hotText">α = {{ ALPHA[g.a] }}</text>
        </g>

        <!-- De Casteljau levels and the two halves. -->
        <g v-for="d in dcShown" :key="'dc' + d.l" :style="{ opacity: d.f }">
          <polyline v-if="DC[d.l].length > 1" :points="line(DC[d.l], -split)" class="dc" />
          <circle v-for="(q, i) in DC[d.l]" :key="i" :cx="at(q)[0] - split" :cy="at(q)[1]" :r="d.l === 3 ? 4.5 : 3.2" class="dcpt" :class="{ last: d.l === 3 }" />
        </g>
        <g v-if="halves">
          <polyline :points="line(halves.left, -split)" class="half a" />
          <polyline :points="line(halves.right, -split)" class="half b" />
        </g>

        <!-- Degree elevation: the new points slide from P_i toward P_{i−1}. -->
        <g v-if="elev">
          <polyline :points="line(elev, -split)" class="polygon new" />
          <circle v-for="(q, i) in elev" :key="'e' + i" :cx="at(q)[0] - split" :cy="at(q)[1]" r="4" class="gen keep" />
        </g>

        <g v-if="step <= 1">
          <text v-for="(q, i) in WAVE" :key="'n' + i" :x="at(q)[0] + LABELS[i][0]" :y="at(q)[1] + LABELS[i][1]" class="label" :text-anchor="LABELS[i][2]">P{{ ['₀', '₁', '₂', '₃', '₄'][i] }}</text>
        </g>
        <!-- The point ū = 0.25 on the curve. -->
        <circle v-if="step <= 4" :cx="at(POLYS[3][3])[0]" :cy="at(POLYS[3][3])[1]" r="4.5" class="mark" />
        <text v-if="step === 0" :x="at(POLYS[3][3])[0] + 8" :y="at(POLYS[3][3])[1] + 16" class="small hotText">C(0.25)</text>
        <text x="12" y="245" class="small readout">{{ readout }}</text>
      </svg>
      <template #note>Every polygon is the built kernel's output for this curve (<code>insertCurveKnot</code>,
        <code>splitCurveAtParameter</code>, <code>elevateSourceCurveDegree</code>); the de Casteljau points are the
        kernel's three insertions at 0.125. The full view halves the vertical scale (16 px per mm across, 8 up); every
        construction here is affine, so it looks the same at any scale. The zoom uses one scale.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; } svg .hotText { fill: var(--hot); font-weight: 600; }
svg .label { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
svg .readout { font-family: var(--vp-font-family-mono); fill: var(--vp-c-text-1); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; } .axis.hot { stroke: var(--hot); stroke-width: 2; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.curve.lower { stroke: var(--a); } .curve.upper { stroke: var(--b); }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.2; }
.polygon.old { stroke-dasharray: 3 3; }
.polygon.new { stroke: var(--keep); stroke-width: 1.5; }
.pole { fill: var(--vp-c-text-2); stroke: var(--vp-c-bg); stroke-width: 1; }
.pole.a { fill: var(--a); } .pole.b { fill: var(--b); }
.edge { stroke: var(--hot); stroke-width: 1.4; opacity: 0.5; }
.gen { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; } .gen.keep { fill: var(--keep); }
.dc { fill: none; stroke: var(--hot); stroke-width: 1.1; stroke-dasharray: 2 2; }
.dcpt { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; } .dcpt.last { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2.2; }
.half { fill: none; stroke-width: 2; } .half.a { stroke: var(--keep); } .half.b { stroke: var(--b); }
.mark { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2.2; }
</style>
