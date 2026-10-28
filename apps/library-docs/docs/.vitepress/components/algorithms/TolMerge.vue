<script setup>
// The stitch's vertex merge (packages/barocss-cad/src/brep/analytic-boolean.ts, class PointSet3 and stitchWith). The class
// below is the kernel's, copied as it is: a point joins the first stored point within eps (cell order, then insertion
// order), else it is stored. The stitch uses eps = 20 ε, ε the Boolean's tolerance. Points here are in units of that
// radius r and lie in one plane (z = 0); the kernel's are 3D, its cells cubes.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

class PointSet3 {
  constructor(eps) { this.eps = eps; this.cell = eps * 16; this.points = []; this.grid = new Map(); }
  find(p) {
    const c = this.cell, gx = Math.floor(p[0] / c), gy = Math.floor(p[1] / c), gz = Math.floor(p[2] / c), P = this.points, eps = this.eps, r = 2 * eps;
    const x0 = p[0] - gx * c <= r ? -1 : 0, x1 = (gx + 1) * c - p[0] <= r ? 1 : 0, y0 = p[1] - gy * c <= r ? -1 : 0, y1 = (gy + 1) * c - p[1] <= r ? 1 : 0, z0 = p[2] - gz * c <= r ? -1 : 0, z1 = (gz + 1) * c - p[2] <= r ? 1 : 0;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let m = z0; m <= z1; m++) {
      const g = this.grid.get((gx + i) + ',' + (gy + j) + ',' + (gz + m));
      if (g) for (const v of g) { const q = P[v]; if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= eps) return v; }
    }
    return -1;
  }
  add(p) {
    const f = this.find(p); if (f >= 0) return f;
    const v = this.points.length, c = this.cell, k = Math.floor(p[0] / c) + ',' + Math.floor(p[1] / c) + ',' + Math.floor(p[2] / c);
    this.points.push(p); const g = this.grid.get(k); if (g) g.push(v); else this.grid.set(k, [v]); return v;
  }
}
/** Each point's vertex when the points are added in this order, whether it was stored, and each vertex's first point. */
function merge(points) {
  const set = new PointSet3(1), of = [], stored = [], rep = [];
  for (const [i, p] of points.entries()) {
    const before = set.points.length, v = set.add([p[0], p[1], 0]);
    of.push(v); stored.push(set.points.length > before); if (stored[i]) rep[v] = i;
  }
  return { of, stored, rep, count: set.points.length };
}

const root = ref(null);
// Steps 1–2: five piece ends near a corner (offset by 100 so no point sits on a cell side).
const CL = [[0, 0], [0.55, 0.35], [1.45, 0.1], [0.9, 0.9], [-0.3, 0.7]];
const CL_DIR = [200, 250, -20, 60, 150].map(a => a * Math.PI / 180);
const CLM = merge(CL.map(p => [p[0] + 100.2, p[1] + 100.2]));
const CR = 50, CX = p => 105 + CR * p[0], CY = p => 150 - CR * p[1];
// Steps 3–4: a chain, each point 0.7 r from the next, added left to right, then right to left.
const CH = Array.from({ length: 7 }, (_, i) => [0.7 * i, 0]);
const LR = merge(CH.map(p => [p[0] + 100.2, 100.2]));
const RL = { raw: merge([...CH].reverse().map(p => [p[0] + 100.2, 100.2])) };
// The vertex index of chain point i in the right-to-left run, and whether it was stored.
const rlOf = i => CH.length - 1 - i;
const HR = 34, HX = x => 40 + HR * x;
// Step 5: one cell of 16 r with its neighbours; a neighbour is read only within 2 r of the shared side.
const G = 96, GR = G / 16, GX0 = 142, GY0 = 30;
const gpath = u => [GX0 + G * (0.5 + 0.47 * Math.sin(2 * Math.PI * u)), GY0 + G * (0.55 + 0.4 * Math.cos(2 * Math.PI * u))];
// Step 6: two pieces of one ring; the traced piece starts 3 r from where the exact one ends.
const AR = 16, A_END = [175, 130], A_START = [175 + 3 * AR * Math.cos(0.5), 130 - 3 * AR * Math.sin(0.5)];

