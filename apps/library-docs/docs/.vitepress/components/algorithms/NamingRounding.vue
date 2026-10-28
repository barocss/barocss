<script setup>
// The rounding trap of D282: a boss's two wall halves `c0.side0` share one x in their points inside, to the last bits,
// so an exact comparison orders them by rounding. The keys are the built kernel's, logged from the analytic Boolean's
// stitch (the sort in `stitchWith` that calls `keyOrder`) for the part of test/boolean-boss-row.test.mjs: a plate
// 50 × 30 × 8 with one top edge rounded (radius 2), then bosses of radius 3, the first at (10, 8), joined one by one.
// Upper half: (10, 11, 11) at every step. Lower half: (9.999999999999996, 5.000000000000001, 11) after b0,
// (10.000000000000002, 5, 11) after b1 … b7. The Boolean's tolerance there is t = 1e-6 mm.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const ULP = 2 ** -49;                                     // the gap between doubles in [8, 16)
const LOWER_X = [9.999999999999996, ...Array(7).fill(10.000000000000002)];
const LOWER_U = LOWER_X.map(x => Math.round((x - 10) / ULP)); // −2, then +1
const C = 265, U = 28, LINE = 66;
const TICKS = [-3, -2, -1, 0, 1, 2, 3];
const COLS = Array.from({ length: 8 }, (_, i) => 128 + 32 * i);
/** Which half is #1 when the lower half's x is 10 + u ulp: exactly, x first (then y: 5 < 11); with the margin, y decides. */
const exactFirst = u => (u <= 0 ? 'lower' : 'upper');
const steps = [
  { label: 'Two halves, one name', text: 'The boss <code>c0</code>, joined to a plate whose edge was rounded, goes through the analytic Boolean. Its wall is two faces of one name, <code>c0.side0</code>. The stitch numbers them by a point inside each: the upper half\'s lies at (10, 11, 11), the lower half\'s at (10, 5, 11). Points are ordered by x, then y, then z.', formula: 'order(a, b): the first coordinate i where a<sub>i</sub> ≠ b<sub>i</sub> decides' },
  { label: 'The same x, to the last bits', text: 'Both points lie on the plane x = 10, but each is computed from its face\'s geometry, so the last bits differ. After <code>b0</code> the upper half\'s x is 10 and the lower half\'s is 9.999999999999996: two <i>ulps</i> apart. An ulp is the gap between neighbouring double-precision numbers; near 10 it is 2⁻⁴⁹.', formula: '1 ulp = 2⁻⁴⁹ ≈ 1.78 × 10⁻¹⁵ mm &nbsp; · &nbsp; 9.999999999999996 = 10 − 2 ulp' },
  { label: 'Compared exactly', text: 'Compared exactly, the lower half has the smaller x, so it is <code>c0.side0#1</code>. A fillet on <code>c0.side0#1|c0.top</code> would round the lower rim.', formula: '9.999999999999996 &lt; 10 &nbsp;⇒&nbsp; lower = #1' },
  { label: 'The next Boolean reads it again', text: 'The next boss\'s Boolean starts from <code>b0</code>\'s result: its faces are read back and their points inside found again. The lower half\'s x now comes out 10.000000000000002, one ulp above 10. Compared exactly, the upper half would be first: the two names swap, and the same fillet would round the other rim.', formula: '10 &lt; 10.000000000000002 &nbsp;⇒&nbsp; upper = #1 &nbsp; (exact)' },
  { label: 'Within 100 t counts as equal', text: 'So the stitch compares each coordinate with a margin (<code>keyOrder</code>): two coordinates within 100 t count as equal, and the next one decides. t is the Boolean\'s tolerance, 10 × max(10⁻⁷ mm, 10⁻¹¹ × the largest coordinate): 10⁻⁶ mm on this part, so the margin is 10⁻⁴ mm, about 5.6 × 10¹⁰ ulps. Here x counts as equal and y decides: 5 &lt; 11.', formula: '|a<sub>i</sub> − b<sub>i</sub>| ≤ 100 t ⇒ look at i + 1 &nbsp; · &nbsp; y: 5 &lt; 11 ⇒ lower = #1' },
  { label: 'Eight bosses later', text: 'The kernel\'s own keys at each of the eight Booleans: compared exactly, <code>#1</code> is the lower half after <code>b0</code> and the upper half after <code>b1</code> to <code>b7</code>; with the margin it is the lower half at every step. The boss-row test checks just this.' },
];
const s = useSteps(steps.length, [3400, 4200, 3000, 4200, 4200, 6400], root);
const k = computed(() => ease(s.t.value));
// The lower half's offset in ulps, as drawn (0 until the zoom of step 2).
const lowerU = computed(() => {
  const st = s.step.value;
  if (st === 0) return 0;
  if (st === 1) return LOWER_U[0] * k.value;
  if (st === 2) return LOWER_U[0];
  if (st === 3) return LOWER_U[0] + (LOWER_U[1] - LOWER_U[0]) * k.value;
  if (st === 4) return LOWER_U[1];
  const i = col.value, f = Math.min(1, (s.t.value * 8 - i) * 3), prev = LOWER_U[Math.max(0, i - 1)];
  return prev + (LOWER_U[i] - prev) * ease(Math.max(0, f));
});
const col = computed(() => (s.step.value === 5 ? Math.min(7, Math.floor(s.t.value * 8)) : -1));
const zoom = computed(() => (s.step.value === 0 ? 0 : s.step.value === 1 ? k.value : 1));
const band = computed(() => (s.step.value < 4 ? 0 : s.step.value === 4 ? Math.min(1, 1.4 * k.value) : 1));
// The names drawn on the halves: exact until step 5, then with the margin.
const first = computed(() => (s.step.value >= 4 ? 'lower' : s.step.value >= 2 ? exactFirst(Math.round(lowerU.value)) : null));
const nameOf = half => (first.value ? `c0.side0#${first.value === half ? 1 : 2}` : 'c0.side0');
// The table: which cells are shown at each step.
const cells = computed(() => {
  const st = s.step.value, exact = [], margin = [];
  for (let i = 0; i < 8; i++) {
    const showExact = st === 2 ? i === 0 : st === 3 ? i <= (k.value > 0.6 ? 1 : 0) : st === 4 ? i <= 1 : st === 5 ? i <= col.value : false;
    const showMargin = st === 4 ? i <= (k.value > 0.6 ? 1 : 0) : st === 5 ? i <= col.value : false;
    exact.push(showExact ? exactFirst(LOWER_U[i]) : null); margin.push(showMargin ? 'lower' : null);
  }
  return { exact, margin };
});
const readout = computed(() => [
  'upper (10, 11, 11) · lower (10, 5, 11), to the eye',
  'after b0: lower x = 9.999999999999996',
  'exact: lower half = c0.side0#1',
  'after b1: lower x = 10.000000000000002 → names swap',
  'with the margin: lower half = c0.side0#1',
  `b${Math.max(0, col.value)}: lower x = ${LOWER_X[Math.max(0, col.value)]}`,
][s.step.value]);
// Try it: the lower half's x moved by a number of ulps.
const u = ref(-2);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One ulp decides the order" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="Two halves of a boss wall, their points inside on a number line magnified to ulps, and the names each rule gives">
        <!-- The boss from above: its two halves and their points inside. -->
        <circle cx="70" cy="76" r="36" class="boss" />
        <path d="M 34 76 A 36 36 0 0 1 106 76" class="half upper" />
        <path d="M 34 76 A 36 36 0 0 0 106 76" class="half lower" />
        <circle cx="70" cy="40" r="3.2" class="key up" /><circle cx="70" cy="112" r="3.2" class="key lo" />
        <text x="70" y="28" text-anchor="middle" class="name" :class="{ one: first === 'upper' }">{{ nameOf('upper') }}</text>
        <text x="70" y="130" text-anchor="middle" class="name" :class="{ one: first === 'lower' }">{{ nameOf('lower') }}</text>
        <text x="70" y="80" text-anchor="middle" class="tag">c0.top</text>
        <!-- The number line of x about 10, magnified to ulps. -->
        <rect v-if="band > 0" :x="C - 112 * band" :y="LINE - 40" :width="224 * band" height="46" class="band" />
        <line :x1="C - 106" :y1="LINE" :x2="C + 106" :y2="LINE" class="axis" />
        <g :style="{ opacity: zoom }">
          <line v-for="t in TICKS" :key="'t' + t" :x1="C + U * t" :y1="LINE - 3" :x2="C + U * t" :y2="LINE + 3" class="axis" />
          <text v-for="t in TICKS" :key="'l' + t" :x="C + U * t" :y="LINE + 14" text-anchor="middle" class="tag">{{ t > 0 ? '+' + t : t }}</text>
        </g>
        <text :x="C" :y="LINE + 28" text-anchor="middle" class="tag">{{ zoom > 0.5 ? 'x − 10, in ulps (1 ulp ≈ 1.78 × 10⁻¹⁵ mm)' : 'x (mm): both at 10' }}</text>
        <text v-if="band > 0.6" :x="C" :y="LINE - 44" text-anchor="middle" class="tag keep">100 t = 10⁻⁴ mm: far wider than the line</text>
        <line :x1="C" :y1="LINE - 30" :x2="C" :y2="LINE" class="drop up" />
        <circle :cx="C" :cy="LINE - 30" r="4" class="key up" />
        <text :x="C - 8" :y="LINE - 27" text-anchor="end" class="tag">upper</text>
        <line :x1="C + U * lowerU" :y1="LINE - 14" :x2="C + U * lowerU" :y2="LINE" class="drop lo" />
        <circle :cx="C + U * lowerU" :cy="LINE - 14" r="4" class="key lo" />
        <text :x="C + U * lowerU + 8" :y="LINE - 11" class="tag">lower</text>
        <!-- Which half is #1 at each Boolean, by each rule. -->
        <g v-if="s.step.value >= 2">
          <text v-for="(x, i) in COLS" :key="'h' + i" :x="x" y="158" text-anchor="middle" class="tag" :class="{ now: i === col }">b{{ i }}</text>
          <text x="12" y="180" class="tag">#1, exact</text>
          <text x="12" y="206" class="tag">#1, within 100 t</text>
          <template v-for="(x, i) in COLS" :key="'c' + i">
            <g v-if="cells.exact[i]"><rect :x="x - 14" y="168" width="28" height="17" rx="4" class="cell" :class="cells.exact[i]" /><text :x="x" y="180" text-anchor="middle" class="cell-text">{{ cells.exact[i] }}</text></g>
            <g v-if="cells.margin[i]"><rect :x="x - 14" y="194" width="28" height="17" rx="4" class="cell" :class="cells.margin[i]" /><text :x="x" y="206" text-anchor="middle" class="cell-text">{{ cells.margin[i] }}</text></g>
          </template>
        </g>
        <text x="12" y="232" class="readout">{{ readout }}</text>
      </svg>
      <div class="try">
        <label>Try it: the lower half's x = 10 <input v-model.number="u" type="range" min="-4" max="4" step="1" aria-label="The lower half's x, in ulps from 10"> {{ u >= 0 ? '+' : '−' }} {{ Math.abs(u) }} ulp</label>
        <span>exact: <b>#1 is the {{ exactFirst(u) }} half</b> · within 100 t: <b>#1 is the lower half</b></span>
      </div>
      <template #note>The keys are the kernel's, logged from the analytic Boolean's stitch for the boss-row test's part
        (only the first boss's halves are drawn). The number line is to scale in ulps; the margin of 100 t is not (it is about
        5.6 × 10¹⁰ ulps wide). D282 records that on the build before the fix the lower half was <code>c0.side0#1</code> after b0, <code>#2</code>
        after b1 and <code>#1</code> again after b2; the keys shown here are today's build's.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10.5px; fill: var(--vp-c-text-2); }
