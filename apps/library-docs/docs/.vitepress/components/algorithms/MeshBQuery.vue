<script setup>
// The hierarchy's two queries (triangle-bvh.ts `rayHit`, `nearestDistance2`, K2, D141) on the 28 ring triangles of the
// build figure, flat in the page. The tree is built as the kernel builds it; the descents follow the kernel's: the
// ray's slab test (lo, hi), its stack taking the second child first, a box skipped when the ray misses it or enters it
// beyond the best hit; the nearest point's box distance, the nearer child first, a box skipped when it is no nearer
// than the best. In 2D a ray meets a triangle's edges; in the kernel it pierces the triangle (Möller–Trumbore).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const root = ref(null);
const SEG = 14, P = [], I = [];
for (let k = 0; k < SEG; k++) {
  const a = 2 * Math.PI * k / SEG + 0.1, ri = 3 + 0.5 * Math.sin(2 * a + 0.4), ro = ri + 1 + 0.3 * Math.cos(3 * a);
  P.push(1.55 * ri * Math.cos(a), ri * Math.sin(a), 1.55 * ro * Math.cos(a), ro * Math.sin(a));
}
for (let k = 0; k < SEG; k++) { const a = 2 * k, b = 2 * k + 1, c = 2 * ((k + 1) % SEG), d = c + 1; I.push(a, c, b, b, c, d); }
const NT = I.length / 3;
// The kernel's build (as in the build figure): corner boxes, longest side, quickselect to the median, leaves of ≤ 4.
const CX = new Float64Array(2 * NT), ORDER = new Uint32Array(NT), BOX = [], LEFT = [], START = [], COUNT = [];
for (let t = 0; t < NT; t++) { ORDER[t] = t; for (let k = 0; k < 2; k++) CX[2 * t + k] = (P[2 * I[3 * t] + k] + P[2 * I[3 * t + 1] + k] + P[2 * I[3 * t + 2] + k]) / 3; }
function select(axis, lo, hi, k) {
  while (hi > lo) {
    const pivot = CX[2 * ORDER[(lo + hi) >> 1] + axis];
    let i = lo, j = hi;
    while (i <= j) {
      while (CX[2 * ORDER[i] + axis] < pivot) i++;
      while (CX[2 * ORDER[j] + axis] > pivot) j--;
      if (i <= j) { const x = ORDER[i]; ORDER[i] = ORDER[j]; ORDER[j] = x; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return;
  }
}
{
  const todo = [[0, 0, NT]]; let nodes = 1;
  while (todo.length) {
    const [n, s, c] = todo.pop(); START[n] = s; COUNT[n] = c; LEFT[n] = -1;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = s; i < s + c; i++) for (let v = 0; v < 3; v++) { const p = 2 * I[3 * ORDER[i] + v]; x0 = Math.min(x0, P[p]); y0 = Math.min(y0, P[p + 1]); x1 = Math.max(x1, P[p]); y1 = Math.max(y1, P[p + 1]); }
    BOX[n] = [x0, y0, x1, y1];
    if (c <= 4) continue;
    const ax = x1 - x0 >= y1 - y0 ? 0 : 1, half = c >> 1;
    select(ax, s, s + c - 1, s + half);
    LEFT[n] = nodes; nodes += 2;
    todo.push([LEFT[n], s, half], [LEFT[n] + 1, s + half, c - half]);
  }
}
const NN = BOX.length;

/** The ray o + t·d against triangle `tri`'s edges (2D): the least t > 10⁻⁶, or Infinity. */
function triRay(tri, o, d) {
  let best = Infinity;
  for (let e = 0; e < 3; e++) {
    const a = 2 * I[3 * tri + e], b = 2 * I[3 * tri + (e + 1) % 3], ex = P[b] - P[a], ey = P[b + 1] - P[a + 1];
    const den = d[0] * ey - d[1] * ex; if (Math.abs(den) < 1e-14) continue;
    const wx = P[a] - o[0], wy = P[a + 1] - o[1], t = (wx * ey - wy * ex) / den, s = (wx * d[1] - wy * d[0]) / den;
    if (s >= 0 && s <= 1 && t > 1e-6 && t < best) best = t;
  }
  return best;
}
/** rayHit's descent, every box test and triangle test recorded in order. */
function rayTrace(o, d) {
  const ev = [], stack = [0]; let best = Infinity;
  while (stack.length) {
    const n = stack.pop(), [x0, y0, x1, y1] = BOX[n];
    let lo = -Infinity, hi = Infinity;
    // (An axis d does not move along is tested by comparison, as the kernel does.)
    if (d[0] === 0) { if (o[0] < x0 || o[0] > x1) { ev.push({ n, kind: 'miss' }); continue; } } else { const a = (x0 - o[0]) / d[0], b = (x1 - o[0]) / d[0]; lo = Math.min(a, b); hi = Math.max(a, b); }
    if (d[1] === 0) { if (o[1] < y0 || o[1] > y1) { ev.push({ n, kind: 'miss' }); continue; } } else { const a = (y0 - o[1]) / d[1], b = (y1 - o[1]) / d[1]; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }
    if (!(hi >= Math.max(lo, 0))) { ev.push({ n, kind: 'miss' }); continue; }
    if (lo > best) { ev.push({ n, kind: 'far' }); continue; }
    ev.push({ n, kind: 'in' });
    if (LEFT[n] >= 0) { stack.push(LEFT[n], LEFT[n] + 1); continue; }
    for (let i = START[n]; i < START[n] + COUNT[n]; i++) { const tri = ORDER[i], t = triRay(tri, o, d); if (t < best) best = t; ev.push({ n, kind: 'tri', tri, best }); }
  }
  return ev;
}
function seg(px, py, a, b, out) {
  const ax = P[a], ay = P[a + 1], ex = P[b] - ax, ey = P[b + 1] - ay, s = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  const qx = ax + s * ex, qy = ay + s * ey, d = (px - qx) ** 2 + (py - qy) ** 2;
  if (d < out[0]) { out[0] = d; out[1] = qx; out[2] = qy; }
}
/** The squared distance from (px, py) to triangle `tri` (0 inside it), and its nearest point. */
function triNear(tri, px, py) {
  const a = 2 * I[3 * tri], b = 2 * I[3 * tri + 1], c = 2 * I[3 * tri + 2];
  const s1 = (P[b] - P[a]) * (py - P[a + 1]) - (P[b + 1] - P[a + 1]) * (px - P[a]), s2 = (P[c] - P[b]) * (py - P[b + 1]) - (P[c + 1] - P[b + 1]) * (px - P[b]), s3 = (P[a] - P[c]) * (py - P[c + 1]) - (P[a + 1] - P[c + 1]) * (px - P[c]);
  if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return [0, px, py];
  const out = [Infinity, px, py]; seg(px, py, a, b, out); seg(px, py, b, c, out); seg(px, py, c, a, out);
  return out;
}
const box2 = (n, x, y) => { const [x0, y0, x1, y1] = BOX[n], dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); return dx * dx + dy * dy; };
/** nearestDistance2's descent: a box no nearer than the best is skipped; of two children the nearer is searched first. */
function nearTrace(x, y) {
  const ev = [], stack = [0]; let best = Infinity, at = [x, y];
  while (stack.length) {
    const n = stack.pop();
    if (box2(n, x, y) >= best) { ev.push({ n, kind: 'far' }); continue; }
    ev.push({ n, kind: 'in' });
    const l = LEFT[n];
    if (l < 0) {
      for (let i = START[n]; i < START[n] + COUNT[n]; i++) { const tri = ORDER[i], r = triNear(tri, x, y); if (r[0] < best) { best = r[0]; at = [r[1], r[2]]; } ev.push({ n, kind: 'tri', tri, best, at }); }
      continue;
    }
    const r = l + 1, dl = box2(l, x, y), dr = box2(r, x, y);
    // (The nearer child pushed last, so taken first; a child no nearer than the best is not pushed.)
    const [far, near, dfar, dnear] = dl < dr ? [r, l, dr, dl] : [l, r, dl, dr];
    if (dfar < best) stack.push(far); else ev.push({ n: far, kind: 'far' });
    if (dnear < best) stack.push(near); else ev.push({ n: near, kind: 'far' });
  }
  return ev;
}
/** The state after the first k events: each box's last verdict, the triangles tested, the best so far. */
function stateOf(ev, k) {
  const box = new Array(NN).fill(''), tested = new Set();
  let best = Infinity, bestTri = -1, at = null;
  for (let i = 0; i < Math.min(k, ev.length); i++) {
    const x = ev[i];
    if (x.kind === 'tri') { tested.add(x.tri); if (x.best < best) { best = x.best; bestTri = x.tri; at = x.at ?? null; } }
    else box[x.n] = x.kind;
  }
  return { box, tested, best, bestTri, at, boxes: ev.filter((x, i) => i < k && x.kind !== 'tri').length, tris: tested.size };
}

