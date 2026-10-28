<script setup>
// Building the triangle hierarchy (triangle-bvh.ts `triangleBvh`, K2, D141) over 28 triangles of a ring, flat in the
// page (z = 0). The build below is the kernel's, in 2D: corner boxes, the longest side, quickselect (Hoare) to the
// median by centre, leaves of at most 4, the explicit stack. On these triangles it gives the kernel's tree exactly
// (nodes, boxes, order; ports/bvh2d.mjs, checked against the kernel by apps/library-docs/samples/how-ports.test.mjs).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';
import { build } from './ports/bvh2d.mjs';

const root = ref(null);
const SEG = 14, P = [], I = [];
for (let k = 0; k < SEG; k++) {
  const a = 2 * Math.PI * k / SEG + 0.1, ri = 3 + 0.5 * Math.sin(2 * a + 0.4), ro = ri + 1 + 0.3 * Math.cos(3 * a);
  P.push(1.55 * ri * Math.cos(a), ri * Math.sin(a), 1.55 * ro * Math.cos(a), ro * Math.sin(a));
}
for (let k = 0; k < SEG; k++) { const a = 2 * k, b = 2 * k + 1, c = 2 * ((k + 1) % SEG), d = c + 1; I.push(a, c, b, b, c, d); }
const NT = I.length / 3, LEAF = 4;
const CX = new Float64Array(2 * NT);
for (let t = 0; t < NT; t++) for (let k = 0; k < 2; k++) CX[2 * t + k] = (P[2 * I[3 * t] + k] + P[2 * I[3 * t + 1] + k] + P[2 * I[3 * t + 2] + k]) / 3;
const { order: ORDER, nodes: NODES, popped: POPPED } = build(P, I, LEAF);
const LEAVES = NODES.filter(n => n.left < 0).sort((a, b) => a.start - b.start);
// Each triangle's leaf (by its place in order), each order slot's leaf.
const LEAF_OF = new Int32Array(NT), SLOT_LEAF = new Int32Array(NT);
LEAVES.forEach((lf, k) => { for (let i = lf.start; i < lf.start + lf.count; i++) { LEAF_OF[ORDER[i]] = k; SLOT_LEAF[i] = k; } });
// Where a leaf's count is written: on the centre of its triangle nearest the mean of their centres (a leaf's
// triangles need not touch).
const LEAF_AT = LEAVES.map(lf => {
  let x = 0, y = 0; for (let i = lf.start; i < lf.start + lf.count; i++) { x += CX[2 * ORDER[i]]; y += CX[2 * ORDER[i] + 1]; }
  x /= lf.count; y /= lf.count;
  let best = ORDER[lf.start], bd = Infinity;
  for (let i = lf.start; i < lf.start + lf.count; i++) { const t = ORDER[i], d = (CX[2 * t] - x) ** 2 + (CX[2 * t + 1] - y) ** 2; if (d < bd) { bd = d; best = t; } }
  return [CX[2 * best], CX[2 * best + 1]];
});
// The root's split: which side of the median each triangle went to.
const ROOT_HALF = NT >> 1, SIDE = new Int8Array(NT);
for (let i = 0; i < NT; i++) SIDE[ORDER[i]] = i < ROOT_HALF ? 0 : 1;
const MEDIAN_TRI = ORDER[ROOT_HALF];

const X = x => 190 + 22 * (x - 0.44), Y = y => 100 - 22 * (y + 0.11);
const f1 = v => Math.round(v * 10) / 10;
const TRIS = Array.from({ length: NT }, (_, t) => {
  const q = [0, 1, 2].map(k => [X(P[2 * I[3 * t + k]]), Y(P[2 * I[3 * t + k] + 1])]);
  return { d: `M${f1(q[0][0])} ${f1(q[0][1])}L${f1(q[1][0])} ${f1(q[1][1])}L${f1(q[2][0])} ${f1(q[2][1])}Z`, c: [X(CX[2 * t]), Y(CX[2 * t + 1])] };
});
const HUES = ['a', 'b', 'keep', 'hot'];
const leafClass = k => `leaf ${HUES[k % 4]}${k >= 4 ? ' light' : ''}`;
const rectOf = b => ({ x: X(b[0]), y: Y(b[3]), w: Math.max(0, X(b[2]) - X(b[0])), h: Math.max(0, Y(b[1]) - Y(b[3])) });
const lerpBox = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const W0 = NODES[0].box[2] - NODES[0].box[0], H0 = NODES[0].box[3] - NODES[0].box[1];
// The root's box grows out of its centre point.
const ROOT_SEED = [(NODES[0].box[0] + NODES[0].box[2]) / 2, (NODES[0].box[1] + NODES[0].box[3]) / 2, (NODES[0].box[0] + NODES[0].box[2]) / 2, (NODES[0].box[1] + NODES[0].box[3]) / 2];

