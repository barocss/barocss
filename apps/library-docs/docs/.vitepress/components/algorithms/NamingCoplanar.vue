<script setup>
// Coplanar pieces in the analytic Boolean's `mergePieces` (D281): pieces on one plane facing one way are clustered by
// their 2D boxes padded by 10 t (meeting directly or through others, `clustersOf`); a cluster of one whose rings close is
// kept as it is, with its own name; a larger cluster goes through the 2D union and each face it makes takes the name of
// the first piece lying in it. Names are the built kernel's: a plate 40 × 20 × 6 with its front top edge rounded
// (radius 2), then bosses of radius 3 at x = 8, 16, 24, 32 (y = 10), 5 high, joined one by one: after b3 the tops are
// c0.top … c3.top. The joined case: a block k (x 40–50, 6 high) joined to the rounded plate, `union` target r, tool k:
// one top, named k.top (target k, tool r: p.top). The box padding is drawn far wider than 10 t = 1e-5 mm.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const S = 7.5, X = x => 40 + S * x, Y = y => 190 - S * y, R = 3 * S;
const BOSSES = [8, 16, 24, 32].map((x, i) => ({ i, cx: X(x), cy: Y(10) }));
// The joined scene, on a smaller scale (50 mm wide).
const S2 = 6, X2 = x => 40 + S2 * x, Y2 = y => 180 - S2 * y;
const steps = [
  { label: 'Pieces on one plane', text: 'After the fourth boss, <code>c3</code>, the Boolean has kept four pieces on the plane z = 11, all facing up: the tops of <code>c0</code> … <code>c3</code>. Pieces whose planes agree (same facing normal, same offset within the tolerance t) form one group; so do pieces of one cylinder.', formula: 'same plane: n<sub>a</sub>·n<sub>b</sub> &gt; 1 − 10⁻¹² &nbsp;and&nbsp; |n<sub>a</sub>·(o<sub>b</sub> − o<sub>a</sub>)| ≤ t' },
  { label: 'A box round each', text: 'Each piece\'s rings get a 2D box in the plane, padded by 10 t on every side.' },
  { label: 'Clusters of boxes that meet', text: 'Boxes that overlap, directly or through others, make one cluster. Two boxes are apart only when one ends before the other starts along u or along v. Here every pair is apart: four clusters of one.', formula: 'apart(a, b) ⇔ a.max<sub>u</sub> &lt; b.min<sub>u</sub> ∨ b.max<sub>u</sub> &lt; a.min<sub>u</sub> ∨ (the same in v)' },
  { label: 'Before: one union, one name', text: 'Before D281 the whole group went through one 2D union, and every face it made took the first piece\'s name, the newest boss\'s. Repeated, the names were numbered by position: <code>c3.top#1</code> … <code>#4</code> after the fourth boss. A reference to <code>c0</code>\'s top moved with every new boss.' },
  { label: 'Now: alone, as it is', text: 'A cluster of one whose rings close is passed through as it is, with its own name. The tops stay <code>c0.top</code> … <code>c3.top</code> at every Boolean, and no union is computed for them.' },
  { label: 'Pieces that meet are joined', text: 'A block <code>k</code> beside the rounded plate: its top and the plate\'s lie on one plane and meet along x = 40. Their boxes overlap, so they are one cluster; the 2D union makes one face, named after the first piece lying in it. In <code>r ∪ k</code> that is <code>k.top</code>; in <code>k ∪ r</code> it is <code>p.top</code>.' },
];
const s = useSteps(steps.length, [3000, 2600, 4200, 3400, 3400, 4600], root);
const k = computed(() => ease(s.t.value));
const pad = computed(() => (s.step.value < 1 ? 0 : s.step.value === 1 ? 3 * k.value : 3));
const pair = computed(() => (s.step.value === 2 ? Math.min(2, Math.floor(s.t.value * 3)) : s.step.value > 2 ? 3 : -1));
const label = i => (s.step.value === 3 ? `c3.top#${i + 1}` : s.step.value >= 4 ? `c${i}.top` : '');
const joined = computed(() => (s.step.value === 5 ? Math.max(0, Math.min(1, (s.t.value - 0.45) / 0.3)) : 0));
const readout = computed(() => [
  'group: c0.top, c1.top, c2.top, c3.top (z = 11)',
  'boxes padded by 10 t (drawn wider)',
  pair.value >= 2 ? '4 clusters of one' : `pair ${pair.value + 1}: apart`,
  'before D281: c3.top#1 … c3.top#4',
  'now: c0.top, c1.top, c2.top, c3.top',
  joined.value > 0.6 ? 'one cluster → one face: k.top (in r ∪ k)' : 'boxes overlap along x = 40',
][s.step.value]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Pieces apart keep their names" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="Coplanar boss tops clustered by their boxes, and two touching tops joined into one face">
        <g v-if="s.step.value < 5">
          <rect :x="X(0)" :y="Y(20)" :width="40 * S" :height="18 * S" class="plate" />
          <rect :x="X(0)" :y="Y(2)" :width="40 * S" :height="2 * S" class="round" />
          <text :x="X(1)" :y="Y(18.2)" class="tag">p.top (z = 6): another plane</text>
          <text :x="X(1)" :y="Y(0.7)" class="tag">r.face</text>
          <g v-for="b in BOSSES" :key="b.i">
            <rect v-if="pad > 0" :x="b.cx - R - pad" :y="b.cy - R - pad" :width="2 * (R + pad)" :height="2 * (R + pad)" class="box" />
            <circle :cx="b.cx" :cy="b.cy" :r="R" class="disc" :class="{ tool: b.i === 3 }" :style="s.step.value === 0 ? { opacity: Math.min(1, Math.max(0, 4 * k - b.i)) } : {}" />
            <text v-if="label(b.i)" :x="b.cx" :y="b.cy + R + pad + 14" text-anchor="middle" class="name" :class="s.step.value === 3 ? 'old' : 'kept'">{{ label(b.i) }}</text>
          </g>
          <g v-if="s.step.value === 2">
            <template v-for="j in 3" :key="'g' + j">
              <line v-if="j - 1 <= pair" :x1="BOSSES[j - 1].cx + R + pad" :y1="BOSSES[0].cy" :x2="BOSSES[j].cx - R - pad" :y2="BOSSES[0].cy" class="gap" />
            </template>
          </g>
          <text v-if="s.step.value === 3" :x="X(20)" :y="Y(16)" text-anchor="middle" class="tag hot">all four joined in one union, named after c3</text>
        </g>
        <g v-else>
          <path :d="`M ${X2(0)} ${Y2(20)} H ${X2(40)} V ${Y2(2)} H ${X2(0)} Z`" class="plate" :style="{ opacity: 1 - 0.5 * joined }" />
          <rect :x="X2(40)" :y="Y2(20)" :width="10 * S2" :height="20 * S2" class="block" :style="{ opacity: 1 - 0.5 * joined }" />
          <path v-if="joined > 0" :d="`M ${X2(0)} ${Y2(20)} H ${X2(50)} V ${Y2(0)} H ${X2(40)} V ${Y2(2)} H ${X2(0)} Z`" class="union" :style="{ opacity: joined }" />
          <rect :x="X2(0) - 6 * k" :y="Y2(20) - 6 * k" :width="40 * S2 + 12 * k" :height="18 * S2 + 12 * k" class="box" :style="{ opacity: 1 - joined }" />
          <rect :x="X2(40) - 6 * k" :y="Y2(20) - 6 * k" :width="10 * S2 + 12 * k" :height="20 * S2 + 12 * k" class="box" :style="{ opacity: 1 - joined }" />
          <line :x1="X2(40)" :y1="Y2(20)" :x2="X2(40)" :y2="Y2(2)" class="seam" :style="{ opacity: 1 - joined }" />
          <text :x="X2(18)" :y="Y2(11)" text-anchor="middle" class="name" :style="{ opacity: 1 - joined }">p.top</text>
          <text :x="X2(45)" :y="Y2(11)" text-anchor="middle" class="name" :style="{ opacity: 1 - joined }">k.top</text>
          <text v-if="joined > 0.6" :x="X2(25)" :y="Y2(11)" text-anchor="middle" class="name kept">k.top</text>
          <text :x="X2(0)" :y="Y2(20) - 12" class="tag">plate r (40 × 20, front edge rounded) ∪ block k</text>
        </g>
        <text x="40" y="228" class="readout">{{ readout }}</text>
      </svg>
      <template #note>Seen from above; names are the built kernel's for these parts. The box padding is drawn some 10⁶ times
        wider than it is (10 t = 10⁻⁵ mm). Which piece is "first" follows the Boolean's order of pieces; the joined top's
        name in the last step is as observed for each order of the operands.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10.5px; fill: var(--vp-c-text-2); }
