<script setup>
// A bend's K from a bend table (packages/barocss-cad/src/frame-sheet/sheet-metal.ts: rowKFactor, lookupBend), run in the
// page on the grid of four rows in test/r12-4.test.mjs (T 2; R 2 and 4; 60° and 120°; one row an allowance, one an
// estimate). The order — an exact row, then bilinear in R and the angle inside four rows, then linear in R between rows
// for any angle, else a miss — and the 1e-9 match are the kernel's.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const T = 2;
const ROWS = [
  { radius: 2, angle: 60, kFactor: 0.40, source: 'shop' },
  { radius: 4, angle: 60, kFactor: 0.44, source: 'shop' },
  { radius: 2, angle: 120, allowance: 5.4, source: 'shop' },
  { radius: 4, angle: 120, kFactor: 0.47, estimate: true },
];
/** A row's K: given, or from its allowance K = (BA/θ − R)/T, or its deduction through BA = 2·OSSB − BD. */
function rowK(r) {
  if (r.kFactor !== undefined) return r.kFactor;
  const th = r.angle * Math.PI / 180, ba = r.allowance !== undefined ? r.allowance : 2 * (r.radius + T) * Math.tan(th / 2) - r.deduction;
  return (ba / th - r.radius) / T;
}
const KS = ROWS.map(rowK);
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** lookupBend for rows of one T, all with an angle (this table has no rows for any angle). */
function lookup(radius, deg) {
  const rows = ROWS.map((r, i) => ({ r, i, k: KS[i] }));
  const exact = rows.find(x => near(x.r.radius, radius) && near(x.r.angle, deg));
  if (exact) return { k: exact.k, rows: [exact.i], how: 'exact', w: [1] };
  const side = (vals, v) => { const e = vals.find(x => near(x, v)); if (e !== undefined) return [e, e]; const lo = vals.filter(x => x < v).pop(), hi = vals.find(x => x > v); return lo !== undefined && hi !== undefined ? [lo, hi] : null; };
  const rs = [...new Set(rows.map(x => x.r.radius))].sort((a, b) => a - b), as = [...new Set(rows.map(x => x.r.angle))].sort((a, b) => a - b);
  const R2 = side(rs, radius), A2 = side(as, deg);
  if (!R2 || !A2) return { miss: true };
  const at = (r, a) => rows.find(x => near(x.r.radius, r) && near(x.r.angle, a));
  const c = [at(R2[0], A2[0]), at(R2[1], A2[0]), at(R2[0], A2[1]), at(R2[1], A2[1])];
  const u = R2[1] > R2[0] ? (radius - R2[0]) / (R2[1] - R2[0]) : 0, v = A2[1] > A2[0] ? (deg - A2[0]) / (A2[1] - A2[0]) : 0;
  const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
  const used = new Map();
  c.forEach((x, j) => used.set(x.i, (used.get(x.i) ?? 0) + w[j]));
  return { k: w.reduce((s, wj, j) => s + wj * c[j].k, 0), rows: [...used.keys()], w: [...used.values()], how: 'interpolated', u, v };
}
// What the built kernel's lookupBend gives on this table (run on packages/barocss-cad/dist/index.js): R 3, 90° →
// 0.39978875976108813 (rows 0–3, an estimate among them); R 2, 75° → 0.3722887597610881 (rows 0 and 2); R 5, 90° → a miss.
// The page's lookup above gives the same.
const QUERIES = [null, null, [2, 60], [3, 90], [2, 75], [5, 90]];

