<script setup>
// Edge collapse under the quadric error metric (mesh-decimate.ts `decimateMesh`, R9, D85), one dimension down: a terrain
// profile of 17 points, each segment's line in place of a triangle's plane. The method below is the kernel's in 2D:
// unweighted unit-normal quadrics summed per vertex; a collapse placed at the quadric's minimum when its matrix is well
// conditioned (|det| > 1e-9 tr²) and the minimum lies within two edge lengths of the edge's middle, else at the better of
// the two ends and the middle; the profile's two ends never move (a collapse with one is placed on it, one between both
// is not made); each vertex's cheapest collapse, ties by the partner's number, taken in order of cost then vertex number;
// a price checked again when it comes up; after a collapse the kept vertex priced again, a neighbour whose cheapest was
// with the pair priced afresh, any other offered its collapse with the kept vertex; a collapse that turns a neighbouring
// segment by more than 75° (cos 0.26) refused. The distances are measured both ways as the kernel's meshDistance does:
// from one shape's vertices and the middles of its pieces (triangle centres in 3D) to the nearest point of the other.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const PY = [0.4, 0.4, 0.4, 0.4, 0.9, 1.9, 3.3, 4.1, 3.8, 3.0, 2.4, 1.8, 1.2, 1.1, 1.3, 1.2, 1.2];
const NV = PY.length, FLIP_COS = 0.26;