const X = x => 190 + 22 * (x - 0.44), Y = y => 100 - 22 * (y + 0.11);
const f1 = v => Math.round(v * 10) / 10;
const TRIS = Array.from({ length: NT }, (_, t) => [0, 1, 2].map(k => `${f1(X(P[2 * I[3 * t + k]]))},${f1(Y(P[2 * I[3 * t + k] + 1]))}`).join(' '));
const RECTS = BOX.map(b => ({ x: X(b[0]), y: Y(b[3]), w: X(b[2]) - X(b[0]), h: Y(b[1]) - Y(b[3]) }));
const O = [7.8, 2.4], A0 = Math.PI + 0.3, dirOf = a => [Math.cos(a), Math.sin(a)];
const RAY0 = rayTrace(O, dirOf(A0));
const FIRST_TRI = RAY0.findIndex(x => x.kind === 'tri');
let LAST_RUN = FIRST_TRI; while (LAST_RUN + 1 < RAY0.length && RAY0[LAST_RUN + 1].kind === 'tri') LAST_RUN++;
const Q0 = [-0.8, 1.2], NEAR0 = nearTrace(...Q0);
const qPath = u => [-0.8 * Math.cos(2 * Math.PI * u) + 6.2 * Math.sin(2 * Math.PI * u), 1.2 * Math.cos(2 * Math.PI * u) + 2.6 * Math.sin(4 * Math.PI * u)];
// The slab test on the root, for the first step: where the ray crosses each axis's two planes.
const D0 = dirOf(A0), RB = BOX[0];
const SLAB = (() => {
  const tx = [(RB[0] - O[0]) / D0[0], (RB[2] - O[0]) / D0[0]].sort((a, b) => a - b), ty = [(RB[1] - O[1]) / D0[1], (RB[3] - O[1]) / D0[1]].sort((a, b) => a - b);
  return { tx, ty, lo: Math.max(tx[0], ty[0]), hi: Math.min(tx[1], ty[1]) };
})();
const onRay = t => [X(O[0] + t * D0[0]), Y(O[1] + t * D0[1])];

