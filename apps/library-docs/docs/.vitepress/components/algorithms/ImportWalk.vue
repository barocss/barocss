<script setup>
// importStep's walk (packages/barocss-cad/src/io/step-import.ts) through a real file: a 10 mm cube written by the built
// kernel (packages/barocss-cad/dist/index.js: evaluateCadPart of a 10 × 10 mm rectangle extruded 10 mm, then
// exportStep(output, { validationProperties: false })), 131 instances. The rows are that file's lines for one face
// (e.side0) and the records above it, in file order; two are shortened (…). importStep of the same text, run the same
// way: 6 faces, 6 loops, 24 coedges, 12 edges, 8 vertices, checkBrep valid; side0's uses e34 forward, e38 forward,
// e41 reversed, e44 reversed; its plane patch spans −1.1 … 11.1 mm in x and z.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const ROWS = [
  "#15=CARTESIAN_POINT('',(0.,0.,0.))",
  "#16=VERTEX_POINT('',#15)",
  "#17=CARTESIAN_POINT('',(10.,0.,0.))",
  "#18=VERTEX_POINT('',#17)",
  "#32=VECTOR('',#31,10.)",
  "#33=LINE('',#15,#32)",
  "#34=EDGE_CURVE('…',#16,#18,#33,.T.)",
  "#72=AXIS2_PLACEMENT_3D('',#15,#71,#31)",
  "#73=PLANE('',#72)",
  "#74=ORIENTED_EDGE('',*,*,#34,.T.)",
  "#78=EDGE_LOOP('',(#74,#75,#76,#77))",
  "#79=FACE_OUTER_BOUND('',#78,.T.)",
  "#80=ADVANCED_FACE('e.side0',(#79),#73,.T.)",
  "#127=CLOSED_SHELL('',(#80,#89,…,#126))",
  "#128=MANIFOLD_SOLID_BREP('e_b0',#127)",
];
const rowY = i => 26 + 13.2 * i;

const steps = [
  { label: 'Read the DATA section into a table', text: 'The reader takes the text between <code>DATA;</code> and <code>ENDSEC;</code>, comments dropped, and reads each instance <code>#n=NAME(…);</code> into a table by its number. A parameter is a number, a quoted string (a doubled quote is one quote), a reference <code>#n</code>, an enumeration such as <code>.T.</code>, <code>$</code> (unset), <code>*</code> (derived), a list, or a typed value such as <code>LENGTH_MEASURE(1.E-06)</code>. A complex instance <code>(A()B()…)</code> is kept as its list of parts. Nothing is resolved yet. The HEADER is not read.', formula: '#n = NAME(p, …);  &nbsp; p ∈ number | \'text\' | #ref | .ENUM. | $ | * | (p, …) | NAME(p)' },
  { label: 'Find the solids', text: 'Every <code>MANIFOLD_SOLID_BREP</code> and <code>BREP_WITH_VOIDS</code> in the table is a body, in file order. The product structure above them is not followed. A file with neither and no AP242 tessellated solid is refused: <i>no solid in the file</i>.', formula: 'MANIFOLD_SOLID_BREP(name, outer) &nbsp; BREP_WITH_VOIDS(name, outer, (void, …))' },
  { label: 'Shell → faces', text: 'The solid\'s second parameter is its <code>CLOSED_SHELL</code>; a void\'s <code>ORIENTED_CLOSED_SHELL</code> is unwrapped to the shell inside it. The shell lists its faces, read one at a time. Any other kind of shell is refused by name.' },
  { label: 'Face → bound → loop → oriented edges', text: 'An <code>ADVANCED_FACE</code> (or <code>FACE_SURFACE</code>) lists its bounds. Each <code>FACE_OUTER_BOUND</code> or <code>FACE_BOUND</code> points at an <code>EDGE_LOOP</code>, which lists <code>ORIENTED_EDGE</code>s. Each oriented edge becomes one use of an edge: the edge it names, run with it (<code>.T.</code>) or against it (<code>.F.</code>). side0\'s four uses go (0,0,0) → (10,0,0) → (10,0,10) → (0,0,10) and back.', formula: 'ORIENTED_EDGE(\'\', *, *, edge, orientation) → use { edge, forward = orientation }' },
  { label: 'Edge → vertices → points', text: '<code>EDGE_CURVE</code> names its start and end <code>VERTEX_POINT</code>, its curve and a <i>same_sense</i> flag. Each vertex becomes a point, read once per number. A <code>LINE</code> runs from vertex to vertex: its own point and vector (<code>#32</code>) are not read. The face\'s other three edges are read the same way.', formula: 'EDGE_CURVE(name, start, end, curve, same_sense) → edge { curve, vertices [start, end] }' },
  { label: 'The face\'s surface and sense', text: 'The face\'s third parameter is its surface: a <code>PLANE</code> with its placement (origin <code>#15</code>, normal (0, −1, 0), x direction (1, 0, 0)). Once all faces are read, the plane becomes a flat patch over the face\'s boundary, padded by 1 mm plus 1 % of its largest coordinate in the plane: −1.1 to 11.1 mm here. The last flag, <i>same_sense</i> <code>.T.</code>, says the face\'s outward normal is the plane\'s own: the face\'s sense is forward.', formula: 'pad = 1 + 0.01 · max(1, |u|, |v|) = 1 + 0.01 · 10 = 1.1 mm' },
  { label: 'Each record once: the whole cube', text: 'Vertices and edges are kept by their numbers. Edge <code>#38</code> is used forward by side0 and reversed by side1, and it becomes one edge with two coedges, which are each other\'s twin. After six faces the B-rep has 6 faces, 6 loops, 24 coedges, 12 edges and 8 vertices, and it checks valid. The faces and edges keep the names the file gives them.', formula: 'V − E + F = 8 − 12 + 6 = 2' },
];
const s = useSteps(steps.length, [3400, 2600, 2800, 4200, 4400, 4200, 4400], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);

