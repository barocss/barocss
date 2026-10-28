<script setup>
// Two crossings that merge into a tangent, solved as the kernel does it: the degree-2 solver of
// packages/barocss-cad/src/intersect/own-homogeneous-bernstein-roots.ts and the cubic one of own-cubic-bernstein-roots.ts,
// ported here (the ports return the kernel's roots bit for bit on 3000 random cases each) and run live on the curve shown.
// The outcomes named in the steps were also read from the built kernel's intersectBezierCurveWithAffinePlaneSurface and
// intersectCubicBezierCurveWithAffinePlaneSurface on these curves against the plane z = 0.
import { computed, nextTick, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const EPS = Number.EPSILON;
function bern(c, t) {
  let row = c.slice();
  for (let d = row.length - 1; d > 0; d--) { const p = row; row = p.slice(0, d).map((l, i) => (1 - t) * l + t * p[i + 1]); }
  return row[0];
}
/** The kernel's degree-2 solver. Returns the roots, or a refusal, with the discriminant it tested. */
function quadratic(v, width = 1e-12) {
  const [f0, f1, f2] = v, fN = f2, a = f0 - 2 * f1 + f2, b = 2 * (f1 - f0);
  const bb = b * b, ac = 4 * a * f0, disc = bb - ac, unc = 32 * EPS * (Math.abs(bb) + Math.abs(ac));
  const out = { disc, unc, roots: [], refused: false, hull: false };
  if (v.every(x => x > 0) || v.every(x => x < 0)) { out.hull = true; return out; }
  if (a === 0 && b === 0) return out;
  const measure = t => { const s = 1 - t; return f0 * s * s + 2 * f1 * s * t + f2 * t * t; };
  if (a !== 0 && f0 !== 0 && fN !== 0) { if (disc < -unc) return out; if (!(disc > unc)) { out.refused = true; return out; } }
  const vertex = a !== 0 ? -b / (2 * a) : NaN, cuts = [0, ...(vertex > 0 && vertex < 1 ? [vertex] : []), 1];
  if (f0 === 0) out.roots.push({ t: 0, touch: f1 === 0, end: true });
  for (let k = 0; k + 1 < cuts.length; k++) {
    let lo = cuts[k], hi = cuts[k + 1]; const fl = lo === 0 ? f0 : measure(lo), fh = hi === 1 ? fN : measure(hi);
    if (fl === 0 || fh === 0 || Math.sign(fl) === Math.sign(fh)) continue;
    let it = 0;
    while (hi - lo > width && it < 64) { const mid = lo + (hi - lo) / 2, fm = measure(mid); if (fm === 0) { const l = lo + (mid - lo) / 2, r = mid + (hi - mid) / 2; lo = l; hi = r; } else if (Math.sign(fm) === Math.sign(fl)) lo = mid; else hi = mid; it++; }
    out.roots.push({ t: lo + (hi - lo) / 2, bracket: [lo, hi], touch: false });
  }
  if (fN === 0) out.roots.push({ t: 1, touch: f1 === 0, end: true });
  return out;
}
/** The kernel's test at a cubic's turning point: |f| must exceed L × the bracket's radius plus the guard. */
function cubicTurn(c) {
  const scale = Math.max(...c.map(Math.abs)), n = c.map(x => x / scale), der = [0, 1, 2].map(i => 3 * (n[i + 1] - n[i]));
  const guard = 64 * EPS * Math.max(1, ...n.map(Math.abs)), L = Math.max(...der.map(Math.abs)), lip = L + guard * Math.max(1, L);
  const r = quadratic(der).roots.find(x => x.t > 0 && x.t < 1);
  const radius = Math.max(r.t - r.bracket[0], r.bracket[1] - r.t), value = bern(n, r.t);
  return { t: r.t, value, margin: lip * radius + guard, L, refused: !(Math.abs(value) > lip * radius + guard) };
}
// The tangent cubic is the parabola (2t − 1)² raised to degree 3: the same curve, four control points.
const CUBIC = [1, -1 / 3, -1 / 3, 1], TURN = cubicTurn(CUBIC);

const root = ref(null);
// Curve control points at x = −8, 0, 8 mm (−8, −8/3, 8/3, 8 for the cubic), heights z in mm; x = −8 + 16 t.
const X = t => 62 + 256 * t, Y = z => 118 - 40 * z;
const sup = e => String(e).replace('-', '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
const sci = x => { if (x === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(x))); return `${(x / 10 ** e).toFixed(1)}·10${sup(e)}`; };
const fx = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);

