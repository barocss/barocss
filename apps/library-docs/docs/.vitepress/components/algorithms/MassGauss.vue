<script setup>
// Gauss–Legendre as the kernel computes and uses it: gauss(n) in packages/barocss-cad/src/core/quadrature.ts (Newton on
// the Legendre polynomial), the tensor rule over a whole patch's knot spans and Dunavant's 16-point triangle rule with
// the trim strips (src/brep/brep-mass-quadrature.ts). Run here, in the page, on a quarter circle and a cubic Bézier.
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
/** Gauss–Legendre nodes and weights on [0, 1] (the kernel's gauss), with each root's Newton iterates for the picture. */
function gauss(n) {
  const x = [], w = [], its = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    const path = [t];
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      d = n * (t * p1 - p0) / (t * t - 1);
      const dx = p1 / d; t -= dx; path.push(t);
      if (Math.abs(dx) < 1e-16) break;
    }
    x.push((1 - t) / 2); w.push(1 / ((1 - t * t) * d * d)); its.push(path.map(v => (1 - v) / 2));
  }
  return { x, w, its };
}
const RULES = Array.from({ length: 21 }, (_, n) => n ? gauss(n) : null);
// The quarter circle as a rational quadratic: poles (1,0), (1,1), (0,1), weights 1, √2/2, 1. g = ½ x² y′ (∫x dA by Green).
function arc(t) {
  const b = [(1 - t) ** 2, 2 * t * (1 - t), t * t], db = [-2 * (1 - t), 2 - 4 * t, 2 * t], w = [1, Math.SQRT1_2, 1], P = [[1, 0], [1, 1], [0, 1]];
  let X = 0, Y = 0, W = 0, dY = 0, dW = 0;
  for (let i = 0; i < 3; i++) { X += b[i] * w[i] * P[i][0]; Y += b[i] * w[i] * P[i][1]; W += b[i] * w[i]; dY += db[i] * w[i] * P[i][1]; dW += db[i] * w[i]; }
  const x = X / W, y = Y / W;
  return { p: [x, y], g: x * x * ((dY - y * dW) / W) / 2 };
}
// A cubic Bézier close to it: poles (1,0), (1,κ), (κ,1), (0,1). Its g is a polynomial of degree 8.
const KAPPA = 0.5523;
function cubic(t) {
  const P = [[1, 0], [1, KAPPA], [KAPPA, 1], [0, 1]], b = [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], db = [-3 * (1 - t) ** 2, 3 * (1 - t) ** 2 - 6 * t * (1 - t), 6 * t * (1 - t) - 3 * t * t, 3 * t * t];
  let x = 0, y = 0, yd = 0; for (let i = 0; i < 4; i++) { x += b[i] * P[i][0]; y += b[i] * P[i][1]; yd += db[i] * P[i][1]; }
  return { p: [x, y], g: x * x * yd / 2 };
}
const sum = (f, n) => RULES[n].x.reduce((a, x, i) => a + RULES[n].w[i] * f(x).g, 0);
const EXACT = { arc: 1 / 3, cubic: sum(cubic, 20) };
const ERR = { arc: [], cubic: [] };
for (let n = 1; n <= 12; n++) { ERR.arc.push(sum(arc, n) - EXACT.arc); ERR.cubic.push(sum(cubic, n) - EXACT.cubic); }
const err12 = Math.abs(ERR.arc[11]);
/** A small number as m × 10ⁿ. */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sci = v => { const [m, e] = Math.abs(v).toExponential(1).split('e'); return `${v < 0 ? '−' : ''}${m} × 10${String(+e).split('').map(c => SUP[c]).join('')}`; };
const exactAt = ERR.cubic.findIndex(e => Math.abs(e) < 1e-15) + 1;

