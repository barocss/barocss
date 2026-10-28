<script setup>
// A profile swept along a curve (packages/barocss-cad/src/brep/sweep-solid.ts, sweepSolid): the path sampled at N + 1
// parameters, N = max(32, min(512, ⌈L / max(size/3, L/512)⌉)); the first frame's X the profile's X made square to the
// start tangent; each next X by the double reflection; rings of the profile in each frame (Y = T × X); quads between
// rings; flat caps. All computed here with the kernel's formulas. The built kernel's sweepSolid on this path and profile
// has every ring point below as a vertex (largest distance 0), N = 32, volume 144.182 mm³ (brepMassProperties).
// The Frenet frame is shown only for comparison: the kernel does not use it.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
// The path: a cubic Bézier (degree 3, knots [0, 0, 0, 0, 1, 1, 1, 1]); an S in plan, rising and falling 1 mm.
const CP = [[-9, -1, -1], [-3, 10, 1], [3, -10, 1], [9, 1, -1]];
const OUTER = [[-2, -0.8], [2, -0.8], [2, 0.8], [-2, 0.8]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const along = (a, k, b) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]], unit = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const comb = B => [0, 1, 2].map(c => B.reduce((m, w, i) => m + w * CP[i][c], 0));
const C = t => { const s = 1 - t; return comb([s * s * s, 3 * t * s * s, 3 * t * t * s, t * t * t]); };
const C1 = t => { const s = 1 - t; return comb([-3 * s * s, 3 * s * s - 6 * t * s, 6 * t * s - 3 * t * t, 3 * t * t]); };
const C2 = t => comb([6 * (1 - t), -12 + 18 * t, 6 - 18 * t, 6 * t]);
// The kernel's sample count: the length from 64 chords, the size the profile's reach from its middle.
const PROBE = Array.from({ length: 65 }, (_, k) => C(k / 64));
let L = 0; for (let k = 1; k < 65; k++) L += Math.hypot(...sub(PROBE[k], PROBE[k - 1]));
const SIZE = Math.max(...OUTER.map(p => Math.hypot(p[0], p[1])));
const N = Math.max(32, Math.min(512, Math.ceil(L / Math.max(SIZE / 3, L / 512))));
const P = Array.from({ length: N + 1 }, (_, k) => C(k / N)), T = P.map((_, k) => unit(C1(k / N)));
// The frames: X square to T₀ from the sketch's X axis, then the double reflection (rotation-minimising).
const X = [unit(sub([1, 0, 0], along([0, 0, 0], dot([1, 0, 0], T[0]), T[0])))], MID = [];
for (let k = 0; k < N; k++) {
  const v1 = sub(P[k + 1], P[k]), c1 = dot(v1, v1);
  const rL = along(X[k], -2 / c1 * dot(v1, X[k]), v1), tL = along(T[k], -2 / c1 * dot(v1, T[k]), v1), v2 = sub(T[k + 1], tL), c2 = dot(v2, v2);
  X.push(unit(c2 > 1e-30 ? along(rL, -2 / c2 * dot(v2, rL), v2) : rL));
  MID.push({ rL, tL });
}
// For comparison only: the Frenet frame, X along the principal normal (towards the centre of curvature).
const FX = P.map((_, k) => { const d1 = C1(k / N), d2 = C2(k / N); return unit(cross(cross(d1, d2), d1)); });
const signed = (a, b, t) => Math.atan2(dot(cross(a, b), t), dot(a, b)) * 180 / Math.PI;
const FRENET_VS = FX.map((f, k) => signed(X[k], f, T[k]));
let fastest = { k: 0, d: 0 }; for (let k = 1; k <= N; k++) { const d = Math.abs(FRENET_VS[k] - FRENET_VS[k - 1]); if (d > fastest.d) fastest = { k, d }; }
const ringOf = (k, x) => { const y = cross(T[k], x); return OUTER.map(([u, v]) => [P[k][0] + u * x[0] + v * y[0], P[k][1] + u * x[1] + v * y[1], P[k][2] + u * x[2] + v * y[2]]); };
const RINGS = { rmf: P.map((_, k) => ringOf(k, X[k])), frenet: P.map((_, k) => ringOf(k, FX[k])) };

