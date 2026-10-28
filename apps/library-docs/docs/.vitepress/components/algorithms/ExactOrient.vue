<script setup>
// The orientation test on nearly collinear points: b = (12, 12), c = (24, 24) on y = x, and a on a 32 × 32 grid of
// neighbouring doubles a = (0.5 + i·2⁻⁵³, 0.5 + j·2⁻⁵³), i, j = 32 … 63. The binary64 answer is the textbook
// (bₓ − aₓ)(c_y − a_y) − (b_y − a_y)(cₓ − aₓ) evaluated in the page. The exact answer is computed here as the kernel
// does it (brep/planar-arrangement.ts: `fromXY` turns each double into homogeneous integers (x, y, w = 2ᵏ) with
// core/dyadic.ts `binary64Dyadic`; `orient` takes the sign of the 3 × 3 integer determinant). Checked against the built
// kernel (scratch script running dist/brep/planar-arrangement.js exactOrient2 and dist/exact-proof/
// exact-binary64-orientation-v1.js on the same grid): the same 1 024 signs; binary64 gets 302 right (32 of them the zeros
// on the diagonal), 610 zero where a is off the line, 112 with the wrong sign; the only values it produces are 0 and ±2⁻⁴⁴.
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const U = 2 ** -53, B = [12, 12], C = [24, 24], I0 = 32, N = 32, ROW = 50;

// ---- the kernel's exact orientation (copies of core/dyadic.ts and planar-arrangement.ts) ----
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
const gcd = (a, b) => { a = babs(a); b = babs(b); while (b) { const r = a % b; a = b; b = r; } return a; };
function fromXY([x, y]) {
  const dx = dyadic(x), dy = dyadic(y), k = Math.max(dx.k, dy.k);
  const p = { x: dx.m << BigInt(k - dx.k), y: dy.m << BigInt(k - dy.k), w: 1n << BigInt(k) }, g = gcd(gcd(p.x, p.y), p.w) || 1n;
  return { x: p.x / g, y: p.y / g, w: p.w / g };
}
function orient(a, b, c) {
  const d = a.x * (b.y * c.w - c.y * b.w) - a.y * (b.x * c.w - c.x * b.w) + a.w * (b.x * c.y - c.x * b.y);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}
const HB = fromXY(B), HC = fromXY(C);
const floatDet = a => (B[0] - a[0]) * (C[1] - a[1]) - (B[1] - a[1]) * (C[0] - a[0]);

// Every cell, row by row from the top (j = 63) down.
const cells = [];
for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
  const i = I0 + q, j = I0 + N - 1 - r, a = [0.5 + i * U, 0.5 + j * U], f = floatDet(a);
  const exact = orient(fromXY(a), HB, HC), fs = Math.sign(f);
  cells.push({ i, j, a, f, exact, kind: fs === exact ? (exact > 0 ? 'pos' : exact < 0 ? 'neg' : 'zero') : fs === 0 ? 'fzero' : 'wrong' });
}
const exactKind = c => (c.exact > 0 ? 'pos' : c.exact < 0 ? 'neg' : 'zero');
const COUNT = { right: cells.filter(c => ['pos', 'neg', 'zero'].includes(c.kind)).length, fzero: cells.filter(c => c.kind === 'fzero').length, wrong: cells.filter(c => c.kind === 'wrong').length };

// ---- picture ----
const GX = 12, GY = 32, S = 6;
const cx = i => GX + S * (i - I0), cy = j => GY + S * (I0 + N - 1 - j);
// The overview: world [−1, 25]² onto the grid's square.
const W0 = -1, WS = (S * N) / 26, ox = x => GX + (x - W0) * WS, oy = y => GY + S * N - (y - W0) * WS;