// Rows each step visits, in order (indices into ROWS).
const PATHS = [[], [14], [14, 13], [13, 12, 11, 10, 9], [9, 6, 1, 0, 3, 2, 5], [12, 8, 7, 0], []];
const reach = computed(() => { const p = PATHS[step.value]; return p.length ? Math.min(p.length - 1, Math.floor(k.value * (p.length - 1) + 1e-9)) : -1; });
const marker = computed(() => {
  const p = PATHS[step.value]; if (!p.length) return null;
  const f = k.value * (p.length - 1), i = Math.min(p.length - 1, Math.floor(f)), j = Math.min(p.length - 1, i + 1), u = f - i;
  return rowY(p[i]) + (rowY(p[j]) - rowY(p[i])) * u - 3.5;
});
const past = computed(() => new Set(PATHS.slice(0, step.value).flat()));
const now = computed(() => new Set(PATHS[step.value].slice(0, reach.value + 1)));
function rowClass(i) {
  if (now.value.has(i)) return 'now';
  if (step.value === 6 || past.value.has(i)) return 'past';
  return '';
}
const rowOpacity = i => (step.value === 0 ? Math.max(0, Math.min(1, s.t.value * 1.4 * ROWS.length - i)) : 1);
// Links drawn on the left margin between consecutive rows of the walk.
const links = computed(() => {
  const p = PATHS[step.value], out = [];
  for (let i = 0; i + 1 <= reach.value && i + 1 < p.length; i++) {
    const y1 = rowY(p[i]) - 3.5, y2 = rowY(p[i + 1]) - 3.5, bulge = Math.min(10, 2 + Math.abs(y2 - y1) / 14);
    out.push(`M 11 ${y1} C ${11 - bulge} ${y1}, ${11 - bulge} ${y2}, 11 ${y2}`);
  }
  return out;
});

