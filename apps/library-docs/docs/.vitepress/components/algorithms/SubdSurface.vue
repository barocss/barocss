<script setup>
// Catmull–Clark on a regular open cage (the rules of packages/barocss-cad/src/features/subd-sd2.ts, `refine` and
// `limitPosition`, with sharp boundary edges), against the uniform bicubic B-spline of the cage with mirrored phantoms
// beyond its boundary (subd.ts, `netOf`). Both are computed here, in the page, on a 6 × 5-vertex sheet (10 mm spacing).
// Checked against the kernel: subdBrep of this cage gives one face (`fig.patch0`, knots 0 0 0 0 1 2 3 4 5 5 5 5 by
// 0 0 0 0 1 2 3 4 4 4 4, 8 × 7 poles) that agrees with the page's B-spline to 2.9e-14 mm on a 1/8 grid, and with the
// limit positions after 1–4 steps to 2.2e-14 mm (a node script on packages/barocss-cad/dist, 2026-10-28).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const H = [
  [0, 1.2, 2, 1.2, 0], [0.8, 4.4, 6.8, 4.8, 1.2], [1.6, 7.2, 12, 7.6, 2],
  [1.2, 6, 9.2, 6.4, 1.6], [0.4, 2.8, 4.8, 3.6, 0.8], [0, 0.8, 1.6, 1.2, 0.4],
];
const NI = H.length, NJ = H[0].length;
const G = H.map((row, i) => row.map((z, j) => [10 * i, 10 * j, z]));
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a, b, u) => add(a, add(b, a, -1), u);
const mirror = (edge, inside) => add(sc(edge, 2), inside, -1);
/** One Catmull–Clark step of a grid cage whose border is a boundary (sharp): N[2i][2j] vertex, odd indices edge and face points. */
function cc(Q) {
  const ni = Q.length, nj = Q[0].length, N = Array.from({ length: 2 * ni - 1 }, () => new Array(2 * nj - 1));
  const fp = (i, j) => sc(add(add(Q[i][j], Q[i + 1][j]), add(Q[i][j + 1], Q[i + 1][j + 1])), 0.25);
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) N[2 * i + 1][2 * j + 1] = fp(i, j);
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj; j++)
    N[2 * i + 1][2 * j] = j === 0 || j === nj - 1 ? sc(add(Q[i][j], Q[i + 1][j]), 0.5) : sc(add(add(Q[i][j], Q[i + 1][j]), add(fp(i, j - 1), fp(i, j))), 0.25);
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj - 1; j++)
    N[2 * i][2 * j + 1] = i === 0 || i === ni - 1 ? sc(add(Q[i][j], Q[i][j + 1]), 0.5) : sc(add(add(Q[i][j], Q[i][j + 1]), add(fp(i - 1, j), fp(i, j))), 0.25);
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const bi = i === 0 || i === ni - 1, bj = j === 0 || j === nj - 1, v = Q[i][j];
    if (bi && bj) N[2 * i][2 * j] = v;
    else if (bi) N[2 * i][2 * j] = sc(add(add(Q[i][j - 1], Q[i][j + 1]), v, 6), 1 / 8);
    else if (bj) N[2 * i][2 * j] = sc(add(add(Q[i - 1][j], Q[i + 1][j]), v, 6), 1 / 8);
    else {
      const F = sc(add(add(fp(i - 1, j - 1), fp(i, j - 1)), add(fp(i - 1, j), fp(i, j))), 0.25);
      const R = sc([Q[i - 1][j], Q[i + 1][j], Q[i][j - 1], Q[i][j + 1]].reduce((s, e) => add(s, sc(add(v, e), 0.5)), [0, 0, 0]), 0.25);
      N[2 * i][2 * j] = sc(add(add(F, R, 2), v), 0.25); // (Q + 2R + (n − 3) v) / n with n = 4
    }
  }
  return N;
}
/** A vertex's limit position: inside (16v + 4 Σ edge ends + Σ diagonals)/36, boundary (a + 4v + b)/6, corner v. */
function limit(Q, i, j) {
  const ni = Q.length, nj = Q[0].length, bi = i === 0 || i === ni - 1, bj = j === 0 || j === nj - 1, v = Q[i][j];
  if (bi && bj) return v;
  if (bi) return sc(add(add(Q[i][j - 1], Q[i][j + 1]), v, 4), 1 / 6);
  if (bj) return sc(add(add(Q[i - 1][j], Q[i + 1][j]), v, 4), 1 / 6);
  let s = sc(v, 16);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) s = add(s, Q[i + a][j + b], 4);
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) s = add(s, Q[i + a][j + b]);
  return sc(s, 1 / 36);
}
/** The grid with its new points at their places on the old cage (vertices, edge midpoints, face centres): where a step starts. */
function spread(Q) {
  const ni = Q.length, nj = Q[0].length, N = Array.from({ length: 2 * ni - 1 }, () => new Array(2 * nj - 1));
  for (let i = 0; i < 2 * ni - 1; i++) for (let j = 0; j < 2 * nj - 1; j++) {
    const a = Math.floor(i / 2), b = Math.floor(j / 2), c = Math.ceil(i / 2), d = Math.ceil(j / 2);
    N[i][j] = sc(add(add(Q[a][b], Q[c][b]), add(Q[a][d], Q[c][d])), 0.25);
  }
  return N;
}
const L = [G]; for (let l = 1; l <= 3; l++) L.push(cc(L[l - 1]));
const S = L.slice(0, 3).map(spread);
// The cage extended by one ring of phantoms: E[i + 1][j + 1] = G[i][j]; beyond a side 2·P(edge) − P(inside), and at a
// corner the same again across the other side (the corner rule).
const E = Array.from({ length: NI + 2 }, () => new Array(NJ + 2));
for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) E[i + 1][j + 1] = G[i][j];
for (let i = 0; i < NI; i++) { E[i + 1][0] = mirror(G[i][0], G[i][1]); E[i + 1][NJ + 1] = mirror(G[i][NJ - 1], G[i][NJ - 2]); }
for (let j = 0; j < NJ + 2; j++) { E[0][j] = mirror(E[1][j], E[2][j]); E[NI + 1][j] = mirror(E[NI][j], E[NI - 1][j]); }
const basis = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
/** The bicubic B-spline at (u, v), u in [0, 5], v in [0, 4]: quad (i, j)'s 4 × 4 net is E[i..i+3][j..j+3]. */
function surf(u, v) {
  const i = Math.min(NI - 2, Math.floor(u)), j = Math.min(NJ - 2, Math.floor(v)), bu = basis(u - i), bv = basis(v - j);
  let p = [0, 0, 0];
  for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) p = add(p, E[i + a][j + c], bu[a] * bv[c]);
  return p;
}
const far = L.map((Q, l) => Math.max(...Q.flatMap((row, i) => row.map((q, j) => { const p = surf(i / 2 ** l, j / 2 ** l); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); }))));
const limitMiss = Math.max(...L.slice(1).flatMap((Q, l) => Q.flatMap((row, i) => row.map((_, j) => { const p = surf(i / 2 ** (l + 1), j / 2 ** (l + 1)), q = limit(Q, i, j); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); }))));