.boss { fill: color-mix(in srgb, var(--keep) 10%, var(--vp-c-bg-soft)); }
.half { fill: none; stroke-width: 3; } .half.upper { stroke: var(--b); } .half.lower { stroke: var(--a); }
.key.up { fill: var(--b); } .key.lo { fill: var(--a); }
.drop { stroke-width: 1.2; stroke-dasharray: 2 2; } .drop.up { stroke: var(--b); } .drop.lo { stroke: var(--a); }
.name { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-2); } .name.one { fill: var(--hot); }
.axis { stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.band { fill: color-mix(in srgb, var(--keep) 16%, transparent); stroke: var(--keep); stroke-dasharray: 3 3; }
.tag { font-size: 10px; } .tag.keep { fill: var(--keep); font-weight: 600; } .tag.now { fill: var(--vp-c-text-1); font-weight: 700; }
.cell { stroke-width: 1; } .cell.lower { fill: color-mix(in srgb, var(--a) 22%, transparent); stroke: var(--a); } .cell.upper { fill: color-mix(in srgb, var(--b) 22%, transparent); stroke: var(--b); }
.cell-text { font-size: 9.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.try { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; justify-content: center; padding: 8px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); }
.try label { display: inline-flex; align-items: center; gap: 6px; }
.try input { width: 120px; accent-color: var(--vp-c-brand-1); }
.try b { color: var(--vp-c-text-1); font-weight: 600; }
</style>
