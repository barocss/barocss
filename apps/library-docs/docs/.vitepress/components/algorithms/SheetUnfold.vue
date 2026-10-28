<script setup>
// The flat pattern of a channel (packages/barocss-cad/src/frame-sheet/sheet-flat.ts, flatPattern): the channel of
// test/r12-2.test.mjs — a sheet-contour 30 + 40 + 30 to its outer sharps, T 1.5, R 2, K 0.44, 25 wide, a Ø8 hole cut
// through its base by a difference. The folding motion is the page's (each bend opened with its neutral layer kept at
// length BA); the flat outline, the bend lines and the numbers in steps 6 and 7 are the built kernel's, from
// flatPatternOf(output, { fixedFace: 'c.leg1.a' }) and flatPatternDxf on packages/barocss-cad/dist/index.js.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const T = 1.5, R = 2, K = 0.44, W = 25, HOLE = { x: 20, z: 12.5, r: 4 };
/** Each bend's allowance θ(R + K·T) at 90°: the kernel's report gives 4.178318229274425 for both. */
const BA = Math.PI / 2 * (R + K * T);
/** A flange's straight part (30 less the setback R + T) and the base's, from x = R + T to 40 − (R + T). */
const FLANGE = 30 - (R + T), X0 = R + T, X1 = 40 - (R + T), NB = 10;
// The kernel's flat (fixedFace c.leg1.a): its box, its loops and bends, moved so the box starts at 0, 0.
const FLAT = {
  box: [94.35663645854885, 25], area: 2308.6504290062844, volume: 3473.578518715307,
  hole: { c: [47.178318229274424, 12.5], r: 4 },
  bends: [
    { name: 'c.bend1', centre: 28.589159114637216, tangents: [26.5, 30.678318229274428] },
    { name: 'c.bend2', centre: 65.76747734391164, tangents: [63.678318229274424, 67.85663645854885] },
  ],
  note: 'DOWN 90° R2',
};
/** The kernel's flat x of the page's world x: the left flange's tip, at x = X0 − BA − FLANGE, is its 0. */
const SHIFT = FLANGE + BA - X0;

/**
 * The section's skin at `off` from the outer face into the material (0 outer, T inner, T/2 the middle), with the left
 * and right bends turned φL and φR. A bend opened to φ keeps its neutral layer BA long: neutral radius BA/φ.
 */
function section(phiL, phiR, off) {
  const bend = (phi, sgn, x0) => {
    const f = Math.max(phi, 1e-6), rn = BA / f, ro = rn + (1 - K) * T, rho = ro - off;
    return { at: a => [x0 + sgn * rho * Math.sin(a), ro - rho * Math.cos(a)], f, d: [sgn * Math.cos(f), Math.sin(f)] };
  };
  const L = bend(phiL, -1, X0), Rb = bend(phiR, 1, X1), pts = [], tags = [];
  const eL = L.at(L.f), eR = Rb.at(Rb.f);
  pts.push([eL[0] + FLANGE * L.d[0], eL[1] + FLANGE * L.d[1]]); tags.push('fl');
  for (let i = 0; i <= NB; i++) { pts.push(L.at(L.f * (NB - i) / NB)); tags.push(i < NB ? 'bl' : 'base'); }
  for (let i = 0; i <= NB; i++) { pts.push(Rb.at(Rb.f * i / NB)); tags.push(i < NB ? 'br' : 'fr'); }
  pts.push([eR[0] + FLANGE * Rb.d[0], eR[1] + FLANGE * Rb.d[1]]);
  return { pts, tags };
}
const LIGHT = (() => { const l = [0.35, 0.8, 0.5], n = Math.hypot(...l); return l.map(x => x / n); })();
const HOLE_RING = Array.from({ length: 33 }, (_, i) => [HOLE.x + HOLE.r * Math.cos(2 * Math.PI * i / 32), T / 2, HOLE.z + HOLE.r * Math.sin(2 * Math.PI * i / 32)]);
const OUTLINE = [[0, 0], [FLAT.box[0], 0], [FLAT.box[0], FLAT.box[1]], [0, FLAT.box[1]], [0, 0]];
const OUT_LEN = 2 * (FLAT.box[0] + FLAT.box[1]);