// The plot: t across 30 → 230, g up from 200; the error chart at the right on a log scale.
const PX = t => 30 + 200 * t, PY = g => 200 - 150 * g;
const EX = n => 262 + (n - 1) * 9.5, EY = e => 70 + 7.6 * Math.min(17, -Math.log10(Math.max(1e-17, Math.abs(e))));
const curve = f => Array.from({ length: 121 }, (_, i) => [PX(i / 120), PY(f(i / 120).g)]);
const CURVES = { arc: curve(arc), cubic: curve(cubic) };
// The quarter circle drawn small, its control polygon dashed.
const IX = x => 165 + 50 * x, IY = y => 128 - 50 * y;
const insetArc = Array.from({ length: 41 }, (_, i) => arc(i / 40).p).map(p => `${IX(p[0])},${IY(p[1])}`).join(' ');
const insetCubic = Array.from({ length: 41 }, (_, i) => cubic(i / 40).p).map(p => `${IX(p[0])},${IY(p[1])}`).join(' ');

// A whole bicubic patch: knot lines at u = 1/3, 2/3 and v = 1/2; ⌈5p/2⌉ = 8 points a direction in each span.
const DX = u => 40 + 180 * u, DY = v => 220 - 180 * v;
const KU = [0, 1 / 3, 2 / 3, 1], KV = [0, 0.5, 1], G8 = RULES[8];
const CELLS = [];
for (let a = 0; a + 1 < KU.length; a++) for (let b = 0; b + 1 < KV.length; b++) {
  const dots = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) dots.push({ u: KU[a] + (KU[a + 1] - KU[a]) * G8.x[i], v: KV[b] + (KV[b + 1] - KV[b]) * G8.x[j], r: 9 * Math.sqrt(G8.w[i] * G8.w[j]) });
  CELLS.push(dots);
}
// A trimmed face: the quarter disc u² + v² ≤ 1 of the domain, its trim cut in 4 chords and fanned from the corner (as a
// display tessellation might), each triangle cut along knot lines u = ½ and v = ½ and given Dunavant's 16 points.
const RULE = (() => {
  const out = [[1 / 3, 1 / 3, 1 / 3]];
  const orbit = a => { const b = (1 - a) / 2; out.push([a, b, b], [b, a, b], [b, b, a]); };
  orbit(0.081414823414554); orbit(0.658861384496480); orbit(0.898905543365938);
  const six = (a, b) => { const c = 1 - a - b; out.push([a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]); };
  six(0.008394777409958, 0.263112829634638);
  return out;
})();
const TRIM = Array.from({ length: 5 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
const TRIS = [0, 1, 2, 3].map(i => [[0, 0], TRIM[i], TRIM[i + 1]]);
function cutPolygon(P, axis, k) {
  const below = [], above = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], da = a[axis] - k, db = b[axis] - k;
    if (da <= 0) below.push(a);
    if (da >= 0) above.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db), x = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; below.push(x); above.push(x); }
  }
  return [below, above];
}
function cutAlong(pieces, axis, k) {
  const next = [];
  for (const P of pieces) {
    const lo = Math.min(...P.map(q => q[axis])), hi = Math.max(...P.map(q => q[axis]));
    if (!(k > lo && k < hi)) { next.push(P); continue; }
    for (const part of cutPolygon(P, axis, k)) if (part.length >= 3) next.push(part);
  }
  return next;
}
const PIECES = TRIS.flatMap(t => cutAlong(cutAlong([t], 0, 0.5), 1, 0.5));
const SUBTRIS = PIECES.flatMap(P => P.slice(1, -1).map((_, i) => [P[0], P[i + 1], P[i + 2]]));
const TRI_DOTS = SUBTRIS.map(([a, b, c]) => RULE.map(([wa, wb, wc]) => [wa * a[0] + wb * b[0] + wc * c[0], wa * a[1] + wb * b[1] + wc * c[1]]));
// The strips between each chord and its arc: ruled from the chord to the trim, 8 Gauss points along, 4 across.
const G4 = RULES[4];
const STRIP_DOTS = [0, 1, 2, 3].flatMap(i => G8.x.flatMap(t => {
  const p = TRIM[i], q = TRIM[i + 1], L = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], a = (i + t) * Math.PI / 8, C = [Math.cos(a), Math.sin(a)];
  return G4.x.map(f => [L[0] + f * (C[0] - L[0]), L[1] + f * (C[1] - L[1])]);
}));
const trimArc = Array.from({ length: 41 }, (_, i) => `${DX(Math.cos(i * Math.PI / 80))},${DY(Math.sin(i * Math.PI / 80))}`).join(' ');