const steps = [
  { label: 'A ray meets a box: the slab test', text: 'A query starts at the root. The ray o + t·d crosses each axis\'s pair of box planes at two values of t. It is inside the box from the latest entry (lo) to the earliest exit (hi). An axis d does not move along is tested by comparing o with the box instead, so no 0 · ∞ appears.', formula: `t = (box − o) / d per axis · lo = max(entries) = ${SLAB.lo.toFixed(2)}, hi = min(exits) = ${SLAB.hi.toFixed(2)}` },
  { label: 'Down the tree', text: 'A box the ray enters puts its two children on an explicit stack, and the second child is taken first. A box the ray misses is skipped with all its triangles. The order is fixed: the children are not sorted along the ray.', formula: 'enter when hi ≥ max(lo, 0) and lo ≤ best' },
  { label: 'The nearest hit so far', text: 'In a leaf each triangle is tested. In 3D the kernel uses Möller–Trumbore: a hit at t beyond <code>minT</code> (10<sup>−6</sup>) counts, edges included; a triangle whose determinant is within 10<sup>−14</sup> of zero, the ray in its plane, is passed. The least t found is the best so far.', formula: 'best = min(best, t) for t &gt; minT' },
  { label: 'Boxes beyond the best are skipped', text: 'The other boxes still on the stack are tested against the best: a box the ray enters only after the best hit cannot hold a nearer one, so it is skipped unopened.', formula: 'skip when lo &gt; best' },
  { label: 'Turn the ray', text: 'The work follows the ray: few boxes and triangles near its path are read, and a ray that misses the root reads nothing else. The query allocates nothing; its stack is one typed array kept between calls, grown only when it runs out.' },
  { label: 'Nearest point: a box\'s distance', text: 'The second query asks for the squared distance from a point to the mesh\'s surface. Every box gets a lower bound: the point\'s squared distance to the box, 0 when the point is inside it. No triangle in the box can be nearer than that.', formula: 'box2 = Σ max(lo<sub>k</sub> − p<sub>k</sub>, 0, p<sub>k</sub> − hi<sub>k</sub>)<sup>2</sup>' },
  { label: 'Nearer child first, then prune', text: 'Of a node\'s two children the nearer is searched first, so a small best is found early. A child no nearer than the best is not searched; nor is a box on the stack once the best has shrunk below its distance. The circle is the best distance so far.', formula: 'skip when box2 ≥ best · in a leaf: best = min(best, |p − closest point of the triangle|<sup>2</sup>)' },
  { label: 'Move the point', text: 'The same search at every point. The mesh distance runs it from each vertex and triangle centre of one mesh to the other\'s surface; the mould and wall checks use it for the nearest surface within a radius.' },
];
const s = useSteps(steps.length, [3000, 2600, 2400, 2400, 8000, 2400, 4200, 9000], root);
const e = computed(() => ease(s.t.value));

