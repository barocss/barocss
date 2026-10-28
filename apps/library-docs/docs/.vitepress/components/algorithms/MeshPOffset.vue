<script setup>
// Two inner offsets of a closed mesh, on a section: a U, 24 × 12 mm, its slot 6 wide down to 2 above the bottom.
// (1) The kernel's mesh shell (mesh-offset.ts `meshInnerOffset`, R11.3, D114), in 2D: each vertex moved to the
// least-squares point of its pieces' lines moved in by t, solved through the 2 × 2 matrix's eigenvectors (directions
// under 1e-4 of the largest eigenvalue left out); then the checks, in the kernel's order. In 2D each vertex has two
// pieces, so the angle weights cancel and the point is the mitre exactly.
// (2) The voxel cavity (voxel-field.ts, K6, D145, as cad-model's print/hollow.ts `cavityField` uses it), in 2D: the grid
// of spacing h offset by 1/π and 1/e of h, the inside by parity along +x per row, the depth to the nearest piece capped
// at t + 2h, φ = depth − t, and its zero line by marching triangles, two a cell about its diagonal (the kernel's six
// tetrahedra a cube about its diagonal, one dimension down). The numbers quoted for 3D come from the built kernel on
// this section extruded 10 mm (a scratch script calling dist/mesh/mesh-offset.js and dist/index.js).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const SEC = [[0, 0], [24, 0], [24, 12], [15, 12], [15, 2], [9, 2], [9, 12], [0, 12]], NS = SEC.length;
const T_OK = 0.8, T_DEEP = 1.5, H = 0.75;
/** Each piece's outward unit normal (the section wound counter-clockwise). */
const NORMAL = SEC.map((p, i) => { const q = SEC[(i + 1) % NS], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l]; });

/** The offset by t: each vertex Σ n nᵀ d = −t Σ n over its two pieces, through the eigenvectors. */
function offset(t) {
  return SEC.map((p, v) => {
    let a = 0, b = 0, c = 0, rx = 0, ry = 0;
    for (const k of [(v + NS - 1) % NS, v]) { const [nx, ny] = NORMAL[k]; a += nx * nx; b += nx * ny; c += ny * ny; rx -= t * nx; ry -= t * ny; }
    const m = (a + c) / 2, r = Math.hypot((a - c) / 2, b), lam = [m + r, m - r], top = lam[0];
    // (The eigenvectors: the larger's from (b, λ − a) or (λ − c, b), the other square to it; any pair when λ₁ = λ₂.)
    let ux = 1, uy = 0;
    if (r > 1e-12) { ux = b; uy = lam[0] - a; if (Math.hypot(ux, uy) < 1e-12) { ux = lam[0] - c; uy = b; } const l = Math.hypot(ux, uy); ux /= l; uy /= l; }
    const vec = [[ux, uy], [-uy, ux]];
    let dx = 0, dy = 0;
    for (let k = 0; k < 2; k++) {
      if (!(lam[k] > 1e-4 * top)) continue;
      const [ex, ey] = vec[k], c2 = (ex * rx + ey * ry) / lam[k]; dx += c2 * ex; dy += c2 * ey;
    }
    return [p[0] + dx, p[1] + dy];
  });
}
/** Two segments crossing strictly inside both. */
function cross(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]); if (Math.abs(d) < 1e-12) return null;
  const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, w = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return u > 1e-9 && u < 1 - 1e-9 && w > 1e-9 && w < 1 - 1e-9 ? [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])] : null;
}
/** The offset's crossings with itself and with the section (pieces sharing no corner). */
function crossings(Q) {
  const out = [];
  for (let i = 0; i < NS; i++) for (let j = i + 1; j < NS; j++) {
    if (j === i + 1 || (i === 0 && j === NS - 1)) continue;
    const x = cross(Q[i], Q[(i + 1) % NS], Q[j], Q[(j + 1) % NS]); if (x) out.push(x);
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) { const x = cross(Q[i], Q[(i + 1) % NS], SEC[j], SEC[(j + 1) % NS]); if (x) out.push(x); }
  return out;
}