const steps = [
  { label: 'Triangles and their centres', text: 'The hierarchy is built once over a mesh: its positions and three vertex indices a triangle. Each triangle gets a centre, the mean of its corners. The centres decide where triangles go; the boxes are made from the corners.', formula: 'centre = (p<sub>0</sub> + p<sub>1</sub> + p<sub>2</sub>) / 3' },
  { label: 'The root: a box and its longest side', text: 'A node\'s box holds every corner of its triangles. It is split along its longest side: x when that side is at least as long as the others, else y when it is at least z\'s, else z.', formula: `w<sub>x</sub> = ${W0.toFixed(2)} ≥ w<sub>y</sub> = ${H0.toFixed(2)} → split along x` },
  { label: 'Split at the median, by quickselect', text: 'The node\'s triangles are split into halves by their centres along that axis. Quickselect (Hoare\'s partition) moves the median into its sorted place, smaller centres before it and larger after it, without sorting either half. D141 measured 62 ms to build 100,352 triangles, against 228 ms for the earlier tree that sorted fully.', formula: 'half = ⌊count / 2⌋ = 14 · order[start, start + half) → first child, the rest → second' },
  { label: 'Each child on its own longest side', text: 'Each child takes the box of its own triangles\' corners and is split along its own longest side. Two triangles that cross the split line stay whole, so a child\'s box can reach past the line, and sibling boxes can overlap.' },
  { label: 'Leaves of at most four', text: 'A node with at most four triangles is not split: it is a leaf, and its triangles are a run of <code>order</code>. Here 28 triangles give 15 nodes, 8 of them leaves of 3 or 4.', formula: 'nodes ≤ 2 · n − 1 · depth here 3 = ⌈log<sub>2</sub>(28 / 4)⌉' },
  { label: 'Flat arrays and an explicit stack', text: 'Nothing is a JavaScript object per node. Each node is a slot in typed arrays: six numbers of box, its first child (the second is next to it) or −1 for a leaf, and its run of <code>order</code>. The build pops (node, start, count) triples from a stack instead of recursing, the second child first.', formula: 'box[6n … 6n+5] · left[n] · start[n], count[n] · order[0 … n−1]' },
];
const s = useSteps(steps.length, [2600, 2400, 3600, 2600, 2600, 5200], root);
const e = computed(() => ease(s.t.value));