const angle = computed(() => s.step.value === 4 ? A0 + 0.75 * Math.sin(2 * Math.PI * s.t.value) : A0);
const rayEv = computed(() => s.step.value === 4 ? rayTrace(O, dirOf(angle.value)) : RAY0);
const rayK = computed(() => {
  const st = s.step.value, n = RAY0.length;
  if (st === 0) return 0;
  if (st === 1) return Math.floor(e.value * (FIRST_TRI + 0.99));
  if (st === 2) return FIRST_TRI + Math.floor(e.value * (LAST_RUN - FIRST_TRI + 1.99));
  if (st === 3) return LAST_RUN + 1 + Math.floor(e.value * (n - LAST_RUN - 1 + 0.99));
  return rayEv.value.length;
});
const ray = computed(() => {
  const st = s.step.value, ev = rayEv.value, k = rayK.value, d = dirOf(angle.value), S = stateOf(ev, k);
  const tEnd = Number.isFinite(S.best) ? S.best : 16, grow = st === 0 ? Math.min(1, e.value / 0.5) : 1;
  return { ...S, x2: X(O[0] + tEnd * grow * d[0]), y2: Y(O[1] + tEnd * grow * d[1]), hit: Number.isFinite(S.best) ? [X(O[0] + S.best * d[0]), Y(O[1] + S.best * d[1])] : null };
});
const q = computed(() => s.step.value === 7 ? qPath(s.t.value) : Q0);
const nearEv = computed(() => s.step.value === 7 ? nearTrace(...q.value) : NEAR0);
const near = computed(() => {
  const st = s.step.value, ev = nearEv.value;
  const k = st === 5 ? 0 : st === 6 ? Math.floor(e.value * (ev.length + 0.99)) : ev.length;
  return stateOf(ev, k);
});
/** Step 6: the root's two children and the point's nearest point of each box. */
const childGaps = computed(() => [LEFT[0], LEFT[0] + 1].map(n => {
  const [x0, y0, x1, y1] = BOX[n], p = q.value, cx = Math.min(Math.max(p[0], x0), x1), cy = Math.min(Math.max(p[1], y0), y1);
  return { n, x: X(cx), y: Y(cy), d: Math.sqrt(box2(n, p[0], p[1])) };
}));
const isRay = computed(() => s.step.value <= 4);
const slabShown = computed(() => s.step.value === 0 && e.value > 0.5);
const readout = computed(() => {
  if (isRay.value) {
    const r = ray.value;
    if (s.step.value === 0) return `root: lo ${SLAB.lo.toFixed(2)}, hi ${SLAB.hi.toFixed(2)} · hi ≥ max(lo, 0): entered`;
    return `boxes tested ${r.boxes} of ${NN} · triangles tested ${r.tris} of ${NT} · ${Number.isFinite(r.best) ? `best t = ${r.best.toFixed(3)}` : 'no hit'}`;
  }
  const n = near.value;
  if (s.step.value === 5) return `box distances: node ${childGaps.value[0].n} ${childGaps.value[0].d.toFixed(2)}, node ${childGaps.value[1].n} ${childGaps.value[1].d.toFixed(2)}`;
  return `boxes tested ${n.boxes} of ${NN} · triangles tested ${n.tris} of ${NT} · ${Number.isFinite(n.best) ? `distance ${Math.sqrt(n.best).toFixed(3)}` : '…'}`;
});
const boxState = computed(() => (isRay.value ? ray.value : near.value).box);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Queries: the nearest ray hit and the nearest point" :steps="steps" :s="s">
      <svg viewBox="0 0 380 240" role="img" aria-label="A ray and a point searched through the box hierarchy of a ring of triangles, boxes skipped by their bounds">
        <polygon v-for="(tr, t) in TRIS" :key="'t' + t" :points="tr" class="tri" :class="{ tested: (isRay ? ray : near).tested.has(t), best: (isRay ? ray : near).bestTri === t }" />
        <template v-for="(r, n) in RECTS" :key="'b' + n">
          <rect v-if="boxState[n] || (s.step.value === 0 && n === 0) || (s.step.value === 5 && n <= 2)" :x="r.x" :y="r.y" :width="r.w" :height="r.h" class="box" :class="boxState[n] || 'plain'" />
        </template>
        <!-- the ray -->
        <g v-if="isRay">
          <g v-if="slabShown">
            <line v-for="(x, i) in [RB[0], RB[2]]" :key="'sx' + i" :x1="X(x)" y1="8" :x2="X(x)" y2="196" class="slab" />
            <line v-for="(y, i) in [RB[1], RB[3]]" :key="'sy' + i" x1="30" :y1="Y(y)" x2="370" :y2="Y(y)" class="slab" />
            <circle v-for="(t, i) in [...SLAB.tx, ...SLAB.ty]" :key="'m' + i" :cx="onRay(t)[0]" :cy="onRay(t)[1]" r="2.6" class="mark" />
            <circle :cx="onRay(SLAB.lo)[0]" :cy="onRay(SLAB.lo)[1]" r="4" class="lohi" />
            <circle :cx="onRay(SLAB.hi)[0]" :cy="onRay(SLAB.hi)[1]" r="4" class="lohi" />
            <text :x="onRay(SLAB.lo)[0] - 4" :y="onRay(SLAB.lo)[1] - 7" text-anchor="end" class="lab a">lo</text>
            <text :x="onRay(SLAB.hi)[0] - 4" :y="onRay(SLAB.hi)[1] + 15" class="lab a">hi</text>
          </g>
          <line :x1="X(O[0])" :y1="Y(O[1])" :x2="ray.x2" :y2="ray.y2" class="ray" />
          <circle :cx="X(O[0])" :cy="Y(O[1])" r="3.5" class="origin" />
          <text :x="X(O[0]) + 3" :y="Y(O[1]) + 15" class="lab">o</text>
          <circle v-if="ray.hit && s.step.value >= 2" :cx="ray.hit[0]" :cy="ray.hit[1]" r="4" class="hit" />
        </g>
        <!-- the point -->
        <g v-else>
          <g v-if="s.step.value === 5">
            <line v-for="g in childGaps" :key="'g' + g.n" :x1="X(q[0])" :y1="Y(q[1])" :x2="g.x" :y2="g.y" class="gap" />
            <text v-for="g in childGaps" :key="'gt' + g.n" :x="g.x + 3" :y="g.y - 4" class="lab b">{{ g.d.toFixed(2) }}</text>
          </g>
          <circle v-if="s.step.value >= 6 && Number.isFinite(near.best) && near.best > 0" :cx="X(q[0])" :cy="Y(q[1])" :r="Math.max(0, 22 * Math.sqrt(near.best))" class="reach" />
          <line v-if="s.step.value >= 6 && near.at" :x1="X(q[0])" :y1="Y(q[1])" :x2="X(near.at[0])" :y2="Y(near.at[1])" class="gap" />
          <circle v-if="s.step.value >= 6 && near.at" :cx="X(near.at[0])" :cy="Y(near.at[1])" r="3.4" class="hit" />
          <circle :cx="X(q[0])" :cy="Y(q[1])" r="4" class="point" />
          <text :x="X(q[0]) + 6" :y="Y(q[1]) - 6" class="lab">p</text>
        </g>
        <g class="legend">
          <rect x="16" y="203" width="10" height="10" rx="2" class="box in" /><text x="30" y="212" class="lab small">entered</text>
          <g v-if="isRay"><rect x="84" y="203" width="10" height="10" rx="2" class="box miss" /><text x="98" y="212" class="lab small">missed</text></g>
          <rect :x="isRay ? 146 : 84" y="203" width="10" height="10" rx="2" class="box far" /><text :x="isRay ? 160 : 98" y="212" class="lab small">{{ isRay ? 'beyond the best' : 'no nearer than the best' }}</text>
          <rect x="282" y="203" width="10" height="10" rx="2" class="tri tested" /><text x="296" y="212" class="lab small">tested</text>
        </g>
        <text x="16" y="232" class="readout">{{ readout }}</text>
      </svg>
      <template #note>A 2D picture: the triangles are flat in the page, so the ray meets their edges and the boxes have two
        sides; in the kernel the boxes have three and the ray pierces triangles. The tree and both descents are the
        kernel's for these triangles; the distances are the plane's.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.tri { fill: color-mix(in srgb, var(--a) 8%, var(--vp-c-bg)); stroke: var(--vp-c-text-3); stroke-width: 0.7; stroke-linejoin: round; transition: fill .2s; }
