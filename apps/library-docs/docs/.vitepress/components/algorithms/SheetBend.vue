<script setup>
// One bend in section (packages/barocss-cad/src/frame-sheet/sheet-metal.ts): a sheet T thick bent θ at inner radius R,
// its neutral layer at R + K·T, and the closed forms the kernel reports for every bend — bendAllowance, outsideSetback
// and bendDeduction — worked out in the page with the same formulas. The L is the one in test/r12-2.test.mjs: legs 50 and
// 35 to the outer virtual sharp, T 2, R 3 (drawn shortened).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const T = 2, R = 3, A = 50, B = 35, LEG = 13;
const ANGLES = [60, 90, 120];
// The flat length A + B − BD the built kernel gives for these Ls at K 0.4 (flatPatternOf(...).box.max[0], run on
// packages/barocss-cad/dist/index.js): the page's closed form agrees to the last digit shown.
const KERNEL = { 60: 83.20584800265081, 90: 80.9690260418206, 120: 75.63819331340537 };
const deg = ref(90), kUser = ref(0.4);
const setK = e => { const v = Number(e.target.value); if (Number.isFinite(v)) kUser.value = Math.min(1, Math.max(0, v)); };

// The section: the bend's centre C = (0, R + T), leg 1 along y = 0 (outer skin) to its tangent line at x = 0, the bend
// turning from −90° by φ, leg 2 going on from the bend's end. mm → the picture: x right, y up.
const S = 10, OX = 215, OY = 222;
const P = ([x, y]) => [OX + S * x, OY - S * y];
const pts = list => list.map(P).map(q => q.map(v => v.toFixed(2)).join(',')).join(' ');
const C = [0, R + T];
/** A point at radius r from C, a radians into the bend. */
const onBend = (r, a) => [C[0] + r * Math.sin(a), C[1] - r * Math.cos(a)];
const arc = (r, phi, n = 28) => Array.from({ length: n + 1 }, (_, i) => onBend(r, phi * i / n));

const steps = [
  { label: 'A bend is a piece of a cylinder', text: 'A sheet-metal part is a sheet of one thickness T. Where it bends, the material turns round an axis: in section, a ring sector between an inner radius R and an outer radius R + T, between two straight legs. The lines where the bend meets the legs are its <em>tangent lines</em>.', formula: 'inner face: radius R &nbsp; outer face: radius R + T &nbsp; turned θ' },
  { label: 'The inside shortens, the outside stretches', text: 'Along its two faces the bend is θR long inside and θ(R + T) outside. Bending compresses the inside of the sheet and stretches the outside, so neither face keeps the length the flat sheet had.', formula: 'inner arc θR &nbsp;&lt;&nbsp; outer arc θ(R + T)' },
  { label: 'The neutral layer', text: 'Somewhere in between, a layer keeps its length: the <em>neutral layer</em>. Its place is given by the K-factor, K, measured from the inside: radius R + K·T, with K from 0 (the inner face) to 1 (the outer face). K is a property of the material and the tooling, found by test bends; the kernel never assumes one. Move the slider below to place it.', formula: 'neutral radius = R + K·T, &nbsp; 0 ≤ K ≤ 1' },
  { label: 'Bend allowance', text: 'Since the neutral layer keeps its length, the flat strip the bend comes from is as long as the neutral arc. That length is the <em>bend allowance</em> BA, what the kernel reports for each bend and what the flat pattern uses.', formula: 'BA = θ (R + K·T) &nbsp; (θ in radians)' },
  { label: 'Setback and the virtual sharp', text: 'Drawings dimension a bent part to its <em>virtual sharps</em>: where the outer faces of the two legs, extended, meet. From each tangent line to that point is the outside setback OSSB.', formula: 'OSSB = (R + T) · tan(θ/2) &nbsp; (θ &lt; 180°)' },
  { label: 'Bend deduction', text: 'Measured to the sharps, the legs are A and B. Their sum counts the setback twice and misses the bend\'s own length, so the flat is shorter by the <em>bend deduction</em> BD. This is the same flat length as adding up the straight parts and BA.', formula: 'BD = 2·OSSB − BA &nbsp; flat = A + B − BD' },
];
const s = useSteps(steps.length, [2600, 2600, 4200, 3000, 2800, 3000], root);
const k = computed(() => ease(s.t.value));
const th = computed(() => deg.value * Math.PI / 180);
// Step 1 folds the sheet from flat; afterwards the bend is at θ.
const phi = computed(() => (s.step.value === 0 ? Math.max(1e-6, k.value) : 1) * th.value);
// Step 3 sweeps K across the sheet, then settles at the slider's value.
const K = computed(() => {
  if (s.step.value !== 2) return kUser.value;
  const u = s.t.value;
  return u < 0.3 ? kUser.value * (1 - u / 0.3) : u < 0.7 ? (u - 0.3) / 0.4 : 1 + (kUser.value - 1) * ease((u - 0.7) / 0.3);
});
const rn = computed(() => R + K.value * T);
const BA = computed(() => th.value * (R + kUser.value * T));
const OSSB = computed(() => (R + T) * Math.tan(th.value / 2));
const BD = computed(() => 2 * OSSB.value - BA.value);

