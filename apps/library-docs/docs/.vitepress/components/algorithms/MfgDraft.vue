<script setup>
// The draft field (packages/barocss-cad-model/src/mould/draft.ts, draftField) on a section of a moulded part, computed
// in the page with its rules: the draft at a sample is asin(n·d) from the face's exact normal (a plane's own, an arc's
// radial from its centre, as a cylinder's); a face straddles when n·d takes both signs (beyond 10⁻¹²), is steep when its
// least |n·d| is under sin(least draft) − 10⁻¹², drafted otherwise; the isocline's point on an edge whose vertices differ
// in sign is found by bisection on the exact normal (isoclinePoint); halves and parting points as parting.ts
// (partingLine) gives them. The least drafts are the injection profile's finishes in library/builtin/materials.json.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const DEG = 180 / Math.PI, SIGN = 1e-12;
const FINISHES = [{ id: 'smooth', label: 'Smooth 0.5°', min: 0.5 }, { id: 'pm-t1', label: 'PM-T1 3°', min: 3 }, { id: 'pm-t2', label: 'PM-T2 5°', min: 5 }];
const finish = ref('pm-t1');
const least = computed(() => FINISHES.find(f => f.id === finish.value).min);
const tiltUser = ref(0);

// The section (mm, x across, z along the pull), counter-clockwise, so a face's outward normal is right of its travel.
const c3 = Math.cos(3 / DEG), s3 = Math.sin(3 / DEG);
const FC = [(4 + 18 * s3) / c3, 18];          // the fillet's centre: 4 from the ledge (z 22) and from the 3° wall
const RC = [30, 8];                            // the round's centre (half a cylinder r 8)
const line = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const arc = (c, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) / DEG; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
const FACES = [
  { name: 'bottom', plane: [0, -1], pts: line([0, 0], [30, 0], 4), tag: [126, 214, 'mid'] },
  { name: 'round', arc: { c: RC, r: 8 }, pts: arc(RC, 8, -90, 90, 11), tag: [264, 148, 'start'] },
  { name: 'top', plane: [0, 1], pts: line([30, 16], [18, 16], 2), tag: [176, 94, 'mid'] },
  { name: 'step', plane: [1, 0], pts: line([18, 16], [18, 22], 2), tag: [134, 86, 'end'] },
  { name: 'ledge', plane: [0, 1], pts: line([18, 22], [FC[0], 22], 2), tag: [118, 60, 'mid'] },
  { name: 'fillet', arc: { c: FC, r: 4 }, pts: arc(FC, 4, 90, 177, 8), tag: [32, 47, 'start'] },
  { name: 'wall', plane: [-c3, s3], pts: line([FC[0] - 4 * c3, 18 + 4 * s3], [0, 0], 3), tag: [40, 150, 'start'] },
];
/** A face's exact outward normal at a point: a plane's own, an arc's radial (out from its centre). */
function normalAt(f, x, z) {
  if (f.plane) return f.plane;
  const dx = x - f.arc.c[0], dz = z - f.arc.c[1], l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}
// Samples: each face's vertices and its segments' midpoints (the display mesh's vertices and triangle centres).
const SAMPLES = [];
FACES.forEach((f, fi) => {
  f.pts.forEach((p, i) => {
    SAMPLES.push({ fi, x: p[0], z: p[1], vertex: i });
    if (i + 1 < f.pts.length) { const q = f.pts[i + 1]; SAMPLES.push({ fi, x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2, vertex: -1 }); }
  });
});
for (const s of SAMPLES) s.n = normalAt(FACES[s.fi], s.x, s.z);

const X = x => 30 + 6 * x, Y = z => 196 - 6 * z;
const OUTLINE = (() => {
  let d = `M ${X(0)} ${Y(0)}`;
  for (const f of FACES) {
    const last = f.pts[f.pts.length - 1];
    if (f.arc) d += ` A ${6 * f.arc.r} ${6 * f.arc.r} 0 0 0 ${X(last[0]).toFixed(2)} ${Y(last[1]).toFixed(2)}`;
    else d += ` L ${X(last[0]).toFixed(2)} ${Y(last[1]).toFixed(2)}`;
  }
  return d + ' Z';
})();
const facePath = f => f.pts.map((p, i) => `${i ? 'L' : 'M'} ${X(p[0]).toFixed(2)} ${Y(p[1]).toFixed(2)}`).join(' ');
const FACE_PATHS = FACES.map(facePath);

