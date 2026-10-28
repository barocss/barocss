<script setup>
// A spur gear pair (packages/barocss-cad/src/machine/gear.ts: spurGearPairNominal, checkSpurGearPair) on the kernel's test
// pair: m 2, α 20°, z 20 and 40, schematic roots. The outlines are the exact involute (exactProfile's construction, fewer
// points), the placement is the pair check's (gear 2 turned π − π/z2, then −θ z1/z2 as gear 1 turns θ), and the working
// pressure angle, backlash, tip clearances and the usable contact ratio are its formulas, run here in the page. The built
// kernel gives the same: εα 1.63519 at 60 mm; at 60.5 mm αw 21.2628°, backlash 0.37822, usable εα 1.39486; the sweep's
// least clearance 9.3e-8 mm at 60 mm, and 0.046985 mm with 0.05 mm taken off each tooth (dist/index.js).
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const M = 2, Z1 = 20, Z2 = 40, ALPHA = 20 * Math.PI / 180, A0 = M * (Z1 + Z2) / 2;
const inv = p => Math.tan(p) - p;
function dims(z) {
  const r = M * z / 2, rb = r * Math.cos(ALPHA), ra = r + M, rf = r - 1.25 * M, psi = Math.PI / (2 * z) + inv(ALPHA);
  return { z, r, rb, ra, rf, psi, t1: Math.sqrt((ra / rb) ** 2 - 1), psiTip: psi - inv(Math.acos(rb / ra)), step: 2 * Math.PI / z };
}
const G1 = dims(Z1), G2 = dims(Z2);
/** The gear's outline with tooth 1 centred on angle 0: root arc, radial join, involute, tip arc, involute, join, root arc. */
function outline(g, F = 14) {
  const pts = [], polar = (r, a) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let k = 0; k < g.z; k++) {
    const c = g.step * k;
    for (let i = 0; i <= 3; i++) polar(g.rf, c - g.step / 2 + (g.step / 2 - g.psi) * i / 3);
    for (let i = 0; i <= F; i++) { const t = g.t1 * i / F; polar(g.rb * Math.sqrt(1 + t * t), c - g.psi + t - Math.atan(t)); }
    for (let i = 1; i < 4; i++) polar(g.ra, c - g.psiTip + 2 * g.psiTip * i / 4);
    for (let i = F; i >= 0; i--) { const t = g.t1 * i / F; polar(g.rb * Math.sqrt(1 + t * t), c + g.psi - t + Math.atan(t)); }
    for (let i = 0; i <= 3; i++) polar(g.rf, c + g.psi + (g.step / 2 - g.psi) * i / 3);
  }
  return pts;
}
const O1 = outline(G1), O2 = outline(G2);
const HI1 = Math.sqrt(G1.ra ** 2 - G1.rb ** 2), HI2 = Math.sqrt(G2.ra ** 2 - G2.rb ** 2), PB = Math.PI * M * Math.cos(ALPHA), PER = G1.step;
/** The pair at centre distance a (the pair check's formulas): working pressure angle, pitch circles, backlash, the path of contact. */
function pair(a) {
  const cw = Math.min(0.999999, A0 * Math.cos(ALPHA) / a), aw = Math.acos(cw), rw1 = a * Z1 / (Z1 + Z2), rw2 = a * Z2 / (Z1 + Z2);
  const sw = (g, rw) => 2 * rw * (g.psi - inv(aw)), backlash = 2 * Math.PI * rw1 / Z1 - sw(G1, rw1) - sw(G2, rw2);
  const L = a * Math.sin(aw), start = Math.max(0, L - HI2), end = Math.min(HI1, L);
  return { a, aw, rw1, rw2, backlash, tip: a - G1.ra - G2.rf, L, start, end, ratio: Math.max(0, end - start) / PB,
    T1: [G1.rb * Math.cos(aw), G1.rb * Math.sin(aw)], T2: [a - G2.rb * Math.cos(aw), -G2.rb * Math.sin(aw)], dir: [Math.sin(aw), -Math.cos(aw)] };
}
const NOMINAL = pair(A0);
// Gear 1's turn at which tooth 1's driving flank touches 3 mm along the line from T1 (two pairs in contact then).
const TH4 = NOMINAL.aw + G1.psi - 3.0 / G1.rb;