function decimate() {
  const P = new Float64Array(2 * NV);
  for (let i = 0; i < NV; i++) { P[2 * i] = i; P[2 * i + 1] = PY[i]; }
  const prev = new Int32Array(NV), next = new Int32Array(NV), alive = new Uint8Array(NV).fill(1), Q = new Float64Array(6 * NV);
  for (let i = 0; i < NV; i++) { prev[i] = i - 1; next[i] = i + 1 < NV ? i + 1 : -1; }
  // Each segment's line a x + b y + c = 0 (a² + b² = 1) as the quadric p pᵀ, added to both its ends.
  for (let i = 0; i + 1 < NV; i++) {
    const dx = P[2 * i + 2] - P[2 * i], dy = P[2 * i + 3] - P[2 * i + 1], l = Math.hypot(dx, dy), a = -dy / l, b = dx / l, c = -(a * P[2 * i] + b * P[2 * i + 1]);
    for (const v of [i, i + 1]) { const o = 6 * v; Q[o] += a * a; Q[o + 1] += a * b; Q[o + 2] += a * c; Q[o + 3] += b * b; Q[o + 4] += b * c; Q[o + 5] += c * c; }
  }
  const isEnd = v => prev[v] < 0 || next[v] < 0;
  const costAt = (u, v, x, y) => {
    const a = 6 * u, b = 6 * v, q0 = Q[a] + Q[b], q1 = Q[a + 1] + Q[b + 1], q2 = Q[a + 2] + Q[b + 2], q3 = Q[a + 3] + Q[b + 3], q4 = Q[a + 4] + Q[b + 4], q5 = Q[a + 5] + Q[b + 5];
    return x * (q0 * x + q1 * y + q2) + y * (q1 * x + q3 * y + q4) + (q2 * x + q4 * y + q5);
  };
  const place = [0, 0];
  function price(u, v) {
    const fu = isEnd(u), fv = isEnd(v);
    if (fu && fv) return Infinity;
    const from = fu ? u : fv ? v : -1;
    if (from >= 0) { place[0] = P[2 * from]; place[1] = P[2 * from + 1]; return costAt(u, v, place[0], place[1]); }
    const a = 6 * u, b = 6 * v, m0 = Q[a] + Q[b], m1 = Q[a + 1] + Q[b + 1], m3 = Q[a + 3] + Q[b + 3], r0 = -(Q[a + 2] + Q[b + 2]), r1 = -(Q[a + 4] + Q[b + 4]);
    const det = m0 * m3 - m1 * m1, tr = m0 + m3;
    if (Math.abs(det) > 1e-9 * tr * tr) {
      const x = (r0 * m3 - r1 * m1) / det, y = (m0 * r1 - m1 * r0) / det;
      const el = Math.hypot(P[2 * v] - P[2 * u], P[2 * v + 1] - P[2 * u + 1]), mx = (P[2 * u] + P[2 * v]) / 2, my = (P[2 * u + 1] + P[2 * v + 1]) / 2;
      if (Math.hypot(x - mx, y - my) <= 2 * el) { place[0] = x; place[1] = y; return costAt(u, v, x, y); }
    }
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      const x = k === 0 ? P[2 * u] : k === 1 ? P[2 * v] : (P[2 * u] + P[2 * v]) / 2, y = k === 0 ? P[2 * u + 1] : k === 1 ? P[2 * v + 1] : (P[2 * u + 1] + P[2 * v + 1]) / 2;
      const e = costAt(u, v, x, y); if (e < best) { best = e; place[0] = x; place[1] = y; }
    }
    return best;
  }
  const nb = v => [prev[v], next[v]].filter(w => w >= 0);
  function flipFree(v, u, x, y) {
    for (const w of nb(v)) {
      if (w === u) continue;
      const ox = P[2 * v] - P[2 * w], oy = P[2 * v + 1] - P[2 * w + 1], nx = x - P[2 * w], ny = y - P[2 * w + 1], l0 = Math.hypot(ox, oy), l1 = Math.hypot(nx, ny);
      if (!(l1 > 1e-9) || ox * nx + oy * ny < FLIP_COS * l0 * l1) return false;
    }
    return true;
  }
  const best = new Int32Array(NV).fill(-1), at = new Float64Array(2 * NV), cost = new Float64Array(NV).fill(Infinity), queued = new Uint8Array(NV);
  function refresh(v, valid) {
    let bc = Infinity, bt = -1, bx = 0, by = 0;
    for (const w of nb(v)) {
      const c = price(v, w);
      if (!(c < bc || (c === bc && c < Infinity && w < bt))) continue;
      if (valid && (!flipFree(v, w, place[0], place[1]) || !flipFree(w, v, place[0], place[1]))) continue;
      bc = Math.max(0, c); bt = w; bx = place[0]; by = place[1];
    }
    best[v] = bt; at[2 * v] = bx; at[2 * v + 1] = by; cost[v] = bt < 0 ? Infinity : bc; queued[v] = 1;
  }
  for (let v = 0; v < NV; v++) refresh(v, false);
  const top = () => { let m = -1; for (let v = 0; v < NV; v++) if (queued[v] && (m < 0 || cost[v] < cost[m] || (cost[v] === cost[m] && v < m))) m = v; return m; };
  const snap = () => ({ P: Array.from(P), alive: Array.from(alive), cost: Array.from(cost), best: Array.from(best), Q: Array.from(Q), top: top() });
  const events = [], snaps = [snap()];
  let bound = 0;
  for (;;) {
    const v = top();
    if (v < 0 || cost[v] === Infinity) break;
    const u = best[v];
    if (u < 0 || !alive[u]) { refresh(v, false); continue; }
    const c = Math.max(0, price(v, u));
    if (c === Infinity || c > cost[v] + 1e-12 * (1 + cost[v])) { refresh(v, false); continue; }
    if (!flipFree(v, u, place[0], place[1]) || !flipFree(u, v, place[0], place[1])) { refresh(v, true); continue; }
    bound = Math.max(bound, Math.sqrt(c));
    const ev = { v, u, from: [P[2 * v], P[2 * v + 1]], uFrom: [P[2 * u], P[2 * u + 1]], to: [place[0], place[1]], cost: c, bound };
    P[2 * u] = place[0]; P[2 * u + 1] = place[1];
    const p = prev[v], n = next[v]; if (p >= 0) next[p] = n; if (n >= 0) prev[n] = p; alive[v] = 0; queued[v] = 0;
    for (let k = 0; k < 6; k++) Q[6 * u + k] += Q[6 * v + k];
    refresh(u, false);
    for (const x of nb(u)) {
      if (best[x] === v || best[x] === u || best[x] < 0) { refresh(x, false); continue; }
      const cc = price(x, u);
      if (cc < cost[x] || (cc === cost[x] && u < best[x])) { best[x] = u; at[2 * x] = place[0]; at[2 * x + 1] = place[1]; cost[x] = Math.max(0, cc); }
    }
    events.push(ev); snaps.push(snap());
  }
  return { events, snaps };
}
const { events: EV, snaps: SN } = decimate();
const polyOf = sn => { const out = []; for (let v = 0; v < NV; v++) if (sn.alive[v]) out.push([sn.P[2 * v], sn.P[2 * v + 1]]); return out; };
const ORIGINAL = polyOf(SN[0]);