// The view: z up, turned −12° about z, looking down 54°.
const yaw = -12 * Math.PI / 180, pitch = 54 * Math.PI / 180, S = 14, CX = 168, CY = 126;
const view = p => { const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [CX + S * x1, CY - S * (y1 * Math.sin(pitch) + p[2] * Math.cos(pitch))]; };
const poly = ps => ps.map(view).map(q => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');
const PATH = poly(Array.from({ length: 97 }, (_, k) => C(k / 96)));
const arrow = (o, d, len) => { const a = view(o), b = view(along(o, len, d)); return { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }; };

const steps = [
  { label: 'Sample the path', text: `The path is a NURBS curve, here a cubic. It is sampled at N + 1 equal parameter steps, N from its length and the profile's size: L = ${num(L, 2)} mm, the profile reaches ${num(SIZE, 3)} mm from its middle, so N = ${N}. The tangent T at each sample is the curve's derivative, made unit.`, formula: 'N = max(32, min(512, ⌈L / max(size/3, L/512)⌉)), &nbsp; T<sub>k</sub> = C′(t<sub>k</sub>) / ‖C′(t<sub>k</sub>)‖' },
  { label: 'The first frame', text: 'The profile is placed at the path\'s start, square to it, its middle on the path. Its X axis is the sketch\'s X made square to T<sub>0</sub> (or the sketch\'s Y, if X runs along the path); Y = T × X completes the frame.', formula: 'X<sub>0</sub> = unit(x − (x · T<sub>0</sub>) T<sub>0</sub>), &nbsp; Y<sub>k</sub> = T<sub>k</sub> × X<sub>k</sub>' },
  { label: 'Carry the frame by two reflections', text: 'From one sample to the next, X is reflected twice. First in the plane square to the chord v<sub>1</sub> = P<sub>k+1</sub> − P<sub>k</sub>: that sends T<sub>k</sub> to t<sub>L</sub>, nearly −T<sub>k+1</sub> (dashed). Then in the plane square to v<sub>2</sub> = T<sub>k+1</sub> − t<sub>L</sub>, which sends t<sub>L</sub> exactly to T<sub>k+1</sub>. X changes only by its small parts along v<sub>1</sub> and v<sub>2</sub>: it turns as the path turns, and no more about it.', formula: 'r<sub>L</sub> = X<sub>k</sub> − (2 / v<sub>1</sub>·v<sub>1</sub>)(v<sub>1</sub>·X<sub>k</sub>) v<sub>1</sub>, &nbsp; t<sub>L</sub> likewise from T<sub>k</sub><br>X<sub>k+1</sub> = r<sub>L</sub> − (2 / v<sub>2</sub>·v<sub>2</sub>)(v<sub>2</sub>·r<sub>L</sub>) v<sub>2</sub>' },
  { label: 'Rings and walls', text: 'The profile\'s points are placed in every frame, and each pair of neighbouring rings is joined by two triangles per profile edge. The marked corner shows that the profile does not spin about the path.', formula: 'Q<sub>k,i</sub> = P<sub>k</sub> + u<sub>i</sub> X<sub>k</sub> + v<sub>i</sub> Y<sub>k</sub>' },
  { label: 'Flat caps, one closed mesh', text: `The profile, triangulated with its holes cut out, closes each end: facing back at the start, forward at the end. The triangles become a B-rep with flat facets. The kernel's volume here is 144.182 mm³; the profile's area times the path's length is 6.4 × ${num(L, 3)} = ${num(6.4 * L, 2)} mm³.`, formula: 'faceted: ring points exact on the frames, walls flat between them' },
  { label: 'Why not the Frenet frame', text: `The Frenet frame takes X along the curve's principal normal. Where the bending changes side, as in the middle of an S, the normal swings round: here by ${num(fastest.d, 1)}° from sample ${fastest.k - 1} to ${fastest.k}, and ${num(Math.abs(FRENET_VS[N] - FRENET_VS[0]), 0)}° in all relative to the kernel's frame. A profile carried on it would twist. Switch the frames to see it.`, formula: 'Frenet: X = unit((C′ × C″) × C′) &nbsp; (not used by the kernel)' },
];
const s = useSteps(steps.length, [2600, 2400, 6400, 3400, 2600, 4600], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
const frame = ref('rmf');
const rings = computed(() => RINGS[step.value === 5 ? frame.value : 'rmf']);

const samples = computed(() => { const m = step.value === 0 ? Math.round(k.value * N) : N; return P.slice(0, m + 1).map(view); });
const tangents = computed(() => (step.value === 0 ? P.filter((_, i) => i % 4 === 0 && i <= k.value * N).map((p, i) => arrow(p, T[4 * i], 1.8)) : []));
// Step 3: the frames carried so far, and the current step's two reflections.
const carried = computed(() => (step.value === 2 ? Math.min(N, Math.floor(k.value * N)) : step.value > 2 ? N : 0));
const xArrows = computed(() => (step.value >= 1 && step.value <= 2 ? X.slice(0, carried.value + 1).map((x, i) => arrow(P[i], x, 1.6)) : []));
const current = computed(() => {
  if (step.value !== 2) return null;
  const i = Math.min(N - 1, carried.value);
  return { t0: arrow(P[i], T[i], 2.4), tL: arrow(P[i + 1], MID[i].tL, 2.4), t1: arrow(P[i + 1], T[i + 1], 2.4), x1: arrow(P[i + 1], X[i + 1], 2.4), i };
});
const ringsShown = computed(() => { if (step.value < 1) return []; const m = step.value === 1 || step.value === 2 ? 0 : step.value === 3 ? Math.round(k.value * N) : N; return rings.value.slice(0, m + 1).map((r, i) => ({ line: poly([...r, r[0]]), mark: view(r[2]), key: i })); });
const rails = computed(() => { if (step.value < 3) return []; const m = step.value === 3 ? Math.max(1, Math.round(k.value * N)) : N; return [0, 1, 2, 3].map(c => poly(rings.value.slice(0, m + 1).map(r => r[c]))); });
const caps = computed(() => (step.value >= 4 ? [rings.value[0], rings.value[N]].map(r => ({ fill: poly(r) })) : []));
const capOpacity = computed(() => (step.value === 4 ? k.value : 1));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Sweep: a profile carried on rotation-minimising frames" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A rectangle swept along an S-shaped space curve, with the frame carried from sample to sample">
        <polyline :points="PATH" class="path" />
        <g v-for="(c, i) in caps" :key="'cap' + i" :style="{ opacity: capOpacity }">
          <polygon :points="c.fill" class="cap" />
        </g>
        <polyline v-for="(r, i) in rails" :key="'rl' + i" :points="r" class="rail" />
        <template v-for="r in ringsShown" :key="'rg' + r.key">
          <polygon :points="r.line" class="ring" :class="{ first: r.key === 0 }" />
          <circle :cx="r.mark[0]" :cy="r.mark[1]" r="1.7" class="mark" />
        </template>
        <circle v-for="(q, i) in samples" :key="'p' + i" :cx="q[0]" :cy="q[1]" r="1.6" class="sample" />
        <line v-for="(a, i) in tangents" :key="'ta' + i" v-bind="a" class="tan" />
        <line v-for="(a, i) in xArrows" :key="'xa' + i" v-bind="a" class="xax" />
        <g v-if="current">
          <line v-bind="current.t0" class="tan" />
          <line v-bind="current.tL" class="tl" />
          <line v-bind="current.t1" class="tan strong" />
          <line v-bind="current.x1" class="xax strong" />
          <text :x="current.tL.x2 - 4" :y="current.tL.y2 + 12" class="tag" text-anchor="end">t<tspan baseline-shift="sub" font-size="8">L</tspan></text>
        </g>
        <g class="readout">
          <text x="246" y="20">N = {{ N }}, L = {{ num(L, 2) }}</text>
          <text v-if="step === 2" x="246" y="36">k = {{ current ? current.i : N }}</text>
          <text v-if="step === 5" x="246" y="36" :class="frame === 'frenet' ? 'hot' : 'keep'">{{ frame === 'frenet' ? 'Frenet (comparison)' : 'rotation-minimising' }}</text>
          <text v-if="step === 5 && frame === 'frenet'" x="246" y="52" class="hot">turns {{ num(Math.abs(FRENET_VS[N] - FRENET_VS[0]), 0) }}° vs kernel</text>
        </g>
        <g class="legend">
          <line x1="12" y1="228" x2="26" y2="228" class="tan" /><text x="30" y="231">T</text>
          <line x1="44" y1="228" x2="58" y2="228" class="xax" /><text x="62" y="231">X</text>
          <line x1="76" y1="228" x2="90" y2="228" class="tl" /><text x="94" y="231">t<tspan baseline-shift="sub" font-size="8">L</tspan></text>
          <circle cx="114" cy="228" r="2" class="mark" /><text x="120" y="231">marked corner</text>
        </g>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Frame shown in the last step">
          <button type="button" :aria-pressed="frame === 'rmf'" @click="frame = 'rmf'; s.go(5)">rotation-minimising (kernel)</button>
          <button type="button" :aria-pressed="frame === 'frenet'" @click="frame = 'frenet'; s.go(5)">Frenet (for comparison)</button>
        </div>
      </div>
      <template #note>Computed in the page with the kernel's sampling and double reflection on this path and profile; the
        built kernel's mesh has every ring point drawn here as a vertex. All {{ N + 1 }} rings are drawn; the walls between
        them are flat triangles. The Frenet frame is not in the kernel: it is drawn to show what the reflections avoid.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout .hot { fill: var(--hot); } .readout .keep { fill: var(--keep); }
.legend text { font-size: 10px; }
.path { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: 4 3; }
.sample { fill: var(--vp-c-text-2); }
.tan { stroke: var(--b); stroke-width: 1.3; } .tan.strong { stroke-width: 2.2; }
.xax { stroke: var(--keep); stroke-width: 1.2; } .xax.strong { stroke-width: 2.2; }
.tl { stroke: var(--hot); stroke-width: 1.8; stroke-dasharray: 3 2; }
.ring { fill: none; stroke: var(--a); stroke-width: 0.8; opacity: 0.75; } .ring.first { stroke-width: 1.8; opacity: 1; fill: var(--a); fill-opacity: 0.12; }
.mark { fill: var(--hot); }
.rail { fill: none; stroke: var(--a); stroke-width: 1.1; opacity: 0.8; }
.cap { fill: var(--a); fill-opacity: 0.22; stroke: var(--a); stroke-width: 1.4; }
.tag { fill: var(--hot); font-weight: 600; font-size: 11px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