const WHOLE = { cx: 40, cy: 0, sc: 2.85 }, MESH = { cx: 21, cy: -2.5, sc: 8.6 };
const mix = (p, q, u) => ({ cx: p.cx + (q.cx - p.cx) * u, cy: p.cy + (q.cy - p.cy) * u, sc: p.sc * (q.sc / p.sc) ** u });

const steps = [
  { label: 'Two gears of one module', text: 'Gear 1 has 20 teeth, gear 2 has 40, both of module 2 and pressure angle 20°. Unshifted, they mesh at the centre distance where their reference circles touch, at the pitch point; gear 2 turns half as fast, the other way. Two gears whose module, pressure angle or (helical) helix angle and hand do not match are refused (MATE_INCOMPATIBLE).', formula: 'a = m (z<sub>1</sub> + z<sub>2</sub>) / 2 = 60 mm, &nbsp; speed ratio −z<sub>1</sub>/z<sub>2</sub> = −0.5' },
  { label: 'Base circles and the line of action', text: 'An involute\'s normal is always tangent to its base circle. Where two flanks touch, their common normal must be tangent to both base circles: it is the one line T₁T₂, crossing the line of centres at the pitch point, at the working pressure angle α<sub>w</sub> to the pitch tangent. Every contact happens on it.', formula: 'cos α<sub>w</sub> = a<sub>0</sub> cos α / a; &nbsp; at a = 60: α<sub>w</sub> = 20°, &nbsp; T₁T₂ = a sin α<sub>w</sub> = 20.521 mm' },
  { label: 'Contact runs along the line', text: 'Gear 1 drives clockwise. Each contact point moves along T₁T₂ by r<sub>b1</sub> dθ as gear 1 turns dθ, so the ratio stays exact. A pair of teeth comes into contact where gear 2\'s tip circle crosses the line and leaves it at gear 1\'s tip circle.' },
  { label: 'The contact ratio', text: 'The path of contact divided by the base pitch p<sub>b</sub> = π m cos α (the spacing of the flanks along the line) is the contact ratio: how many tooth pairs carry the load on average. Here two pairs touch for part of each period, one pair for the rest. The kernel also gives the ratio from where each flank\'s involute really starts (the usable one, the same here).', formula: 'ε<sub>α</sub> = [√(r<sub>a1</sub>² − r<sub>b1</sub>²) + √(r<sub>a2</sub>² − r<sub>b2</sub>²) − a sin α<sub>w</sub>] / (π m cos α) = (11.436 + 18.739 − 20.521) / 5.904 = 1.6352' },
  { label: 'Swept, not assumed', text: 'The pair check does not trust the formulas alone. It turns gear 1 through one tooth period (18°), at 64 positions and again at 128, measuring the least distance between the two exact outlines (150 points a flank) near the mesh, then refines the least one by golden-section search. The two scans must agree (converged), or the check says more samples are needed. At 60 mm the least clearance is 9.3 × 10⁻⁸ mm: touching, never crossing. With 0.05 mm taken off each tooth, the backlash is 0.1 mm and the least clearance 0.04698 mm = j cos α<sub>w</sub> / 2.' },
  { label: 'Moving the centres apart', text: 'At another centre distance the base circles stay, so the line of action tilts: α<sub>w</sub> changes, the working pitch circles change, backlash opens (or, closer, the teeth jam: negative backlash, and the sweep finds them crossing), and the contact ratio falls. Drag the distance.', formula: 'backlash = p<sub>w</sub> − s<sub>w1</sub> − s<sub>w2</sub>, &nbsp; s<sub>w</sub> = 2 r<sub>w</sub> (s/d + inv α − inv α<sub>w</sub>), &nbsp; r<sub>w1</sub> = a z<sub>1</sub>/(z<sub>1</sub> + z<sub>2</sub>)' },
];
const s = useSteps(steps.length, [4200, 3400, 6400, 3600, 5600, 4400], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);