// ---- the voxel cavity at t = 1.5, h = 0.75 ---------------------------------------------------------------------------
const OFF = [1 / Math.PI, 1 / Math.E], LO = [0, 0], HI = [24, 12];
const O = [0, 1].map(k => LO[k] - 2 * H + OFF[k] * H), NN = [0, 1].map(k => Math.ceil((HI[k] - O[k] + 2 * H) / H) + 1);
const NODES = NN[0] * NN[1], CAPD = T_DEEP + 2 * H;
const node = id => { const i = id % NN[0], j = (id - i) / NN[0]; return [O[0] + i * H, O[1] + j * H]; };
const INSIDE = new Uint8Array(NODES), DEPTH = new Float64Array(NODES), PHI = new Float64Array(NODES).fill(-T_DEEP);
for (let j = 0; j < NN[1]; j++) {
  const y = O[1] + j * H, xs = [];
  for (let k = 0; k < NS; k++) { const p = SEC[k], q = SEC[(k + 1) % NS]; if (p[1] === q[1]) continue; const s = (y - p[1]) / (q[1] - p[1]); if (s < 0 || s > 1) continue; xs.push(p[0] + s * (q[0] - p[0])); }
  xs.sort((p, q) => p - q);
  let c = 0;
  for (let i = 0; i < NN[0]; i++) { const x = O[0] + i * H; while (c < xs.length && xs[c] < x) c++; if (c % 2 === 1) INSIDE[j * NN[0] + i] = 1; }
}
function nearest(x, y) {
  let best = CAPD * CAPD;
  for (let k = 0; k < NS; k++) {
    const p = SEC[k], q = SEC[(k + 1) % NS], dx = q[0] - p[0], dy = q[1] - p[1], s = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, (p[0] + s * dx - x) ** 2 + (p[1] + s * dy - y) ** 2);
  }
  return Math.sqrt(best);
}
for (let id = 0; id < NODES; id++) if (INSIDE[id]) { const [x, y] = node(id); DEPTH[id] = nearest(x, y); PHI[id] = DEPTH[id] - T_DEEP; }
/** The zero line of φ: per cell, two triangles about the diagonal (0,0)–(1,1); a segment where a triangle has one or two corners inside. */
const ZERO = [];
{
  const C = [[0, 0], [1, 0], [0, 1], [1, 1]], TRI = [[0, 1, 3], [0, 3, 2]];
  const on = (a, b) => { const s = Math.min(1 - 1e-9, Math.max(1e-9, PHI[a] / (PHI[a] - PHI[b]))), pa = node(a), pb = node(b); return [pa[0] + s * (pb[0] - pa[0]), pa[1] + s * (pb[1] - pa[1])]; };
  for (let j = 0; j + 1 < NN[1]; j++) for (let i = 0; i + 1 < NN[0]; i++) for (const tr of TRI) {
    const ids = tr.map(c => (j + C[c][1]) * NN[0] + i + C[c][0]), pin = ids.filter(d => PHI[d] > 0), pout = ids.filter(d => !(PHI[d] > 0));
    if (pin.length === 1) ZERO.push([on(pin[0], pout[0]), on(pin[0], pout[1]), j]);
    else if (pin.length === 2) ZERO.push([on(pin[0], pout[0]), on(pin[1], pout[0]), j]);
  }
}
// The cavity's pieces (4-connected nodes with φ > 0), each with its drain node: of its lowest nodes, the one nearest their middle.
const LABEL = new Int32Array(NODES).fill(-1), PIECES = [];
for (let s0 = 0; s0 < NODES; s0++) {
  if (!(PHI[s0] > 0) || LABEL[s0] >= 0) continue;
  const c = PIECES.length, stack = [s0], members = []; LABEL[s0] = c;
  while (stack.length) {
    const v = stack.pop(); members.push(v); const i = v % NN[0], j = (v - i) / NN[0];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NN[0] || b >= NN[1]) continue; const w = b * NN[0] + a; if (PHI[w] > 0 && LABEL[w] < 0) { LABEL[w] = c; stack.push(w); } }
  }
  const low = Math.min(...members.map(v => node(v)[1])), floor = members.filter(v => node(v)[1] <= low + 1e-9), mid = floor.reduce((s, v) => s + node(v)[0], 0) / floor.length;
  const drain = floor.reduce((b, v) => (Math.abs(node(v)[0] - mid) < Math.abs(node(b)[0] - mid) ? v : b), floor[0]);
  PIECES.push({ nodes: members.length, drain: node(drain) });
}
const COUNT_INSIDE = INSIDE.reduce((n, x) => n + x, 0), COUNT_CAVITY = PHI.reduce((n, x) => n + (x > 0 ? 1 : 0), 0);