const steps = [
  { label: 'A merge radius', text: 'The stitch gathers the ends of every kept piece\'s boundary curves into vertices. Each end is looked up among the vertices so far: the first one within r, the merge radius, is its vertex; if there is none, the end becomes a new vertex. r is 20 ε, where ε is the Boolean\'s tolerance: 2 × 10⁻⁵ mm within the modeling range.', formula: 'vertex(p) = the first stored q with |q − p| ≤ r, else p itself &nbsp; · &nbsp; r = 20 ε' },
  { label: 'The first point stays', text: 'A vertex sits where its first end was; the ends that join it move onto it, by up to r. P3 is 0.65 r from P1, but P1 was not stored (it joined P0), so P3 is compared with P0 and P2 only, and joins P2.', formula: '|P3 − P1| = 0.65 r, &nbsp; |P3 − P0| = 1.27 r, &nbsp; |P3 − P2| = 0.97 r &nbsp;⇒&nbsp; P3 → P2' },
  { label: 'A chain is not one vertex', text: 'Seven points, each 0.7 r from the next. Joining "within r" is not transitive: P1 joins P0, but P2 is 1.4 r from P0 and becomes a new vertex though it is 0.7 r from P1. The chain gives four vertices, not one. Closing the relation (every point linked to any point within r) would give one vertex 4.2 r wide, far more than r.', formula: 'p ~ q and q ~ s does not give p ~ s' },
  { label: 'Order decides the groups', text: 'Added from the right, the same seven points give four vertices again, grouped differently: {P6, P5}, {P4, P3}, {P2, P1}, {P0}. The kernel adds ends in one fixed order (the pieces\', then each ring\'s), so a result is reproducible; the grouping it gives is a property of that order, not of the points.', formula: 'left → right: {0,1} {2,3} {4,5} {6} &nbsp; · &nbsp; right → left: {6,5} {4,3} {2,1} {0}' },
  { label: 'Only nearby cells are read', text: 'Vertices are kept in a grid of cubic cells 16 r wide. A lookup reads the point\'s own cell, and a neighbour only when the point lies within 2 r of the side they share: a vertex beyond that side is farther than r. Most lookups read one cell, not 27.', formula: 'read the neighbour across a side ⇔ distance to that side ≤ 2 r &nbsp; (cell = 16 r)' },
  { label: 'Ring neighbours, more loosely', text: 'Where a traced curve meets the next piece of its ring, its end can land farther away than r: within its tracing tolerance of the exact curve. So after the merge, the end of each piece and the start of the next are joined when within 100 ε (5 r), with a union-find: this joining is transitive, but only between neighbours in one ring.', formula: '|end(kᵢ) − start(kᵢ₊₁)| ≤ 100 ε ⇒ one vertex (alias, canon)' },
];
const s = useSteps(steps.length, [5000, 3600, 5200, 5200, 6400, 4200], root);
const k = computed(() => ease(s.t.value));
const scene = computed(() => (s.step.value <= 1 ? 'cluster' : s.step.value <= 3 ? 'chain' : s.step.value === 4 ? 'grid' : 'alias'));

// Cluster: how many ends have arrived, and each one's drawn position (moving onto its vertex in step 2).
const clShown = computed(() => (s.step.value === 0 ? Math.min(CL.length, Math.floor(s.t.value * (CL.length + 0.6))) : CL.length));
const clPos = i => {
  const p = CL[i], q = CL[CLM.rep[CLM.of[i]]];
  const f = s.step.value === 1 ? k.value : 0;
  return [CX(p) + (CX(q) - CX(p)) * f, CY(p) + (CY(q) - CY(p)) * f];
};
const CL_REP = CLM.rep; // the stored points: P0 and P2
const clText = i => (i >= clShown.value ? '' : CLM.stored[i] ? `P${i} → new vertex v${CLM.of[i]}` : `P${i} → v${CLM.of[i]}`);

// Chain: how many points of each row have arrived.
const lrShown = computed(() => (s.step.value === 2 ? Math.min(7, Math.floor(s.t.value * 7.6)) : s.step.value > 2 ? 7 : 0));
const rlShown = computed(() => (s.step.value === 3 ? Math.min(7, Math.floor(s.t.value * 7.6)) : 0));
const COLORS = ['va', 'vb', 'va', 'vb'];

// Grid: the moving point and the cells it reads.
const gp = computed(() => (scene.value === 'grid' ? gpath(s.t.value) : gpath(0)));
const gread = computed(() => {
  const [x, y] = gp.value, gx = Math.floor((x - GX0) / G), gy = Math.floor((y - GY0) / G), lx = x - GX0 - gx * G, ly = y - GY0 - gy * G, r2 = 2 * GR;
  const xs = [gx], ys = [gy];
  if (lx <= r2) xs.push(gx - 1); if (G - lx <= r2) xs.push(gx + 1);
  if (ly <= r2) ys.push(gy - 1); if (G - ly <= r2) ys.push(gy + 1);
  const out = []; for (const i of xs) for (const j of ys) out.push(i + ',' + j);
  return out;
});
const CELLS = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) CELLS.push({ i, j });