/** The boxes drawn: every node down to the step's depth, the newest level growing out of its parent's box. */
const boxes = computed(() => {
  const st = s.step.value, out = [];
  const depth = st <= 0 ? -1 : st === 1 ? 0 : st === 2 ? 1 : st === 3 ? 2 : 3;
  const grow = st === 1 ? 0 : st === 2 ? 1 : st === 3 ? 2 : st === 4 ? 3 : -1;
  for (const nd of NODES) {
    if (nd.depth > depth) continue;
    // (From the leaves on, only the root, the leaves and the node the build holds now.)
    if (st >= 4 && nd.depth > 0 && nd.left >= 0 && !(st === 5 && current.value === nd.n)) continue;
    let b = nd.box;
    if (nd.depth === grow) {
      const u = st === 2 ? Math.max(0, (e.value - 0.45) / 0.55) : e.value;
      b = lerpBox(nd.parent < 0 ? ROOT_SEED : NODES[nd.parent].box, nd.box, u);
    }
    out.push({ n: nd.n, depth: nd.depth, leaf: nd.left < 0, ...rectOf(b), now: st === 5 && current.value === nd.n });
  }
  return out;
});
/** Split lines drawn for the nodes split so far. */
const cuts = computed(() => {
  const st = s.step.value, upto = st === 2 ? 0 : st === 3 ? 1 : -1;
  return NODES.filter(nd => nd.left >= 0 && nd.depth <= upto).map(nd => {
    const r = rectOf(nd.box), fresh = (st === 2 && nd.depth === 0) || (st === 3 && nd.depth === 1);
    const u = fresh ? Math.min(1, e.value * 1.6) : 1;
    return nd.axis === 0 ? { x1: X(nd.cut), y1: r.y, x2: X(nd.cut), y2: r.y + r.h * u } : { x1: r.x, y1: Y(nd.cut), x2: r.x + r.w * u, y2: Y(nd.cut) };
  });
});
/** Step 3: the centres drop onto an x strip, then take their side. */
const strip = computed(() => {
  if (s.step.value !== 2) return null;
  const drop = Math.min(1, e.value / 0.4), side = e.value > 0.4;
  return TRIS.map((tr, t) => ({ x: tr.c[0], y: tr.c[1] + (200 - tr.c[1]) * ease(drop), side: side ? SIDE[t] : -1, median: t === MEDIAN_TRI && side }));
});
/** Step 6: how many nodes the build has popped so far, and the one it holds now. */
const poppedCount = computed(() => s.step.value === 5 ? Math.min(POPPED.length, Math.floor(s.t.value * (POPPED.length + 0.99))) : POPPED.length);
const current = computed(() => (s.step.value === 5 && poppedCount.value > 0 && poppedCount.value <= POPPED.length) ? POPPED[poppedCount.value - 1] : -1);
const filled = computed(() => new Set(POPPED.slice(0, poppedCount.value)));
const centresShown = computed(() => s.step.value === 0 ? Math.floor(e.value * (NT + 0.99)) : NT);
const colourLeaves = computed(() => s.step.value >= 4);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Building the hierarchy: median splits on the longest side" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Triangles of a ring, their boxes split recursively at the median into a tree of leaves of at most four">
        <path v-for="(tr, t) in TRIS" :key="'t' + t" :d="tr.d" :class="colourLeaves ? leafClass(LEAF_OF[t]) : 'tri'" />
        <g v-if="s.step.value <= 2">
          <template v-for="(tr, t) in TRIS" :key="'c' + t">
            <circle v-if="t < centresShown && !strip" :cx="tr.c[0]" :cy="tr.c[1]" r="2" class="centre" />
          </template>
          <template v-if="strip">
            <line x1="40" y1="200" x2="340" y2="200" class="axis" />
            <circle v-for="(c, t) in strip" :key="'s' + t" :cx="c.x" :cy="c.y" :r="c.median ? 3.4 : 2.2" class="centre" :class="{ l: c.side === 0, r: c.side === 1, med: c.median }" />
            <text v-if="e > 0.4" :x="TRIS[MEDIAN_TRI].c[0]" y="216" text-anchor="middle" class="lab hot">median (k = 14)</text>
            <text v-if="e > 0.4" x="40" y="216" class="lab a">14 before</text>
            <text v-if="e > 0.4" x="340" y="216" text-anchor="end" class="lab b">14 after</text>
          </template>
        </g>
        <rect v-for="b in boxes" :key="'b' + b.n" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="box" :class="['d' + b.depth, { now: b.now }]" />
        <line v-for="(c, i) in cuts" :key="'l' + i" :x1="c.x1" :y1="c.y1" :x2="c.x2" :y2="c.y2" class="cut" />
        <g v-if="s.step.value === 1">
          <text :x="X((NODES[0].box[0] + NODES[0].box[2]) / 2)" :y="Y(NODES[0].box[3]) - 3" text-anchor="middle" class="lab hot">wₓ {{ W0.toFixed(2) }}</text>
          <text :x="X(NODES[0].box[2]) + 4" :y="Y((NODES[0].box[1] + NODES[0].box[3]) / 2)" class="lab">w<tspan dy="2" font-size="8">y</tspan><tspan dy="-2"> {{ H0.toFixed(2) }}</tspan></text>
        </g>
        <g v-if="s.step.value === 4">
          <text v-for="(lf, k) in LEAVES" :key="'n' + k" :x="X(LEAF_AT[k][0])" :y="Y(LEAF_AT[k][1]) + 4" text-anchor="middle" class="lab count">{{ lf.count }}</text>
        </g>
        <!-- the flat arrays -->
        <g v-if="s.step.value >= 4">
          <text x="10" y="205" class="lab">order</text>
          <rect v-for="i in NT" :key="'o' + i" :x="52 + 11 * (i - 1)" y="196" width="10" height="11" rx="1.5" :class="(s.step.value === 4 || filled.has(LEAVES[SLOT_LEAF[i - 1]].n)) ? leafClass(SLOT_LEAF[i - 1]) : 'empty'" />
        </g>
        <g v-if="s.step.value === 5">
          <text x="10" y="231" class="lab">left</text>
          <g v-for="nd in NODES" :key="'n' + nd.n">
            <rect :x="52 + 20.5 * nd.n" y="219" width="19" height="16" rx="2" class="cell" :class="{ on: filled.has(nd.n), now: current === nd.n }" />
            <text v-if="filled.has(nd.n)" :x="52 + 20.5 * nd.n + 9.5" y="231" text-anchor="middle" class="lab cellnum">{{ nd.left }}</text>
          </g>
          <text x="52" y="247" class="lab small">node 0 … 14 · popped: {{ poppedCount }} of 15{{ current >= 0 ? ` · now node ${current}: start ${NODES[current].start}, count ${NODES[current].count}` : '' }}</text>
        </g>
      </svg>
      <template #note>A 2D picture: the triangles are flat in the page and the boxes have two sides; the kernel's have
        three and compare x, y and z. The tree drawn is the one the kernel builds for these triangles. The split lines are
        drawn between the two halves' centres; the kernel stores no split coordinate, only the children's boxes.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.tri { fill: color-mix(in srgb, var(--a) 10%, var(--vp-c-bg)); stroke: var(--vp-c-text-3); stroke-width: 0.7; stroke-linejoin: round; }
