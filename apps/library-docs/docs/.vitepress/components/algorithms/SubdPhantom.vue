<script setup>
// Boundaries and infinitely sharp creases (packages/barocss-cad/src/features/subd.ts, `netOf` and `mirror`), on a
// section: a cage that is the same in every row along y, so that its surface, cut across, is the cubic B-spline of one
// row (x, z in mm). Computed here, in the page. Checked against the kernel: subdBrep of this cage extruded in 4 rows
// (10 mm apart) and cut at mid v gives the same points to 1e-4 mm (the precision printed): (30, 7) smooth and (30, 4)
// with the crease; 2 faces (spans 0–2, 2–6) without it, 4 (0–2, 2–3, 3–5, 5–6) with it (a node script on
// packages/barocss-cad/dist, 2026-10-28).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const P = [[0, 0], [8, 9], [20, 13], [30, 4], [40, 13], [52, 9], [60, 0]];
const n = P.length;
const mirror = (edge, inside) => [2 * edge[0] - inside[0], 2 * edge[1] - inside[1]];
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const mid = (a, b) => lerp(a, b, 0.5);
const basis = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
/** The uniform cubic B-spline of Q at s: span i from Q[i] … Q[i + 3]. */
function bs(Q, s) {
  const i = Math.max(0, Math.min(Q.length - 4, Math.floor(s))), b = basis(s - i);
  let x = 0, y = 0; for (let a = 0; a < 4; a++) { x += b[a] * Q[i + a][0]; y += b[a] * Q[i + a][1]; }
  return [x, y];
}
const sample = (Q, s0, s1, per = 24) => Array.from({ length: Math.round((s1 - s0) * per) + 1 }, (_, k) => bs(Q, s0 + k / per));
const Q0 = mirror(P[0], P[1]), Q6 = mirror(P[6], P[5]);
const OPEN = sample(P, 0, n - 3);
const WITH_ENDS = [Q0, ...P, Q6];
const SMOOTH = sample(WITH_ENDS, 0, n - 1);
// The crease at P3: each side its own polygon, its phantom mirrored at P3.
const CL = mirror(P[3], P[2]), CR = mirror(P[3], P[4]);
const LEFT = [Q0, ...P.slice(0, 4), CL], RIGHT = [CR, ...P.slice(3), Q6];
const CREASED = [...sample(LEFT, 0, 3), ...sample(RIGHT, 0, 3).slice(1)];
// One subdivision step with the end rule: ends stay, midpoints, inside (a + 6v + b)/8.
const STEP1 = P.flatMap((v, i) => {
  const out = [i === 0 || i === n - 1 ? v : [(P[i - 1][0] + 6 * v[0] + P[i + 1][0]) / 8, (P[i - 1][1] + 6 * v[1] + P[i + 1][1]) / 8]];
  if (i < n - 1) out.push(mid(v, P[i + 1]));
  return out;
});
const START1 = P.flatMap((v, i) => (i < n - 1 ? [v, mid(v, P[i + 1])] : [v]));
const Q0_1 = mirror(STEP1[0], STEP1[1]), Q6_1 = mirror(STEP1.at(-1), STEP1.at(-2));
// The kernel's faces along the section (from the check above): spans of the cage.
const FACES = [[0, 2], [2, 3], [3, 5], [5, 6]];

const X = p => 50 + 4.6 * p[0], Y = p => 160 - 7.5 * p[1];
const poly = Q => Q.map(p => `${num(X(p), 2)},${num(Y(p), 2)}`).join(' ');
const SUB = '₀₁₂₃₄₅₆';
const length = Q => Q.slice(1).reduce((s, p, k) => s + Math.hypot(X(p) - X(Q[k]), Y(p) - Y(Q[k])), 0);
const END_L = sample(WITH_ENDS, 0, 1), END_R = sample(WITH_ENDS, n - 2, n - 1);
const END_LENGTH = length(END_L);

