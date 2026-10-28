<script setup>
// Broken B-reps and what checkBrep reports (brep-core.ts, brep-check-geometry.ts). Every message below is the built
// kernel's (packages/barocss-cad/dist/index.js), from checkBrep on the 20 mm cube of
// cad.model().sketch.rectangle({ width: 20, height: 20 }).extrude(20) (brepFromBody) changed as each step says: its top
// face removed (shell still marked closed), the top's sense set to 'reversed', vertex m1_v_6 moved 0.001 mm in z, the
// top's plane moved 0.5 mm in z; and, for the last step, from booleanPolyhedra and evaluateCadPart on two 10 mm blocks
// touching along an edge. Long messages are wrapped; lines in italics are the figure's summaries, not kernel output.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const D = norm([0.5, -1, 0.75]), RT = norm([1, 0.5, 0]);
const UP = [D[1] * RT[2] - D[2] * RT[1], D[2] * RT[0] - D[0] * RT[2], D[0] * RT[1] - D[1] * RT[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const view = p => [42 + 2.9 * dot(p, RT), 112 - 2.9 * dot(p, UP)];
const pts = list => list.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const lerp = (a, b, m) => [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
const up = (p, dy) => [p[0], p[1] - dy];
function head(a, b, size = 4.4) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, w = 0.55 * size;
  return pts([b, [b[0] - size * ux + w * uy, b[1] - size * uy - w * ux], [b[0] - size * ux - w * uy, b[1] - size * uy + w * ux]]);
}

// The cube's corners v0 … v7, projected.
const C = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 20], [20, 0, 20], [20, 20, 20], [0, 20, 20]].map(view);
const TOP = [4, 5, 6, 7], FRONT = [0, 1, 5, 4], RIGHT = [1, 2, 6, 5], INSIDE = [[0, 1, 2, 3], [3, 2, 6, 7], [0, 3, 7, 4]];
const TOP_CENTRE = view([10, 10, 20]);
// The top's loop (m1_t: e4 v4 → v5, e5 v5 → v6, e6 v6 → v7, e7 v7 → v4), drawn inside the face.
const TOP_ARROWS = TOP.map((v, k) => {
  const a = lerp(C[v], TOP_CENTRE, 0.28), b = lerp(C[TOP[(k + 1) % 4]], TOP_CENTRE, 0.28), p = lerp(a, b, 0.15), q = lerp(a, b, 0.85);
  return { p, q, head: head(p, q) };
});
/** The faces of a box seen from this view: top, front (y = y0) and right (x = x1). */
function box(x0, y0, z0, x1, y1, z1) {
  const v = (x, y, z) => view([x, y, z]);
  return [pts([v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)]), pts([v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)]), pts([v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)])];
}

