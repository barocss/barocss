<script setup>
// Point in region (curved-arrangement.ts `locateInRegion`): a horizontal ray to +x, crossings counted, rings whose box
// cannot hold the point skipped. The region and the point's path are fixed; crossings are solved here in closed form.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const W = 13, H = 7;
const holes = [{ c: [3, 3.6], r: 1.3 }, { c: [7.2, 2.1], r: 1.05 }, { c: [9.9, 4.8], r: 1.35 }];
const X = x => 16 + 26 * x, Y = y => 210 - 26 * y;
const steps = [
  { label: 'A ray to the right', text: 'From the point, a horizontal ray runs to +x. Each place it crosses the region\'s boundary is found exactly: a line by interpolation, an arc or curve by bisection on a piece that is monotone in y (an arc is cut at its top and bottom). Where the ray passes a vertex, both segments read the one shared point, so they agree on its side.', formula: 'a piece crosses when exactly one of its ends lies above y = yₚ (half-open rule)' },
  { label: 'Odd means inside', text: 'Count the crossings to the right of the point. An odd count is inside, even is outside. Within the tolerance of a segment it is <i>boundary</i> instead.', formula: 'inside ⇔ #{ crossings with x &gt; pₓ } is odd' },
  { label: 'Skip rings that cannot matter', text: 'A ring whose box does not hold the point (within the tolerance) is skipped: outside that box the point is on none of its segments, and the ray crosses it an even number of times (twice or not at all), so the parity cannot change.', formula: 'p ∉ box(ring) ⊕ tol ⇒ ring changes nothing' },
  { label: 'Move the point', text: 'The answer follows the point. Only the rings whose box it is in are read; a face with many holes is not every hole at every point.' },
];
const s = useSteps(steps.length, [2600, 2400, 3000, 9000], root);
const path = u => [1.2 + 10.6 * (0.5 - 0.5 * Math.cos(Math.PI * u)), 3.5 + 2.2 * Math.sin(2 * Math.PI * u) * Math.cos(Math.PI * u * 0.5)];
const p = computed(() => s.step.value < 3 ? [1.6, 3.6] : path(s.t.value));
const inBox = (h, q) => Math.abs(q[0] - h.c[0]) <= h.r && Math.abs(q[1] - h.c[1]) <= h.r;
const crossings = computed(() => {
  const q = p.value, xs = [];
  if (q[1] > 0 && q[1] < H) xs.push({ x: 0, ring: -1 }, { x: W, ring: -1 });
  holes.forEach((h, i) => { const d = h.r * h.r - (q[1] - h.c[1]) ** 2; if (d > 0) xs.push({ x: h.c[0] - Math.sqrt(d), ring: i }, { x: h.c[0] + Math.sqrt(d), ring: i }); });
  return xs.filter(c => c.x > q[0]).sort((a, b) => a.x - b.x);
});
const read = computed(() => holes.map(h => inBox(h, p.value)));
// Crossings of the rings that are read (the outer one always holds the point here).
const counted = computed(() => crossings.value.filter(c => c.ring < 0 || s.step.value < 2 || read.value[c.ring]));
const shownCount = computed(() => s.step.value === 0 ? Math.floor(ease(s.t.value) * (crossings.value.length + 0.99)) : crossings.value.length);
const verdict = computed(() => {
  const q = p.value; if (q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H) return 'out';
  return holes.some(h => Math.hypot(q[0] - h.c[0], q[1] - h.c[1]) < h.r) ? 'out' : 'in';
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Inside or outside: a ray's crossings" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A region with three holes, a point and its ray to the right">
        <rect :x="X(0)" :y="Y(H)" :width="26 * W" :height="26 * H" class="region" />
        <circle v-for="(h, i) in holes" :key="'h' + i" :cx="X(h.c[0])" :cy="Y(h.c[1])" :r="26 * h.r" class="hole" :class="{ skipped: s.step.value >= 2 && !read[i] }" />
        <g v-if="s.step.value >= 2">
          <rect v-for="(h, i) in holes" :key="'b' + i" :x="X(h.c[0] - h.r)" :y="Y(h.c[1] + h.r)" :width="52 * h.r" :height="52 * h.r" class="box" :class="{ read: read[i] }" />
          <text v-for="(h, i) in holes" :key="'t' + i" :x="X(h.c[0])" :y="Y(h.c[1] - h.r) + 13" text-anchor="middle" class="tag">{{ read[i] ? 'read' : 'skipped' }}</text>
        </g>
        <line :x1="X(p[0])" :y1="Y(p[1])" :x2="X(W + 0.6)" :y2="Y(p[1])" class="ray" />
        <g v-for="(c, i) in crossings" :key="'c' + i" v-show="i < shownCount">
          <circle :cx="X(c.x)" :cy="Y(p[1])" r="4.2" class="cross" :class="{ ignored: !counted.includes(c) }" />
          <text :x="X(c.x)" :y="Y(p[1]) - 8" text-anchor="middle" class="num">{{ counted.includes(c) ? counted.indexOf(c) + 1 : '' }}</text>
        </g>
        <circle :cx="X(p[0])" :cy="Y(p[1])" r="5.5" class="point" :class="verdict" />
        <text x="16" y="234" class="readout">crossings to the right: {{ s.step.value === 0 ? shownCount : counted.length }}
          <tspan v-if="s.step.value >= 1" dx="8" :class="verdict">→ {{ verdict === 'in' ? 'odd · inside' : 'even · outside' }}</tspan></text>
      </svg>
      <template #note>One outer ring and three holes, drawn as circles; the kernel's rings are any lines, arcs and traced curves.
        The skipped rings' crossings (hollow) come in pairs, so the count read is the count's parity either way.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --keep: #24956d; --hot: #c75351; --a: #167e9a; }
:global(.dark) svg { --keep: #6dcb9e; --hot: #ef8a87; --a: #66bad3; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.region { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: var(--a); stroke-width: 2; }
.hole { fill: var(--vp-c-bg-soft); stroke: var(--a); stroke-width: 2; transition: opacity .3s; }
.hole.skipped { opacity: 0.4; }
.box { fill: none; stroke: var(--vp-c-text-3); stroke-dasharray: 3 3; transition: stroke .2s; }
.box.read { stroke: var(--hot); stroke-dasharray: none; stroke-width: 1.5; }
.tag { font-size: 10px; }
.ray { stroke: var(--hot); stroke-width: 1.6; stroke-dasharray: 5 3; }
.cross { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.cross.ignored { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.4; }
.num { font-size: 10px; font-weight: 700; fill: var(--hot); }
.point { stroke: var(--vp-c-bg); stroke-width: 2; }
.point.in, tspan.in { fill: var(--keep); } .point.out, tspan.out { fill: var(--hot); }
.readout { font-size: 12px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
