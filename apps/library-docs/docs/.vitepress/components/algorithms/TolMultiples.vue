<script setup>
// The multiples of the analytic Boolean's tolerance ε = 10 × linearToleranceMM(S) (packages/barocss-cad/src/brep/
// analytic-boolean.ts, analyticBoolean), each with where it is used. Values and uses read from the source; the scale is
// logarithmic, so every multiple keeps its distance from ε when S changes.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const pow = e => '10' + String(e).split('').map(c => SUP[c]).join('');
function sci(x) { const e = Math.floor(Math.log10(x) + 1e-9), m = x / 10 ** e; return (Math.abs(m - 1) < 0.05 ? '' : m.toFixed(1) + ' × ') + pow(e); }
function ulp(x) { const f = new Float64Array([x]), u = new BigUint64Array(f.buffer); u[0] += 1n; return f[0] - x; }
const linearToleranceMM = S => Math.max(1e-7, 1e-11 * Math.abs(S));
// The bar: lengths from 10⁻¹³ to 10⁻¹ mm.
const X = L => 20 + 28 * (Math.log10(L) + 13), BAR = 92, ROWS = [18, 32, 46];
const DECADES = [-12, -10, -8, -6, -4, -2].map(e => ({ x: X(10 ** e), label: pow(e) }));
// Multiples of ε, the step that introduces each, and the row its label sits in (two rows, so near ones do not collide).
const MULT = [
  { m: 0.25, label: '¼ε', step: 1, row: 1 },
  { m: 1, label: 'ε', step: 0, row: 0 },
  { m: 10, label: '10ε', step: 3, row: 0 },
  { m: 20, label: '20ε', step: 3, row: 1 },
  { m: 100, label: '100ε', step: 4, row: 0 },
  { m: 300, label: '300ε', step: 4, row: 1 },
  { m: 1000, label: '1000ε', step: 5, row: 2 },
];
const USES = [
  ['linearToleranceMM(S) = 10⁻⁷ mm up to S = 10⁴ mm', 'S: largest |coordinate| of both inputs\' vertices, ≥ 1', 'ε = 10 × linearToleranceMM(S) = 10⁻⁶ mm', 'grey: one ulp at S = 10⁴ mm, 1.8 × 10⁻¹² mm'],
  ['¼ ε: a traced edge fitted as a NURBS curve', '¼ ε: a fillet\'s contact curves on their faces', 'a tighter edge fit may be asked for, never a looser one'],
  ['ε: a point on a surface (offSurface ≤ ε)', 'ε: a vertex on a curve splits it (a T-junction)', 'ε: face boxes, padded by ε, must meet to be cut', 'ε: a cut shorter than ε is no cut'],
  ['10 ε: one edge seen from two faces (exact curves)', '10 ε: a point on a region\'s boundary', '10 ε: padding of coplanar pieces\' boxes, to join', '20 ε: the vertex merge radius', '20 ε: an arc lies in its plane'],
  ['100 ε: one edge from two faces, either traced', '100 ε: the ends of ring neighbours aliased', '100 ε: the marching tracer\'s tolerance', '100 ε: equal coordinates when numbering names', '300 ε: a traced cut\'s end snapped onto an edge'],
  ['1000 ε: an uncut face this far clear: outside, no ray', '1000 ε: a patch this far from a plane or cylinder', '1000 ε: offset of the points a shell\'s faces vote with'],
  ['every multiple is of ε, and ε of linearToleranceMM(S)', 'past S = 10 m they all grow with S, together', 'the gap to the ulp stays about 5 decades'],
];
const steps = [
  { label: 'One base, ten times', text: 'The analytic Boolean measures S, the largest absolute coordinate of its two inputs\' vertices (at least 1), and takes ε = 10 × linearToleranceMM(S). In the modeling range that is 10⁻⁶ mm. Every length test in it is ε or a fixed multiple of ε.', formula: 'ε = 10 × max(10⁻⁷, 10⁻¹¹ S) mm' },
  { label: 'Below ε: fitting', text: 'A curve traced by marching becomes a NURBS edge fitted to within a quarter of ε, closer to the traced curve than any test that compares with it. The fillet builder refines its rolling-ball sections until their contact curves lie within the same ¼ ε of their faces. A tighter fit can be asked for (<code>edgeFitTolerance</code>); it is used only if below ¼ ε, and it changes no topology test.', formula: 'fitTol = min(ε / 4, edgeFitTolerance)' },
  { label: 'ε: on it or not', text: 'Whether a point lies on a surface or on a curve, whether two boxes meet, whether a cut has any length: these compare with ε itself.', formula: 'offSurface(p) ≤ ε &nbsp; · &nbsp; onCurve(k, v, ε) &nbsp; · &nbsp; (hi − lo)·|d| &gt; ε' },
  { label: '10 ε and 20 ε: the same thing twice', text: 'One edge reaches the stitch from both faces that use it, computed twice, and the two copies are matched within 10 ε. Points are located on a region\'s boundary with the same 10 ε. Vertices merge within 20 ε: an edge meeting a surface it touches (a double root, as where a fillet meets a sloping side) lands farther from its true point than the curve is fitted.', formula: 'edge match 10 ε &nbsp; · &nbsp; merge radius 20 ε' },
  { label: '100 ε and 300 ε: traced curves', text: 'A traced curve is only within its tracing tolerance of the exact one it meets, and the tracer works to 100 ε. So comparisons that involve a traced curve allow 100 ε, and a traced cut\'s end is snapped, within 300 ε, onto the face edge it crosses, so the cuts across a face close.', formula: 'tracing 100 ε &nbsp; · &nbsp; snapEnds reach 300 ε' },
  { label: '1000 ε: clear of everything', text: 'Shortcuts that decide without computing use a wide margin. A face with no cut whose box is 1000 ε clear of the other solid is outside it; no ray is cast. A NURBS patch whose control net is 1000 ε clear of a plane or cylinder is not intersected with it.', formula: 'boxesApart(f, other, 1000 ε) ⇒ outside' },
  { label: 'All of them scale', text: 'Above 10 m, ε grows with S, and every multiple with it: the scale bar slides as a whole. The ulp at S grows too, so a margin keeps its distance from rounding at every size the kernel accepts.', formula: 'S = 10⁴ → 10⁶ mm: &nbsp; ε = 10⁻⁶ → 10⁻⁴ mm' },
];
const s = useSteps(steps.length, [4200, 3800, 3600, 4600, 4600, 4000, 5200], root);
const k = computed(() => ease(s.t.value));
const lgS = computed(() => (s.step.value === 6 ? 4 + 2 * k.value : 4));
const eps = computed(() => 10 * linearToleranceMM(10 ** lgS.value));
const base = computed(() => linearToleranceMM(10 ** lgS.value));
const marks = computed(() => MULT.map(mu => {
  const st = s.step.value, from = eps.value, to = eps.value * mu.m;
  const grow = st > mu.step ? 1 : st === mu.step ? k.value : 0;
  // A multiple slides out from ε as it is introduced.
  const L = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * grow);
  return { ...mu, x: X(L), shown: st >= mu.step, now: st === mu.step || (st === 6), L: to };
}));
const epsGrow = computed(() => (s.step.value === 0 ? Math.min(1, k.value * 1.6) : 1));
const epsX = computed(() => X(Math.exp(Math.log(base.value) + Math.log(10) * epsGrow.value)));
const ulpX = computed(() => X(ulp(10 ** lgS.value)));
const lines = computed(() => USES[s.step.value]);
const lineShown = i => (s.step.value === 6 || s.t.value * (lines.value.length + 0.5) > i);
const readout = computed(() => `S = ${sci(10 ** lgS.value)} mm · ε = ${sci(eps.value)} mm`);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One tolerance, fixed multiples" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A logarithmic scale bar of lengths with the Boolean's tolerance and its multiples marked, and where each multiple is used">
        <line :x1="X(1e-13)" :y1="BAR" :x2="X(1e-1)" :y2="BAR" class="bar" />
        <g v-for="d in DECADES" :key="d.label">
          <line :x1="d.x" :y1="BAR - 3" :x2="d.x" :y2="BAR + 3" class="bar" />
          <text :x="d.x" :y="BAR + 15" text-anchor="middle" class="tag">{{ d.label }}</text>
        </g>
        <text :x="X(1e-1)" :y="BAR + 27" text-anchor="end" class="tag">mm, logarithmic</text>
        <!-- One ulp at S, and the policy's base. -->
        <line :x1="ulpX" :y1="BAR - 9" :x2="ulpX" :y2="BAR + 9" class="ulp" />
        <text :x="ulpX" :y="BAR - 13" text-anchor="middle" class="tag">ulp(S)</text>
        <line :x1="X(base)" :y1="BAR - 9" :x2="X(base)" :y2="BAR + 9" class="base" />
        <text :x="X(base) - 4" :y="BAR + 27" text-anchor="end" class="tag a">linearToleranceMM</text>
        <path v-if="s.step.value === 0" :d="`M ${X(base)} ${BAR - 22} Q ${(X(base) + epsX) / 2} ${BAR - 34} ${epsX} ${BAR - 22}`" class="arrow" />
        <text v-if="s.step.value === 0 && epsGrow > 0.5" :x="(X(base) + epsX) / 2" :y="BAR - 36" text-anchor="middle" class="tag">× 10</text>
        <!-- The multiples. -->
        <g v-for="mu in marks" v-show="mu.shown" :key="mu.label">
          <line :x1="mu.m === 1 ? epsX : mu.x" :y1="BAR - 8" :x2="mu.m === 1 ? epsX : mu.x" :y2="BAR + 8" class="mark" :class="{ eps: mu.m === 1, now: mu.now && mu.m !== 1 }" />
          <line :x1="mu.m === 1 ? epsX : mu.x" :y1="BAR - 8" :x2="mu.m === 1 ? epsX : mu.x" :y2="BAR - ROWS[mu.row] + 4" class="leader" />
          <text :x="mu.m === 1 ? epsX : mu.x" :y="BAR - ROWS[mu.row]" text-anchor="middle" class="label" :class="{ eps: mu.m === 1, now: mu.now && mu.m !== 1 }">{{ mu.label }}</text>
        </g>
        <!-- Where they are used. -->
        <text v-for="(line, i) in lines" v-show="lineShown(i)" :key="s.step.value + '-' + i" x="20" :y="146 + 17 * i" class="use">{{ line }}</text>
        <text x="12" y="244" class="readout">{{ readout }}</text>
      </svg>
      <template #note>Values for the analytic Boolean (and its face split, which uses the same ε). Other modules compare with
        <code>linearToleranceMM</code> itself or with their own margins; the prismatic and polyhedral paths are exact where
        they decide. Each use is cited in the page's table.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10.5px; fill: var(--vp-c-text-2); }
.bar { stroke: var(--vp-c-text-3); stroke-width: 1.2; }
.ulp { stroke: var(--vp-c-text-3); stroke-width: 3; }
.base { stroke: var(--a); stroke-width: 2.4; }
.tag.a { fill: var(--a); font-weight: 600; }
.arrow { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-dasharray: 3 2; }
.mark { stroke: var(--b); stroke-width: 2; } .mark.eps { stroke: var(--keep); stroke-width: 3.2; } .mark.now { stroke: var(--hot); }
.leader { stroke: var(--vp-c-divider); stroke-width: 1; }
.label { font-size: 10.5px; font-weight: 600; fill: var(--b); } .label.eps { fill: var(--keep); font-size: 12px; } .label.now { fill: var(--hot); }
.use { font-size: 11px; fill: var(--vp-c-text-1); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
