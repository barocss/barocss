<script setup>
// The spacing of binary64 numbers against the kernel's linear tolerance (packages/barocss-cad/src/numeric-policy.ts):
// linearToleranceMM(S) = max(linearTolerance 1e-7 mm, relativeLinearTolerance 1e-11 · S). The ulp is computed here
// exactly (2^(⌊log₂ S⌋ − 52), read from the number's bits); the lines are the policy's constants. The top line is a toy
// format with 3 significant bits, so its numbers can be drawn one by one.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** x as "m × 10ⁿ" with one or two significant digits. */
function sci(x, d = 1) {
  const e = Math.floor(Math.log10(x) + 1e-9), m = x / 10 ** e;
  if (e >= 0 && e < 4) return Number(x.toPrecision(2)).toLocaleString('en');
  const n = String(e).split('').map(c => SUP[c]).join('');
  return (Math.abs(m - 1) < 0.05 ? '' : m.toFixed(d) + ' × ') + '10' + n;
}
/** The gap from x to the next binary64 number (x > 0). */
function ulp(x) {
  const f = new Float64Array([x]), u = new BigUint64Array(f.buffer); u[0] += 1n; return f[0] - x;
}
const tol = S => Math.max(1e-7, 1e-11 * Math.abs(S));

// Top: the toy format, 8 numbers in each range [2ᵉ, 2ᵉ⁺¹), e = 0 … 3, then 16.
const X1 = v => 24 + 22 * (v - 1), LINE1 = 40;
const TOY = [];
for (let e = 0; e < 4; e++) for (let m = 8; m < 16; m++) TOY.push({ v: (m / 8) * 2 ** e, e });
TOY.push({ v: 16, e: 3 });
const BINADES = [0, 1, 2, 3].map(e => ({ a: X1(2 ** e), b: X1(2 ** (e + 1)), label: ['⅛', 'gap ¼', 'gap ½', '8 numbers in each range; gap 1'][e] }));