const steps = [
  { label: 'Which side of a line', text: 'The orientation of three points a, b, c is the sign of a 2 × 2 determinant: positive when a lies to the left of the line from b to c, negative to the right, zero on it. Splitting a face, finding where two edges cross and testing a point against an edge are all built from this sign. Here b = (12, 12) and c = (24, 24) lie on y = x, and a is near (0.5, 0.5), almost on the line.', formula: 'orient(a, b, c) = sign[(bₓ − aₓ)(c<sub>y</sub> − a<sub>y</sub>) − (b<sub>y</sub> − a<sub>y</sub>)(cₓ − aₓ)]' },
  { label: 'Zoom to single doubles', text: 'Near 0.5, two neighbouring binary64 numbers are 2⁻⁵³ ≈ 1.1 × 10⁻¹⁶ apart. Each square below is one point a = (0.5 + i·2⁻⁵³, 0.5 + j·2⁻⁵³), for i, j = 32 … 63: the whole grid is 3.6 × 10⁻¹⁵ wide. The line y = x is its diagonal.' },
  { label: 'The exact answer', text: 'For these points the determinant works out to 12 (j − i) · 2⁻⁵³: positive above the diagonal, negative below it, zero on it. Green squares are left of the line, blue right, dark on it.', formula: 'det = 12 (a<sub>y</sub> − aₓ) = 12 (j − i) · 2⁻⁵³' },
  { label: 'The binary64 answer', text: `The same formula evaluated in binary64. Grey squares come out as 0 although a is off the line; red ones come out with the wrong sign. Of the ${cells.length} points, ${COUNT.right} are right (32 of them the zeros on the diagonal), ${COUNT.fzero} give 0 and ${COUNT.wrong} give the wrong sign.` },
  { label: 'Where the bits go', text: 'Follow row j = 50. The difference 12 − aₓ is rounded to the doubles near 11.5, which are 2⁻⁴⁹ apart, so 16 neighbouring aₓ give one and the same difference. The two products are near 270, where doubles are 2⁻⁴⁴ ≈ 5.7 × 10⁻¹⁴ apart: more than the largest true value on this grid, 372 · 2⁻⁵³ ≈ 4.1 × 10⁻¹⁴. Every binary64 result here is 0 or ±2⁻⁴⁴.', formula: 'spacing near 11.5: 2⁻⁴⁹ &nbsp; near 270: 2⁻⁴⁴ &nbsp; |exact| ≤ 4.1 × 10⁻¹⁴' },
  { label: 'The kernel: integers, exactly', text: 'A double is exactly m / 2ᵏ for integers m and k. The kernel writes each point as integers (x, y, w) with w a power of two (x/w and y/w are the coordinates) and takes the sign of a 3 × 3 determinant in BigInt. No step rounds, so every square gets its exact sign, and two tests on the same three points always agree.', formula: 'orient = sign det [ aₓ a<sub>y</sub> a<sub>w</sub> ; bₓ b<sub>y</sub> b<sub>w</sub> ; cₓ c<sub>y</sub> c<sub>w</sub> ], &nbsp; a<sub>w</sub>, b<sub>w</sub>, c<sub>w</sub> &gt; 0' },
];
const s = useSteps(steps.length, [3000, 2600, 2800, 3400, 7000, 3400], root);
const step = computed(() => s.step.value), k = computed(() => ease(s.t.value));

// A point chosen by the reader holds until the step changes.
const user = ref(null);
watch(() => s.step.value, () => { user.value = null; });
const pick = c => { s.pause(); user.value = { i: c.i, j: c.j }; };
const setI = e => { s.pause(); user.value = { i: +e.target.value, j: at.value.j }; };
const setJ = e => { s.pause(); user.value = { i: at.value.i, j: +e.target.value }; };
const at = computed(() => {
  if (user.value) return user.value;
  if (step.value === 4) return { i: I0 + Math.min(N - 1, Math.floor(s.t.value * N)), j: ROW };
  return { i: 44, j: ROW };
});
const cell = computed(() => cells[(I0 + N - 1 - at.value.j) * N + (at.value.i - I0)]);