const steps = [
  { label: 'One span, one integral', text: 'A face\'s integrals become sums along curves and over (u, v) domains. Take one: the quarter circle as a rational quadratic (weights 1, √2/2, 1), and along it g(t) = ½ x² y′, the integrand Green\'s theorem gives for ∫x dA. Over t from 0 to 1 it is the quarter disc\'s first moment, exactly 1/3.', formula: 'I = ∫₀¹ g(t) dt = ⅓ &nbsp; g = ½ x(t)² y′(t)' },
  { label: 'One point', text: 'Gauss–Legendre replaces the integral by a weighted sum of samples. With one point: the middle, weight 1. Each bar is as wide as its point\'s weight and as high as its sample, so the bars\' area is the sum.', formula: 'I ≈ Σ wᵢ g(tᵢ) &nbsp; n = 1: t = ½, w = 1' },
  { label: 'Two points', text: 'Two points at (1 ∓ 1/√3)/2, weight ½ each. They are not evenly spaced: they sit where the rule integrates every polynomial up to degree 3 exactly.', formula: 'n points: exact for every polynomial of degree ≤ 2n − 1' },
  { label: 'More points', text: `Each point added gains a decade or more here. The integrand is rational, not a polynomial, so no n is exact. The kernel takes 12 points a knot span along a planar face's edges; at n = 12 this error is ${sci(err12)}. Drag n to compare.` },
  { label: 'Polynomials come out exact', text: `A cubic Bézier edge in place of the arc: x² y′ is then a polynomial of degree 3·2 + 2 = 8, and ${exactAt} points (exact to degree 9) integrate it to rounding. A whole patch's count is set the same way: the field is cubic in the point and the area element has degree 2p − 1, so degree p needs ⌈5p/2⌉ points a direction. A rational patch gets 8 more, and no patch more than 20.`, formula: 'n = min(20, ⌈5p/2⌉ + 8 if rational)' },
  { label: 'Where the points come from', text: `The points are the roots of the Legendre polynomial Pₙ, moved from [−1, 1] to [0, 1]. Pₙ is built by its three-term recurrence. The kernel finds each root by Newton\'s method from cos(π(i − ¼)/(n + ½)), a guess within 0.004 of it here (at most ${Math.max(...RULES[5].its.map(p => p.length - 1))} Newton steps), and weighs it 1/((1 − τ²) Pₙ′(τ)²). Here n = 5; the bars show the weights.`, formula: 'Pₖ = ((2k − 1) τ Pₖ₋₁ − (k − 1) Pₖ₋₂) / k &nbsp; τ ← τ − Pₙ(τ) / Pₙ′(τ)' },
  { label: 'A whole patch', text: 'A face that is its whole patch (one loop running round the patch\'s four sides) is integrated over its (u, v) domain directly: a grid of Gauss points in each knot span, the point and its partial derivatives from the basis functions. There is no tessellation, and a polynomial patch comes out exact to rounding. Here a bicubic patch, 8 × 8 points in each of its 6 spans.', formula: '∯ F · n dA = Σ<sub>spans</sub> Σ<sub>i,j</sub> wᵢ wⱼ F(S) · (S<sub>u</sub> × S<sub>v</sub>)' },
  { label: 'A trimmed face', text: 'Any other curved face is integrated over its display triangles, but in its (u, v) domain: every point is mapped through the surface itself, so the mesh\'s chord error never enters. Each triangle is first cut along the knot lines (the rule must not straddle a span\'s break) and takes Dunavant\'s 16-point rule (degree 8). The thin strip between a chord and the trim it stands for is ruled from one to the other and integrated with 8 × 4 Gauss points.', formula: 'triangle: 16 points · its (u, v) area &nbsp; strip: Φ(t, s) = L(t) + s (C(t) − L(t)), 8 × 4 points' },
];
const s = useSteps(steps.length, [2800, 2200, 2200, 5200, 3600, 3400, 3400, 4600], root);
const k = computed(() => ease(s.t.value));
const manual = ref(null);
watch(() => s.step.value, () => { manual.value = null; });
const kind = computed(() => s.step.value === 4 ? 'cubic' : 'arc');
const F = computed(() => kind.value === 'cubic' ? cubic : arc);
const autoN = computed(() => [0, 1, 2, 3 + Math.min(9, Math.floor(s.t.value * 9.999)), 1 + Math.min(11, Math.floor(s.t.value * 11.999)), 5][s.step.value] ?? 5);
const n = computed(() => manual.value ?? autoN.value);
const showBars = computed(() => s.step.value >= 1 && s.step.value <= 5);
const bars = computed(() => {
  if (!showBars.value || n.value < 1) return [];
  const R = RULES[n.value], out = []; let left = 0;
  for (let i = 0; i < n.value; i++) { const g = s.step.value === 5 ? 1.4 * R.w[i] : F.value(R.x[i]).g; out.push({ x0: PX(left), w: 200 * R.w[i], y: PY(Math.max(0, g)), h: 150 * Math.max(0, g), cx: PX(R.x[i]), cy: PY(g) }); left += R.w[i]; }
  return out;
});
const estimate = computed(() => n.value >= 1 ? sum(F.value, n.value) : 0);
const error = computed(() => estimate.value - EXACT[kind.value]);
const drawn = computed(() => { const c = CURVES[kind.value], m = s.step.value === 0 ? Math.max(1, Math.round(k.value * 120)) : 120; return c.slice(0, m + 1).map(q => q.join(',')).join(' '); });
const insetDot = computed(() => { const p = F.value(s.step.value === 0 ? k.value : 0.5).p; return [IX(p[0]), IY(p[1])]; });
// The error dots shown so far: the arc's up to its n in steps 2–4, the cubic's in step 4.
const errDots = computed(() => {
  const st = s.step.value, out = [];
  if (st >= 1 && st <= 4) { const upto = st === 4 ? 12 : n.value; ERR.arc.slice(0, upto).forEach((e, i) => out.push({ x: EX(i + 1), y: EY(e), kind: 'arc' })); }
  if (st === 4) ERR.cubic.slice(0, n.value).forEach((e, i) => out.push({ x: EX(i + 1), y: EY(e), kind: 'cubic' }));
  return out;
});
// Step 6: P₁ … P₅ by the recurrence (τ = 1 − 2t, so that τ's roots land on the points t), then the roots.
const LEGENDRE = [1, 2, 3, 4, 5].map(n => { const out = []; for (let i = 0; i <= 120; i++) { const t = 1 - 2 * (i / 120); let p0 = 1, p1 = t; for (let j = 2; j <= n; j++) { const p2 = ((2 * j - 1) * t * p1 - (j - 1) * p0) / j; p0 = p1; p1 = p2; } out.push(`${PX(i / 120)},${(160 - 36 * p1).toFixed(2)}`); } return out.join(' '); });
const legendreShown = computed(() => Math.min(5, 1 + Math.floor(k.value * 5.999)));
const cellsShown = computed(() => s.step.value === 6 ? Math.min(CELLS.length, Math.floor(k.value * CELLS.length + 0.999)) : CELLS.length);
const phase = computed(() => s.step.value === 7 ? k.value : 1);
const triShown = computed(() => Math.min(TRI_DOTS.length, Math.floor(Math.max(0, (phase.value - 0.45) / 0.3) * TRI_DOTS.length + 0.999)));
const tri = q => q.map(p => `${DX(p[0])},${DY(p[1])}`).join(' ');
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Gauss–Legendre: a span, then a patch, then a trimmed face" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="Gauss–Legendre points and weights on a span converging to the integral, then over a patch's knot spans and a trimmed face's triangles">
        <g v-if="s.step.value <= 5">
          <line :x1="PX(0)" :y1="PY(0)" :x2="PX(1)" :y2="PY(0)" class="axis" />
          <text :x="PX(0)" :y="PY(0) + 14" class="tick" text-anchor="middle">0</text><text :x="PX(1)" :y="PY(0) + 14" class="tick" text-anchor="middle">1</text>
          <text :x="PX(0.5)" :y="PY(0) + 14" class="tick" text-anchor="middle">t</text>
          <rect v-for="(b, i) in bars" :key="'b' + i" :x="b.x0" :y="b.y" :width="Math.max(0, b.w)" :height="Math.max(0, b.h)" class="bar" />
          <polyline v-if="s.step.value !== 5" :points="drawn" class="curve" />
          <circle v-for="(b, i) in (s.step.value === 5 ? [] : bars)" :key="'n' + i" :cx="b.cx" :cy="b.cy" r="2.8" class="node" />
          <g v-if="s.step.value === 5">
            <line :x1="PX(0)" y1="160" :x2="PX(1)" y2="160" class="axis dash" />
            <polyline v-for="(d, i) in LEGENDRE.slice(0, legendreShown)" :key="'l' + i" :points="d" :class="['legendre', i + 1 === legendreShown ? 'now' : '']" />
            <circle v-for="(x, i) in (legendreShown === 5 ? RULES[5].x : [])" :key="'r' + i" :cx="PX(x)" cy="160" r="3.2" class="node" />
            <text :x="PX(1) + 4" y="150" class="tag">P{{ ['₁', '₂', '₃', '₄', '₅'][legendreShown - 1] }}</text>
          </g>
          <g v-if="s.step.value <= 4">
            <polyline :points="kind === 'cubic' ? insetCubic : insetArc" class="inset" />
            <polyline :points="kind === 'cubic' ? `${IX(1)},${IY(0)} ${IX(1)},${IY(KAPPA)} ${IX(KAPPA)},${IY(1)} ${IX(0)},${IY(1)}` : `${IX(1)},${IY(0)} ${IX(1)},${IY(1)} ${IX(0)},${IY(1)}`" class="poly" />
            <circle :cx="insetDot[0]" :cy="insetDot[1]" r="2.6" class="node" />
          </g>
          <text x="30" y="24" class="readout strong">{{ s.step.value === 0 ? 'g(t) = ½ x² y′' : s.step.value === 5 ? 'n = 5: roots of P₅' : `n = ${n}: Σ wᵢ g(tᵢ) = ${estimate.toFixed(10)}` }}</text>
          <text x="30" y="40" class="readout">{{ s.step.value === 0 || s.step.value === 5 ? (kind === 'cubic' ? 'cubic Bézier' : 'exact: 1/3 = 0.3333333333') : `error ${Math.abs(error) < 1e-15 ? 'at rounding' : sci(error)}` }}</text>
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 4">
          <line :x1="EX(1)" :y1="EY(1)" :x2="EX(1)" :y2="EY(1e-17)" class="axis" />
          <g v-for="d in [0, 5, 10, 15]" :key="'g' + d">
            <line :x1="EX(1)" :x2="EX(12)" :y1="EY(10 ** -d)" :y2="EY(10 ** -d)" class="grid" />
            <text :x="EX(1) - 3" :y="EY(10 ** -d) + 3" class="tick" text-anchor="end">{{ d ? '10' : '1' }}<tspan v-if="d" dy="-4" font-size="7">−{{ d }}</tspan></text>
          </g>
          <text :x="EX(6.5)" :y="EY(1e-17) + 14" class="tick" text-anchor="middle">n = 1 … 12</text>
          <text :x="EX(6.5)" :y="EY(1) - 8" class="tick" text-anchor="middle">|error|</text>
          <circle v-for="(d, i) in errDots" :key="'e' + i" :cx="d.x" :cy="d.y" r="2.4" :class="['err', d.kind]" />
        </g>
        <g v-if="s.step.value >= 6">
          <rect :x="DX(0)" :y="DY(1)" width="180" height="180" class="domain" />
          <text :x="DX(0.5)" :y="DY(0) + 14" class="tick" text-anchor="middle">u</text><text :x="DX(0) - 8" :y="DY(0.5)" class="tick" text-anchor="middle">v</text>
        </g>
        <g v-if="s.step.value === 6">
          <line v-for="u in KU.slice(1, -1)" :key="'ku' + u" :x1="DX(u)" :x2="DX(u)" :y1="DY(0)" :y2="DY(1)" class="knot" />
          <line v-for="v in KV.slice(1, -1)" :key="'kv' + v" :y1="DY(v)" :y2="DY(v)" :x1="DX(0)" :x2="DX(1)" class="knot" />
          <g v-for="(cell, c) in CELLS.slice(0, cellsShown)" :key="'c' + c">
            <circle v-for="(d, i) in cell" :key="i" :cx="DX(d.u)" :cy="DY(d.v)" :r="d.r" class="gp" />
          </g>
          <text x="240" y="70" class="readout strong">bicubic: p = 3</text>
          <text x="240" y="88" class="readout">⌈5p/2⌉ = 8 points</text>
          <text x="240" y="104" class="readout">a direction, a span</text>
          <text x="240" y="128" class="readout">dot size ∝ √(wᵢ wⱼ)</text>
        </g>
        <g v-if="s.step.value === 7">
          <polygon :points="tri([[0, 0], ...TRIM])" class="face" />
          <polyline :points="trimArc" class="trim" />
          <polygon v-for="(t, i) in TRIS" v-show="phase > 0.05 + 0.08 * i" :key="'t' + i" :points="tri(t)" class="mesh" />
          <g v-if="phase > 0.3">
            <line :x1="DX(0.5)" :x2="DX(0.5)" :y1="DY(0)" :y2="DY(1)" class="knot" /><line :y1="DY(0.5)" :y2="DY(0.5)" :x1="DX(0)" :x2="DX(1)" class="knot" />
            <polygon v-for="(t, i) in SUBTRIS" :key="'p' + i" :points="tri(t)" class="sub" />
          </g>
          <g v-for="(dots, i) in TRI_DOTS.slice(0, triShown)" :key="'d' + i">
            <circle v-for="(p, j) in dots" :key="j" :cx="DX(p[0])" :cy="DY(p[1])" r="1.3" class="gp" />
          </g>
          <circle v-for="(p, j) in (phase > 0.8 ? STRIP_DOTS : [])" :key="'s' + j" :cx="DX(p[0])" :cy="DY(p[1])" r="1.3" class="strip" />
          <text x="240" y="70" class="readout strong">{{ TRIS.length }} triangles → {{ SUBTRIS.length }}</text>
          <text x="240" y="88" class="readout">cut at u = ½, v = ½</text>
          <text x="240" y="104" class="readout">16 points each</text>
          <text x="240" y="128" class="readout keep">strips: 8 × 4</text>
        </g>
      </svg>
      <div v-if="s.step.value >= 1 && s.step.value <= 4" class="ops">
        <label>points n <input type="range" min="1" max="12" step="1" :value="n" aria-label="Number of Gauss points" @input="manual = +$event.target.value" /> {{ n }}</label>
        <span>blue: quarter circle (rational) · orange: cubic Bézier</span>
      </div>
      <template #note>Nodes and weights computed in the page as the kernel's gauss(n) computes them, and the sums taken on
        these two curves. The patch and the trimmed face are illustrations: in the kernel the domain triangles come from the
        face's display tessellation, and the knot lines are the surface's own.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; } .axis.dash { stroke-dasharray: 3 2; }
.grid { stroke: var(--vp-c-divider); stroke-width: 0.8; }
.tick { font-size: 10px; }
.tag { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.bar { fill: color-mix(in srgb, var(--a) 22%, transparent); stroke: var(--a); stroke-width: 0.8; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.8; stroke-linejoin: round; }
.legendre { fill: none; stroke: var(--b); stroke-width: 0.9; opacity: 0.45; } .legendre.now { stroke-width: 1.8; opacity: 1; }
.node { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.8; }
.inset { fill: none; stroke: var(--a); stroke-width: 2; }
.poly { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 2; }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-2); } .readout.strong { fill: var(--vp-c-text-1); } .readout.keep { fill: var(--keep); }
.err.arc { fill: var(--a); } .err.cubic { fill: var(--b); }
.domain { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 1; }
.knot { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 4 3; }
.gp { fill: var(--hot); }
.face { fill: color-mix(in srgb, var(--a) 14%, transparent); stroke: none; }
.trim { fill: none; stroke: var(--a); stroke-width: 2.2; }
.mesh { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.sub { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.7; }
.strip { fill: var(--keep); }
.ops { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops label { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ops span { color: var(--vp-c-text-2); }
</style>