// ---- drawing ----------------------------------------------------------------------------------------------------------
const X = x => 30 + 12.5 * x, Y = y => 200 - 12.5 * y;
const f1 = v => Math.round(v * 10) / 10;
const poly = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(X(p[0]))} ${f1(Y(p[1]))}`).join('') + 'Z';
const SEC_PATH = poly(SEC);
const TICKS = SEC.map((p, i) => { const q = SEC[(i + 1) % NS], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n = NORMAL[i]; return { x1: X(m[0]), y1: Y(m[1]), x2: X(m[0] + 1.4 * n[0]), y2: Y(m[1] + 1.4 * n[1]) }; });
const NODE_XY = Array.from({ length: NODES }, (_, id) => { const [x, y] = node(id); return [f1(X(x)), f1(Y(y))]; });

const steps = [
  { label: 'A closed mesh, wound outward', text: 'Shelling a mesh body makes its cavity from the mesh\'s own triangles, moved in by the wall t. The figure shows a section through a U-shaped body, its slot down to 2 mm above the bottom; each piece of the outline stands for the triangles there, each with its outward normal. The mesh must be closed and wound one way (every edge used once each way) with no triangle of no area, or it is refused, <code>[SHELL_MESH_NOT_CLOSED]</code>: repair it first.' },
  { label: 'Each plane moved in by t', text: `Each triangle's plane, moved in along its normal by t = ${T_OK} mm. Where the planes meet, the new vertex should lie on all of them.`, formula: 'plane k: n<sub>k</sub> · x = n<sub>k</sub> · p<sub>k</sub> − t' },
  { label: 'Each vertex to the least-squares point', text: `Each vertex moves by the d that best fits its triangles' moved planes, each weighted by the triangle's angle at the vertex. The 3 × 3 system is solved through its eigenvectors; a direction it spans less than 10⁻⁴ of its largest is left out. So where up to three planes meet, the result is their sharp join exactly: a corner, a mitre on an edge, a flat point along its normal. Round a smooth vertex the wall lies within the spread of its normals. The offset keeps the mesh's triangles. On this section extruded 10 mm the kernel measures the wall it achieves at ${T_OK}: least ${T_OK}, largest ${T_OK} mm.`, formula: '(Σ<sub>k</sub> w<sub>k</sub> n<sub>k</sub> n<sub>k</sub><sup>T</sup>) d = −t Σ<sub>k</sub> w<sub>k</sub> n<sub>k</sub> · w<sub>k</sub> = the angle of triangle k at the vertex' },
  { label: 'Too deep: refused by name', text: `As t grows past 1 mm the slot floor's offset passes below the bottom's: the inner surface crosses itself. The kernel checks, in order: a triangle of the offset facing against its own, or the whole offset enclosing no volume (<code>[OFFSET_FOLDS]</code>); the offset crossing itself or the mesh, found through mesh repair's grid (<code>[WALL_TOO_THIN]</code>); the wall measured more than 1 % thinner than t (<code>[MESH_WALL_THIN]</code>). This U extruded is stopped at ${T_DEEP} by the first check (a long, thin end-cap triangle under the slot floor turns over); a box with a pocket 2 above its floor, at the second.`, formula: 'refused when wall<sub>min</sub> &lt; 0.99 t · wall = distance from the offset\'s vertices and triangle centres to the mesh' },
  { label: 'The voxel route: inside by ray parity', text: `The studio's hollowing for printing tries this exact shell first and, when it refuses, makes the cavity on a grid instead. The grid's spacing h is at most t/2 (by default t/4; here ${H}, at t = ${T_DEEP}), shifted by a different irrational share of h on each axis (1/π, 1/e, √2 − 1) so that rows miss the vertices and edges of a part drawn on round numbers. Each row is a ray along +x: its crossings with the triangles, sorted; a node is inside when an odd number lie before it.`, formula: `${NN[0]} × ${NN[1]} nodes · inside: ${COUNT_INSIDE}` },
  { label: 'Depth below the surface, capped', text: `Each inside node's depth is its distance to the nearest triangle, found through the triangle hierarchy (the BVH's nearest query, bounded). Past t + 2h = ${CAPD} mm a node is deep enough for this question, so the search stops there.`, formula: `depth = min(distance to the nearest triangle, t + 2h) · outside: φ = −t` },
  { label: 'φ = depth − t: the cavity\'s boundary', text: `The cavity is where φ = depth − t is positive, and its boundary is where φ = 0. Marching tetrahedra (six to a cube, about its diagonal) mesh it with no ambiguous case. The result is a closed, manifold mesh whose vertices are shared along each grid edge. Where the body is thinner than 2t (the floor under the slot) no node is deep enough, so the cavity comes out in ${PIECES.length} pieces. Each piece is simplified (decimation within h/50, then h/20 or h/10 if the Boolean refuses), subtracted from the part, and given a drain from the bottom into its floor.`, formula: `cavity nodes ${COUNT_CAVITY} · pieces ${PIECES.length} · 3D (this U, 10 mm long): 13 986 nodes, 2 pieces, 8 368 triangles` },
];
const s = useSteps(steps.length, [2600, 2600, 3000, 4200, 3600, 2800, 3600], root);
const e = computed(() => ease(s.t.value));

