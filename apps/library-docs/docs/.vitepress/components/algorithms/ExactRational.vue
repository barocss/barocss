<script setup>
// How big the fractions get, on one real cut: box A [0, 10]³'s top face (z = 10) against a side face of box B = the
// box [−4, 4]³ turned 30° about z (transformBrep, rotZ(π/6)) and moved by (10, 10, 8). The bit lengths were measured
// with a scratch copy of polyhedral-boolean.ts's own steps (qf, newellNormal, cutPair, intervals, overlap; `side` raw as
// in the kernel), run once with the kernel's reducing operations and once with the same operations never reduced
// (a counterfactual, not a kernel mode), on the built kernel's binary64 corners. The comparison is the one `overlap`
// makes between the two intervals' starts: the old cmp (sgn of a reduced difference) ran 24 remainder steps of Euclid's
// algorithm; the cross-multiplication compares a 300-bit with a 304-bit product. The reduced cut took 2 312 remainder
// steps in all. Commit 0457891e8 (P1.2) records the timing.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const X = 8.535898384862245;
// The 64 bits of X: sign, 11 exponent bits, 52 fraction bits.
const BITS = (() => { const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, X); return v.getBigUint64(0).toString(2).padStart(64, '0').split('').map(Number); })();
// [numerator bits, denominator bits], reduced as the kernel keeps them and never reduced.
const ROWS = [
  { label: 'corner x', red: [53, 50], raw: [53, 50] },
  { label: 'normal of B', red: [52, 1], raw: [52, 1] },
  { label: 'd = n · corner', red: [97, 48], raw: [149, 100] },
  { label: 'P₀, x', red: [148, 150], raw: [200, 202] },
  { label: 't, start in A', red: [148, 200], raw: [406, 458] },
  { label: 't, start in B', red: [105, 153], raw: [655, 703] },
  { label: 'cut end, x', red: [53, 50], raw: [908, 905] },
];
const L = 120, PX = 250 / 910, RY = 70, RH = 23;
const width = b => Math.max(1, Math.max(b[0], b[1]) * PX);

