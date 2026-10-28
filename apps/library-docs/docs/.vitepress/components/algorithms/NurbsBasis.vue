<script setup>
// B-spline basis functions and curve evaluation (packages/barocss-cad/src/core/math.ts, basisInto / curveEvaluator;
// src/core/derivatives.ts, basisD1). basisAt() below is the kernel's triangular form of the Cox–de Boor recursion,
// ported line for line: binary search for the span, left/right knot distances divided by max(1, |a|, |b|), p + 1
// nonzero values, then Σ N w P / Σ N w. Checked against the built kernel (evaluateCurve, evaluateCurveD1) at 121
// parameters on this curve: points within 6e-15 mm, first derivatives within 4e-14 mm.
// The plotted basis curves come from the recursion written out in full (table()), which agrees with the triangular
// form to 3e-16 at those parameters.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const p = 3, K = [0, 0, 0, 0, 1 / 3, 2 / 3, 1, 1, 1, 1];
const P0 = [[0, 0], [3, 7], [8, 8], [12, 1], [17, 2], [20, 7]], n = P0.length;

/** The kernel's basisInto: nonzero N_{start..start+p, p}(u) and (as basisD1) their first derivatives. */
function basisAt(u) {
  const left = K[p], right = K[n];
  let span = n - 1;
  if (u !== right) { let lo = p, hi = n; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (K[mid] <= u) lo = mid; else hi = mid; } span = lo; }
  const scale = Math.max(1, Math.abs(left), Math.abs(right)), N = [1], L = [0], R = [0];
  let lower = [1];
  for (let j = 1; j <= p; j++) {
    if (j === p) lower = N.slice(0, j);
    L[j] = (u - K[span + 1 - j]) / scale; R[j] = (K[span + j] - u) / scale;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const d = R[r + 1] + L[j - r], prev = N[r];
      N[r] = saved + (d === 0 ? 0 : R[r + 1] / d) * prev; saved = (d === 0 ? 0 : L[j - r] / d) * prev;
    }
    N[j] = saved;
  }
  const start = span - p, term = (v, a, b) => (a === b || v === 0 ? 0 : p * v / (b - a));
  const D = N.map((_, i) => (i === 0 ? 0 : term(lower[i - 1], K[start + i], K[start + i + p])) - (i === p ? 0 : term(lower[i], K[start + i + 1], K[start + i + p + 1])));
  return { start, N, D };
}
/** Point and first derivative, as curveD1: A = Σ N w P, W = Σ N w, C = A / W, C' = (A' − W' C) / W (all w = 1 here). */
function evalAt(P, u) {
  const b = basisAt(u);
  let w = 0, wd = 0, x = 0, y = 0, dx = 0, dy = 0;
  for (let i = 0; i <= p; i++) { const q = P[b.start + i]; w += b.N[i]; wd += b.D[i]; x += b.N[i] * q[0]; y += b.N[i] * q[1]; dx += b.D[i] * q[0]; dy += b.D[i] * q[1]; }
  const c = [x / w, y / w];
  return { c, d: [(dx - wd * c[0]) / w, (dy - wd * c[1]) / w], b };
}
/** The recursion in full, every N_{i,k}(u) of one degree k: N_{i,0} the boxes, then two-term blends (0/0 read as 0). */
function table(k, u) {
  const m = K.length - 1;
  let N = Array.from({ length: m }, (_, i) => ((K[i] <= u && u < K[i + 1]) || (u === K[m] && K[i] < K[i + 1] && K[i + 1] === K[m]) ? 1 : 0));
  for (let d = 1; d <= k; d++) N = Array.from({ length: m - d }, (_, i) => { const a = K[i + d] - K[i], b = K[i + d + 1] - K[i + 1]; return (a ? (u - K[i]) / a * N[i] : 0) + (b ? (K[i + d + 1] - u) / b * N[i + 1] : 0); });
  return N;
}