// Alias: the two vertices drawn apart, then joined.
const join = computed(() => (s.step.value === 5 ? Math.max(0, Math.min(1, (s.t.value - 0.45) / 0.4)) : 0));
const readout = computed(() => {
  if (scene.value === 'cluster') return s.step.value === 0 ? `${Math.min(clShown.value, CL.length)} ends added · ${CLM.of.slice(0, clShown.value).reduce((m, v) => Math.max(m, v + 1), 0)} vertices` : '5 ends → 2 vertices, each at its first end';
  if (scene.value === 'chain') return s.step.value === 2 ? `left → right: ${LR.of.slice(0, lrShown.value).reduce((m, v) => Math.max(m, v + 1), 0)} vertices` : `right → left: ${RL.raw.of.slice(0, rlShown.value).reduce((m, v) => Math.max(m, v + 1), 0)} vertices, other groups`;
  if (scene.value === 'grid') return `cells read: ${gread.value.length} of the 9 around it (27 in 3D)`;
  return join.value < 1 ? '3 r apart: two vertices after the merge' : 'within 100 ε = 5 r: aliased to one vertex';
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Merging points within a radius" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="Curve ends joining vertices within a merge radius, a chain of points that does not collapse into one, the grid of cells and the ring-neighbour alias">
        <!-- Steps 1–2: a corner where five piece ends arrive. -->
        <g v-if="scene === 'cluster'">
          <circle v-for="v in CL_REP" v-show="v < clShown" :key="'r' + v" :cx="CX(CL[v])" :cy="CY(CL[v])" :r="CR" class="radius" :class="v === 0 ? 'va' : 'vb'" />
          <g v-for="(p, i) in CL" v-show="i < clShown" :key="'p' + i">
            <line :x1="clPos(i)[0]" :y1="clPos(i)[1]" :x2="clPos(i)[0] + 44 * Math.cos(CL_DIR[i])" :y2="clPos(i)[1] - 44 * Math.sin(CL_DIR[i])" class="stub" />
            <circle :cx="clPos(i)[0]" :cy="clPos(i)[1]" :r="CLM.stored[i] ? 4.5 : 3.2" class="pt" :class="[CLM.of[i] === 0 ? 'va' : 'vb', { stored: CLM.stored[i] }]" />
            <text :x="CX(p) + 6" :y="CY(p) + 13" class="tag">P{{ i }}</text>
          </g>
          <line :x1="CX([0, 0])" :y1="CY([0, 0]) + 70" :x2="CX([1, 0])" :y2="CY([0, 0]) + 70" class="scale" />
          <text :x="CX([0.5, 0])" :y="CY([0, 0]) + 82" text-anchor="middle" class="tag">r = 20 ε</text>
          <text v-for="(p, i) in CL" :key="'l' + i" x="240" :y="62 + 18 * i" class="tag" :class="CLM.of[i] === 0 ? 'ta' : 'tb'">{{ clText(i) }}</text>
        </g>

        <!-- Steps 3–4: a chain of points 0.7 r apart. -->
        <g v-if="scene === 'chain'">
          <text x="40" y="52" class="tag">added left → right</text>
          <g v-for="(p, i) in CH" v-show="i < lrShown" :key="'a' + i">
            <circle v-if="LR.stored[i]" :cx="HX(p[0])" cy="90" :r="HR" class="radius" :class="COLORS[LR.of[i]]" />
          </g>
          <g v-for="(p, i) in CH" :key="'b' + i">
            <circle :cx="HX(p[0])" cy="90" :r="LR.stored[i] ? 4.5 : 3.2" class="pt" :class="i < lrShown ? [COLORS[LR.of[i]], { stored: LR.stored[i] }] : 'idle'" />
            <text :x="HX(p[0])" y="76" text-anchor="middle" class="tag">P{{ i }}</text>
          </g>
          <g v-if="s.step.value === 3">
            <text x="40" y="150" class="tag">added right → left</text>
            <g v-for="(p, i) in CH" :key="'c' + i">
              <circle v-if="CH.length - 1 - i < rlShown && RL.raw.stored[rlOf(i)]" :cx="HX(p[0])" cy="190" :r="HR" class="radius" :class="COLORS[RL.raw.of[rlOf(i)]]" />
            </g>
            <g v-for="(p, i) in CH" :key="'d' + i">
              <circle :cx="HX(p[0])" cy="190" :r="RL.raw.stored[rlOf(i)] ? 4.5 : 3.2" class="pt" :class="CH.length - 1 - i < rlShown ? [COLORS[RL.raw.of[rlOf(i)]], { stored: RL.raw.stored[rlOf(i)] }] : 'idle'" />
              <text :x="HX(p[0])" y="214" text-anchor="middle" class="tag">P{{ i }}</text>
            </g>
          </g>
          <g v-else>
            <line :x1="HX(0)" y1="150" :x2="HX(1)" y2="150" class="scale" />
            <text :x="HX(0.5)" y="163" text-anchor="middle" class="tag">r</text>
            <line :x1="HX(0)" y1="128" :x2="HX(0) + (HX(4.2) - HX(0)) * (lrShown >= 7 ? 1 : 0)" y2="128" class="closure" />
            <text v-if="lrShown >= 7" :x="HX(4.2) + 6" y="131" class="tag hot">closure: one vertex 4.2 r wide</text>
          </g>
        </g>

        <!-- Step 5: cells of 16 r; the neighbours read near a side. -->
        <g v-if="scene === 'grid'">
          <rect v-for="c in CELLS" :key="'g' + c.i + c.j" :x="GX0 + G * (c.i - 1)" :y="GY0 + G * c.j" :width="G" :height="G" class="cell" :class="{ read: gread.includes((c.i - 1) + ',' + c.j) }" />
          <rect v-for="c in CELLS" :key="'band' + c.i + c.j" :x="GX0 + G * (c.i - 1) + 2 * GR" :y="GY0 + G * c.j + 2 * GR" :width="G - 4 * GR" :height="G - 4 * GR" class="inner" />
          <circle :cx="gp[0]" :cy="gp[1]" :r="GR" class="radius va" />
          <circle :cx="gp[0]" :cy="gp[1]" r="3.5" class="pt va stored" />
          <text :x="GX0 + 2 * G - 2" :y="GY0 - 6" text-anchor="end" class="tag">cell 16 r · band 2 r</text>
        </g>

        <!-- Step 6: two pieces of one ring, their ends 3 r apart. -->
        <g v-if="scene === 'alias'">
          <path :d="`M 40 160 Q 110 100 ${A_END[0]} ${A_END[1]}`" class="exact" />
          <path :d="`M ${A_START[0] + (A_END[0] - A_START[0]) * join} ${A_START[1] + (A_END[1] - A_START[1]) * join} C 240 80 290 150 345 90`" class="traced" />
          <text x="56" y="176" class="tag a">kᵢ: exact curve</text>
          <text x="262" y="150" class="tag b">kᵢ₊₁: traced curve</text>
          <circle :cx="A_END[0]" :cy="A_END[1]" :r="5 * AR" class="alias" />
          <circle :cx="A_END[0]" :cy="A_END[1]" :r="AR" class="radius va" />
          <circle :cx="A_START[0] + (A_END[0] - A_START[0]) * join" :cy="A_START[1] + (A_END[1] - A_START[1]) * join" :r="AR" class="radius vb" :style="{ opacity: 1 - join }" />
          <circle :cx="A_END[0]" :cy="A_END[1]" r="4.5" class="pt va stored" />
          <circle :cx="A_START[0] + (A_END[0] - A_START[0]) * join" :cy="A_START[1] + (A_END[1] - A_START[1]) * join" r="4.5" class="pt vb stored" :style="{ opacity: 1 - 0.7 * join }" />
          <text :x="A_END[0]" :y="A_END[1] + 5 * AR + 13" text-anchor="middle" class="tag">100 ε = 5 r</text>
        </g>
        <text x="12" y="244" class="readout">{{ readout }}</text>
      </svg>
      <template #note>Drawn in one plane, in units of the merge radius r; the kernel's points are 3D and r is 2 × 10⁻⁵ mm
        in the modeling range. The merge is the kernel's <code>PointSet3</code>, copied and run in the page on these points.
        The tracing tolerance in the last step is drawn larger than r for clarity.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 10.5px; fill: var(--vp-c-text-2); }
.radius { stroke-width: 1.2; stroke-dasharray: 3 2; }
.radius.va { fill: color-mix(in srgb, var(--a) 12%, transparent); stroke: var(--a); }
.radius.vb { fill: color-mix(in srgb, var(--b) 12%, transparent); stroke: var(--b); }
.pt { stroke: var(--vp-c-bg); stroke-width: 1; }
.pt.va { fill: var(--a); } .pt.vb { fill: var(--b); } .pt.idle { fill: var(--vp-c-text-3); }
.pt.stored { stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.stub { stroke: var(--vp-c-text-3); stroke-width: 1.6; }
.scale { stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.closure { stroke: var(--hot); stroke-width: 2; stroke-dasharray: 4 2; }
.tag.ta { fill: var(--a); } .tag.tb { fill: var(--b); } .tag.a { fill: var(--a); font-weight: 600; } .tag.b { fill: var(--b); font-weight: 600; }
.tag.hot { fill: var(--hot); font-weight: 600; }
.cell { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 1; transition: fill .15s; }
.cell.read { fill: color-mix(in srgb, var(--keep) 18%, var(--vp-c-bg)); stroke: var(--keep); }
.inner { fill: none; stroke: var(--vp-c-divider); stroke-dasharray: 2 2; }
.exact { fill: none; stroke: var(--a); stroke-width: 2.2; }
.traced { fill: none; stroke: var(--b); stroke-width: 2.2; stroke-dasharray: 5 2; }
.alias { fill: none; stroke: var(--keep); stroke-width: 1.4; stroke-dasharray: 5 3; }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