// Bottom: log-log plot, S from 1 to 10⁷ mm, lengths from 10⁻¹⁷ to 10⁻³ mm.
const XS = lg => 46 + 45 * lg, YL = lg => 222 - (lg + 17) * (130 / 14);
const ULP_PATH = (() => {
  let d = '', last = null;
  for (let i = 0; i <= 420; i++) {
    const lg = 7 * i / 420, y = YL(Math.log10(ulp(10 ** lg))), x = XS(lg);
    if (last === null) d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else if (Math.abs(y - last) > 0.01) d += ` L ${x.toFixed(1)} ${last.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    last = y;
  }
  return d + ` L ${XS(7).toFixed(1)} ${last.toFixed(1)}`;
})();
const MAX_PATH = `M ${XS(0)} ${YL(-7)} L ${XS(4)} ${YL(-7)} L ${XS(7)} ${YL(-4)}`;
const XT = [0, 2, 4, 6].map(lg => ({ x: XS(lg), label: lg === 0 ? '1' : '10' + SUP[lg] }));
const YT = [-16, -12, -8, -4].map(lg => ({ y: YL(lg), label: '10' + String(lg).split('').map(c => SUP[c]).join('') }));
const MARKS = [0, 4, 6].map(lg => ({ lg, u: ulp(10 ** lg) }));

const steps = [
  { label: 'Doubles thin out', text: 'Every coordinate is a binary64 number (a JavaScript <code>number</code>): 53 significant bits and an exponent. Between 1 and 2 there are 2⁵² of them, evenly spaced; between 2 and 4 just as many, so twice as far apart; and so on. The gap from a number to the next one is its <i>ulp</i> (unit in the last place). The line shows the same pattern with 3 bits instead of 53: 8 numbers in each range.', formula: 'ulp(x) = 2<sup>⌊log₂|x|⌋ − 52</sup> &nbsp; · &nbsp; ulp(1) = 2⁻⁵² ≈ 2.2 × 10⁻¹⁶' },
  { label: 'The gap grows with size', text: 'Plotted against the size S of a coordinate, both axes logarithmic, the ulp is a staircase that doubles at every power of two: always between 1.1 × 10⁻¹⁶ and 2.2 × 10⁻¹⁶ of S. Rounding one operation moves a result by at most half an ulp.', formula: 'ulp(1 mm) = 2.2 × 10⁻¹⁶ · ulp(10 m) = 1.8 × 10⁻¹² · ulp(1 km) = 1.2 × 10⁻¹⁰ mm' },
  { label: 'An absolute floor', text: 'Two points closer than <code>linearTolerance</code>, 10⁻⁷ mm, are one point to the kernel. That is far above rounding: 4.5 × 10⁸ ulps at 1 mm, 55 000 ulps at 10 m. A chain of operations can lose many ulps and still compare correctly.', formula: 'linearTolerance = 10⁻⁷ mm' },
  { label: 'What the methods leave behind', text: 'A curve\'s crossing with a plane is found by bisection on its parameter down to a bracket of 10⁻¹² (<code>parameterWidth</code>). On geometry of size S that leaves the point up to about 10⁻¹² S from the true crossing (dashed). <code>relativeLinearTolerance</code> is ten times that: 10⁻¹¹ S.', formula: '10⁻¹² · S (bracket) &nbsp;→&nbsp; relativeLinearTolerance · S = 10⁻¹¹ · S' },
  { label: 'The larger of the two', text: 'The comparison used is the larger one. The two meet at S = 10⁴ mm, 10 m: up to there it is exactly 10⁻⁷ mm, so results in the modeling range do not depend on the relative part. Beyond 10 m it grows with S, 10⁻⁵ mm at 1 km, and stays between 45 000 and 90 000 ulps of S.', formula: 'linearToleranceMM(S) = max(10⁻⁷, 10⁻¹¹ · |S|) mm' },
  { label: 'Where coordinates may lie', text: 'Modeled geometry stays within ±10 000 mm (<code>coordinateAbs</code>): a part\'s lengths past it are refused. Curves and surfaces, as math or imported, may reach ±10⁶ mm (<code>geometryCoordinateAbs</code>): <code>validateCurve</code> refuses past it. The scale tests run sampling, splitting and curvature at 5 × 10⁵ mm, and see every one refused at 2 × 10⁶.', formula: '|x| ≤ 10⁴ mm (modeling) &nbsp; · &nbsp; |x| ≤ 10⁶ mm (geometry) &nbsp; · &nbsp; beyond: refused' },
];
const s = useSteps(steps.length, [4200, 4200, 3200, 3800, 6000, 3800], root);
const k = computed(() => ease(s.t.value));
const at = i => s.step.value > i ? 1 : s.step.value === i ? k.value : 0;
// How many of the toy numbers are drawn (step 1 lays them out range by range).
const toyShown = computed(() => (s.step.value === 0 ? Math.floor(k.value * (TOY.length + 0.99)) : TOY.length));
// The marker swept along S in step 5: lg S from 0 to 6.
const lgS = computed(() => (s.step.value === 4 ? 6 * k.value : s.step.value === 1 ? 7 * k.value : null));
const marker = computed(() => {
  if (lgS.value === null) return null;
  const S = 10 ** lgS.value, u = ulp(S), t = tol(S);
  return { x: XS(lgS.value), yu: YL(Math.log10(u)), yt: YL(Math.log10(t)), S, u, t };
});
const readout = computed(() => {
  const m = marker.value;
  if (s.step.value === 4 && m) return `S = ${sci(m.S)} mm · tolerance ${sci(m.t)} mm · ${Math.round(m.t / m.u).toLocaleString('en')} ulps`;
  if (s.step.value === 1 && m) return `S = ${sci(m.S)} mm · ulp ${sci(m.u)} mm`;
  return ['3 significant bits: the gap doubles in every range', '', 'the floor: 10⁻⁷ mm at every size', 'dashed: 10⁻¹² S · solid: 10⁻¹¹ S', '', 'grey: refused (past 10⁶ mm)'][s.step.value];
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Doubles thin out; the tolerance follows" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A toy number line whose gaps double in each range, and a log-log plot of the binary64 gap and the kernel's linear tolerance against the size of a coordinate">
        <!-- Toy number line. -->
        <line :x1="X1(1)" :y1="LINE1" :x2="X1(16)" :y2="LINE1" class="axis" />
        <g v-for="(b, i) in BINADES" :key="'b' + i" :style="{ opacity: toyShown > 8 * i ? 1 : 0.15 }">
          <path :d="`M ${b.a + 1} ${LINE1 - 12} L ${b.a + 1} ${LINE1 - 15} L ${b.b - 1} ${LINE1 - 15} L ${b.b - 1} ${LINE1 - 12}`" class="bracket" />
          <text :x="(b.a + b.b) / 2" :y="LINE1 - 19" text-anchor="middle" class="tag">{{ b.label }}</text>
        </g>
        <line v-for="(p, i) in TOY" v-show="i < toyShown" :key="'n' + i" :x1="X1(p.v)" :y1="LINE1 - 6" :x2="X1(p.v)" :y2="LINE1 + 6" class="num" :class="'e' + (p.e % 2)" />
        <text v-for="v in [1, 2, 4, 8, 16]" :key="'l' + v" :x="X1(v)" :y="LINE1 + 18" text-anchor="middle" class="tag">{{ v }}</text>

        <!-- Log-log plot. -->
        <rect :x="XS(6)" :y="YL(-3)" :width="XS(7) - XS(6)" :height="YL(-17) - YL(-3)" class="refused" :style="{ opacity: at(5) }" />
        <rect :x="XS(0)" :y="YL(-3)" :width="XS(4) - XS(0)" :height="YL(-17) - YL(-3)" class="modeling" :style="{ opacity: at(5) }" />
        <line :x1="XS(0)" :y1="YL(-17)" :x2="XS(7)" :y2="YL(-17)" class="frame" />
        <line :x1="XS(0)" :y1="YL(-17)" :x2="XS(0)" :y2="YL(-3)" class="frame" />
        <g v-for="t in XT" :key="'xt' + t.label"><line :x1="t.x" :y1="YL(-17)" :x2="t.x" :y2="YL(-17) + 3" class="frame" /><text :x="t.x" :y="YL(-17) + 13" text-anchor="middle" class="tag">{{ t.label }}</text></g>
        <g v-for="t in YT" :key="'yt' + t.label"><line :x1="XS(0) - 3" :y1="t.y" :x2="XS(0)" :y2="t.y" class="frame" /><text :x="XS(0) - 5" :y="t.y + 3.5" text-anchor="end" class="tag">{{ t.label }}</text></g>
        <text :x="XS(7)" :y="YL(-17) + 13" text-anchor="end" class="tag">S (mm)</text>
        <text :x="XS(0) + 4" :y="YL(-3) + 9" class="tag">length (mm)</text>
        <text v-if="at(5) > 0.5" :x="(XS(0) + XS(4)) / 2" :y="YL(-15.6)" text-anchor="middle" class="tag strong">modeling: ±10⁴</text>
        <text v-if="at(5) > 0.5" :x="(XS(4) + XS(6)) / 2" :y="YL(-15.6)" text-anchor="middle" class="tag strong">geometry: ±10⁶</text>

        <path :d="ULP_PATH" class="ulp" pathLength="1" :style="{ strokeDasharray: 1, strokeDashoffset: 1 - at(1) }" />
        <g v-if="s.step.value >= 2">
          <line :x1="XS(0)" :y1="YL(-7)" :x2="XS(0) + (XS(7) - XS(0)) * at(2)" :y2="YL(-7)" class="floor" :class="{ faint: s.step.value >= 4 }" />
          <text v-if="at(2) > 0.6" :x="XS(1.2)" :y="YL(-7) - 8" class="tag a">10⁻⁷ mm</text>
        </g>
        <g v-if="s.step.value >= 3">
          <line :x1="XS(0)" :y1="YL(-12)" :x2="XS(7 * at(3))" :y2="YL(-12 + 7 * at(3))" class="bracketline" />
          <line :x1="XS(0)" :y1="YL(-11)" :x2="XS(7 * at(3))" :y2="YL(-11 + 7 * at(3))" class="rel" :class="{ faint: s.step.value >= 4 }" />
          <text v-if="at(3) > 0.6" :x="XS(5.2)" :y="YL(-5.8) - 7" text-anchor="end" class="tag b">10⁻¹¹ S</text>
        </g>
        <g v-if="s.step.value >= 4">
          <path :d="MAX_PATH" class="max" pathLength="1" :style="{ strokeDasharray: 1, strokeDashoffset: 1 - at(4) }" />
          <circle :cx="XS(4)" :cy="YL(-7)" r="3.5" class="cross" :style="{ opacity: at(4) }" />
          <text v-if="at(4) > 0.3" :x="XS(4)" :y="YL(-7) - 8" text-anchor="middle" class="tag keep">10 m</text>
        </g>
        <g v-if="s.step.value === 1 && at(1) > 0.95">
          <g v-for="m in MARKS" :key="'m' + m.lg">
            <circle :cx="XS(m.lg)" :cy="YL(Math.log10(m.u))" r="2.6" class="dot" />
            <text :x="XS(m.lg) + 4" :y="YL(Math.log10(m.u)) - 5" class="tag">{{ sci(m.u) }}</text>
          </g>
        </g>
        <g v-if="marker">
          <line v-if="s.step.value === 4" :x1="marker.x" :y1="marker.yt" :x2="marker.x" :y2="marker.yu" class="gap" />
          <circle :cx="marker.x" :cy="marker.yu" r="3" class="dot" />
          <circle v-if="s.step.value === 4" :cx="marker.x" :cy="marker.yt" r="3.5" class="cross" />
        </g>
        <text x="12" y="246" class="readout">{{ readout }}</text>
      </svg>
      <template #note>The top line is a toy format (3 significant bits), drawn to scale; binary64 has the same pattern with
        2⁵² numbers in each range. In the plot the ulp is binary64's, computed in the page; the lines are the constants of
        <code>CadNumericPolicy</code>. The parameter bracket's 10⁻¹² S is the order of the effect, as the policy's comment
        states it, not a measured error.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10px; fill: var(--vp-c-text-2); }
.axis, .frame { stroke: var(--vp-c-text-3); stroke-width: 1; }
.bracket { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.num { stroke-width: 1.3; } .num.e0 { stroke: var(--a); } .num.e1 { stroke: var(--b); }
.tag.strong { fill: var(--vp-c-text-1); font-weight: 600; }
.tag.a { fill: var(--a); font-weight: 600; } .tag.b { fill: var(--b); font-weight: 600; } .tag.keep { fill: var(--keep); font-weight: 700; }
.modeling { fill: color-mix(in srgb, var(--keep) 8%, transparent); }
.refused { fill: color-mix(in srgb, var(--vp-c-text-3) 22%, transparent); }
.ulp { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.4; }
.floor { stroke: var(--a); stroke-width: 1.6; }
.rel { stroke: var(--b); stroke-width: 1.6; }
.faint { opacity: 0.35; }
.bracketline { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 4 3; opacity: 0.8; }
.max { fill: none; stroke: var(--keep); stroke-width: 3; stroke-linejoin: round; }
.cross { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.dot { fill: var(--vp-c-text-1); }
.gap { stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 2 2; }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
