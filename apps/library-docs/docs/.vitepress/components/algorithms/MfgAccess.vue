<script setup>
// A 3-axis mill's access (packages/barocss-cad-model/src/machining/access.ts, accessOf), computed in the page with its
// rules on a section: every face cut into pieces, each piece's centre moved 0.01 mm off it along its normal; from each,
// a ray along each axis direction on the face's side (n·d ≥ −10⁻⁹: the tool's end on the face, or its side along it);
// a direction reaches the sample when its ray leaves the part. The samples' areas are kept by their direction mask, and
// the setups chosen greedily from those bins. The section has four of the six directions (±X, ±Z); ±Y run across it.
// The block is the access test's 40 × 20 section with its side slot (open to +X, or sealed 1 mm short: the test's
// mutant) and its sealed void, and a T-slot added from the top.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const OFF = 0.01, STEP = 1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], DNAMES = ['+X', '−X', '+Z', '−Z'];
const sealed = ref(false);

/** The section's loops: the outside counter-clockwise, the void clockwise (outward normals right of travel). */
function loopsOf(shut) {
  const outer = shut
    ? [[0, 0], [40, 0], [40, 20], [10, 20], [10, 14], [13, 14], [13, 10], [3, 10], [3, 14], [6, 14], [6, 20], [0, 20]]
    : [[0, 0], [40, 0], [40, 7], [30, 7], [30, 13], [40, 13], [40, 20], [10, 20], [10, 14], [13, 14], [13, 10], [3, 10], [3, 14], [6, 14], [6, 20], [0, 20]];
  const loops = [outer, [[15, 7.5], [15, 12.5], [25, 12.5], [25, 7.5]]];
  if (shut) loops.push([[29, 7], [29, 13], [39, 13], [39, 7]]);
  return loops;
}
function facesOf(loops) {
  const F = [];
  for (const L of loops) L.forEach((a, i) => {
    const b = L[(i + 1) % L.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    F.push({ a, b, len, n: [dz / len, -dx / len] });
  });
  return F;
}
/** Whether the ray o + s·d leaves the part: no crossing beyond 10⁻⁶ (rayHit === Infinity). */
function leaves(F, o, d) {
  for (const f of F) {
    const ex = f.b[0] - f.a[0], ez = f.b[1] - f.a[1], den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-14) continue;
    const wx = f.a[0] - o[0], wz = f.a[1] - o[1], s = (wx * ez - wz * ex) / den, u = (wx * d[1] - wz * d[0]) / den;
    if (u >= 0 && u <= 1 && s > 1e-6) return { ok: false, s };
  }
  return { ok: true, s: Infinity };
}
/** The nearest crossing's distance (for drawing a blocked ray to where it stops). */
function hitAt(F, o, d) {
  let best = Infinity;
  for (const f of F) {
    const ex = f.b[0] - f.a[0], ez = f.b[1] - f.a[1], den = d[0] * ez - d[1] * ex;
    if (Math.abs(den) < 1e-14) continue;
    const wx = f.a[0] - o[0], wz = f.a[1] - o[1], s = (wx * ez - wz * ex) / den, u = (wx * d[1] - wz * d[0]) / den;
    if (u >= 0 && u <= 1 && s > 1e-6 && s < best) best = s;
  }
  return best;
}
function analyse(shut) {
  const F = facesOf(loopsOf(shut)), samples = [], byMask = new Array(16).fill(0);
  F.forEach((f, fi) => {
    const m = Math.max(1, Math.ceil(f.len / STEP)), cell = f.len / m;
    let side = 0; DIRS.forEach((d, k) => { if (f.n[0] * d[0] + f.n[1] * d[1] >= -1e-9) side |= 1 << k; });
    for (let i = 0; i < m; i++) {
      const u = (i + 0.5) / m, p = [f.a[0] + u * (f.b[0] - f.a[0]) + OFF * f.n[0], f.a[1] + u * (f.b[1] - f.a[1]) + OFF * f.n[1]];
      let mask = 0; const ends = [];
      DIRS.forEach((d, k) => {
        if (!(side & (1 << k))) { ends.push(null); return; }
        if (leaves(F, p, d).ok) { mask |= 1 << k; ends.push(Infinity); } else ends.push(hitAt(F, p, d));
      });
      byMask[mask] += cell;
      samples.push({ fi, p, mask, side, cell, ends });
    }
  });
  // Greedy setups over the mask bins: the direction adding the most area not yet reached, until none adds any.
  const left = byMask.map((x, q) => (q ? x : 0)), setups = [];
  for (;;) {
    let best = -1, bestA = 0;
    for (let k = 0; k < 4; k++) { let A = 0; for (let q = 1; q < 16; q++) if (q & (1 << k)) A += left[q]; if (A > bestA + 1e-12) { bestA = A; best = k; } }
    if (best < 0) break;
    setups.push({ k: best, added: bestA });
    for (let q = 1; q < 16; q++) if (q & (1 << best)) left[q] = 0;
  }
  const total = byMask.reduce((a, b) => a + b, 0);
  return { F, samples, byMask, setups, total, unreached: byMask[0] };
}
const R = computed(() => analyse(sealed.value));