const tNow = computed(() => s.step.value === 3 ? T_OK + (T_DEEP - T_OK) * e.value : s.step.value < 3 ? T_OK : T_DEEP);
const off = computed(() => {
  const st = s.step.value;
  if (st < 2 || st > 3) return null;
  const Q = offset(tNow.value);
  if (st === 2) return { pts: SEC.map((p, i) => [p[0] + (Q[i][0] - p[0]) * e.value, p[1] + (Q[i][1] - p[1]) * e.value]), x: [] };
  return { pts: Q, x: crossings(Q) };
});
const planes = computed(() => {
  const st = s.step.value;
  if (st < 1 || st > 2) return [];
  const t = T_OK * (st === 1 ? e.value : 1), ext = 2.2;
  return SEC.map((p, i) => {
    const q = SEC[(i + 1) % NS], n = NORMAL[i], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    const a = [p[0] - t * n[0] - ext * dx / l, p[1] - t * n[1] - ext * dy / l], b = [q[0] - t * n[0] + ext * dx / l, q[1] - t * n[1] + ext * dy / l];
    return { x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]) };
  });
});
const rowsDone = computed(() => s.step.value === 4 ? Math.floor(e.value * (NN[1] + 0.99)) : s.step.value > 4 ? NN[1] : 0);
const nodes = computed(() => {
  const st = s.step.value;
  if (st < 4) return [];
  const out = [];
  for (let id = 0; id < NODES; id++) {
    const j = Math.floor(id / NN[0]), xy = NODE_XY[id];
    let cls = 'node', depth = 0;
    if (j < rowsDone.value && INSIDE[id]) {
      cls = 'node in';
      if (st >= 5) { depth = Math.min(1, DEPTH[id] / CAPD) * (st === 5 ? e.value : 1); cls = st === 6 && PHI[id] > 0 ? 'node cav' : 'node deep'; }
    }
    out.push({ id, x: xy[0], y: xy[1], cls, depth: Math.round(15 + 60 * depth) });
  }
  return out;
});
const zero = computed(() => {
  if (s.step.value !== 6) return [];
  const upto = e.value * (NN[1] + 0.99);
  return ZERO.filter(z => z[2] < upto).map(z => ({ x1: f1(X(z[0][0])), y1: f1(Y(z[0][1])), x2: f1(X(z[1][0])), y2: f1(Y(z[1][1])) }));
});
const rowY = computed(() => (s.step.value === 4 && rowsDone.value < NN[1] ? Y(O[1] + rowsDone.value * H) : null));
const readout = computed(() => {
  const st = s.step.value;
  if (st <= 1) return st === 1 ? `t = ${T_OK} mm` : '8 pieces, wound counter-clockwise (outward normals)';
  if (st <= 3) { const n = off.value ? off.value.x.length : 0; return `t = ${num(tNow.value, 2)} mm${st === 3 ? (n ? ` · ${n} crossings: [WALL_TOO_THIN]` : ' · no crossing') : ''}`; }
  if (st === 4) return `h = ${H} mm · rows ${rowsDone.value} of ${NN[1]}`;
  if (st === 5) return `depth capped at t + 2h = ${CAPD} mm`;
  return `φ > 0 at ${COUNT_CAVITY} nodes · ${PIECES.length} pieces`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Inner offsets: the exact shell and the voxel cavity" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A U-shaped section offset inward: vertices moved to the least-squares point of the moved planes, refused when the offsets cross; then a voxel grid's inside, depth and zero line of depth minus t">
        <path :d="SEC_PATH" class="body" :class="{ faint: s.step.value >= 4 }" />
        <g v-if="s.step.value === 0">
          <line v-for="(k, i) in TICKS" :key="'n' + i" :x1="k.x1" :y1="k.y1" :x2="k.x1 + (k.x2 - k.x1) * e" :y2="k.y1 + (k.y2 - k.y1) * e" class="tick" />
        </g>
        <line v-for="(p, i) in planes" :key="'pl' + i" :x1="p.x1" :y1="p.y1" :x2="p.x2" :y2="p.y2" class="plane" />
        <g v-if="off">
          <path :d="poly(off.pts)" class="cavity" :class="{ bad: off.x.length }" />
          <circle v-for="(p, i) in off.pts" :key="'q' + i" :cx="X(p[0])" :cy="Y(p[1])" r="2.4" class="pt" />
          <circle v-for="(p, i) in off.x" :key="'x' + i" :cx="X(p[0])" :cy="Y(p[1])" r="4.5" class="crossing" />
        </g>
        <g v-if="nodes.length">
          <circle v-for="n in nodes" :key="n.id" :cx="n.x" :cy="n.y" r="1.6" :class="n.cls" :style="n.cls === 'node deep' ? { fill: `color-mix(in srgb, var(--a) ${n.depth}%, var(--vp-c-bg))` } : null" />
          <line v-if="rowY !== null" x1="12" :y1="rowY" x2="368" :y2="rowY" class="ray" />
          <line v-for="(z, i) in zero" :key="'z' + i" :x1="z.x1" :y1="z.y1" :x2="z.x2" :y2="z.y2" class="zero" />
          <g v-if="s.step.value === 6 && s.t.value >= 0.95">
            <line v-for="(p, i) in PIECES" :key="'d' + i" :x1="X(p.drain[0])" :y1="Y(0)" :x2="X(p.drain[0])" :y2="Y(p.drain[1])" class="drain" />
            <text v-for="(p, i) in PIECES" :key="'dt' + i" :x="X(p.drain[0]) + 4" :y="Y(0) - 3" class="small">drain</text>
          </g>
        </g>
        <g class="readout"><text x="12" y="240">{{ readout }}</text></g>
      </svg>
      <template #note>A 2D section computed in the page. The exact shell is the kernel's solve restated for lines; the voxel
        route is the kernel's inside, depth and marching method one dimension down, with the section's y as the print
        direction for the drains. The 3D numbers in the steps are the built kernel's on this section extruded 10 mm.
        h = t/2 is the coarsest the hollowing accepts; its default is t/4.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .small { font-size: 9.5px; fill: var(--vp-c-text-3); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); }
.body { fill: color-mix(in srgb, var(--a) 16%, var(--vp-c-bg)); stroke: var(--vp-c-text-1); stroke-width: 1.6; stroke-linejoin: round; }
.body.faint { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.tick { stroke: var(--a); stroke-width: 1.5; stroke-linecap: round; }
.plane { stroke: var(--b); stroke-width: 0.9; stroke-dasharray: 4 2; }
.cavity { fill: var(--vp-c-bg); stroke: var(--keep); stroke-width: 1.6; stroke-linejoin: round; }
.cavity.bad { stroke: var(--hot); }
.pt { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
.crossing { fill: none; stroke: var(--hot); stroke-width: 1.8; }
.node { fill: var(--vp-c-divider); }
.node.in { fill: var(--a); }
.node.cav { fill: var(--b); }
.ray { stroke: var(--hot); stroke-width: 1; stroke-dasharray: 3 2; }
.zero { stroke: var(--hot); stroke-width: 1.6; stroke-linecap: round; }
.drain { stroke: var(--vp-c-text-1); stroke-width: 2.4; stroke-dasharray: 3 2; }
</style>
