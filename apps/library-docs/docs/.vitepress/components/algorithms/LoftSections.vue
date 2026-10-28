<script setup>
// The loft feature (packages/barocss-cad/src/features/loft.ts, legacyLoft and smoothLoft) on the kernel's own test case
// (packages/barocss-cad/test/part-model.test.mjs, 'smooth loft through three or more sections'): a circle r 8 at z 0, a
// square 10 × 10 at z 8, a circle r 4 at z 14. Pieces, the turn, the degree match and the C1 columns are computed here
// with the kernel's method; the built kernel's L.side0 net is equal to the one below in every coordinate and weight
// (checked with a script), and its sides 1–3 are side 0 turned by 90°. Kernel volumes: smooth 1490.4852 mm³, ruled
// 1480.4129 mm³ (massPropertiesOf, method 'quadrature').
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const W45 = Math.SQRT1_2, Z = [0, 8, 14], V = Z.map(z => z / 14), K = 2;
// Pieces as they come from the sketches: a circle from +X in quarters (arcs of at most 90°); the rectangle from its min corner.
const SQUARE0 = [[-5, -5], [5, -5], [5, 5], [-5, 5]];
const quarter = (r, i) => { const a0 = i * Math.PI / 2, am = a0 + Math.PI / 4, a1 = a0 + Math.PI / 2; return { p: [[r * Math.cos(a0), r * Math.sin(a0)], [r / W45 * Math.cos(am), r / W45 * Math.sin(am)], [r * Math.cos(a1), r * Math.sin(a1)]], w: [1, W45, 1] }; };
const sideOf = (c, i) => ({ p: [c[i], c[(i + 1) % 4]], w: [1, 1] });
const starts = sec => sec.map(b => b.p[0]);
// The kernel's turn: starts about their centroid over their rms radius; the cyclic shift with the least squared
// distance to the previous section's (a tie keeps the first, the test being c < cost − 10⁻¹²).
const shape = pts => { const c = pts.reduce((m, q) => [m[0] + q[0] / pts.length, m[1] + q[1] / pts.length], [0, 0]); const rms = Math.sqrt(pts.reduce((m, q) => m + (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2, 0) / pts.length) || 1; return pts.map(q => [(q[0] - c[0]) / rms, (q[1] - c[1]) / rms]); };
const costs = (prev, next) => { const a = shape(starts(prev)), b = shape(starts(next)); return a.map((_, sh) => a.reduce((m, q, i) => m + (q[0] - b[(i + sh) % 4][0]) ** 2 + (q[1] - b[(i + sh) % 4][1]) ** 2, 0)); };
const bestOf = cs => { let best = 0, cost = Infinity; cs.forEach((c, sh) => { if (c < cost - 1e-12) { cost = c; best = sh; } }); return best; };
const raw = [[0, 1, 2, 3].map(i => quarter(8, i)), [0, 1, 2, 3].map(i => sideOf(SQUARE0, i)), [0, 1, 2, 3].map(i => quarter(4, i))];
const SECTIONS = [raw[0]], SHIFTS = [0], COSTS = [null];
for (let k = 1; k <= K; k++) { const cs = costs(SECTIONS[k - 1], raw[k]), sh = bestOf(cs); COSTS.push(cs); SHIFTS.push(sh); SECTIONS.push([...raw[k].slice(sh), ...raw[k].slice(0, sh)]); }
/** A line opposite an arc, written as a quadratic: the middle point at its midpoint, with the given middle weight. */
const quad = (b, w) => (b.p.length === 3 ? b : { p: [b.p[0], [(b.p[0][0] + b.p[1][0]) / 2, (b.p[0][1] + b.p[1][1]) / 2], b.p[1]], w: [1, w, 1] });

// Smooth (smoothLoft): per side, each control point's homogeneous column through the sections, joined by C1 cubics with
// non-uniform Catmull–Rom tangents, as Bézier spans (triple interior knots at the sections' v).
function smoothNet(i) {
  const pcs = SECTIONS.map(sec => quad(sec[i], 1));
  return [0, 1, 2].map(j => {
    const H = pcs.map((b, k) => [b.p[j][0] * b.w[j], b.p[j][1] * b.w[j], Z[k] * b.w[j], b.w[j]]);
    const T = H.map((_, k) => { const a = Math.max(0, k - 1), c = Math.min(K, k + 1); return H[c].map((x, q) => (x - H[a][q]) / (V[c] - V[a])); });
    const out = [H[0]];
    for (let k = 0; k < K; k++) { const d = (V[k + 1] - V[k]) / 3; out.push(H[k].map((x, q) => x + T[k][q] * d), H[k + 1].map((x, q) => x - T[k + 1][q] * d), H[k + 1]); }
    return out;
  });
}
// Ruled (legacyLoft): per span, the two rows; a line opposite an arc takes the arc's middle weight, so both rows share weights.
function ruledRows(i) {
  return SECTIONS.map((sec, k) => { const own = sec[i], other = SECTIONS[k === 0 ? 1 : k - 1][i]; return quad(own, (own.p.length === 3 ? own : other).w[1]); });
}
const SMOOTH = [0, 1, 2, 3].map(smoothNet), RULED = [0, 1, 2, 3].map(ruledRows);
const bern3 = t => [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3], bern2 = t => [(1 - t) ** 2, 2 * t * (1 - t), t * t];
const spanOf = v => { const k = v < V[1] ? 0 : 1; return { k, t: Math.min(1, Math.max(0, (v - V[k]) / (V[k + 1] - V[k]))) }; };
/** A column of the smooth net at v: homogeneous cubic, then divided. */
function columnAt(H, v) { const { k, t } = spanOf(v), B = bern3(t), h = [0, 0, 0, 0]; for (let m = 0; m < 4; m++) for (let q = 0; q < 4; q++) h[q] += B[m] * H[3 * k + m][q]; return h; }
function smoothPoint(i, u, v) { const Bu = bern2(u), h = [0, 0, 0, 0]; SMOOTH[i].forEach((H, j) => { const c = columnAt(H, v); for (let q = 0; q < 4; q++) h[q] += Bu[j] * c[q]; }); return [h[0] / h[3], h[1] / h[3], h[2] / h[3]]; }
function ruledPoint(i, u, v) {
  const { k, t } = spanOf(v), lo = RULED[i][k], hi = RULED[i][k + 1], Bu = bern2(u); let W = 0; const P = [0, 0, 0];
  for (let j = 0; j < 3; j++) for (const [b, f, z] of [[lo, 1 - t, Z[k]], [hi, t, Z[k + 1]]]) { const c = Bu[j] * f * b.w[j]; W += c; P[0] += c * b.p[j][0]; P[1] += c * b.p[j][1]; P[2] += c * z; }
  return P.map(x => x / W);
}

// The view: turned 30° about z, tilted 22°.
const yaw = 30 * Math.PI / 180, pitch = 22 * Math.PI / 180, S = 10, CX = 128, CY = 204;
const view = p => { const x1 = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), y1 = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [CX + S * x1, CY - S * (y1 * Math.sin(pitch) + p[2] * Math.cos(pitch))]; };
const poly = ps => ps.map(view).map(q => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');
const ratQuad = (b, s) => { const B = b.p.length === 3 ? bern2(s) : [1 - s, s]; let W = 0, x = 0, y = 0; B.forEach((c, j) => { const f = c * b.w[j]; W += f; x += f * b.p[j][0]; y += f * b.p[j][1]; }); return [x / W, y / W]; };
const outline = (sec, z) => sec.flatMap(b => Array.from({ length: 12 }, (_, m) => [...ratQuad(b, m / 12), z])).concat([[...sec[0].p[0], z]]);
const OUTLINES = SECTIONS.map((sec, k) => outline(sec, Z[k]));
const UU = Array.from({ length: 13 }, (_, m) => m / 12);

const steps = [
  { label: 'Sections at heights', text: 'A loft joins closed profiles at increasing heights: here a circle of radius 8 at z = 0, a square 10 × 10 at z = 8 and a circle of radius 4 at z = 14. Each section must lie above the one before.', formula: 'z<sub>0</sub> &lt; z<sub>1</sub> &lt; z<sub>2</sub>' },
  { label: 'Pieces of at most 90°', text: 'Each section is cut into pieces: its lines, and its arcs in spans of at most 90°. The circle gives four quarter arcs, the square four sides. Where a section has fewer pieces, its longest piece is halved until the counts agree; here they agree already (4, 4, 4).', formula: 'n = max<sub>k</sub> (pieces of section k); &nbsp; shorter sections: halve the longest piece' },
  { label: 'Turn the starts to line up', text: `Piece i of one section is joined to piece i of the next. So each section is turned to start nearest the previous section's start: the starts are taken about their centroid over their rms radius, and the cyclic shift with the least squared distance wins. For the square the costs are ${COSTS[1].map(c => num(c, 2)).join(', ')}: shifts 1 and 2 tie, the first is kept, and the square starts at (5, −5).`, formula: 'shift = argmin<sub>sh</sub> Σ<sub>i</sub> ‖â<sub>i</sub> − b̂<sub>i+sh</sub>‖², &nbsp; â = (a − ā) / rms' },
  { label: 'One degree for each pair', text: 'A side is a degree-1 piece, a quarter arc a rational quadratic. The side is written as a quadratic too: its middle control point at its midpoint, so it stays straight. In a ruled loft it takes the arc\'s middle weight, cos 45°: both rows then have the same weights, and every section in between is (1 − λ) C<sub>0</sub> + λ C<sub>1</sub>. The smooth loft gives it weight 1.', formula: 'line (a, b) → (a, (a + b)/2, b), &nbsp; w = (1, w<sub>arc</sub>, 1) ruled · (1, 1, 1) smooth' },
  { label: 'Columns through the sections', text: 'Each control point of a side, with its weight as a fourth coordinate, is followed through the sections. Smooth: the homogeneous points are joined by a cubic in v with Catmull–Rom tangents, as Bézier spans that meet at each section, so the side passes through every section and is C1 there. Ruled: straight from one section to the next. Drawn: the sides\' edges (green, the columns of their end points) and side 0\'s control points (brown).', formula: 'T<sub>k</sub> = (H<sub>k+1</sub> − H<sub>k−1</sub>) / (v<sub>k+1</sub> − v<sub>k−1</sub>), &nbsp; inner points H<sub>k</sub> ± T<sub>k</sub> (v<sub>k+1</sub> − v<sub>k</sub>) / 3, &nbsp; v<sub>k</sub> = (z<sub>k</sub> − z<sub>0</sub>) / (z<sub>K</sub> − z<sub>0</sub>)' },
  { label: 'The side in between', text: 'Each side is one patch: degree 2 across, degree 3 up (smooth) or 1 per span (ruled). The moving curve is the section S(·, v) of all four sides. Switch between smooth and ruled: the ruled loft has a crease at the square; the smooth one passes through it with one slope.', formula: 'S(u, v) = Σ<sub>j</sub> B<sub>j</sub>(u) H<sub>j</sub>(v) → (X, Y, Z) / W' },
];
const s = useSteps(steps.length, [2600, 3000, 3800, 3400, 4200, 5200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
const mode = ref('smooth');

const drawn = computed(() => {
  const n = OUTLINES[0].length - 1, m = step.value === 0 ? Math.max(1, Math.round(k.value * n)) : n;
  return OUTLINES.map(o => poly(o.slice(0, m + 1)));
});
const vertices = computed(() => (step.value >= 1 ? SECTIONS.flatMap((sec, kk) => sec.map((b, i) => ({ q: view([...b.p[0], Z[kk]]), start: i === 0, key: `${kk}_${i}`, show: step.value > 1 || i < Math.ceil(k.value * 4 + 0.01) }))) : []));
// The square's start marker goes from its sketch start (−5, −5) to (5, −5); the links i ↔ i appear.
const squareStart = computed(() => { const f = step.value === 2 ? k.value : step.value > 2 ? 1 : 0, a = SQUARE0[0], b = SECTIONS[1][0].p[0]; return view([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Z[1]]); });
const links = computed(() => (step.value === 2 || step.value === 3 ? [0, 1].flatMap(kk => [0, 1, 2, 3].map(i => ({ a: view([...SECTIONS[kk][i].p[0], Z[kk]]), b: view([...SECTIONS[kk + 1][i].p[0], Z[kk + 1]]), key: `${kk}_${i}` }))) : []));
const linkOpacity = computed(() => (step.value === 2 ? k.value : 1));
// Step 4: the control polygons, the square's new middle points and their weights.
const polygons = computed(() => (step.value === 3 ? SECTIONS.map((sec, kk) => sec.map(b => ({ line: poly(quad(b, 1).p.map(p => [...p, Z[kk]])), mids: [{ q: view([...quad(b, 1).p[1], Z[kk]]), arc: b.p.length === 3 }] }))).flat() : []));
const midWeight = computed(() => (mode.value === 'smooth' ? '1' : num(W45, 4)));
// Step 5: the columns of every side (smooth cubics or ruled lines) and side 0's control points.
/** Control column j of side i at v: the smooth cubic (homogeneous, divided), or straight from row to row (ruled). */
function columnPoint(i, j, v) {
  if (mode.value === 'smooth') { const h = columnAt(SMOOTH[i][j], v); return [h[0] / h[3], h[1] / h[3], h[2] / h[3]]; }
  const { k: kk, t } = spanOf(v), a = RULED[i][kk].p[j], b = RULED[i][kk + 1].p[j];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Z[kk] + (Z[kk + 1] - Z[kk]) * t];
}
const colCurve = (i, j, upTo) => Array.from({ length: 49 }, (_, m) => m / 48).filter(v => v <= upTo + 1e-9).map(v => columnPoint(i, j, v));
const columns = computed(() => {
  if (step.value < 4) return null;
  const upTo = step.value === 4 ? k.value : 1;
  // The sides' edges (column 0 of each side, which is column 2 of the side before) lie on the body; side 0's control points do not.
  const curves = [0, 1, 2, 3].map(i => poly(colCurve(i, 0, upTo)));
  const ctrl = mode.value === 'smooth' ? SMOOTH[0].map(H => H.map(h => [h[0] / h[3], h[1] / h[3], h[2] / h[3]])) : RULED[0][0].p.map((_, j) => RULED[0].map((b, kk) => [...b.p[j], Z[kk]]));
  return { curves, ctrl: ctrl.map(c => ({ line: poly(c), dots: c.map(view) })) };
});
const vNow = computed(() => (step.value === 5 ? k.value : 0));
const pointAt = (i, u, v) => (mode.value === 'smooth' ? smoothPoint(i, u, v) : ruledPoint(i, u, v));
const section = computed(() => (step.value === 5 ? [0, 1, 2, 3].map(i => poly(UU.map(u => pointAt(i, u, vNow.value)))) : []));
const trail = computed(() => (step.value === 5 ? Array.from({ length: 13 }, (_, m) => m / 12).filter(v => v < vNow.value).flatMap(v => [0, 1, 2, 3].map(i => poly(UU.map(u => pointAt(i, u, v))))) : []));
const zNow = computed(() => pointAt(0, 0, vNow.value)[2]);
const labels = [0, 1, 2].map(kk => ({ q: view([kk === 1 ? 5 : kk === 0 ? 8 : 4, kk === 1 ? 5 : 0, Z[kk]]), text: `z = ${Z[kk]}` }));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Loft: sections made alike, then joined" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A circle, a square and a smaller circle at three heights, cut into matching pieces and joined by smooth or ruled sides">
        <polyline v-for="(t, i) in trail" :key="'tr' + i" :points="t" class="trail" />
        <g v-if="columns">
          <polyline v-for="(c, i) in columns.curves" :key="'cc' + i" :points="c" class="column" />
          <g v-for="(c, i) in columns.ctrl" :key="'ct' + i">
            <polyline :points="c.line" class="ctrl" />
            <circle v-for="(d, m) in c.dots" :key="'cd' + m" :cx="d[0]" :cy="d[1]" r="2" class="ctrl-dot" />
          </g>
        </g>
        <polyline v-for="(d, i) in drawn" :key="'o' + i" :points="d" class="section" />
        <g v-for="l in links" :key="'l' + l.key" :style="{ opacity: linkOpacity }">
          <line :x1="l.a[0]" :y1="l.a[1]" :x2="l.b[0]" :y2="l.b[1]" class="link" />
        </g>
        <g v-for="(p, i) in polygons" :key="'pg' + i">
          <polyline :points="p.line" class="cpoly" />
          <circle v-for="(m, j) in p.mids" :key="'m' + j" :cx="m.q[0]" :cy="m.q[1]" :r="m.arc ? 2.6 : 3.2" :class="m.arc ? 'arcmid' : 'linemid'" />
        </g>
        <polyline v-for="(c, i) in section" :key="'sc' + i" :points="c" class="moving" />
        <template v-for="v in vertices" :key="'v' + v.key">
          <circle v-if="v.show" :cx="v.q[0]" :cy="v.q[1]" r="2.6" class="vertex" />
        </template>
        <g v-if="step >= 2">
          <circle :cx="view([8, 0, 0])[0]" :cy="view([8, 0, 0])[1]" r="5" class="start" />
          <circle :cx="squareStart[0]" :cy="squareStart[1]" r="5" class="start" />
          <circle :cx="view([4, 0, 14])[0]" :cy="view([4, 0, 14])[1]" r="5" class="start" />
        </g>
        <text v-for="(l, i) in labels" :key="'lb' + i" :x="l.q[0] + 8" :y="l.q[1] + 4" class="small">{{ l.text }}</text>
        <g class="readout">
          <template v-if="step === 2">
            <text x="262" y="22">square, by shift:</text>
            <text v-for="(c, sh) in COSTS[1]" :key="'c' + sh" x="262" :y="40 + 15 * sh" :class="{ keep: sh === SHIFTS[1] }">{{ sh }}: {{ num(c, 3) }}{{ sh === SHIFTS[1] ? ' kept' : '' }}</text>
            <text x="262" y="110">top circle: {{ SHIFTS[2] }}</text>
          </template>
          <template v-else-if="step === 3">
            <text x="262" y="22">middle weights</text>
            <text x="262" y="40" class="a">arc: {{ num(W45, 4) }}</text>
            <text x="262" y="56" class="hot">line, {{ mode }}: {{ midWeight }}</text>
          </template>
          <template v-else-if="step >= 4">
            <text x="262" y="22">{{ mode }}: degree</text>
            <text x="262" y="38">2 × {{ mode === 'smooth' ? 3 : 1 }}{{ mode === 'smooth' ? ', knots v' : ' a span' }}</text>
            <text v-if="mode === 'smooth'" x="262" y="54">0⁴ {{ num(V[1], 4) }}³ 1⁴</text>
            <text v-if="step === 5" x="262" y="76">v = {{ num(vNow, 2) }}, z = {{ num(zNow, 2) }}</text>
            <text x="262" y="98">kernel volume:</text>
            <text x="262" y="114" :class="{ keep: mode === 'smooth' }">smooth 1490.49</text>
            <text x="262" y="130" :class="{ keep: mode === 'ruled' }">ruled 1480.41 mm³</text>
          </template>
        </g>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Kind of side">
          <button type="button" :aria-pressed="mode === 'smooth'" @click="mode = 'smooth'">smooth (C1)</button>
          <button type="button" :aria-pressed="mode === 'ruled'" @click="mode = 'ruled'">ruled</button>
        </div>
      </div>
      <template #note>Computed in the page with the kernel's piece split, turn, degree match and column spline, on its
        test sections. The built kernel's side patches are the same to the last digit; the volumes are the kernel's. The
        caps (flat faces at z = 0 and 14) are not drawn.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10px; fill: var(--vp-c-text-1); }
.readout .keep { fill: var(--keep); font-weight: 700; } .readout .a { fill: var(--a); } .readout .hot { fill: var(--hot); }
.section { fill: none; stroke: var(--a); stroke-width: 2; stroke-linejoin: round; }
.vertex { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.start { fill: none; stroke: var(--hot); stroke-width: 1.6; }
.link { stroke: var(--hot); stroke-width: 1.1; stroke-dasharray: 3 2; }
.cpoly { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.9; stroke-dasharray: 2 2; }
.arcmid { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.linemid { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.column { fill: none; stroke: var(--keep); stroke-width: 1.2; opacity: 0.9; }
.ctrl { fill: none; stroke: var(--b); stroke-width: 1; stroke-dasharray: 3 2; }
.ctrl-dot { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.moving { fill: none; stroke: var(--hot); stroke-width: 2.4; stroke-linejoin: round; }
.trail { fill: none; stroke: var(--keep); stroke-width: 0.8; opacity: 0.55; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
