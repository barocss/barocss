<script setup>
// A cube's B-rep record by record (brep-core.ts). The records are the kernel's: the 20 mm cube that
// cad.model().sketch.rectangle({ width: 20, height: 20 }).extrude(20) builds, read with brepFromBody(…) from the built
// kernel (packages/barocss-cad/dist/index.js): its vertex points, each edge's two vertices, each face's sense and the
// (edge, sense) of its outer loop's coedges, in the kernel's order. Ids drop their 'm1_solid/shell/', 'm1_' prefixes.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const P = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]];
/** Edge i runs from vertex EV[i][0] (its domain's start) to EV[i][1]. */
const EV = [[1, 0], [2, 1], [3, 2], [0, 3], [4, 5], [5, 6], [6, 7], [7, 4], [1, 5], [4, 0], [2, 6], [3, 7]];
const HIDDEN = new Set([2, 3, 11]); // the edges through v3, behind the cube in this view
// Each face: its id, sense, its outer loop's coedges [edge, forward?] and where its points go in the unfolded net
// (math axes, viewed from outside: every outer loop then runs counter-clockwise).
const FACES = [
  { id: 'b', sense: 'reversed', uses: [[3, 1], [2, 1], [1, 1], [0, 1]], net: p => [p[0], -20 - p[1]] },
  { id: 't', sense: 'forward', uses: [[4, 1], [5, 1], [6, 1], [7, 1]], net: p => [p[0], p[1]] },
  { id: 'w_0', sense: 'forward', uses: [[0, 0], [8, 1], [4, 0], [9, 1]], net: p => [p[0], p[2] - 20] },
  { id: 'w_1', sense: 'forward', uses: [[1, 0], [10, 1], [5, 0], [8, 0]], net: p => [40 - p[2], p[1]] },
  { id: 'w_2', sense: 'forward', uses: [[2, 0], [11, 1], [6, 0], [10, 0]], net: p => [p[0], 40 - p[2]] },
  { id: 'w_3', sense: 'forward', uses: [[3, 0], [9, 0], [7, 0], [11, 0]], net: p => [p[2] - 20, p[1]] },
];