// The view: the curve above (15 px per mm), the basis functions over u ∈ [0, 1] below.
const X = x => 40 + 15 * x, Y = y => 140 - 15 * y, U = u => 40 + 300 * u, B = v => 236 - 62 * v;
const COLORS = ['var(--a)', 'var(--b)', 'var(--hot)', 'var(--keep)', 'var(--vp-c-text-2)', 'var(--vp-c-text-3)', 'var(--a)', 'var(--b)'];
const SAMPLES = Array.from({ length: 121 }, (_, j) => j / 120);
// Basis curves per degree 0..3, each function's polyline (skipped where it is zero on all of [0, 1]).
const LEVELS = [0, 1, 2, 3].map(k => {
  const rows = SAMPLES.map(u => table(k, u));
  return rows[0].map((_, i) => i).filter(i => rows.some(r => r[i] > 0)).map(i => ({
    i, color: COLORS[i],
    points: k === 0
      ? [[U(K[i]), B(0)], [U(K[i]), B(1)], [U(K[i + 1]), B(1)], [U(K[i + 1]), B(0)]].map(q => q.join(',')).join(' ')
      : rows.map((r, j) => `${U(SAMPLES[j])},${B(r[i])}`).join(' '),
  }));
});
const pts = (P, us) => us.map(u => { const c = evalAt(P, u).c; return `${X(c[0])},${Y(c[1])}`; }).join(' ');
const FULL = pts(P0, SAMPLES);
const knotTicks = [{ u: 0, label: '0 ×4' }, { u: 1 / 3, label: '⅓' }, { u: 2 / 3, label: '⅔' }, { u: 1, label: '1 ×4' }];