/** One way, as meshDistance: from A's vertices and its pieces' middles to the nearest point of B; the largest, where, and its foot. */
function oneWay(A, B) {
  let max = -1, at = null, foot = null;
  for (let i = 0; i < A.length; i++) for (const p of i + 1 < A.length ? [A[i], [(A[i][0] + A[i + 1][0]) / 2, (A[i][1] + A[i + 1][1]) / 2]] : [A[i]]) {
    let d = Infinity, f = null;
    for (let j = 0; j + 1 < B.length; j++) {
      const ax = B[j][0], ay = B[j][1], dx = B[j + 1][0] - ax, dy = B[j + 1][1] - ay, l = dx * dx + dy * dy;
      const s = Math.max(0, Math.min(1, l > 0 ? ((p[0] - ax) * dx + (p[1] - ay) * dy) / l : 0)), qx = ax + s * dx, qy = ay + s * dy, e = (qx - p[0]) ** 2 + (qy - p[1]) ** 2;
      if (e < d) { d = e; f = [qx, qy]; }
    }
    if (d > max) { max = d; at = p; foot = f; }
  }
  return { max: Math.sqrt(max), at, foot };
}
/** For each number of collapses made: the shape, the largest quadric bound so far and the distances both ways. */
const STATES = SN.map((sn, k) => {
  const poly = polyOf(sn), a = oneWay(ORIGINAL, poly), b = oneWay(poly, ORIGINAL);
  return { poly, segs: poly.length - 1, bound: k ? EV[k - 1].bound : 0, to: a, back: b, worst: a.max >= b.max ? a : b };
});

// The ellipse of a vertex's quadric: where the vertex can move for E² more cost (its 2 × 2 part's eigenvectors, semi-axes
// E / √λ, capped where a straight run makes λ nearly 0).
const E = 0.3, CAP = 1;
function ellipseOf(sn, v) {
  const o = 6 * v, a = sn.Q[o], b = sn.Q[o + 1], d = sn.Q[o + 3], m = (a + d) / 2, r = Math.hypot((a - d) / 2, b);
  const l1 = m + r, l2 = Math.max(0, m - r), ang = Math.abs(b) > 1e-12 ? Math.atan2(l1 - a, b) : a >= d ? 0 : Math.PI / 2;
  // (The first semi-axis lies across the eigenvector of l1, the larger eigenvalue: the short one.)
  return { x: sn.P[2 * v], y: sn.P[2 * v + 1], r1: Math.min(CAP, E / Math.sqrt(l1)), r2: Math.min(CAP, l2 > 1e-12 ? E / Math.sqrt(l2) : CAP), ang };
}
const ELLIPSES = SN.map(sn => { const out = []; for (let v = 0; v < NV; v++) if (sn.alive[v]) out.push({ v, ...ellipseOf(sn, v) }); return out; });