// Report lines: [text, kind] — 'm' a kernel message (or its wrapped continuation), 's' the figure's own summary.
const CASES = [
  { call: 'checkBrep(cube)', valid: [true], lines: [
    ['valid: true', 'm'], ['issues: []', 'm'], ['counts: { bodies: 1, shells: 1, faces: 6, loops: 6,', 'm'], ['          coedges: 24, edges: 12, vertices: 8 }', 'm'],
    ['topology: [{ vertices: 8, edges: 12, faces: 6, loops: 6,', 'm'], ['             shells: 1, genus: 0 }]', 'm'], ['maximumVertexGap: 0, maximumPcurveGap: 0', 'm']] },
  { call: 'checkBrep(cube without its top)', valid: [false], issues: 8, lines: [
    ['topology: edge m1_e_4 has 1 uses in a closed shell', 'm'], ['  (needs 2)', 'm'], ['… the same for m1_e_5, m1_e_6 and m1_e_7', 's'],
    ['topology: vertex m1_v_5 is not manifold (1 of 2 incoming', 'm'], ['  coedges in one cycle)', 'm'], ['… the same for m1_v_6 and m1_v_7', 's'],
    ['topology: body m1_solid fails Euler–Poincaré (V 8, E 12,', 'm'], ['  F 5, L 5, S 1)', 'm']] },
  { call: 'checkBrep(cube, top sense reversed)', valid: [false], issues: 1, lines: [
    ['orientation: face m1_solid/shell/m1_t sense disagrees', 'm'], ['  with its outer loop', 'm'],
    ['… turned over fully instead (sense and loop reversed):', 's'], ['topology: coedge m1_solid/shell/m1_t/l0/c0 and its', 'm'],
    ['  twin m1_solid/shell/m1_w_0/l0/c2 are not opposite', 'm'], ['  uses of one edge', 'm'], ['… 12 issues: 8 such pairs, 4 vertices not manifold', 's']] },
  { call: 'checkBrep(cube, v6 moved 0.001 mm)', valid: [false], issues: 3, lines: [
    ['geometry: edge m1_e_5 end is 0.0010000000000012221 mm', 'm'], ['  from vertex m1_v_6', 'm'], ['… the same for m1_e_6 and m1_e_10', 's'],
    ['maximumVertexGap: 0.0010000000000012221', 'm'], ['… vertex and edge tolerances here: 1e-7 mm', 's']] },
  { call: 'top plane moved 0.5 mm', valid: [true, false], issues: 4, lines: [
    ['checkBrep(b): valid: true, issues: []', 'm'], ['checkBrep(b, { strict: true }): valid: false', 'm'],
    ['geometry: edge m1_e_4 is 5.00e-1 mm off the surface of', 'm'], ['  face m1_solid/shell/m1_t', 'm'], ['… the same for m1_e_5, m1_e_6 and m1_e_7', 's'],
    ['maximumEdgeSurfaceGap: 0.5', 'm']] },
  { call: 'two blocks touching along an edge', valid: [false, true], lines: [
    ['booleanPolyhedra(a, b, \'union\') throws BrepError:', 's'], ['B-rep: polyhedral Boolean: the result is not a manifold', 'm'],
    ['  solid (the inputs touch along an edge or at a vertex):', 'm'], ['  topology: edge e11 has 4 uses in a closed shell (needs 2)', 'm'],
    ['evaluateCadPart, union u: bodyCount 2', 's'], ['checkOutput(u): valid: true; bodies u_b0 and u_b1, each', 's'], ['  vertices 8, edges 12, faces 6, loops 6, shells 1, genus 0', 's']] },
];

const steps = [
  { label: 'A valid cube', text: '<code>checkBrep(brep)</code> returns a report: <code>valid</code>, the first <code>issues</code> (at most 32, each <i>kind: detail</i>), the record counts, each body\'s Euler–Poincaré <code>topology</code> with its genus, and the largest gaps it measured. Valid means no issue was found.', formula: 'report { valid, issues, counts, topology, maximumVertexGap, maximumPcurveGap, maximumEdgeSurfaceGap }' },
  { label: 'A crack: edges used once', text: 'Take away the top face but leave the shell marked closed. Its four rim edges now have one use each, the walks round three of its corners stop at the open rim, and V − E + F − (L − F) = 1 gives a genus of 0.5. Marked as an open sheet instead, the same five faces pass: the two-use and vertex tests apply to closed shells, the Euler test to solids whose shells are all closed.', formula: 'closed shell: uses(e) = 2 · G = S − (V − E + F − (L − F)) / 2 = 1 − 1/2 = 0.5' },
  { label: 'A face turned the wrong way', text: 'Set the top\'s sense to reversed. Its outward normal now points into the cube, against its outer loop, which still runs counter-clockwise seen from outside. The check compares the loop\'s vector area with the surface normal at the middle of its domain. Turning the face over fully, its loop reversed too, makes each of its coedges run the same way as its twin instead.', formula: 'A = ½ ∮ p × dp · sense agrees ⇔ A · (∂S/∂u × ∂S/∂v) has the sign of the sense' },
  { label: 'A vertex off its edges', text: 'Move vertex v6 by 0.001 mm. The three edges that end there still end at the old point, 10 000 times their tolerance of 10⁻⁷ mm away. The gap is reported per edge and as <code>maximumVertexGap</code>. (The picture moves it much more.)', formula: 'gap = |C(t₁) − P(v6)| = 10⁻³ mm &gt; max(tol<sub>v</sub>, tol<sub>e</sub>) = 10⁻⁷ mm' },
  { label: 'Strict: an edge off its surface', text: 'Lift the top face\'s plane 0.5 mm and leave its edges where they were. The default check passes: it tests edge ends against vertices and pcurves against edges, not edges against surfaces. <code>strict</code> samples each edge (a line at 3 points, a curve at 9), finds the nearest point of each face using it, and reports a sample farther away than its limit.', formula: 'limit = max(10 × tol<sub>edge</sub>, 10⁻⁶ × size), size = max(1, largest |coordinate|) · here 2 × 10⁻⁵ mm; gap 0.5 mm' },
  { label: 'Touching along an edge', text: 'Two blocks that touch only along a line cannot make one manifold shell: the shared edge would have four uses. The polyhedral Boolean, asked for such a union, throws with the check\'s first issue. The part model\'s union instead returns two bodies, one per lump, each with its own copy of the edge (D204), and <code>checkOutput</code> passes.', formula: 'one shell: uses(e11) = 4 ≠ 2 · two bodies: 2 + 2' },
];
const s = useSteps(steps.length, [3600, 4400, 4200, 3800, 4200, 4600], root);
const st = computed(() => s.step.value);
const e = computed(() => ease(s.t.value));
const cur = computed(() => CASES[st.value]);
const lineCount = computed(() => Math.min(cur.value.lines.length, Math.floor(s.t.value * (cur.value.lines.length + 0.6)) + 1));

