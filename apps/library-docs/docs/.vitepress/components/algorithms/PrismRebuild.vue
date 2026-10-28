<script setup>
// From slabs to a B-rep (packages/barocss-cad/src/features/prismatic-solid.ts, `brepFromPrismatic`), for A ∪ B of the
// previous figure with B across A's side: A a 10 × 6 box from z = 0 to 4 (tag `a`), B a circle of radius 2 about (10, 3)
// from z = 2 to 6 (tag `b`). Everything drawn was taken from the built kernel (packages/barocss-cad/dist/index.js) by a
// script: the result's slabs (booleanPrismatic), each level's arrangement vertices (curveArrangementVertices) and caps
// (booleanCurveRegions 'difference' both ways), and from brepFromPrismatic's B-rep its 14 faces with their names, their
// loops (edges sampled by tessellateBrep, 8 segments a quarter turn) and mean normals, and its 20 horizontal edges.
// A face is labelled where a ray from it toward the viewer does not enter the solid again (prismaticContains on the ray).
// The drawing is an oblique parallel view; faces facing away from it are left out (the bottom caps are shown dashed).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const D = {"er":[0.876,0.482,0],"eu":[-0.288,0.523,0.802],"volume":277.699,"levels":[{"z":0,"vertices":[[0,0],[10,0],[10,6],[0,6]],"up":[],"down":[60]},{"z":2,"vertices":[[0,0],[10,0],[10,6],[10,1],[10,5],[0,6]],"up":[],"down":[6.283]},{"z":4,"vertices":[[0,0],[10,0],[10,1],[10,5],[12,3],[10,6],[0,6],[8,3]],"up":[53.717],"down":[]},{"z":6,"vertices":[[12,3],[8,3]],"up":[12.566],"down":[]}],"points":[[0,0],[10,0],[10,6],[0,6],[10,1],[10,5],[12,3],[8,3]],"pieces":[[[0,0,0],[10,0,0]],[[0,0,4],[10,0,4]],[[10,0,0],[10,1,0]],[[10,0,4],[10,1,4]],[[10,1,0],[10,5,0]],[[10,1,2],[10,5,2]],[[10,6,0],[10,5,0]],[[10,6,4],[10,5,4]],[[10,6,0],[0,6,0]],[[10,6,4],[0,6,4]],[[0,0,0],[0,6,0]],[[0,0,4],[0,6,4]],[[10,1,2],[10.39,1.038,2],[10.765,1.152,2],[11.111,1.337,2],[11.414,1.586,2],[11.663,1.889,2],[11.848,2.235,2],[11.962,2.61,2],[12,3,2]],[[10,1,6],[10.39,1.038,6],[10.765,1.152,6],[11.111,1.337,6],[11.414,1.586,6],[11.663,1.889,6],[11.848,2.235,6],[11.962,2.61,6],[12,3,6]],[[10,5,2],[10.39,4.962,2],[10.765,4.848,2],[11.111,4.663,2],[11.414,4.414,2],[11.663,4.111,2],[11.848,3.765,2],[11.962,3.39,2],[12,3,2]],[[10,5,6],[10.39,4.962,6],[10.765,4.848,6],[11.111,4.663,6],[11.414,4.414,6],[11.663,4.111,6],[11.848,3.765,6],[11.962,3.39,6],[12,3,6]],[[10,5,4],[9.61,4.962,4],[9.235,4.848,4],[8.889,4.663,4],[8.586,4.414,4],[8.337,4.111,4],[8.152,3.765,4],[8.038,3.39,4],[8,3,4]],[[10,5,6],[9.61,4.962,6],[9.235,4.848,6],[8.889,4.663,6],[8.586,4.414,6],[8.337,4.111,6],[8.152,3.765,6],[8.038,3.39,6],[8,3,6]],[[10,1,4],[9.61,1.038,4],[9.235,1.152,4],[8.889,1.337,4],[8.586,1.586,4],[8.337,1.889,4],[8.152,2.235,4],[8.038,2.61,4],[8,3,4]],[[10,1,6],[9.61,1.038,6],[9.235,1.152,6],[8.889,1.337,6],[8.586,1.586,6],[8.337,1.889,6],[8.152,2.235,6],[8.038,2.61,6],[8,3,6]]],"pieceOf":[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9],"slabs":[{"z0":0,"z1":2,"rings":[[[0,0],[10,0],[10,6],[0,6]]]},{"z0":2,"z1":4,"rings":[[[0,0],[10,0],[10,1],[10.39,1.038],[10.765,1.152],[11.111,1.337],[11.414,1.586],[11.663,1.889],[11.848,2.235],[11.962,2.61],[12,3],[11.962,3.39],[11.848,3.765],[11.663,4.111],[11.414,4.414],[11.111,4.663],[10.765,4.848],[10.39,4.962],[10,5],[10,6],[0,6]]]},{"z0":4,"z1":6,"rings":[[[12,3],[11.962,3.39],[11.848,3.765],[11.663,4.111],[11.414,4.414],[11.111,4.663],[10.765,4.848],[10.39,4.962],[10,5],[9.61,4.962],[9.235,4.848],[8.889,4.663],[8.586,4.414],[8.337,4.111],[8.152,3.765],[8.038,3.39],[8,3],[8.038,2.61],[8.152,2.235],[8.337,1.889],[8.586,1.586],[8.889,1.337],[9.235,1.152],[9.61,1.038],[10,1],[10.39,1.038],[10.765,1.152],[11.111,1.337],[11.414,1.586],[11.663,1.889],[11.848,2.235],[11.962,2.61]]]}],"faces":[{"name":"a.side2","kind":"wall","z0":0,"z1":4,"front":false,"shade":0,"anchor":[5,6,2],"rings":[[[10,6,0],[0,6,0],[0,6,4],[10,6,4]]],"seen":false},{"name":"a.side3","kind":"wall","z0":0,"z1":4,"front":false,"shade":0,"anchor":[0,3,2],"rings":[[[0,6,0],[0,0,0],[0,0,4],[0,6,4]]],"seen":false},{"name":"a.bottom","kind":"down","z0":0,"z1":0,"front":false,"shade":0,"anchor":[5,3,0],"rings":[[[0,0,0],[0,6,0],[10,6,0],[10,5,0],[10,1,0],[10,0,0]]],"seen":false},{"name":"a.side1#3","kind":"wall","z0":0,"z1":4,"front":true,"shade":0.302,"anchor":[10,5.5,2],"rings":[[[10,5,0],[10,6,0],[10,6,4],[10,5,4],[10,5,2]]],"seen":false},{"name":"a.side1#2","kind":"wall","z0":0,"z1":2,"front":true,"shade":0.302,"anchor":[10,2.4,0.7],"rings":[[[10,1,0],[10,5,0],[10,5,2],[10,1,2]]],"seen":true},{"name":"a.side0","kind":"wall","z0":0,"z1":4,"front":true,"shade":0.543,"anchor":[5,0,2],"rings":[[[0,0,0],[10,0,0],[10,0,4],[0,0,4]]],"seen":true},{"name":"b.side0#2","kind":"wall","z0":4,"z1":6,"front":false,"shade":0,"anchor":[8.586,4.414,5],"rings":[[[10,5,4],[9.61,4.962,4],[9.235,4.848,4],[8.889,4.663,4],[8.586,4.414,4],[8.337,4.111,4],[8.152,3.765,4],[8.038,3.39,4],[8,3,4],[8,3,6],[8.038,3.39,6],[8.152,3.765,6],[8.337,4.111,6],[8.586,4.414,6],[8.889,4.663,6],[9.235,4.848,6],[9.61,4.962,6],[10,5,6]]],"seen":false},{"name":"a.top","kind":"up","z0":4,"z1":4,"front":true,"shade":0.784,"anchor":[4,3,4],"rings":[[[0,0,4],[10,0,4],[10,1,4],[9.61,1.038,4],[9.235,1.152,4],[8.889,1.337,4],[8.586,1.586,4],[8.337,1.889,4],[8.152,2.235,4],[8.038,2.61,4],[8,3,4],[8.038,3.39,4],[8.152,3.765,4],[8.337,4.111,4],[8.586,4.414,4],[8.889,4.663,4],[9.235,4.848,4],[9.61,4.962,4],[10,5,4],[10,6,4],[0,6,4]]],"seen":true},{"name":"b.bottom","kind":"down","z0":2,"z1":2,"front":false,"shade":0,"anchor":[11.2,3,2],"rings":[[[10,1,2],[10,5,2],[10.39,4.962,2],[10.765,4.848,2],[11.111,4.663,2],[11.414,4.414,2],[11.663,4.111,2],[11.848,3.765,2],[11.962,3.39,2],[12,3,2],[11.962,2.61,2],[11.848,2.235,2],[11.663,1.889,2],[11.414,1.586,2],[11.111,1.337,2],[10.765,1.152,2],[10.39,1.038,2]]],"seen":false},{"name":"b.side0#4","kind":"wall","z0":2,"z1":6,"front":true,"shade":0,"anchor":[11.894,3.615,4],"rings":[[[12,3,2],[11.962,3.39,2],[11.848,3.765,2],[11.663,4.111,2],[11.414,4.414,2],[11.111,4.663,2],[10.765,4.848,2],[10.39,4.962,2],[10,5,2],[10,5,4],[10,5,6],[10.39,4.962,6],[10.765,4.848,6],[11.111,4.663,6],[11.414,4.414,6],[11.663,4.111,6],[11.848,3.765,6],[11.962,3.39,6],[12,3,6]]],"seen":true},{"name":"a.side1#1","kind":"wall","z0":0,"z1":4,"front":true,"shade":0.302,"anchor":[10,0.5,2],"rings":[[[10,0,0],[10,1,0],[10,1,2],[10,1,4],[10,0,4]]],"seen":true},{"name":"b.side0#1","kind":"wall","z0":4,"z1":6,"front":true,"shade":0.171,"anchor":[8.958,1.3,5],"rings":[[[8,3,4],[8.038,2.61,4],[8.152,2.235,4],[8.337,1.889,4],[8.586,1.586,4],[8.889,1.337,4],[9.235,1.152,4],[9.61,1.038,4],[10,1,4],[10,1,6],[9.61,1.038,6],[9.235,1.152,6],[8.889,1.337,6],[8.586,1.586,6],[8.337,1.889,6],[8.152,2.235,6],[8.038,2.61,6],[8,3,6]]],"seen":true},{"name":"b.top","kind":"up","z0":6,"z1":6,"front":true,"shade":0.784,"anchor":[10,3,6],"rings":[[[12,3,6],[11.962,3.39,6],[11.848,3.765,6],[11.663,4.111,6],[11.414,4.414,6],[11.111,4.663,6],[10.765,4.848,6],[10.39,4.962,6],[10,5,6],[9.61,4.962,6],[9.235,4.848,6],[8.889,4.663,6],[8.586,4.414,6],[8.337,4.111,6],[8.152,3.765,6],[8.038,3.39,6],[8,3,6],[8.038,2.61,6],[8.152,2.235,6],[8.337,1.889,6],[8.586,1.586,6],[8.889,1.337,6],[9.235,1.152,6],[9.61,1.038,6],[10,1,6],[10.39,1.038,6],[10.765,1.152,6],[11.111,1.337,6],[11.414,1.586,6],[11.663,1.889,6],[11.848,2.235,6],[11.962,2.61,6]]],"seen":true},{"name":"b.side0#3","kind":"wall","z0":2,"z1":6,"front":true,"shade":0.603,"anchor":[11.414,1.586,4],"rings":[[[10,1,2],[10.39,1.038,2],[10.765,1.152,2],[11.111,1.337,2],[11.414,1.586,2],[11.663,1.889,2],[11.848,2.235,2],[11.962,2.61,2],[12,3,2],[12,3,6],[11.962,2.61,6],[11.848,2.235,6],[11.663,1.889,6],[11.414,1.586,6],[11.111,1.337,6],[10.765,1.152,6],[10.39,1.038,6],[10,1,6],[10,1,4]]],"seen":true}]};