const steps = [
  { label: 'Two crossings', text: 'A quadratic curve whose middle control point is 3 mm below the plane, the ends 1 mm above. Its distance polynomial has coefficients (1, −k, 1) with k = 3. After the hull test, the degree-2 solver writes it in powers of t and looks at the discriminant: positive, so two roots, which it isolates by splitting at the parabola\'s vertex and halving each side.', formula: 'f = a t² + b t + c, &nbsp; a = c₀ − 2c₁ + c₂, &nbsp; b = 2(c₁ − c₀), &nbsp; c = c₀; &nbsp; here b² − 4ac = 4(1 + k)(k − 1)' },
  { label: 'Raise the middle control point', text: 'As k falls the two crossings move together and the discriminant shrinks. They stay two separate roots, each in its own bracket, as long as the discriminant is clearly positive. Drag the slider to try other heights; the solver runs on each.', formula: 'refused when |b² − 4ac| ≤ 32 ε (|b²| + |4ac|)' },
  { label: 'Touching: refused', text: 'At k = 1 the curve touches the plane at t = 0.5: one double root. In binary64 a tiny error in the coefficients decides whether that is two crossings, a touch or a miss, so the kernel does not guess. A discriminant inside its uncertainty band refuses the whole intersection.', formula: 'k = 1: b² − 4ac = 0 &nbsp; → "unresolved interior tangent/discriminant ambiguity"' },
  { label: 'Clear of the plane, though the signs change', text: 'Raised a little further, the curve misses the plane: the discriminant is clearly negative and there is no root, a support-disjoint result. The coefficients (1, −0.9, 1) still change sign twice: the number of sign changes bounds the roots from above, it does not count them.', formula: 'k = 0.9: b² − 4ac = −0.76 &lt; −2.1·10⁻¹³ &nbsp; → no root' },
  { label: 'Touching at an end', text: 'A zero coefficient at either end is an exact root there: B<sub>0</sub>(0) = 1 and every other basis function is 0 at t = 0. If the next coefficient is also zero, the curve leaves the plane tangentially; the root is reported as an endpoint event with its touch flag set, not refused.', formula: 'c = (0, 0, 1): root t = 0, touch (c₁ = 0) &nbsp; c = (0, 1, −1): t = 0 and a crossing at t = 0.6667' },
  { label: 'A cubic that touches', text: `The cubic solver meets the same tangent at a turning point. Its derivative's root is t = ${num(TURN.t, 6)}; there |f| = ${sci(Math.abs(TURN.value))}, not more than L × r + 64 ε = ${sci(TURN.margin)}. The bracket could hide a root, so the kernel refuses. With the two middle control points 10⁻³ mm lower, two crossings are found (t = 0.4863, 0.5137); 10⁻¹¹ mm lower, the halving meets midpoints within the guard of zero and is refused too.`, formula: '|f(t<sub>c</sub>)| ≤ L r + 64 ε &nbsp; → "critical bracket root/tangent cannot be excluded"' },
];
const s = useSteps(steps.length, [2600, 4200, 2600, 2800, 2800, 3000], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);
// The slider: a height the reader chose holds until the step changes.
const kUser = ref(2), held = ref(false);
watch(() => s.step.value, () => { held.value = false; });
function drag(e) {
  const v = +e.target.value; s.pause();
  if (st.value > 3) { s.go(1); s.pause(); nextTick(() => { kUser.value = v; held.value = true; }); }
  else { kUser.value = v; held.value = true; }
}
const kStep = computed(() => [3, 3 - 1.95 * k.value, k.value >= 1 ? 1 : 1.05 - 0.05 * k.value, k.value >= 1 ? 0.9 : 1 - 0.1 * k.value][st.value] ?? 0.9);
const kNow = computed(() => (held.value && st.value <= 3 ? kUser.value : kStep.value));
const quad = computed(() => {
  if (st.value === 4) { const u = k.value; return [1 - u, -0.9 * (1 - u), 1]; }
  return [1, -kNow.value, 1];
});
const cubic = computed(() => st.value === 5);
const coeffs = computed(() => (cubic.value ? CUBIC : quad.value));
const solved = computed(() => quadratic(quad.value));
const N = 80;
const curve = computed(() => Array.from({ length: N + 1 }, (_, i) => `${X(i / N).toFixed(2)},${Y(bern(coeffs.value, i / N)).toFixed(2)}`).join(' '));
const poles = computed(() => coeffs.value.map((c, i, all) => [X(i / (all.length - 1)), Y(c)]));
const signChanges = computed(() => { const nz = coeffs.value.filter(c => c !== 0); let n = 0; for (let i = 1; i < nz.length; i++) if (Math.sign(nz[i]) !== Math.sign(nz[i - 1])) n++; return n; });
const verdict = computed(() => {
  if (cubic.value) return { cls: 'hot', text: 'refused: a root may hide at t = 0.5' };
  const r = solved.value;
  if (r.refused) return { cls: 'hot', text: 'refused: interior tangent' };
  if (!r.roots.length) return { cls: 'mute', text: r.hull ? 'no root: all coefficients one sign' : 'no root: b² − 4ac < 0' };
  return { cls: 'keep', text: r.roots.map(x => (x.end ? `t = ${x.t}${x.touch ? ' (end, touch)' : ' (end)'}` : `t = ${x.t.toFixed(4)}`)).join(', ') };
});
const lines = computed(() => {
  if (cubic.value) return ['c = (1, −1/3, −1/3, 1)', `turning point t = ${num(TURN.t, 4)}, L = ${num(TURN.L, 2)}`, `|f| = ${sci(Math.abs(TURN.value))} ≤ ${sci(TURN.margin)}`];
  const c = quad.value, r = solved.value;
  return [`c = (${c.map(x => fx(x + 0, 2)).join(', ')})`, `b² − 4ac = ${Math.abs(r.disc) < 1e-9 ? fx(r.disc, 0) : fx(r.disc, 3)}  (band ±${sci(r.unc)})`, `${signChanges.value} sign change${signChanges.value === 1 ? '' : 's'}`];
});
const marks = computed(() => (cubic.value || solved.value.refused ? [] : solved.value.roots.map(x => X(x.t))));
const touchAt = computed(() => (cubic.value || solved.value.refused ? X(0.5) : null));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="When two crossings merge: tangents are refused" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A curve over a plane seen edge on, lifted until its two crossings merge into a tangent">
        <text v-for="(l, i) in lines" :key="'l' + i" x="12" :y="18 + 14 * i" class="readout" :class="{ first: i === 0 }">{{ l }}</text>
        <text x="12" y="62" :class="['verdict', verdict.cls]">{{ verdict.text }}</text>
        <rect x="30" y="115" width="320" height="6" class="plane" />
        <text x="346" y="136" class="name a" text-anchor="end">plane z = 0</text>
        <polyline :points="poles.map(p => p.join(',')).join(' ')" class="polygon" />
        <polyline :points="curve" class="curve" :class="{ bad: verdict.cls === 'hot' }" />
        <g v-for="(p, i) in poles" :key="'p' + i">
          <circle :cx="p[0]" :cy="p[1]" r="4.2" :class="['pole', coeffs[i] > 0 ? 'pos' : coeffs[i] < 0 ? 'neg' : 'zero']" />
          <text :x="p[0]" :y="p[1] + 3.5" class="sign" text-anchor="middle">{{ coeffs[i] > 0 ? '+' : coeffs[i] < 0 ? '−' : '0' }}</text>
        </g>
        <circle v-for="(x, i) in marks" :key="'r' + i" :cx="x" cy="118" r="4.5" class="root" />
        <g v-if="touchAt !== null">
          <circle :cx="touchAt" cy="118" r="9" class="refuse" />
          <text :x="touchAt" y="104" class="refuse-tag" text-anchor="middle">?</text>
        </g>
      </svg>
      <div class="controls">
        <label>middle point z <input type="range" min="0.5" max="3" step="0.01" :value="kNow" aria-label="Depth k of the middle control point below the plane" @input="drag"> <span>{{ fx(-kNow, 2) }} mm</span></label>
      </div>
      <template #note>Computed live in the page with ports of the kernel's degree-2 and degree-3 root solvers, on the
        curve drawn (control points at x = −8, 0, 8 mm, all weights 1). The kernel's results for k = 3, 1 and 0.9, for
        (0, 0, 1) and for the cubic were also read from the built kernel on the same curves. Exactly k = 1.00 on the
        slider is refused; k = 1.01 still gives two roots, t = 0.4647 and 0.5353.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout { font-size: 11px; } .readout.first { font-weight: 600; fill: var(--vp-c-text-1); }
.verdict { font-size: 12px; font-weight: 700; } .verdict.keep { fill: var(--keep); } .verdict.hot { fill: var(--hot); } .verdict.mute { fill: var(--vp-c-text-2); }
.plane { fill: var(--a); fill-opacity: 0.22; stroke: var(--a); stroke-width: 1; }
.name { font-weight: 700; font-size: 11px; } .name.a { fill: var(--a); }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 4 3; }
.curve { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.4; stroke-linejoin: round; } .curve.bad { stroke: var(--hot); }
.pole { stroke-width: 1.4; } .pole.pos { fill: var(--keep); stroke: var(--keep); } .pole.neg { fill: var(--hot); stroke: var(--hot); } .pole.zero { fill: var(--vp-c-text-3); stroke: var(--vp-c-text-3); }
.sign { font-size: 9px; font-weight: 700; fill: var(--vp-c-white); }
.root { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.refuse { fill: none; stroke: var(--hot); stroke-width: 2; stroke-dasharray: 3 2; }
.refuse-tag { fill: var(--hot); font-weight: 700; font-size: 12px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 160px; }
label span { min-width: 72px; font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