const lift = computed(() => (st.value === 1 ? 26 * e.value : 0));
const topAlpha = computed(() => (st.value === 1 ? 1 - 0.8 * e.value : 1));
const topPoly = computed(() => pts(TOP.map(v => up(C[v], lift.value))));
// The top's outward normal: up while forward, turning down as the sense flips.
const normal = computed(() => {
  const f = st.value === 2 ? 1 - 2 * e.value : 1, b = [TOP_CENTRE[0], TOP_CENTRE[1] - 30 * f];
  return { a: TOP_CENTRE, b, head: Math.abs(f) > 0.25 ? head(TOP_CENTRE, b, 5) : '' };
});
const v6 = computed(() => (st.value === 3 ? up(C[6], 16 * e.value) : C[6]));
const plane = computed(() => (st.value === 4 ? pts(TOP.map(v => up(C[v], 13 * e.value))) : ''));
const blocks = computed(() => {
  const d = 6 * (1 - e.value);
  return { a: box(0, 0, 0, 10, 10, 10), b: box(10 + d, 10 + d, 0, 20 + d, 20 + d, 10), edge: [view([10, 10, 0]), view([10, 10, 10])], touching: e.value > 0.97 };
});
const RIM = [[4, 5], [5, 6], [6, 7], [7, 4]];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Broken B-reps and what the check reports" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="A cube changed in five ways, each with the issues checkBrep reports, and two blocks touching along an edge">
        <g v-if="st < 5">
          <polygon v-for="(f, i) in INSIDE" :key="'in' + i" :points="pts(f.map(v => C[v]))" class="inside" />
          <polygon :points="pts(FRONT.map(v => C[v]))" class="face" />
          <polygon :points="pts(RIGHT.map(v => C[v]))" class="face dark" />
          <polygon :points="topPoly" class="face top" :class="{ flipped: st === 2 && e > 0.5 }" :opacity="topAlpha" />
          <g v-if="st === 1">
            <line v-for="(r, i) in RIM" :key="'rim' + i" :x1="C[r[0]][0]" :y1="C[r[0]][1]" :x2="C[r[1]][0]" :y2="C[r[1]][1]" class="rim" />
          </g>
          <g v-if="st === 0 || st === 2" class="loop">
            <g v-for="(a, i) in TOP_ARROWS" :key="'ta' + i"><line :x1="a.p[0]" :y1="a.p[1]" :x2="a.q[0]" :y2="a.q[1]" /><polygon :points="a.head" /></g>
            <line :x1="normal.a[0]" :y1="normal.a[1]" :x2="normal.b[0]" :y2="normal.b[1]" class="normal" :class="{ bad: st === 2 && e > 0.5 }" />
            <polygon v-if="normal.head" :points="normal.head" class="nhead" :class="{ bad: st === 2 && e > 0.5 }" />
          </g>
          <g v-if="st === 3">
            <line :x1="C[6][0]" :y1="C[6][1]" :x2="v6[0]" :y2="v6[1]" class="gap" />
            <circle :cx="C[6][0]" :cy="C[6][1]" r="2.4" class="end" />
            <circle :cx="v6[0]" :cy="v6[1]" r="3.6" class="vert" />
            <text :x="v6[0] + 7" :y="v6[1] + 4" class="lab">v6</text>
          </g>
          <g v-if="st === 4 && plane">
            <polygon :points="plane" class="plane" />
            <line v-for="v in TOP" :key="'g' + v" :x1="C[v][0]" :y1="C[v][1]" :x2="C[v][0]" :y2="C[v][1] - 13 * e" class="gap" />
            <text :x="C[4][0] - 4" :y="C[4][1] - 13 * e" text-anchor="end" class="lab">surface</text>
          </g>
        </g>
        <g v-else>
          <polygon v-for="(f, i) in blocks.b" :key="'b' + i" :points="f" class="face" :class="{ dark: i === 2, top: i === 0 }" />
          <polygon v-for="(f, i) in blocks.a" :key="'a' + i" :points="f" class="face" :class="{ dark: i === 2, top: i === 0 }" />
          <line v-if="blocks.touching" :x1="blocks.edge[0][0]" :y1="blocks.edge[0][1]" :x2="blocks.edge[1][0]" :y2="blocks.edge[1][1]" class="rim" />
        </g>
        <g class="status">
          <text x="150" y="30" class="call">{{ cur.call }}</text>
          <text v-for="(v, i) in cur.valid" :key="'v' + i" x="150" :y="52 + 18 * i" class="verdict" :class="v ? 'ok' : 'no'">{{ cur.valid.length === 2 ? (st === 4 ? (i ? 'strict: ' : 'default: ') : (i ? 'as two bodies: ' : 'as one shell: ')) : '' }}{{ v ? 'valid' : 'not valid' }}</text>
          <text v-if="cur.issues" x="150" :y="52 + 18 * cur.valid.length" class="count">{{ cur.issues }} issue{{ cur.issues === 1 ? '' : 's' }}</text>
        </g>
        <line x1="12" y1="140" x2="368" y2="140" class="rule" />
        <text v-for="(l, i) in cur.lines" :key="st + '-' + i" v-show="i < lineCount" :x="l[0].startsWith(' ') ? 26 : 12" :y="155 + 13.6 * i" class="line" :class="l[1] === 's' ? 'sum' : ''">{{ l[0].trimStart() }}</text>
      </svg>
      <template #note>Kernel output in upright type, wrapped where long; the figure's own summaries in italics. Movements are
        drawn far larger than they are: 0.001 mm and 0.5 mm on a 20 mm cube.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.face { fill: color-mix(in srgb, var(--a) 26%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1.3; stroke-linejoin: round; transition: fill .3s; }
.face.dark { fill: color-mix(in srgb, var(--a) 38%, var(--vp-c-bg)); }
.face.top { fill: color-mix(in srgb, var(--a) 14%, var(--vp-c-bg)); }
.face.top.flipped { fill: color-mix(in srgb, var(--hot) 22%, var(--vp-c-bg)); stroke: var(--hot); }
.inside { fill: color-mix(in srgb, var(--vp-c-text-3) 30%, var(--vp-c-bg)); stroke: var(--vp-c-text-3); stroke-width: 1; }
.rim { stroke: var(--hot); stroke-width: 3; stroke-linecap: round; }
.loop line { stroke: var(--a); stroke-width: 1.4; } .loop polygon { fill: var(--a); }
.loop .normal { stroke: var(--keep); stroke-width: 2; } .loop .nhead { fill: var(--keep); }
.loop .normal.bad { stroke: var(--hot); } .loop .nhead.bad { fill: var(--hot); }
.gap { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 3 2; }
.end { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.2; }
.vert { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.plane { fill: color-mix(in srgb, var(--hot) 14%, transparent); stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 4 3; }
.lab { font-size: 10px; font-weight: 600; fill: var(--hot); }
.call { font-family: var(--vp-font-family-mono); font-size: 10.5px; font-weight: 700; fill: var(--vp-c-text-1); }
.verdict { font-size: 12px; font-weight: 700; } .verdict.ok { fill: var(--keep); } .verdict.no { fill: var(--hot); }
.count { font-size: 11px; }
.rule { stroke: var(--vp-c-divider); }
.line { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.line.sum { font-family: var(--vp-font-family-base); font-style: italic; fill: var(--vp-c-text-2); }
</style>