const root = ref(null);
const S = 20, OX = 30, OY = 157;
const [er0, er1] = D.er, [eu0, eu1, eu2] = D.eu;
const px = (x, y, z) => [OX + S * (x * er0 + y * er1), OY - S * (x * eu0 + y * eu1 + z * eu2)];
const pathOf = (rings, z) => rings.map(r => 'M' + r.map(p => px(p[0], p[1], z(p)).map(v => v.toFixed(1)).join(' ')).join('L') + 'Z').join('');
const XYpath = (ring, z) => pathOf([ring], () => z);
const tagOf = name => name[0];
// Slab outlines and their silhouette verticals (the ring points farthest left and right on screen).
const SLABS = D.slabs.map(sl => {
  const ring = sl.rings[0], sx = ring.map(p => p[0] * er0 + p[1] * er1);
  return { ...sl, ring, lo: ring[sx.indexOf(Math.min(...sx))], hi: ring[sx.indexOf(Math.max(...sx))] };
});
const LEVELS = D.levels;
const FACES = D.faces.map(f => ({ ...f, tint: Math.max(0.2, 0.62 - 0.45 * f.shade), tag: tagOf(f.name) }));
const FRONT = FACES.filter(f => f.front), HIDDEN_CAPS = FACES.filter(f => !f.front && f.kind === 'down');
const levelIndex = z => LEVELS.findIndex(l => l.z === z);
// Labels: the visible faces, ordered by where their anchor lands on screen.
const LABELS = FACES.filter(f => f.seen).map(f => ({ name: f.name, tag: f.tag, at: px(...f.anchor) })).sort((a, b) => a.at[1] - b.at[1])
  .map((l, i, all) => ({ ...l, y: 34 + i * (176 / (all.length - 1)) }));