const S = 21.5, X = x => 18 + S * x, Y = y => 132 - S * y;
const f1 = v => Math.round(v * 10) / 10;
const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f1(X(p[0]))} ${f1(Y(p[1]))}`).join('');
const BAR0 = 214, BARH = 46, BARFULL = 0.6;
const barH = c => (c === Infinity ? BARH : Math.min(BARH, BARH * Math.sqrt(Math.max(0, c)) / BARFULL));

// Which collapses each step plays: the four on straight runs, the first with a cost, then on to a budget of 6 segments.
const FLAT = EV.findIndex(e => e.cost > 1e-18), BUDGET = 6, TO_BUDGET = SN.findIndex((sn, k) => STATES[k].segs <= BUDGET);
const PLAY = [null, null, null, [0, FLAT], [FLAT, FLAT + 1], [FLAT + 1, TO_BUDGET]];
const FIRST = EV[FLAT];

const steps = [
  { label: 'Each piece\'s plane, as a quadric', text: 'Decimation removes vertices one edge collapse at a time and keeps the shape. The figure works one dimension down: a terrain profile of 17 points, each segment\'s line standing for a triangle\'s plane. A line is a x + b y + c = 0 with a unit normal (a, b); the squared distance of a point to it is a quadratic form in the point, its matrix p pᵀ.', formula: 'p = (a, b, c) · distance² of x̄ = (x, y, 1) = x̄ᵀ (p pᵀ) x̄' },
  { label: 'A vertex\'s quadric: the sum of its pieces\'', text: 'Each vertex starts with the sum Q of the quadrics of the pieces it touches, unweighted. x̄ᵀ Q x̄ is then the sum of squared distances from x̄ to all of them. The ellipse is where the vertex could move for 0.3² more of it: long on a straight run (moving along it costs nothing), round at a sharp corner.', formula: 'Q<sub>v</sub> = Σ<sub>pieces at v</sub> p pᵀ · in 3D, Q = Σ<sub>triangles at v</sub> p pᵀ, p the plane (a, b, c, d)' },
  { label: 'Each vertex\'s cheapest collapse, in a heap', text: 'For each edge (u, v), the merged vertex goes where Q<sub>u</sub> + Q<sub>v</sub> is least, found by solving a small linear system; when that system is badly conditioned, or its answer lies more than two edge lengths from the edge\'s middle, the better of the two ends and the middle. Its cost is the quadric there. Each vertex keeps its cheapest collapse in an indexed min-heap, ordered by cost and then by vertex number. The bars are √cost; the red one is the heap\'s top.', formula: 'cost = x̄ᵀ (Q<sub>u</sub> + Q<sub>v</sub>) x̄ · x̄ = the least point, or the best of u, v, (u + v)/2' },
  { label: 'Straight runs go first, for nothing', text: `On a straight run the two quadrics are the same line twice: the cost is 0 and the shape does not change. The first ${FLAT} collapses are those: two on the flat start, two on the even slope. The profile's two ends never move: a collapse with an end is placed on the end.`, formula: `segments 16 → ${16 - FLAT} · bound 0 mm` },
  { label: 'A collapse with a cost, and its neighbours priced again', text: `The next cheapest costs ${num(FIRST.cost, 4)} mm²: vertex ${FIRST.v} merges into ${FIRST.u} at the quadric's least point (${num(FIRST.to[0], 3)}, ${num(FIRST.to[1], 3)}), off both. The kept vertex gets Q<sub>u</sub> + Q<sub>v</sub>, so it still knows every line it stood on. It is priced again, and so are the neighbours whose cheapest was with either vertex; a price that went stale is checked again when it reaches the top.`, formula: `Q<sub>${FIRST.u}</sub> ← Q<sub>${FIRST.u}</sub> + Q<sub>${FIRST.v}</sub> · √cost = ${num(Math.sqrt(FIRST.cost), 3)} mm` },
  { label: 'On to the budget', text: `Collapse after collapse, each the cheapest left, until the budget: here ${BUDGET} segments (the kernel's <code>targetTriangles</code> or <code>ratio</code>), or until the next cost passes <code>maxError</code>². √cost bounds the distance from the merged vertex to every line it gathered; the largest made is the report's <code>bound</code>.`, formula: `segments 16 → ${STATES[TO_BUDGET].segs} · bound = max √cost = ${num(STATES[TO_BUDGET].bound, 3)} mm` },
  { label: 'The error measured both ways', text: 'The bound is not the reported error: the distance is measured. From each vertex and piece middle of the original to the nearest point of the result, and from the result\'s back to the original; the Hausdorff distance is the larger. These are samples, not a bound. Move the slider to stop at another budget.', formula: 'hausdorff = max(max<sub>a∈A</sub> d(a, B), max<sub>b∈B</sub> d(b, A)) · rms over both sample sets' },
];
const s = useSteps(steps.length, [2600, 2800, 3200, 3600, 3400, 5200, 3000], root);
const e = computed(() => ease(s.t.value));
const keep = ref(BUDGET);
const setKeep = ev => { keep.value = +ev.target.value; };

