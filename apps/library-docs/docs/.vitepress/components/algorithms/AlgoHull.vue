<script setup>
// The convex-hull broad phase (packages/barocss-cad/src/brep/analytic-boolean.ts, `patchClearOf`), in a section: a
// rational cubic with positive weights against a plane seen edge-on. The curve is evaluated here exactly.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const P = [[1, 1.2], [3.6, 6.4], [7.4, 0.4], [11, 4.6]], Wt = [1, 1.6, 0.8, 1];
const X = x => 20 + 28 * x, Y = y => 220 - 28 * y;
const bern = (i, u) => [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3][i];
const at = u => { let x = 0, y = 0, w = 0; for (let i = 0; i < 4; i++) { const b = Wt[i] * bern(i, u); x += b * P[i][0]; y += b * P[i][1]; w += b; } return [x / w, y / w]; };
const curve = Array.from({ length: 81 }, (_, i) => at(i / 80));
// The control points' convex hull (all four are its corners here, in this order).
const hull = [P[0], P[2], P[3], P[1]];
const pts = ps => ps.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
const yMin = Math.min(...P.map(p => p[1])), yMax = Math.max(...P.map(p => p[1]));
const cMin = Math.min(...curve.map(p => p[1])), cMax = Math.max(...curve.map(p => p[1]));
const gap = 0.15;
const steps = [
  { label: 'A patch lies in its net\'s hull', text: 'A NURBS point is a weighted average of its control points. With every weight positive, the weights of the average are positive and sum to one: the point lies in the convex hull of the control points, for every (u, v).', formula: 'S(u, v) = Σ w<sub>ij</sub> N<sub>i</sub>(u) N<sub>j</sub>(v) P<sub>ij</sub> / Σ w<sub>ij</sub> N<sub>i</sub>(u) N<sub>j</sub>(v), &nbsp; N ≥ 0, w &gt; 0' },
  { label: 'A plane clear of the hull', text: 'If every control point lies more than a gap g on one side of the plane, so does the whole patch: the two cannot meet, and the surface-intersection march is not started.', formula: 'd<sub>ij</sub> = n · (P<sub>ij</sub> − o) &nbsp;&nbsp; all d<sub>ij</sub> &gt; g &nbsp;or&nbsp; all d<sub>ij</sub> &lt; −g ⇒ no intersection' },
  { label: 'Move the plane', text: 'Only when the plane passes between control points can it meet the patch, and only then is the march run. The test is conservative: it may say “maybe” for a plane that misses the curve, never “clear” for one that meets it.' },
  { label: 'Against a cylinder', text: 'For an infinite cylinder the same idea uses each control point\'s distance from the axis: all of them inside the radius by g, or all beyond one line tangent to the cylinder\'s section (square to their mean direction from the axis), pushed out by g.', formula: 'all ‖r<sub>ij</sub>‖ &lt; R − g &nbsp;or&nbsp; all r<sub>ij</sub> · ĥ &gt; R + g ⇒ no intersection' },
];
const s = useSteps(steps.length, [2600, 2600, 7000, 2600], root);
const planeY = computed(() => s.step.value < 2 ? 7.1 : s.step.value === 2 ? 7.1 - 7.6 * (0.5 - 0.5 * Math.cos(2 * Math.PI * s.t.value)) : 7.1);
const sides = computed(() => P.map(p => p[1] - planeY.value > gap ? 'below' : p[1] - planeY.value < -gap ? 'above' : 'near'));
const clear = computed(() => sides.value.every(x => x === 'below') || sides.value.every(x => x === 'above'));
const meets = computed(() => planeY.value >= cMin && planeY.value <= cMax);
const k = computed(() => ease(s.t.value));
// Cylinder step: a circle (the cylinder's section) and the net's points, all on the far side of one tangent line.
const cyl = { c: [-0.1, 3.2], r: 0.5 };
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Skipping pairs that cannot meet: the control-net hull" :steps="steps" :s="s">
      <svg viewBox="0 0 380 244" role="img" aria-label="A rational cubic curve, its control polygon and hull, and a plane seen edge-on">
        <polygon :points="pts(hull)" class="hull" :class="{ clear }" :style="{ opacity: s.step.value === 0 ? k : 1 }" />
        <polyline :points="pts(P)" class="net" />
        <polyline :points="pts(curve)" class="curve" />
        <circle v-for="(p, i) in P" :key="i" :cx="X(p[0])" :cy="Y(p[1])" :r="3 + 1.5 * Wt[i]" class="pole" :class="s.step.value >= 1 && s.step.value <= 2 ? sides[i] : ''" />
        <text v-for="(p, i) in P" :key="'w' + i" :x="X(p[0]) + 9" :y="Y(p[1]) + 4" class="w">w = {{ Wt[i] }}</text>
        <g v-if="s.step.value >= 1 && s.step.value <= 2">
          <line :x1="X(-0.4)" :y1="Y(planeY)" :x2="X(12.6)" :y2="Y(planeY)" class="plane" />
          <rect :x="X(-0.4)" :y="Y(planeY + gap)" :width="28 * 13" :height="28 * 2 * gap" class="band" />
          <text x="20" y="236" class="verdict" :class="{ clear }">{{ clear ? 'every pole on one side → skip the march' : 'poles on both sides → march' }}{{ !clear && !meets ? ' (it misses, but the test cannot tell)' : '' }}</text>
        </g>
        <g v-if="s.step.value === 3">
          <circle :cx="X(cyl.c[0])" :cy="Y(cyl.c[1])" :r="28 * cyl.r" class="cyl" />
          <line :x1="X(cyl.c[0] + cyl.r + gap)" :y1="Y(-0.2)" :x2="X(cyl.c[0] + cyl.r + gap)" :y2="Y(7.2)" class="plane" />
          <text x="20" y="236" class="verdict clear">cylinder: all poles beyond a tangent line + g → skip</text>
        </g>
      </svg>
      <template #note>A section through a patch: the curve is a rational cubic (weights shown), the line a plane seen edge on, g = {{ num(gap, 2) }}
        here for the picture (the kernel uses its tolerance). The kernel applies the test to a NURBS face against a plane or a
        cylinder before marching.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.hull { fill: color-mix(in srgb, var(--hot) 12%, transparent); stroke: var(--hot); stroke-width: 1; stroke-dasharray: 4 3; transition: fill .3s, stroke .3s; }
.hull.clear { fill: color-mix(in srgb, var(--keep) 14%, transparent); stroke: var(--keep); }
.net { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.curve { fill: none; stroke: var(--a); stroke-width: 2.6; }
.pole { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.5; }
.pole.above, .pole.below { stroke: var(--keep); } .pole.near { stroke: var(--hot); fill: var(--hot); }
.w { font-size: 10px; }
.plane { stroke: var(--b); stroke-width: 2.2; }
.band { fill: color-mix(in srgb, var(--b) 18%, transparent); }
.verdict { font-size: 10.5px; font-weight: 600; fill: var(--hot); } .verdict.clear { fill: var(--keep); }
.cyl { fill: none; stroke: var(--b); stroke-width: 2; }
</style>