const steps = [
  { label: 'Control points and a knot vector', text: 'A curve of degree p = 3 is given by six control points P<sub>0</sub> … P<sub>5</sub> (the <em>control polygon</em>) and a nondecreasing list of knots. There are always n + p + 1 knots: here 6 + 3 + 1 = 10. The kernel requires the ends <em>clamped</em>: the first and last knot repeated p + 1 times, so the curve starts at P<sub>0</sub> and ends at P<sub>5</sub>. The curve\'s parameter u runs over [u<sub>p</sub>, u<sub>n</sub>] = [0, 1].', formula: 'knots = [0, 0, 0, 0, ⅓, ⅔, 1, 1, 1, 1] &nbsp; P = (0,0) (3,7) (8,8) (12,1) (17,2) (20,7)' },
  { label: 'Degree 0: boxes between knots', text: 'Each control point gets a weight function of u, its <em>basis function</em> N<sub>i,p</sub>(u). They are built up from degree 0, where N<sub>i,0</sub> is 1 between knots u<sub>i</sub> and u<sub>i+1</sub> and 0 elsewhere. Repeated knots give empty intervals, so only three boxes are nonzero here: [0, ⅓), [⅓, ⅔) and [⅔, 1].', formula: 'N<sub>i,0</sub>(u) = 1 if u<sub>i</sub> ≤ u &lt; u<sub>i+1</sub>, else 0' },
  { label: 'Raise the degree, one level at a time', text: 'Each level blends two neighbours of the level below with weights that run linearly across their knots (the Cox–de Boor recursion). Every step widens a function by one knot interval and smooths it once more: boxes, then hats, then quadratic and finally cubic bumps. A fraction 0/0 (from a repeated knot) counts as 0.', formula: 'N<sub>i,k</sub>(u) = (u − u<sub>i</sub>) / (u<sub>i+k</sub> − u<sub>i</sub>) · N<sub>i,k−1</sub>(u) + (u<sub>i+k+1</sub> − u) / (u<sub>i+k+1</sub> − u<sub>i+1</sub>) · N<sub>i+1,k−1</sub>(u)' },
  { label: 'The point is a weighted average', text: 'At each u the curve point is the average of the control points weighted by their basis values. At most p + 1 = 4 of them are nonzero (the lines to the point fade with their weight), and they always add up to 1. The kernel computes just these four: it finds the knot span holding u by binary search (u = 1 uses the last span) and runs the recursion as a small triangle.', formula: 'C(u) = Σ N<sub>i,p</sub>(u) w<sub>i</sub> P<sub>i</sub> / Σ N<sub>i,p</sub>(u) w<sub>i</sub> &nbsp; (all w<sub>i</sub> = 1 here) &nbsp; Σ N<sub>i,p</sub>(u) = 1' },
  { label: 'Moving a point changes only its own part', text: 'N<sub>0,3</sub> is zero from u = ⅓ on, so moving P<sub>0</sub> changes the curve only for u &lt; ⅓; the rest stays where it was (the dashed line is the curve before). In general P<sub>i</sub> acts only on [u<sub>i</sub>, u<sub>i+p+1</sub>).' },
  { label: 'The tangent, from the derivative of the basis', text: 'The first derivative comes from the same table: each N\'<sub>i,p</sub> is a difference of two degree-(p − 1) values. For a rational curve the quotient rule gives C\'. Derivatives are in the curve\'s own knot units (here mm per unit of u). Where an interior knot is repeated p times or more the curve may have a corner, and the kernel refuses a derivative there.', formula: 'N\'<sub>i,p</sub> = p / (u<sub>i+p</sub> − u<sub>i</sub>) · N<sub>i,p−1</sub> − p / (u<sub>i+p+1</sub> − u<sub>i+1</sub>) · N<sub>i+1,p−1</sub><br>C\' = (A\' − W\' C) / W, &nbsp; A = Σ N w P, W = Σ N w &nbsp; C\'(0) = 9 (P<sub>1</sub> − P<sub>0</sub>) = (27, 63)' },
];
const s = useSteps(steps.length, [2600, 2400, 4200, 6000, 3200, 6000], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

// Degree shown in the lower panel: 0 in step 2, 0 → 3 through step 3, 3 after.
const level = computed(() => (step.value < 1 ? -1 : step.value === 1 ? 0 : step.value === 2 ? 3 * k.value : 3));
const shownLevels = computed(() => {
  const L = level.value;
  if (L < 0) return [];
  const lo = Math.min(2, Math.floor(L)), f = L - lo;
  if (L >= 3) return [{ k: 3, o: 1 }];
  if (L === 0) return [{ k: 0, o: step.value === 1 ? k.value : 1 }];
  return [{ k: lo, o: 1 - f }, { k: lo + 1, o: f }];
});
// The moved control point of step 5.
const lift = computed(() => (step.value === 4 ? 6 * ease(Math.min(1, 1.5 * s.t.value)) : 0));
const P = computed(() => (lift.value ? [[P0[0][0], P0[0][1] + lift.value], ...P0.slice(1)] : P0));
const u = computed(() => (step.value === 3 || step.value === 5 ? Math.min(1, Math.max(0, s.t.value)) : step.value === 4 ? 1 / 6 : 0.42));
const at = computed(() => evalAt(P.value, u.value));
const curve = computed(() => {
  if (step.value < 3) return '';
  if (step.value === 3) return pts(P0, SAMPLES.filter(v => v <= u.value).concat(u.value));
  return lift.value ? pts(P.value, SAMPLES) : FULL;
});
const weights = computed(() => { const b = at.value.b; return P0.map((_, i) => (i >= b.start && i <= b.start + p ? b.N[i - b.start] : 0)); });
const readout = computed(() => `u = ${num(u.value, 2)} · N = ${weights.value.map(v => num(v, 2)).join(', ')} · Σ = ${num(weights.value.reduce((a, b) => a + b, 0), 6)}`);
const tangent = computed(() => { const { c, d } = at.value, f = 0.07; return { x1: X(c[0]), y1: Y(c[1]), x2: X(c[0] + f * d[0]), y2: Y(c[1] + f * d[1]) }; });
const head = computed(() => {
  const t = tangent.value, dx = t.x2 - t.x1, dy = t.y2 - t.y1, l = Math.max(1e-9, Math.hypot(dx, dy)), ux = dx / l, uy = dy / l;
  return `${t.x2},${t.y2} ${t.x2 - 7 * ux - 3.5 * uy},${t.y2 - 7 * uy + 3.5 * ux} ${t.x2 - 7 * ux + 3.5 * uy},${t.y2 - 7 * uy - 3.5 * ux}`;
});
const polyline = computed(() => P.value.map(q => `${X(q[0])},${Y(q[1])}`).join(' '));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="B-spline basis functions and the point they make" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="A cubic B-spline curve with its control polygon, and its basis functions plotted below">
        <!-- Lower panel: the parameter axis, its knots and the basis functions. -->
        <line :x1="U(0)" :y1="B(0)" :x2="U(1)" :y2="B(0)" class="axis" />
        <line :x1="U(0)" :y1="B(1)" :x2="U(1)" :y2="B(1)" class="grid" />
        <text :x="U(0) - 8" :y="B(1) + 4" class="small" text-anchor="end">1</text>
        <g v-for="kt in knotTicks" :key="kt.u">
          <line :x1="U(kt.u)" :y1="B(0)" :x2="U(kt.u)" :y2="B(0) + 5" class="axis" />
          <text :x="U(kt.u)" :y="B(0) + 16" class="small" text-anchor="middle">{{ kt.label }}</text>
        </g>
        <text :x="U(1) + 10" :y="B(0) + 4" class="small">u</text>
        <g v-for="lv in shownLevels" :key="'lv' + lv.k" :style="{ opacity: lv.o }">
          <polyline v-for="f in LEVELS[lv.k]" :key="f.i" :points="f.points" class="basis" :class="{ bold: step === 4 && f.i === 0 && lv.k === 3 }" :style="{ stroke: f.color }" />
        </g>
        <text v-if="level >= 0" :x="U(0) - 8" :y="B(0.5) + 4" class="small" text-anchor="end">p = {{ Math.min(3, Math.round(level)) }}</text>
        <rect v-if="step === 4" :x="U(1 / 3)" :y="B(1) - 2" :width="U(1) - U(1 / 3)" :height="B(0) - B(1) + 2" class="unchanged" />
        <g v-if="step >= 3 && step !== 4">
          <line :x1="U(u)" :y1="B(0)" :x2="U(u)" :y2="B(1) - 2" class="sweep" />
          <circle v-for="(w, i) in weights" v-show="w > 0" :key="'d' + i" :cx="U(u)" :cy="B(w)" r="3" :style="{ fill: COLORS[i] }" />
        </g>

        <!-- Upper panel: the control polygon and the curve. -->
        <polyline :points="polyline" class="polygon" pathLength="1" :style="{ strokeDasharray: step === 0 ? `${k} 1` : 'none' }" />
        <polyline v-if="step === 4" :points="FULL" class="curve before" />
        <polyline v-if="curve" :points="curve" class="curve" />
        <g v-if="step === 3">
          <line v-for="(w, i) in weights" v-show="w > 0" :key="'l' + i" :x1="X(P0[i][0])" :y1="Y(P0[i][1])" :x2="X(at.c[0])" :y2="Y(at.c[1])" class="pull" :style="{ stroke: COLORS[i], opacity: 0.15 + 0.85 * w, strokeWidth: 0.6 + 2.4 * w }" />
        </g>
        <g v-for="(q, i) in P" :key="'p' + i" :style="{ opacity: step === 0 ? Math.min(1, Math.max(0, 6 * k - i)) : 1 }">
          <circle :cx="X(q[0])" :cy="Y(q[1])" r="4" class="pole" :style="{ fill: COLORS[i] }" />
          <text :x="X(q[0]) + (i === 0 ? -6 : 7)" :y="Y(q[1]) + (i === 3 ? 13 : -6)" class="label" :text-anchor="i === 0 ? 'end' : 'start'">P{{ ['₀', '₁', '₂', '₃', '₄', '₅'][i] }}</text>
        </g>
        <g v-if="step === 5">
          <line :x1="tangent.x1" :y1="tangent.y1" :x2="tangent.x2" :y2="tangent.y2" class="tangent" />
          <polygon :points="head" class="tangent-head" />
        </g>
        <circle v-if="step === 3 || step === 5" :cx="X(at.c[0])" :cy="Y(at.c[1])" r="4.5" class="point" />
        <text v-if="step === 3" x="12" y="160" class="small mono">{{ readout }}</text>
        <text v-if="step === 4" x="12" y="162" class="small hot">P₀ moved up {{ num(lift, 1) }} mm</text>
        <text v-if="step === 4" :x="(U(1 / 3) + U(1)) / 2" y="162" class="small" text-anchor="middle">N₀,₃ = 0 here: the curve is unchanged</text>
        <text v-if="step === 5" x="12" y="160" class="small mono">u = {{ num(u, 2) }} · C' = ({{ num(at.d[0], 1) }}, {{ num(at.d[1], 1) }}) mm per unit u</text>
      </svg>
      <template #note>Computed in the page: the point and the tangent with the kernel's basis evaluation, ported from
        <code>core/math.ts</code> and <code>core/derivatives.ts</code> (checked against the built kernel on this curve to
        6 × 10⁻¹⁵ mm); the plotted basis curves with the recursion written out in full. The curve is planar and all its
        weights are 1, so it is a plain (polynomial) B-spline; the next figure varies a weight. Tangents are drawn at
        0.07 × their length.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; } svg .mono { font-family: var(--vp-font-family-mono); font-size: 10px; }
svg .label { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
svg .hot { fill: var(--hot); font-weight: 600; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.grid { stroke: var(--vp-c-divider); stroke-width: 1; stroke-dasharray: 2 3; }
.basis { fill: none; stroke-width: 1.8; stroke-linejoin: round; } .basis.bold { stroke-width: 3.2; }
.unchanged { fill: var(--keep); opacity: 0.1; }
.sweep { stroke: var(--vp-c-text-1); stroke-width: 1; stroke-dasharray: 3 2; }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: none; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.curve.before { stroke: var(--vp-c-text-3); stroke-width: 1.6; stroke-dasharray: 4 3; }
.pull { stroke-linecap: round; }
.pole { stroke: var(--vp-c-bg); stroke-width: 1.2; }
.point { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 2.2; }
.tangent { stroke: var(--hot); stroke-width: 2; } .tangent-head { fill: var(--hot); }
</style>