const X = x => 50 + 7 * x, Y = z => 190 - 7 * z;
const paths = computed(() => loopsOf(sealed.value).map(L => L.map((p, i) => `${i ? 'L' : 'M'} ${X(p[0])} ${Y(p[1])}`).join(' ') + ' Z'));
// The sample whose rays steps 2 and 3 draw: the slot's floor (open) or the T-slot's floor beside its neck (sealed).
const probe = computed(() => {
  const S = R.value.samples, pick = sealed.value ? S.find(q => Math.abs(q.p[1] - 10.01) < 1e-9 && q.p[0] > 6.4 && q.p[0] < 7) : S.find(q => Math.abs(q.p[1] - 7.01) < 1e-9 && q.p[0] > 33 && q.p[0] < 34);
  return pick ?? S[0];
});

const steps = [
  { label: 'Samples on every face', text: 'A 3-axis mill cuts along the directions a part is set up in: ±X, ±Y, ±Z. To find what it can reach, every triangle of the display mesh is cut into n² equal parts (n from its longest edge over the sampling step, at most 48 a side) and each part\'s centre is a sample, moved 0.01 mm off the face along its normal so its rays do not graze the face it sits on.', formula: 'step h = max(0.1 mm, diagonal / 200) &nbsp; · &nbsp; n = min(48, ⌈longest edge / h⌉)' },
  { label: 'Only from the face\'s side', text: 'A tool never cuts a face from behind. The directions tried at a sample are those on its face\'s side: n·d ≥ 0. Square to the face, the tool\'s end cuts it; along it (n·d = 0) its side does, side milling. A floor faces up, so +Z, +X and −X are tried; −Z is not.', formula: 'tried: n · d ≥ −10⁻⁹, &nbsp; d ∈ {±X, ±Y, ±Z}' },
  { label: 'A ray along each', text: 'From the sample, a ray along each tried direction through the triangle hierarchy. If it leaves the part (no hit), the tool can come in from there: that direction reaches the sample. At the slot\'s floor, +Z meets the slot\'s ceiling and −X its back wall; +X leaves through its mouth. With the slot sealed, the sample is the T-slot\'s floor under its neck: only +Z leaves.', formula: 'd reaches the sample ⇔ rayHit(o + 0.01 n, d) = ∞' },
  { label: 'Every sample, every direction', text: 'Each sample gets a mask of the directions that reach it, one bit a direction (six bits in 3D, 64 bins; four bits here). Its area is added to its mask\'s bin. The figure casts all the samples\' rays one direction at a time.', formula: 'mask = Σ 2<sup>k</sup> over the directions k that reach it &nbsp;·&nbsp; bin[mask] += area' },
  { label: 'What no direction reaches', text: 'Bin 0 holds what none reaches: an undercut for a 3-axis mill. Here the sealed void and the T-slot\'s head, except the floor under its neck. The access rule warns with that area and its faces: a 5-axis setup, an undercut cutter or a change of design. It has no failing limit, since no sourced one exists.', formula: 'unreached area = bin[0] &nbsp;→&nbsp; access: warn, else pass' },
  { label: 'Setups, greedily', text: 'Setups are counted from the bins: the direction that adds the most area not yet reached, then the next, until nothing any direction reaches is left. Each is a fixturing of the part. On the access test\'s plain 40 × 30 × 20 box this gives +X first, adding 4600 mm² (its end and the four faces along it), then −X, 600 mm².', formula: 'next = argmax<sub>d</sub> Σ bin[q] over q ∋ d and not yet taken' },
];
const s = useSteps(steps.length, [3400, 3400, 4000, 6400, 3800, 5200], root);
const k = computed(() => ease(s.t.value));

