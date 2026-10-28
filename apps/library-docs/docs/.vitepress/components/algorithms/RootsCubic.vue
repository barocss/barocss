<script setup>
// A cubic Bézier curve against the plane z = 0, solved as the kernel does it
// (packages/barocss-cad/src/intersect/own-cubic-bernstein-roots.ts, solveCubicBernsteinRoots, with the quadratic solver
// of own-homogeneous-bernstein-roots.ts for the derivative). The solver below is a port of both, run in the page on this
// curve (ports/bernstein-roots.mjs, checked against the kernel by apps/library-docs/samples/how-ports.test.mjs).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';
import { bern, cubicRoots } from './ports/bernstein-roots.mjs';

const root = ref(null);
// The curve's control points in the xz plane (mm); the plane is z = 0, a 20 × 20 mm square, normal +z, all weights 1.
const XS = [-8, -3, 3, 8], ZS = [1.2, -2.4, 2.0, -0.8];
const R = cubicRoots(ZS, 1e-12);
// From the built kernel (intersectCubicBezierCurveWithAffinePlaneSurface on this curve and plane): each event's
// distance from the plane, |n · (C(t) − O)|, in mm.
const RESIDUALS = [9.297632108662413e-13, 2.904620988175566e-13, 1.1173284519827575e-12];

// The view: x or t across, the normalised distance up.
const wx = x => 190 + 16 * x, tx = t => 62 + 256 * t, Y = v => 125 - 80 * v;
const N = 96, SAMPLES = Array.from({ length: N + 1 }, (_, i) => {
  const t = i / N; return { w: wx(bern(XS, t)), t: tx(t), y: Y(bern(R.n, t)) };
});
const POLES = XS.map((x, i) => ({ w: wx(x), t: tx(i / 3), y: Y(R.n[i]) }));
const DER = Array.from({ length: N + 1 }, (_, i) => [tx(i / N), Y(bern(R.der, i / N) / 6.5)]);
const DERPOLES = R.der.map((d, i) => [tx(i / 2), Y(d / 6.5)]);
/** Convex hull of 2D points (monotone chain), as a polygon's points attribute. */
function hull(ps) {
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half(p.slice().reverse())].map(q => q.join(',')).join(' ');
}
// The hull of the control points (i/3, c̃ᵢ).
const HULL = hull(POLES.map(p => [p.t, p.y]));
const ROOTX = R.roots.map(r => bern(XS, r.t));
const MAXIT = Math.max(...R.roots.map(r => r.iterations));
/** A number with d decimals and a true minus sign. */
const fx = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const sup = e => String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
const sci = (x, d = 1) => { if (x === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(x))); return `${(x / 10 ** e).toFixed(d)}·10${sup(e)}`; };