const shape = computed(() => {
  const f = phi.value, d = [Math.cos(f), Math.sin(f)], eo = onBend(R + T, f), ei = onBend(R, f);
  const outer = [[-LEG, 0], ...arc(R + T, f), [eo[0] + LEG * d[0], eo[1] + LEG * d[1]]];
  const inner = [[-LEG, T], ...arc(R, f), [ei[0] + LEG * d[0], ei[1] + LEG * d[1]]];
  const sector = [...arc(R + T, f), ...arc(R, f).reverse()];
  return { outer, inner, body: [...outer, ...inner.reverse()], sector, eo, ei, d };
});
const neutral = computed(() => arc(rn.value, phi.value));
// Step 4: the neutral arc laid out straight from its tangent point, drawn 2.6 mm below leg 1's neutral line.
const unrolled = computed(() => {
  const n = 28, u = s.step.value === 3 ? k.value : s.step.value > 3 ? 1 : 0, y0 = C[1] - rn.value;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = onBend(rn.value, th.value * i / n), b = [rn.value * th.value * i / n, y0 - 2.6];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  });
});
const V = computed(() => [OSSB.value, 0]);
const L2 = computed(() => { const e = shape.value.eo, d = shape.value.d; return [e, [e[0] - OSSB.value * d[0], e[1] - OSSB.value * d[1]]]; });
const lines = computed(() => {
  const out = [`θ = ${deg.value}° · R = ${R} · T = ${T} · K = ${num(K.value, 2)}`];
  if (s.step.value >= 2) out.push(`neutral radius R + K·T = ${num(rn.value, 3)}`);
  if (s.step.value >= 3) out.push(`BA = θ(R + K·T) = ${num(BA.value, 3)}`);
  if (s.step.value >= 4) out.push(`OSSB = (R + T) tan(θ/2) = ${num(OSSB.value, 3)}`);
  if (s.step.value >= 5) out.push(`BD = 2·OSSB − BA = ${num(BD.value, 3)}`, `flat = ${A} + ${B} − BD = ${num(A + B - BD.value, 3)}`);
  return out;
});
const kernelLine = computed(() => s.step.value >= 5 && Math.abs(kUser.value - 0.4) < 1e-9 ? `kernel, K 0.4: ${num(KERNEL[deg.value], 3)}` : '');
</script>