const HIDDEN_NAMES = FACES.filter(f => !f.seen).map(f => f.name);
const CAP_TERMS = LEVELS.flatMap(l => [...l.down.map(a => ({ z: l.z, a, sign: -1 })), ...l.up.map(a => ({ z: l.z, a, sign: 1 }))]);

const steps = [
  { label: 'The stack to rebuild', text: 'A ∪ B came out as three slabs: the rectangle from z = 0 to 2, the rectangle with a half disc from 2 to 4, the disc from 4 to 6. Every face of such a solid is a horizontal plane, a vertical plane or a vertical cylinder, so its boundary can be built straight from the sections.' },
  { label: 'One set of points', text: 'At each level the section below and the section above are arranged together, and every vertex of that arrangement goes into one set of 2D points shared by all levels; points closer than the tolerance are one (a grid of 64-tolerance cells finds them). The ends of every cap ring are added too.', formula: LEVELS.map(l => `z = ${l.z}: ${l.vertices.length} vertices`).join(' · ') + `<br>${D.points.length} distinct points in all` },
  { label: 'Split every ring', text: 'Every ring of every slab is cut at each point of the set lying on it. A piece runs between two points; pieces with the same two ends and a midpoint within 4 tolerances are one piece, so the faces meeting along it share one curve. A piece at a level is a horizontal edge.', formula: `${new Set(D.pieceOf).size} pieces · ${D.pieces.length} horizontal edges` },
  { label: 'Walls', text: 'Each piece of each slab\'s ring is extruded over the slab, and the cells of one piece in touching slabs make one face: the two right quarters of B\'s circle run from z = 2 to 6 as one wall each, the sides of A from 0 to 4. A line piece makes a plane, an arc a cylinder.', formula: `${FACES.filter(f => f.kind === 'wall').length} walls: one per piece per run of slabs carrying it` },
  { label: 'Caps where the section changes', text: 'At each level the part of the section below that is not above faces up; the part above that is not below faces down. Where the section does not change, there is no cap.', formula: 'up(z) = below(z) − above(z), &nbsp; down(z) = above(z) − below(z)<br>' + LEVELS.map(l => `z = ${l.z}: ${l.up.length ? '↑ ' + l.up.join(', ') : ''}${l.down.length ? '↓ ' + l.down.join(', ') : ''}`).join(' · ') + ' mm²' },
  { label: 'Edges, vertices, shells', text: 'Every edge must be used by two faces, once each way; a horizontal line where two solids touch (four uses) is split in two. A vertex is made per disc of faces around a point, and vertical edges that meet only each other are joined. Faces connected through edges form a shell; its signed volume from the caps says whether it is a body or a cavity.', formula: `V = Σ<sub>caps</sub> ± area · z = ${CAP_TERMS.map(c => `${c.sign < 0 ? '−' : '+'} ${c.a} · ${c.z}`).join(' ').replace(/^\+ /, '')} = ${D.volume} mm³ &gt; 0: a body` },
  { label: 'Names', text: 'A wall takes the tag of the ring segment it came from (an authored side, kept through every 2D Boolean); a cap takes the name of the authored top or bottom at its height that contains it. A name used by several faces becomes <code>name#1</code> … <code>name#k</code>, ordered by a point of each face: by x, then y, then z.' },
];
const s = useSteps(steps.length, [2600, 3600, 3600, 3600, 4400, 4400, 4000], root);
const k = computed(() => ease(s.t.value));
const at = computed(() => s.step.value);

