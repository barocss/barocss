<script setup>
// The rolling ball (packages/barocss-cad/src/blend/rolling-ball.ts: solveStation, sectionOf, ringFillet) run in the page
// on the pipe tee of conformance case r10/general-tee: a tube of radius 10 along x, a branch of radius 5 up z, their
// junction filleted r = 2. Stations by length along the junction; at each the kernel's damped Newton for the ball (finite
// differences, 4 × 4 solve), seeded by the station before; each section as sectionOf builds it. The tee is moved so the
// branch's axis is the z axis; the surfaces are written by angle and height (the kernel's are NURBS patches).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const RA = 10, RB = 5, R = 2, SIGMA = 1, SIZE = 60, G = R / 2, ZTOP = 14;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => sc(a, 1 / len(a)), norm = f => Math.hypot(...f);
// A: the tube, (θ, x). B: the branch, (φ, z). Outward normals.
const SA = (th, x) => [x, RA * Math.cos(th), RA * Math.sin(th)], nA = th => [0, Math.cos(th), Math.sin(th)];
const SB = (ph, z) => [RB * Math.cos(ph), RB * Math.sin(ph), z], nB = ph => [Math.cos(ph), Math.sin(ph), 0];
/** The junction (the edge chain) at angle ψ about the branch: its point and unit tangent. */
function edgeAt(ps) { const s = Math.sin(ps), c = Math.cos(ps), z = Math.sqrt(RA * RA - RB * RB * s * s); return { X: [RB * c, RB * s, z], t: unit([-RB * s, RB * c, -RB * RB * s * c / z]) }; }
// The kernel's station solve: F(q) = (c_A − c_B, (c_A − X)·t), c = S + σ r n; Jacobian by central differences of
// 10 × 10⁻⁶ of each parameter's range; the step halved until |F| falls; done at |F| ≤ 10⁻¹² × size.
const HS = [1e-5 * 2 * Math.PI, 1e-5 * 60, 1e-5 * 2 * Math.PI, 1e-5 * 25];
function residual(X, t, q) { const ca = add(SA(q[0], q[1]), sc(nA(q[0]), SIGMA * R)), cb = add(SB(q[2], q[3]), sc(nB(q[2]), SIGMA * R)); return [ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2], dot(sub(ca, X), t)]; }
function solve4(M, b) {
  const a = M.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < 4; k++) {
    let p = k; for (let i = k + 1; i < 4; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (!(Math.abs(a[p][k]) > 1e-300)) return null;
    [a[k], a[p]] = [a[p], a[k]];
    for (let i = k + 1; i < 4; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < 5; j++) a[i][j] -= f * a[k][j]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = a[i][4]; for (let j = i + 1; j < 4; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
  return x;
}
function newton(X, t, q0) {
  let q = q0.slice(), f = residual(X, t, q);
  for (let it = 0; it < 40 && norm(f) > 1e-12 * SIZE; it++) {
    const J = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (let k = 0; k < 4; k++) {
      const qp = q.slice(), qm = q.slice(); qp[k] += HS[k]; qm[k] -= HS[k];
      const fp = residual(X, t, qp), fm = residual(X, t, qm);
      for (let i = 0; i < 4; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
    }
    const step = solve4(J, f.map(x => -x)); if (!step) break;
    let lam = 1, next = q, fn = f;
    for (let k = 0; k < 20; k++) { next = q.map((x, i) => x + lam * step[i]); fn = residual(X, t, next); if (norm(fn) < norm(f)) break; lam /= 2; }
    if (!(norm(fn) < norm(f))) break;
    q = next; f = fn;
  }
  return q;
}
/** The first station's seeds: X + back·w on each face (back = r / tan(α/2), α the angle between the faces there). */
function firstSeed(X, t) {
  const th = Math.atan2(X[2], X[1]), ph = Math.atan2(X[1], X[0]);
  let wA = unit(cross(t, nA(th))); if (dot(wA, nB(ph)) < 0) wA = sc(wA, -1);
  let wB = unit(cross(t, nB(ph))); if (dot(wB, nA(th)) < 0) wB = sc(wB, -1);
  const back = R / Math.tan(Math.acos(dot(wA, wB)) / 2), gA = add(X, sc(wA, back)), gB = add(X, sc(wB, back));
  return [Math.atan2(gA[2], gA[1]), gA[0], Math.atan2(gB[1], gB[0]), gB[2]];
}
/** A station's section (sectionOf): T1, T1 grown, the grown corner, T2 grown, T2; the arc's middle pole and weight. */
function sectionOf(X, t, q) {
  const T1 = SA(q[0], q[1]), T2 = SB(q[2], q[3]), na = nA(q[0]), nb = nB(q[2]), c = add(T1, sc(na, SIGMA * R)), a = sub(T1, c), b = sub(T2, c), mz = unit(cross(a, b));
  const T1o = sub(T1, sc(na, SIGMA * G)), T2o = sub(T2, sc(nb, SIGMA * G));
  let d1 = unit(cross(mz, na)), d2 = unit(cross(mz, nb));
  if (dot(d1, sub(T2, T1)) < 0) d1 = sc(d1, -1);
  if (dot(d2, sub(T1, T2)) < 0) d2 = sc(d2, -1);
  const w0 = sub(T1o, T2o), A11 = dot(d1, d1), A12 = -dot(d1, d2), A22 = dot(d2, d2), b1 = -dot(d1, w0), b2 = dot(d2, w0), det = A11 * A22 - A12 * A12;
  const O = add(T1o, sc(d1, (b1 * A22 - A12 * b2) / det));
  const w = Math.cos(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / 2), mid = add(c, sc(unit(add(a, b)), R / w));
  return { X, t, c, T1, T2, nb, corners: [T1, T1o, O, T2o, T2], mid, w };
}
/** The arc as the kernel's rational quadratic: 0 at T2, 1 at T1, middle pole `mid` of weight w. */
function arcAt(s, u) { const P0 = s.T2, P2 = s.T1, b0 = (1 - u) ** 2, b1 = 2 * u * (1 - u) * s.w, b2 = u * u, d = b0 + b1 + b2; return [0, 1, 2].map(i => (b0 * P0[i] + b1 * s.mid[i] + b2 * P2[i]) / d); }

// Stations evenly by length: 96 solved (the drawn surface and the ball's path), every fourth of them shown (24).
const DENSE = 96, EVERY = 4;
const lengthTable = (() => { const M = 2048, cum = [0]; let prev = edgeAt(0).X; for (let i = 1; i <= M; i++) { const p = edgeAt(2 * Math.PI * i / M).X; cum.push(cum[i - 1] + len(sub(p, prev))); prev = p; } return { M, cum, L: cum[M] }; })();
function psiAtLength(s) { const { M, cum } = lengthTable; let i = 0; while (i < M - 1 && cum[i + 1] < s) i++; return 2 * Math.PI * (i + (s - cum[i]) / (cum[i + 1] - cum[i])) / M; }
const L = lengthTable.L;
const dense = [];
{
  let q = null;
  for (let j = 0; j < DENSE; j++) {
    const { X, t } = edgeAt(psiAtLength(L * j / DENSE));
    q = newton(X, t, q ?? firstSeed(X, t));
    dense.push(sectionOf(X, t, q));
  }
}
const shown = dense.filter((_, j) => j % EVERY === 0);

// The view: turned about z, tilted towards the viewer; fitted to the picture.
const YAW = -32 * Math.PI / 180, PITCH = 34 * Math.PI / 180;
const DVIEW = [Math.sin(YAW) * Math.cos(PITCH), Math.cos(YAW) * Math.cos(PITCH), -Math.sin(PITCH)];
const rot = p => { const x1 = p[0] * Math.cos(YAW) - p[1] * Math.sin(YAW), y1 = p[0] * Math.sin(YAW) + p[1] * Math.cos(YAW); return [x1, -(y1 * Math.sin(PITCH) + p[2] * Math.cos(PITCH))]; };
const front = n => dot(n, DVIEW) < 0;
// Wires: the tube's rulings (stopping at the branch) and two end arcs; the branch's lines and its top circle.
const tubeRuns = [], branchLines = [];
for (const deg of [30, 45, 60, 75, 90, 105, 120, 135, 150]) {
  const th = deg * Math.PI / 180, y = RA * Math.cos(th), runs = [[]];
  for (let i = 0; i <= 40; i++) { const x = -9.5 + 19 * i / 40; if (x * x + y * y < RB * RB) { if (runs.at(-1).length) runs.push([]); continue; } runs.at(-1).push(SA(th, x)); }
  for (const r of runs) if (r.length > 1) tubeRuns.push({ pts: r, front: front(nA(th)) });
}
for (const x of [-9.5, 9.5]) tubeRuns.push({ pts: Array.from({ length: 41 }, (_, i) => SA((25 + 130 * i / 40) * Math.PI / 180, x)), front: true });
for (let k = 0; k < 12; k++) { const ph = k * Math.PI / 6, z0 = edgeAt(ph).X[2]; branchLines.push({ pts: [SB(ph, z0), SB(ph, ZTOP)], front: front(nB(ph)) }); }
const branchTop = Array.from({ length: 73 }, (_, i) => SB(2 * Math.PI * i / 72, ZTOP));
const chainPts = Array.from({ length: 193 }, (_, i) => edgeAt(2 * Math.PI * i / 192).X);
const chainFront = Array.from({ length: 193 }, (_, i) => front(nB(2 * Math.PI * i / 192)));
// Fit every drawn point into the picture.
const allPts = [...tubeRuns.flatMap(r => r.pts), ...branchTop, ...dense.flatMap(s => [s.c, ...s.corners])].map(rot);
const bx = [Math.min(...allPts.map(p => p[0])), Math.max(...allPts.map(p => p[0]))], by = [Math.min(...allPts.map(p => p[1])), Math.max(...allPts.map(p => p[1]))];
const S = Math.min(356 / (bx[1] - bx[0]), 236 / (by[1] - by[0])), OX = 190 - S * (bx[0] + bx[1]) / 2, OY = 130 - S * (by[0] + by[1]) / 2;
const V = p => { const q = rot(p); return [OX + S * q[0], OY + S * q[1]]; };
const poly = ps => ps.map(V).map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
/** A closed or open row of points split into runs that face the viewer or not. */
function runsOf(ps, fr) {
  const out = []; let cur = null;
  ps.forEach((p, i) => { if (!cur || cur.front !== fr[i]) { if (cur) cur.pts.push(p); cur = { front: fr[i], pts: cur ? [ps[i - 1], p] : [p] }; out.push(cur); } else cur.pts.push(p); });
  return out.map(r => ({ front: r.front, d: poly(r.pts) }));
}
const tubeWires = tubeRuns.map(r => ({ front: r.front, d: poly(r.pts) }));
const branchWires = branchLines.map(r => ({ front: r.front, d: poly(r.pts) }));
const topWire = runsOf(branchTop, branchTop.map(p => front(unit([p[0], p[1], 0]))));
const chainRuns = runsOf(chainPts, chainFront);
const chainAt = n => poly(chainPts.slice(0, Math.max(2, n)));
// Each shown station: its square in the plane across the chain, its section's arc and tool outline.
const ARC = 12, HALF = 0.55;
const stations = shown.map((s, i) => {
  const e2 = unit(sub([0, 0, 1], sc(s.t, s.t[2]))), e1 = cross(e2, s.t);
  const sq = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => add(s.X, add(sc(e1, a * HALF), sc(e2, b * HALF))));
  const arc = Array.from({ length: ARC + 1 }, (_, k) => arcAt(s, k / ARC));
  return { i, lofted: i % 2 === 0, front: front(s.nb), square: poly(sq) + ' ' + poly([sq[0]]), X: V(s.X), T1: V(s.T1), T2: V(s.T2), c: V(s.c), arc: poly(arc), tool: poly([...s.corners, ...arc.slice(1)]) };
});
// The swept surface between neighbouring sections (every second dense one), far quads first, shaded by their normal.
const LIGHT = unit([-0.4, -0.6, 1]);
const quads = [];
{
  const ring = dense.filter((_, j) => j % 2 === 0), m = 6, rows = ring.map(s => Array.from({ length: m + 1 }, (_, k) => arcAt(s, k / m)));
  for (let j = 0; j < ring.length; j++) for (let k = 0; k < m; k++) {
    const a = rows[j][k], b = rows[j][k + 1], c = rows[(j + 1) % ring.length][k + 1], d = rows[(j + 1) % ring.length][k], mid = sc(add(add(a, b), add(c, d)), 0.25);
    const n = unit(sub(ring[j].c, mid)), shade = 0.3 + 0.7 * Math.max(0, dot(n, LIGHT));
    quads.push({ d: poly([a, b, c, d]), depth: dot(mid, DVIEW), front: front(n), shade });
  }
  quads.sort((p, q) => q.depth - p.depth);
}
const rail1 = runsOf([...dense.map(s => s.T1), dense[0].T1], [...dense.map(s => front(s.nb)), front(dense[0].nb)]);
const rail2 = runsOf([...dense.map(s => s.T2), dense[0].T2], [...dense.map(s => front(s.nb)), front(dense[0].nb)]);
const R_PX = R * S;

const steps = [
  { label: 'The edge chain', text: 'A tube and a branch meet in a closed loop. Neither closed form takes it: the edge is neither a line along both faces nor a circle about their common axis. The whole loop, from the one edge named, becomes one rolling-ball tool.', formula: 'X(ψ) = (5 cos ψ, 5 sin ψ, √(100 − 25 sin²ψ)) &nbsp;&nbsp; tube y² + z² = 100, branch x² + y² = 25' },
  { label: 'Stations along it', text: `Stations are spaced evenly by length along the chain, each with the plane through it square to the chain. The count starts at max(64, L / (r/4)), made even: here L = ${L.toFixed(2)} mm and r = 2, so 64. Every fourth of 96 is drawn.`, formula: 'station plane: (p − X) · t = 0 &nbsp;&nbsp; t: the chain\'s unit tangent at X' },
  { label: 'The ball at a station', text: 'At each station the ball of radius r touches both faces, its centre in the station\'s plane. Outside the material here (a concave edge, σ = +1): its centre lies 12 from the tube\'s axis and 7 from the branch\'s. Four equations in the contacts\' four surface parameters, solved by Newton from the station before (next figure).', formula: 'c = S<sub>A</sub>(u<sub>A</sub>, v<sub>A</sub>) + σ r n<sub>A</sub> = S<sub>B</sub>(u<sub>B</sub>, v<sub>B</sub>) + σ r n<sub>B</sub>, &nbsp; (c − X) · t = 0' },
  { label: 'Rolling: a section a station', text: 'Station by station the ball rolls round the loop. Each station leaves a section in the ball\'s plane through both contacts: the contacts T<sub>1</sub>, T<sub>2</sub> and the arc between them, a rational quadratic whose middle pole Q is where the faces\' tangent lines at the contacts meet.', formula: 'a = T<sub>1</sub> − c, b = T<sub>2</sub> − c, θ = ∠(a, b) &nbsp; w = cos(θ/2) &nbsp; Q = c + r/w · (a + b)/|a + b|' },
  { label: 'Loft every other section', text: 'Every other section is lofted through; the ones between measure the loft. Along the chain each corner row and the arc\'s middle row (in homogeneous coordinates) is a C² cubic B-spline through the lofted sections, its end tangents from five-point stencils, at most 13 spans a patch. The count grows as the h⁴ rate predicts until the contacts lie within 2.5 × 10⁻⁷ mm of their faces (a quarter of the Boolean\'s tolerance) and the sections within 10⁻⁶ mm of the true ones. On this tee: 64 stations leave them 9.5 × 10⁻⁴ mm off; 578 stations in 24 patches leave 1.4 × 10⁻⁷ and 2.2 × 10⁻⁷ mm.', formula: 'next N = 2 ⌈N · max(2, 1.15 · worst<sup>¼</sup>) / 2⌉ (1.25 in place of 2 after the first try) &nbsp;&nbsp; worst = max(contact / 2.5·10⁻⁷, section / 10⁻⁶) &nbsp;&nbsp; refused past 4096' },
  { label: 'The tool', text: 'Each section is closed into the tool\'s profile: from T<sub>1</sub>, grown g = r/2 outside the corner along each face\'s normal, their corner, back to T<sub>2</sub> and along the arc. A patch has five faces: the fillet, the two walls at the contacts, and two along the grown corner (inside the body here, as the edge is concave). Patches also break where a contact crosses from one face to the next.', formula: 'corners: T<sub>1</sub> → T<sub>1</sub> − σ g n<sub>A</sub> → corner → T<sub>2</sub> − σ g n<sub>B</sub> → T<sub>2</sub> → arc → T<sub>1</sub>' },
  { label: 'The Boolean trims it in', text: 'The tool is added to a concave edge (here) and removed from a convex one, in a Boolean of its own before any other tool. The Boolean is told the tool\'s contact faces (the fillet and the two walls): they meet the body only along their own edges on it, so those edges become the cuts and nothing is marched. The tee is left with the fillet between two contact curves. More bodies than before means the fillet ran off its faces: refused.', formula: 'concave: body ∪ tool &nbsp; convex: body − tool &nbsp;&nbsp; extra body → [CONTACT_LEAVES_FACE]' },
];
const s = useSteps(steps.length, [2400, 2800, 2600, 6400, 3400, 3000, 2800], root);
const k = computed(() => ease(s.t.value));
const lin = computed(() => s.t.value);
const fade = i => (s.step.value > i ? 1 : s.step.value === i ? k.value : 0);
// The ball's place: at the first station, rolling (in step 4) by length, then back at the first.
const rollAt = computed(() => (s.step.value === 3 ? lin.value * DENSE : 0));
const ball = computed(() => {
  const u = rollAt.value, i = Math.floor(u) % DENSE, f = u - Math.floor(u), a = dense[i], b = dense[(i + 1) % DENSE], c = [0, 1, 2].map(j => a.c[j] + (b.c[j] - a.c[j]) * f);
  return { c: V(c), T1: V(f < 0.5 ? a.T1 : b.T1), T2: V(f < 0.5 ? a.T2 : b.T2), front: front(f < 0.5 ? a.nb : b.nb) };
});
const stationsShown = computed(() => (s.step.value === 1 ? Math.round(k.value * stations.length) : s.step.value > 1 ? stations.length : 0));
const sectionsShown = computed(() => (s.step.value === 3 ? Math.floor(rollAt.value / EVERY) + 1 : s.step.value > 3 ? stations.length : s.step.value === 2 ? 1 : 0));
const chainDrawn = computed(() => (s.step.value === 0 ? Math.round(k.value * 192) : 193));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="The rolling ball round a pipe tee's junction" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="A tube and a branch, the ball rolling along their junction, the sections it leaves and the tool lofted through them">
        <polyline v-for="(w, i) in tubeWires" :key="'tw' + i" :points="w.d" :class="['wire', 'a', { back: !w.front }]" />
        <polyline v-for="(w, i) in branchWires.filter(x => !x.front)" :key="'bb' + i" :points="w.d" class="wire b back" />
        <polyline v-for="(w, i) in topWire" :key="'top' + i" :points="w.d" :class="['wire', 'b', { back: !w.front }]" />
        <template v-if="s.step.value >= 5"><polyline v-for="(w, i) in branchWires.filter(x => x.front)" :key="'bf' + i" :points="w.d" class="wire b" /></template>
        <g v-if="s.step.value >= 5" :style="{ opacity: fade(5) }">
          <polygon v-for="(q, i) in quads" :key="'q' + i" :points="q.d" :class="['skin', { done: s.step.value === 6 }]" :style="{ fillOpacity: q.front ? 0.2 + 0.6 * q.shade : 0.1 }" />
        </g>
        <g v-if="s.step.value < 6">
          <polyline v-if="s.step.value === 0" :points="chainAt(chainDrawn)" class="chain" />
          <template v-else><polyline v-for="(c, i) in chainRuns" :key="'ch' + i" :points="c.d" :class="['chain', { back: !c.front }]" /></template>
        </g>
        <g v-else :style="{ opacity: fade(6) }">
          <polyline v-for="(c, i) in rail1" :key="'r1' + i" :points="c.d" :class="['rail', { back: !c.front }]" />
          <polyline v-for="(c, i) in rail2" :key="'r2' + i" :points="c.d" :class="['rail', { back: !c.front }]" />
        </g>
        <g v-if="s.step.value >= 1 && s.step.value <= 3">
          <polygon v-for="st in stations.slice(0, stationsShown)" :key="'sq' + st.i" :points="st.square" :class="['square', { back: !st.front }]" />
        </g>
        <g v-if="s.step.value === 5" :style="{ opacity: fade(5) }">
          <polygon v-for="st in stations.filter(x => x.lofted)" :key="'tool' + st.i" :points="st.tool" :class="['toolsec', { back: !st.front }]" />
        </g>
        <g v-if="s.step.value >= 2 && s.step.value <= 5">
          <polyline v-for="st in stations.slice(0, sectionsShown)" :key="'arc' + st.i" :points="st.arc" :class="['section', { check: s.step.value >= 4 && !st.lofted, back: !st.front }]" />
        </g>
        <template v-if="s.step.value < 5"><polyline v-for="(w, i) in branchWires.filter(x => x.front)" :key="'bf' + i" :points="w.d" class="wire b" /></template>
        <g v-if="s.step.value >= 2 && s.step.value <= 3" :class="{ back: !ball.front }">
          <circle :cx="ball.c[0]" :cy="ball.c[1]" :r="R_PX" class="ball" :style="{ opacity: s.step.value === 2 ? k : 1 }" />
          <line :x1="ball.c[0]" :y1="ball.c[1]" :x2="ball.T1[0]" :y2="ball.T1[1]" class="spoke" />
          <line :x1="ball.c[0]" :y1="ball.c[1]" :x2="ball.T2[0]" :y2="ball.T2[1]" class="spoke" />
          <circle :cx="ball.c[0]" :cy="ball.c[1]" r="2.6" class="centre" />
          <circle :cx="ball.T1[0]" :cy="ball.T1[1]" r="2.8" class="contact" /><circle :cx="ball.T2[0]" :cy="ball.T2[1]" r="2.8" class="contact" />
        </g>
        <text x="12" y="20" class="name a">A · tube, radius 10</text><text x="12" y="35" class="name b">B · branch, radius 5</text>
        <text v-if="s.step.value === 4" x="12" y="250" class="legend"><tspan class="k">━ lofted</tspan>  <tspan class="h">┅ measures</tspan></text>
      </svg>
      <template #note>Computed in the page with the kernel's station solve and section on this tee (the branch moved to
        the z axis; the surfaces written by angle and height, the kernel's are NURBS patches). 96 stations are solved and
        every fourth is drawn; the surface is drawn through every second one. The counts and distances in steps 2 and 5
        are the kernel's own report for conformance case <code>r10/general-tee</code>, run on the built kernel.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.wire { fill: none; stroke-width: 0.9; opacity: 0.6; } .wire.a { stroke: var(--a); } .wire.b { stroke: var(--b); }
.wire.back { opacity: 0.2; }
.chain { fill: none; stroke: var(--vp-c-text-1); stroke-width: 2.2; stroke-linejoin: round; } .chain.back { opacity: 0.3; stroke-width: 1.4; }
.square { fill: var(--vp-c-text-1); fill-opacity: 0.08; stroke: var(--vp-c-text-2); stroke-width: 0.8; } .square.back { opacity: 0.3; }
.section { fill: none; stroke: var(--keep); stroke-width: 1.8; stroke-linecap: round; }
.section.check { stroke: var(--hot); stroke-dasharray: 2 2; stroke-width: 1.4; }
.section.back { opacity: 0.35; }
.toolsec { fill: var(--a); fill-opacity: 0.12; stroke: var(--a); stroke-width: 0.8; } .toolsec.back { opacity: 0.35; }
.skin { fill: var(--a); stroke: none; } .skin.done { fill: var(--keep); }
.rail { fill: none; stroke: var(--keep); stroke-width: 1.6; } .rail.back { opacity: 0.3; }
.ball { fill: var(--hot); fill-opacity: 0.14; stroke: var(--hot); stroke-width: 1.4; }
.spoke { stroke: var(--hot); stroke-width: 1; }
.centre { fill: var(--hot); }
.contact { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; }
g.back { opacity: 0.45; }
.name { font-weight: 700; font-size: 11px; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
.legend .k { fill: var(--keep); font-weight: 700; } .legend .h { fill: var(--hot); font-weight: 700; }
</style>
