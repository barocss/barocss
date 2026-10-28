<script setup>
// Printing checks on a section of a bracket (a base, an upright and a shelf with a gusset), computed in the page with the package's rules: the overhang test
// of print/overhang.ts (overhangOf: −n·b > sin θ + 10⁻¹², planar faces whole by their exact normal, faces facing straight
// down at the lowest point left out), the support columns of print/orient.ts and print/layers.ts (from each overhanging
// piece's centre straight down to the part or the bed: A · (−n·b) · min(hit, height)), and the wall samples of
// analysis/analysis.ts (wallSamples: a ray inward from each piece's centre, skipping its own piece, and the ball at the
// ray's middle). Limits and walls are the FDM, SLA and SLS profiles in library/builtin/materials.json. The section is
// 10 mm deep, so areas are per 10 mm.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = 180 / Math.PI, DEPTH = 10, STEP = 2;
const PROCS = [
  { id: 'fdm', label: 'FDM', limit: 45, minWall: 0.8, minWallRec: 1.2 },
  { id: 'sla', label: 'Resin (SLA)', limit: 30, minWall: 0.5, minWallRec: 1.0 },
  { id: 'sls', label: 'Powder (SLS)', limit: 90, minWall: 0.8, minWallRec: 1.2 },
];
const THICK = [5, 1, 0.6];
const proc = ref('fdm'), t = ref(1);
const P = computed(() => PROCS.find(p => p.id === proc.value));
const ZG = 20 - 6 / Math.tan(40 / DEG);       // the gusset meets the upright here: its face 40° from the vertical

/** The section's faces, counter-clockwise (outward normal right of travel), for a shelf `th` thick. */
function facesOf(th) {
  const pts = [[0, 0], [40, 0], [40, 20 + th], [12, 20 + th], [12, 20], [30, 20], [36, ZG], [36, 4], [0, 4]];
  const names = ['bottom', 'outside', 'top', 'shelf end', 'underside', 'gusset', 'inside', 'base top', 'base end'];
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    return { a, b, L, n: [dz / L, -dx / L], name: names[i] };
  });
}
/** The first crossing of the ray o + s·d with the section's faces beyond minT, skipping face `skip` (rayHit in 2D). */
function rayHit(F, o, d, minT = 1e-6, skip = -1) {
  let best = Infinity;
  F.forEach((f, i) => {
    if (i === skip) return;
    const ex = f.b[0] - f.a[0], ez = f.b[1] - f.a[1], den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-14) return;
    const wx = f.a[0] - o[0], wz = f.a[1] - o[1], s = (wx * ez - wz * ex) / den, u = (wx * d[1] - wz * d[0]) / den;
    if (u >= 0 && u <= 1 && s > minT && s < best) best = s;
  });
  return best;
}
/** The distance from a point to the nearest face. */
function nearest(F, x, z) {
  let best = Infinity;
  for (const f of F) {
    const ex = f.b[0] - f.a[0], ez = f.b[1] - f.a[1], u = Math.max(0, Math.min(1, ((x - f.a[0]) * ex + (z - f.a[1]) * ez) / (f.L * f.L)));
    best = Math.min(best, Math.hypot(x - f.a[0] - u * ex, z - f.a[1] - u * ez));
  }
  return best;
}
/** Everything the figure shows, for a shelf `th` thick and a process. */
function analyse(th, p) {
  const F = facesOf(th), b = [0, 1], sinT = Math.sin(p.limit / DEG);
  const low = Math.min(...F.map(f => f.a[1])), tol = 1e-4 * Math.max(1, Math.abs(low));
  const faces = F.map(f => {
    const nb = f.n[0] * b[0] + f.n[1] * b[1];
    const bed = nb < -1 + 1e-9 && Math.abs(f.a[1] - low) <= tol;
    return { ...f, nb, bed, angle: Math.asin(Math.max(-1, Math.min(1, -nb))) * DEG, over: !bed && -nb > sinT + 1e-12 };
  });
  // Pieces (the display mesh's triangles), each sampled at its centre.
  const pieces = [];
  faces.forEach((f, fi) => {
    const m = Math.max(1, Math.ceil(f.L / STEP));
    for (let i = 0; i < m; i++) {
      const u = (i + 0.5) / m, c = [f.a[0] + u * (f.b[0] - f.a[0]), f.a[1] + u * (f.b[1] - f.a[1])], A = f.L / m * DEPTH;
      const depth = rayHit(F, c, [-f.n[0], -f.n[1]], 1e-9, fi);
      const local = Number.isFinite(depth) ? Math.min(depth, 2 * nearest(F, c[0] - f.n[0] * depth / 2, c[1] - f.n[1] * depth / 2)) : Infinity;
      const x0 = f.a[0] + (i / m) * (f.b[0] - f.a[0]), x1 = f.a[0] + ((i + 1) / m) * (f.b[0] - f.a[0]);
      pieces.push({ fi, c, A, depth, local, x0, x1 });
    }
  });
  // Support: each overhanging piece's column down to the part or the bed.
  let support = 0;
  const columns = [];
  for (const q of pieces) {
    const f = faces[q.fi]; if (!f.over) continue;
    const toBed = q.c[1] - low; if (toBed < 1e-6) continue;
    const L = Math.min(rayHit(F, q.c, [0, -1]), toBed);
    support += q.A * -f.nb * L;
    columns.push({ x0: Math.min(q.x0, q.x1), x1: Math.max(q.x0, q.x1), z0: q.c[1] - L, z1: q.c[1] });
  }
  const overArea = faces.reduce((a, f) => a + (f.over ? f.L * DEPTH : 0), 0), bedArea = faces.reduce((a, f) => a + (f.bed ? f.L * DEPTH : 0), 0);
  let thin = null; for (const q of pieces) if (Number.isFinite(q.depth) && (!thin || q.depth < thin.depth)) thin = q;
  const wall = !thin ? 'unknown' : thin.depth < p.minWall ? 'fail' : thin.depth < p.minWallRec ? 'warn' : 'pass';
  return { F, faces, pieces, columns, support, overArea, bedArea, thin, wall, low };
}
const R = computed(() => analyse(t.value, P.value));