// Step 1: the slabs come together.
const slabShapes = computed(() => SLABS.map((sl, i) => {
  const dz = at.value === 0 ? 0.6 * i * (1 - k.value) : 0;
  const v = p => [px(p[0], p[1], sl.z0 + dz), px(p[0], p[1], sl.z1 + dz)];
  return { bottom: XYpath(sl.ring, sl.z0 + dz), top: XYpath(sl.ring, sl.z1 + dz), sides: [v(sl.lo), v(sl.hi)] };
}));
// Step 2: the points of each level, in turn.
const levelShown = computed(() => (at.value === 1 ? Math.min(LEVELS.length - 1, Math.floor(s.t.value * LEVELS.length)) : LEVELS.length - 1));
const levelDots = computed(() => LEVELS.slice(0, levelShown.value + 1).flatMap((l, li) => l.vertices.map((p, j) => {
  const local = at.value === 1 && li === levelShown.value ? Math.max(0, Math.min(1, (s.t.value * LEVELS.length - li) * 3 - j * 0.25)) : 1;
  const [x, y] = px(p[0], p[1], l.z); return { x, y, r: 3.2 * local, now: li === levelShown.value && at.value === 1 };
})));
const levelRings = computed(() => {
  const z = LEVELS[levelShown.value].z;
  return SLABS.filter(sl => sl.z0 === z || sl.z1 === z).map(sl => XYpath(sl.ring, z));
});
// Step 3: the pieces, in order.
const pieceCount = computed(() => (at.value === 2 ? Math.ceil(k.value * D.pieces.length) : D.pieces.length));
const PIECES = D.pieces.map((e, i) => ({ d: 'M' + e.map(p => px(...p).map(v => v.toFixed(1)).join(' ')).join('L'), a: px(...e[0]), b: px(...e[e.length - 1]), tag: D.pieceOf[i] % 2 ? 'b' : 'a' }));
// Steps 4–7: the faces.
const faces = computed(() => {
  const st = at.value;
  if (st < 3) return [];
  return FRONT.map(f => {
    if (f.kind === 'wall') {
      const top = st === 3 ? f.z0 + (f.z1 - f.z0) * k.value : f.z1;
      return { f, d: pathOf(f.rings, p => Math.min(p[2], top)), opacity: 1 };
    }
    if (st === 3) return null;
    const li = levelIndex(f.z0), u = st === 4 ? Math.max(0, Math.min(1, s.t.value * LEVELS.length - li)) : 1;
    if (u <= 0) return null;
    const drop = (1 - ease(u)) * 0.9 * (f.kind === 'up' ? 1 : -1);
    return { f, d: pathOf(f.rings, p => p[2] + drop), opacity: Math.min(1, u * 2) };
  }).filter(Boolean);
});
const hiddenCaps = computed(() => {
  if (at.value < 4 || at.value > 5) return [];
  return HIDDEN_CAPS.map(f => {
    const li = levelIndex(f.z0), u = at.value === 4 ? Math.max(0, Math.min(1, s.t.value * LEVELS.length - li)) : 1;
    if (u <= 0) return null;
    const drop = -(1 - ease(u)) * 0.9, c = px(f.anchor[0], f.anchor[1], f.z0 + drop);
    return { f, d: pathOf(f.rings, p => p[2] + drop), opacity: Math.min(1, u * 2), arrow: [c, [c[0], c[1] + 16]] };
  }).filter(Boolean);
});
const termShown = computed(() => (at.value === 5 ? Math.min(CAP_TERMS.length, Math.floor(s.t.value * (CAP_TERMS.length + 1))) : CAP_TERMS.length));
const pulse = computed(() => (at.value === 5 && termShown.value < CAP_TERMS.length + 1 ? CAP_TERMS[termShown.value - 1] : null));
const labelCount = computed(() => (at.value === 6 ? Math.ceil(k.value * LABELS.length) : 0));
const readout = computed(() => {
  const st = at.value;
  if (st === 0) return SLABS.map(sl => `z ${sl.z0}–${sl.z1}`);
  if (st === 1) return LEVELS.slice(0, levelShown.value + 1).map(l => `z = ${l.z}: ${l.vertices.length} pts`);
  if (st === 2) return [`${pieceCount.value} / ${D.pieces.length} edges`, `${new Set(D.pieceOf).size} pieces`];
  if (st === 3) return [`${FACES.filter(f => f.kind === 'wall').length} walls`, `(${FACES.filter(f => f.kind === 'wall' && f.seen).length} seen here)`];
  if (st === 4) return LEVELS.slice(0, Math.min(LEVELS.length, Math.floor(s.t.value * LEVELS.length) + 1)).map(l => `z = ${l.z}: ${l.up.length ? '↑' : '↓'} ${[...l.up, ...l.down].join(', ')}`);
  if (st === 5) return [...CAP_TERMS.slice(0, termShown.value).map(c => `${c.sign < 0 ? '−' : '+'} ${c.a} · ${c.z}`), ...(termShown.value === CAP_TERMS.length ? [`= ${D.volume}`] : [])];
  return [];
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Rebuilding the boundary: walls, caps, shell, names" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="An oblique view of A union B: its slabs, shared points, split rings, walls, caps and face names">
        <!-- Steps 1–3: slab outlines. -->
        <g v-if="at <= 2" class="slabs" :class="{ faint: at > 0 }">
          <g v-for="(sh, i) in slabShapes" :key="'sl' + i">
            <path :d="sh.bottom" class="slab-line" />
            <line v-for="(v, j) in sh.sides" :key="'sv' + j" :x1="v[0][0]" :y1="v[0][1]" :x2="v[1][0]" :y2="v[1][1]" class="slab-line" />
            <path :d="sh.top" class="slab-top" />
          </g>
        </g>
        <g v-if="at === 1">
          <path v-for="(d, i) in levelRings" :key="'lr' + i" :d="d" class="level-ring" />
        </g>
        <g v-if="at === 1 || at === 2">
          <circle v-for="(p, i) in levelDots" :key="'dot' + i" :cx="p.x" :cy="p.y" :r="p.r" class="point" :class="{ now: p.now }" />
        </g>
        <!-- Step 3: pieces. -->
        <g v-if="at >= 2 && at <= 3" :class="{ faint: at === 3 }">
          <g v-for="(p, i) in PIECES.slice(0, pieceCount)" :key="'pc' + i">
            <path :d="p.d" :class="'piece-' + p.tag" />
            <circle :cx="p.a[0]" :cy="p.a[1]" r="2.2" class="piece-end" /><circle :cx="p.b[0]" :cy="p.b[1]" r="2.2" class="piece-end" />
          </g>
        </g>
        <!-- Steps 4–7: faces, back to front. -->
        <g v-for="(x, i) in faces" :key="'f' + x.f.name" :style="{ opacity: x.opacity }">
          <path :d="x.d" class="under" />
          <path :d="x.d" :class="['tint', 'tint-' + x.f.tag, { pulse: pulse && x.f.kind !== 'wall' && pulse.z === x.f.z0 }]" :style="{ fillOpacity: x.f.tint }" />
        </g>
        <g v-for="x in hiddenCaps" :key="'h' + x.f.name" :style="{ opacity: x.opacity }">
          <path :d="x.d" :class="['hidden', 'hidden-' + x.f.tag, { pulse: pulse && pulse.z === x.f.z0 }]" />
          <line v-if="at === 4" :x1="x.arrow[0][0]" :y1="x.arrow[0][1]" :x2="x.arrow[1][0]" :y2="x.arrow[1][1]" class="arrow" marker-end="url(#prism-down)" />
        </g>
        <defs><marker id="prism-down" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="head" /></marker></defs>
        <!-- Step 7: names. -->
        <g v-for="(l, i) in LABELS.slice(0, labelCount)" :key="'lb' + l.name">
          <line :x1="l.at[0]" :y1="l.at[1]" :x2="292" :y2="l.y - 4" class="leader" />
          <circle :cx="l.at[0]" :cy="l.at[1]" r="2.2" class="anchor" />
          <text x="296" :y="l.y" :class="'name-' + l.tag">{{ l.name }}</text>
        </g>
        <text v-if="at === 6 && labelCount === LABELS.length" x="12" y="236" class="caption">hidden: {{ HIDDEN_NAMES.join(', ') }}</text>
        <!-- Readout. -->
        <text v-for="(line, i) in readout" :key="'ro' + i" x="292" :y="40 + 17 * i" class="readout">{{ line }}</text>
      </svg>
      <template #note>An oblique parallel view of the kernel's own B-rep for this case (faces, names, loops and the numbers in
        the steps are its output, embedded); faces turned away from the view are not drawn, except the two downward caps,
        dashed. Edges are sampled at 8 segments a quarter turn for the picture only.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --keep: #24956d; --hot: #c75351; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --keep: #6dcb9e; --hot: #ef8a87; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.slab-line { fill: none; stroke: var(--keep); stroke-width: 1.2; stroke-linejoin: round; }
.slab-top { fill: var(--keep); fill-opacity: 0.14; stroke: var(--keep); stroke-width: 1.4; stroke-linejoin: round; }
.faint { opacity: 0.35; }
.level-ring { fill: none; stroke: var(--hot); stroke-width: 2; stroke-linejoin: round; }
.point { fill: var(--vp-c-text-1); } .point.now { fill: var(--hot); }
.piece-a, .piece-b { fill: none; stroke-width: 2.6; stroke-linecap: round; }
.piece-a { stroke: var(--a); } .piece-b { stroke: var(--b); }
.piece-end { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1; }
.under { fill: var(--vp-c-bg); stroke: none; }
.tint { stroke: var(--vp-c-text-1); stroke-width: 0.9; stroke-linejoin: round; stroke-opacity: 0.75; transition: fill .2s; }
.tint-a { fill: var(--a); } .tint-b { fill: var(--b); }
.tint.pulse { fill: var(--hot); }
.hidden { fill: none; stroke-width: 1.2; stroke-dasharray: 4 3; }
.hidden-a { stroke: var(--a); } .hidden-b { stroke: var(--b); }
.hidden.pulse { stroke: var(--hot); stroke-width: 2; }
.arrow { stroke: var(--hot); stroke-width: 1.4; }
.head { fill: var(--hot); }
.leader { stroke: var(--vp-c-text-3); stroke-width: 0.8; }
.anchor { fill: var(--vp-c-text-1); }
.name-a, .name-b { font-family: var(--vp-font-family-mono); font-size: 10.5px; font-weight: 600; }
.name-a { fill: var(--a); } .name-b { fill: var(--b); }
.readout { font-size: 11px; font-variant-numeric: tabular-nums; fill: var(--vp-c-text-1); }
.caption { font-size: 10px; fill: var(--vp-c-text-3); }
</style>