// The view: isometric, the corner (0, 0) nearest, fitted to the cage and the corner quad's phantoms.
const raw = p => [0.866 * (p[0] - p[1]), -0.5 * (p[0] + p[1]) - p[2]];
const all = [...G.flat(), ...[0, 1, 2, 3].flatMap(a => [0, 1, 2, 3].map(c => E[a][c]))].map(raw);
const lo = [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1]))], hi = [Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))];
const scale = Math.min(352 / (hi[0] - lo[0]), 200 / (hi[1] - lo[1]));
const X = p => 190 + scale * (raw(p)[0] - (lo[0] + hi[0]) / 2), Y = p => 32 + scale * (raw(p)[1] - lo[1]);
const pt = p => `${X(p)},${Y(p)}`;
const lines = Q => [...Q.map(row => row.map(pt).join(' ')), ...Q[0].map((_, j) => Q.map(row => pt(row[j])).join(' '))];
const lerpGrid = (A, B, u) => A.map((row, i) => row.map((p, j) => lerp(p, B[i][j], u)));
const ISO = [];
for (let u = 0; u <= 5; u += 0.5) ISO.push(Array.from({ length: 65 }, (_, k) => surf(u, 4 * k / 64)));
for (let v = 0; v <= 4; v += 0.5) ISO.push(Array.from({ length: 81 }, (_, k) => surf(5 * k / 80, v)));
const ISO_LINES = ISO.map(c => ({ points: c.map(pt).join(' '), length: c.slice(1).reduce((s, p, k) => s + Math.hypot(X(p) - X(c[k]), Y(p) - Y(c[k])), 0) }));
const patch = (qi, qj) => {
  const ring = [];
  for (let k = 0; k <= 8; k++) ring.push(surf(qi + k / 8, qj));
  for (let k = 0; k <= 8; k++) ring.push(surf(qi + 1, qj + k / 8));
  for (let k = 8; k >= 0; k--) ring.push(surf(qi + k / 8, qj + 1));
  for (let k = 8; k >= 0; k--) ring.push(surf(qi, qj + k / 8));
  return ring.map(pt).join(' ');
};
const netOf = (qi, qj) => [0, 1, 2, 3].map(a => [0, 1, 2, 3].map(c => E[qi + a][qj + c]));
const INNER = { q: [2, 1], net: netOf(2, 1), patch: patch(2, 1) }, CORNER = { q: [0, 0], net: netOf(0, 0), patch: patch(0, 0) };
// The phantoms of the corner quad's net and where each is mirrored from (along u where a is 0, else along v).
const PHANTOMS = [];
for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) if (a === 0 || c === 0) PHANTOMS.push({ p: E[a][c], edge: a === 0 ? E[1][c] : E[a][1], inside: a === 0 ? E[2][c] : E[a][2] });
const FACE_PTS = L[1].flatMap((row, i) => row.filter((_, j) => i % 2 && j % 2));
const EDGE_PTS = L[1].flatMap((row, i) => row.filter((_, j) => (i + j) % 2));
// The rules, one example each: the face point of quad (2, 1), the edge point between G[2][2] and G[3][2], the vertex G[2][2].
const fpEx = L[1][5][3], fpCorners = [G[2][1], G[3][1], G[3][2], G[2][2]];
const epEx = L[1][5][4], epFrom = [G[2][2], G[3][2], L[1][5][3], L[1][5][5]];
const vpFrom = G[2][2], vpTo = L[1][4][4], vpNear = [G[1][2], G[3][2], G[2][1], G[2][3], G[1][1], G[3][1], G[1][3], G[3][3]];

