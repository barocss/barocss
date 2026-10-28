<script setup>
// Visibility along a curve (brep-hidden-line.ts `intervals`, `triangleGrid.covers`): the box with a boss of
// HlrCurves.vue, seen from toward (1, −1, 1), up z. One edge, the box's back top edge b.side2|b.top from (40, 30, 10) to
// (0, 30, 10), is sampled and each sample tested; the changes are bisected. The test here is exact (a ray from the
// sample toward the viewer against the boss's cylinder, solved in closed form); the kernel tests the same thing against
// the tessellation's triangles. The final drawing (step 5) and the front view (step 6) are the kernel's own output:
// projectBrepHiddenLines([brep], { toward: [1, -1, 1], up: [0, 0, 1] }) and toward (0, −1, 0), from
// packages/barocss-cad/dist/index.js under node, rounded to 3 decimals.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const T3 = [1, -1, 1].map(x => x / Math.sqrt(3)), RT = [Math.SQRT1_2, Math.SQRT1_2, 0];
const UP = [T3[1] * RT[2] - T3[2] * RT[1], T3[2] * RT[0] - T3[0] * RT[2], T3[0] * RT[1] - T3[1] * RT[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const P = p => [dot(p, RT), dot(p, UP)];
const k = 5.2, X = x => 190 + k * (x - 24.749), Y = y => 116 - k * (y - 2.105);
const S = q => [X(q[0]), Y(q[1])];
// The tested edge, by its parameter s from (40, 30, 10) to (0, 30, 10).
const at = s => [40 - 40 * s, 30, 10];
// How far toward the viewer a ray from p runs before it enters the boss (radius 8 about (20, 15), z 10…22), or null.
// (The ray climbs, so it can only enter through the wall, never through the box below.)
function hitBoss(p) {
  const dx = p[0] - 20, dy = p[1] - 15, a = T3[0] ** 2 + T3[1] ** 2, b = 2 * (dx * T3[0] + dy * T3[1]), c = dx * dx + dy * dy - 64;
  const D = b * b - 4 * a * c; if (D < 0) return null;
  const l1 = (-b - Math.sqrt(D)) / (2 * a), l2 = (-b + Math.sqrt(D)) / (2 * a);
  if (l2 <= 1e-9) return null;
  const l = Math.max(l1, 1e-9); return p[2] + l * T3[2] > 22 + 1e-12 ? null : l;
}
const N = 24, samples = Array.from({ length: N + 1 }, (_, i) => { const s = i / N, p = at(s); return { s, xy: S(P(p)), depth: dot(p, T3), lam: hitBoss(p) }; });
// Bisection between the last visible and the first hidden sample (as the kernel: up to 30 halvings).
function bisect(a, b) {
  const want = hitBoss(at(a)) === null, out = [[a, b]];
  for (let it = 0; it < 30 && b - a > 1e-12 * Math.max(1, Math.abs(b)); it++) { const m = (a + b) / 2; if ((hitBoss(at(m)) === null) === want) a = m; else b = m; out.push([a, b]); }
  return out;
}
const firstHidden = samples.findIndex(q => q.lam !== null), lastHidden = samples.length - 1 - [...samples].reverse().findIndex(q => q.lam !== null);
const B1 = bisect(samples[firstHidden - 1].s, samples[firstHidden].s), B2 = bisect(samples[lastHidden].s, samples[lastHidden + 1].s);
const cut1 = (B1.at(-1)[0] + B1.at(-1)[1]) / 2, cut2 = (B2.at(-1)[0] + B2.at(-1)[1]) / 2;
const edgeLen = Math.hypot(...[0, 1].map(i => P(at(0))[i] - P(at(1))[i]));

// The boss's outline in the view (shaded as the occluder): right silhouette up, top rim round the back, left silhouette
// down, bottom rim round the front. Centres and U, V as the kernel gives them.
const Ub = [5.657, -3.266], Vb = [5.657, 3.266], cBot = [24.749, 6.124], cTop = [24.749, 15.922];
const ell = (c, t) => [c[0] + Ub[0] * Math.cos(t) + Vb[0] * Math.sin(t), c[1] + Ub[1] * Math.cos(t) + Vb[1] * Math.sin(t)];
const outline = (() => {
  const pts = [];
  for (let i = 0; i <= 32; i++) pts.push(ell(cTop, Math.PI / 4 + Math.PI * i / 32));
  for (let i = 0; i <= 32; i++) pts.push(ell(cBot, -3 * Math.PI / 4 + Math.PI * i / 32));
  return 'M' + pts.map(S).map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z';
})();

// Kernel output, toward (1, −1, 1). Lines: [a, b]; arcs: [centre, t0, t1] with the U, V above.
const L = (a, b, vis) => ({ kind: 'line', a, b, vis }), A = (c, t0, t1, vis) => ({ kind: 'arc', c, t0, t1, vis });
const ISO = [
  L([0, 0], [28.284, -16.33], 1), L([28.284, -16.33], [28.284, -8.165], 1), L([0, 8.165], [28.284, -8.165], 1), L([0, 0], [0, 8.165], 1),
  L([28.284, -16.33], [49.497, -4.082], 1), L([49.497, -4.082], [49.497, 4.082], 1), L([28.284, -8.165], [49.497, 4.082], 1),
  L([49.497, -4.082], [21.213, 12.247], 0), L([21.213, 12.247], [21.213, 20.412], 0),
  L([49.497, 4.082], [32.749, 13.752], 1), L([32.749, 13.752], [21.629, 20.172], 0), L([21.629, 20.172], [21.213, 20.412], 1),
  L([0, 0], [21.213, 12.247], 0), L([0, 8.165], [21.213, 20.412], 1),
  A(cBot, 0, 0.785, 1), A(cBot, 0.785, 3.142, 0), A(cTop, 0, 3.142, 1), A(cBot, -2.356, 0, 1), A(cBot, -3.142, -2.356, 0), A(cTop, -3.142, 0, 1),
  L([32.749, 15.922], [32.749, 6.124], 1), L([16.749, 15.922], [16.749, 6.124], 1),
];
const arcPath = (c, t0, t1, M = 40) => 'M' + Array.from({ length: M + 1 }, (_, i) => S(ell(c, t0 + (t1 - t0) * i / M))).map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L');
const isoPaths = ISO.map(e => ({ d: e.kind === 'line' ? `M${S(e.a).join(',')}L${S(e.b).join(',')}` : arcPath(e.c, e.t0, e.t1), vis: !!e.vis }));
const faint = isoPaths.map(p => p.d);
// Front view, toward (0, −1, 0): every piece the kernel returns (all visible), and the edges it returns with no pieces.
const kf = 4.6, FX = x => 26 + kf * x, FY = y => 196 - kf * y;
const FRONT = [[[0, 0], [40, 0]], [[40, 0], [40, 10]], [[0, 10], [40, 10]], [[0, 0], [0, 10]], [[12, 22], [28, 22]], [[12, 10], [12, 22]], [[28, 10], [28, 22]]];
const EMPTY = ['b.side1|b.side2', 'b.bottom|b.side2', 'b.side2|b.side3', 'b.side2|b.top', 'b.top|c.side0#1', 'b.top|c.side0#2', 'c.side0#2|c.top'];

const steps = [
  { label: 'Samples along a curve', text: 'Each curve is sampled along its length, about every h = size / 300 in the view, size being the diagonal of the part\'s box. Here size = 54.6 mm, h = 0.18 mm, and this edge, 32.7 mm long in the view, gets 180 steps (181 samples); the figure shows 24 steps. An arc gets at least one sample every π/32 of its turn.', formula: 'samples = ⌈L / h⌉ (at most 4000), h = size / 300' },
  { label: 'Is a sample hidden?', text: 'A sample is hidden when something lies between it and the viewer: a ray from it toward the viewer meets a face. In the view that ray is a single point, so the kernel asks which triangles of the tessellated faces cover the sample\'s image, and whether one of them is nearer. Depth is measured along <i>toward</i>: larger is nearer.', formula: 'hidden ⇔ some triangle over P(p) has depth z &gt; p·toward + 10⁻⁵·size' },
  { label: 'Where the answer changes', text: 'Between a visible sample and a hidden one, the change is found by bisection: halve the interval and keep the half whose ends disagree, at most 30 times or until it is 10⁻¹² of the parameter wide. Both changes on this edge are found the same way.', formula: '' },
  { label: 'Runs become pieces', text: 'The cuts divide the curve into runs, each wholly visible or wholly hidden; each run is one piece of the same exact kind as the curve (here three lines). A run shorter than 2 × 10⁻³ × size (0.11 mm here) would be joined to its neighbour: numerical noise at a tangency. The last run here is 0.48 mm and stays.', formula: '' },
  { label: 'Every curve', text: 'Every candidate is split the same way. The silhouettes and rims are tested where the tessellation draws them (an arc at its chord), so their own facets do not stand in front of them. Visible pieces are drawn solid, hidden ones dashed.' },
  { label: 'Visible lines take precedence', text: 'Seen from the front, the back edges lie exactly behind the front ones. Visible runs are found first, edges then silhouettes; a hidden run lying on visible ink (within 10⁻⁵ × size, running the same way to within 5°) is dropped, and so is a silhouette along a visible edge. These seven edges come back with no pieces at all.', formula: 'pieces: [] for the seven names listed' },
];
const s = useSteps(steps.length, [2600, 6000, 4200, 2600, 3200, 3200], root);
const shown = computed(() => s.step.value === 0 ? Math.floor(ease(s.t.value) * (N + 0.99)) + 1 : N + 1);
const testing = computed(() => s.step.value === 1 ? Math.min(N, Math.floor(s.t.value * (N + 1))) : s.step.value > 1 ? N : -1);
const dots = computed(() => samples.slice(0, shown.value).map((q, i) => ({ ...q, state: i <= testing.value ? (q.lam === null ? 'vis' : 'hid') : 'open' })));
const now = computed(() => (s.step.value === 1 ? samples[testing.value] : null));
const iter = computed(() => s.step.value === 2 ? Math.min(B1.length - 1, Math.floor(ease(s.t.value) * B1.length)) : 0);
const brackets = computed(() => s.step.value !== 2 ? [] : [B1, B2].map(B => { const [a, b] = B[Math.min(iter.value, B.length - 1)]; return { a: S(P(at(a))), b: S(P(at(b))) }; }));
const runs = computed(() => s.step.value !== 3 ? [] : [[0, cut1, true], [cut1, cut2, false], [cut2, 1, true]].map(([a, b, vis]) => ({ d: `M${S(P(at(a))).join(',')}L${S(P(at(b))).join(',')}`, vis })));
const finalShown = computed(() => s.step.value === 4 ? Math.ceil(ease(s.t.value) * isoPaths.length) : isoPaths.length);
const testEdge = `M${S(P(at(0))).join(',')}L${S(P(at(1))).join(',')}`;
const readout = computed(() => {
  const i = s.step.value;
  if (i === 0) return `samples: ${shown.value} of ${N + 1} (kernel: 181)`;
  if (i === 1 && now.value) return `sample ${testing.value}: ${now.value.lam === null ? 'nothing nearer: visible' : `the boss is ${num(now.value.lam, 2)} mm nearer: hidden`}`;
  if (i === 2) { const [a, b] = B1[iter.value]; const wd = edgeLen * (b - a); return `halving ${iter.value}: width ${wd >= 0.01 ? num(wd, 3) : wd.toExponential(1)} mm`; }
  if (i === 3) return `cuts at x = ${num(P(at(cut1))[0], 3)} and ${num(P(at(cut2))[0], 3)} (kernel: 32.749, 21.629)`;
  if (i === 4) return 'solid: visible   dashed: hidden';
  return '';
});
// Depth inset: the sample at its depth, the boss's wall where the ray enters it.
const inset = computed(() => {
  const q = now.value; if (!q) return null;
  const x0 = 28, sc = 5.2;
  return { x0, p: x0, hit: q.lam === null ? null : x0 + sc * q.lam, depth: q.depth };
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Visible or hidden: sample, test, bisect" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="The box with a boss: one edge sampled, its samples tested for being hidden by the boss, the changes bisected; then the whole drawing">
        <g v-if="s.step.value < 5">
          <path v-if="s.step.value === 1" :d="outline" class="occluder" />
          <g v-if="s.step.value < 4">
            <path v-for="(d, i) in faint" :key="'f' + i" :d="d" class="faint" />
            <path v-if="s.step.value < 3" :d="testEdge" class="test" />
            <path v-for="(r, i) in runs" :key="'r' + i" :d="r.d" class="piece" :class="{ hidden: !r.vis }" />
            <circle v-for="(q, i) in dots" :key="'d' + i" :cx="q.xy[0]" :cy="q.xy[1]" :r="now && i === testing ? 4.2 : 2.6" class="dot" :class="q.state" />
            <g v-for="(b, i) in brackets" :key="'b' + i">
              <line :x1="b.a[0]" :y1="b.a[1] - 7" :x2="b.a[0]" :y2="b.a[1] + 7" class="bracket" />
              <line :x1="b.b[0]" :y1="b.b[1] - 7" :x2="b.b[0]" :y2="b.b[1] + 7" class="bracket" />
            </g>
          </g>
          <g v-else>
            <path v-for="(p, i) in isoPaths" :key="'k' + i" v-show="i < finalShown" :d="p.d" class="piece" :class="{ hidden: !p.vis }" />
          </g>
          <g v-if="inset">
            <line :x1="inset.x0 - 8" y1="214" x2="150" y2="214" class="axis" />
            <text :x="inset.x0 - 8" y="230" class="tag">depth along toward →</text>
            <circle :cx="inset.p" cy="214" r="3.5" class="dot" :class="inset.hit === null ? 'vis' : 'hid'" />
            <g v-if="inset.hit !== null">
              <line :x1="inset.hit" y1="206" :x2="inset.hit" y2="222" class="wall" />
              <text :x="inset.hit" y="202" text-anchor="middle" class="tag">wall</text>
            </g>
          </g>
        </g>
        <g v-else>
          <line v-for="(l, i) in FRONT" :key="'fr' + i" :x1="FX(l[0][0])" :y1="FY(l[0][1])" :x2="FX(l[1][0])" :y2="FY(l[1][1])" class="piece" />
          <text x="222" y="62" class="tag strong">no pieces:</text>
          <text v-for="(n, i) in EMPTY" :key="'n' + i" x="222" :y="78 + 15 * i" class="mono">{{ n }}</text>
          <text x="26" y="222" class="tag">front view, toward (0, −1, 0)</text>
        </g>
        <text x="14" y="244" class="readout">{{ readout }}</text>
      </svg>
      <template #note>Steps 1–4 use 25 samples (the kernel: 181) and test each sample exactly against the boss's cylinder;
        the kernel tests against its triangles, so its second cut lands at x = 21.629 rather than the exact 21.626 (the
        top rim's facets sit just inside the circle). Steps 5–6 are the kernel's output for this part, rounded.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.faint { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; opacity: 0.6; }
.occluder { fill: color-mix(in srgb, var(--b) 18%, transparent); stroke: var(--b); stroke-width: 1.2; }
.test { stroke: var(--a); stroke-width: 2.2; }
.piece { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.piece.hidden { stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-dasharray: 4 3; }
.dot { stroke: var(--vp-c-bg); stroke-width: 1; }
.dot.open { fill: var(--a); }
.dot.vis { fill: var(--keep); }
.dot.hid { fill: var(--hot); }
.bracket { stroke: var(--b); stroke-width: 2; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.wall { stroke: var(--b); stroke-width: 2.4; }
.tag { font-size: 10px; }
.strong { font-weight: 700; fill: var(--vp-c-text-1); }
.mono { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
