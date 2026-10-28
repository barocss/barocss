<script setup>
// Stitching kept pieces into a B-rep (analytic-boolean.ts `stitch`): the vertex grid (`PointSet3`), T-junctions, edges
// matched by their two ends and middle, and the frozen faces of an incremental step (D283). Drawn to the kernel's
// proportions: a cell is 16 merge radii wide, a neighbour cell is read within 2 radii of its side.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const CELL = 64, EPS = CELL / 16, OX = 62, OY = 22;
const cells = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) cells.push([i, j]);
const stored = [[1.42, 1.18], [1.9, 1.55], [2.22, 0.62], [0.55, 1.6], [3.4, 2.3], [2.05, 2.7]].map(([x, y]) => [OX + x * CELL, OY + y * CELL]);
const steps = [
  { label: 'Ends become vertices', text: 'Every kept piece\'s boundary curves go into one point set by their ends. Two ends closer than the merge radius r = 20 ε are one vertex: a traced curve meets the exact one it crosses within its tracing tolerance, a little looser than curves are fitted.', formula: 'find(p) = the first stored q with ‖q − p‖ ≤ r, &nbsp; r = 20 ε' },
  { label: 'Read only cells that can match', text: 'The points sit in a grid of cells 16 r wide. A lookup reads its own cell, and a neighbour only where the point lies within 2 r of the side they share; farther than that, nothing in the neighbour is within r. Most lookups read one cell, not nine (27 in 3D).', formula: 'read neighbour (i ± 1) ⇔ p − i·w ≤ 2r &nbsp;or&nbsp; (i + 1)·w − p ≤ 2r, &nbsp; w = 16 r' },
  { label: 'Split at T-junctions', text: 'A vertex lying on another piece\'s curve splits that curve there, so both sides of a shared boundary are made of the same edges. Only the vertices in the curve\'s box are tried (a grid over the vertices again).' },
  { label: 'One edge, used both ways', text: 'Two pieces of curve between the same two vertices whose middles agree (within 10 ε, 100 ε for a traced curve) are one edge. In a closed result every edge is used by two faces, once each way; the faces joined through their edges are a shell, and shells with a negative volume are cavities.', formula: 'edge(a, b): same {a, b} ∧ ‖mid − mid′‖ ≤ 10 ε' },
  { label: 'Faces that did not change', text: 'In a chain of Booleans most faces come through a step untouched: no cut, far from the other solid. Those are taken as they were — their loops, edges, vertices and surface from the input — when their rebuilt boundary would be the same edges one for one; only the faces around the new feature are rebuilt.' },
];
const s = useSteps(steps.length, [2600, 8000, 3000, 3200, 3600], root);
const k = computed(() => ease(s.t.value));
// Step 1–2: a query point moving through the middle cell and near its sides.
const q = computed(() => {
  if (s.step.value === 0) return [OX + 1.9 * CELL - 6 + 6 * k.value, OY + 1.55 * CELL + 2];
  const u = s.t.value * 2 * Math.PI;
  return [OX + (1.5 + 0.46 * Math.cos(u)) * CELL, OY + (1.5 + 0.47 * Math.sin(2 * u)) * CELL];
});
const cellOf = p => [Math.floor((p[0] - OX) / CELL), Math.floor((p[1] - OY) / CELL)];
const reads = computed(() => {
  const p = q.value, [gx, gy] = cellOf(p), lx = p[0] - OX - gx * CELL, ly = p[1] - OY - gy * CELL, r = 2 * EPS;
  const xs = [0], ys = [0]; if (lx <= r) xs.push(-1); if (CELL - lx <= r) xs.push(1); if (ly <= r) ys.push(-1); if (CELL - ly <= r) ys.push(1);
  return xs.flatMap(i => ys.map(j => `${gx + i},${gy + j}`));
});
const match = computed(() => stored.findIndex(t => Math.hypot(t[0] - q.value[0], t[1] - q.value[1]) <= EPS));
// Step 3–4: two faces meeting along a boundary with a T-junction.
const F1 = [[70, 60], [310, 60], [310, 120], [70, 120]], F2a = [[70, 120], [190, 120], [190, 200], [70, 200]], F2b = [[190, 120], [310, 120], [310, 200], [190, 200]];
const pts = ps => ps.map(p => p.join(',')).join(' ');
// Step 5: a plate with a row of bosses seen from above, the newest one being added.
const bosses = Array.from({ length: 7 }, (_, i) => [86 + 36 * i, i % 2 ? 160 : 104]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Stitching pieces into a solid" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="The vertex grid, a T-junction, shared edges and frozen faces">
        <g v-if="s.step.value <= 1">
          <rect v-for="c in cells" :key="c.join()" :x="OX + c[0] * CELL" :y="OY + c[1] * CELL" :width="CELL" :height="CELL" class="cell" :class="{ read: s.step.value === 1 && reads.includes(c.join()), own: cellOf(q).join() === c.join() }" />
          <rect v-if="s.step.value === 1" :x="OX + CELL + 2 * EPS" :y="OY + CELL + 2 * EPS" :width="CELL - 4 * EPS" :height="CELL - 4 * EPS" class="inner" />
          <circle v-for="(t, i) in stored" :key="'s' + i" :cx="t[0]" :cy="t[1]" r="3" class="stored" :class="{ hit: match === i }" />
          <circle :cx="q[0]" :cy="q[1]" :r="EPS" class="radius" />
          <circle :cx="q[0]" :cy="q[1]" r="2.6" class="query" />
          <text x="62" y="236" class="readout">{{ s.step.value === 0 ? (match >= 0 ? 'within r of a stored end → the same vertex' : 'no end within r → a new vertex') : `cells read: ${reads.length} (inside the dashed square, only its own)` }}</text>
        </g>
        <g v-if="s.step.value === 2 || s.step.value === 3">
          <polygon :points="pts(F1)" class="face one" /><polygon :points="pts(F2a)" class="face two" /><polygon :points="pts(F2b)" class="face two" />
          <line x1="70" y1="120" x2="310" y2="120" class="edge" :class="{ split: s.step.value >= 2 && k > 0.4 }" />
          <circle cx="190" cy="120" :r="s.step.value === 2 ? 3 + 3 * Math.sin(Math.PI * Math.min(1, k * 1.5)) : 3.5" class="tj" />
          <text x="196" y="114" class="tag">T</text>
          <template v-if="s.step.value === 3">
            <path d="M 96 112 L 170 112" class="use fwd" :style="{ opacity: k }" marker-end="url(#use-head)" />
            <path d="M 170 128 L 96 128" class="use back" :style="{ opacity: k }" marker-end="url(#use-head2)" />
            <path d="M 214 112 L 290 112" class="use fwd" :style="{ opacity: k }" marker-end="url(#use-head)" />
            <path d="M 290 128 L 214 128" class="use back" :style="{ opacity: k }" marker-end="url(#use-head2)" />
          </template>
          <defs>
            <marker id="use-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="m1" /></marker>
            <marker id="use-head2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="m2" /></marker>
          </defs>
          <text x="80" y="80" class="tag">face 1: one long side</text><text x="80" y="190" class="tag">face 2</text><text x="200" y="190" class="tag">face 3</text>
          <text x="70" y="226" class="readout">{{ s.step.value === 2 ? 'face 1\'s side split at T: two edges, as faces 2 and 3 have them' : 'each edge used by two faces, once each way' }}</text>
        </g>
        <g v-if="s.step.value === 4">
          <rect x="60" y="70" width="270" height="130" rx="10" class="plate" />
          <circle v-for="(b, i) in bosses" :key="'b' + i" :cx="b[0]" :cy="b[1]" r="14" class="boss" :class="{ fresh: i === bosses.length - 1, frozen: i < bosses.length - 1 }" :style="i === bosses.length - 1 ? { opacity: Math.min(1, 2 * k) } : {}" />
          <circle :cx="bosses.at(-1)[0]" :cy="bosses.at(-1)[1]" r="22" class="zone" :style="{ opacity: k }" />
          <text x="60" y="56" class="tag">grey: taken from the input as it was · green: cut or near, rebuilt</text>
          <text x="60" y="226" class="readout">only the plate's top and the new boss are rebuilt</text>
        </g>
      </svg>
      <template #note>Proportions are the kernel's (cell 16 r, neighbour band 2 r); the points and faces are made up for the picture.
        On a rounded plate with 48 bosses the frozen faces save 10–13 % of the chain's time.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.cell { fill: none; stroke: var(--vp-c-divider); stroke-width: 1; transition: fill .15s; }
.cell.read { fill: color-mix(in srgb, var(--hot) 14%, transparent); }
.cell.own { fill: color-mix(in srgb, var(--keep) 14%, transparent); }
.inner { fill: none; stroke: var(--keep); stroke-dasharray: 3 3; }
.stored { fill: var(--a); } .stored.hit { fill: var(--hot); }
.radius { fill: none; stroke: var(--hot); stroke-width: 1; }
.query { fill: var(--vp-c-text-1); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.tag { font-size: 10.5px; }
.face { stroke: var(--vp-c-bg); stroke-width: 2; } .face.one { fill: color-mix(in srgb, var(--a) 22%, transparent); } .face.two { fill: color-mix(in srgb, var(--b) 22%, transparent); }
.edge { stroke: var(--vp-c-text-2); stroke-width: 2.5; } .edge.split { stroke: var(--keep); stroke-dasharray: 116 8; }
.tj { fill: var(--hot); }
.use { stroke-width: 1.8; fill: none; } .use.fwd { stroke: var(--a); } .use.back { stroke: var(--b); }
.m1 { fill: var(--a); } .m2 { fill: var(--b); }
.plate { fill: color-mix(in srgb, var(--a) 12%, transparent); stroke: var(--keep); stroke-width: 2; }
.boss { stroke-width: 2; } .boss.frozen { fill: color-mix(in srgb, var(--vp-c-text-3) 25%, transparent); stroke: var(--vp-c-text-3); }
.boss.fresh { fill: color-mix(in srgb, var(--keep) 25%, transparent); stroke: var(--keep); }
.zone { fill: none; stroke: var(--keep); stroke-dasharray: 4 3; }
</style>