const steps = [
  { label: 'A double is a fraction', text: 'A binary64 number is a sign, an 11-bit exponent and a 52-bit fraction: (−1)<sup>s</sup> × 1.f × 2<sup>e − 1023</sup>. That is exactly an integer over a power of two. The kernel reads the bits (binary64Dyadic) and strips trailing zeros, so the fraction is in lowest terms: a corner of box B, x = 8.535898384862245, is 4805283598167253 / 2⁴⁹, a 53-bit numerator over a 50-bit denominator.', formula: 'v = m / 2<sup>k</sup>, &nbsp; k ≥ 0 as small as possible' },
  { label: 'Planes in integers', text: 'A face\'s normal is its Newell sum, computed after scaling every corner by the largest power of two among their denominators (here 2⁵⁰), so all terms are integers; the result is divided by the gcd of its three components. For B\'s face (its outward normal points along (sin 30°, −cos 30°, 0)) it is (1501199875790165, −2600154457184654, 0): plain integers of 51 and 52 bits.', formula: 'n = Σ p<sub>k</sub> × p<sub>k+1</sub> (integers), &nbsp; n ← n / gcd(nₓ, n<sub>y</sub>, n<sub>z</sub>)' },
  { label: 'Every stored value is reduced', text: 'A fraction is a pair of BigInts with a positive denominator. Adding, subtracting, multiplying and dividing all end in one step, q(n, d), that divides both by their gcd. The bars show what each value would need without that step (outlined): every product adds the sizes of its factors.', formula: 'a/b + c/d = (ad + cb) / bd, &nbsp; then ÷ gcd' },
  { label: 'Along the cut', text: 'The cut needs the planes\' line (P<sub>0</sub>) and the parameter t where it enters each face. Reduced, these stay at 100–200 bits; never reduced, they would pass 700 bits within this one cut.' },
  { label: 'Back to a corner', text: 'The cut starts on B\'s vertical edge, so its end point has the x and y of B\'s corners and z = 10. Reduced, x is the corner\'s own 53-bit / 50-bit fraction again, and converting back (Number(n) / Number(d)) returns the very same doubles, z exactly 10. Never reduced, it is a 908-bit fraction of the same value, and the same conversion gives z = 10.000000000000002: three roundings of huge numbers.', formula: 'reduced: (8.535898384862245, 4.535898384862246, 10) &nbsp; unreduced z: 10.000000000000002' },
  { label: 'Comparing without reducing', text: 'Which interval starts first? With positive denominators, a &lt; b exactly when nₐ d<sub>b</sub> &lt; n<sub>b</sub> dₐ: two products and a comparison. The kernel used to subtract, reduce the difference and read its sign; for these two values the reduction alone ran 24 remainder steps on 300-bit numbers. The change (commit P1.2, with the raw operations of the next step) left every result bit-identical and took one model test from 16.2 s to 6.7 s.', formula: 'cmp(a, b) = sign(nₐ d<sub>b</sub> − n<sub>b</sub> dₐ), &nbsp; d &gt; 0' },
  { label: 'Raw values for one-shot signs', text: 'Values that are only signed or compared and then dropped skip the reduction too: which side of the line a corner lies on (the intervals), whether a point is on an edge, and where an edge crosses a ray (the point-in-face test). They use raw sums and products with the denominator kept positive. What is kept stays reduced: for this cut, 2 312 remainder steps keep every stored value small.', formula: 'radd, rsub, rmul, rdiv: no gcd, d &gt; 0' },
];
const s = useSteps(steps.length, [3400, 3000, 3000, 3600, 3400, 4200, 3400], root);
const step = computed(() => s.step.value), k = computed(() => ease(s.t.value));
const visible = computed(() => [1, 2, 3, 6, 6, 6, 7][step.value]);
const grow = n => {
  // Rows 3–5 grow in step 3, row 6 in step 4; the others are full once shown.
  if (step.value === 3 && n >= 3 && n <= 5) return Math.max(0, Math.min(1, (k.value - (n - 3) * 0.25) / 0.5));
  if (step.value === 4 && n === 6) return k.value;
  return n < visible.value ? 1 : 0;
};
const rawShown = computed(() => step.value >= 2);
/** The unreduced bar's label: after the bar, or inside its end when the bar is long. */
const rawLabel = (r, n) => { const end = L + width(r.raw) * grow(n); return end > 316 ? { x: end - 4, 'text-anchor': 'end' } : { x: end + 4 }; };
const bars = computed(() => step.value < 5 || step.value === 6);
const steps24 = computed(() => (step.value === 5 ? Math.round(Math.max(0, Math.min(1, (k.value - 0.45) / 0.45)) * 24) : 0));
const cross = computed(() => (step.value === 5 ? Math.min(1, k.value / 0.4) : 0));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Fractions: how big they get, and comparing them" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="Bit lengths of exact fractions along one cut, reduced and never reduced">
        <!-- The double's 64 bits. -->
        <g v-if="step <= 1">
          <text x="8" y="16" class="head">x = 8.535898384862245 in binary64</text>
          <rect v-for="(b, n) in BITS" :key="'bit' + n" :x="58 + 4.2 * n" y="23" width="3.6" height="12" class="bit" :class="[n === 0 ? 's' : n < 12 ? 'e' : 'f', { one: b }]" :opacity="step === 0 ? Math.min(1, k * 3 - n / 40) : 1" />
          <text x="8" y="33" class="small">bits</text>
          <text x="58" y="47" class="small">s</text><text x="64" y="47" class="small e">exponent</text><text x="160" y="47" class="small f">fraction (52 bits)</text>
          <text x="58" y="60" class="num" :opacity="step === 0 ? Math.max(0, k * 2 - 1) : 1">= 4805283598167253 / 2⁴⁹</text>
        </g>
        <g v-else-if="step === 5">
          <text x="8" y="16" class="head">which of two fractions is smaller</text>
        </g>
        <g v-else>
          <text x="8" y="16" class="head">bits of numerator / denominator</text>
          <rect x="8" y="26" width="14" height="7" class="red" /><text x="26" y="33" class="small">as the kernel keeps them (reduced)</text>
          <rect x="200" y="26" width="14" height="7" class="raw" /><text x="218" y="33" class="small">never reduced</text>
        </g>
        <!-- Bars. -->
        <g v-if="bars" :opacity="step === 6 ? 0.9 : 1">
          <g v-for="(r, n) in ROWS" :key="'row' + n" v-show="grow(n) > 0">
            <text x="8" :y="RY + RH * n + 9" class="lab">{{ r.label }}</text>
            <rect :x="L" :y="RY + RH * n" :width="width(r.red) * grow(n)" height="7" class="red" />
            <text :x="L + width(r.red) * grow(n) + 4" :y="RY + RH * n + 7" class="num keep">{{ r.red[0] }} / {{ r.red[1] }}</text>
            <g v-if="rawShown">
              <rect :x="L" :y="RY + RH * n + 9" :width="width(r.raw) * grow(n)" height="7" class="raw" />
              <text v-bind="rawLabel(r, n)" :y="RY + RH * n + 16" class="num hot">{{ r.raw[0] }} / {{ r.raw[1] }}</text>
            </g>
          </g>
          <text v-if="step === 6" x="8" y="237" class="lab keep">this cut, reduced: 2 312 remainder steps in all</text>
        </g>
        <!-- Comparing two fractions. -->
        <g v-if="step === 5">
          <text x="8" y="70" class="lab">a = t, start in A</text><text x="8" y="84" class="num">148 / 200 bits</text>
          <text x="8" y="120" class="lab">b = t, start in B</text><text x="8" y="134" class="num">105 / 153 bits</text>
          <g :opacity="cross">
            <line x1="104" y1="66" x2="196" y2="114" class="arrow" /><line x1="104" y1="116" x2="196" y2="70" class="arrow" />
            <text x="204" y="74" class="num">nₐ · d<tspan dy="2" font-size="7">b</tspan><tspan dy="-2">: 300 bits</tspan></text>
            <text x="204" y="118" class="num">n<tspan dy="2" font-size="7">b</tspan><tspan dy="-2"> · dₐ: 304 bits</tspan></text>
            <text x="204" y="96" class="lab keep">first &lt; second ⇒ a &lt; b</text>
          </g>
          <text x="8" y="166" class="lab">before: subtract, reduce, read the sign</text>
          <rect x="8" y="176" width="324" height="10" class="track" />
          <rect x="8" y="176" :width="13.5 * steps24" height="10" class="gcd" />
          <text x="8" y="202" class="num hot">gcd(nₐd<tspan dy="2" font-size="7">b</tspan><tspan dy="-2"> − n</tspan><tspan dy="2" font-size="7">b</tspan><tspan dy="-2">dₐ, dₐd</tspan><tspan dy="2" font-size="7">b</tspan><tspan dy="-2">): {{ steps24 }} of 24 remainder steps</tspan></text>
          <text x="8" y="222" class="num keep">now: two products, one comparison</text>
        </g>
      </svg>
      <template #note>Measured on the built kernel's corners with a copy of the polyhedral Boolean's cut code. The kernel
        always reduces stored values; the outlined bars are the same operations with the reduction left out, to show what it
        prevents. The scale is the same for every bar (the longer of numerator and denominator).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .head { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
svg .small { font-size: 10px; } svg .small.e { fill: var(--b); } svg .small.f { fill: var(--a); }
svg .lab { font-size: 10px; fill: var(--vp-c-text-1); }
svg .num { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
svg .keep { fill: var(--keep); } svg .hot { fill: var(--hot); }
.bit { fill: var(--vp-c-bg); stroke-width: 0.8; }
.bit.s { stroke: var(--vp-c-text-2); } .bit.e { stroke: var(--b); } .bit.f { stroke: var(--a); }
.bit.s.one { fill: var(--vp-c-text-2); } .bit.e.one { fill: var(--b); } .bit.f.one { fill: var(--a); }
.red { fill: var(--keep); }
.raw { fill: color-mix(in srgb, var(--hot) 12%, transparent); stroke: var(--hot); stroke-width: 1; stroke-dasharray: 3 2; }
.arrow { stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.track { fill: none; stroke: var(--vp-c-divider); }
.gcd { fill: var(--hot); }
</style>