.tri.tested { fill: color-mix(in srgb, var(--b) 34%, var(--vp-c-bg)); }
.tri.best { fill: color-mix(in srgb, var(--hot) 40%, var(--vp-c-bg)); }
.box { fill: none; stroke-width: 1.1; }
.box.plain { stroke: var(--vp-c-text-2); stroke-width: 1.4; }
.box.in { stroke: var(--a); stroke-width: 1.5; }
.box.miss { stroke: var(--vp-c-text-3); stroke-dasharray: 2 2; }
.box.far { stroke: var(--hot); stroke-dasharray: 5 3; stroke-width: 1.4; }
.legend .box { fill: var(--vp-c-bg); }
.slab { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 3; }
.mark { fill: var(--vp-c-bg); stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.lohi { fill: var(--a); stroke: var(--vp-c-bg); stroke-width: 1; }
.ray { stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.origin { fill: var(--vp-c-text-1); }
.hit { fill: var(--hot); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.point { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.5; }
.gap { stroke: var(--keep); stroke-width: 1.2; stroke-dasharray: 3 2; }
.reach { fill: color-mix(in srgb, var(--keep) 10%, transparent); stroke: var(--keep); stroke-width: 1.2; }
.lab { font-size: 10px; font-weight: 600; }
.lab.a { fill: var(--a); } .lab.b { fill: var(--b); }
.lab.small { font-weight: 500; }
.readout { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
</style>
