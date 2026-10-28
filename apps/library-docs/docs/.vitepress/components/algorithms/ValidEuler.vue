<script setup>
// Euler operators building a plate with a through hole (brep-euler.ts, used by brep-sweep.ts extrudeProfileWithHoles).
// The counts after each operator were read from the built kernel (packages/barocss-cad/dist/index.js): BrepEditor's
// `counts` replaying extrudeProfileWithHoles' sequence for a 30 × 30 plate, 8 high, with a 10 × 10 square hole; the
// result matches checkBrep(extrudeProfileWithHoles(…)).topology (V 16, E 24, F 10, L 12, S 1, G 1). The last step's
// counts are checkBrep's for extrudeProfileWithHoles with 0–3 square holes as drawn, and for booleanPolyhedra of the
// plate minus a 10 × 10 × 4 box inside it (a cavity).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const D = norm([0.5, -1, 0.75]), RT = norm([1, 0.5, 0]);
const UP = [D[1] * RT[2] - D[2] * RT[1], D[2] * RT[0] - D[0] * RT[2], D[0] * RT[1] - D[1] * RT[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const view = p => [40 + 3.4 * dot(p, RT), 150 - 3.4 * dot(p, UP)];
const pts = list => list.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const ring = (r, z) => r.map(([x, y]) => view([x, y, z]));
const path = rings => rings.map(r => 'M' + r.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z').join('');
const lerp = (a, b, m) => [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m];
const clamp01 = x => Math.max(0, Math.min(1, x));

const OUTER = [[0, 0], [30, 0], [30, 30], [0, 30]], HOLE = [[10, 10], [20, 10], [20, 20], [10, 20]];
const H = 8;
const square = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// [V, E, F, L, S] after each operator (BrepEditor counts, see above).
const SNAP = {
  mvfs: [1, 0, 1, 1, 1], mev1: [2, 1, 1, 1, 1], mev2: [3, 2, 1, 1, 1], mev3: [4, 3, 1, 1, 1], mef: [4, 4, 2, 2, 1],
  bridge: [5, 5, 2, 2, 1], h1: [6, 6, 2, 2, 1], h2: [7, 7, 2, 2, 1], h3: [8, 8, 2, 2, 1], plug: [8, 9, 3, 3, 1], kemr: [8, 8, 3, 4, 1],
  strutsOuter: [12, 12, 3, 4, 1], sidesOuter: [12, 16, 7, 8, 1], strutsRing: [16, 20, 7, 8, 1], sidesRing: [16, 24, 11, 12, 1], kfmrh: [16, 24, 10, 12, 1],
};
const OPS = {
  mvfs: 'mvfs · +1 V, +1 F, +1 S', mev: 'mev · +1 V, +1 E', mef: 'mef · +1 E, +1 F', kemr: 'kemr · −1 E, +1 ring',
  sweep: 'mev ×8 · mef ×8', kfmrh: 'kfmrh · −1 F, +1 ring, +1 G',
};
// The last step's bodies: checkBrep's counts for each.
const CHOICES = [
  { label: '0 holes', holes: [], counts: [8, 12, 6, 6, 1] },
  { label: '1', holes: [[10, 10, 20, 20]], counts: [16, 24, 10, 12, 1] },
  { label: '2', holes: [[5, 12, 11, 18], [19, 12, 25, 18]], counts: [24, 36, 14, 18, 1] },
  { label: '3', holes: [[3, 12, 9, 18], [12, 12, 18, 18], [21, 12, 27, 18]], counts: [32, 48, 18, 24, 1] },
  { label: 'cavity', holes: [], cavity: [10, 10, 2, 20, 20, 6], counts: [16, 24, 12, 12, 2] },
];
const chosen = ref(1);

const steps = [
  { label: 'mvfs: a vertex, a face, a shell', text: 'Euler–Poincaré is also how the kernel builds some B-reps. Each <b>Euler operator</b> changes the counts so that the formula still holds. <code>extrudeProfileWithHoles</code> makes a plate with holes this way. It starts with <code>mvfs</code>: make a vertex, a face and a shell. The face has one loop with no coedges yet, anchored at the vertex.', formula: 'mvfs: +1 V, +1 F, +1 S · 1 − 0 + 1 − 0 = 2 = 2(1 − 0)' },
  { label: 'mev: struts', text: '<code>mev</code> makes an edge and a vertex: a strut out of a vertex of the loop. The loop runs out along the strut and back, so it uses the new edge twice, once each way. Three struts trace three sides of the square.', formula: 'mev: +1 V, +1 E · V − E + F − (L − F) does not change' },
  { label: 'mef: two faces', text: '<code>mef</code> makes an edge and a face. An edge between two vertices of one loop splits the loop in two. Closing the square leaves a <i>lamina</i>: two faces, A and B, whose loops run round the same four edges in opposite directions.', formula: 'mef: +1 E, +1 F (and its loop) · 4 − 4 + 2 − 0 = 2' },
  { label: 'kemr: a ring', text: 'The hole: a strut from the outer loop to the hole\'s first corner (the bridge), struts round the hole, and an <code>mef</code> to close it, which cuts off a plug face. Then <code>kemr</code> kills the bridge and makes a ring. The hole\'s loop becomes an inner loop of A.', formula: 'kemr: −1 E, +1 ring · 8 − 8 + 3 − 1 = 2' },
  { label: 'Sweep: walls', text: 'Every loop of A is swept up: a strut (<code>mev</code>) at each of its vertices, then a side face (<code>mef</code>) between each pair of neighbouring struts. A becomes the top. The body is now closed, but the hole is still capped at the bottom by the plug.', formula: '+8 V, +16 E, +8 F · 16 − 24 + 11 − 1 = 2 = 2(1 − 0)' },
  { label: 'kfmrh: a through hole', text: '<code>kfmrh</code> kills the plug face and makes its loop a ring of B, the bottom face: the hole now goes through. One face fewer and one ring more lower the sum by 2, so the genus rises to 1.', formula: 'kfmrh: −1 F, +1 ring, +1 G · 16 − 24 + 10 − 2 = 0 = 2(1 − 1)' },
  { label: 'More holes, a cavity', text: 'How the faces are cut changes the counts, but the formula still holds. Each square through hole adds 8 V, 12 E, 4 F and 6 L, and raises G by one. A closed cavity is a second shell of the same body: S = 2, and G stays 0. Choose a body below; the counts are <code>checkBrep</code>\'s.', formula: 'G = S − (V − E + F − (L − F)) / 2' },
];
const s = useSteps(steps.length, [2200, 3000, 2600, 5200, 4200, 3000, 6000], root);
const st = computed(() => s.step.value);

/** What the figure shows at the current step and time. */
const state = computed(() => {
  const n = st.value, t = s.t.value;
  const x = { outer: [0, 0, 0, 0], v0: 1, bridge: 0, bridgeAlpha: 0, hole: [0, 0, 0, 0], lamina: 0, plug: 0, ringCut: false, h: null, holes: [HOLE], cavity: null, snap: SNAP.mvfs, op: OPS.mvfs, note: '' };
  if (n === 0) { x.v0 = clamp01(t * 3); x.note = 'one vertex; its face\'s loop has no coedges yet'; return x; }
  x.outer = [1, 1, 1, 0];
  if (n === 1) {
    const g = t * 3.2; x.outer = [clamp01(g), clamp01(g - 1), clamp01(g - 2), 0];
    x.snap = [SNAP.mvfs, SNAP.mev1, SNAP.mev2, SNAP.mev3][Math.min(3, Math.ceil(Math.min(3, g)))]; x.op = OPS.mev;
    x.note = 'each strut: one edge, used twice by the loop (out and back)'; return x;
  }
  if (n === 2) {
    x.outer[3] = clamp01(t * 1.7); x.lamina = clamp01((t - 0.6) * 2.5);
    x.snap = t < 0.6 ? SNAP.mev3 : SNAP.mef; x.op = OPS.mef; x.note = 'a lamina: faces A and B on one boundary'; return x;
  }
  x.outer[3] = 1; x.lamina = 1;
  if (n === 3) {
    x.bridge = clamp01(t / 0.18); x.bridgeAlpha = t < 0.75 ? 1 : 1 - clamp01((t - 0.75) / 0.2);
    const g = (t - 0.2) / 0.35 * 3; x.hole = [clamp01(g), clamp01(g - 1), clamp01(g - 2), clamp01((t - 0.56) / 0.12)];
    x.plug = clamp01((t - 0.66) / 0.08); x.ringCut = t >= 0.66;
    if (t < 0.2) { x.snap = t > 0 ? SNAP.bridge : SNAP.mef; x.op = OPS.mev; x.note = 'the bridge: a strut to the hole\'s first corner'; }
    else if (t < 0.56) { x.snap = [SNAP.bridge, SNAP.h1, SNAP.h2, SNAP.h3][Math.min(3, Math.ceil(Math.min(3, g)))]; x.op = OPS.mev; x.note = 'struts round the hole'; }
    else if (t < 0.75) { x.snap = t < 0.66 ? SNAP.h3 : SNAP.plug; x.op = OPS.mef; x.note = 'mef closes the hole: a plug face P'; }
    else { x.snap = SNAP.kemr; x.op = OPS.kemr; x.note = 'the bridge killed: the hole\'s loop is a ring of A'; }
    return x;
  }
  x.hole = [1, 1, 1, 1]; x.plug = 1; x.ringCut = true; x.bridgeAlpha = 0;
  if (n === 4) {
    x.h = H * ease(t); x.snap = [SNAP.strutsOuter, SNAP.sidesOuter, SNAP.strutsRing, SNAP.sidesRing][Math.min(3, Math.floor(t * 4))];
    x.op = OPS.sweep; x.note = 'A rises to the top; P still caps the hole'; return x;
  }
  x.h = H;
  if (n === 5) { x.plug = 1 - ease(t); x.snap = t < 0.5 ? SNAP.sidesRing : SNAP.kfmrh; x.op = OPS.kfmrh; x.note = 'P\'s loop becomes a ring of the bottom face B'; return x; }
  const c = CHOICES[chosen.value];
  x.plug = 0; x.holes = c.holes.map(square); x.cavity = c.cavity ?? null; x.snap = c.counts; x.op = ''; x.note = c.cavity ? 'a closed cavity inside (dashed): a second shell' : `${c.holes.length} through hole${c.holes.length === 1 ? '' : 's'}`;
  return x;
});

/** The plate at height h: plugs, the hole walls that face the viewer, top, front and right faces, a cavity's edges. */
const plate = computed(() => {
  const x = state.value; if (x.h === null) return null;
  const h = Math.max(0, x.h), walls = [], plugs = [];
  for (const r of x.holes) {
    const [x0, y0] = r[0], [x1, y1] = r[2];
    if (x.plug > 0) plugs.push(pts(ring(r, 0)));
    walls.push(pts([view([x0, y1, 0]), view([x1, y1, 0]), view([x1, y1, h]), view([x0, y1, h])]));
    walls.push(pts([view([x0, y0, 0]), view([x0, y1, 0]), view([x0, y1, h]), view([x0, y0, h])]));
  }
  const top = path([ring(OUTER, h), ...x.holes.map(r => ring(r, h))]);
  const front = pts([view([0, 0, 0]), view([30, 0, 0]), view([30, 0, h]), view([0, 0, h])]);
  const right = pts([view([30, 0, 0]), view([30, 30, 0]), view([30, 30, h]), view([30, 0, h])]);
  let cavity = [];
  if (x.cavity) {
    const [a, b, c, d, e, f] = x.cavity, corner = [[a, b], [d, b], [d, e], [a, e]];
    const lo = corner.map(([p, q]) => view([p, q, c])), hi = corner.map(([p, q]) => view([p, q, f]));
    cavity = [0, 1, 2, 3].flatMap(i => [[lo[i], lo[(i + 1) % 4]], [hi[i], hi[(i + 1) % 4]], [lo[i], hi[i]]]);
  }
  return { walls, plugs, top, front, right, cavity, plugAlpha: x.plug };
});

const O3 = OUTER.map(p => view([p[0], p[1], 0])), H3 = HOLE.map(p => view([p[0], p[1], 0]));
const lamina = computed(() => {
  const x = state.value; if (x.h !== null) return null;
  const segs = [];
  x.outer.forEach((g, i) => { if (g > 0) segs.push({ a: O3[i], b: lerp(O3[i], O3[(i + 1) % 4], g), cls: '' }); });
  if (x.bridge > 0 && x.bridgeAlpha > 0) segs.push({ a: O3[0], b: lerp(O3[0], H3[0], x.bridge), cls: 'bridge', alpha: x.bridgeAlpha });
  x.hole.forEach((g, i) => { if (g > 0) segs.push({ a: H3[i], b: lerp(H3[i], H3[(i + 1) % 4], g), cls: 'holeedge' }); });
  const dots = [];
  if (x.v0 > 0) dots.push({ p: O3[0], r: 3.4 * x.v0 });
  x.outer.forEach((g, i) => { if (i < 3 && g >= 1) dots.push({ p: O3[i + 1], r: 3.4 }); });
  if (x.bridge >= 1) dots.push({ p: H3[0], r: 3 });
  x.hole.forEach((g, i) => { if (i < 3 && g >= 1) dots.push({ p: H3[i + 1], r: 3 }); });
  const face = x.lamina > 0 ? (x.ringCut ? path([O3, H3]) : path([O3])) : '';
  return { segs, dots, face, faceAlpha: x.lamina, plug: x.plug > 0 ? pts(H3) : '', plugAlpha: x.plug };
});

const sums = computed(() => {
  const [V, E, F, L, S] = state.value.snap, R = L - F, sum = V - E + F - R;
  return { V, E, F, L, S, R, sum: sum < 0 ? `−${-sum}` : `${sum}`, inG: sum < 0 ? `(−${-sum})` : `${sum}`, G: S - sum / 2 };
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Euler operators: a plate with a through hole" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A square plate built by Euler operators: vertex, struts, a lamina, a ring, walls swept up, the plug removed to make a through hole; the counts and genus after each operator">
        <text x="12" y="20" class="op">{{ state.op }}</text>
        <g v-if="lamina">
          <path v-if="lamina.face" :d="lamina.face" fill-rule="evenodd" class="lam" :opacity="lamina.faceAlpha" />
          <polygon v-if="lamina.plug" :points="lamina.plug" class="plug" :opacity="lamina.plugAlpha" />
          <line v-for="(g, i) in lamina.segs" :key="'s' + i" :x1="g.a[0]" :y1="g.a[1]" :x2="g.b[0]" :y2="g.b[1]" class="seg" :class="g.cls" :opacity="g.alpha ?? 1" />
          <circle v-for="(d, i) in lamina.dots" :key="'d' + i" :cx="d.p[0]" :cy="d.p[1]" :r="Math.max(0, d.r)" class="dot" />
          <circle v-if="st === 0" :cx="O3[0][0]" :cy="O3[0][1]" :r="Math.max(0, 9 * state.v0)" class="anchor" />
        </g>
        <g v-if="plate">
          <polygon v-for="(p, i) in plate.plugs" :key="'p' + i" :points="p" class="plug" :opacity="plate.plugAlpha" />
          <polygon v-for="(w, i) in plate.walls" :key="'w' + i" :points="w" class="wall" :class="{ dark: i % 2 === 1 }" />
          <path :d="plate.top" fill-rule="evenodd" class="top" />
          <polygon :points="plate.front" class="side" />
          <polygon :points="plate.right" class="side dark" />
          <line v-for="(c, i) in plate.cavity" :key="'c' + i" :x1="c[0][0]" :y1="c[0][1]" :x2="c[1][0]" :y2="c[1][1]" class="cav" />
        </g>
        <g class="panel">
          <text x="244" y="24" class="ptitle">counts</text>
          <g v-for="(row, i) in [['V', sums.V], ['E', sums.E], ['F', sums.F], ['L', sums.L], ['S', sums.S], ['L − F (rings)', sums.R]]" :key="'r' + i">
            <text x="244" :y="42 + 15 * i">{{ row[0] }}</text>
            <text x="370" :y="42 + 15 * i" text-anchor="end" class="pnum">{{ row[1] }}</text>
          </g>
          <line x1="244" y1="138" x2="370" y2="138" class="rule" />
          <text x="244" y="156">V − E + F − (L − F)</text>
          <text x="370" y="172" text-anchor="end" class="pnum">= {{ sums.sum }}</text>
          <text x="244" y="192" class="pres">G = {{ sums.S }} − {{ sums.inG }}/2 = {{ sums.G }}</text>
        </g>
        <text x="12" y="238" class="readout">{{ state.note }}</text>
      </svg>
      <div v-if="st === 6" class="ops" role="group" aria-label="Body">
        <button v-for="(c, i) in CHOICES" :key="c.label" type="button" :aria-pressed="chosen === i" @click="chosen = i">{{ c.label }}</button>
      </div>
      <template #note>Counts are the kernel's: Euler-operator counts replaying <code>extrudeProfileWithHoles</code> for this
        plate, and <code>checkBrep</code>'s topology for the bodies of the last step. The drawing raises both of A's loops at
        once; the kernel sweeps the outer loop first, then the ring. The cavity is drawn by its edges (dashed); it is closed
        inside the plate.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.op { font-family: var(--vp-font-family-mono); font-size: 11px; font-weight: 700; fill: var(--vp-c-text-1); }
.lam { fill: color-mix(in srgb, var(--a) 16%, transparent); }
.plug { fill: color-mix(in srgb, var(--b) 30%, var(--vp-c-bg)); stroke: var(--b); stroke-width: 1.2; }
.seg { stroke: var(--a); stroke-width: 1.6; stroke-linecap: round; }
.seg.holeedge { stroke: var(--b); }
.seg.bridge { stroke: var(--hot); stroke-dasharray: 4 3; }
.dot { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.anchor { fill: none; stroke: var(--a); stroke-width: 1; stroke-dasharray: 2 2; }
.top { fill: color-mix(in srgb, var(--a) 16%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1.3; stroke-linejoin: round; }
.side { fill: color-mix(in srgb, var(--a) 28%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1.3; stroke-linejoin: round; }
.side.dark { fill: color-mix(in srgb, var(--a) 40%, var(--vp-c-bg)); }
.wall { fill: color-mix(in srgb, var(--a) 34%, var(--vp-c-bg)); stroke: var(--a); stroke-width: 1; stroke-linejoin: round; }
.wall.dark { fill: color-mix(in srgb, var(--a) 46%, var(--vp-c-bg)); }
.cav { stroke: var(--hot); stroke-width: 1.3; stroke-dasharray: 3 2; }
.panel text { font-size: 11px; }
.ptitle { font-weight: 700; fill: var(--vp-c-text-1); }
.pnum { font-family: var(--vp-font-family-mono); fill: var(--vp-c-text-1); }
.rule { stroke: var(--vp-c-divider); }
.pres { font-weight: 700; fill: var(--keep); font-family: var(--vp-font-family-mono); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 12px 12px; font-size: 12px; }
.ops button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 9px; font-size: 12px; font-weight: 600; background: var(--vp-c-bg); }
.ops button[aria-pressed="true"] { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.ops button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
