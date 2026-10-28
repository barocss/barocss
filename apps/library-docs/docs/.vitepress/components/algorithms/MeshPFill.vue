<script setup>
// Mesh repair (mesh-repair.ts `repairMesh`, M3, D46) on a terrain sheet of 102 triangles with a hole of 18 rim edges,
// brought in as a triangle soup: every triangle with its own corners (repeats moved by under 2e-6 mm), three triangles
// turned, a triangle with a repeated corner and one triangle twice added. The fill below is the kernel's code, copied
// (minimumArea, refine, relax, fair). Checked against the built kernel when the page was written (a scratch script calling
// dist/index.js `repairMesh(soup, null, { fill: { skip: [0] } })`): welded 235, degenerate 1, duplicates 1, flipped 3,
// holes filled 1 (34 triangles, 19.810 mm²), holes left 1 — and the same 34 fill triangles, corner for corner.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const NX = 10, NY = 7;
const height = (x, y) => 1.6 * Math.exp(-((x - 5) ** 2 + (y - 3.5) ** 2) / 5) + 0.25 * Math.sin(0.9 * x) * Math.cos(0.7 * y);

/** The sheet, its vertices numbered as a weld of its soup numbers them (in order of first use). */
function sheet() {
  const G = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) G.push(i, j, height(i, j));
  const id = (i, j) => j * (NX + 1) + i, TG = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    for (const t of (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]) {
      const cx = (G[3 * t[0]] + G[3 * t[1]] + G[3 * t[2]]) / 3, cy = (G[3 * t[0] + 1] + G[3 * t[1] + 1] + G[3 * t[2] + 1]) / 3;
      if (Math.hypot(cx - 5.3, (cy - 3.6) * 1.15) < 2.6) continue; // the hole
      TG.push(...t);
    }
  }
  const map = new Map(), P = [], T = [];
  for (const g of TG) { if (!map.has(g)) { map.set(g, P.length / 3); P.push(G[3 * g], G[3 * g + 1], G[3 * g + 2]); } T.push(map.get(g)); }
  return { P, T };
}
const { P: P0, T: T0 } = sheet();
const NT = T0.length / 3, NV = P0.length / 3, FLIPPED = [9, 40, 71], DEGENERATE = [T0[30], T0[31]], DUPLICATE = 20;
const CORNERS = 3 * (NT + 2);