const steps = [
  { label: 'An open polygon falls short', text: 'A row of the cage across the surface: P<sub>0</sub> and P<sub>6</sub> lie on the boundary. Each span of the B-spline needs a point before it and a point after it, so the curve covers only the middle four spans: it starts at (P<sub>0</sub> + 4P<sub>1</sub> + P<sub>2</sub>)/6, short of the boundary.' },
  { label: 'Mirror a phantom at each end', text: 'Beyond each end the kernel adds a phantom: the inside point mirrored through the end point. It is not a vertex of the cage; it only completes the 4 × 4 nets of the quads on the boundary.', formula: `Q<sub>0</sub> = 2P<sub>0</sub> − P<sub>1</sub> = (${num(Q0[0])}, ${num(Q0[1])}) &nbsp;·&nbsp; Q<sub>6</sub> = 2P<sub>6</sub> − P<sub>5</sub> = (${num(Q6[0])}, ${num(Q6[1])})` },
  { label: 'Now the curve ends on P₀', text: 'With the phantom the end span exists, and it starts exactly at P<sub>0</sub>, leaving toward P<sub>1</sub>. On the surface this is the boundary rule: the boundary itself is the cubic B-spline of the boundary vertices.', formula: '(Q<sub>0</sub> + 4P<sub>0</sub> + P<sub>1</sub>)/6 = (2P<sub>0</sub> − P<sub>1</sub> + 4P<sub>0</sub> + P<sub>1</sub>)/6 = P<sub>0</sub>' },
  { label: 'Subdividing agrees', text: 'Catmull–Clark\'s rules at a sharp end keep the end point and put midpoints on its edges. The same comes out of subdividing the polygon with its phantom, which moves to the mirror of the new neighbour: the end rule and the phantom are one thing.', formula: '(Q<sub>0</sub> + 6P<sub>0</sub> + P<sub>1</sub>)/8 = P<sub>0</sub> &nbsp;·&nbsp; new phantom ½(3P<sub>0</sub> − P<sub>1</sub>) = 2P<sub>0</sub> − ½(P<sub>0</sub> + P<sub>1</sub>)' },
  { label: 'A crease: a phantom on each side', text: `Mark the cage edges that run through P<sub>3</sub> along the third direction as a crease (infinitely sharp). Each side then treats P<sub>3</sub> as its end and mirrors its own phantom there. The curve stops passing near P<sub>3</sub>, at (${num(bs(WITH_ENDS, 3)[0])}, ${num(bs(WITH_ENDS, 3)[1])}), and goes through it, at (${num(P[3][0])}, ${num(P[3][1])}), with a corner: the two sides meet with position only (G0).`, formula: 'left: 2P<sub>3</sub> − P<sub>2</sub> &nbsp;·&nbsp; right: 2P<sub>3</sub> − P<sub>4</sub>' },
  { label: 'What the kernel builds', text: 'The faces are blocks of quads that never cross a sharp edge, and stop where a quad turns more than a right angle from the block\'s first quad (here at P<sub>2</sub> and at P<sub>5</sub>). This section is four faces: the crease is an edge of the B-rep, shared by its two faces.' },
];
const s = useSteps(steps.length, [2600, 2600, 2800, 3400, 3600, 3000], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
const ghostAt = computed(() => (step.value === 1 ? [lerp(P[1], Q0, k.value), lerp(P[5], Q6, k.value)] : [Q0, Q6]));
const endOffset = computed(() => (step.value === 2 ? END_LENGTH * (1 - k.value) : 0));
const refined = computed(() => START1.map((p, i) => lerp(p, STEP1[i], step.value === 3 ? k.value : 1)));
const ghost1 = computed(() => [lerp(Q0, Q0_1, step.value === 3 ? k.value : 1), lerp(Q6, Q6_1, step.value === 3 ? k.value : 1)]);
const ghosts = computed(() => (step.value === 3 ? ghost1.value : ghostAt.value));
const morph = computed(() => SMOOTH.map((p, i) => lerp(p, CREASED[i], step.value === 4 ? k.value : 1)));
const faceCurves = FACES.map(([a, b]) => CREASED.slice(24 * a, 24 * b + 1));
const creaseGhost = computed(() => (step.value === 4 ? [lerp(P[3], CL, k.value), lerp(P[3], CR, k.value)] : [CL, CR]));
const LABEL_OFF = [[-6, 16], [-18, -6], [-6, -9], [-6, 21], [-6, -9], [6, -6], [-6, 16]];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Boundaries and creases: mirrored phantom points" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A row of a cage with phantom points mirrored beyond its ends and at a crease, and the B-spline reaching them">
        <line x1="14" :y1="Y([0, 0])" x2="366" :y2="Y([0, 0])" class="axis" />
        <polyline :points="poly(P)" class="cage" />
        <!-- 1: the open curve, short of the ends -->
        <g v-if="step === 0">
          <polyline :points="poly(OPEN)" class="curve" />
          <line :x1="X(P[0])" :y1="Y(P[0])" :x2="X(OPEN[0])" :y2="Y(OPEN[0])" class="gap" />
          <line :x1="X(P[6])" :y1="Y(P[6])" :x2="X(OPEN.at(-1))" :y2="Y(OPEN.at(-1))" class="gap" />
        </g>
        <!-- 2–4: phantoms at the ends and the curve that reaches them -->
        <g v-if="step >= 1 && step <= 3">
          <line :x1="X(P[0])" :y1="Y(P[0])" :x2="X(ghosts[0])" :y2="Y(ghosts[0])" class="phantom-edge" />
          <line :x1="X(P[6])" :y1="Y(P[6])" :x2="X(ghosts[1])" :y2="Y(ghosts[1])" class="phantom-edge" />
          <template v-if="step === 3"><circle :cx="X(Q0)" :cy="Y(Q0)" r="3" class="old-ghost" /><circle :cx="X(Q6)" :cy="Y(Q6)" r="3" class="old-ghost" /></template>
          <circle v-for="(g, i) in ghosts" :key="'g' + i" :cx="X(g)" :cy="Y(g)" r="4" class="phantom" />
          <g :style="{ opacity: step === 1 ? k : 1 }">
            <text :x="X(Q0) + 9" :y="Y(Q0) + 4" class="tag hot">Q{{ SUB[0] }}</text>
            <text :x="X(Q6) - 23" :y="Y(Q6) + 4" class="tag hot">Q{{ SUB[6] }}</text>
          </g>
          <polyline :points="poly(step === 1 ? OPEN : SMOOTH.slice(24, 24 * (n - 2) + 1))" class="curve" />
          <g v-if="step >= 2">
            <polyline :points="poly(END_L)" class="curve end" :stroke-dasharray="END_LENGTH" :stroke-dashoffset="endOffset" />
            <polyline :points="poly([...END_R].reverse())" class="curve end" :stroke-dasharray="END_LENGTH" :stroke-dashoffset="endOffset" />
          </g>
        </g>
        <g v-if="step === 3">
          <polyline :points="poly(refined)" class="refined" />
          <circle v-for="(p, i) in refined" :key="'r' + i" :cx="X(p)" :cy="Y(p)" r="2.6" :class="i % 2 ? 'edge-pt' : 'vert-pt'" />
        </g>
        <!-- 5: the crease -->
        <g v-if="step >= 4">
          <line :x1="X(P[3])" :y1="Y(P[3])" :x2="X(creaseGhost[0])" :y2="Y(creaseGhost[0])" class="phantom-edge" />
          <line :x1="X(P[3])" :y1="Y(P[3])" :x2="X(creaseGhost[1])" :y2="Y(creaseGhost[1])" class="phantom-edge" />
          <circle v-for="(g, i) in creaseGhost" :key="'cg' + i" :cx="X(g)" :cy="Y(g)" r="4" class="phantom" />
          <polyline v-if="step === 4" :points="poly(morph)" class="curve" />
          <template v-else>
            <polyline v-for="(c, i) in faceCurves" :key="'f' + i" :points="poly(c)" class="curve" :class="i % 2 ? 'face-b' : 'face-a'" />
            <circle v-for="(c, i) in faceCurves" :key="'fv' + i" :cx="X(c[0])" :cy="Y(c[0])" r="3.2" class="face-end" />
            <circle :cx="X(P[6])" :cy="Y(P[6])" r="3.2" class="face-end" />
            <text v-for="(c, i) in faceCurves" :key="'ft' + i" :x="X(c[Math.floor(c.length / 2)]) - 6" :y="Y(c[Math.floor(c.length / 2)]) + 20" class="tag">f{{ i }}</text>
          </template>
          <text :x="X(P[3]) + 8" :y="Y(P[3]) + 4" class="tag hot">crease</text>
        </g>
        <circle v-for="(p, i) in P" :key="'p' + i" :cx="X(p)" :cy="Y(p)" r="3.4" class="pt" :class="{ dim: step === 3 }" />
        <text v-for="(p, i) in P" :key="'l' + i" :x="X(p) + LABEL_OFF[i][0]" :y="Y(p) + LABEL_OFF[i][1]" class="tag" :class="{ dim: step === 3 }">P{{ SUB[i] }}</text>
        <text x="12" y="20" class="name">{{ step <= 3 ? 'boundary at both ends' : step === 4 ? 'a crease at P₃' : '4 faces' }}</text>
      </svg>
      <template #note>A section: the cage is taken to be the same in every row along the third direction, so the surface
        cut across it is exactly this curve (B-spline weights along that direction sum to 1). Computed in the page and
        checked against the kernel's faces for that extruded cage (see the source comment).</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.axis { stroke: var(--vp-c-divider); stroke-width: 1; }
.cage { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1.1; stroke-dasharray: 4 3; }
.curve { fill: none; stroke: var(--keep); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.curve.end { stroke-width: 3; }
.curve.face-a { stroke: var(--a); } .curve.face-b { stroke: var(--b); }
.face-end { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.refined { fill: none; stroke: var(--a); stroke-width: 1.2; }
.edge-pt { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.vert-pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.gap { stroke: var(--hot); stroke-width: 1.6; stroke-dasharray: 2 2; }
.phantom-edge { stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 3 2; }
.phantom { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.8; }
.old-ghost { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.pt { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 1; }
.pt.dim, .tag.dim { opacity: 0.35; }
.tag { font-weight: 600; } .tag.hot { fill: var(--hot); }
.name { font-weight: 700; fill: var(--vp-c-text-1); }
</style>