/** The state shown: a snapshot, or a collapse in motion (v and u sliding to their place). */
const shown = computed(() => {
  const st = s.step.value;
  if (st === 6) { const k = STATES.findIndex(x => x.segs <= keep.value); return { k: k < 0 ? STATES.length - 1 : k, moving: null }; }
  const play = PLAY[st];
  if (!play) return { k: 0, moving: null };
  const [a, b] = play, n = b - a, p = Math.min(n - 1e-9, s.t.value * n), i = Math.floor(p), local = ease(Math.min(1, (p - i) * 1.25));
  if (s.t.value >= 1) return { k: b, moving: null };
  return { k: a + i, moving: { ev: EV[a + i], u: local } };
});
const line = computed(() => {
  const { k, moving } = shown.value, sn = SN[k], pts = [];
  for (let v = 0; v < NV; v++) {
    if (!sn.alive[v]) continue;
    let x = sn.P[2 * v], y = sn.P[2 * v + 1];
    if (moving && (v === moving.ev.v || v === moving.ev.u)) { x += (moving.ev.to[0] - x) * moving.u; y += (moving.ev.to[1] - y) * moving.u; }
    pts.push([x, y, v]);
  }
  return pts;
});
const state = computed(() => STATES[shown.value.k]);
const lines = computed(() => {
  if (s.step.value !== 0) return [];
  const n = Math.min(NV - 1, Math.floor(e.value * NV));
  return ORIGINAL.slice(0, n).map((p, i) => {
    const q = ORIGINAL[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), ext = 1.1;
    return { x1: X(p[0] - ext * dx / l), y1: Y(p[1] - ext * dy / l), x2: X(q[0] + ext * dx / l), y2: Y(q[1] + ext * dy / l) };
  });
});
const ellipses = computed(() => {
  const st = s.step.value;
  if (st < 1 || st === 6) return [];
  const g = st === 1 ? e.value : 1, k = shown.value.k;
  return ELLIPSES[k].map(el => ({ ...el, cx: X(el.x), cy: Y(el.y), rx: Math.max(0, S * el.r2 * g), ry: Math.max(0, S * el.r1 * g), rot: -el.ang * 180 / Math.PI + 90 }));
});
const bars = computed(() => {
  const st = s.step.value;
  if (st < 2 || st === 6) return [];
  const { k, moving } = shown.value, sn = SN[k], grow = st === 2 ? e.value : 1, out = [];
  for (let v = 0; v < NV; v++) {
    if (!sn.alive[v] || (moving && v === moving.ev.v && moving.u > 0.5)) continue;
    const h = Math.max(0, barH(sn.cost[v]) * grow), over = sn.cost[v] !== Infinity && Math.sqrt(sn.cost[v]) > BARFULL;
    out.push({ v, x: X(sn.P[2 * v]) - 4, y: BAR0 - h, h, top: (st > 2 || e.value > 0.8) && sn.top === v && !moving, over, zero: sn.cost[v] < 1e-18 });
  }
  return out;
});
const moved = computed(() => {
  const m = shown.value.moving;
  return m ? { x: X(m.ev.to[0]), y: Y(m.ev.to[1]) } : null;
});
const worst = computed(() => s.step.value === 6 && state.value.worst.at ? state.value.worst : null);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Edge collapse under the quadric error metric" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A terrain profile simplified by collapsing its cheapest edges one at a time, each vertex carrying the sum of its pieces' line quadrics">
        <line v-for="(l, i) in lines" :key="'l' + i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" class="ext" />
        <ellipse v-for="el in ellipses" :key="'e' + el.v" :cx="el.cx" :cy="el.cy" :rx="el.rx" :ry="el.ry" :transform="`rotate(${el.rot} ${el.cx} ${el.cy})`" class="ell" />
        <path v-if="s.step.value >= 3" :d="path(ORIGINAL)" class="orig" />
        <path :d="path(line)" class="prof" />
        <circle v-for="p in line" :key="'p' + p[2]" :cx="X(p[0])" :cy="Y(p[1])" r="2.6" class="pt" :class="{ hot: shown.moving && (p[2] === shown.moving.ev.v || p[2] === shown.moving.ev.u) }" />
        <circle v-if="moved" :cx="moved.x" :cy="moved.y" r="4.2" class="target" />
        <g v-if="worst">
          <line :x1="X(worst.at[0])" :y1="Y(worst.at[1])" :x2="X(worst.foot[0])" :y2="Y(worst.foot[1])" class="gap" />
          <circle :cx="X(worst.at[0])" :cy="Y(worst.at[1])" r="3" class="worst" />
        </g>
        <!-- each vertex's cheapest collapse -->
        <g v-if="bars.length">
          <line x1="12" :y1="BAR0" x2="368" :y2="BAR0" class="axis" />
          <rect v-for="b in bars" :key="'b' + b.v" :x="b.x" :y="b.y" width="8" :height="b.h" rx="1.5" class="bar" :class="{ top: b.top }" />
          <text v-for="b in bars" v-show="b.over" :key="'o' + b.v" :x="b.x + 4" :y="b.y - 3" text-anchor="middle" class="small">▲</text>
          <text v-for="b in bars" v-show="b.zero" :key="'z' + b.v" :x="b.x + 4" :y="BAR0 - 3" text-anchor="middle" class="small">0</text>
          <text x="12" y="232" class="small">√cost of each vertex's cheapest collapse (full bar {{ BARFULL }} mm; ▲ more)</text>
        </g>
        <g class="readout">
          <text x="12" y="16">segments {{ state.segs }}<tspan v-if="s.step.value >= 3"> · bound {{ num(state.bound, 3) }} mm</tspan></text>
          <text v-if="s.step.value === 6" x="12" y="30">to the result {{ num(state.to.max, 3) }} · back {{ num(state.back.max, 3) }} · <tspan class="hot">Hausdorff {{ num(Math.max(state.to.max, state.back.max), 3) }} mm</tspan></text>
        </g>
        <text v-if="s.step.value === 6" x="12" y="232" class="small">grey: the original · red: the farthest sample and its nearest point</text>
      </svg>
      <div v-if="s.step.value === 6" class="pick">
        <label for="meshp-keep">segments kept</label>
        <input id="meshp-keep" type="range" min="1" max="16" step="1" :value="keep" aria-label="Segments kept" @input="setKeep">
        <output>{{ state.segs }}</output>
      </div>
      <template #note>A 2D analogue, computed in the page: a profile's segments stand for a mesh's triangles and their lines for
        the triangles' planes, so every quadric is 3 × 3 instead of 4 × 4. The rules are the kernel's, restated for a line:
        the profile's ends stand for the ends of a feature line, which never move. The kernel's feature-line penalty planes,
        its link condition and its normal-sum check have no counterpart on a profile and are left out; the 75° turn check
        is kept. The ellipses are drawn at 0.3 mm and capped at 1 mm along a straight run.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .small { font-size: 9.5px; fill: var(--vp-c-text-3); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); }
.readout .hot { fill: var(--hot); }
.ext { stroke: var(--b); stroke-width: 0.8; stroke-dasharray: 3 2; opacity: 0.8; }
.ell { fill: color-mix(in srgb, var(--a) 14%, transparent); stroke: var(--a); stroke-width: 0.8; }
.orig { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 2 2; }
.prof { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.8; stroke-linejoin: round; }
.pt { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.pt.hot { fill: var(--hot); }
.target { fill: none; stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 2 1.5; }
.gap { stroke: var(--hot); stroke-width: 1.6; }
.worst { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1; }
.axis { stroke: var(--vp-c-divider); stroke-width: 1; }
.bar { fill: color-mix(in srgb, var(--a) 55%, var(--vp-c-bg)); }
.bar.top { fill: var(--hot); }
.pick { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); }
.pick input { flex: 1 1 120px; min-width: 100px; accent-color: var(--vp-c-brand-1); }
.pick output { font-family: var(--vp-font-family-mono); font-size: 12px; min-width: 30px; color: var(--vp-c-text-1); }
.pick input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