const X = x => 40 + 6.5 * x, Y = z => 214 - 6.5 * z;
const outline = computed(() => R.value.F.map((f, i) => `${i ? 'L' : 'M'} ${X(f.a[0]).toFixed(2)} ${Y(f.a[1]).toFixed(2)}`).join(' ') + ' Z');

const steps = [
  { label: 'Build direction and bed', text: 'The part is printed along the build direction b: up, +Z unless it is set or chosen by the orientation search. Its lowest point along b is the bed. A face facing straight down at that height rests on the bed: it is left out of the overhangs and counted as bed contact, which the warp and tip rules read.', formula: 'bed: low = min p · b over the vertices; &nbsp; on it: n · b &lt; −1 + 10⁻⁹ at p · b = low' },
  { label: 'How far each face leans', text: 'The angle of a face from the vertical is asin(−n·b): 0° for a vertical wall, 90° for a ceiling. A planar face is judged whole, by its exact normal; a curved face triangle by triangle, by the display mesh, and the result is marked approximate.', formula: 'angle from the vertical = asin(−n · b)' },
  { label: 'Overhangs flagged', text: 'A face leaning down past the process\'s limit θ needs support. The limits: FDM 45°, resin 30°, powder 90°, so nothing on a powder bed (the powder holds the part). Here the shelf\'s underside is a ceiling, 90°; the gusset leans 40°: inside FDM\'s 45°, past resin\'s 30°. Choose the process below.', formula: 'overhangs: −n · b &gt; sin θ + 10⁻¹²' },
  { label: 'Support straight down', text: 'To compare orientations, the support each overhang needs is estimated: from each overhanging triangle\'s centre a ray straight down through the triangle hierarchy, to the part below (here the base) or to the bed. The column\'s volume is the triangle\'s area projected on the bed times that length. The print preview draws the same columns.', formula: 'V<sub>support</sub> = Σ A · (−n · b) · min(hit, p · b − low)' },
  { label: 'Rays inward', text: 'Wall thickness: from each triangle\'s centre a ray inward, against its normal, to the next wall (the kernel\'s ray query, skipping the triangle itself). Its length is that sample\'s depth. The print rule\'s thinnest wall is the least depth over all samples.', formula: 'depth = the first hit of c − s n, &nbsp; s &gt; 10⁻⁹' },
  { label: 'The ball at the middle', text: 'A ray from a rim runs along the wall\'s length: from the shelf\'s end it crosses the whole shelf and the upright, 28 mm. The local thickness takes the ball at the ray\'s middle instead: twice its distance to the nearest surface, at most the depth. At the rim it reads the shelf\'s thickness. The moulding report\'s nominal wall and the studio\'s thickness map use it.', formula: 'local = min(depth, 2 · dist(c − ½ depth · n, surface))' },
  { label: 'Thin walls flagged', text: 'The thinnest wall against the process: under its least (FDM 0.8 mm, two perimeters) the rule fails; under its recommended (FDM 1.2 mm, three perimeters) a second rule warns. Choose the shelf\'s thickness below.', formula: 'wall: depth<sub>min</sub> ≥ minWall, else fail &nbsp;·&nbsp; wall-rec: ≥ minWallRec, else warn' },
];
const s = useSteps(steps.length, [3200, 3600, 4200, 4200, 4200, 5000, 4200], root);
const k = computed(() => ease(s.t.value));
const at = i => (s.step.value > i ? 1 : s.step.value === i ? k.value : 0);