const steps = [
  { label: 'The curve and the plane, edge on', text: 'A cubic Bézier curve and a plane, seen along the plane so it shows as a line. Each control point P<sub>i</sub> has a signed distance d<sub>i</sub> from the plane: positive on the side the normal points to. The plane\'s origin O and unit normal n̂ come from its own control points.', formula: 'd<sub>i</sub> = n̂ · (P<sub>i</sub> − O) &nbsp; here d = (1.2, −2.4, 2.0, −0.8) mm, all weights w<sub>i</sub> = 1' },
  { label: 'The distance is a Bernstein polynomial', text: 'The curve\'s distance from the plane is a polynomial in t with the same Bernstein basis as the curve, and its coefficients are the control points\' distances times their weights. The denominator is positive (all weights are), so the roots are those of the numerator. Plotted against t instead of x, the control points move to t = i/3. The kernel divides the coefficients by the largest |c<sub>i</sub>| (2.4 here); only the scale changes.', formula: 'n̂ · (C(t) − O) = Σ B<sub>i,3</sub>(t) c<sub>i</sub> / Σ B<sub>i,3</sub>(t) w<sub>i</sub>, &nbsp; c<sub>i</sub> = w<sub>i</sub> d<sub>i</sub> &nbsp; c̃ = c / 2.4 = (0.5, −1, 0.833, −0.333)' },
  { label: 'The hull test', text: 'A Bernstein polynomial stays inside the convex hull of its control points (i/3, c̃<sub>i</sub>). If every c̃<sub>i</sub> is above the guard (or every one below minus it), the hull cannot reach zero: no root, no search. Here the signs alternate, so the hull crosses the axis and the search goes on. Three sign changes mean at most three roots; the code does not count them, it isolates the roots by the next steps.', formula: 'no root if all c̃<sub>i</sub> &gt; 64 ε or all c̃<sub>i</sub> &lt; −64 ε &nbsp; (ε = 2⁻⁵², the binary64 unit)' },
  { label: 'Where the distance turns', text: `Between two turning points the distance only rises or only falls, so it crosses zero at most once. The derivative of a cubic Bernstein polynomial is a quadratic one with coefficients 3 (c̃<sub>i+1</sub> − c̃<sub>i</sub>); the quadratic solver finds its roots, here t = ${num(R.crit[0].t, 4)} and ${num(R.crit[1].t, 4)} (${R.crit[0].iterations} halvings each), each in a bracket narrower than 10⁻¹².`, formula: `c̃′ = 3 Δc̃ = (${R.der.map(d => num(d, 2)).join(', ')}) &nbsp; drawn at 1/6.5 scale` },
  { label: 'No root hides at a turning point', text: `A root could sit inside a turning point\'s bracket, where the sign test cannot see it. The derivative's coefficients bound its slope: |f′| ≤ L, the largest |c̃′<sub>i</sub>|. So if |f| at the bracket's centre is more than L times the bracket's radius (plus the guard), f keeps one sign across it. Here |f| = ${num(Math.abs(R.crit[0].value), 4)} and ${num(Math.abs(R.crit[1].value), 4)} against margins of ${sci(R.crit[0].margin)} and ${sci(R.crit[1].margin)}. Otherwise the kernel refuses: a tangent or a double root.`, formula: `|f(t<sub>c</sub>)| &gt; L · r + 64 ε, &nbsp; L = ${num(R.L, 2)} &nbsp; else refused: "critical bracket root/tangent cannot be excluded"` },
  { label: 'Pieces that rise or fall', text: 'The turning points cut [0, 1] into at most three pieces, each monotone. A piece whose two end values have opposite signs holds exactly one root; a piece whose ends agree holds none. Here all three change sign. An end value within the guard of zero is not trusted: the kernel refuses rather than guess its sign.', formula: R.mono.map(m => `[${num(m.domain[0], 3)}, ${num(m.domain[1], 3)}]: ${m.ls > 0 ? '+' : '−'} → ${m.rs > 0 ? '+' : '−'}`).join(' &nbsp; ') },
  { label: 'Halving the bracket', text: `In each piece the bracket is halved, keeping the half whose ends still differ in sign, until it is at most 10⁻¹² wide (in the curve's own parameter; at most 64 halvings). Here ${R.roots.map(r => r.iterations).join(', ')} halvings. A midpoint whose value is within the guard of zero is stepped over: the bracket moves to the two quarter points, which must show the ends' signs, or the kernel refuses.`, formula: 'mid = lo + (hi − lo) / 2; &nbsp; keep [lo, mid] if sign f(mid) = sign f(hi), else [mid, hi] &nbsp; root = midpoint of the last bracket' },
  { label: 'Back on the curve', text: `Each root t is mapped to the curve's own parameter range and the original curve is evaluated there: x = ${ROOTX.map(x => fx(x, 3)).join(', ')} mm. The point must be on the plane within the linear tolerance; here its distance is at most ${sci(Math.max(...RESIDUALS))} mm. The plane's (u, v) of the point decides whether it lies on the plane's finite rectangle.`, formula: '|n̂ · (C(t) − O)| ≤ max(10⁻⁷ mm, 10⁻¹¹ × the largest coordinate) &nbsp; else refused' },
];
const s = useSteps(steps.length, [2600, 3600, 3200, 3400, 3200, 3000, 6000, 3200], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);
// 0 = edge on in x, 1 = against t.
const m = computed(() => (st.value === 0 ? 0 : st.value === 1 ? k.value : st.value === 7 ? 1 - k.value : 1));
const at = p => p.w + (p.t - p.w) * m.value;
const curve = computed(() => SAMPLES.map(p => `${at(p).toFixed(2)},${p.y.toFixed(2)}`).join(' '));
const plane = computed(() => [30 + 32 * m.value, 350 - 32 * m.value]);
const derShown = computed(() => {
  if (st.value < 3 || st.value > 4) return '';
  const n = st.value === 3 ? Math.max(1, Math.round(k.value * N)) : N;
  return DER.slice(0, n + 1).map(p => p.join(',')).join(' ');
});
const pieceShown = i => (st.value > 5 ? 1 : st.value < 5 ? 0 : Math.max(0, Math.min(1, k.value * 3 - i)));
const PIECE_CLASS = ['a', 'b', 'keep'];
const iter = computed(() => (st.value === 6 ? Math.min(MAXIT, Math.floor(k.value * (MAXIT + 1))) : MAXIT));
const brackets = computed(() => R.roots.map(r => r.trace[Math.min(iter.value, r.trace.length - 1)]));
const width = computed(() => { const b = brackets.value[0]; return b[1] - b[0]; });
const widthX = computed(() => 160 + 190 * Math.min(1, Math.max(0, -Math.log10(Math.max(width.value, 1e-14)) / 13)));
const rootMarks = computed(() => R.roots.map((r, i) => {
  const x = st.value === 6 ? tx((brackets.value[i][0] + brackets.value[i][1]) / 2) : tx(r.t);
  return st.value === 7 ? wx(ROOTX[i]) + (tx(r.t) - wx(ROOTX[i])) * m.value : x;
}));
const readout = computed(() => {
  switch (st.value) {
    case 0: return 'd = (1.2, −2.4, 2.0, −0.8) mm';
    case 1: return 'c̃ = c / 2.4 = (0.5, −1, 0.833, −0.333)';
    case 2: return 'signs + − + − : the hull crosses zero';
    case 3: return `turning points t = ${num(R.crit[0].t, 3)}, ${num(R.crit[1].t, 3)}`;
    case 4: return `|f| ≥ ${fx(Math.min(...R.crit.map(c => Math.abs(c.value))), 3)} ≫ L·r + 64ε ≈ ${sci(R.crit[0].margin)}`;
    case 5: return '3 monotone pieces, each with one sign change';
    case 6: return `halving ${iter.value}: bracket width ${sci(width.value)}`;
    default: return `3 roots on the plane, distance ≤ ${sci(Math.max(...RESIDUALS))} mm`;
  }
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A cubic meets a plane: hull, turning points, bisection" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A cubic curve crossing a plane seen edge on, and its distance function with control points, turning points and bisection brackets">
        <text x="12" y="20" class="readout">{{ readout }}</text>
        <g v-if="st === 6" class="logbar">
          <line x1="160" y1="34" x2="350" y2="34" class="axisline" />
          <line v-for="e in [0, 4, 8, 12]" :key="'e' + e" :x1="160 + 190 * e / 13" y1="30" :x2="160 + 190 * e / 13" y2="38" class="axisline" />
          <text v-for="e in [0, 4, 8, 12]" :key="'l' + e" :x="160 + 190 * e / 13" y="48" class="tick" text-anchor="middle">10{{ sup(-e) }}</text>
          <line :x1="160 + 190 * 12 / 13" y1="27" :x2="160 + 190 * 12 / 13" y2="41" class="target" />
          <circle :cx="widthX" cy="34" r="4" class="bar-dot" />
          <text x="12" y="38" class="tick">bracket width (log)</text>
        </g>
        <!-- the plane, edge on -->
        <rect :x="plane[0]" y="122" :width="Math.max(0, plane[1] - plane[0])" height="6" class="plane" />
        <text :x="plane[0] + 2" y="142" class="name a" :style="{ opacity: 1 - m }">plane z = 0</text>
        <text :x="plane[1] + 6" y="129" class="name a" :style="{ opacity: m }">t</text>
        <g :style="{ opacity: m }">
          <text :x="tx(0)" y="142" class="tick" text-anchor="middle">0</text><text :x="tx(1)" y="142" class="tick" text-anchor="middle">1</text>
        </g>
        <!-- monotone pieces on the axis -->
        <g v-if="st >= 5 && st <= 6">
          <line v-for="(p, i) in R.mono" :key="'pc' + i" :x1="tx(p.domain[0]) + 2" y1="125" :x2="tx(p.domain[1]) - 2" y2="125" :class="['piece', PIECE_CLASS[i]]" :style="{ opacity: pieceShown(i) }" />
        </g>
        <!-- hull and signs -->
        <polygon v-if="st === 2 || st === 3" :points="HULL" class="hull" :style="{ opacity: st === 2 ? k : 0.5 }" />
        <!-- distances to the plane -->
        <g v-if="st <= 1">
          <line v-for="(p, i) in POLES" :key="'d' + i" :x1="at(p)" :y1="p.y" :x2="at(p)" y2="125" class="dist" />
        </g>
        <polyline :points="POLES.map(p => `${at(p)},${p.y}`).join(' ')" class="polygon" />
        <polyline :points="curve" class="curve" />
        <polyline v-if="derShown" :points="derShown" class="deriv" />
        <g v-if="st === 3 || st === 4">
          <polyline :points="DERPOLES.map(p => p.join(',')).join(' ')" class="deriv-poly" :style="{ opacity: st === 3 ? k : 1 }" />
          <rect v-for="(p, i) in DERPOLES" :key="'dp' + i" :x="p[0] - 3" :y="p[1] - 3" width="6" height="6" class="deriv-pole" :style="{ opacity: st === 3 ? k : 1 }" />
        </g>
        <g v-if="st >= 3 && st <= 5">
          <g v-for="(c, i) in R.crit" :key="'c' + i">
            <line :x1="tx(c.t)" y1="54" :x2="tx(c.t)" y2="200" class="crit" />
            <circle :cx="tx(c.t)" :cy="Y(c.value)" r="4" class="crit-dot" />
            <circle v-if="st === 4" :cx="tx(c.t)" :cy="Y(c.value)" :r="4 + 10 * (1 - k)" class="ring" />
            <text v-if="st === 4" :x="tx(c.t) + 7" :y="Y(c.value) + (c.value < 0 ? 16 : -8)" class="tag">|f| = {{ fx(Math.abs(c.value), 3) }}</text>
          </g>
        </g>
        <g v-for="(p, i) in POLES" :key="'p' + i">
          <circle :cx="at(p)" :cy="p.y" r="4.2" :class="['pole', st === 2 ? (R.n[i] > 0 ? 'pos' : 'neg') : '']" />
          <text v-if="st === 2" :x="at(p)" :y="p.y + 3.5" class="sign" text-anchor="middle">{{ R.n[i] > 0 ? '+' : '−' }}</text>
          <text v-else-if="st <= 1" :x="at(p) + (i === 0 ? -8 : 8)" :y="p.y + (R.n[i] > 0 ? -7 : 14)" class="tick" :text-anchor="i === 0 ? 'end' : 'start'">{{ m < 0.5 ? `d${'₀₁₂₃'[i]} = ${fx(ZS[i], 1)}` : fx(R.n[i], 3) }}</text>
        </g>
        <!-- bisection brackets and roots -->
        <g v-if="st === 6">
          <g v-for="(b, i) in brackets" :key="'b' + i">
            <line :x1="tx(b[0])" y1="125" :x2="Math.max(tx(b[1]), tx(b[0]) + 0.6)" y2="125" class="bracket" />
            <line :x1="tx(b[0])" y1="118" :x2="tx(b[0])" y2="132" class="bracket-end" /><line :x1="tx(b[1])" y1="118" :x2="tx(b[1])" y2="132" class="bracket-end" />
          </g>
        </g>
        <g v-if="st >= 6">
          <circle v-for="(x, i) in rootMarks" :key="'r' + i" :cx="x" cy="125" r="4.5" class="root" />
        </g>
        <g v-if="st === 7" :style="{ opacity: k }">
          <text v-for="(x, i) in ROOTX" :key="'rx' + i" :x="wx(x)" y="160" class="tag keep" text-anchor="middle">x = {{ fx(x, 3) }}</text>
        </g>
      </svg>
      <template #note>Computed in the page with a port of the kernel's cubic and quadratic root solvers, on one cubic Bézier
        span against the plane z = 0. The roots, turning points, brackets and halving counts are the kernel's own; the
        distances of the three points from the plane were read from the built kernel's
        <code>intersectCubicBezierCurveWithAffinePlaneSurface</code> on the same curve. The derivative is drawn at
        1/6.5 of its size; a 10⁻¹² bracket is far below a pixel, so the halving is followed on the log scale at the top.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout { font-size: 12px; font-weight: 600; fill: var(--vp-c-text-1); }
.tick { font-size: 10px; fill: var(--vp-c-text-3); }
.plane { fill: var(--a); fill-opacity: 0.22; stroke: var(--a); stroke-width: 1; }
.name { font-weight: 700; font-size: 11px; } .name.a { fill: var(--a); }
.dist { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 2 2; }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 4 3; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.4; stroke-linejoin: round; }
.pole { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.pole.pos { fill: var(--keep); stroke: var(--keep); } .pole.neg { fill: var(--hot); stroke: var(--hot); }
.sign { font-size: 9px; font-weight: 700; fill: var(--vp-c-white); }
.hull { fill: var(--a); fill-opacity: 0.12; stroke: var(--a); stroke-width: 1; stroke-opacity: 0.6; }
.deriv { fill: none; stroke: var(--b); stroke-width: 1.6; stroke-dasharray: 5 3; }
.deriv-poly { fill: none; stroke: var(--b); stroke-width: 0.9; stroke-opacity: 0.6; }
.deriv-pole { fill: var(--vp-c-bg); stroke: var(--b); stroke-width: 1.2; }
.crit { stroke: var(--b); stroke-width: 1; stroke-dasharray: 3 3; }
.crit-dot { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 1; }
.ring { fill: none; stroke: var(--b); stroke-width: 1.2; }
.piece { stroke-width: 6; stroke-linecap: round; } .piece.a { stroke: var(--a); } .piece.b { stroke: var(--b); } .piece.keep { stroke: var(--keep); }
.bracket { stroke: var(--hot); stroke-width: 5; stroke-linecap: butt; }
.bracket-end { stroke: var(--hot); stroke-width: 1.4; }
.root { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.tag { font-size: 10.5px; font-weight: 600; fill: var(--b); } .tag.keep { fill: var(--keep); }
.axisline { stroke: var(--vp-c-text-3); stroke-width: 1; }
.target { stroke: var(--hot); stroke-width: 2; }
.bar-dot { fill: var(--hot); }
</style>