// Which colouring each square shows: rows revealed top to bottom during a sweep.
const kinds = computed(() => {
  const st = step.value, rows = Math.floor(k.value * (N + 0.999));
  return cells.map((c, n) => {
    const r = Math.floor(n / N);
    if (st <= 1) return 'none';
    if (st === 2) return r < rows ? exactKind(c) : 'none';
    if (st === 3) return r < rows ? c.kind : exactKind(c);
    if (st === 4) return c.kind;
    return r < rows ? exactKind(c) : c.kind;
  });
});
const zoom = computed(() => {
  // The zoom box: a few pixels round a in the overview, growing to the grid's square.
  const t = step.value === 0 ? 0 : step.value === 1 ? k.value : 1, x0 = ox(0.5) - 4, y0 = oy(0.5) - 4;
  return { x: x0 + (GX - x0) * t, y: y0 + (GY - y0) * t, w: 8 + (S * N - 8) * t, overview: 1 - t };
});
const sup = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sci(x) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x))), m = x / 10 ** e;
  return `${m < 0 ? '−' : ''}${Math.abs(m).toFixed(2)} × 10${String(e).split('').map(ch => sup[ch]).join('')}`;
}
const signWord = v => (v > 0 ? 'left (+)' : v < 0 ? 'right (−)' : 'on the line (0)');
const exactText = computed(() => { const n = 12 * (cell.value.j - cell.value.i); return n === 0 ? '0' : `${n < 0 ? '−' : '+'}${Math.abs(n)} × 2⁻⁵³`; });
const diff = computed(() => String(B[0] - cell.value.a[0]));
const showFloat = computed(() => step.value >= 3 && step.value <= 4);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The orientation test: binary64 against exact" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A grid of neighbouring floating-point points near a line, coloured by the sign of the orientation test">
        <text :x="GX" y="20" class="head">{{ step === 0 ? 'b = (12, 12), c = (24, 24), a ≈ (0.5, 0.5)' : 'a = (0.5 + i·2⁻⁵³, 0.5 + j·2⁻⁵³)' }}</text>
        <!-- Overview: the line and the three points. -->
        <g :opacity="zoom.overview" v-if="zoom.overview > 0.01">
          <rect :x="GX" :y="GY" :width="S * N" :height="S * N" class="frame" />
          <line :x1="ox(-1)" :y1="oy(-1)" :x2="ox(25)" :y2="oy(25)" class="line" />
          <circle :cx="ox(12)" :cy="oy(12)" r="4" class="pt" /><text :x="ox(12) + 8" :y="oy(12) + 4" class="lab">b</text>
          <circle :cx="ox(24)" :cy="oy(24)" r="4" class="pt" /><text :x="ox(24) - 12" :y="oy(24) + 4" class="lab">c</text>
          <circle :cx="ox(0.5)" :cy="oy(0.5)" r="3.5" class="pt a" /><text :x="ox(0.5) + 9" :y="oy(0.5) - 4" class="lab">a</text>
        </g>
        <!-- The grid of doubles. -->
        <g :opacity="1 - zoom.overview">
          <rect v-for="(c, n) in cells" :key="n" :x="cx(c.i) + 0.3" :y="cy(c.j) + 0.3" :width="S - 0.6" :height="S - 0.6" class="cell" :class="kinds[n]" @click="pick(c)" />
          <line :x1="cx(I0)" :y1="cy(I0) + S" :x2="cx(I0 + N - 1) + S" :y2="cy(I0 + N - 1)" class="diag" />
          <rect v-if="step === 4 && !user" :x="GX" :y="cy(ROW)" :width="S * N" :height="S" class="row" />
          <rect :x="cx(cell.i) - 1" :y="cy(cell.j) - 1" :width="S + 2" :height="S + 2" class="mark" />
          <text :x="GX" :y="GY + S * N + 12" class="small">i = 32 → 63</text>
          <text :x="GX + S * N" :y="GY + S * N + 12" class="small" text-anchor="end">one square = 2⁻⁵³ ≈ 1.1 × 10⁻¹⁶</text>
        </g>
        <rect :x="zoom.x" :y="zoom.y" :width="zoom.w" :height="zoom.w" class="zoom" v-if="step <= 1" />
        <!-- Readouts. -->
        <g class="readout" v-if="step >= 1">
          <text x="216" y="44">i = {{ cell.i }}, j = {{ cell.j }}</text>
          <text x="216" y="58">aₓ = {{ cell.a[0] }}</text>
          <text x="216" y="72">a<tspan dy="2" font-size="8">y</tspan><tspan dy="-2"> = {{ cell.a[1] }}</tspan></text>
          <text x="216" y="90" v-if="step >= 4">12−aₓ → {{ diff }}</text>
          <text x="216" y="108" v-if="step >= 3" :class="{ hot: cell.kind === 'wrong', dim: cell.kind === 'fzero' }">binary64: {{ sci(cell.f) }}</text>
          <text x="216" y="122" v-if="step >= 2" class="keep">exact: {{ exactText }}</text>
          <text x="216" y="136" v-if="step >= 2">a is {{ signWord(cell.exact) }}</text>
        </g>
        <g class="legend" v-if="step >= 2">
          <rect x="216" y="158" width="8" height="8" class="cell pos" /><text x="229" y="165">left of b → c</text>
          <rect x="300" y="158" width="8" height="8" class="cell neg" /><text x="313" y="165">right</text>
          <rect x="216" y="172" width="8" height="8" class="cell zero" /><text x="229" y="179">on the line</text>
          <template v-if="step >= 3 && step <= 4">
            <rect x="216" y="190" width="8" height="8" class="cell fzero" /><text x="229" y="197">binary64 0, exact not: {{ COUNT.fzero }}</text>
            <rect x="216" y="204" width="8" height="8" class="cell wrong" /><text x="229" y="211">binary64 wrong sign: {{ COUNT.wrong }}</text>
            <text x="216" y="226">right: {{ COUNT.right }} of {{ cells.length }}</text>
          </template>
          <text v-if="step === 5" x="216" y="197" class="keep">exact: {{ cells.length }} of {{ cells.length }}</text>
        </g>
      </svg>
      <div class="pick" v-if="step >= 1">
        <label for="exact-orient-i">i</label>
        <input id="exact-orient-i" type="range" :min="I0" :max="I0 + N - 1" step="1" :value="cell.i" aria-label="Column i of point a" @input="setI">
        <label for="exact-orient-j">j</label>
        <input id="exact-orient-j" type="range" :min="I0" :max="I0 + N - 1" step="1" :value="cell.j" aria-label="Row j of point a" @input="setJ">
        <output>{{ showFloat ? (cell.kind === 'wrong' ? 'wrong sign' : cell.kind === 'fzero' ? 'binary64 says 0' : 'agrees') : '' }}</output>
      </div>
      <template #note>Computed in the page: the binary64 determinant as written above, and the exact sign with the kernel's
        own method (copied from <code>planar-arrangement.ts</code> and <code>core/dyadic.ts</code>). The built kernel gives the
        same 1 024 signs. Pick a square, or move i and j, to read one point; the choice holds until the next step.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .head { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
svg .small { font-size: 9px; fill: var(--vp-c-text-3); }
svg .lab { font-size: 12px; font-weight: 700; fill: var(--vp-c-text-1); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout .hot { fill: var(--hot); } .readout .dim { fill: var(--vp-c-text-3); } .readout .keep, .legend .keep { fill: var(--keep); }
.legend text { font-size: 10px; }
.frame { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.line { stroke: var(--vp-c-text-3); stroke-width: 1.4; stroke-dasharray: 5 3; }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1.5; } .pt.a { fill: var(--hot); }
.zoom { fill: none; stroke: var(--hot); stroke-width: 1.5; }
.cell { cursor: pointer; fill: var(--vp-c-divider); transition: fill .15s; }
.cell.pos { fill: color-mix(in srgb, var(--keep) 62%, var(--vp-c-bg)); }
.cell.neg { fill: color-mix(in srgb, var(--a) 62%, var(--vp-c-bg)); }
.cell.zero { fill: var(--vp-c-text-1); }
.cell.fzero { fill: color-mix(in srgb, var(--vp-c-text-3) 45%, var(--vp-c-bg)); }
.cell.wrong { fill: var(--hot); }
.diag { stroke: var(--vp-c-text-1); stroke-width: 0.8; stroke-dasharray: 2 2; pointer-events: none; }
.row { fill: none; stroke: var(--b); stroke-width: 1.2; pointer-events: none; }
.mark { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.6; pointer-events: none; }
.pick { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); }
.pick input { flex: 1 1 100px; min-width: 90px; accent-color: var(--vp-c-brand-1); }
.pick output { font-family: var(--vp-font-family-mono); font-size: 12px; min-width: 110px; color: var(--vp-c-text-1); }
.pick input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