// The cube, seen from (−1, −1, 1): faces x = 0, y = 0 and z = 10 in front.
const S = 5, CX = 318, CY = 172;
const iso = ([x, y, z]) => [CX + (x - y) * 0.866 * S, CY - (x + y) * 0.5 * S - z * S];
const P = { 15: [0, 0, 0], 17: [10, 0, 0], 19: [10, 0, 10], 21: [0, 0, 10], 23: [10, 10, 0], 25: [10, 10, 10], 27: [0, 10, 0], 29: [0, 10, 10] };
const EDGES = [[34, 15, 17], [38, 17, 19], [41, 21, 19], [44, 15, 21], [48, 17, 23], [51, 23, 25], [54, 19, 25], [58, 23, 27], [61, 27, 29], [64, 25, 29], [67, 15, 27], [70, 21, 29]];
const HIDDEN = new Set([48, 51, 58]);
const pts = ids => ids.map(i => iso(P[i]).join(',')).join(' ');
const FACES = { side0: [15, 17, 19, 21], side3: [15, 21, 29, 27], top: [21, 19, 25, 29] };
// side0's loop as the file has it: e34 →, e38 →, e41 ←, e44 ←.
const USES = [[15, 17], [17, 19], [19, 21], [21, 15]];
const C0 = [5, 0, 5];
function head(a, b, f = 0.55) {
  const A = P[a], B = P[b], m = A.map((x, i) => x + (B[i] - x) * f).map((x, i) => x + (C0[i] - x) * 0.16);
  const [mx, my] = iso(m), [ax, ay] = iso(A), [bx, by] = iso(B), L = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / L, dy = (by - ay) / L;
  return `${mx + 4 * dx},${my + 4 * dy} ${mx - 3 * dx - 2.6 * dy},${my - 3 * dy + 2.6 * dx} ${mx - 3 * dx + 2.6 * dy},${my - 3 * dy - 2.6 * dx}`;
}
const useLine = ([a, b]) => { const A = P[a].map((x, i) => x + (C0[i] - x) * 0.16), B = P[b].map((x, i) => x + (C0[i] - x) * 0.16); return [...iso(A), ...iso(B)]; };
const usesShown = computed(() => (step.value < 3 ? 0 : step.value === 3 ? Math.min(4, Math.floor(k.value * 4.999)) : 4));
// The plane patch of side0, padded from the face's boundary (grows during step 6).
const patch = computed(() => {
  const pad = step.value === 5 ? 1.1 * k.value : 1.1, a = -pad, b = 10 + pad;
  return [[a, 0, a], [b, 0, a], [b, 0, b], [a, 0, b]].map(q => iso(q).join(',')).join(' ');
});
const normal = computed(() => { const f = step.value === 5 ? k.value : 1; const [x1, y1] = iso(C0), [x2, y2] = iso([5, -4 * f, 5]); return { x1, y1, x2, y2 }; });
const edgesShown = computed(() => (step.value < 6 ? 0 : Math.round(k.value * EDGES.length)));
const tally = computed(() => {
  const st = step.value;
  if (st === 0) return ['131 instances in the table', 'no B-rep records yet'];
  if (st === 1) return ['bodies 1', ''];
  if (st === 2) return ['bodies 1 · shells 1 · faces to read: 6', ''];
  if (st === 3) return ['bodies 1 · shells 1 · faces 1 of 6 · loops 1', `coedges ${usesShown.value}`];
  if (st === 4 || st === 5) return ['bodies 1 · shells 1 · faces 1 of 6 · loops 1', 'coedges 4 · edges 4 · vertices 4'];
  const f = Math.max(1, Math.round(k.value * 6));
  return [`bodies 1 · shells 1 · faces ${f} of 6 · loops ${f}`, `coedges ${4 * f} · edges ${[4, 7, 10, 12, 12, 12][f - 1]} · vertices ${[4, 6, 8, 8, 8, 8][f - 1]}`];
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="From #ids to a B-rep, record by record" :steps="steps" :s="s">
      <svg viewBox="0 0 380 252" role="img" aria-label="Fifteen lines of a cube's STEP file beside the cube, which is built record by record as the reader follows the references">
        <text x="14" y="12" class="cap">DATA; 15 of the cube's 131 lines</text>
        <g v-for="(r, i) in ROWS" :key="i" :opacity="rowOpacity(i)">
          <rect x="13" :y="rowY(i) - 9.4" width="257" height="12.4" rx="2" class="row" :class="rowClass(i)" />
          <text x="16" :y="rowY(i)" class="code">{{ r }}</text>
        </g>
        <path v-for="(d, i) in links" :key="'l' + i" :d="d" class="link" />
        <circle v-if="marker !== null" cx="9" :cy="marker" r="3.4" class="marker" />

        <g v-if="step >= 1">
          <polygon v-for="(f, n) in FACES" :key="'g' + n" :points="pts(f)" class="ghost" />
        </g>
        <g v-if="step >= 6">
          <polygon v-for="(f, n) in FACES" :key="'f' + n" :points="pts(f)" class="face" :opacity="n === 'side0' ? 1 : Math.min(1, k * 2)" />
          <line v-for="(e, i) in EDGES.slice(0, edgesShown)" :key="'e' + e[0]" :x1="iso(P[e[1]])[0]" :y1="iso(P[e[1]])[1]" :x2="iso(P[e[2]])[0]" :y2="iso(P[e[2]])[1]" class="edge" :class="{ hidden: HIDDEN.has(e[0]) }" />
        </g>
        <g v-if="step >= 5">
          <polygon :points="patch" class="patch" />
          <polygon :points="pts(FACES.side0)" class="face" />
          <line :x1="normal.x1" :y1="normal.y1" :x2="normal.x2" :y2="normal.y2" class="normal" />
          <circle :cx="normal.x2" :cy="normal.y2" r="2.2" class="normal-tip" />
          <text v-if="step === 5" x="378" y="196" text-anchor="end" class="small">normal n = (0, −1, 0)</text>
        </g>
        <g v-if="step >= 3 && step <= 5">
          <g v-for="(u, i) in USES.slice(0, usesShown)" :key="'u' + i">
            <line :x1="useLine(u)[0]" :y1="useLine(u)[1]" :x2="useLine(u)[2]" :y2="useLine(u)[3]" class="use" />
            <polygon :points="head(u[0], u[1])" class="use-head" />
          </g>
        </g>
        <g v-if="step === 4">
          <line :x1="iso(P[15])[0]" :y1="iso(P[15])[1]" :x2="iso(P[17])[0]" :y2="iso(P[17])[1]" class="edge hot" />
          <circle v-for="v in [15, 17, 19, 21]" :key="'v' + v" :cx="iso(P[v])[0]" :cy="iso(P[v])[1]" r="2.6" class="vertex" />
          <text x="378" y="196" text-anchor="end" class="small">#34: (0,0,0) → (10,0,0)</text>
        </g>
        <text x="14" y="230" class="tally">{{ tally[0] }}</text>
        <text x="14" y="244" class="tally">{{ tally[1] }}<tspan v-if="step === 6 && k > 0.95" dx="10" class="ok">checkBrep: valid</tspan></text>
      </svg>
      <template #note>The rows are lines of a real file: a 10 mm cube written by the kernel's <code>exportStep</code>,
        with <code>#34</code>'s name and <code>#127</code>'s list shortened (…). The counts on the right are what
        <code>importStep</code> gives for that file; the order in which the last five faces fill is the picture's.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg text.code { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.cap { font-size: 10px; }
.row { fill: transparent; transition: fill .25s; }
.row.past { fill: color-mix(in srgb, var(--a) 9%, transparent); }
.row.now { fill: color-mix(in srgb, var(--a) 26%, transparent); }
.link { fill: none; stroke: var(--a); stroke-width: 1.2; }
.marker { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.ghost { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 3; opacity: 0.6; }
.face { fill: color-mix(in srgb, var(--a) 18%, transparent); stroke: var(--a); stroke-width: 1.4; }
.patch { fill: none; stroke: var(--b); stroke-width: 1.2; stroke-dasharray: 4 3; }
.edge { stroke: var(--vp-c-text-1); stroke-width: 1.5; stroke-linecap: round; }
.edge.hidden { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.edge.hot { stroke: var(--b); stroke-width: 3; }
.use { stroke: var(--a); stroke-width: 1.3; }
.use-head { fill: var(--a); }
.vertex { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.normal { stroke: var(--hot); stroke-width: 1.6; }
.normal-tip { fill: var(--hot); }
.small { font-size: 10px; }
.tally { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.tally .ok { fill: var(--keep); }
</style>
