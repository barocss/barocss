<script setup>
// The L4 fuzz (scripts/rb/fuzz.mjs, fuzz-gen.mjs, fuzz-oracle.mjs; D188): one real case, seed 20261023 case 186 (a
// generic tree: box ∩ cone, ∪ a rounded box, ∪ an open shelled box turned 344.191° about x). Its numbers were read from
// the scripts and the built kernel in a scratch script: the oracle's intervals along 48 z rays in the section y = 1.5 mm
// (the oracle's own leaf cut/inside functions and interval algebra), its per-shift estimates at n = 32, 64, 128
// (oracle(tree, n, K) for K = 1…6), and the kernel's result (evaluateCadPart, checkOutput, tessellateBrep, massPropertiesOf).
// The tallies are the recorded runs of seed 20261023 (decisions D188, D190, D276).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
// [x, box, cone, rounded box, shelled box, the tree's result]: intervals [z₀, z₁] along the ray (x, 1.5, z), mm.
const RAYS = [
  [-1.695, [], [], [], [], []],
  [-1.499, [], [], [], [], []],
  [-1.302, [], [[1.458,1.594]], [], [], []],
  [-1.106, [], [[1.458,1.806]], [], [], []],
  [-0.91, [], [[1.458,2.015]], [], [], []],
  [-0.713, [], [[1.458,2.222]], [], [], []],
  [-0.517, [], [[1.458,2.424]], [], [], []],
  [-0.321, [], [[1.458,2.622]], [], [], []],
  [-0.124, [], [[1.458,2.815]], [], [], []],
  [0.072, [[-0.054,4.631]], [[1.458,3.002]], [], [], [[1.458,3.002]]],
  [0.268, [[-0.054,4.631]], [[1.458,3.182]], [], [], [[1.458,3.182]]],
  [0.465, [[-0.054,4.631]], [[1.458,3.354]], [], [[-1.965,0.514]], [[-1.965,0.514],[1.458,3.354]]],
  [0.661, [[-0.054,4.631]], [[1.458,3.357]], [], [[-1.965,0.514]], [[-1.965,0.514],[1.458,3.357]]],
  [0.857, [[-0.054,4.631]], [[1.458,3.357]], [], [[-1.965,0.514]], [[-1.965,0.514],[1.458,3.357]]],
  [1.054, [[-0.054,4.631]], [[1.458,3.357]], [], [[-1.965,0.514]], [[-1.965,0.514],[1.458,3.357]]],
  [1.25, [[-0.054,4.631]], [[1.458,3.357]], [], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,0.514],[1.458,3.357]]],
  [1.446, [[-0.054,4.631]], [[1.458,3.357]], [], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,0.514],[1.458,3.357]]],
  [1.642, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [1.839, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [2.035, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [2.231, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [2.428, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [2.624, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [2.82, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.017, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.213, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.409, [[-0.054,4.631]], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.606, [], [[1.458,3.357]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.802, [], [[1.458,3.288]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [3.998, [], [[1.458,3.113]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [4.195, [], [[1.458,2.93]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [4.391, [], [[1.458,2.741]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [4.587, [], [[1.458,2.545]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [4.783, [], [[1.458,2.346]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [4.98, [], [[1.458,2.142]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [5.176, [], [[1.458,1.934]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [5.372, [], [[1.458,1.724]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [5.569, [], [[1.458,1.511]], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [5.765, [], [], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [5.961, [], [], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [6.158, [], [], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [6.354, [], [], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [6.55, [], [], [[-0.175,5.842]], [[-1.965,-1.134],[-0.95,0.514]], [[-1.965,-1.134],[-0.95,5.842]]],
  [6.747, [], [], [[-0.175,5.842]], [[-1.965,0.514]], [[-1.965,5.842]]],
  [6.943, [], [], [[-0.175,5.842]], [[-1.965,0.514]], [[-1.965,5.842]]],
  [7.139, [], [], [[-0.175,5.842]], [[-1.965,0.514]], [[-1.965,5.842]]],
  [7.336, [], [], [[-0.175,5.842]], [[-1.965,0.514]], [[-1.965,5.842]]],
  [7.532, [], [], [[-0.175,5.842]], [], [[-0.175,5.842]]],
];
const HI = 20; // the ray whose lists are shown
const SHIFTS = { 32: [151.9743, 150.1522, 151.8303, 150.7272, 152.2299, 152.5922], 64: [151.327, 151.4755, 151.4867, 151.5603, 151.1311, 151.6893], 128: [151.5033, 151.506, 151.4736, 151.4584, 151.4206, 151.4553] };
const EST = [{ n: 32, v: 151.5843, e: 1.1529 }, { n: 64, v: 151.445, e: 0.2376 }, { n: 128, v: 151.4696, e: 0.0395 }];
const KERNEL = 151.4656, TOLV = 0.0791;
const RUNS = [
  { label: 'first run (D188)', ok: 104, refused: 90, bad: 6, note: '6 invalid' },
  { label: 'empty operands taken by the algebra (D190)', ok: 163, refused: 31, bad: 6, note: '6 invalid' },
  { label: 'at the end of K16 (D276)', ok: 189, refused: 11, bad: 0, note: '0 findings' },
];

const steps = [
  { label: 'A seeded tree', text: 'A generator draws a random Boolean tree from a fixed seed (mulberry32): depth at most 3, at most 6 leaves (boxes, cylinders, spheres, cones and frusta, rounded and shelled boxes), each turned up to twice and moved up to 3 mm; joins are union, difference, intersection and patterns. Half the cases are generic (sizes to 3 decimals, any angle), half agent-like (whole millimetres, quarter turns). The same seed gives the same 200 trees. This is seed 20261023, case 186: an 18-feature part document.', formula: '((box ∩ cone) ∪ rounded box) ∪ shelled box' },
  { label: 'Each leaf\'s exact intervals', text: 'The oracle uses no kernel code. It casts rays along z. For each leaf it pulls the ray into the leaf\'s own frame and solves for the parameters where the ray crosses its sides: slabs for planes, a quadratic for a cylinder, sphere or cone, discs for the rounded box\'s corners. Between those parameters it tests one midpoint inside or out. Here: 48 rays of the section y = 1.5 mm, each leaf in its own colour.', formula: 'cone: (oₓ + t dₓ)² + (o<sub>y</sub> + t d<sub>y</sub>)² = (r₁ + k (o<sub>z</sub> + t d<sub>z</sub>))², k = (r₂ − r₁)/h' },
  { label: 'Combined by the tree', text: 'Along each ray the leaves\' intervals are combined exactly as the tree says: intersection, union, difference of interval lists; a pattern is the union of its moved copies. What is left is the part of the ray inside the result. The marked ray at x = 2.231:', formula: 'box [−0.054, 4.631] ∩ cone [1.458, 3.357] → [1.458, 3.357]<br>∪ rounded box [−0.175, 5.842] → [−0.175, 5.842]<br>∪ shelled box [−1.965, −1.134] [−0.95, 0.514]<br>&nbsp;&nbsp;→ [−1.965, −1.134] [−0.95, 5.842]' },
  { label: 'Volume from the rays, six times', text: 'The volume is the sum of the inside lengths times the area each ray stands for, h²; the first moments come from the same lengths and ∫z dz. The rays stand on a square lattice turned 0.4 rad off the axes, about n² of them over the box. The lattice is integrated at 6 shifts of the rays within their cells; the mean is the value and three standard errors of it are the error estimate e.', formula: 'V = h² Σ (b − a)   ·   n = 128, K = 6: V = 151.4696 mm³, e = 0.0395 mm³' },
  { label: 'Finer lattices, smaller e', text: 'The same oracle at n = 32, 64 and 128: its estimate moves and its error bar shrinks. The kernel\'s volume for the same document (by quadrature on its exact faces) is the dashed line; it lies inside each bar.', formula: 'e: 1.153 → 0.238 → 0.0395 mm³   ·   kernel 151.4656 mm³' },
  { label: 'Judged', text: 'The case is OK when the kernel\'s output passes the strict check, its tessellation is watertight (every mesh edge used exactly twice), and its volume and centroid lie within the oracle\'s bounds. A WRONG verdict would first be confirmed by the oracle at 4n = 512 and 8 shifts; one cleared there was the oracle\'s limit.', formula: '|ΔV| = 0.0039 ≤ max(2e, 10⁻⁴ V) = 0.0791 mm³<br>max |Δc| = 0.0008 ≤ max(2e<sub>c</sub>, 10⁻⁴ × size) = 0.0035 mm' },
  { label: '200 cases a seed', text: 'Every case is OK, REFUSED (a typed error, counted by its code) or a finding: WRONG, INVALID, CRASH or TIMEOUT. A finding is shrunk to its smallest tree that still fails and saved as a replayable case. The same seed, as the kernel was fixed: the first run had 6 invalid results; at the end of K16 none.', formula: 'OK 104 → 163 → 189 · REFUSED 90 → 31 → 11<br>INVALID 6 → 6 → 0 · WRONG, CRASH, TIMEOUT 0 throughout' },
];
const s = useSteps(steps.length, [3000, 3600, 3400, 3400, 3200, 3000, 3200], root);

// Section frame: x −1.9 … 7.7 mm, z −2.1 … 5.9 mm at 21 px a mm.
const X = x => 166 + 21 * (x + 1.9), Z = z => 196 - 21 * (z + 2.1);
const LEAF = ['box', 'cone', 'rounded box', 'shelled box'];
const raysShown = computed(() => s.step.value === 0 ? 0 : s.step.value === 1 ? Math.floor(ease(s.t.value) * RAYS.length) : RAYS.length);
const leafOpacity = computed(() => s.step.value < 2 ? 1 : s.step.value === 2 ? Math.max(0, 1 - ease(s.t.value)) : 0);
const allOpacity = computed(() => s.step.value < 2 ? 0 : s.step.value === 2 ? ease(s.t.value) : 1);
const nodesShown = computed(() => s.step.value === 0 ? Math.floor(ease(s.t.value) * 7.99) : 8);
// Tree layout (node: x, y, label, kind).
const NODES = [
  { x: 84, y: 30, l: '∪', k: 'op' }, { x: 52, y: 62, l: '∪', k: 'op' }, { x: 120, y: 62, l: LEAF[3], k: 'l3' },
  { x: 30, y: 94, l: '∩', k: 'op' }, { x: 84, y: 94, l: LEAF[2], k: 'l2' }, { x: 16, y: 126, l: LEAF[0], k: 'l0' }, { x: 50, y: 126, l: LEAF[1], k: 'l1' },
];
const EDGES = [[0, 1], [0, 2], [1, 3], [1, 4], [3, 5], [3, 6]];
// Number lines.
const SX0 = 151.38, SX1 = 151.56, sx = v => 16 + 128 * (v - SX0) / (SX1 - SX0);
const shiftsShown = computed(() => s.step.value === 3 ? Math.floor(ease(s.t.value) * 6.99) : 6);
const EX0 = 150.2, EX1 = 152.9, ex = v => 16 + 128 * (v - EX0) / (EX1 - EX0);
const estShown = computed(() => s.step.value === 4 ? Math.floor(ease(s.t.value) * 3.99) : 3);
const checks = [['strict check', 'valid'], ['tessellation', '0 open edges'], ['volume', '|ΔV| 0.0039 ≤ 0.0791'], ['centroid', '0.0008 ≤ 0.0035']];
const checksShown = computed(() => s.step.value === 5 ? Math.floor(ease(s.t.value) * (checks.length + 0.99)) : checks.length);
const runsShown = computed(() => s.step.value === 6 ? ease(s.t.value) * RUNS.length : RUNS.length);
const W = 300 / 200;
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The fuzz: a random tree against the ray oracle" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A random Boolean tree, its section cut by rays along z with each leaf's intervals, the oracle's estimates and error bars, the verdict, and pass and fail tallies over 200 cases">
        <g v-if="s.step.value < 6">
          <!-- The section. -->
          <text x="166" y="18" class="small">section y = 1.5 mm · rays along z</text>
          <line x1="160" :y1="Z(0)" x2="372" :y2="Z(0)" class="axis" />
          <line :x1="X(0)" y1="24" :x2="X(0)" y2="200" class="axis" />
          <text x="370" :y="Z(0) + 12" text-anchor="end" class="small">x</text>
          <text :x="X(0) + 4" y="32" class="small">z</text>
          <g v-for="(r, i) in RAYS" :key="'r' + i" v-show="i < raysShown">
            <line :x1="X(r[0])" :y1="Z(-2.1)" :x2="X(r[0])" :y2="Z(5.9)" class="ray" :class="{ marked: i === HI && s.step.value >= 2 }" />
            <g :opacity="leafOpacity">
              <template v-for="j in 4" :key="'l' + j">
                <line v-for="(iv, q) in r[j]" :key="q" :x1="X(r[0]) + (j - 2.5) * 1.1" :y1="Z(iv[0])" :x2="X(r[0]) + (j - 2.5) * 1.1" :y2="Z(iv[1])" :class="'iv l' + (j - 1)" />
              </template>
            </g>
            <g :opacity="allOpacity">
              <line v-for="(iv, q) in r[5]" :key="'a' + q" :x1="X(r[0])" :y1="Z(iv[0])" :x2="X(r[0])" :y2="Z(iv[1])" class="iv all" :class="{ marked: i === HI }" />
            </g>
          </g>
        </g>
        <!-- The tree. -->
        <g v-if="s.step.value <= 2">
          <line v-for="(e, i) in EDGES" :key="'e' + i" v-show="e[1] < nodesShown" :x1="NODES[e[0]].x" :y1="NODES[e[0]].y" :x2="NODES[e[1]].x" :y2="NODES[e[1]].y" class="edge" />
          <g v-for="(n, i) in NODES" :key="'n' + i" v-show="i < nodesShown">
            <circle v-if="n.k === 'op'" :cx="n.x" :cy="n.y" r="9" class="op" />
            <text v-if="n.k === 'op'" :x="n.x" :y="n.y + 4" text-anchor="middle" class="opl">{{ n.l }}</text>
            <g v-else>
              <rect :x="n.x - 4" :y="n.y - 6" width="8" height="8" rx="1.5" :class="'sw ' + n.k" />
              <text :x="n.x" :y="n.y + 14" text-anchor="middle" class="small">{{ n.l }}</text>
            </g>
          </g>
          <text x="10" y="168" class="small">seed 20261023 · case 186 · generic</text>
          <text x="10" y="182" class="small">18 features in its part document</text>
        </g>
        <!-- Shifts at n = 128. -->
        <g v-if="s.step.value === 3">
          <text x="12" y="40" class="head">6 shifts, n = 128</text>
          <line x1="16" y1="120" x2="144" y2="120" class="axis" />
          <g v-for="v in [151.4, 151.45, 151.5, 151.55]" :key="v"><line :x1="sx(v)" y1="117" :x2="sx(v)" y2="123" class="axis" /><text :x="sx(v)" y="136" text-anchor="middle" class="tick">{{ v }}</text></g>
          <rect v-if="shiftsShown >= 6" :x="sx(151.4696 - 0.0395)" y="64" :width="Math.max(0, sx(151.4696 + 0.0395) - sx(151.4696 - 0.0395))" height="50" class="band" />
          <circle v-for="(v, i) in SHIFTS[128]" :key="'s' + i" v-show="i < shiftsShown" :cx="sx(v)" :cy="108 - 7 * i" r="3.2" class="est" />
          <line v-if="shiftsShown >= 6" :x1="sx(151.4696)" y1="60" :x2="sx(151.4696)" y2="120" class="mean" />
          <text v-if="shiftsShown >= 6" x="12" y="160" class="small">mean 151.4696 mm³</text>
          <text v-if="shiftsShown >= 6" x="12" y="174" class="small">e = 3 standard errors = 0.0395</text>
        </g>
        <!-- Finer lattices. -->
        <g v-if="s.step.value === 4">
          <text x="12" y="40" class="head">oracle ± e, and the kernel</text>
          <line x1="16" y1="150" x2="144" y2="150" class="axis" />
          <g v-for="v in [150.5, 151.5, 152.5]" :key="v"><line :x1="ex(v)" y1="147" :x2="ex(v)" y2="153" class="axis" /><text :x="ex(v)" y="166" text-anchor="middle" class="tick">{{ v }}</text></g>
          <g v-for="(r, i) in EST" :key="'n' + r.n" v-show="i < estShown">
            <text x="12" :y="72 + 26 * i" class="tick">n = {{ r.n }}</text>
            <line :x1="ex(r.v - r.e)" :y1="80 + 26 * i" :x2="ex(r.v + r.e)" :y2="80 + 26 * i" class="bar" />
            <circle :cx="ex(r.v)" :cy="80 + 26 * i" r="3" class="est" />
          </g>
          <line :x1="ex(KERNEL)" y1="56" :x2="ex(KERNEL)" y2="150" class="kernel" />
          <text :x="ex(KERNEL) + 4" y="182" class="small">kernel 151.4656</text>
        </g>
        <!-- The verdict. -->
        <g v-if="s.step.value === 5">
          <text x="12" y="40" class="head">case 186</text>
          <g v-for="(c, i) in checks" :key="c[0]" v-show="i < checksShown">
            <text x="12" :y="64 + 24 * i" class="small">{{ c[0] }}</text>
            <text x="12" :y="76 + 24 * i" class="small keep">✓ {{ c[1] }}</text>
          </g>
          <text v-if="checksShown >= checks.length" x="12" y="172" class="verdict">OK</text>
        </g>
        <!-- Tallies. -->
        <g v-if="s.step.value === 6">
          <text x="20" y="30" class="head">seed 20261023 · 200 cases a run</text>
          <g v-for="(r, i) in RUNS" :key="r.label" :opacity="Math.max(0, Math.min(1, runsShown - i))">
            <text x="20" :y="62 + 52 * i" class="small">{{ r.label }}</text>
            <text x="360" :y="62 + 52 * i" text-anchor="end" class="small" :class="r.bad ? 'hot' : 'keep'">{{ r.note }}</text>
            <rect x="20" :y="68 + 52 * i" :width="W * r.ok * Math.max(0, Math.min(1, runsShown - i))" height="16" class="seg ok" />
            <rect :x="20 + W * r.ok" :y="68 + 52 * i" :width="W * r.refused * Math.max(0, Math.min(1, runsShown - i))" height="16" class="seg refused" />
            <rect :x="20 + W * (r.ok + r.refused)" :y="68 + 52 * i" :width="W * r.bad * Math.max(0, Math.min(1, runsShown - i))" height="16" class="seg bad" />
            <text x="24" :y="80 + 52 * i" class="segl">{{ r.ok }} OK</text>
            <text :x="20 + W * r.ok + 4" :y="80 + 52 * i" class="segl">{{ r.refused }}</text>
          </g>
          <rect x="20" y="222" width="10" height="10" class="seg ok" /><text x="34" y="231" class="small">OK (incl. empty)</text>
          <rect x="130" y="222" width="10" height="10" class="seg refused" /><text x="144" y="231" class="small">REFUSED, typed</text>
          <rect x="240" y="222" width="10" height="10" class="seg bad" /><text x="254" y="231" class="small">INVALID</text>
        </g>
        <g v-if="s.step.value < 2" class="legend">
          <template v-for="(l, j) in LEAF" :key="'g' + j"><rect :x="12 + 88 * j" y="232" width="8" height="8" rx="1.5" :class="'sw l' + j" /><text :x="24 + 88 * j" y="240" class="small">{{ l }}</text></template>
        </g>
        <g v-else-if="s.step.value < 6" class="legend">
          <rect x="166" y="232" width="8" height="8" rx="1.5" class="sw all" /><text x="178" y="240" class="small">inside the tree's result, along each ray</text>
        </g>
      </svg>
      <template #note>The section and its 48 rays are for the picture; the oracle's rays stand on a lattice of about n² rays
        over the whole box, turned 0.4 rad about z. Every number is from the scripts and the built kernel for this case, or
        from the recorded runs of the seed.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; }
.tick { font-size: 10px; font-variant-numeric: tabular-nums; }
.head { font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1; }
.ray { stroke: var(--vp-c-divider); stroke-width: 0.8; }
.ray.marked { stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-dasharray: 3 2; }
.iv { stroke-width: 1.3; stroke-linecap: butt; }
.iv.l0, .sw.l0 { stroke: var(--a); fill: var(--a); }
.iv.l1, .sw.l1 { stroke: var(--b); fill: var(--b); }
.iv.l2, .sw.l2 { stroke: var(--keep); fill: var(--keep); }
.iv.l3, .sw.l3 { stroke: var(--vp-c-text-2); fill: var(--vp-c-text-2); }
.iv.all { stroke: var(--a); stroke-width: 2.4; }
.sw.all { fill: var(--a); }
.iv.all.marked { stroke: var(--vp-c-text-1); stroke-width: 3; }
.edge { stroke: var(--vp-c-text-3); stroke-width: 1; }
.op { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.opl { font-size: 12px; font-weight: 700; fill: var(--vp-c-text-1); }
.band { fill: color-mix(in srgb, var(--a) 18%, transparent); }
.est { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.mean { stroke: var(--a); stroke-width: 1.5; }
.bar { stroke: var(--a); stroke-width: 2; }
.kernel { stroke: var(--b); stroke-width: 1.5; stroke-dasharray: 4 3; }
.keep { fill: var(--keep); }
.hot { fill: var(--hot); }
.verdict { font-size: 16px; font-weight: 700; fill: var(--keep); }
.seg.ok { fill: var(--keep); }
.seg.refused { fill: var(--vp-c-text-3); }
.seg.bad { fill: var(--hot); }
.segl { font-size: 10px; font-weight: 700; fill: var(--vp-c-bg); }
</style>