// ---- the kernel's helpers and fill, copied from mesh-repair.ts --------------------------------------------------
const area2 = (P, a, b, c) => { const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2]; return (uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2; };
const dist = (P, a, b) => Math.hypot(P[3 * b] - P[3 * a], P[3 * b + 1] - P[3 * a + 1], P[3 * b + 2] - P[3 * a + 2]);
function angle(P, v, a, b) { const ux = P[3 * a] - P[3 * v], uy = P[3 * a + 1] - P[3 * v + 1], uz = P[3 * a + 2] - P[3 * v + 2], wx = P[3 * b] - P[3 * v], wy = P[3 * b + 1] - P[3 * v + 1], wz = P[3 * b + 2] - P[3 * v + 2]; const d = (ux * wx + uy * wy + uz * wz) / (Math.hypot(ux, uy, uz) * Math.hypot(wx, wy, wz) || 1); return Math.acos(Math.max(-1, Math.min(1, d))); }
function minimumArea(P, loop) {
  const n = loop.length, W = new Float64Array(n * n), K = new Int32Array(n * n).fill(-1);
  for (let span = 2; span < n; span++) for (let i = 0; i + span < n; i++) {
    const j = i + span; let best = Infinity, at = -1;
    for (let k = i + 1; k < j; k++) { const w = W[i * n + k] + W[k * n + j] + Math.sqrt(area2(P, loop[i], loop[k], loop[j])); if (w < best) { best = w; at = k; } }
    W[i * n + j] = best; K[i * n + j] = at;
  }
  const out = [], todo = [[0, n - 1]];
  while (todo.length) { const [i, j] = todo.pop(); if (j - i < 2) continue; const k = K[i * n + j]; out.push(loop[i], loop[k], loop[j]); todo.push([i, k], [k, j]); }
  return out;
}
const key = (a, b) => Math.min(a, b) * 1e9 + Math.max(a, b);
function addTriangle(T, t, at) { for (let j = 0; j < 3; j++) { const h = 3 * t + j, k = key(T[h], T[3 * t + (j + 1) % 3]), l = at.get(k); if (l) l.push(h); else at.set(k, [h]); } }
function removeTriangle(T, t, at) { for (let j = 0; j < 3; j++) { const h = 3 * t + j, k = key(T[h], T[3 * t + (j + 1) % 3]), l = at.get(k); if (!l) continue; const i = l.indexOf(h); if (i >= 0) l.splice(i, 1); if (!l.length) at.delete(k); } }
function relax(P, T, rim) {
  const at = new Map(); for (let t = 0; t < T.length / 3; t++) addTriangle(T, t, at);
  const queue = [...at.keys()]; let flips = 0;
  for (let guard = 0; queue.length && guard < 8 * T.length; guard++) {
    const k = queue.pop(), list = at.get(k);
    if (!list || list.length !== 2 || rim.has(k)) continue;
    const [h1, h2] = list, t1 = (h1 / 3) | 0, t2 = (h2 / 3) | 0;
    const a = T[h1], b = T[h1 - h1 % 3 + (h1 % 3 + 1) % 3], c = T[h1 - h1 % 3 + (h1 % 3 + 2) % 3], d = T[h2 - h2 % 3 + (h2 % 3 + 2) % 3];
    if (T[h2] !== b || c === d || at.has(key(c, d))) continue;
    if (angle(P, c, a, b) + angle(P, d, b, a) <= Math.PI + 1e-12) continue;
    removeTriangle(T, t1, at); removeTriangle(T, t2, at);
    T[3 * t1] = c; T[3 * t1 + 1] = a; T[3 * t1 + 2] = d; T[3 * t2] = d; T[3 * t2 + 1] = b; T[3 * t2 + 2] = c;
    addTriangle(T, t1, at); addTriangle(T, t2, at);
    queue.push(key(c, a), key(a, d), key(d, b), key(b, c)); flips++;
  }
  return flips;
}
/** Liepa's refinement, each round kept (after its splits, after its flips) for the figure. */
function refine(P, tris, sigma, rim, rounds) {
  const T = tris.slice(), cap = 64 * tris.length + 20000;
  relax(P, T, rim);
  for (let round = 0, split = true; split && round < 32 && T.length / 3 < cap; round++) {
    split = false; const nt = T.length / 3, added = [];
    for (let t = 0; t < nt; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const cx = (P[3 * a] + P[3 * b] + P[3 * c]) / 3, cy = (P[3 * a + 1] + P[3 * b + 1] + P[3 * c + 1]) / 3, cz = (P[3 * a + 2] + P[3 * b + 2] + P[3 * c + 2]) / 3;
      const sc = (sigma.get(a) + sigma.get(b) + sigma.get(c)) / 3;
      let ok = true;
      for (const v of [a, b, c]) { const d = Math.SQRT2 * Math.hypot(cx - P[3 * v], cy - P[3 * v + 1], cz - P[3 * v + 2]); if (!(d > sc && d > sigma.get(v))) { ok = false; break; } }
      if (!ok) continue;
      if (T.length / 3 >= cap) break;
      const m = P.length / 3; P.push(cx, cy, cz); sigma.set(m, sc); added.push(m);
      T[3 * t + 2] = m; T.push(b, c, m, c, a, m); split = true;
    }
    const split0 = T.slice(), flips = relax(P, T, rim);
    if (added.length) rounds.push({ added, split: split0, relaxed: T.slice(), flips });
  }
  return T;
}
/** Umbrella smoothing (the rim fixed), 30 rounds; each round's positions kept. */
function fair(P, T, rim, frames) {
  const nb = new Map();
  for (let i = 0; i < T.length; i += 3) for (let k = 0; k < 3; k++) { const v = T[i + k]; if (rim.has(v)) continue; let s = nb.get(v); if (!s) nb.set(v, s = new Set()); s.add(T[i + (k + 1) % 3]); s.add(T[i + (k + 2) % 3]); }
  for (let round = 0; round < 30; round++) {
    for (const [v, s] of nb) { let x = 0, y = 0, z = 0; for (const u of s) { x += P[3 * u]; y += P[3 * u + 1]; z += P[3 * u + 2]; } P[3 * v] = x / s.size; P[3 * v + 1] = y / s.size; P[3 * v + 2] = z / s.size; }
    frames.push(P.slice());
  }
}

