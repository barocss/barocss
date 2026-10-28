<script setup>
// Names appearing feature by feature on a plate seen from above: an extrude `p` (40 × 20 × 6 mm), bosses `c0` and `c1`
// (radius 4, 5 high) joined by `union`, then a groove `g` (x 18–22, 2 deep) cut across the top by `difference`. Every
// name and every key below is the built kernel's (packages/barocss-cad/dist, evaluateCadPart on this part; the keys read
// from the prismatic path's `nameFaces`). The inside points of the two top pieces are found here with the kernel's
// method (`regionInteriorPoint`: middles of inside intervals on nine lines, the one farthest from the boundary wins);
// they agree with the kernel's (3.385441933534391, 7.639320225002102) and (36.614558066465605, 7.639320225002102) to 1e-11.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const S = 7.5, X = x => 40 + S * x, Y = y => 185 - S * y, R = 4 * S;
const FRACTIONS = [0.5, 0.3819660112501051, 0.6180339887498949, 0.2360679774997897, 0.7639320225002103, 0.1458980337503155, 0.8541019662496845, 0.0901699437494742, 0.9098300562505258];
/** The kernel's inside point for a rectangle [x0, x1] × [0, 20] less a disc (cx, cy, r): candidates and the winner. */
function insidePoint(x0, x1, cx, cy, r) {
  const cands = []; let best = null, clear = -1;
  FRACTIONS.forEach((f, line) => {
    const y = 20 * f, xs = [x0, x1], dy = y - cy;
    if (Math.abs(dy) < r) { const dx = Math.sqrt(r * r - dy * dy); xs.push(cx - dx, cx + dx); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p = [(xs[k] + xs[k + 1]) / 2, y], d = Math.min(p[0] - x0, x1 - p[0], p[1], 20 - p[1], Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - r));
      cands.push({ p, line, y, x0: xs[k], x1: xs[k + 1] });
      if (d > clear) { clear = d; best = p; }
    }
  });
  return { cands, best };
}
const PIECES = [insidePoint(0, 18, 10, 10, 4), insidePoint(22, 40, 30, 10, 4)];
const half = (cx, cy, lower) => `M ${X(cx - 4)} ${Y(cy)} A ${R} ${R} 0 0 ${lower ? 0 : 1} ${X(cx + 4)} ${Y(cy)}`;
const steps = [
  { label: 'A feature names its faces', text: 'An extrude <code>p</code> of a rectangle makes six faces. Each is named from the feature\'s id and the face\'s role: <code>p.top</code>, <code>p.bottom</code> (underneath), and one wall per sketch segment, <code>p.side0</code> … <code>p.side3</code> in the sketch\'s order. No name depends on where a face sits in the B-rep\'s list.', formula: 'face = ⟨feature id⟩.⟨role⟩, &nbsp; role ∈ { top, bottom, side<i>i</i> } &nbsp; (<i>i</i>: the authored segment)' },
  { label: 'An edge by its two faces', text: 'An edge is named by the two faces that meet along it: their names sorted as strings and joined by <code>|</code>. The top\'s four edges are <code>p.side0|p.top</code> … <code>p.side3|p.top</code>; a vertical corner is <code>p.side0|p.side1</code>.', formula: 'edge = sort(name(f<sub>1</sub>), name(f<sub>2</sub>)).join("|")' },
  { label: 'One name, two faces', text: 'The boss <code>c0</code> is joined by <code>union</code>. Its circle is one sketch segment, but an arc over half a turn is split in two, so its wall is two faces, both <code>c0.side0</code>. A name used more than once gets <code>#1</code>, <code>#2</code>, … in the order of a point of each face: its key. For a wall it is the middle of its segment at half height.', formula: 'keys (x, y, z): (10, 6, 8.5) &lt; (10, 14, 8.5) &nbsp;⇒&nbsp; lower half = c0.side0#1' },
  { label: 'Repeated edge names', text: 'The two halves meet along two vertical seam edges, both <code>c0.side0#1|c0.side0#2</code>. Edges of one name are numbered the same way, by a middle point: the mean of the curve\'s first, middle and last control points. The seam at x = 6 is <code>…#1</code>, the one at x = 14 is <code>…#2</code>.', formula: 'mid = (P<sub>0</sub> + P<sub>⌊n/2⌋</sub> + P<sub>n</sub>) / 3, &nbsp; ordered by x, then y, then z' },
  { label: 'The next boss leaves the others alone', text: 'Joining <code>c1</code> adds <code>c1.top</code>, <code>c1.side0#1</code>, <code>c1.side0#2</code> and their edges. Every name the part had after <code>c0</code> is still there, on the same face: names come from features, and <code>c1</code> does not touch <code>p</code>\'s or <code>c0</code>\'s faces.' },
  { label: 'A cut splits the top', text: 'The groove <code>g</code> divides the top in two. Each piece\'s key is a point well inside it: on lines at ½, 0.382, 0.618, … of its height, the middle of each inside interval is a candidate, and the one farthest from the boundary wins. The left piece\'s point has the smaller x, so it is <code>p.top#1</code>. The front wall <code>p.side0</code> splits in three the same way.', formula: 'keys: (3.385, 7.639, 6) &lt; (36.615, 7.639, 6) &nbsp;⇒&nbsp; left = p.top#1, right = p.top#2' },
  { label: 'Edge names follow their faces', text: 'The rim of <code>c0</code>\'s lower half now lies on <code>p.top#1</code>, so its name is <code>c0.side0#1|p.top#1</code>. A fillet written before the groove existed, naming <code>c0.side0#1|p.top</code>, is refused: an edge name is looked up exactly, and the refusal lists the edges there are.', formula: 'fillet edges ["c0.side0#1|p.top"] → SELECTION: no edge named c0.side0#1|p.top; edges: …' },
];
const s = useSteps(steps.length, [3200, 3600, 3800, 3600, 3000, 7000, 3800], root);
const k = computed(() => ease(s.t.value));
const grow = i => (s.step.value > i ? 1 : s.step.value === i ? Math.min(1, 1.6 * k.value) : 0);
const r0 = computed(() => Math.max(0, R * grow(2))), r1 = computed(() => Math.max(0, R * grow(4)));
const groove = computed(() => (s.step.value > 5 ? 15 : s.step.value === 5 ? 15 * Math.min(1, s.t.value / 0.22) : 0));
const cut = computed(() => s.step.value >= 5 && groove.value > 0);
// Step 6: the groove opens, the scan lines appear one by one (t 0.25 → 0.72), then the winner.
const scan = computed(() => (s.step.value === 5 ? (s.t.value < 0.25 ? 0 : Math.min(FRACTIONS.length, Math.floor((s.t.value - 0.25) / 0.47 * FRACTIONS.length) + 1)) : s.step.value > 5 ? FRACTIONS.length : 0));
const shown = computed(() => PIECES.map(pc => pc.cands.filter(c => c.line < scan.value)));
const won = computed(() => s.step.value > 5 || (s.step.value === 5 && s.t.value > 0.72));
const topName = computed(() => (cut.value && won.value ? ['p.top#1', 'p.top#2'] : null));
const readout = computed(() => [
  'p: 6 faces and 12 edges',
  'p.side0|p.top, p.side1|p.top, p.side2|p.top, p.side3|p.top',
  'b0: 9 faces, 18 edges',
  'c0.side0#1|c0.side0#2#1 at x = 6 · …#2 at x = 14',
  'b1: 12 faces, 24 edges; every name of b0 kept',
  won.value ? 'p.top#1 at (3.385, 7.639) · p.top#2 at (36.615, 7.639)' : `scan line ${scan.value} of 9 in each piece`,
  'c0.side0#1|p.top#1 resolves · c0.side0#1|p.top is refused',
][s.step.value]);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Names, feature by feature" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A plate seen from above with its face and edge names as bosses and a groove are added">
        <!-- The plate's top, one piece or two. -->
        <rect :x="X(0)" :y="Y(20)" :width="40 * S" :height="20 * S" class="top" :style="{ opacity: s.step.value === 0 ? 0.3 + 0.7 * k : 1 }" />
        <rect v-if="cut" :x="X(20) - groove" :y="Y(20)" :width="2 * groove" :height="20 * S" class="groove" />
        <!-- Edges of the top: lit in step 2, the front wall's three pieces after the cut. -->
        <g v-if="s.step.value === 1">
          <line :x1="X(0)" :y1="Y(0)" :x2="X(0) + 40 * S * Math.min(1, 4 * k)" :y2="Y(0)" class="lit" />
          <line :x1="X(40)" :y1="Y(0)" :x2="X(40)" :y2="Y(0) - 20 * S * Math.max(0, Math.min(1, 4 * k - 1))" class="lit" />
          <line :x1="X(40)" :y1="Y(20)" :x2="X(40) - 40 * S * Math.max(0, Math.min(1, 4 * k - 2))" :y2="Y(20)" class="lit" />
          <line :x1="X(0)" :y1="Y(20)" :x2="X(0)" :y2="Y(20) + 20 * S * Math.max(0, Math.min(1, 4 * k - 3))" class="lit" />
          <circle :cx="X(40)" :cy="Y(0)" r="3.5" class="corner" :style="{ opacity: k }" />
          <text :x="X(40) - 4" :y="Y(0) + 13" class="tag edge-name" text-anchor="end" :style="{ opacity: k }">p.side0|p.side1</text>
        </g>
        <!-- Face names of the plate's walls (step 2: the top's edge names in their place). -->
        <g class="sides">
          <text :x="X(20)" :y="Y(0) + 14" text-anchor="middle" :class="{ 'edge-name': s.step.value === 1 }">{{ s.step.value === 1 ? 'p.side0|p.top' : '' }}</text>
          <text :x="X(20)" :y="Y(20) - 6" text-anchor="middle" :class="{ 'edge-name': s.step.value === 1 }">{{ s.step.value === 1 ? 'p.side2|p.top' : 'p.side2' }}</text>
          <text :transform="`translate(${X(40) + 13} ${Y(10)}) rotate(90)`" text-anchor="middle" :class="{ 'edge-name': s.step.value === 1 }">{{ s.step.value === 1 ? 'p.side1|p.top' : 'p.side1' }}</text>
          <text :transform="`translate(${X(0) - 7} ${Y(10)}) rotate(-90)`" text-anchor="middle" :class="{ 'edge-name': s.step.value === 1 }">{{ s.step.value === 1 ? 'p.side3|p.top' : 'p.side3' }}</text>
          <template v-if="s.step.value !== 1">
            <text v-if="!cut || !won" :x="X(20)" :y="Y(0) + 14" text-anchor="middle">p.side0</text>
            <template v-else>
              <text :x="X(9)" :y="Y(0) + 14" text-anchor="middle" class="hot">p.side0#1</text>
              <text :x="X(20)" :y="Y(0) + 14" text-anchor="middle" class="hot">#2</text>
              <text :x="X(31)" :y="Y(0) + 14" text-anchor="middle" class="hot">p.side0#3</text>
            </template>
          </template>
        </g>
        <text v-if="!topName && s.step.value !== 1 && !cut" :x="X(20)" :y="Y(16.4)" text-anchor="middle" class="face-name">p.top</text>
        <!-- Boss c0, then c1: two halves each. -->
        <g v-for="(b, j) in [{ c: [10, 10], r: r0, id: 'c0', from: 2 }, { c: [30, 10], r: r1, id: 'c1', from: 4 }]" :key="b.id">
          <template v-if="s.step.value >= b.from && b.r > 0.5">
            <circle :cx="X(b.c[0])" :cy="Y(b.c[1])" :r="b.r" class="boss-top" />
            <template v-if="b.r > R - 0.5">
              <path :d="half(b.c[0], b.c[1], true)" class="half lower" :class="{ rim: j === 0 && s.step.value === 6 }" />
              <path :d="half(b.c[0], b.c[1], false)" class="half upper" />
              <text :x="X(b.c[0])" :y="Y(b.c[1]) + 4" text-anchor="middle" class="face-name">{{ b.id }}.top</text>
              <text :x="X(b.c[0])" :y="Y(b.c[1] - 4) + 13" text-anchor="middle" class="tag a-text">{{ b.id }}.side0#1</text>
              <text :x="X(b.c[0])" :y="Y(b.c[1] + 4) - 5" text-anchor="middle" class="tag b-text">{{ b.id }}.side0#2</text>
              <template v-if="s.step.value === b.from">
                <circle :cx="X(b.c[0])" :cy="Y(b.c[1] - 4)" :r="2.4 + 1.6 * Math.sin(Math.PI * k)" class="key" />
                <circle :cx="X(b.c[0])" :cy="Y(b.c[1] + 4)" :r="2.4 + 1.6 * Math.sin(Math.PI * k)" class="key" />
              </template>
              <template v-if="j === 0 && s.step.value === 3">
                <circle :cx="X(6)" :cy="Y(10)" :r="3 + 2 * Math.sin(Math.PI * Math.min(1, 2 * k))" class="seam" />
                <circle :cx="X(14)" :cy="Y(10)" :r="3 + 2 * Math.sin(Math.PI * Math.max(0, Math.min(1, 2 * k - 1)))" class="seam" />
                <text :x="X(6) - 6" :y="Y(10) + 4" text-anchor="end" class="tag hot">#1</text>
                <text :x="X(14) + 6" :y="Y(10) + 4" class="tag hot">#2</text>
              </template>
            </template>
          </template>
        </g>
        <!-- Step 6: scan lines in each top piece, their candidates, the winner. -->
        <g v-if="cut && s.step.value >= 5">
          <template v-for="(list, j) in shown" :key="'p' + j">
            <template v-if="!won">
              <line v-for="(c, i) in list" :key="'l' + i" :x1="X(c.x0)" :y1="Y(c.y)" :x2="X(c.x1)" :y2="Y(c.y)" class="scan" />
              <circle v-for="(c, i) in list" :key="'c' + i" :cx="X(c.p[0])" :cy="Y(c.p[1])" r="2" class="cand" />
            </template>
            <template v-else>
              <circle :cx="X(PIECES[j].best[0])" :cy="Y(PIECES[j].best[1])" r="3.4" class="key" />
              <text :x="X(PIECES[j].best[0]) + (j ? -6 : 6)" :y="Y(PIECES[j].best[1]) + 4" :text-anchor="j ? 'end' : 'start'" class="face-name hot">{{ topName?.[j] }}</text>
            </template>
          </template>
        </g>
        <text x="40" y="228" class="readout">{{ readout }}</text>
      </svg>
      <template #note>Plate 40 × 20 × 6 mm, bosses of radius 4 at (10, 10) and (30, 10), a groove at x = 18–22: every name,
        count and key is the built kernel's for this part. Seen from above; <code>p.bottom</code> and the groove's own faces
        (<code>g.side1</code>, <code>g.side3</code>, <code>g.bottom</code>) are not drawn. The inside points are worked out in
        the page by the kernel's method and agree with its own to 10⁻¹¹ mm.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10.5px; fill: var(--vp-c-text-2); }
.top { fill: color-mix(in srgb, var(--a) 10%, transparent); stroke: var(--vp-c-text-3); stroke-width: 1.5; }
.groove { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.5; }
.lit { stroke: var(--keep); stroke-width: 3; }
.corner { fill: var(--keep); }
.edge-name { fill: var(--keep); font-weight: 600; }
.face-name { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.tag { font-size: 10px; }
.hot { fill: var(--hot); }
.a-text { fill: var(--a); } .b-text { fill: var(--b); }
.boss-top { fill: color-mix(in srgb, var(--keep) 12%, var(--vp-c-bg-soft)); stroke: none; }
.half { fill: none; stroke-width: 3; } .half.lower { stroke: var(--a); } .half.upper { stroke: var(--b); }
.half.rim { stroke: var(--keep); stroke-width: 4.5; }
.key { fill: var(--hot); }
.seam { fill: none; stroke: var(--hot); stroke-width: 1.8; }
.scan { stroke: var(--a); stroke-width: 1; stroke-dasharray: 3 2; opacity: 0.7; }
.cand { fill: var(--vp-c-text-2); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