const faceClass = computed(() => R.value.faces.map(f => {
  if (s.step.value >= 2 && s.step.value <= 3 && f.over) return 'over';
  if (s.step.value <= 3 && f.bed) return 'bed';
  return '';
}));
const normals = computed(() => (s.step.value >= 1 && s.step.value <= 2 ? R.value.faces.map(f => {
  const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2, L = 16 * at(1);
  return { x: X(mx), y: Y(mz), nx: X(mx) + L * f.n[0], ny: Y(mz) - L * f.n[1], label: f.bed ? 'on the bed' : `${num(f.angle, 0)}°`, lx: X(mx) + 24 * f.n[0], ly: Y(mz) - 24 * f.n[1] + 4, show: f.L > 2 && f.angle >= -1e-9 };
}) : []));
const cols = computed(() => R.value.columns.map(c => ({ x: X(c.x0), w: Math.max(0.5, 6.5 * (c.x1 - c.x0) - 0.6), y: Y(c.z1), h: Math.max(0, 6.5 * (c.z1 - c.z0) * at(3)) })));
const rays = computed(() => R.value.pieces.map(q => {
  const f = R.value.faces[q.fi], L = Number.isFinite(q.depth) ? q.depth * at(4) : 0;
  return { x1: X(q.c[0]), y1: Y(q.c[1]), x2: X(q.c[0] - f.n[0] * L), y2: Y(q.c[1] - f.n[1] * L) };
}));
// The ball shown: the rim's, the shelf end's middle sample.
const balls = computed(() => {
  const rim = R.value.pieces.filter(q => R.value.faces[q.fi].name === 'shelf end').sort((a, b) => Math.abs(a.c[1] - 20 - t.value / 2) - Math.abs(b.c[1] - 20 - t.value / 2))[0];
  return (rim ? [rim] : []).map(q => {
    const f = R.value.faces[q.fi], m = [q.c[0] - f.n[0] * q.depth / 2, q.c[1] - f.n[1] * q.depth / 2];
    return { x: X(m[0]), y: Y(m[1]), r: Math.max(0, 3.25 * q.local * at(5)), depth: q.depth, local: q.local, x1: X(q.c[0]), y1: Y(q.c[1]), x2: X(q.c[0] - f.n[0] * q.depth), y2: Y(q.c[1] - f.n[1] * q.depth) };
  });
});
const sampleClass = q => (s.step.value < 6 ? '' : q.local < P.value.minWall - 1e-9 ? 'fail' : q.local < P.value.minWallRec - 1e-9 ? 'warn' : 'ok');