.leaf { stroke: var(--vp-c-text-3); stroke-width: 0.7; stroke-linejoin: round; }
.leaf.a { fill: color-mix(in srgb, var(--a) 42%, var(--vp-c-bg)); } .leaf.a.light { fill: color-mix(in srgb, var(--a) 18%, var(--vp-c-bg)); }
.leaf.b { fill: color-mix(in srgb, var(--b) 42%, var(--vp-c-bg)); } .leaf.b.light { fill: color-mix(in srgb, var(--b) 18%, var(--vp-c-bg)); }
.leaf.keep { fill: color-mix(in srgb, var(--keep) 42%, var(--vp-c-bg)); } .leaf.keep.light { fill: color-mix(in srgb, var(--keep) 18%, var(--vp-c-bg)); }
.leaf.hot { fill: color-mix(in srgb, var(--hot) 42%, var(--vp-c-bg)); } .leaf.hot.light { fill: color-mix(in srgb, var(--hot) 18%, var(--vp-c-bg)); }
.empty { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.centre { fill: var(--vp-c-text-2); }
.centre.l { fill: var(--a); } .centre.r { fill: var(--b); } .centre.med { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.box { fill: none; stroke: var(--vp-c-text-2); }
.box.d0 { stroke-width: 1.8; } .box.d1 { stroke: var(--a); stroke-width: 1.5; } .box.d2 { stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 5 2; } .box.d3 { stroke: var(--vp-c-text-2); stroke-width: 0.9; stroke-dasharray: 2 2; }
.box.now { stroke: var(--hot); stroke-width: 2.4; stroke-dasharray: none; }
.cut { stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 3 2; }
.cell { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.cell.on { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-text-3); }
.cell.now { stroke: var(--hot); stroke-width: 1.6; }
.lab { font-size: 10px; font-weight: 600; }
.lab.hot { fill: var(--hot); } .lab.a { fill: var(--a); } .lab.b { fill: var(--b); }
.lab.count { font-size: 11px; fill: var(--vp-c-text-1); paint-order: stroke; stroke: var(--vp-c-bg); stroke-width: 2.5px; }
.lab.cellnum { font-size: 10px; fill: var(--vp-c-text-1); }
.lab.small { font-weight: 500; }
</style>