const steps = [
  { label: 'The part as built', text: 'A channel bent from one sheet: a contour flange along the path 30 + 40 + 30 (to the outer virtual sharps), T 1.5, inner radius R 2, K 0.44, 25 wide, with a Ø8 hole cut through its base. Its B-rep is all the flat pattern reads, with T and K.', formula: 'faces: c.leg0.a/b, c.bend1.inner/outer, c.leg1.a/b, c.bend2.inner/outer, c.leg2.a/b, the ends and the hole' },
  { label: 'Start from a fixed face', text: 'The flat lies in the plane of one planar face, seen from its outside: the one named, else the sheet\'s own (here <code>c.leg0.a</code>, the first leg), else the largest planar face. The figure fixes the base\'s outer face <code>c.leg1.a</code>; the outline is the same. The fixed face is mapped onto its own plane.', formula: 'plane: x ↦ o₂ + ((x − o₃)·e₁) f₁ + ((x − o₃)·e₂) f₂' },
  { label: 'Cross a smooth edge', text: 'From the fixed face, the skin is followed outward across edges where the two faces meet smoothly: their outward normals agree to 10⁻⁹ at the edge\'s quarter points. Such an edge must be straight, a tangent line. Past it lies a cylinder: a bend.', formula: 'smooth: n<sub>1</sub>·n<sub>2</sub> ≥ 1 − 10⁻⁹ at three points of the edge' },
  { label: 'Unroll the bend at the neutral radius', text: 'A point of the bend is located by its distance s along the axis and its angle φ from the tangent line. It is laid out at s along the line and (R + K·T)·φ across it, so the bend becomes a flat strip BA wide. The flange beyond is placed rigidly from the bend\'s far tangent line. The readout shows the inner and outer arcs tending to BA as the bend opens.', formula: 'bend: (s, φ) ↦ o₂ + s f<sub>a</sub> + (R + K·T) φ f<sub>x</sub> &nbsp; width BA = θ(R + K·T)' },
  { label: 'And the next', text: 'The walk goes on breadth first until no smooth edge is left. Pieces of one plane, or of one cylinder, share one development. A smooth neighbour that is neither a plane nor a cylinder is refused, <code>BEND_NOT_CYLINDRICAL</code>.', formula: 'skin = faces reached from the fixed face across smooth edges' },
  { label: 'The outline', text: `Seen from the fixed face's outside, the flat is the skin's boundary, walked through the B-rep's own loops and moved so its box starts at (0, 0). Each piece is an exact image: here four lines and a circle. Its length is the straight parts and the two allowances: 26.5 + BA + 33 + BA + 26.5 = ${num(FLAT.box[0], 3)} mm.`, formula: `flat ${num(FLAT.box[0], 3)} × ${FLAT.box[1]} mm = 100 − 2·BD` },
  { label: 'Checks, then the DXF', text: `Before it is returned the flat is checked: the other skin lies T away and every other face meets the skins square; the body's volume is T times its skin at the middle (to 10⁻⁷); no two pieces of the outline cross. Its DXF has the outline on OUTLINE and each bend's centre line dashed on BEND_UP or BEND_DOWN, with a note on BEND_NOTES.`, formula: `area ${num(FLAT.area, 3)} = V/T + (K − ½)·T·Σθw = ${num(FLAT.volume / T, 3)} − ${num((0.5 - K) * T * Math.PI * W, 3)}` },
];
const s = useSteps(steps.length, [2200, 2400, 2600, 3600, 3600, 4200, 3200], root);
const k = computed(() => ease(s.t.value));
const HALF = Math.PI / 2;
const phiL = computed(() => (s.step.value < 3 ? HALF : s.step.value === 3 ? HALF * (1 - k.value) : 0));
const phiR = computed(() => (s.step.value < 4 ? HALF : s.step.value === 4 ? HALF * (1 - k.value) : 0));
const opened = computed(() => (2 * HALF - phiL.value - phiR.value) / (2 * HALF));
// The camera: above, in front and to the right; in step 6 it turns to look at the fixed face from outside (below).
const cam = computed(() => {
  const st = s.step.value, c = st < 5 ? 0 : st === 5 ? ease(Math.min(1, 2 * s.t.value)) : 1, f = opened.value;
  return { a: 0.5 * (1 - c), p: 0.6 + (-HALF - 0.6) * c, S: 4.2 + (3.4 - 4.2) * f + 0.1 * c, o: [20, 12 + (T / 2 - 12) * f, 12.5] };
});
function projector(c) {
  const ca = Math.cos(c.a), sa = Math.sin(c.a), cp = Math.cos(c.p), sp = Math.sin(c.p);
  const r = [ca, 0, -sa], u = [-sa * sp, cp, -ca * sp], v = [sa * cp, sp, ca * cp];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { xy: P => { const d = [P[0] - c.o[0], P[1] - c.o[1], P[2] - c.o[2]]; return [190 + c.S * dot(d, r), 128 - c.S * dot(d, u)]; }, depth: P => dot(P, v) };
}
const str = ps => ps.map(q => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');
const pieceClass = tag => (tag === 'base' ? (s.step.value >= 1 ? 'keep' : 'a') : tag === 'bl' || tag === 'br' ? (s.step.value >= 2 ? 'b' : 'a') : 'a');

const scene = computed(() => {
  const pr = projector(cam.value), mid = section(phiL.value, phiR.value, T / 2), polys = [];
  for (let i = 0; i + 1 < mid.pts.length; i++) {
    const [a, b] = [mid.pts[i], mid.pts[i + 1]], q = [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], W], [a[0], a[1], W]];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l, 0];
    const shade = 0.3 + 0.5 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1]);
    polys.push({ key: 'q' + i, pts: str(q.map(pr.xy)), cls: pieceClass(mid.tags[i]), op: shade, depth: pr.depth([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, W / 2]) });
    if (mid.tags[i] === 'base') polys.push({ key: 'hole', pts: str(HOLE_RING.map(pr.xy)), cls: 'hole', op: 1, depth: polys.at(-1).depth + 1e-6 });
  }
  polys.sort((x, y) => x.depth - y.depth);
  const outer = section(phiL.value, phiR.value, 0).pts, inner = section(phiL.value, phiR.value, T).pts;
  const cap = str([...outer, ...inner.reverse()].map(p => pr.xy([p[0], p[1], W])));
  const tl = [pr.xy([X0, T / 2, 0]), pr.xy([X0, T / 2, W])];
  return { polys, cap, tl, pr };
});
// The kernel's flat, from the picture's world (x = kernel x − SHIFT, z = kernel y) on the turned camera.
const showFlat = computed(() => s.step.value === 6 || (s.step.value === 5 && s.t.value > 0.5));
const traced = computed(() => {
  const f = s.step.value === 6 ? 1 : ease(Math.max(0, (s.t.value - 0.5) / 0.5)), want = f * OUT_LEN, pr = scene.value.pr, out = [];
  const W3 = p => pr.xy([p[0] - SHIFT, T / 2, p[1]]);
  let run = 0;
  out.push(W3(OUTLINE[0]));
  for (let i = 0; i + 1 < OUTLINE.length && run < want; i++) {
    const a = OUTLINE[i], b = OUTLINE[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), u = Math.min(1, (want - run) / l);
    out.push(W3([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])); run += l;
  }
  return { line: str(out), done: f >= 1 };
});
const flatXY = p => scene.value.pr.xy([p[0] - SHIFT, T / 2, p[1]]);
const bendLines = computed(() => FLAT.bends.map(b => ({ name: b.name, c: [flatXY([b.centre, 0]), flatXY([b.centre, W])], t: b.tangents.map(x => [flatXY([x, 0]), flatXY([x, W])]) })));
const holeXY = computed(() => ({ c: flatXY(FLAT.hole.c), r: FLAT.hole.r * cam.value.S }));
const label = computed(() => {
  const st = s.step.value, pr = scene.value.pr;
  if (st === 1) return { at: pr.xy([24, 0, W]), dx: 0, dy: 16, text: 'fixed face c.leg1.a', cls: 'keep' };
  if (st === 2) return { at: pr.xy([X0, 0, 0]), dx: 6, dy: -4, text: 'tangent line', cls: 'hot' };
  if (st === 3 || st === 4) return { at: pr.xy([X0 - BA / 2, 0, W]), dx: -14, dy: 26, text: st === 4 || s.t.value > 0.9 ? `BA ${num(BA, 3)}` : '', cls: 'b' };
  return null;
});
const readout = computed(() => {
  const st = s.step.value;
  if (st === 0) return `path 30 + 40 + 30 · T ${T} · R ${R} · K ${K} · width ${W} · hole Ø8`;
  if (st === 1) return 'c.leg1.a: a plane, laid onto its own plane';
  if (st === 2) return 'c.leg1.a → c.bend1.outer: normals agree, a straight edge';
  if (st === 3 || st === 4) {
    const f = Math.max(st === 3 ? phiL.value : phiR.value, 1e-6), rn = BA / f;
    return `bend ${st - 2} at ${num(f * 180 / Math.PI, 0)}°: inner ${num((rn - K * T) * f, 3)} · neutral ${num(BA, 3)} · outer ${num((rn + (1 - K) * T) * f, 3)}`;
  }
  if (st === 5) return `the kernel's flat: ${num(FLAT.box[0], 3)} × ${FLAT.box[1]} mm, 2 bends, a hole`;
  return `V ${num(FLAT.volume, 3)} mm³ · area ${num(FLAT.area, 3)} mm² · BEND_DOWN ×2`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Unfolding a channel into its flat pattern" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A sheet-metal channel whose two bends open until it lies flat, then its flat outline with bend lines">
        <g :class="{ faded: showFlat }">
          <polygon v-for="q in scene.polys" :key="q.key" :points="q.pts" :class="['face', q.cls]" :style="q.cls === 'hole' ? null : { fillOpacity: q.op }" />
          <polygon :points="scene.cap" class="cap" />
        </g>
        <line v-if="s.step.value === 2" :x1="scene.tl[0][0]" :y1="scene.tl[0][1]" :x2="scene.tl[1][0]" :y2="scene.tl[1][1]" class="tline" :style="{ opacity: 0.4 + 0.6 * k }" />
        <text v-if="label && label.text" :x="label.at[0] + label.dx" :y="label.at[1] + label.dy" :class="['tag', label.cls]">{{ label.text }}</text>
        <g v-if="showFlat">
          <g v-for="b in bendLines" :key="b.name" :style="{ opacity: s.step.value === 6 ? 1 : 0.6 }">
            <line v-for="(t, j) in b.t" :key="j" :x1="t[0][0]" :y1="t[0][1]" :x2="t[1][0]" :y2="t[1][1]" class="tangent" />
            <line v-if="s.step.value === 6" :x1="b.c[0][0]" :y1="b.c[0][1]" :x2="b.c[1][0]" :y2="b.c[1][1]" class="bendline" />
            <text v-if="s.step.value === 6" :transform="`translate(${(b.c[0][0] - 4).toFixed(2)} ${((b.c[0][1] + b.c[1][1]) / 2).toFixed(2)}) rotate(-90)`" class="note">{{ FLAT.note }}</text>
          </g>
          <polyline :points="traced.line" class="outline" />
          <circle v-if="traced.done" :cx="holeXY.c[0]" :cy="holeXY.c[1]" :r="holeXY.r" class="outline" />
          <g v-if="traced.done">
            <text :x="flatXY([FLAT.box[0] / 2, W])[0]" :y="flatXY([0, W])[1] - 7" class="small mid">{{ num(FLAT.box[0], 3) }}</text>
            <text :x="flatXY([0, 0])[0] - 5" :y="(flatXY([0, 0])[1] + flatXY([0, W])[1]) / 2 + 3" class="small end">{{ W }}</text>
          </g>
          <g v-if="s.step.value === 6">
            <line x1="14" x2="30" y1="196" y2="196" class="outline" /><text x="34" y="199" class="small">OUTLINE</text>
            <line x1="96" x2="112" y1="196" y2="196" class="bendline" /><text x="116" y="199" class="small">BEND_DOWN (dashed)</text>
            <text x="232" y="199" class="small note-key">DOWN 90° R2</text><text x="300" y="199" class="small">BEND_NOTES</text>
          </g>
        </g>
        <text x="12" y="238" class="read">{{ readout }}</text>
      </svg>
      <template #note>The folding motion is drawn by the page: each bend opens with its neutral layer kept BA long, the
        middle of the sheet shown. The kernel does not animate; it maps each face once. The outline, the bend and tangent
        lines and the numbers in steps 6 and 7 are the built kernel's <code>flatPatternOf</code> with <code>fixedFace:
        'c.leg1.a'</code> and its <code>flatPatternDxf</code>; with the default fixed face <code>c.leg0.a</code> the outline is
        the same. Seen from the fixed face's outside both bends fold away from the viewer: <code>down</code>.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; } .mid { text-anchor: middle; } .end { text-anchor: end; }
.read { font-size: 10.5px; font-variant-numeric: tabular-nums; fill: var(--vp-c-text-1); }
.face { stroke-width: 0.5; stroke-linejoin: round; }
.face.a { fill: var(--a); stroke: var(--a); } .face.b { fill: var(--b); stroke: var(--b); } .face.keep { fill: var(--keep); stroke: var(--keep); }
.face.hole { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-text-2); stroke-width: 0.9; }
.cap { fill: var(--vp-c-text-2); fill-opacity: 0.75; stroke: var(--vp-c-text-2); stroke-width: 0.5; stroke-linejoin: round; }
.faded { opacity: 0.35; transition: opacity 0.4s; }
.tline { stroke: var(--hot); stroke-width: 2.6; stroke-linecap: round; }
.tag { font-weight: 700; font-size: 11px; } .tag.keep { fill: var(--keep); } .tag.hot { fill: var(--hot); } .tag.b { fill: var(--b); }
.outline { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.6; stroke-linejoin: round; }
.tangent { stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 2; }
.bendline { stroke: var(--hot); stroke-width: 1.4; stroke-dasharray: 5 2.5; }
.note { font-size: 10px; fill: var(--b); font-weight: 600; text-anchor: middle; }
.note-key { fill: var(--b); font-weight: 600; }
</style>
