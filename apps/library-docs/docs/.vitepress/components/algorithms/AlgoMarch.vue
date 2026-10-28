<script setup>
// Surface–surface marching (packages/barocss-cad/src/intersect/surface-intersection.ts) on two crossing cylinders.
// The predictor and the Newton corrector below are the kernel's: F = S_A(a) − S_B(b) plus the plane row n·(S_A − o),
// solved by minimum-norm least squares over the four parameters. Run here, in the page, on these two cylinders.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const RA = 4, RB = 2.5;
// A: x² + y² = 16, parameters (θ, z). B: y² + z² = 6.25, parameters (φ, x).
const SA = ([th, z]) => [RA * Math.cos(th), RA * Math.sin(th), z];
const SB = ([ph, x]) => [x, RB * Math.cos(ph), RB * Math.sin(ph)];
const dA = ([th]) => ({ du: [-RA * Math.sin(th), RA * Math.cos(th), 0], dv: [0, 0, 1] });
const dB = ([ph]) => ({ du: [0, -RB * Math.sin(ph), RB * Math.cos(ph)], dv: [1, 0, 0] });
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
const nA = a => unit(cross(dA(a).du, dA(a).dv)), nB = b => unit(cross(dB(b).du, dB(b).dv));
function solve(M, r) {
  const n = r.length, A = M.map((row, i) => [...row, r[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    [A[c], A[p]] = [A[p], A[c]];
    for (let i = c + 1; i < n; i++) { const f = A[i][c] / A[c][c]; for (let k = c; k <= n; k++) A[i][k] -= f * A[c][k]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let v = A[i][n]; for (let k = i + 1; k < n; k++) v -= A[i][k] * x[k]; x[i] = v / A[i][i]; }
  return x;
}
/** Newton iterates from (a, b), optionally held to the plane through o normal to n. */
function newton(a, b, plane, its = 6) {
  const out = [{ a, b, x: SA(a), y: SB(b) }];
  for (let it = 0; it < its; it++) {
    const ja = dA(a), jb = dB(b), F = sub(SA(a), SB(b));
    const rows = [0, 1, 2].map(i => [ja.du[i], ja.dv[i], -jb.du[i], -jb.dv[i], -F[i]]);
    if (plane) rows.push([dot(plane.n, ja.du), dot(plane.n, ja.dv), 0, 0, -dot(plane.n, sub(SA(a), plane.o))]);
    const JJ = rows.map(r => rows.map(q => r[0] * q[0] + r[1] * q[1] + r[2] * q[2] + r[3] * q[3])), y = solve(JJ, rows.map(r => r[4]));
    const step = [0, 1, 2, 3].map(j => rows.reduce((acc, r, i) => acc + r[j] * y[i], 0));
    a = [a[0] + step[0], a[1] + step[1]]; b = [b[0] + step[2], b[1] + step[3]];
    out.push({ a, b, x: SA(a), y: SB(b) });
    if (Math.hypot(...step) < 1e-13) break;
  }
  return out;
}
// A seed off the curve (as a pair of coarse triangles would give it), refined onto both.
const seedA = [0.55, 1.9], seedB = [0.95, 3.3];
const refine = newton(seedA, seedB);
const start = refine.at(-1), H = 0.9;
// The march: predictor along n_A × n_B, corrector held to the plane through the guess, normal to t.
const march = [];
{
  let a = start.a, b = start.b;
  for (let k = 0; k < 40; k++) {
    const x = SA(a), t = unit(cross(nA(a), nB(b))), guess = x.map((v, i) => v + H * t[i]);
    const its = newton(a, b, { o: guess, n: t });
    march.push({ x, t, guess, its });
    a = its.at(-1).a; b = its.at(-1).b;
    if (k > 3 && Math.hypot(...sub(SA(a), SA(start.a))) < 0.75 * H) { march.push({ x: SA(a), closed: true }); break; }
  }
}
// The view: turned 40° about z, tilted 22°.
const yaw = 40 * Math.PI / 180, pitch = 22 * Math.PI / 180;
const view = p => { const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [190 + 30 * x1, 128 - 30 * (y1 * Math.sin(pitch) + p[2] * Math.cos(pitch))]; };
const poly = ps => ps.map(view).map(q => q.join(',')).join(' ');
const ring = (f, n = 48) => Array.from({ length: n + 1 }, (_, i) => f(2 * Math.PI * i / n));
const wireA = [-3.4, 0, 3.4].map(z => poly(ring(th => SA([th, z]))));
const wireB = [-5, 0, 5].map(x => poly(ring(ph => SB([ph, x]))));
const ruleA = [0, 1, 2, 3, 4, 5].map(i => poly([SA([i * Math.PI / 3, -3.4]), SA([i * Math.PI / 3, 3.4])]));
const ruleB = [0, 1, 2, 3, 4, 5].map(i => poly([SB([i * Math.PI / 3, -5]), SB([i * Math.PI / 3, 5])]));

const steps = [
  { label: 'Seed from coarse grids', text: 'Both surfaces are cut into coarse triangle grids. A pair of triangles that cross gives a starting point near the curve, on each surface\'s own parameters: (θ, z) on A, (φ, x) on B.', formula: 'A: S<sub>A</sub>(θ, z) = (4 cos θ, 4 sin θ, z) &nbsp; B: S<sub>B</sub>(φ, x) = (x, 2.5 cos φ, 2.5 sin φ)' },
  { label: 'Refine onto both surfaces', text: `Newton's method moves the two parameter pairs until the two surface points coincide. Three equations, four unknowns: the step is the smallest one that solves the linearised system. Here the gap goes ${refine.slice(0, 4).map(r => num(Math.hypot(...sub(r.x, r.y)), 4)).join(' → ')} … in ${refine.length - 1} iterations.`, formula: 'F(a, b) = S<sub>A</sub>(a) − S<sub>B</sub>(b) = 0<br>Δ = Jᵀ (J Jᵀ)⁻¹ (−F), &nbsp; J = ∂F/∂(a, b)' },
  { label: 'Predict along the tangent', text: 'The curve runs along both surfaces at once, so its direction is square to both normals. A step of length h along it lands a little off the curve.', formula: 't = (n<sub>A</sub> × n<sub>B</sub>) / ‖n<sub>A</sub> × n<sub>B</sub>‖ &nbsp; x̃ = x + h t' },
  { label: 'Correct back onto the curve', text: `Newton again, now with a fourth row that holds the point to the plane through x̃ square to t, so it cannot slide back along the curve. If it does not land within one step's length, h is halved (up to six times).`, formula: 'F = 0 &nbsp;and&nbsp; t · (S<sub>A</sub>(a) − x̃) = 0 &nbsp;(4 × 4)' },
  { label: 'Repeat both ways', text: `Predict and correct again, from the seed in both directions, until the curve leaves either face's domain or comes back to its start (a closed loop, as here: ${march.length - 1} steps of h = ${H}). Where n<sub>A</sub> × n<sub>B</sub> vanishes the surfaces are tangent and the curve ends.`, formula: 'stop: outside a domain · within ¾ h of the start · ‖n<sub>A</sub> × n<sub>B</sub>‖ &lt; 10⁻⁴' },
  { label: 'One curve on both faces', text: 'The chain of points, with their (θ, z) and (φ, x), becomes the cut on both faces: fitted as cubic pieces in each face\'s domain and in 3D, it is what the 2D arrangement then splits each face with.' },
];
const s = useSteps(steps.length, [2400, 3200, 2600, 3200, 7000, 2600], root);
const k = computed(() => ease(s.t.value));
const lerp3 = (p, q, u) => p.map((v, i) => v + (q[i] - v) * u);
// What each step draws.
const refineAt = computed(() => { const u = s.step.value === 1 ? k.value * (refine.length - 1) : s.step.value > 1 ? refine.length - 1 : 0, i = Math.min(refine.length - 2, Math.floor(u)); return { x: lerp3(refine[i].x, refine[i + 1].x, u - i), y: lerp3(refine[i].y, refine[i + 1].y, u - i) }; });
const first = march[0];
const corr = computed(() => { const its = first.its, u = k.value * (its.length - 1), i = Math.min(its.length - 2, Math.floor(u)); return lerp3(i === 0 ? first.guess : its[i].x, its[i + 1].x, u - i); });
const traced = computed(() => { const n = s.step.value === 4 ? Math.max(1, Math.round(k.value * (march.length - 1))) : s.step.value > 4 ? march.length - 1 : 1; return march.slice(0, n + 1).map(m => m.x); });
const current = computed(() => march[Math.min(march.length - 2, traced.value.length - 1)]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Tracing where two surfaces meet: predictor and corrector" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="Two crossing cylinders and the marching steps along their intersection curve">
        <polyline v-for="(w, i) in wireA" :key="'wa' + i" :points="w" class="wire a" /><polyline v-for="(w, i) in ruleA" :key="'ra' + i" :points="w" class="wire a thin" />
        <polyline v-for="(w, i) in wireB" :key="'wb' + i" :points="w" class="wire b" /><polyline v-for="(w, i) in ruleB" :key="'rb' + i" :points="w" class="wire b thin" />
        <g v-if="s.step.value <= 1">
          <circle :cx="view(refineAt.x)[0]" :cy="view(refineAt.x)[1]" r="4.5" class="on-a" />
          <circle :cx="view(refineAt.y)[0]" :cy="view(refineAt.y)[1]" r="4.5" class="on-b" />
          <line :x1="view(refineAt.x)[0]" :y1="view(refineAt.x)[1]" :x2="view(refineAt.y)[0]" :y2="view(refineAt.y)[1]" class="gap" />
        </g>
        <polyline v-if="s.step.value >= 2" :points="poly(traced)" class="curve" />
        <g v-if="s.step.value === 2 || s.step.value === 3">
          <line :x1="view(first.x)[0]" :y1="view(first.x)[1]" :x2="view(first.guess)[0]" :y2="view(first.guess)[1]" class="tangent" :style="{ opacity: s.step.value === 2 ? k : 1 }" />
          <circle :cx="view(first.guess)[0]" :cy="view(first.guess)[1]" r="4" class="guess" :style="{ opacity: s.step.value === 2 ? k : 1 }" />
          <circle v-if="s.step.value === 3" :cx="view(corr)[0]" :cy="view(corr)[1]" r="4.5" class="point" />
          <text :x="view(first.guess)[0] + 8" :y="view(first.guess)[1] - 6" class="tag">x̃ = x + h t</text>
        </g>
        <g v-if="s.step.value === 4">
          <line :x1="view(current.x)[0]" :y1="view(current.x)[1]" :x2="view(current.guess)[0]" :y2="view(current.guess)[1]" class="tangent" />
          <circle :cx="view(current.guess)[0]" :cy="view(current.guess)[1]" r="3" class="guess" />
        </g>
        <circle v-for="(p, i) in (s.step.value >= 2 ? traced : [])" :key="'p' + i" :cx="view(p)[0]" :cy="view(p)[1]" r="2.6" class="point" />
        <text x="12" y="20" class="name a">A · x² + y² = 16</text><text x="12" y="36" class="name b">B · y² + z² = 6.25</text>
      </svg>
      <template #note>Computed in the page with the kernel's predictor and corrector on these two cylinders (the kernel also
        has a closed form for some cylinder pairs; marching is what it uses for general patches). The full curve is two
        closed loops, one each side of B's axis; one is traced here.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.wire { fill: none; stroke-width: 1.1; opacity: 0.55; } .wire.thin { stroke-width: 0.7; opacity: 0.35; }
.wire.a { stroke: var(--a); } .wire.b { stroke: var(--b); }
.on-a { fill: var(--a); } .on-b { fill: var(--b); }
.gap { stroke: var(--hot); stroke-width: 1.5; stroke-dasharray: 3 2; }
.curve { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linejoin: round; }
.point { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.tangent { stroke: var(--hot); stroke-width: 1.8; }
.guess { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.8; }
.tag { fill: var(--hot); font-weight: 600; font-size: 11px; }
.name { font-weight: 700; font-size: 11px; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
</style>