// An orthographic view from (0.5, −1, 0.75): top, front (y = 0) and right (x = 20) faces visible.
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const D = norm([0.5, -1, 0.75]), RT = norm([1, 0.5, 0]);
const UP = [D[1] * RT[2] - D[2] * RT[1], D[2] * RT[0] - D[0] * RT[2], D[0] * RT[1] - D[1] * RT[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const view = p => [80 + 3.6 * dot(p, RT), 160 - 3.6 * dot(p, UP)];
// The net, turned a quarter turn clockwise so it lies across the figure: b | w_0 | t | w_2, w_3 above t, w_1 below.
const netScreen = ([x, y]) => [128 + 2.55 * y, 80 + 2.55 * x];

const lerp = (a, b, m) => [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
const pts = list => list.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const clamp01 = x => Math.max(0, Math.min(1, x));
/** An arrowhead at b pointing from a to b. */
function head(a, b, size = 4.6) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, w = 0.55 * size;
  return pts([b, [b[0] - size * ux + w * uy, b[1] - size * uy - w * ux], [b[0] - size * ux - w * uy, b[1] - size * uy + w * ux]]);
}

const ISO = P.map(view);
/** Back faces first, so the faces start their unfolding in front-to-back order. */
const DRAW_ORDER = [0, 4, 5, 1, 2, 3];
const start = u => (u[1] ? EV[u[0]][0] : EV[u[0]][1]), end = u => (u[1] ? EV[u[0]][1] : EV[u[0]][0]);
const NET = FACES.map(f => f.uses.map(u => netScreen(f.net(P[start(u)]))));
const CENTRE = NET.map(c => [(c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4]);
// Every coedge: its face, place in the loop, edge, sense, ends, and its arrow drawn inside its face.
const COEDGES = FACES.flatMap((f, fi) => f.uses.map((u, k) => {
  const a = NET[fi][k], b = NET[fi][(k + 1) % 4], c = CENTRE[fi];
  const a1 = lerp(a, c, 0.2), b1 = lerp(b, c, 0.2);
  return { fi, k, edge: u[0], forward: !!u[1], from: start(u), to: end(u), side: [a, b], p: lerp(a1, b1, 0.12), q: lerp(a1, b1, 0.88) };
}));
const key = (fi, k) => fi * 4 + k;
const TWINS = EV.map((_, e) => COEDGES.filter(c => c.edge === e));
/** The walk round v5 (incoming, next, twin, …): t c0 → t c1 → w_1 c2 → w_1 c3 → w_0 c1 → w_0 c2 → back to t c0. */
const WALK = [[1, 0], [1, 1], [3, 2], [3, 3], [2, 1], [2, 2]].map(([fi, k]) => key(fi, k));
const V5 = [[1, NET[1][1]], [2, NET[2][2]], [3, NET[3][3]]];

const steps = [
  { label: 'Vertices', text: 'A B-rep (boundary representation) describes a solid by its boundary. Its records sit in flat lists keyed by id, so a whole B-rep is plain JSON. The smallest record is a <b>vertex</b>: an id, a point and a tolerance. This 20 mm cube has eight, each with tolerance 10⁻⁷ mm.', formula: 'vertex { id, point, tolerance } · tolerance = max(10⁻⁷ mm, 10⁻¹¹ × the largest coordinate)' },
  { label: 'Edges', text: 'An <b>edge</b> is a 3D curve, here a straight degree-1 NURBS, run over its whole domain: from <code>vertices[0]</code> at the domain\'s start to <code>vertices[1]</code> at its end. The arrows show each edge\'s own direction. The check evaluates the curve at both ends and measures the distance to each vertex.', formula: '|C(t₀) − vertices[0]| and |C(t₁) − vertices[1]| ≤ max(tol<sub>vertex</sub>, tol<sub>edge</sub>)' },
  { label: 'Faces', text: 'A <b>face</b> is a surface, a <i>sense</i> and its loops; faces belong to a <b>shell</b>, shells to a <b>body</b>. Unfolded, all six faces show at once. Each is a flat bilinear patch S(u, v). Sense forward means the outward normal is ∂S/∂u × ∂S/∂v. The bottom\'s patch has that normal pointing up into the cube, so its sense is reversed.', formula: 'n<sub>out</sub> = ∂S/∂u × ∂S/∂v (forward) or −∂S/∂u × ∂S/∂v (reversed)' },
  { label: 'Loops of coedges', text: 'Each face has exactly one <b>outer loop</b>; a hole would be an inner loop. A loop is a cycle of <b>coedges</b>. A coedge is one use of an edge, with a sense (forward runs it from vertices[0] to vertices[1]) and next/prev links. The check asks that next and prev follow the listed order and that each coedge ends where the next starts. Seen from outside, the outer loop runs counter-clockwise.', formula: 'end(c) = start(next(c)) · 6 loops × 4 = 24 coedges' },
  { label: 'Twins: each edge used once each way', text: 'In a closed shell every edge has exactly two coedges, and they are each other\'s <b>twin</b>: the same edge, opposite senses. The two faces on either side run along it in opposite directions, so no edge is left open. <code>buildBrep</code> pairs the two uses of each edge; the check counts each edge\'s uses and checks the pairs.', formula: 'uses(e) = 2 · twin(twin(c)) = c · sense(twin(c)) ≠ sense(c)' },
  { label: 'Around a vertex', text: 'At each vertex of a closed shell, the faces must form a single fan. Start from a coedge that ends at the vertex, step to the next coedge (which leaves it), then to that coedge\'s twin (which ends at it again). The walk must reach every coedge ending there before it comes back. At v5 it reaches all three.', formula: 'c → twin(next(c)) · v5: t c0 → w_1 c2 → w_0 c1 → t c0' },
  { label: 'Euler–Poincaré', text: 'Last come the counts. For each body, <code>checkBrep</code> counts the vertices V and edges E that its coedges reach, its faces F, loops L and shells S, and solves Euler–Poincaré for the genus G, the number of through holes. L − F is the number of inner loops. For a solid whose shells are all closed, G must be a whole number, 0 or more.', formula: 'V − E + F − (L − F) = 2(S − G) · 8 − 12 + 6 − 0 = 2 = 2(1 − 0) · G = 0' },
];
const s = useSteps(steps.length, [2600, 3600, 2800, 4600, 6000, 4200, 3600], root);
const st = computed(() => s.step.value);

const morph = computed(() => (st.value < 2 ? 0 : st.value === 2 ? ease(s.t.value) : 1));
const facePolys = computed(() => FACES.map((f, fi) => pts(f.uses.map((u, k) => lerp(ISO[start(u)], NET[fi][k], morph.value)))));
const wire = computed(() => (st.value < 2 ? 1 : st.value === 2 ? 1 - ease(s.t.value) : 0));
const vertexGrow = i => (st.value === 0 ? clamp01(s.t.value * 8.5 - i) : 1);
const edgeGrow = i => (st.value === 0 ? 0 : st.value === 1 ? clamp01(s.t.value * 12.5 - i) : 1);
const edges3d = computed(() => EV.map(([a, b], i) => {
  const g = edgeGrow(i), A = ISO[a], B = lerp(ISO[a], ISO[b], g), mid = lerp(ISO[a], ISO[b], 0.58);
  return { a: A, b: B, g, hidden: HIDDEN.has(i), head: g >= 0.6 ? head(ISO[a], mid) : '' };
}));
const LABEL_OFFSET = [[-14, 4], [2, 13], [6, 10], [-14, -4], [-16, 2], [5, 14], [7, 2], [-4, -8]];

// Coedges drawn: one face's loop after another in step 4; all from then on.
const coedgeGrow = c => {
  if (st.value < 3) return 0;
  if (st.value > 3) return 1;
  return clamp01(s.t.value * 25 - (c.fi * 4 + c.k) - 0.3);
};
const twinIndex = computed(() => (st.value === 4 ? Math.min(11, Math.floor(s.t.value * 12)) : -1));
const walkCount = computed(() => (st.value === 5 ? Math.min(6, Math.floor(s.t.value * 7)) : 0));
const coedgeClass = c => {
  const i = key(c.fi, c.k);
  if (st.value === 4) return TWINS[twinIndex.value].includes(c) ? 'hot' : 'dim';
  if (st.value === 5) { const w = WALK.indexOf(i); return w >= 0 && w < walkCount.value ? (w % 2 ? 'out' : 'hot') : 'dim'; }
  return '';
};
const shown = c => { const g = coedgeGrow(c); return g > 0 ? { p: c.p, q: lerp(c.p, c.q, g), head: g > 0.5 ? head(c.p, lerp(c.p, c.q, g)) : '' } : null; };
const coedgesDrawn = computed(() => COEDGES.map(c => ({ c, d: shown(c), cls: coedgeClass(c) })).filter(x => x.d));

const readout = computed(() => {
  const t = s.t.value;
  if (st.value === 0) { const n = Math.min(8, Math.floor(t * 8.5)); return n ? `v${n - 1} = (${P[n - 1].join(', ')})` : ''; }
  if (st.value === 1) { const i = Math.min(11, Math.floor(t * 12.5)); return `e${i}: vertices [v${EV[i][0]}, v${EV[i][1]}]`; }
  if (st.value === 4) {
    const [x, y] = TWINS[twinIndex.value], use = c => `${FACES[c.fi].id} c${c.k} ${c.forward ? 'forward' : 'reversed'} (v${c.from} → v${c.to})`;
    return `e${twinIndex.value}: ${use(x)} · ${use(y)}`;
  }
  if (st.value === 5) return `ending at v5: t c0, w_1 c2, w_0 c1 · walked ${Math.ceil(walkCount.value / 2)} of 3`;
  return '';
});
const counts = computed(() => {
  const t = s.t.value, n = st.value;
  const v = n === 0 ? Math.min(8, Math.floor(t * 8.5)) : 8, e = n === 0 ? null : n === 1 ? Math.min(12, Math.floor(t * 12.5)) : 12;
  const ce = n < 3 ? null : n === 3 ? COEDGES.filter(c => coedgeGrow(c) >= 1).length : 24;
  return [['bodies', n >= 2 ? 1 : null], ['shells', n >= 2 ? 1 : null], ['faces', n >= 2 ? 6 : null], ['loops', n >= 3 ? 6 : null], ['coedges', ce], ['edges', e], ['vertices', v]];
});
const euler = computed(() => (st.value < 6 ? 0 : Math.min(4, Math.floor(s.t.value * 4.6) + 1)));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A cube's B-rep, record by record" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A 20 mm cube's vertices and edges, unfolded into its six faces with their loops of coedges, and its Euler–Poincaré count">
        <g v-if="st >= 2">
          <polygon v-for="i in DRAW_ORDER" :key="'f' + i" :points="facePolys[i]" class="face" :class="{ rev: i === 0 }" :opacity="st === 2 ? 0.25 + 0.75 * morph : 1" />
          <g v-if="st >= 3 || morph > 0.85">
            <text v-for="(c, i) in CENTRE" :key="'fl' + i" :x="c[0]" :y="c[1] + 3.5" text-anchor="middle" class="flab">{{ FACES[i].id }}</text>
          </g>
        </g>
        <g v-if="st === 4">
          <line v-for="(c, i) in TWINS[twinIndex]" :key="'tw' + i" :x1="c.side[0][0]" :y1="c.side[0][1]" :x2="c.side[1][0]" :y2="c.side[1][1]" class="edge-hot" />
        </g>
        <g v-if="st === 5">
          <circle v-for="(v, i) in V5" :key="'v5' + i" :cx="v[1][0]" :cy="v[1][1]" r="4" class="v5" />
        </g>
        <g v-for="(x, i) in coedgesDrawn" :key="'c' + i" :class="['co', x.cls]">
          <line :x1="x.d.p[0]" :y1="x.d.p[1]" :x2="x.d.q[0]" :y2="x.d.q[1]" />
          <polygon v-if="x.d.head" :points="x.d.head" />
        </g>
        <g v-if="wire > 0" :opacity="wire">
          <g v-for="(e, i) in edges3d" :key="'e' + i" v-show="e.g > 0">
            <line :x1="e.a[0]" :y1="e.a[1]" :x2="e.b[0]" :y2="e.b[1]" class="edge" :class="{ hidden: e.hidden }" />
            <polygon v-if="e.head" :points="e.head" class="ehead" :class="{ hidden: e.hidden }" />
          </g>
          <g v-for="(p, i) in ISO" :key="'v' + i">
            <circle :cx="p[0]" :cy="p[1]" :r="Math.max(0, 3.2 * vertexGrow(i))" class="vertex" :class="{ hidden: i === 3 }" />
            <text v-if="vertexGrow(i) > 0.5" :x="p[0] + LABEL_OFFSET[i][0]" :y="p[1] + LABEL_OFFSET[i][1]" class="vlab">v{{ i }}</text>
          </g>
        </g>
        <g class="panel">
          <text x="250" y="24" class="ptitle">records</text>
          <g v-for="(row, i) in counts" :key="'r' + i">
            <text x="250" :y="42 + 15 * i" :class="{ off: row[1] === null }">{{ row[0] }}</text>
            <text x="368" :y="42 + 15 * i" text-anchor="end" class="pnum" :class="{ off: row[1] === null }">{{ row[1] === null ? '–' : row[1] }}</text>
          </g>
          <g v-if="st === 6">
            <text x="250" y="166" v-if="euler >= 1">V − E + F − (L − F)</text>
            <text x="250" y="182" v-if="euler >= 2" class="pnum">= 8 − 12 + 6 − 0 = 2</text>
            <text x="250" y="198" v-if="euler >= 3" class="pnum">= 2(S − G), S = 1</text>
            <text x="250" y="216" v-if="euler >= 4" class="pres">G = 0 · valid</text>
          </g>
        </g>
        <text x="12" y="238" class="readout">{{ readout }}</text>
      </svg>
      <template #note>The records are the kernel's for this cube (read from <code>brepFromBody</code> of the built kernel), ids
        without their <code>m1_solid/shell/</code> and <code>m1_</code> prefixes. Unfolding moves each face's corners straight
        to their place in the net; it is not a hinged fold. Dashed: behind the cube.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.face { fill: color-mix(in srgb, var(--a) 13%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1.3; stroke-linejoin: round; }
.face.rev { fill: color-mix(in srgb, var(--b) 14%, var(--vp-c-bg)); }
.flab { font-size: 10px; font-weight: 700; fill: var(--vp-c-text-2); }
.edge { stroke: var(--vp-c-text-1); stroke-width: 1.5; stroke-linecap: round; }
.edge.hidden { stroke: var(--vp-c-text-3); stroke-dasharray: 3 3; stroke-width: 1.2; }
.ehead { fill: var(--vp-c-text-1); } .ehead.hidden { fill: var(--vp-c-text-3); }
.vertex { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; } .vertex.hidden { fill: var(--vp-c-text-3); }
.vlab { font-size: 10px; font-weight: 600; fill: var(--vp-c-text-1); }
.co line { stroke: var(--a); stroke-width: 1.4; stroke-linecap: round; transition: opacity .2s; }
.co polygon { fill: var(--a); }
.co.dim { opacity: 0.3; }
.co.hot line { stroke: var(--hot); stroke-width: 2; } .co.hot polygon { fill: var(--hot); }
.co.out line { stroke: var(--b); stroke-width: 2; } .co.out polygon { fill: var(--b); }
.edge-hot { stroke: var(--hot); stroke-width: 3; stroke-linecap: round; opacity: 0.55; }
.v5 { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.panel text { font-size: 11px; }
.ptitle { font-weight: 700; fill: var(--vp-c-text-1); }
.pnum { font-family: var(--vp-font-family-mono); fill: var(--vp-c-text-1); }
.panel .off { fill: var(--vp-c-text-3); }
.pres { font-weight: 700; fill: var(--keep); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); font-family: var(--vp-font-family-mono); }
</style>