const userA = ref(null);
watch(() => s.step.value, () => { userA.value = null; });
function onSlide(e) { s.pause(); userA.value = Math.max(59.6, Math.min(61.5, +e.target.value)); }
const aNow = computed(() => st.value === 5 ? (userA.value ?? A0 + k.value) : A0);
const P2 = computed(() => pair(aNow.value));

const theta = computed(() => {
  const u = k.value;
  return [TH4 + 3.5 * PER - 1.5 * PER * u, TH4 + 2 * PER, TH4 + 2 * PER - 2 * PER * u, TH4, TH4 - PER * u, TH4][st.value];
});
const view = computed(() => st.value === 0 ? WHOLE : st.value === 1 ? mix(WHOLE, MESH, k.value) : MESH);
const X = (p, v) => 190 + v.sc * (p[0] - v.cx), Y = (p, v) => 130 - v.sc * (p[1] - v.cy);
const pt = p => { const v = view.value; return [X(p, v), Y(p, v)]; };
function gearPath(O, turn, cx) {
  const v = view.value, c = Math.cos(turn), sn = Math.sin(turn);
  let d = '';
  for (let i = 0; i < O.length; i++) { const x = cx + c * O[i][0] - sn * O[i][1], y = sn * O[i][0] + c * O[i][1]; d += `${i ? 'L' : 'M'}${X([x, y], v).toFixed(1)},${Y([x, y], v).toFixed(1)}`; }
  return d + 'Z';
}
const gear1 = computed(() => gearPath(O1, theta.value, 0));
const gear2 = computed(() => gearPath(O2, Math.PI - Math.PI / Z2 - theta.value * Z1 / Z2, aNow.value));
const circ = (cx, r) => { const v = view.value; return { cx: X([cx, 0], v), cy: Y([cx, 0], v), r: Math.max(0.1, r * v.sc) }; };
// The contacts: tooth k's driving flank (the involute unwound counter-clockwise from θ + 2πk/z1 − ψ1) meets the line u = r_b1 (α_w − its base angle) from T1.
const contacts = computed(() => {
  if (st.value < 2 || st.value === 5) return [];
  const p = NOMINAL, out = [];
  for (let j = 0; j < Z1; j++) {
    let d = p.aw - (theta.value + G1.step * j - G1.psi); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    const u = G1.rb * d;
    if (u >= p.start - 1e-9 && u <= p.end + 1e-9) out.push(pt([p.T1[0] + u * p.dir[0], p.T1[1] + u * p.dir[1]]));
  }
  return out;
});
const lineEnds = computed(() => { const p = P2.value, grow = st.value === 1 ? k.value : 1; return [pt(p.T1), pt([p.T1[0] + grow * p.L * p.dir[0], p.T1[1] + grow * p.L * p.dir[1]])]; });
const pathEnds = computed(() => { const p = P2.value; return [pt([p.T1[0] + p.start * p.dir[0], p.T1[1] + p.start * p.dir[1]]), pt([p.T1[0] + p.end * p.dir[0], p.T1[1] + p.end * p.dir[1]])]; });
const pitchPoint = computed(() => pt([P2.value.rw1, 0]));
const tangent = computed(() => { const p = pitchPoint.value, h = 34; return [p[0], p[1] - h, p[0], p[1] + h]; });
const angleArc = computed(() => {
  const p = pitchPoint.value, r = 26, a = P2.value.aw, x1 = p[0], y1 = p[1] + r, x2 = p[0] + r * Math.sin(a), y2 = p[1] + r * Math.cos(a);
  return `M${x1.toFixed(1)},${y1.toFixed(1)}A${r},${r} 0 0 0 ${x2.toFixed(1)},${y2.toFixed(1)}`;
});
const sample = computed(() => st.value === 4 ? Math.min(63, Math.floor(s.t.value * 64)) : 0);
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Two spur gears in mesh: the line of action" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="Two meshing spur gears, their base circles and the line of action through the pitch point">
        <defs><clipPath id="gear-mesh-clip"><rect x="0" y="0" width="380" height="260" /></clipPath></defs>
        <g clip-path="url(#gear-mesh-clip)">
          <path :d="gear2" class="gear b" />
          <path :d="gear1" class="gear a" />
          <!-- Pitch circles (whole view), base and tip circles (close up). -->
          <g :style="{ opacity: st === 0 ? 1 : st === 1 ? 1 - k : 0 }">
            <circle v-bind="circ(0, P2.rw1)" class="pitch" /><circle v-bind="circ(aNow, P2.rw2)" class="pitch" />
            <circle :cx="circ(0, 1).cx" :cy="circ(0, 1).cy" r="2.5" class="centre" /><circle :cx="circ(aNow, 1).cx" :cy="circ(aNow, 1).cy" r="2.5" class="centre" />
            <line :x1="circ(0, 1).cx" :y1="circ(0, 1).cy" :x2="circ(aNow, 1).cx" :y2="circ(aNow, 1).cy" class="centres" />
            <text :x="(circ(0, 1).cx + circ(aNow, 1).cx) / 2 + 30" :y="circ(0, 1).cy - 5" class="tag" text-anchor="middle">a = 60</text>
          </g>
          <g v-if="st >= 1">
            <circle v-bind="circ(0, G1.rb)" class="base" /><circle v-bind="circ(aNow, G2.rb)" class="base" />
            <circle v-bind="circ(0, G1.ra)" class="tipc" /><circle v-bind="circ(aNow, G2.ra)" class="tipc" />
            <line :x1="lineEnds[0][0]" :y1="lineEnds[0][1]" :x2="lineEnds[1][0]" :y2="lineEnds[1][1]" class="action" />
            <line v-if="st === 3" :x1="pathEnds[0][0]" :y1="pathEnds[0][1]" :x2="pathEnds[1][0]" :y2="pathEnds[1][1]" class="path" />
            <g v-if="st === 1 || st === 5">
              <line :x1="tangent[0]" :y1="tangent[1]" :x2="tangent[2]" :y2="tangent[3]" class="ptan" />
              <path :d="angleArc" class="arc" />
              <text :x="pitchPoint[0] + 8" :y="pitchPoint[1] + 40" class="tag">α<tspan baseline-shift="sub" font-size="8">w</tspan></text>
            </g>
            <circle :cx="pt(P2.T1)[0]" :cy="pt(P2.T1)[1]" r="3" class="tpt" /><circle :cx="pt(P2.T2)[0]" :cy="pt(P2.T2)[1]" r="3" class="tpt" />
            <text :x="pt(P2.T1)[0] - 6" :y="pt(P2.T1)[1] - 6" class="lbl" text-anchor="end">T₁</text>
            <text :x="pt(P2.T2)[0] + 6" :y="pt(P2.T2)[1] + 12" class="lbl">T₂</text>
            <circle :cx="pitchPoint[0]" :cy="pitchPoint[1]" r="2.6" class="ppt" />
            <text :x="pitchPoint[0] + 6" :y="pitchPoint[1] - 5" class="lbl">P</text>
          </g>
          <circle v-for="(c, i) in contacts" :key="'c' + i" :cx="c[0]" :cy="c[1]" r="4.2" class="contact" />
        </g>
        <g class="readout">
          <text x="12" y="20">m 2 · α 20° · z₁ 20 · z₂ 40</text>
          <text v-if="st === 2" x="12" y="36">pairs in contact: {{ contacts.length }}</text>
          <text v-if="st === 3" x="12" y="36">path {{ num(NOMINAL.end - NOMINAL.start, 3) }} mm / p<tspan baseline-shift="sub" font-size="8">b</tspan> {{ num(PB, 3) }} = ε<tspan baseline-shift="sub" font-size="8">α</tspan> {{ num(NOMINAL.ratio, 4) }}</text>
          <text v-if="st === 4" x="12" y="36">sample {{ sample + 1 }} / 64 of one 18° period</text>
          <text v-if="st === 4" x="12" y="52">least clearance 9.3 × 10⁻⁸ mm</text>
          <g v-if="st === 5">
            <text x="12" y="36">a {{ num(aNow, 2) }} · α<tspan baseline-shift="sub" font-size="8">w</tspan> {{ num(P2.aw * 180 / Math.PI, 3) }}°</text>
            <text x="12" y="52" :class="{ hot: P2.backlash < -1e-9 }">backlash {{ num(P2.backlash, 4) }} mm{{ P2.backlash < -1e-9 ? ': jammed' : '' }}</text>
            <text x="12" y="68">tip clearance {{ num(P2.tip, 3) }} · ε<tspan baseline-shift="sub" font-size="8">α</tspan> {{ num(P2.ratio, 4) }}</text>
          </g>
        </g>
      </svg>
      <div v-if="st === 5" class="slider">
        <label for="gear-mesh-a">centre distance a</label>
        <input id="gear-mesh-a" type="range" min="59.6" max="61.5" step="0.01" :value="aNow" aria-label="Centre distance in millimetres" @input="onSlide">
        <output for="gear-mesh-a">{{ num(aNow, 2) }} mm</output>
        <button type="button" :aria-pressed="Math.abs(aNow - A0) < 1e-9" @click="s.pause(); userA = A0">60 mm</button>
      </div>
      <template #note>Computed in the page with the kernel's placement and pair formulas on its test pair; the outlines are
        the exact involute at 15 points a flank (the kernel's sweep uses 150). The sweep's least clearances in step 5 are the
        built kernel's output (checkSpurGearPair). In step 6 gear 2 keeps its nominal turn, so the gap opens on both sides of
        its teeth.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.gear { stroke-width: 1.1; stroke-linejoin: round; }
.gear.a { fill: color-mix(in srgb, var(--a) 16%, transparent); stroke: var(--a); }
.gear.b { fill: color-mix(in srgb, var(--b) 16%, transparent); stroke: var(--b); }
.pitch { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1; stroke-dasharray: 5 3; }
.centre { fill: var(--vp-c-text-2); } .centres { stroke: var(--vp-c-text-3); stroke-width: 1; }
.base { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1.1; }
.tipc { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 2 3; }
.action { stroke: var(--hot); stroke-width: 1.6; }
.path { stroke: var(--keep); stroke-width: 4; stroke-linecap: round; opacity: 0.85; }
.ptan { stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 4 3; }
.arc { fill: none; stroke: var(--hot); stroke-width: 1.2; }
.tpt { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 1.6; }
.ppt { fill: var(--vp-c-text-1); }
.contact { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1.2; }
.tag { fill: var(--hot); font-weight: 600; font-size: 10px; }
.lbl { font-weight: 700; font-size: 11px; fill: var(--vp-c-text-1); }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); paint-order: stroke; stroke: var(--vp-c-bg-soft); stroke-width: 3px; stroke-linejoin: round; }
.readout .hot { fill: var(--hot); }
.slider { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 16px 10px; font-size: 13px; color: var(--vp-c-text-2); }
.slider input { flex: 1 1 140px; min-width: 120px; accent-color: var(--vp-c-brand-1); }
.slider output { font-family: var(--vp-font-family-mono); min-width: 64px; color: var(--vp-c-text-1); }
.slider button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 2px 9px; font-size: 12px; background: var(--vp-c-bg); }
.slider button[aria-pressed="true"] { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.slider button:focus-visible, .slider input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
</style>