const readout = computed(() => {
  const r = R.value, st = s.step.value;
  if (st === 0) return `b = +Z · bed at z = ${num(r.low, 2)} · bed contact ${num(r.bedArea, 1)} mm²`;
  if (st === 1) return 'underside 90° · gusset 40° · upright walls 0°';
  if (st === 2) return `${P.value.label}: θ = ${P.value.limit}° · overhanging ${num(r.overArea, 1)} mm² (${r.faces.filter(f => f.over).map(f => f.name).join(', ') || 'none'})`;
  if (st === 3) return `support ≈ ${num(r.support, 0)} mm³ in ${r.columns.length} columns`;
  if (st === 4) return `${r.pieces.length} samples · least depth ${num(r.thin.depth, 3)} mm (${r.faces[r.thin.fi].name})`;
  if (st === 5) return balls.value.map(b => `the shelf's end: depth ${num(b.depth, 2)} mm → local ${num(b.local, 2)} mm`).join(' · ');
  const v = r.wall === 'pass' ? 'both rules pass' : r.wall === 'warn' ? `wall passes, wall-rec warns (under ${P.value.minWallRec})` : `wall fails (under ${P.value.minWall})`;
  return `thinnest ${num(r.thin.depth, 3)} mm · ${P.value.label}: ${v}`;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Printing: overhangs, support and wall thickness" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A section of a printed bracket with a shelf and a gusset: faces leaning past the overhang limit, support columns down to the bed, rays inward measuring the walls, and the thinnest wall judged">
        <line x1="20" :y1="Y(0)" x2="320" :y2="Y(0)" class="bedline" /><text x="22" :y="Y(0) + 14" class="small">bed</text>
        <rect v-for="(c, i) in (s.step.value === 3 ? cols : [])" :key="'c' + i" :x="c.x" :y="c.y" :width="c.w" :height="c.h" class="column" />
        <path :d="outline" class="solid" />
        <line v-for="(f, i) in R.faces" :key="'f' + i" :x1="X(f.a[0])" :y1="Y(f.a[1])" :x2="X(f.b[0])" :y2="Y(f.b[1])" class="face" :class="faceClass[i]" />
        <g v-for="(n, i) in normals" :key="'n' + i">
          <line v-if="n.show" :x1="n.x" :y1="n.y" :x2="n.nx" :y2="n.ny" class="normal" />
          <text v-if="n.show" :x="n.lx" :y="n.ly" class="angle">{{ n.label }}</text>
        </g>
        <g v-if="s.step.value >= 4">
          <line v-for="(r, i) in rays" :key="'r' + i" :x1="r.x1" :y1="r.y1" :x2="r.x2" :y2="r.y2" class="ray" :class="{ dim: s.step.value === 5 }" />
        </g>
        <g v-if="s.step.value === 5">
          <g v-for="(b, i) in balls" :key="'b' + i">
            <line :x1="b.x1" :y1="b.y1" :x2="b.x2" :y2="b.y2" class="ray strong" />
            <circle :cx="b.x" :cy="b.y" :r="b.r" class="ball" />
            <circle :cx="b.x" :cy="b.y" r="1.8" class="mid" />
          </g>
        </g>
        <circle v-for="(q, i) in (s.step.value >= 4 ? R.pieces : [])" :key="'q' + i" :cx="X(q.c[0])" :cy="Y(q.c[1])" r="2" class="sample" :class="sampleClass(q)" />
        <circle v-if="s.step.value === 6 && R.thin" :cx="X(R.thin.c[0])" :cy="Y(R.thin.c[1])" r="5.5" class="ring" />
        <line x1="348" y1="200" x2="348" y2="146" class="pull" marker-end="url(#mfg-print-arrow)" />
        <text x="354" y="152" class="bname">b</text>
        <defs><marker id="mfg-print-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="head" /></marker></defs>
        <text x="12" y="18" class="readout">{{ readout }}</text>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Printing process">
          <button v-for="p in PROCS" :key="p.id" type="button" :aria-pressed="proc === p.id" @click="proc = p.id">{{ p.label }}</button>
        </div>
        <div class="cases" role="group" aria-label="Thickness of the shelf">
          <span>shelf</span><button v-for="v in THICK" :key="v" type="button" :aria-pressed="t === v" @click="t = v">{{ v }} mm</button>
        </div>
      </div>
      <template #note>Computed in the page with the package's rules on a 2D section, 10 mm deep, of a bracket made up for
        the figure (a base 4 thick, an upright 4 thick, a shelf with a gusset); each face is cut into pieces of at most
        2 mm, standing for triangles, sampled at their centres. Limits and wall thresholds are the FDM, SLA and SLS
        profiles'. In 3D the rays run through the kernel's triangle hierarchy.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 10px; }
.bedline { stroke: var(--vp-c-text-3); stroke-width: 1.2; stroke-dasharray: 5 3; }
.solid { fill: var(--vp-c-default-soft); stroke: none; }
.face { stroke: var(--vp-c-text-2); stroke-width: 1.4; stroke-linecap: round; transition: stroke .3s; }
.face.over { stroke: var(--hot); stroke-width: 3.4; } .face.bed { stroke: var(--b); stroke-width: 3.4; }
.normal { stroke: var(--a); stroke-width: 1.3; }
.angle { font-size: 10px; font-weight: 600; fill: var(--a); text-anchor: middle; }
.column { fill: color-mix(in srgb, var(--hot) 22%, transparent); stroke: var(--hot); stroke-width: 0.5; }
.ray { stroke: var(--a); stroke-width: 0.9; opacity: 0.75; } .ray.dim { opacity: 0.2; } .ray.strong { stroke-width: 1.6; opacity: 1; }
.ball { fill: color-mix(in srgb, var(--keep) 20%, transparent); stroke: var(--keep); stroke-width: 1.4; }
.mid { fill: var(--keep); }
.sample { fill: var(--vp-c-bg); stroke: var(--a); stroke-width: 1; }
.sample.ok { fill: var(--keep); stroke: var(--keep); } .sample.warn { fill: var(--b); stroke: var(--b); } .sample.fail { fill: var(--hot); stroke: var(--hot); }
.ring { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.pull { stroke: var(--vp-c-text-1); stroke-width: 2; }
.head { fill: var(--vp-c-text-1); }
.bname { font-weight: 700; font-size: 13px; fill: var(--vp-c-text-1); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.cases span { color: var(--vp-c-text-2); margin-right: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