const dirOf = phi => [Math.sin(phi / DEG), Math.cos(phi / DEG)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const draftOf = s => Math.asin(Math.max(-1, Math.min(1, s))) * DEG;

/** Each face's class against the least draft (degrees), draftField's rule. */
function classify(d, minDeg) {
  const sinMin = Math.sin(minDeg / DEG);
  return FACES.map((f, fi) => {
    let lo = Infinity, hi = -Infinity, steep = Infinity;
    for (const s of SAMPLES) if (s.fi === fi) { const v = dot(s.n, d); lo = Math.min(lo, v); hi = Math.max(hi, v); steep = Math.min(steep, Math.abs(v)); }
    const pos = hi > SIGN, neg = lo < -SIGN;
    const cls = pos && neg ? 'straddle' : steep < sinMin - 1e-12 ? 'steep' : 'drafted';
    return { cls, min: draftOf(lo), max: draftOf(hi), steepest: Math.asin(Math.min(1, steep)) * DEG, side: pos && neg ? '±' : pos ? '+' : neg ? '−' : '0' };
  });
}
/** The isocline's crossing on the edge a–b of face f: bisection on the exact normal; the brackets as it goes. */
function bisect(f, a, b, d, its = 60) {
  const sa = Math.sign(dot(normalAt(f, a[0], a[1]), d));
  let lo = 0, hi = 1; const out = [[lo, hi]];
  for (let it = 0; it < its; it++) {
    const t = (lo + hi) / 2, n = normalAt(f, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
    if (Math.sign(dot(n, d)) === sa) lo = t; else hi = t;
    out.push([lo, hi]);
  }
  return out;
}
/** The isocline's points on straddling faces (one per sign-changing edge, or a vertex on it), with the first edge's brackets. */
function isoclines(d, cls) {
  const pts = [];
  let first = null;
  FACES.forEach((f, fi) => {
    if (cls[fi].cls !== 'straddle') return;
    const v = f.pts.map(p => dot(normalAt(f, p[0], p[1]), d));
    for (let i = 0; i < f.pts.length; i++) {
      if (Math.abs(v[i]) <= SIGN) { pts.push(f.pts[i]); continue; }
      if (i + 1 >= f.pts.length || Math.abs(v[i + 1]) <= SIGN || Math.sign(v[i]) === Math.sign(v[i + 1])) continue;
      const a = f.pts[i], b = f.pts[i + 1], br = bisect(f, a, b, d), t = (br.at(-1)[0] + br.at(-1)[1]) / 2;
      pts.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      if (!first) first = { a, b, br };
    }
  });
  return { pts, first };
}
/** Each face's half (+, −, or split), the person's choice first; and where the parting line crosses the section. */
function parting(d, cls, own) {
  const half = FACES.map((f, fi) => own[f.name] ?? (cls[fi].side === '+' ? '+' : cls[fi].side === '−' ? '−' : cls[fi].side === '0' ? '−' : 'split'));
  const sideAt = (fi, p) => { if (half[fi] !== 'split') return half[fi]; const s = dot(normalAt(FACES[fi], p[0], p[1]), d); return s > SIGN ? '+' : s < -SIGN ? '−' : null; };
  const pts = [];
  FACES.forEach((f, fi) => {
    const gi = (fi + 1) % FACES.length, p = f.pts[f.pts.length - 1], a = sideAt(fi, p), b = sideAt(gi, p);
    if (a && b && a !== b) pts.push(p);
  });
  return { half, pts };
}

const steps = [
  { label: 'A section and a pull', text: 'A moulded part leaves its mould along the pull d: one half of the mould moves along +d, the other along −d. A face comes free when it leans away from the half it touches. The section has seven faces: a wall drafted 3°, a fillet r 4, a ledge, a step, a top, a round (half a cylinder r 8) and the bottom.', formula: 'd: the pull, a unit vector &nbsp; · &nbsp; n: a face\'s outward unit normal' },
  { label: 'Exact normals at the samples', text: 'The samples are the display mesh\'s vertices and triangle centres (here a section\'s vertices and chord midpoints). Each takes its normal from the face\'s exact geometry, not from the triangles: a plane\'s own normal; a cylinder\'s radial direction from its axis; any other face\'s from its NURBS surface, the sample projected onto it by the kernel\'s closest-point search. Only a face made of facets (an imported mesh) uses its triangles\' normals. On a 3° cone the mesh\'s normals are off by 0.014°.', formula: 'plane: its n &nbsp;·&nbsp; cylinder: the part of p − c across the axis, made unit &nbsp;·&nbsp; other: S<sub>u</sub> × S<sub>v</sub> at the foot of p' },
  { label: 'The draft at each sample', text: 'The draft is the angle between the face and the pull: 0° for a wall along the pull, +90° for a face looking along it, −90° for one looking against it. Red: |draft| under the finish\'s least draft. Green: at least that, releasing along +d. Blue: at least that, along −d. The studio\'s draft map colours each display vertex by the same value and limits.', formula: 'draft = asin(n · d)' },
  { label: 'Each face classified', text: 'Over its samples a face has a least and a greatest n·d. With both signs it straddles: the two halves would meet across it. Otherwise it is steep when some sample\'s |draft| is under the least draft, drafted when none is. The least draft is the finish\'s (choose one below); the report also adds up, by triangle centres, the area under it.', formula: 'straddle: max n·d &gt; 10⁻¹² and min n·d &lt; −10⁻¹²<br>steep: min |n·d| &lt; sin(least) − 10⁻¹² &nbsp; · &nbsp; drafted: otherwise' },
  { label: 'Where the sign changes', text: 'On a straddling face, the curve where n·d = 0 is its isocline: a parting line can run there. On each mesh edge whose two vertices\' n·d differ in sign, the crossing is found by bisection along the edge, each midpoint judged by its exact normal: 60 halvings. A vertex with |n·d| ≤ 10⁻¹² is taken as it is. The inset (×7) shows the first eight halvings.', formula: 'm = (a + b) / 2: &nbsp; sign(n(m) · d) = sign(n(a) · d) ? a ← m : b ← m' },
  { label: 'Turn the pull', text: 'Every value depends on d. Tilt it by φ toward +x and the wall\'s draft becomes 3° − φ: at φ = 3° it is a wall along the pull, past it the wall leans the other way and releases along −d. The step\'s draft becomes φ. The round\'s isocline moves round it with the pull.', formula: 'd = (sin φ, cos φ) &nbsp;·&nbsp; wall: 3° − φ &nbsp;·&nbsp; step: φ' },
  { label: 'Halves and the parting line', text: 'Each face goes to a half: + to the half moving along d, − to the other. A face along the pull throughout (n·d = 0, as the step) goes to −, unless the person sets its half; a straddling face goes to both, split along its isocline. The parting line runs where faces of different halves meet, and along each isocline. Here both of the step\'s edges lie on it; half way through, the step is set to the + half and they drop out.', formula: 'half = the person\'s, else + / − by its sign, 0 → −, ± → split' },
];
const s = useSteps(steps.length, [3000, 3800, 5200, 4200, 5200, 6400, 6000], root);
const k = computed(() => ease(s.t.value));
const at = i => (s.step.value > i ? 1 : s.step.value === i ? k.value : 0);

const phi = computed(() => (s.step.value === 5 ? tiltUser.value + 8 * Math.sin(2 * Math.PI * s.t.value) : tiltUser.value));
const d = computed(() => dirOf(phi.value));
const cls = computed(() => classify(d.value, least.value));
const iso = computed(() => isoclines(d.value, cls.value));
const own = computed(() => (s.step.value === 6 && s.t.value >= 0.5 ? { step: '+' } : {}));
const part = computed(() => parting(d.value, cls.value, own.value));

const colourOf = v => (Math.abs(draftOf(v)) < least.value - 1e-9 ? 'under' : v > 0 ? 'plus' : 'minus');
const scanned = computed(() => (s.step.value === 2 ? Math.floor(k.value * (SAMPLES.length - 0.01)) : s.step.value > 2 ? SAMPLES.length - 1 : -1));
const marks = computed(() => SAMPLES.map((p, i) => {
  const v = dot(p.n, d.value), L = 13 * at(1);
  return { x: X(p.x), y: Y(p.z), nx: X(p.x) + L * p.n[0], ny: Y(p.z) - L * p.n[1], c: i <= scanned.value ? colourOf(v) : 'none', vertex: p.vertex >= 0 };
}));
const current = computed(() => (s.step.value === 2 ? SAMPLES[Math.max(0, scanned.value)] : null));

const fmt = v => `${v > 0 ? '+' : ''}${num(v, 1)}°`;
const tags = computed(() => FACES.map((f, fi) => {
  const c = cls.value[fi], range = Math.abs(c.max - c.min) < 0.05 ? fmt(c.min) : `${fmt(c.min)} … ${fmt(c.max)}`;
  return { x: f.tag[0], y: f.tag[1], a: f.tag[2], text: s.step.value >= 3 && s.step.value <= 5 ? `${f.name} ${range}` : f.name, cls: c.cls };
}));

// The inset: the first straddling edge, magnified about its middle.
const inset = computed(() => {
  const f = iso.value.first; if (!f) return null;
  const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2, S = 42, cx = 322, cy = 70;
  const P = p => [cx + S * (p[0] - mx), cy - S * (p[1] - mz)];
  const nIt = s.step.value === 4 ? Math.min(8, Math.floor(k.value * 9)) : 8, [lo, hi] = f.br[nIt];
  const pt = t => P([f.a[0] + t * (f.b[0] - f.a[0]), f.a[1] + t * (f.b[1] - f.a[1])]);
  const arcPts = []; for (let i = 0; i <= 24; i++) { const a = (-14 + 28 * i / 24) / DEG + Math.atan2(mz - RC[1], mx - RC[0]); arcPts.push(P([RC[0] + 8 * Math.cos(a), RC[1] + 8 * Math.sin(a)]).map(v => v.toFixed(1)).join(',')); }
  const width = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) * (hi - lo);
  return { a: P(f.a), b: P(f.b), lo: pt(lo), hi: pt(hi), m: pt((lo + hi) / 2), arc: arcPts.join(' '), it: nIt, width, box: [X(mx) - 6, Y(mz) - 6] };
});

const readout = computed(() => {
  const c = cls.value, st = s.step.value;
  if (st === 0 || st === 1) return `pull tilted φ = ${num(phi.value, 1)}° · d = (${num(d.value[0], 3)}, ${num(d.value[1], 3)})`;
  if (st === 2 && current.value) { const v = dot(current.value.n, d.value); return `${FACES[current.value.fi].name}: n · d = ${num(v, 3)} · draft ${fmt(draftOf(v))}`; }
  if (st === 3) { const bad = FACES.filter((f, i) => c[i].cls !== 'drafted').map(f => f.name); return `least draft ${least.value}° · not drafted: ${bad.join(', ') || 'none'}`; }
  if (st === 4 && inset.value) return `halving ${inset.value.it}: the bracket ${num(inset.value.width, 4)} mm wide`;
  if (st === 5) return `φ = ${num(phi.value, 1)}° · wall ${fmt(3 - phi.value)} (${c[6].cls}) · step ${fmt(phi.value)}`;
  if (st === 6) return `${own.value.step ? 'step set to +' : 'step by default −'} · the line crosses the section ${part.value.pts.length + iso.value.pts.length} times`;
  return '';
});
const arrowTip = computed(() => [330 + 58 * d.value[0], 232 - 58 * d.value[1]]);
const showHalves = computed(() => s.step.value === 6);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Draft: the angle between each face and the pull" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A section of a moulded part with a pull direction; samples on its faces coloured by their draft angle, the faces classified, the isocline found by bisection, and the mould's two halves">
        <path :d="OUTLINE" class="solid" />
        <path v-for="(p, i) in FACE_PATHS" :key="'f' + i" :d="p" class="face" :class="showHalves ? (part.half[i] === '+' ? 'h-plus' : part.half[i] === '−' ? 'h-minus' : 'h-split') : ''" />
        <g v-if="!showHalves">
          <line v-for="(m, i) in marks" :key="'n' + i" :x1="m.x" :y1="m.y" :x2="m.nx" :y2="m.ny" class="normal" :class="m.c" :style="{ opacity: at(1) }" />
          <circle v-for="(m, i) in marks" :key="'s' + i" :cx="m.x" :cy="m.y" :r="m.vertex ? 2.4 : 1.8" class="sample" :class="m.c" />
        </g>
        <circle v-if="current" :cx="X(current.x)" :cy="Y(current.z)" r="5.5" class="ring" />
        <g v-if="s.step.value >= 4 && s.step.value <= 5">
          <circle v-for="(p, i) in iso.pts" :key="'i' + i" :cx="X(p[0])" :cy="Y(p[1])" r="3.6" class="iso" />
        </g>
        <g v-if="showHalves">
          <circle v-for="(p, i) in [...part.pts, ...iso.pts]" :key="'p' + i" :cx="X(p[0])" :cy="Y(p[1])" r="4.2" class="iso" />
          <text x="40" y="236" class="key plus">+ half (moves along d)</text><text x="168" y="236" class="key minus">− half</text><text x="222" y="236" class="key">● parting line</text>
        </g>
        <text v-for="(t, i) in tags" :key="'t' + i" :x="t.x" :y="t.y" class="tag" :class="[t.a, s.step.value >= 3 && s.step.value <= 5 ? t.cls : '']">{{ t.text }}</text>
        <g v-if="s.step.value === 4 && inset">
          <rect :x="inset.box[0]" :y="inset.box[1]" width="12" height="12" class="zoom" />
          <rect x="272" y="22" width="100" height="98" rx="4" class="inset" />
          <polyline :points="inset.arc" class="exact" />
          <line :x1="inset.a[0]" :y1="inset.a[1]" :x2="inset.b[0]" :y2="inset.b[1]" class="chord" />
          <line :x1="inset.lo[0]" :y1="inset.lo[1]" :x2="inset.hi[0]" :y2="inset.hi[1]" class="bracket" />
          <circle :cx="inset.a[0]" :cy="inset.a[1]" r="3" class="sample minus" /><circle :cx="inset.b[0]" :cy="inset.b[1]" r="3" class="sample plus" />
          <circle :cx="inset.m[0]" :cy="inset.m[1]" r="2.6" class="iso" />
          <text x="276" y="116" class="small">×7: the edge, the arc</text>
        </g>
        <g v-if="s.step.value >= 3 && s.step.value <= 5">
          <text x="40" y="236" class="key drafted">drafted</text><text x="92" y="236" class="key steep">steep</text><text x="132" y="236" class="key straddle">straddles</text>
        </g>
        <line x1="330" y1="232" :x2="arrowTip[0]" :y2="arrowTip[1]" class="pull" marker-end="url(#mfg-draft-arrow)" />
        <text :x="arrowTip[0] + 6" :y="arrowTip[1] + 2" class="pull-name">d</text>
        <defs><marker id="mfg-draft-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="head" /></marker></defs>
        <text x="12" y="18" class="readout">{{ readout }}</text>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Surface finish: its least draft">
          <button v-for="f in FINISHES" :key="f.id" type="button" :aria-pressed="finish === f.id" @click="finish = f.id">{{ f.label }}</button>
        </div>
        <label>pull φ <input type="range" min="-10" max="10" step="0.5" :value="tiltUser" aria-label="Tilt of the pull from the vertical, degrees" @input="tiltUser = +$event.target.value"> <span>{{ num(tiltUser, 1) }}°</span></label>
      </div>
      <template #note>Computed in the page with draftField's rules on a 2D section of an extruded part: a 3D part's samples
        are its mesh's vertices and triangle centres, here the section's vertices and chord midpoints. The fillet and the
        round are arcs, so their exact normal is radial, as a cylinder's; a NURBS face's comes from the closest-point
        projection. The least drafts are the injection profile's three finishes. In step 6 the pull swings ±8° about the
        slider's tilt.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.small { font-size: 9.5px; }
.solid { fill: var(--vp-c-default-soft); stroke: none; }
.face { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.4; stroke-linejoin: round; transition: stroke .3s; }
.face.h-plus { stroke: var(--a); stroke-width: 3.2; } .face.h-minus { stroke: var(--b); stroke-width: 3.2; } .face.h-split { stroke: var(--hot); stroke-width: 3.2; }
.normal { stroke: var(--vp-c-text-3); stroke-width: 1; }
.normal.under { stroke: var(--hot); } .normal.plus { stroke: var(--keep); } .normal.minus { stroke: var(--a); }
.sample { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 1; }
.sample.under { fill: var(--hot); stroke: var(--hot); } .sample.plus { fill: var(--keep); stroke: var(--keep); } .sample.minus { fill: var(--a); stroke: var(--a); }
.ring { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.iso { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2; }
.tag { font-size: 10.5px; font-weight: 600; } .tag.mid { text-anchor: middle; } .tag.start { text-anchor: start; } .tag.end { text-anchor: end; }
.tag.steep { fill: var(--hot); } .tag.straddle { fill: var(--b); } .tag.drafted { fill: var(--keep); }
.inset { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.zoom { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 2; }
.exact { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 2; }
.chord { stroke: var(--vp-c-text-2); stroke-width: 1.2; }
.bracket { stroke: var(--b); stroke-width: 5; stroke-linecap: round; opacity: 0.55; }
.pull { stroke: var(--vp-c-text-1); stroke-width: 2; }
.head { fill: var(--vp-c-text-1); }
.pull-name { font-weight: 700; font-size: 13px; fill: var(--vp-c-text-1); }
.key { font-size: 10px; font-weight: 600; } .key.plus { fill: var(--a); } .key.minus { fill: var(--b); } .key.drafted { fill: var(--keep); } .key.steep { fill: var(--hot); } .key.straddle { fill: var(--b); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 140px; }
label span { font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