const tried = computed(() => DIRS.map((d, i) => ({ i, on: !!(probe.value.side & (1 << i)), end: probe.value.ends[i] })));
const sweepDir = computed(() => (s.step.value === 3 ? Math.min(3, Math.floor(s.t.value * 4)) : -1));
const sweepLen = computed(() => (s.step.value === 3 ? ease(Math.min(1, (s.t.value * 4 - sweepDir.value) * 1.25)) : 0));
const setupsShown = computed(() => (s.step.value === 5 ? Math.min(R.value.setups.length, Math.floor(k.value * (R.value.setups.length + 0.999))) : s.step.value > 5 ? R.value.setups.length : 0));
/** The first setup (in the greedy order) that reaches a sample, or −1. */
const firstSetup = q => R.value.setups.findIndex(st => q.mask & (1 << st.k));
const SETUP_CLASS = ['s0', 's1', 's2', 's3'];
const dotClass = q => {
  const st = s.step.value;
  if (st < 3) return '';
  if (st === 3) { const done = sweepDir.value + (sweepLen.value >= 0.999 ? 1 : 0); return q.mask & ((1 << done) - 1) ? 'reached' : ''; }
  if (st === 4) return q.mask ? 'reached' : 'none';
  const f = firstSetup(q); return f < 0 ? 'none' : f < setupsShown.value ? SETUP_CLASS[f] : '';
};
/** A ray's drawn end from p along d: to its hit, or 40 px out when it leaves. */
function rayEnd(p, d, s0, frac = 1) {
  const L = Number.isFinite(s0) ? s0 : 40 / 7;
  return [X(p[0] + d[0] * L * frac), Y(p[1] + d[1] * L * frac)];
}
/** The probe's ray along direction i, drawn to its stop (step 3) or a short way (step 2). */
const probeEnd = i => rayEnd(probe.value.p, DIRS[i], s.step.value === 1 ? 2.2 : probe.value.ends[i], k.value);
const sweepRays = computed(() => {
  if (sweepDir.value < 0) return [];
  const kk = sweepDir.value, d = DIRS[kk];
  return R.value.samples.filter(q => q.side & (1 << kk)).map(q => { const e = rayEnd(q.p, d, q.ends[kk], sweepLen.value); return { x1: X(q.p[0]), y1: Y(q.p[1]), x2: e[0], y2: e[1], ok: !!(q.mask & (1 << kk)) }; });
});
const readout = computed(() => {
  const r = R.value, st = s.step.value;
  if (st === 0) return `${r.samples.length} samples, 1 mm apart · section length ${num(r.total, 1)} mm`;
  if (st === 1) return `tried at this sample: ${tried.value.filter(x => x.on).map(x => DNAMES[x.i]).join(', ')}`;
  if (st === 2) return `reach it: ${tried.value.filter(x => x.on && !Number.isFinite(x.end) ? true : false).map(x => DNAMES[x.i]).join(', ') || 'none'}`;
  if (st === 3) return `casting ${DNAMES[Math.max(0, sweepDir.value)]} from every sample on its side`;
  if (st === 4) return `reached by none: ${num(r.unreached, 1)} mm of ${num(r.total, 1)} (× the depth in 3D)`;
  return r.setups.slice(0, Math.max(1, setupsShown.value)).map((x, i) => `${i + 1}. ${DNAMES[x.k]} +${num(x.added, 1)}`).join(' · ') + ' mm';
});
const ARROWS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Tool access: rays from the six setup directions" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="A section of a block with a side slot, a T-slot and a sealed void; samples on its faces, rays along the axis directions on each face's side, the unreached areas, and the setups chosen greedily">
        <path :d="paths[0]" class="solid" />
        <path v-for="(p, i) in paths.slice(1)" :key="'h' + i" :d="p" class="hole" />
        <path v-for="(p, i) in paths" :key="'o' + i" :d="p" class="edge" />
        <g v-if="s.step.value === 1 || s.step.value === 2">
          <g v-for="d in tried" :key="'t' + d.i">
            <line v-if="d.on" :x1="X(probe.p[0])" :y1="Y(probe.p[1])" :x2="probeEnd(d.i)[0]" :y2="probeEnd(d.i)[1]" class="probe-ray" :class="s.step.value === 2 ? (Number.isFinite(d.end) ? 'blocked' : 'free') : ''" />
            <circle v-if="d.on && s.step.value === 2 && Number.isFinite(d.end) && k > 0.95" :cx="rayEnd(probe.p, DIRS[d.i], d.end)[0]" :cy="rayEnd(probe.p, DIRS[d.i], d.end)[1]" r="2.6" class="stop" />
          </g>
          <circle :cx="X(probe.p[0])" :cy="Y(probe.p[1])" r="5" class="ring" />
        </g>
        <line v-for="(r, i) in sweepRays" :key="'w' + i" :x1="r.x1" :y1="r.y1" :x2="r.x2" :y2="r.y2" class="sweep" :class="r.ok ? 'free' : 'blocked'" />
        <circle v-for="(q, i) in R.samples" :key="'q' + i" :cx="X(q.p[0])" :cy="Y(q.p[1])" r="1.7" class="sample" :class="dotClass(q)" />
        <g transform="translate(348 216)">
          <line v-for="(d, i) in ARROWS" :key="'a' + i" x1="0" y1="0" :x2="13 * d[0]" :y2="-13 * d[1]" class="axis" :class="{ now: sweepDir === i }" marker-end="url(#mfg-access-arrow)" />
          <text x="16" y="4" class="dname">+X</text><text x="-30" y="4" class="dname">−X</text><text x="-7" y="-17" class="dname">+Z</text><text x="-7" y="26" class="dname">−Z</text>
        </g>
        <g v-if="s.step.value === 5">
          <text v-for="(x, i) in R.setups.slice(0, setupsShown)" :key="'s' + i" :x="20 + 62 * i" y="238" class="setup" :class="SETUP_CLASS[i]">{{ i + 1 }}. {{ DNAMES[x.k] }}</text>
        </g>
        <defs><marker id="mfg-access-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="head" /></marker></defs>
        <text x="12" y="18" class="readout">{{ readout }}</text>
        <text :x="X(20)" :y="Y(10) + 4" class="label">void</text>
        <text :x="X(8)" :y="Y(0) + 16" class="label">T-slot</text><text :x="X(35)" :y="Y(0) + 16" class="label">slot</text>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="The side slot">
          <button type="button" :aria-pressed="!sealed" @click="sealed = false">Slot open to +X</button>
          <button type="button" :aria-pressed="sealed" @click="sealed = true">Sealed 1 mm short</button>
        </div>
      </div>
      <template #note>Computed in the page with accessOf's rules on a 2D section (lengths stand for areas): only the four
        directions in the section's plane are tried; in 3D ±Y are tried as well, and a T-slot running through the part
        along Y would be reached from its ends. Samples are 1 mm apart here; the slot and the void are the access test's,
        the T-slot is added for the figure.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.solid { fill: var(--vp-c-default-soft); stroke: none; }