// ---- the steps' data ----------------------------------------------------------------------------------------------
// Orient: breadth first from triangle 0 across two-triangle edges (the soup's windings: three turned).
const TS = T0.slice();
for (const t of FLIPPED) { const x = TS[3 * t + 1]; TS[3 * t + 1] = TS[3 * t + 2]; TS[3 * t + 2] = x; }
const sides = new Map();
for (let h = 0; h < TS.length; h++) { const a = TS[h], b = TS[h - h % 3 + (h % 3 + 1) % 3], k = key(a, b), l = sides.get(k); if (l) l.push(h); else sides.set(k, [h]); }
const VISIT = new Int32Array(NT).fill(-1);
let INCONSISTENT = 0;
for (const l of sides.values()) if (l.length === 2 && TS[l[0]] === TS[l[1]]) INCONSISTENT++;
{
  const across = new Int32Array(TS.length).fill(-1), queue = [0];
  for (const l of sides.values()) if (l.length === 2) { across[l[0]] = l[1]; across[l[1]] = l[0]; }
  VISIT[0] = 0; let n = 1;
  for (let q = 0; q < queue.length; q++) { const t = queue[q]; for (let k = 0; k < 3; k++) { const o = across[3 * t + k]; if (o < 0) continue; const u = (o / 3) | 0; if (VISIT[u] < 0) { VISIT[u] = n++; queue.push(u); } } }
}
// Holes: the loops of one-triangle edges, as holeLoops walks them (the rim's edges backwards).
const LOOPS = (() => {
  const out = new Map();
  for (const l of sides.values()) if (l.length === 1) { const h = l[0], from = T0[h], to = T0[h - h % 3 + (h % 3 + 1) % 3], x = out.get(to); if (x) x.push(from); else out.set(to, [from]); }
  const loops = [];
  for (const start of [...out.keys()].sort((x, y) => x - y)) while (out.get(start)?.length) {
    const loop = [start]; let at = out.get(start).pop();
    while (at !== start) { loop.push(at); const nx = out.get(at); if (!nx?.length) break; at = nx.pop(); }
    if (at === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
})();
const RIM = LOOPS[1], N = RIM.length, BORDER = LOOPS[0];
const perimeter = loop => loop.reduce((s, v, i) => s + dist(P0, v, loop[(i + 1) % loop.length]), 0);
const PF = P0.slice(), DP = minimumArea(PF, RIM);
const triArea = (P, a, b, c) => Math.sqrt(area2(P, a, b, c)) / 2;
const areaOf = (P, T) => { let s = 0; for (let i = 0; i < T.length; i += 3) s += triArea(P, T[i], T[i + 1], T[i + 2]); return s; };
let FAN = 0; for (let i = 1; i + 1 < N; i++) FAN += triArea(P0, RIM[0], RIM[i], RIM[i + 1]);
const DP_AREA = areaOf(PF, DP);
const SIGMA = new Map();
for (let i = 0; i < N; i++) { const a = RIM[(i + N - 1) % N], b = RIM[i], c = RIM[(i + 1) % N]; SIGMA.set(b, (dist(PF, a, b) + dist(PF, b, c)) / 2); }
const RIMKEYS = new Set(); for (let i = 0; i < N; i++) RIMKEYS.add(key(RIM[i], RIM[(i + 1) % N]));
const ROUNDS = [], FILL = refine(PF, DP, SIGMA, RIMKEYS, ROUNDS);
const P_REFINED = PF.slice(), FRAMES = [];
fair(PF, FILL, new Set(RIM), FRAMES);
const FILL_AREA = areaOf(PF, FILL), ADDED = ROUNDS.reduce((n, r) => n + r.added.length, 0);

// ---- drawing --------------------------------------------------------------------------------------------------------
// An oblique view: x across, y into the page, z up.
const X = (x, y) => 22 + 31 * x + 5 * y, Y = (y, z) => 226 - 21 * y - 24 * z;
const f1 = v => Math.round(v * 10) / 10;
const L = (() => { const l = Math.hypot(-0.45, -0.55, 0.7); return [-0.45 / l, -0.55 / l, 0.7 / l]; })();
/** Lambert shade of a triangle (its normal turned up), as a share of the accent. */
function shade(P, a, b, c) {
  const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  return Math.round(14 + 40 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / l));
}
const pt = (P, v) => [X(P[3 * v], P[3 * v + 1]), Y(P[3 * v + 1], P[3 * v + 2])];
/** A triangle's path, shrunk towards its centre by g (1: as it is). */
function triPath(P, a, b, c, g = 1) {
  const q = [pt(P, a), pt(P, b), pt(P, c)], cx = (q[0][0] + q[1][0] + q[2][0]) / 3, cy = (q[0][1] + q[1][1] + q[2][1]) / 3;
  return q.map((p, i) => `${i ? 'L' : 'M'}${f1(cx + g * (p[0] - cx))} ${f1(cy + g * (p[1] - cy))}`).join('') + 'Z';
}
const depthOf = (P, T, t) => P[3 * T[3 * t] + 1] + P[3 * T[3 * t + 1] + 1] + P[3 * T[3 * t + 2] + 1];
const BASE_ORDER = Array.from({ length: NT }, (_, t) => t).sort((p, q) => depthOf(P0, T0, q) - depthOf(P0, T0, p));
const RANK = new Int32Array(NT); BASE_ORDER.forEach((t, i) => { RANK[t] = i; });
const BASE = BASE_ORDER.map(t => ({ t, shade: shade(P0, T0[3 * t], T0[3 * t + 1], T0[3 * t + 2]) }));
const SEG = (P, a, b) => { const p = pt(P, a), q = pt(P, b); return { x1: f1(p[0]), y1: f1(p[1]), x2: f1(q[0]), y2: f1(q[1]) }; };
const RIM_SEGS = RIM.map((v, i) => SEG(P0, v, RIM[(i + 1) % N])), BORDER_SEGS = BORDER.map((v, i) => SEG(P0, v, BORDER[(i + 1) % BORDER.length]));
const DEGEN = SEG(P0, DEGENERATE[0], DEGENERATE[1]);
const DUP = triPath(P0, T0[3 * DUPLICATE], T0[3 * DUPLICATE + 1], T0[3 * DUPLICATE + 2]);

const steps = [
  { label: 'A triangle soup comes in', text: `An STL file gives each triangle its own three corners: here ${NT + 2} triangles, ${CORNERS} corners, nothing shared. Three triangles are wound the other way (red), one has a corner twice (the red line: no area) and one is in the file twice (the dashed outline). <code>diagnoseMesh</code> reports all of this and changes nothing; <code>repairMesh</code> runs explicit steps and returns new arrays with a report of each.` },
  { label: 'Weld: close corners become one vertex', text: `Each corner falls in a cell of the weld size w and joins the vertex that owns that cell. A corner whose own cell is empty looks in the seven neighbouring cells on its side for a vertex within w, and otherwise owns the cell itself, keeping its position. Here ${CORNERS - NV} corners join others: ${CORNERS} corners, ${NV} vertices.`, formula: 'cell = (round(x / w), round(y / w), round(z / w)) · w = 10⁻⁶ × the largest |coordinate|, at least 10⁻⁹ mm (here 10⁻⁵ mm)' },
  { label: 'Drop what has no area, and repeats', text: 'After the weld, a triangle with a repeated corner or no area at the weld size is dropped, and so is the same three corners a second time, either way round (the first is kept). Here one of each.', formula: 'dropped when a = b, b = c, a = c or |(b − a) × (c − a)| ≤ w · degenerate 1 · duplicates 1' },
  { label: 'Orient: one way across every edge', text: `Breadth first from the first triangle, across each edge shared by two triangles: the neighbour must run that edge the other way, or it is turned. ${INCONSISTENT} edges ran the same way both sides; three triangles are turned back. A closed piece is then turned outward if its signed volume is negative; this sheet is open, so that pass leaves it.`, formula: 'flip(u) = flip(t) XOR [t and u run their shared edge the same way]' },
  { label: 'Find the holes', text: `Edges with one triangle are joined end to end into loops. This sheet has two: its outer border (${BORDER.length} edges, hole 0) and the hole (${N} edges, ${num(perimeter(RIM), 2)} mm round, hole 1). The diagnosis lists each with its edges, perimeter and centre; this call fills hole 1 only (<code>fill: { skip: [0] }</code>), so the border stays open.` },
  { label: 'The least-area triangulation of the rim', text: `Dynamic programming over the rim's ${N} corners, as Liepa's fill does: the best triangulation of corners i … j is the best split at a corner k between them. Its area here is ${num(DP_AREA, 2)} mm²; a fan from corner 0 would be ${num(FAN, 2)} mm². O(n³), for rims up to 120 corners; a longer rim is ear-clipped in its best-fitting plane (Newell's normal).`, formula: 'W(i, j) = min<sub>i&lt;k&lt;j</sub> W(i, k) + W(k, j) + area(i, k, j) · W(i, i+1) = 0' },
  { label: 'Refine to the rim\'s density, relax by flips', text: `Each rim corner has a density σ, the mean length of its two rim edges. A patch triangle whose centre is farther from each corner than both densities allow is split at its centre into three; after each round, an inner edge whose two opposite angles add to more than π is flipped (Delaunay). Here ${ROUNDS.length} rounds add ${ADDED} vertices: ${DP.length / 3} → ${FILL.length / 3} triangles.`, formula: 'split when √2 · |c − v<sub>i</sub>| &gt; σ<sub>c</sub> and &gt; σ(v<sub>i</sub>) for each corner · σ<sub>c</sub> = mean of the corners\' σ' },
  { label: 'Fair the patch into its rim', text: `The new vertices are smoothed: each moved to the mean of its neighbours, 30 rounds, the rim fixed. The patch's ${FILL.length / 3} triangles go into the mesh with their hole's number in <code>fill</code>, so they can be shown and kept as a face of their own. Report: holes filled 1 (${FILL.length / 3} triangles, ${num(FILL_AREA, 2)} mm²), holes left 1, closed false.`, formula: 'v ← (1 / |N(v)|) Σ<sub>u ∈ N(v)</sub> u, 30 times, for each new vertex v' },
];
const s = useSteps(steps.length, [2800, 2600, 2200, 3400, 3000, 3400, 5200, 3200], root);
const e = computed(() => ease(s.t.value));

const gap = computed(() => s.step.value === 0 ? 0.8 : s.step.value === 1 ? 0.8 + 0.2 * e.value : 1);
const base = computed(() => {
  const st = s.step.value, g = gap.value, shown = st === 0 ? Math.floor(e.value * (NT + 0.99)) : NT;
  return BASE.filter(b => st > 0 || RANK[b.t] < shown).map(b => {
    const turned = FLIPPED.includes(b.t), wrong = turned && (st < 3 || (st === 3 && VISIT[b.t] / NT > e.value)), seen = st === 3 && VISIT[b.t] / NT <= e.value;
    return { t: b.t, d: triPath(P0, T0[3 * b.t], T0[3 * b.t + 1], T0[3 * b.t + 2], g), fill: wrong ? null : `color-mix(in srgb, var(--a) ${b.shade + (seen ? 14 : 0)}%, var(--vp-c-bg))`, wrong, seen };
  });
});
const extrasOpacity = computed(() => s.step.value < 2 ? 1 : s.step.value === 2 ? 1 - e.value : 0);
/** The fill's triangles at this step: their corners' positions and their triangles. */
const patch = computed(() => {
  const st = s.step.value;
  if (st < 5) return { tris: [], P: null, fresh: new Set() };
  let P = P_REFINED, T = DP, count = DP.length / 3, fresh = new Set();
  if (st === 5) count = Math.floor(e.value * (DP.length / 3 + 0.99));
  else if (st === 6) {
    const half = Math.min(2 * ROUNDS.length - 1, Math.floor(s.t.value * 2 * ROUNDS.length)), r = ROUNDS[half >> 1];
    T = s.t.value >= 1 ? FILL : half % 2 ? r.relaxed : r.split; count = T.length / 3;
    if (half % 2 === 0 && s.t.value < 1) fresh = new Set(r.added);
  } else { T = FILL; count = T.length / 3; P = FRAMES[Math.min(29, Math.floor(e.value * 30))]; if (s.t.value <= 0) P = P_REFINED; }
  const out = [];
  for (let t = 0; t < count; t++) out.push({ d: triPath(P, T[3 * t], T[3 * t + 1], T[3 * t + 2]), fill: `color-mix(in srgb, var(--b) ${shade(P, T[3 * t], T[3 * t + 1], T[3 * t + 2]) + 6}%, var(--vp-c-bg))` });
  return { tris: out, P, fresh };
});
const newPoints = computed(() => {
  const st = s.step.value;
  if (st < 6 || !patch.value.P) return [];
  const P = patch.value.P, out = [];
  for (let v = NV; v < P.length / 3; v++) { if (st === 6 && s.t.value < 1 && !ROUNDS.some((r, i) => i <= Math.floor(s.t.value * ROUNDS.length) && r.added.includes(v))) continue; const q = pt(P, v); out.push({ v, x: q[0], y: q[1], fresh: patch.value.fresh.has(v) }); }
  return out;
});
const rimShown = computed(() => s.step.value === 4 ? Math.floor(e.value * (N + 0.99)) : s.step.value > 4 ? N : 0);
const counts = computed(() => {
  const st = s.step.value;
  if (st === 0) return `${NT + 2} triangles · ${CORNERS} corners`;
  if (st === 1) return `${CORNERS} corners → ${Math.round(CORNERS - e.value * (CORNERS - NV))} vertices`;
  if (st === 2) return `${NV} vertices · ${NT + 2} → ${NT} triangles`;
  if (st === 3) return `turned back: ${FLIPPED.filter(t => VISIT[t] / NT <= e.value).length} of 3`;
  if (st === 4) return `holes: 2 · hole 1: ${N} edges, ${num(perimeter(RIM), 2)} mm`;
  if (st === 5) return `patch ${patch.value.tris.length} of ${DP.length / 3} triangles · ${num(DP_AREA, 2)} mm² (fan ${num(FAN, 2)})`;
  if (st === 6) return `patch ${patch.value.tris.length} triangles`;
  return `patch ${FILL.length / 3} triangles · ${num(st === 7 && s.t.value < 1 ? areaOf(patch.value.P, FILL) : FILL_AREA, 2)} mm²`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Repairing a mesh: weld, orient, fill a hole" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A terrain sheet brought in as a triangle soup, welded, cleaned, oriented, and its hole filled by a least-area triangulation, refined and faired">
        <path v-for="b in base" :key="'t' + b.t" :d="b.d" class="tri" :class="{ wrong: b.wrong }" :style="b.fill ? { fill: b.fill } : null" />
        <g :opacity="extrasOpacity">
          <line :x1="DEGEN.x1" :y1="DEGEN.y1" :x2="DEGEN.x2" :y2="DEGEN.y2" class="degen" />
          <path :d="DUP" class="dup" />
        </g>
        <path v-for="(p, i) in patch.tris" :key="'p' + i" :d="p.d" class="fill" :style="{ fill: p.fill }" />
        <g v-if="s.step.value >= 4">
          <line v-for="(g, i) in BORDER_SEGS" :key="'o' + i" v-bind="g" class="border" />
          <line v-for="(g, i) in RIM_SEGS.slice(0, rimShown)" :key="'r' + i" v-bind="g" class="rim" />
        </g>
        <circle v-for="p in newPoints" :key="'n' + p.v" :cx="p.x" :cy="p.y" :r="p.fresh ? 3 : 2" class="newpt" :class="{ fresh: p.fresh }" />
        <g class="readout"><text x="12" y="18">{{ counts }}</text></g>
        <g v-if="s.step.value === 4" class="legend">
          <line x1="12" y1="34" x2="30" y2="34" class="rim" /><text x="35" y="37">hole 1, filled</text>
          <line x1="112" y1="34" x2="130" y2="34" class="border" /><text x="135" y="37">hole 0, the border (skipped)</text>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's fill code (copied), on a sheet z = 1.6 e<sup>−r²/5</sup> plus a
        small ripple, drawn in an oblique view, x across, y into the page, z up. The built kernel's <code>repairMesh</code>
        on the same soup gives the same counts and the same 34 fill triangles. The soup's gaps between triangles are drawn
        wide; the corners in the file are within 2 × 10⁻⁶ mm of each other.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); }
.legend text { font-size: 10px; }
.tri { stroke: var(--vp-c-bg); stroke-width: 0.6; stroke-linejoin: round; }
.tri.wrong { fill: color-mix(in srgb, var(--hot) 55%, var(--vp-c-bg)); }
.degen { stroke: var(--hot); stroke-width: 2.2; stroke-linecap: round; }
.dup { fill: none; stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 3 2; }
.border { stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: 3 2; }
.rim { stroke: var(--hot); stroke-width: 2; stroke-linecap: round; }
.fill { stroke: var(--vp-c-text-2); stroke-width: 0.7; stroke-linejoin: round; }
.newpt { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 0.8; }
.newpt.fresh { fill: var(--hot); }
</style>