// The chart: R across (1.5 to 5.5 mm), the angle up (40° to 160°).
const X = r => 44 + (r - 1.5) * 46, Y = a => 222 - (a - 40) * 1.55;
const steps = [
  { label: 'Rows from a shop\'s test bends', text: 'A bend table is a list of rows. Each row says: a sheet T thick, bent at inner radius R (at an angle, or at any angle), has this K-factor, or this bend allowance, or this bend deduction: exactly one of the three. It cites a source, or says <code>estimate: true</code>; never neither. Here, four rows for T 2.', formula: '{ thickness, radius, angle?, kFactor | allowance | deduction, source | estimate }' },
  { label: 'Every row becomes a K', text: `The kernel compares rows by their K. A row that gives an allowance (or a deduction) is turned into one from the definitions: row 2's BA 5.4 at 120° and R 2 is K = ${num(KS[2], 3)}. A row whose K falls outside 0 to 1 is refused when the table is loaded.`, formula: 'K = (BA/θ − R) / T &nbsp; with BA = 2·OSSB − BD for a deduction row' },
  { label: 'An exact row', text: 'A bend\'s T, inner radius and angle are looked up. Rows of another thickness are ignored (thickness must match to 10⁻⁹, relative). A row with the bend\'s R and angle is used as it is.', formula: 'R 2, 60° → row 0, K 0.40 (exact)' },
  { label: 'Between four rows', text: `Otherwise the kernel takes the nearest R and the nearest angle on each side. If all four rows of that grid cell exist, K is bilinear: u across R, v across the angle. At R 3, 90°, u = v = ½ and K = ${num(lookup(3, 90).k, 4)}. Row 3 is an estimate, so the bend's report says an estimate was used.`, formula: 'K = (1−u)(1−v) K₀ + u(1−v) K₁ + (1−u) v K₂ + u v K₃' },
  { label: 'On one side of the cell', text: `Where the bend's R equals a row's R, that side collapses: u = 0 and only the two rows of that R are used. At R 2, 75°, v = ¼ and K = ${num(lookup(2, 75).k, 4)} from rows 0 and 2.`, formula: 'R 2, 75° → ¾ K₀ + ¼ K₂' },
  { label: 'Off the table', text: 'Rows for any angle (no <code>angle</code>) are then tried, linear in R between the rows on each side. This table has none, so a bend at R 5 has no rows round it: the feature is refused with <code>[BEND_TABLE_MISS]</code>, naming the bend. There is no fallback K.', formula: 'table g has no rows round 2 mm, R 5 mm, 90° (an exact row, or rows either side in R and in the angle)' },
];
const s = useSteps(steps.length, [3000, 2600, 2200, 3200, 3000, 3200], root);
const k = computed(() => ease(s.t.value));
const shownRows = computed(() => s.step.value === 0 ? Math.min(4, Math.floor(k.value * 4.999)) : 4);
const query = computed(() => {
  const i = s.step.value, q = QUERIES[i];
  if (!q) return null;
  const p = QUERIES[i - 1] ?? q, u = i === 2 ? 1 : k.value;
  return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
});
const result = computed(() => (query.value ? lookup(query.value[0], query.value[1]) : null));
const rowLabel = (r, i) => `${i}  R ${r.radius}  ${r.angle}°  ${r.kFactor !== undefined ? `K ${r.kFactor.toFixed(2)}` : `BA ${r.allowance}`}  ${r.estimate ? 'estimate' : r.source}`;
const kLabel = i => (i === 2 && s.step.value === 0 ? `BA ${ROWS[2].allowance}` : `K ${num(KS[i], 3)}`);
const readout = computed(() => {
  const q = query.value, r = result.value;
  if (!q || !r) return [];
  const out = [{ text: `bend: T 2 · R ${num(q[0], 2)} · ${num(q[1], 1)}°`, cls: 'small' }];
  if (r.miss) out.push({ text: '[BEND_TABLE_MISS]', cls: 'strong hot' }, { text: 'no rows round it', cls: 'small' });
  else {
    out.push({ text: `K = ${num(r.k, 4)}`, cls: 'strong' }, { text: r.how, cls: 'small' }, { text: `rows ${r.rows.join(', ')}`, cls: 'small' });
    if (r.rows.some(i => ROWS[i].estimate)) out.push({ text: 'an estimate among them', cls: 'small hot' });
  }
  return out;
});
const ticksR = [2, 3, 4, 5], ticksA = [60, 90, 120, 150];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A bend's K from a table: exact, bilinear or a miss" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Four bend-table rows on a chart of radius against angle, and a bend's K looked up between them">
        <line v-for="r in ticksR" :key="'gr' + r" :x1="X(r)" :x2="X(r)" :y1="Y(40)" :y2="Y(160)" class="grid" />
        <line v-for="a in ticksA" :key="'ga' + a" :x1="X(1.5)" :x2="X(5.5)" :y1="Y(a)" :y2="Y(a)" class="grid" />
        <text v-for="r in ticksR" :key="'tr' + r" :x="X(r)" :y="Y(40) + 13" class="small mid">{{ r }}</text>
        <text v-for="a in ticksA" :key="'ta' + a" :x="X(1.5) - 4" :y="Y(a) + 3" class="small end">{{ a }}°</text>
        <text :x="X(5.5)" :y="Y(40) + 25" class="small end">inner radius R (mm)</text>
        <text x="4" y="24" class="small">bend angle</text>
        <rect v-if="s.step.value >= 3 && result && !result.miss && result.how === 'interpolated'" :x="X(2)" :y="Y(120)" :width="X(4) - X(2)" :height="Y(60) - Y(120)" class="cell" />
        <g v-if="query && result && !result.miss && result.how === 'interpolated'">
          <line v-for="(i, j) in result.rows" :key="'w' + i" :x1="X(query[0])" :y1="Y(query[1])" :x2="X(ROWS[i].radius)" :y2="Y(ROWS[i].angle)" class="weight" :style="{ strokeWidth: 0.6 + 4 * result.w[j] }" />
        </g>
        <g v-for="(r, i) in ROWS" :key="'r' + i" :style="{ opacity: i < shownRows ? 1 : 0 }">
          <circle :cx="X(r.radius)" :cy="Y(r.angle)" r="5" :class="['row', { est: r.estimate, used: result && !result.miss && result.rows.includes(i) }]" />
          <text :x="X(r.radius) + 8" :y="Y(r.angle) - 7" :class="['small', 'klab', { hot: i === 2 && s.step.value === 1 }]">{{ kLabel(i) }}</text>
        </g>
        <g v-if="query">
          <circle :cx="X(query[0])" :cy="Y(query[1])" r="4.5" :class="['query', { miss: result && result.miss }]" />
        </g>
        <text x="240" y="20" class="head">rows (T 2)</text>
        <text v-for="(r, i) in ROWS" :key="'l' + i" x="240" :y="36 + 14 * i" :class="['small', 'mono', { dim: i >= shownRows }]">{{ rowLabel(r, i) }}</text>
        <text v-for="(l, i) in readout" :key="'q' + i" x="240" :y="104 + 15 * i" :class="['read', l.cls]">{{ l.text }}</text>
      </svg>
      <template #note>Run in the page with the kernel's lookup on the four rows of <code>test/r12-4.test.mjs</code> (made up
        for the test, as its source label says). The built kernel's <code>lookupBend</code> gives 0.39979 at R 3, 90°,
        0.37229 at R 2, 75° and a miss at R 5, as shown. Rows of other thicknesses and rows for any angle are left out of
        the picture.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; } .mid { text-anchor: middle; } .end { text-anchor: end; }
.mono { font-variant-numeric: tabular-nums; } .dim { opacity: 0.25; }
.head { font-weight: 700; fill: var(--vp-c-text-1); }
.read { font-variant-numeric: tabular-nums; } .read.strong { fill: var(--vp-c-text-1); font-weight: 700; }
.hot, .read.hot, .read.strong.hot { fill: var(--hot); }
.grid { stroke: var(--vp-c-divider); stroke-width: 0.8; }
.cell { fill: var(--keep); fill-opacity: 0.1; stroke: var(--keep); stroke-width: 1; stroke-dasharray: 3 2; }
.row { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1.2; transition: opacity 0.3s; }
.row.est { fill: var(--vp-c-bg); stroke: var(--a); stroke-width: 1.6; stroke-dasharray: 2 1.5; }
.row.used { stroke: var(--keep); stroke-width: 2.2; }
.klab { fill: var(--a); font-weight: 600; }
.weight { stroke: var(--keep); opacity: 0.7; }
.query { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.query.miss { fill: var(--hot); }
</style>