.plate { fill: color-mix(in srgb, var(--vp-c-text-3) 12%, transparent); stroke: var(--vp-c-text-3); stroke-width: 1.2; }
.round { fill: color-mix(in srgb, var(--b) 16%, transparent); stroke: var(--vp-c-text-3); stroke-width: 1; }
.block { fill: color-mix(in srgb, var(--b) 16%, transparent); stroke: var(--b); stroke-width: 1.2; }
.union { fill: color-mix(in srgb, var(--keep) 18%, transparent); stroke: var(--keep); stroke-width: 2; }
.disc { fill: color-mix(in srgb, var(--a) 24%, var(--vp-c-bg-soft)); stroke: var(--a); stroke-width: 2; }
.disc.tool { fill: color-mix(in srgb, var(--b) 24%, var(--vp-c-bg-soft)); stroke: var(--b); }
.box { fill: none; stroke: var(--keep); stroke-width: 1.2; stroke-dasharray: 4 3; }
.gap { stroke: var(--hot); stroke-width: 2; }
.seam { stroke: var(--hot); stroke-width: 2; stroke-dasharray: 3 2; }
.name { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); } .name.old { fill: var(--hot); } .name.kept { fill: var(--keep); }
.tag { font-size: 10px; } .hot { fill: var(--hot); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
