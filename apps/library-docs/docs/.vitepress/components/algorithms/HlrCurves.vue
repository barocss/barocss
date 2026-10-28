<script setup>
// Which curves a view draws, and how they project (brep-hidden-line.ts `projectBrepHiddenLines`): a 40 × 30 × 10 box
// with a boss of radius 8, 12 high, joined on top. Its B-rep has 18 edges: 12 of the box, four half circles (the boss's
// rims, cut in two by the Boolean) and two straight joints where the boss's wall is split into c.side0#1 and #2. The
// projection is computed here as the kernel does it: right = unit(up × toward), up' = toward × right, P(p) = (p·right,
// p·up'); a circle centre c, radius r, frame e1, e2 → C + U cos t + V sin t with U = r P(e1), V = r P(e2).
// The kernel gives, for toward (1, −1, 1): right (0.707, 0.707, 0), u = (5.657, −3.266), v = (5.657, 3.266) for every
// rim, silhouettes at x = 16.749 and 32.749 (node, packages/barocss-cad/dist/index.js) — the same numbers as here.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const C0 = [20, 15], R = 8, Z0 = 10, Z1 = 22;
const box = [[0, 0, 0], [40, 0, 0], [40, 30, 0], [0, 30, 0], [0, 0, 10], [40, 0, 10], [40, 30, 10], [0, 30, 10]];
// Box edges by corner index; `along` names the axis each runs along (y: end-on in the front view).
const boxEdges = [[0, 1, 'x'], [1, 2, 'y'], [2, 3, 'x'], [3, 0, 'y'], [4, 5, 'x'], [5, 6, 'y'], [6, 7, 'x'], [7, 4, 'y'], [0, 4, 'z'], [1, 5, 'z'], [2, 6, 'z'], [3, 7, 'z']];
const joints = [[[12, 15, Z0], [12, 15, Z1]], [[28, 15, Z0], [28, 15, Z1]]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const T = 72; // samples of an ellipse for drawing

function viewOf(tau) {
  const toward = unit([tau, -1, tau]), right = unit(cross([0, 0, 1], toward)), up = cross(toward, right);
  const P = p => [dot(p, right), dot(p, up)];
  // Screen frame: centred on the projected part.
  const pts = [...box.map(P), P([C0[0], C0[1], Z1])];
  for (let k = 0; k < 8; k++) { const a = 2 * Math.PI * k / 8; pts.push(P([C0[0] + R * Math.cos(a), C0[1] + R * Math.sin(a), Z1])); }
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
  const k = 5.2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const S = p => { const q = P(p); return [190 + k * (q[0] - cx), 118 - k * (q[1] - cy)]; };
  const S2 = q => [190 + k * (q[0] - cx), 118 - k * (q[1] - cy)];
  const U = P([R, 0, 0]), V = P([0, R, 0]);
  const rim = z => { const c = P([C0[0], C0[1], z]); return { c, pts: Array.from({ length: T + 1 }, (_, i) => { const t = 2 * Math.PI * i / T; return S2([c[0] + U[0] * Math.cos(t) + V[0] * Math.sin(t), c[1] + U[1] * Math.cos(t) + V[1] * Math.sin(t)]); }) }; };
  const aw = cross([0, 0, 1], toward), w = Math.hypot(...aw) < 1e-6 ? null : unit(aw);
  const sil = w ? [1, -1].map(sg => [S([C0[0] + sg * R * w[0], C0[1] + sg * R * w[1], Z0]), S([C0[0] + sg * R * w[0], C0[1] + sg * R * w[1], Z1])]) : [];
  return { toward, right, up, P, S, S2, U, V, rims: [rim(Z0), rim(Z1)], sil, k, area: Math.abs(U[0] * V[1] - U[1] * V[0]) };
}
// The views the steps need, made once (the turning step makes its own per frame).
const ISO = viewOf(1), FRONT = viewOf(0);

const steps = [
  { label: 'The edges of the B-rep', text: 'Every edge of the part is a candidate. Three kinds are left out: a <i>seam</i> (both sides of the edge belong to one face), an edge between two coplanar planar faces, and a <i>smooth joint</i>, where the two faces\' normals agree. Here the boss\'s wall is two faces of one cylinder, so its two straight joints (dashed) are left out: their normals agree exactly.', formula: 'joint left out ⇔ |n<sub>a</sub>·n<sub>b</sub>| &gt; cos 1° (planes and cylinders)' },
  { label: 'Lines stay lines', text: 'The view is orthographic. Two unit vectors span the drawing: <i>right</i> and <i>up</i>, both square to the view direction <i>toward</i> (from the model to the viewer). A 3D point p goes to (p·right, p·up). A straight edge goes to the straight line between its ends\' images, exactly.', formula: 'right = unit(up<sub>hint</sub> × toward), up = toward × right, P(p) = (p·right, p·up)' },
  { label: 'Circles become ellipses', text: 'A circle with centre c, radius r and in-plane axes e<sub>1</sub>, e<sub>2</sub> is c + r(e<sub>1</sub> cos t + e<sub>2</sub> sin t). Projection is linear, so its image is P(c) + U cos t + V sin t with U = r P(e<sub>1</sub>), V = r P(e<sub>2</sub>): an exact ellipse, kept as an arc with t<sub>0</sub>, t<sub>1</sub>.', formula: 'U = r·P(e<sub>1</sub>) = (5.657, −3.266), V = r·P(e<sub>2</sub>) = (5.657, 3.266) here' },
  { label: 'Silhouettes of the wall', text: 'A curved face also draws its outline: where its normal is square to the view direction. On a cylinder with axis a this is two straight generator lines, at c ± r w along the axis, with w the unit vector square to both the axis and the view.', formula: 'w = unit(a × toward); silhouette = c + a·s ± r·w' },
  { label: 'Turning the view', text: 'As the view turns toward the front, the rims flatten. The area spanned by U and V is r² |n·toward|, n the circle\'s normal; it falls to zero when the circle is seen edge-on. The silhouettes slide round the wall with w.', formula: '|U × V| = r² |n·toward|' },
  { label: 'Edge-on and end-on', text: 'Seen edge-on (|U × V| ≤ 10⁻⁹ × scale²) an arc becomes the straight line it covers. A line seen end-on (image shorter than 10⁻⁹ × size) is left out: the four edges along y are points now. And the wall\'s two joints lie exactly on its outline, so they are drawn, as silhouettes named <code>…~sil</code>.' },
];
const s = useSteps(steps.length, [3400, 2600, 3400, 2600, 4200, 3600], root);

const tau = computed(() => s.step.value < 4 ? 1 : s.step.value === 4 ? 1 - ease(s.t.value) : 0);
const v = computed(() => s.step.value < 4 ? ISO : s.step.value === 5 ? FRONT : viewOf(tau.value));
const line = (a, b) => ({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
const lines = computed(() => boxEdges.map(([i, j, along]) => ({ ...line(v.value.S(box[i]), v.value.S(box[j])), endOn: s.step.value === 5 && along === 'y' })));
const rimPaths = computed(() => v.value.rims.map(r => 'M' + r.pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L')));
const jointLines = computed(() => joints.map(([a, b]) => line(v.value.S(a), v.value.S(b))));
const appear = computed(() => s.step.value === 0 ? Math.min(1, ease(s.t.value) * 1.6) : 1);
const jointOpacity = computed(() => s.step.value === 0 ? Math.max(0.12, 1 - Math.max(0, (s.t.value - 0.55) / 0.45)) : s.step.value === 5 ? 0 : 0.12);
// Step 3: the rim's point at parameter t, with U and V drawn from its centre.
const tDot = computed(() => {
  if (s.step.value !== 2) return null;
  const r = v.value.rims[0], t = 2 * Math.PI * ease(s.t.value), q = [r.c[0] + v.value.U[0] * Math.cos(t) + v.value.V[0] * Math.sin(t), r.c[1] + v.value.U[1] * Math.cos(t) + v.value.V[1] * Math.sin(t)];
  const c = v.value.S2(r.c);
  return { c, p: v.value.S2(q), u: v.value.S2([r.c[0] + v.value.U[0], r.c[1] + v.value.U[1]]), w: v.value.S2([r.c[0] + v.value.V[0], r.c[1] + v.value.V[1]]) };
});
const silGrow = computed(() => s.step.value < 3 ? 0 : s.step.value === 3 ? ease(s.t.value) : 1);
const silLines = computed(() => v.value.sil.map(([a, b]) => line(a, [a[0] + (b[0] - a[0]) * silGrow.value, a[1] + (b[1] - a[1]) * silGrow.value])));
const corners = computed(() => s.step.value === 1 ? box.map(p => v.value.S(p)) : []);
const endOnDots = computed(() => s.step.value === 5 ? [[0, 0, 0], [40, 0, 0], [0, 0, 10], [40, 0, 10]].map(p => FRONT.S(p)) : []);
const readout = computed(() => `toward = (${v.value.toward.map(x => num(x, 3)).join(', ')})   |U × V| = ${num(v.value.area, 2)}`);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Which curves are drawn, and how they project" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A box with a round boss, its edges projected in an orthographic view that turns from isometric to front">
        <g :opacity="appear">
          <line v-for="(l, i) in lines" :key="'l' + i" v-bind="l" class="edge" :class="{ hot: s.step.value === 1, gone: l.endOn }" />
          <path v-for="(d, i) in rimPaths" :key="'r' + i" :d="d" class="rim" :class="{ hot: s.step.value === 2 || s.step.value === 4 }" />
          <line v-for="(l, i) in jointLines" :key="'j' + i" v-bind="l" class="joint" :opacity="jointOpacity" />
        </g>
        <line v-for="(l, i) in silLines" :key="'s' + i" v-bind="l" class="sil" />
        <circle v-for="(p, i) in corners" :key="'c' + i" :cx="p[0]" :cy="p[1]" r="3" class="corner" />
        <g v-if="tDot">
          <line :x1="tDot.c[0]" :y1="tDot.c[1]" :x2="tDot.u[0]" :y2="tDot.u[1]" class="vec" />
          <line :x1="tDot.c[0]" :y1="tDot.c[1]" :x2="tDot.w[0]" :y2="tDot.w[1]" class="vec" />
          <text :x="tDot.u[0] + 4" :y="tDot.u[1] + 10" class="tag">U</text>
          <text :x="tDot.w[0] + 4" :y="tDot.w[1] - 2" class="tag">V</text>
          <circle :cx="tDot.p[0]" :cy="tDot.p[1]" r="4" class="tdot" />
        </g>
        <g v-for="(p, i) in endOnDots" :key="'e' + i">
          <circle :cx="p[0]" :cy="p[1]" r="4" class="endon" />
        </g>
        <text v-if="s.step.value === 5" :x="FRONT.S([28, 15, 22])[0] + 6" :y="FRONT.S([28, 15, 16])[1]" class="tag">joint ~sil</text>
        <text v-if="s.step.value === 5" :x="FRONT.S([40, 0, 0])[0] + 8" :y="FRONT.S([40, 0, 0])[1] + 4" class="tag">end-on: left out</text>
        <text x="14" y="242" class="readout">{{ readout }}</text>
      </svg>
      <template #note>All curves are drawn alike here; which pieces are visible is the next step. The joints' positions
        (x = 12 and 28 at y = 15) and the numbers in step 3 are the kernel's, read from the built package; the figure's
        rims are whole circles where the B-rep has two half circles each.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.edge { stroke: var(--vp-c-text-1); stroke-width: 1.4; transition: stroke .3s, opacity .3s; }
.edge.hot { stroke: var(--a); stroke-width: 2; }
.edge.gone { opacity: 0.25; }
.rim { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.rim.hot { stroke: var(--b); stroke-width: 2; }
.joint { stroke: var(--hot); stroke-width: 1.6; stroke-dasharray: 4 3; }
.sil { stroke: var(--keep); stroke-width: 2.2; }
.corner { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.vec { stroke: var(--b); stroke-width: 1.4; marker-end: none; }
.tdot { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 1.5; }
.endon { fill: none; stroke: var(--hot); stroke-width: 1.6; }
.tag { font-size: 10px; fill: var(--vp-c-text-2); }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); font-family: var(--vp-font-family-mono); }
</style>