.hole { fill: var(--vp-c-bg-soft); stroke: none; }
.edge { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.2; stroke-linejoin: round; }
.sample { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 0.8; }
.sample.reached { fill: var(--keep); stroke: var(--keep); } .sample.none { fill: var(--hot); stroke: var(--hot); }
.sample.s0 { fill: var(--a); stroke: var(--a); } .sample.s1 { fill: var(--b); stroke: var(--b); } .sample.s2 { fill: var(--keep); stroke: var(--keep); } .sample.s3 { fill: var(--vp-c-text-1); stroke: var(--vp-c-text-1); }
.probe-ray { stroke: var(--vp-c-text-1); stroke-width: 1.6; }
.probe-ray.free { stroke: var(--keep); } .probe-ray.blocked { stroke: var(--hot); stroke-dasharray: 3 2; }
.stop { fill: var(--hot); }
.sweep { stroke-width: 0.8; opacity: 0.55; } .sweep.free { stroke: var(--keep); } .sweep.blocked { stroke: var(--hot); }
.ring { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.axis { stroke: var(--vp-c-text-3); stroke-width: 1.6; } .axis.now { stroke: var(--vp-c-text-1); stroke-width: 2.4; }
.head { fill: var(--vp-c-text-3); }
.dname { font-size: 10px; font-weight: 600; }
.setup { font-size: 11px; font-weight: 700; } .setup.s0 { fill: var(--a); } .setup.s1 { fill: var(--b); } .setup.s2 { fill: var(--keep); } .setup.s3 { fill: var(--vp-c-text-1); }
.label { font-size: 10px; text-anchor: middle; fill: var(--vp-c-text-3); }
.readout { font-size: 10.5px; font-weight: 600; fill: var(--vp-c-text-1); }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; flex-wrap: wrap; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
