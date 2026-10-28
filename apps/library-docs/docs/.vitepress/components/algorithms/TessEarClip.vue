<script setup>
// A planar face with a hole, triangulated as brep-tessellate.ts `triangulatePolygonWithHoles` does: the hole bridged
// from its rightmost point to the nearest ring point that passes, then ears clipped, the first that passes in ring
// order each time. The function below is that method for one hole, without the kernel's point grid (which only
// skips points that cannot be in an ear); its triangles were checked to be the kernel's, index for index, by running
// both on this polygon (packages/barocss-cad/dist, triangulatePolygonWithHoles).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
// Outer ring counter-clockwise (a plate with a notch); the hole a regular hexagon, centre (7.9, 4.1), radius 1.4,
// clockwise, its points rounded to 3 decimals.
const outer = [[0, 0], [13, 0], [13, 3], [11, 8], [0, 8], [0, 5.1], [5.8, 4.3], [0, 3.5]];
const hole = [[9.3, 4.1], [8.6, 2.888], [7.2, 2.888], [6.5, 4.1], [7.2, 5.312], [8.6, 5.312]];

function triangulate(outer, hole) {
  const pts = [...outer, ...hole], n = outer.length, H = hole.map((_, i) => n + i);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const eps = 1e-12 * ((x1 - x0) ** 2 + (y1 - y0) ** 2 || 1);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const onSeg = (o, x, y) => turn(o, x, y) === 0 && Math.min(o[0], x[0]) <= y[0] && y[0] <= Math.max(o[0], x[0]) && Math.min(o[1], x[1]) <= y[1] && y[1] <= Math.max(o[1], x[1]);
  const crosses = (p, q, a, b) => {
    if (same(p, a) || same(p, b) || same(q, a) || same(q, b)) return false;
    const d1 = turn(a, b, p), d2 = turn(a, b, q), d3 = turn(p, q, a), d4 = turn(p, q, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return onSeg(p, q, a) || onSeg(p, q, b);
  };
  const inWedge = (A, V, B, P) => { const l1 = turn(A, V, P) > 0, l2 = turn(V, B, P) > 0; return turn(A, V, B) > 0 ? l1 && l2 : l1 || l2; };
  let ring = outer.map((_, i) => i);
  const mi = H.reduce((b, i) => pts[i][0] > pts[b][0] ? i : b, H[0]), M = pts[mi], at = H.indexOf(mi);
  const MA = pts[H[(at - 1 + H.length) % H.length]], MB = pts[H[(at + 1) % H.length]];
  const dist = ring.map(v => Math.hypot(pts[v][0] - M[0], pts[v][1] - M[1])), order = ring.map((_, k) => k).sort((a, b) => dist[a] - dist[b] || a - b);
  const tries = []; let chosen = -1;
  for (const k of order) {
    const V = pts[ring[k]], A = pts[ring[(k - 1 + ring.length) % ring.length]], B = pts[ring[(k + 1) % ring.length]];
    if (!inWedge(A, V, B, M) || !inWedge(MA, M, MB, V)) { tries.push({ v: ring[k], ok: false }); continue; }
    let blocked = false;
    for (let e = 0; e < ring.length && !blocked; e++) blocked = crosses(M, V, pts[ring[e]], pts[ring[(e + 1) % ring.length]]);
    for (let e = 0; e < H.length && !blocked; e++) blocked = crosses(M, V, pts[H[e]], pts[H[(e + 1) % H.length]]);
    tries.push({ v: ring[k], ok: !blocked });
    if (!blocked) { chosen = k; break; }
  }
  const rotated = [...H.slice(at), ...H.slice(0, at)];
  ring = [...ring.slice(0, chosen + 1), ...rotated, mi, ...ring.slice(chosen)];
  const bridged = [...ring];
  const inEar = (j, ia, ib, ic) => {
    const q = pts[j], a = pts[ia], b = pts[ib], c = pts[ic];
    if (j === ia || j === ib || j === ic || same(q, a) || same(q, b) || same(q, c)) return false;
    return turn(a, b, q) >= -eps && turn(b, c, q) >= -eps && turn(c, a, q) >= -eps;
  };
  const clips = [];
  while (ring.length > 3) {
    const tried = [];
    for (let k = 0; k < ring.length; k++) {
      const ia = ring[(k - 1 + ring.length) % ring.length], ib = ring[k], ic = ring[(k + 1) % ring.length];
      if (turn(pts[ia], pts[ib], pts[ic]) <= eps) { tried.push({ tri: [ia, ib, ic], by: -1 }); continue; }
      const by = ring.find(j => inEar(j, ia, ib, ic));
      if (by !== undefined) { tried.push({ tri: [ia, ib, ic], by }); continue; }
      clips.push({ tri: [ia, ib, ic], tried, ring: [...ring] }); ring.splice(k, 1); break;
    }
  }
  clips.push({ tri: [...ring], tried: [], ring: [...ring] });
  return { pts, mi, tries, bridged, clips };
}

const T = triangulate(outer, hole), P = T.pts, C = T.clips, N = C.length;
const X = x => 21 + 26 * x, Y = y => 222 - 26 * y;
const xy = i => `${X(P[i][0])},${Y(P[i][1])}`;
const poly = ids => ids.map(xy).join(' ');
const shoelace = r => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);
const outerArea = shoelace(outer), holeArea = -shoelace(hole);
const triArea = C.reduce((s, c) => s + shoelace(c.tri.map(i => P[i])), 0);
const regionPath = [outer, hole].map(r => 'M' + r.map(p => `${X(p[0])},${Y(p[1])}`).join('L') + 'Z').join('');
// Direction marks at each boundary segment's middle.
const arrows = [outer, hole].flatMap(r => r.map((p, i) => {
  const q = r[(i + 1) % r.length], mx = X((p[0] + q[0]) / 2), my = Y((p[1] + q[1]) / 2), a = Math.atan2(Y(q[1]) - Y(p[1]), X(q[0]) - X(p[0]));
  const at = (d, s) => `${mx + d * Math.cos(a) - s * Math.sin(a)},${my + d * Math.sin(a) + s * Math.cos(a)}`;
  return `M${at(5, 0)}L${at(-3, 3.6)}L${at(-3, -3.6)}Z`;
}));
const M = P[T.mi], reject = T.tries.find(x => !x.ok), bridgeTo = T.tries.find(x => x.ok).v;
// The bridged ring as a closed path, with its length, for the point that walks it.
const walk = [...T.bridged, T.bridged[0]].map(i => [X(P[i][0]), Y(P[i][1])]);
const cum = walk.reduce((a, p, i) => { a.push(i ? a[i - 1] + Math.hypot(p[0] - walk[i - 1][0], p[1] - walk[i - 1][1]) : 0); return a; }, []);
const walkAt = f => {
  const s = Math.max(0, Math.min(1, f)) * cum[cum.length - 1]; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return [walk[i - 1][0] + (walk[i][0] - walk[i - 1][0]) * u, walk[i - 1][1] + (walk[i][1] - walk[i - 1][1]) * u];
};
const where = i => `(${num(P[i][0])}, ${num(P[i][1])})`;
const blockedTry = C[1].tried[0];