<template>
  <div ref="root">
    <AlgoFigure title="One bend: the neutral layer, the allowance and the deduction" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A sheet bent at inner radius R, its inner, outer and neutral arcs, and the bend allowance laid out straight">
        <polygon :points="pts(shape.body)" class="sheet" />
        <polygon :points="pts(shape.sector)" class="bend" />
        <line :x1="P([0, 0])[0]" :y1="P([0, 0])[1]" :x2="P([0, T])[0]" :y2="P([0, T])[1]" class="tangent" />
        <line :x1="P(shape.eo)[0]" :y1="P(shape.eo)[1]" :x2="P(shape.ei)[0]" :y2="P(shape.ei)[1]" class="tangent" />
        <g v-if="s.step.value === 1">
          <polyline :points="pts(arc(R, phi).slice(0, 1 + Math.round(28 * k)))" class="arc-in" />
          <polyline :points="pts(arc(R + T, phi).slice(0, 1 + Math.round(28 * k)))" class="arc-out" />
        </g>
        <g v-if="s.step.value >= 2">
          <polyline :points="pts(arc(R, phi))" class="arc-in thin" />
          <polyline :points="pts(arc(R + T, phi))" class="arc-out thin" />
          <polyline :points="pts(neutral)" class="neutral" />
          <line :x1="P(C)[0]" :y1="P(C)[1]" :x2="P(onBend(rn, phi / 2))[0]" :y2="P(onBend(rn, phi / 2))[1]" class="radius" />
          <circle :cx="P(C)[0]" :cy="P(C)[1]" r="2.2" class="centre" />
        </g>
        <g v-if="s.step.value >= 3">
          <polyline :points="pts(unrolled)" class="ba" />
          <text v-if="s.step.value >= 3" :x="P(unrolled.at(-1))[0] + 5" :y="P(unrolled.at(-1))[1] + 4" class="tag ba-t">BA {{ num(BA, 3) }}</text>
        </g>
        <g v-if="s.step.value >= 4">
          <line :x1="P([0, 0])[0]" :y1="P([0, 0])[1]" :x2="P(V)[0]" :y2="P(V)[1]" class="setback" />
          <line :x1="P(L2[0])[0]" :y1="P(L2[0])[1]" :x2="P(L2[1])[0]" :y2="P(L2[1])[1]" class="setback" />
          <circle :cx="P(V)[0]" :cy="P(V)[1]" r="3" class="sharp" />
          <text :x="P(V)[0] + 8" :y="P(V)[1] + 4" class="tag small sharp-t">virtual sharp</text>
        </g>
        <text v-for="(l, i) in lines" :key="i" x="12" :y="20 + 15 * i" :class="['read', { strong: i === lines.length - 1 && s.step.value >= 5 }]">{{ l }}</text>
        <text v-if="kernelLine" x="12" :y="20 + 15 * lines.length" class="read small">{{ kernelLine }}</text>
        <text :x="P([-LEG, T])[0]" :y="P([-LEG, T])[1] - 6" class="small">leg 1 (A = {{ A }} to the sharp)</text>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Bend angle">
          <button v-for="a in ANGLES" :key="a" type="button" :aria-pressed="deg === a" @click="deg = a">{{ a }}°</button>
        </div>
        <label>K <input type="range" min="0" max="1" step="0.01" :value="kUser" aria-label="K-factor, from the inner face (0) to the outer face (1)" @input="setK"> <span>{{ num(kUser, 2) }}</span></label>
      </div>
      <template #note>Worked out in the page with the kernel's closed forms (<code>bendAllowance</code>,
        <code>outsideSetback</code>, <code>bendDeduction</code>). The legs are drawn 13 mm long; their lengths to the sharp,
        50 and 35, are those of the L in <code>test/r12-2.test.mjs</code>. At K 0.4 the built kernel's flat pattern of that L
        is 83.206, 80.969 and 75.638 mm long at 60°, 90° and 120°, the page's A + B − BD.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; }
.read { font-variant-numeric: tabular-nums; } .read.strong { fill: var(--vp-c-text-1); font-weight: 700; }
.sheet { fill: var(--a); fill-opacity: 0.16; stroke: var(--a); stroke-width: 1.2; stroke-linejoin: round; }
.bend { fill: var(--b); fill-opacity: 0.22; stroke: none; }
.tangent { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 2 2; }
.arc-in, .arc-out { fill: none; stroke-width: 2.4; stroke-linecap: round; }
.arc-in { stroke: var(--a); } .arc-out { stroke: var(--hot); }
.arc-in.thin, .arc-out.thin { stroke-width: 1.4; opacity: 0.8; }
.neutral { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linecap: round; }
.radius { stroke: var(--keep); stroke-width: 0.9; stroke-dasharray: 3 2; }
.centre { fill: var(--vp-c-text-2); }
.ba { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linecap: round; }
.tag { font-weight: 700; } .ba-t { fill: var(--keep); } .sharp-t { fill: var(--hot); }
.setback { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 4 2; }
.sharp { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.8; }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 140px; }
label span { font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