const steps = [
  { label: 'A regular cage', text: 'A sheet of 5 × 4 quads. Every inside vertex has four edges, every boundary vertex three, every corner two: the cage is regular everywhere. Its border is a boundary, so its edges there are sharp.' },
  { label: 'Face points', text: 'Each quad gets a point at the mean of its four corners.', formula: 'f = ¼ (a + b + c + d)' },
  { label: 'Edge points', text: 'Each inside edge gets the mean of its two ends and the face points of its two quads. A boundary edge, being sharp, gets its midpoint.', formula: 'e = ¼ (a + b + f<sub>1</sub> + f<sub>2</sub>) &nbsp;·&nbsp; sharp: e = ½ (a + b)' },
  { label: 'Vertex points', text: 'Each old vertex moves. Inside, with n edges: Q the mean of its quads\' face points, R the mean of its edges\' midpoints. On the boundary the curve rule; a corner stays.', formula: 'v′ = (Q + 2R + (n − 3) v) / n &nbsp;(n = 4: 9/16 v, 3/32 per edge end, 1/64 per diagonal)<br>boundary: v′ = (a + 6v + b) / 8 &nbsp;·&nbsp; corner: v′ = v' },
  { label: 'Connect, then again', text: `Each quad becomes four, joining its face point, two edge points and a vertex point. The same rules again: 40 × 32 quads after three steps. The cage's largest distance from the limit falls by about four each time: ${far.map(d => num(d, 3)).join(' → ')} mm.` },
  { label: 'The B-spline, drawn from the cage', text: `The green net is the uniform bicubic B-spline whose control points are the first cage, evaluated from its formula. Every limit position of the refined cages lies on it, to ${limitMiss.toExponential(0)} mm (rounding). The kernel's face from this cage, subdBrep, matches it to 3 × 10⁻¹⁴ mm.`, formula: 'S(u, v) = Σ<sub>a,c=0..3</sub> b<sub>a</sub>(u − i) b<sub>c</sub>(v − j) P<sub>i−1+a, j−1+c</sub>' },
  { label: 'One quad: 4 × 4 points', text: 'The patch over one quad needs its four corners and the twelve around them: the quad\'s own ring of neighbours. Neighbouring patches share three of their four rows, so they join with matching position, slope and curvature (C2).' },
  { label: 'At the boundary: phantoms', text: 'A quad on the border is missing neighbours. The kernel mirrors them: across a side, 2·P(edge) − P(inside); at a corner, the same again across the other side. The patch then runs right to the boundary and through the cage\'s corner.', formula: 'phantom = 2 P<sub>edge</sub> − P<sub>inside</sub> &nbsp;·&nbsp; corner phantom = 4 P<sub>00</sub> − 2 P<sub>10</sub> − 2 P<sub>01</sub> + P<sub>11</sub>' },
];
const s = useSteps(steps.length, [2200, 2200, 2400, 3200, 5600, 3600, 3600, 4200], root);
const k = computed(() => ease(s.t.value));
const step = computed(() => s.step.value);
const cageLines = lines(G);
const r = computed(() => Math.max(0, 3 * k.value));
const vertsNow = computed(() => G.flatMap((row, i) => row.map((p, j) => (step.value === 3 ? lerp(p, L[1][2 * i][2 * j], k.value) : step.value > 3 ? L[1][2 * i][2 * j] : p))));
/** Step 5's grid: L1 appearing, then each step's morph. */
const refined = computed(() => {
  if (step.value !== 4) return lines(L[3]);
  const u = 3 * s.t.value;
  if (u < 1) return lines(L[1]);
  const l = Math.min(2, Math.floor(u)), f = ease(Math.min(1, u - l));
  return lines(lerpGrid(S[l], L[l + 1], f));
});
const refinedOpacity = computed(() => (step.value === 4 ? Math.min(1, 3 * s.t.value) : 0.3));
const isoOffset = computed(() => (step.value === 5 ? 1 - k.value : 0));
const netShown = computed(() => (step.value === 6 ? Math.max(1, Math.ceil(16 * k.value)) : 16));
const phantomAt = ph => (step.value === 7 ? lerp(ph.inside, ph.p, k.value) : ph.p);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Catmull–Clark on a regular cage: the limit is the cage's bicubic B-spline" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A quad cage refined by Catmull–Clark face, edge and vertex points, converging to the bicubic B-spline drawn from the cage">
        <polyline v-for="(l, i) in cageLines" :key="'c' + i" :points="l" class="cage" :class="{ faint: step >= 4 }" />
        <g v-if="step === 4 || step === 5">
          <polyline v-for="(l, i) in refined" :key="'r' + i" :points="l" class="refined" :style="{ opacity: refinedOpacity }" />
        </g>
        <g v-if="step >= 5">
          <polyline v-for="(l, i) in ISO_LINES" :key="'iso' + i" :points="l.points" class="iso" :class="{ faint: step >= 6 }" :stroke-dasharray="l.length" :stroke-dashoffset="l.length * isoOffset" />
        </g>
        <g v-if="step <= 3">
          <circle v-for="(p, i) in vertsNow" :key="'v' + i" :cx="X(p)" :cy="Y(p)" r="2.6" class="vert" />
        </g>
        <g v-if="step === 0">
          <circle :cx="X(G[2][2])" :cy="Y(G[2][2])" r="6" class="ring" /><text :x="X(G[2][2]) - 50" :y="Y(G[2][2]) - 6" class="tag">4 edges</text>
          <circle :cx="X(G[0][2])" :cy="Y(G[0][2])" r="6" class="ring" /><text :x="X(G[0][2]) - 48" :y="Y(G[0][2]) - 4" class="tag">3 edges</text>
          <circle :cx="X(G[5][0])" :cy="Y(G[5][0])" r="6" class="ring" /><text :x="X(G[5][0]) - 22" :y="Y(G[5][0]) + 20" class="tag">2 edges</text>
        </g>
        <g v-if="step >= 1 && step <= 3">
          <circle v-for="(p, i) in FACE_PTS" :key="'f' + i" :cx="X(p)" :cy="Y(p)" :r="step === 1 ? r : 2.6" class="face-pt" />
        </g>
        <g v-if="step === 1">
          <line v-for="(c, i) in fpCorners" :key="'fl' + i" :x1="X(c)" :y1="Y(c)" :x2="X(fpEx)" :y2="Y(fpEx)" class="pull b" />
        </g>
        <g v-if="step === 2 || step === 3">
          <circle v-for="(p, i) in EDGE_PTS" :key="'e' + i" :cx="X(p)" :cy="Y(p)" :r="step === 2 ? r : 2.6" class="edge-pt" />
        </g>
        <g v-if="step === 2">
          <line v-for="(c, i) in epFrom" :key="'el' + i" :x1="X(c)" :y1="Y(c)" :x2="X(epEx)" :y2="Y(epEx)" class="pull a" />
        </g>
        <g v-if="step === 3">
          <line v-for="(c, i) in vpNear" :key="'vl' + i" :x1="X(c)" :y1="Y(c)" :x2="X(lerp(vpFrom, vpTo, k))" :y2="Y(lerp(vpFrom, vpTo, k))" class="pull" />
          <circle :cx="X(vpFrom)" :cy="Y(vpFrom)" r="3" class="ghost" />
        </g>
        <g v-if="step === 6">
          <polygon :points="INNER.patch" class="patch" />
          <polyline v-for="a in 4" :key="'nu' + a" :points="INNER.net[a - 1].map(pt).join(' ')" class="net" />
          <polyline v-for="c in 4" :key="'nv' + c" :points="INNER.net.map(row => pt(row[c - 1])).join(' ')" class="net" />
          <template v-for="(row, a) in INNER.net" :key="'np' + a">
            <circle v-for="(p, c) in row" v-show="4 * a + c < netShown" :key="'n' + a + c" :cx="X(p)" :cy="Y(p)" r="3.2" class="net-pt" />
          </template>
        </g>
        <g v-if="step === 7">
          <polygon :points="CORNER.patch" class="patch" />
          <line v-for="(ph, i) in PHANTOMS" :key="'pl' + i" :x1="X(ph.inside)" :y1="Y(ph.inside)" :x2="X(phantomAt(ph))" :y2="Y(phantomAt(ph))" class="pull hot" />
          <template v-for="(row, a) in CORNER.net" :key="'cp' + a">
            <circle v-for="(p, c) in row" v-show="a > 0 && c > 0" :key="'c' + a + c" :cx="X(p)" :cy="Y(p)" r="3.2" class="net-pt" />
          </template>
          <circle v-for="(ph, i) in PHANTOMS" :key="'ph' + i" :cx="X(phantomAt(ph))" :cy="Y(phantomAt(ph))" r="3.4" class="phantom" />
          <circle :cx="X(G[0][0])" :cy="Y(G[0][0])" r="6.5" class="ring" />
          <line :x1="X(G[0][0]) + 5" :y1="Y(G[0][0]) + 5" :x2="X(G[0][0]) + 30" :y2="Y(G[0][0]) + 34" class="leader" />
          <text :x="X(G[0][0]) + 32" :y="Y(G[0][0]) + 44" class="tag">the corner itself</text>
        </g>
        <text x="12" y="18" class="name">{{ step <= 3 ? '5 × 4 quads' : step === 4 ? 'refined' : step === 6 ? '16 points, one patch' : step === 7 ? '7 phantoms, 9 cage points' : 'B-spline from the cage' }}</text>
      </svg>
      <template #note>Computed in the page on this cage, with the kernel's rules, and checked against the kernel's own face
        for it (see the source comment). Drawn in an isometric view; the heights are the cage's own, in mm.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.cage { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-linejoin: round; }
.cage.faint { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 3; }
.refined { fill: none; stroke: var(--a); stroke-width: 0.7; }
.iso { fill: none; stroke: var(--keep); stroke-width: 1.5; }
.iso.faint { opacity: 0.35; stroke-width: 1; }
.vert { fill: var(--vp-c-text-1); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.face-pt { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.edge-pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.ghost { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.ring { fill: none; stroke: var(--b); stroke-width: 1.5; }
.pull { stroke: var(--vp-c-text-2); stroke-width: 1; stroke-dasharray: 3 2; }
.pull.a { stroke: var(--a); } .pull.b { stroke: var(--b); } .pull.hot { stroke: var(--hot); }
.patch { fill: var(--b); fill-opacity: 0.22; stroke: var(--b); stroke-width: 1.6; }
.net { fill: none; stroke: var(--b); stroke-width: 1; }
.net-pt { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 1; }
.phantom { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.8; }
.tag { font-weight: 600; }
.leader { stroke: var(--vp-c-text-3); stroke-width: 1; }
.name { font-weight: 700; fill: var(--vp-c-text-1); }
</style>