const steps = [
  { label: 'The loops in the plane', text: 'A planar face\'s loops are rings of its edges\' samples, the same points its neighbours use. Each coedge adds its samples without the last (the next coedge starts there). The points are projected onto the plane\'s frame: e<sub>1</sub> along the surface\'s first direction, e<sub>2</sub> = n × e<sub>1</sub>, with n turned over for a reversed face. Then the outer ring runs counter-clockwise and a hole clockwise.', formula: '(x, y) = ((p − o)·e<sub>1</sub>, (p − o)·e<sub>2</sub>)' },
  { label: 'A bridge to the hole', text: 'Ear clipping works on a single ring, so each hole is joined to the ring first, rightmost hole first. From the hole\'s rightmost point M, ring points are tried nearest first. A bridge must leave M into the material, enter the ring point\'s inner wedge, and cross no segment of the ring, the hole or a hole still waiting. Here the nearest point lies behind the hole: its bridge would leave M into the hole, not the material, and is rejected. The next one passes.', formula: 'bridge M–V: M in V\'s wedge, V in M\'s wedge, no segment crossed' },
  { label: 'One ring', text: 'The hole is spliced in at V: the ring runs to V, across to M, round the hole clockwise, back to M and across to V again. The bridge is used once each way, so it bounds no area. M and V each appear twice. A hole that already touches the ring at a point is joined there, with no new segment.', formula: 'ring = … V, M, hole …, M, V … (8 + 6 + 2 = 16 points)' },
  { label: 'Finding an ear', text: 'An ear is three consecutive ring points a, b, c that turn left (convex at b) with no other ring point inside the triangle or on it. The search starts at the ring\'s first point each time and clips the first ear that passes. The second search here meets a hole point inside its first triangle and moves on.', formula: 'ear: turn(a, b, c) &gt; ε and no ring point q with turn(a, b, q), turn(b, c, q), turn(c, a, q) ≥ −ε<br>turn(o, a, b) = (a − o) × (b − o) · ε = 10<sup>−12</sup> × (box diagonal)<sup>2</sup>' },
  { label: 'Clip, and again', text: 'Each clip removes b from the ring and keeps the triangle a–b–c. A point that folds straight back (a zero-width spike, left where two curves touch) is cut off as a degenerate triangle, so every boundary segment stays in the mesh. The kernel looks up only the ring points in the grid cells under each ear, not every point.', formula: 'each clip: one triangle, one point fewer' },
  { label: 'Done', text: 'A ring of n points gives n − 2 triangles. Their areas add up to the face\'s exact polygon area, and every boundary segment is a side of exactly one triangle. A ring with no ear and no degenerate point left is refused.', formula: `${N} triangles = 16 − 2 · area ${num(triArea, 2)} = ${num(outerArea, 2)} − ${num(holeArea, 2)}` },
];
const s = useSteps(steps.length, [2600, 4400, 4400, 5600, 9000, 3000], root);
const e = computed(() => ease(s.t.value));
// The triangulation's state: triangles clipped, the one being shown (with how it is shown), and the ring left.
const state = computed(() => {
  const k = s.step.value, t = s.t.value;
  if (k < 3) return { done: 0, cur: null, ring: null };
  if (k === 3) {
    const p = Math.min(2, Math.floor(t * 3)), f = Math.min(1, (t * 3 - p) * 1.6);
    if (p === 0) return { done: 0, cur: { tri: C[0].tri, kind: 'clip', f }, ring: C[0].ring };
    if (p === 1) return { done: 1, cur: { tri: blockedTry.tri, kind: 'blocked', f, by: blockedTry.by }, ring: C[1].ring };
    return { done: 1, cur: { tri: C[1].tri, kind: 'clip', f }, ring: C[1].ring };
  }
  if (k === 4) {
    const span = (N - 2) * Math.min(0.999, e.value), c = 2 + Math.floor(span);
    return { done: c, cur: { tri: C[c].tri, kind: 'clip', f: Math.min(1, (span - (c - 2)) * 1.6) }, ring: C[c].ring, tried: C[c].tried.length };
  }
  return { done: N, cur: null, ring: null };
});
const bridgeEnd = (v, f) => [X(M[0] + (P[v][0] - M[0]) * f), Y(M[1] + (P[v][1] - M[1]) * f)];
const trying = computed(() => {
  if (s.step.value !== 1) return null;
  const t = s.t.value, first = t < 0.5, f = Math.min(1, ease(Math.min(1, ((first ? t : t - 0.5) / 0.5) * 1.4)));
  return { v: first ? reject.v : bridgeTo, ok: !first, end: bridgeEnd(first ? reject.v : bridgeTo, f), shown: f > 0.95 };
});
const walker = computed(() => s.step.value === 2 ? walkAt(e.value) : null);
const readout = computed(() => {
  const k = s.step.value, st = state.value;
  if (k === 0) return 'outer: 8 points, counter-clockwise · hole: 6 points, clockwise';
  if (k === 1) return trying.value.ok ? `next nearest ${where(bridgeTo)}: visible, in both wedges → the bridge` : `nearest ${where(reject.v)}: would leave M into the hole → rejected`;
  if (k === 2) return 'one ring of 16 points: M and V twice each';
  if (k === 3) return st.cur.kind === 'blocked' ? `ear at ${where(st.cur.tri[1])}: a hole point inside → passed over` : `ear at ${where(st.cur.tri[1])}: convex, empty → clipped`;
  if (k === 4) return `triangles ${st.done + 1} of ${N} · ring ${st.ring.length} points · ${st.tried} ear${st.tried === 1 ? '' : 's'} passed over first`;
  return `${N} triangles · every boundary segment a side of one of them`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A planar face: bridge the hole, clip the ears" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A plate outline with a hexagonal hole, joined by a bridge and cut into triangles one ear at a time">
        <path :d="regionPath" fill-rule="evenodd" class="region" :class="{ faint: state.ring || state.done }" />
        <polygon v-if="state.ring" :points="poly(state.ring)" class="left" />
        <polygon v-for="(c, i) in C.slice(0, state.done)" :key="'t' + i" :points="poly(c.tri)" class="tri" />
        <polygon v-if="state.cur" :points="poly(state.cur.tri)" class="cur" :class="state.cur.kind" :style="{ opacity: 0.25 + 0.75 * state.cur.f }" />
        <circle v-if="state.cur && state.cur.kind === 'blocked'" :cx="X(P[state.cur.by][0])" :cy="Y(P[state.cur.by][1])" :r="5 + 3 * state.cur.f" class="blocker" />
        <path :d="regionPath" class="edge" />
        <g v-if="s.step.value === 0" :style="{ opacity: e }"><path v-for="(a, i) in arrows" :key="'a' + i" :d="a" class="arrow" /></g>
        <template v-if="trying">
          <line v-if="trying.ok" :x1="X(M[0])" :y1="Y(M[1])" :x2="X(P[reject.v][0])" :y2="Y(P[reject.v][1])" class="try no" opacity="0.35" />
          <line :x1="X(M[0])" :y1="Y(M[1])" :x2="trying.end[0]" :y2="trying.end[1]" class="try" :class="trying.ok ? 'ok' : 'no'" />
          <circle :cx="X(P[trying.v][0])" :cy="Y(P[trying.v][1])" r="5" class="cand" :class="trying.ok ? 'ok' : 'no'" />
        </template>
        <line v-if="s.step.value >= 2 && s.step.value < 5" :x1="X(M[0])" :y1="Y(M[1])" :x2="X(P[bridgeTo][0])" :y2="Y(P[bridgeTo][1])" class="bridge" />
        <g v-if="s.step.value >= 1 && s.step.value <= 2">
          <circle :cx="X(M[0])" :cy="Y(M[1])" r="4.5" class="m" />
          <text :x="X(M[0]) - 4" :y="Y(M[1]) - 8" text-anchor="end" class="lab">M</text>
          <text v-if="s.step.value === 2" :x="X(P[bridgeTo][0]) + 7" :y="Y(P[bridgeTo][1]) + 4" class="lab">V</text>
        </g>
        <circle v-if="walker" :cx="walker[0]" :cy="walker[1]" r="5" class="walker" />
        <g v-if="s.step.value === 0" class="tag">
          <text :x="X(0.4)" :y="Y(7.3)">outer · counter-clockwise</text>
          <text :x="X(7.9)" :y="Y(6.05)" text-anchor="middle">hole · clockwise</text>
        </g>
        <text x="21" y="243" class="readout">{{ readout }}</text>
      </svg>
      <template #note>A face already flat in its plane, with an outer ring of 8 points and a hexagonal hole; a real face's
        rings are its edges' samples, arcs included. The steps and the triangles are the kernel's method for this input.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 12px; fill: var(--vp-c-text-2); }
.region { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: none; transition: opacity .3s; }
.region.faint { opacity: 0.35; }
.left { fill: color-mix(in srgb, var(--a) 12%, transparent); stroke: var(--a); stroke-width: 1; stroke-dasharray: 3 2; }
.edge { fill: none; stroke: var(--a); stroke-width: 2; stroke-linejoin: round; }
.arrow { fill: var(--a); }
.tri { fill: color-mix(in srgb, var(--keep) 20%, transparent); stroke: var(--keep); stroke-width: 1; stroke-linejoin: round; }
.cur { stroke-width: 2; stroke-linejoin: round; }
.cur.clip { fill: color-mix(in srgb, var(--keep) 45%, transparent); stroke: var(--keep); }
.cur.blocked { fill: color-mix(in srgb, var(--hot) 25%, transparent); stroke: var(--hot); stroke-dasharray: 4 3; }
.blocker { fill: none; stroke: var(--hot); stroke-width: 2; }
.try { stroke-width: 2; stroke-dasharray: 5 3; }
.try.ok { stroke: var(--keep); } .try.no { stroke: var(--hot); }
.cand { stroke: var(--vp-c-bg); stroke-width: 1.5; }
.cand.ok { fill: var(--keep); } .cand.no { fill: var(--hot); }
.bridge { stroke: var(--b); stroke-width: 2.2; }
.m { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 1.5; }
.lab { font-size: 12px; font-weight: 700; fill: var(--b); }
.walker { fill: var(--b); stroke: var(--vp-c-bg); stroke-width: 2; }
.tag text { font-size: 11px; fill: var(--a); font-weight: 600; }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
