<script setup>
// R10.1's closed-form section (packages/barocss-cad/src/blend/fillet-section.ts, filletSection) and the reach check
// (blend/edge-finish.ts, fitsFaces), run in the page on two sections across a straight edge: a rod half sunk in a plate
// (a line and a circle, concave) and a D shaft's flat (a line and a circle, convex). The offsets, the meetings, the
// "ahead" filter, the feet, the arc's direction and the tool's growth are the kernel's.
import { computed, ref, watch } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const TAU = 2 * Math.PI;
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1], cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const at2 = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k], sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit2 = v => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const outwardOf = (s, X) => s.curve.kind === 'line' ? 0 : Math.sign(dot2(s.n, sub2(X, s.curve.c)));
function offsetCurve(s, tau, k) {
  if (s.curve.kind === 'line') return { kind: 'line', p: at2(s.curve.p, s.n, k), d: s.curve.d };
  const r = s.curve.r + tau * k;
  return r > 0 ? { kind: 'circle', c: s.curve.c, r } : null;
}
function meet(a, b) {
  if (a.kind === 'circle' && b.kind === 'line') return meet(b, a);
  if (a.kind === 'line' && b.kind === 'line') { const det = cross2(a.d, b.d); return Math.abs(det) < 1e-14 ? [] : [at2(a.p, a.d, cross2(sub2(b.p, a.p), b.d) / det)]; }
  const f = at2(a.p, a.d, dot2(sub2(b.c, a.p), a.d)), h2 = b.r * b.r - dot2(sub2(b.c, f), sub2(b.c, f));
  if (h2 < -1e-12 * b.r * b.r) return [];
  const h = Math.sqrt(Math.max(0, h2));
  return h === 0 ? [f] : [at2(f, a.d, -h), at2(f, a.d, h)];
}
const footOn = (c, y) => c.kind === 'line' ? at2(c.p, c.d, dot2(sub2(y, c.p), c.d)) : at2(c.c, unit2(sub2(y, c.c)), c.r);
const normalAt = (s, tau, y) => { if (s.curve.kind === 'line') return s.n; const u = unit2(sub2(y, s.curve.c)); return [u[0] * tau, u[1] * tau]; };
const nearest = (ps, X) => ps.reduce((best, p) => (!best || dist2(p, X) < dist2(best, X) ? p : best), null);
/** How far y lies into a side from X: a line's distance along w, a circle's angle towards w (0 to 2π). */
function acrossOf(s, X, y) {
  if (s.curve.kind === 'line') return dot2(sub2(y, X), s.w);
  const a = sub2(X, s.curve.c), b = sub2(y, s.curve.c), dir = Math.sign(cross2(a, s.w)) || 1, t = Math.atan2(cross2(a, b), dot2(a, b)) * dir;
  return ((t % TAU) + TAU) % TAU;
}
/** Points along a circle about c from angle a0, `sweep` radians (signed). */
const arcPoints = (c, r, a0, sweep, n = 40) => Array.from({ length: n + 1 }, (_, i) => [c[0] + r * Math.cos(a0 + sweep * i / n), c[1] + r * Math.sin(a0 + sweep * i / n)]);
const angleOf = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
const shortSweep = (c, a, b) => { let d = angleOf(c, b) - angleOf(c, a); while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
/** The segment from `start` along a section curve to `end`: a line, or a circle the short way. */
const along = (cv, start, end) => cv.kind === 'line' ? [start, end] : arcPoints(cv.c, cv.r, angleOf(cv.c, start), shortSweep(cv.c, start, end), 16);

// The two sections. Each side: its curve, the direction into it from the edge (w) and its outward normal (n).
const CASES = {
  rod: {
    label: 'Rod on plate', min: 0.5, max: 12, start: 3,
    // (Label offsets in px: T1, T2, C.)
    tags: [[6, 14], [-16, -6], [7, -6]],
    X: [5, 10],
    sides: [
      { curve: { kind: 'line', p: [5, 10], d: [1, 0] }, w: [1, 0], n: [0, 1], name: 'the plate', reach: 6 },
      { curve: { kind: 'circle', c: [0, 10], r: 5 }, w: [0, 1], n: [1, 0], name: 'the rod', reach: Math.PI },
    ],
    // The body's outline in the section: the plate (its top 6 mm beside the rod) and the rod's upper half.
    outline: [[-11, 0], [11, 0], [11, 10], ...arcPoints([0, 10], 5, 0, Math.PI, 48), [-11, 10]],
    // (The view follows the ball: the rod, the plate's edge and the ball always in it.)
    view: r => { const cx = Math.sqrt(25 + 10 * r); return [-6.5, Math.max(12.5, cx + r + 0.8), 3, Math.max(16.5, 10 + 2 * r + 0.8)]; },
  },
  shaft: {
    label: 'D shaft', min: 0.25, max: 5, start: 1.5,
    tags: [[-8, -8], [7, 4], [-14, 13]],
    X: [4, 3],
    sides: [
      { curve: { kind: 'line', p: [4, 3], d: [1, 0] }, w: [-1, 0], n: [0, 1], name: 'the flat', reach: 8 },
      { curve: { kind: 'circle', c: [0, 0], r: 5 }, w: [0.6, -0.8], n: [0.8, 0.6], name: 'the rod', reach: TAU - Math.acos(-7 / 25) },
    ],
    outline: [[-4, 3], [4, 3], ...arcPoints([0, 0], 5, Math.atan2(3, 4), -(TAU - Math.acos(-7 / 25)), 64)],
    view: () => [-6.5, 6.5, -6.5, 4.6],
  },
};

/** The section of a fillet of radius r between the case's two sides: what filletSection and fitsFaces compute. */
function sectionOf(cs, r) {
  const [s1, s2] = cs.sides, X = cs.X, convex = dot2(s2.w, s1.n) < 0, sigma = convex ? -1 : 1, taus = [outwardOf(s1, X), outwardOf(s2, X)];
  const offsets = [offsetCurve(s1, taus[0], sigma * r), offsetCurve(s2, taus[1], sigma * r)];
  const out = { convex, sigma, taus, offsets, meets: [], C: null, T: null, refusal: null, need: null, arc: null, tool: null, g: 0 };
  const gone = offsets.findIndex(o => !o);
  if (gone >= 0) { out.refusal = { code: 'RADIUS_EXCEEDS_CURVATURE', text: `a fillet of ${num(r, 2)} mm does not fit inside the ${cs.sides[gone].curve.r} mm radius of ${cs.sides[gone].name}` }; return out; }
  const tol = 1e-9 * 30, ahead = C => cs.sides.every(s => dot2(sub2(footOn(s.curve, C), X), s.w) > -tol);
  out.meets = meet(offsets[0], offsets[1]).map(C => ({ C, ahead: ahead(C) }));
  const C = nearest(out.meets.filter(m => m.ahead).map(m => m.C), X);
  if (!C) { out.refusal = { code: 'RADIUS_EXCEEDS_CURVATURE', text: `no ball of ${num(r, 2)} mm touches both faces at this edge` }; return out; }
  const T = [footOn(s1.curve, C), footOn(s2.curve, C)];
  out.C = C; out.T = T;
  // The fit: each contact's distance into its face against the face's reach across the edge.
  out.need = cs.sides.map((s, k) => ({ need: acrossOf(s, X, T[k]), reach: s.reach, angle: s.curve.kind === 'circle' }));
  const bad = out.need.findIndex(x => x.need > x.reach + (x.angle ? 1e-9 : 1e-6 * 30));
  if (bad >= 0) {
    const x = out.need[bad], u = v => x.angle ? `${num(v * 180 / Math.PI, 3)}°` : `${num(v, 3)} mm`;
    out.refusal = { code: 'RADIUS_EXCEEDS_FACE', text: `the contact reaches ${u(x.need)} into ${cs.sides[bad].name}, which reaches only ${u(x.reach)}` };
  }
  // The arc from T2 to T1, the way past X's side.
  const ang = p => angleOf(C, p), sweep = ((ang(T[0]) - ang(T[1])) % TAU + TAU) % TAU, mid = ((ang(X) - ang(T[1])) % TAU + TAU) % TAU;
  out.arc = arcPoints(C, r, ang(T[1]), mid < sweep ? sweep : sweep - TAU, 40);
  // The tool: grown g = r/2 outside the corner (no circle shrunk past half its radius), halved until the grown curves meet.
  let g = r / 2;
  cs.sides.forEach((s, k) => { if (s.curve.kind === 'circle' && taus[k] * -sigma < 0) g = Math.min(g, s.curve.r / 2); });
  let O = null, g1 = null, g2 = null;
  for (let tries = 0; tries < 8 && !O; tries++) {
    g1 = offsetCurve(s1, taus[0], -sigma * g); g2 = offsetCurve(s2, taus[1], -sigma * g);
    O = g1 && g2 ? nearest(meet(g1, g2), X) : null;
    if (!O) g /= 2;
  }
  if (O) {
    const T1o = at2(T[0], normalAt(s1, taus[0], T[0]), -sigma * g), T2o = at2(T[1], normalAt(s2, taus[1], T[1]), -sigma * g);
    out.tool = [T[0], ...along(g1, T1o, O), ...along(g2, O, T2o), T[1], ...out.arc];
    out.g = g;
  }
  return out;
}

const which = ref('rod'), rUser = ref(CASES.rod.start), held = ref(false);
const cs = computed(() => CASES[which.value]);
function pick(k) { which.value = k; rUser.value = CASES[k].start; held.value = false; }

const steps = [
  { label: 'The section across the edge', text: 'Cut square to the edge, the two faces become curves: a plane running along the edge a line, a cylinder whose axis runs along it a circle. Here the edge X is where a rod meets a plate (or, with <b>D shaft</b>, where a flat meets the rod). Round a circular edge between surfaces of revolution about its axis, the meridian section gives the same problem.', formula: 'face = line through p along d &nbsp;|&nbsp; circle about c of radius ρ &nbsp;&nbsp; w: into the face from X &nbsp; n: outward' },
  { label: 'Offset both faces by r', text: 'The ball\'s centre is r from both faces, on the corner\'s side: inside the material for a convex edge (σ = −1), outside it for a concave one (σ = +1). Each face is offset by r that way. A line moves along its normal; a circle stays a circle, its radius grown or shrunk. A circle that would shrink to nothing means the ball does not fit.', formula: 'line: p + σ r n &nbsp;&nbsp; circle: ρ + τ σ r &nbsp;&nbsp; τ = +1 when n points away from c, −1 towards it' },
  { label: 'The centre: where the offsets meet', text: 'Two offset curves meet in up to two points (line/line, line/circle, circle/circle, all exact). Kept are those whose contacts lie ahead of X on both faces; of them, the nearest to X is the centre C. None kept: no ball of this radius touches both faces.', formula: 'ahead: (foot(C) − X) · w &gt; −10⁻⁹ s on both faces &nbsp;(s: the model\'s size)' },
  { label: 'The contacts: the feet of C', text: 'Each contact is the point of a face nearest C: its foot. The ball of radius r about C touches both faces there, tangent to each.', formula: 'T<sub>line</sub> = p + ((C − p) · d) d &nbsp;&nbsp; T<sub>circle</sub> = c + ρ (C − c) / |C − c|' },
  { label: 'The arc and the tool', text: 'The fillet is the ball\'s arc from T<sub>2</sub> back to T<sub>1</sub>, the way past X. The tool is the region between the faces and the arc, grown by g = r/2 outside the corner along the faces\' own offsets (g kept to at most half a circle\'s radius where it shrinks), so no tool face lies on a body face. It is extruded along the edge (or revolved about the axis) and removed from a convex edge, added to a concave one, by one Boolean.', formula: 'profile: T<sub>1</sub> → T<sub>1</sub> grown → corner → T<sub>2</sub> grown → T<sub>2</sub> → arc → T<sub>1</sub>' },
  { label: 'Does it fit?', text: 'Each contact must lie on its face: its distance into the face (along w for a line, as an angle for a circle) at most the face\'s true reach across the edge, the least over the edge\'s length. Here r grows until a check fails. Drag the radius to try others.', formula: 'refused: [RADIUS_EXCEEDS_FACE] contact past a face\'s reach<br>refused: [RADIUS_EXCEEDS_CURVATURE] no ball fits' },
];
const s = useSteps(steps.length, [2200, 2600, 2400, 2200, 2800, 4200], root);
const k = computed(() => ease(s.t.value));
watch(() => s.step.value, () => { held.value = false; });
// The radius drawn: the reader's, or in the last step one growing past the limit.
const r = computed(() => {
  if (s.step.value === steps.length - 1 && !held.value) return rUser.value + (cs.value.max - rUser.value) * k.value;
  return rUser.value;
});
function drag(e) { rUser.value = +e.target.value; held.value = true; }
const sec = computed(() => sectionOf(cs.value, r.value));

// The view: the case's box fitted into the left 230 px of the picture.
const map = computed(() => {
  const [x0, x1, y0, y1] = cs.value.view(r.value), S = Math.min(220 / (x1 - x0), 236 / (y1 - y0)), ox = 12 + (220 - S * (x1 - x0)) / 2, oy = 248 - (236 - S * (y1 - y0)) / 2;
  return { S, f: p => [ox + S * (p[0] - x0), oy - S * (p[1] - y0)] };
});
const P = p => map.value.f(p);
const pts = ps => ps.map(p => P(p).map(v => v.toFixed(2)).join(',')).join(' ');
/** A section curve as a polyline over the view (a line clipped to the view's box, a circle whole). */
function curvePts(cv) {
  if (!cv) return '';
  if (cv.kind === 'circle') return pts(arcPoints(cv.c, cv.r, 0, TAU, 96));
  const [x0, x1, y0, y1] = cs.value.view(r.value), L = Math.hypot(x1 - x0, y1 - y0);
  return pts([at2(cv.p, cv.d, -2 * L), at2(cv.p, cv.d, 2 * L)]);
}
const offsetShown = computed(() => {
  const d = s.step.value === 1 ? k.value * r.value : r.value, x = sec.value;
  return cs.value.sides.map((sd, i) => offsetCurve(sd, x.taus[i], x.sigma * d));
});
const fadeAt = i => (s.step.value > i ? 1 : s.step.value === i ? k.value : 0);
const arcShown = computed(() => {
  const a = sec.value.arc; if (!a) return '';
  const n = s.step.value === 4 ? Math.max(1, Math.round(k.value * (a.length - 1))) : a.length - 1;
  return pts(a.slice(0, n + 1));
});
/** Words broken into lines of at most n characters. */
function wrap(text, n = 23) {
  const lines = [''];
  for (const w of text.split(' ')) { if (lines.at(-1) && (lines.at(-1) + ' ' + w).length > n) lines.push(w); else lines[lines.length - 1] = lines.at(-1) ? lines.at(-1) + ' ' + w : w; }
  return lines;
}
/** A refusal code in brackets, broken after an underscore where it would pass 20 characters. */
function codeLines(code) {
  const parts = `[${code}]`.split(/(?<=_)/), lines = [''];
  for (const p of parts) { if (lines.at(-1) && (lines.at(-1) + p).length > 20) lines.push(p); else lines[lines.length - 1] += p; }
  return lines;
}
const fits = computed(() => !sec.value.refusal);
const ballR = computed(() => Math.max(0, r.value * map.value.S));
const rows = computed(() => {
  const x = sec.value, out = [`r = ${num(r.value, 2)} mm`, x.convex ? 'convex: σ = −1' : 'concave: σ = +1'];
  if (x.C && s.step.value >= 2) out.push(`C = (${num(x.C[0], 2)}, ${num(x.C[1], 2)})`);
  if (x.need && s.step.value >= 3) x.need.forEach((n, i) => out.push(`${cs.value.sides[i].name.replace('the ', '')}: ${n.angle ? `${num(n.need * 180 / Math.PI, 1)}° of ${num(n.reach * 180 / Math.PI, 1)}°` : `${num(n.need, 2)} of ${num(n.reach, 2)} mm`}`));
  return out;
});
</script>

<template>
  <div ref="root">
    <AlgoFigure title="A fillet's section in closed form: offsets, centre, contacts" :steps="steps" :s="s">
      <svg viewBox="0 0 380 260" role="img" aria-label="A section across a filleted edge: two faces, their offsets by the radius, the ball's centre, its contacts and the fillet arc">
        <defs><clipPath id="fillet-section-view"><rect x="0" y="0" width="236" height="260" /></clipPath></defs>
        <g clip-path="url(#fillet-section-view)">
        <polygon :points="pts(cs.outline)" class="body" />
        <polyline :points="curvePts(cs.sides[0].curve)" class="face a" :style="{ opacity: 0.35 }" />
        <polyline :points="curvePts(cs.sides[1].curve)" class="face b" :style="{ opacity: 0.35 }" />
        <g v-if="s.step.value >= 4 && sec.tool && !sec.refusal" :style="{ opacity: fadeAt(4) }">
          <polygon :points="pts(sec.tool)" class="tool" />
        </g>
        <g v-if="s.step.value >= 1">
          <polyline v-for="(o, i) in offsetShown" :key="'o' + i" :points="curvePts(o)" :class="['offset', i ? 'b' : 'a']" />
        </g>
        <g v-if="s.step.value >= 2" :style="{ opacity: fadeAt(2) }">
          <g v-for="(m, i) in sec.meets" :key="'m' + i">
            <circle v-if="m.ahead" :cx="P(m.C)[0]" :cy="P(m.C)[1]" r="3.2" class="meet" />
            <g v-else :transform="`translate(${P(m.C)[0]},${P(m.C)[1]})`" class="reject"><line x1="-4" y1="-4" x2="4" y2="4" /><line x1="-4" y1="4" x2="4" y2="-4" /></g>
          </g>
        </g>
        <g v-if="s.step.value >= 3 && sec.C">
          <circle :cx="P(sec.C)[0]" :cy="P(sec.C)[1]" :r="ballR" :class="['ball', { bad: !fits }]" :style="{ opacity: fadeAt(3) }" />
          <line v-for="(T, i) in sec.T" :key="'rad' + i" :x1="P(sec.C)[0]" :y1="P(sec.C)[1]" :x2="P(sec.C)[0] + (P(T)[0] - P(sec.C)[0]) * fadeAt(3)" :y2="P(sec.C)[1] + (P(T)[1] - P(sec.C)[1]) * fadeAt(3)" class="radius" />
          <circle v-for="(T, i) in sec.T" :key="'T' + i" :cx="P(T)[0]" :cy="P(T)[1]" r="3.4" :class="['contact', { bad: sec.refusal && sec.refusal.code === 'RADIUS_EXCEEDS_FACE' && sec.need && sec.need[i].need > sec.need[i].reach }]" :style="{ opacity: fadeAt(3) }" />
          <text v-for="(T, i) in sec.T" :key="'Tl' + i" :x="P(T)[0] + cs.tags[i][0]" :y="P(T)[1] + cs.tags[i][1]" class="tag" :style="{ opacity: fadeAt(3) }">T{{ i + 1 }}</text>
        </g>
        <polyline v-if="s.step.value >= 4 && sec.arc" :points="arcShown" :class="['arc', { bad: !fits }]" />
        <g v-if="s.step.value >= 2 && sec.C">
          <circle :cx="P(sec.C)[0]" :cy="P(sec.C)[1]" r="3.6" :class="['centre', { bad: !fits }]" />
          <text :x="P(sec.C)[0] + cs.tags[2][0]" :y="P(sec.C)[1] + cs.tags[2][1]" class="tag">C</text>
        </g>
        <circle :cx="P(cs.X)[0]" :cy="P(cs.X)[1]" r="3.4" class="edge" />
        <text :x="P(cs.X)[0] + (which === 'rod' ? 5 : 6)" :y="P(cs.X)[1] + (which === 'rod' ? 14 : -7)" class="tag x">X</text>
        </g>
        <line x1="238" y1="12" x2="238" y2="248" class="split" />
        <g class="readout">
          <text x="246" y="26" class="name a">{{ cs.sides[0].name.replace('the ', '') }}: line</text>
          <text x="246" y="42" class="name b">{{ cs.sides[1].name.replace('the ', '') }}: circle ρ {{ cs.sides[1].curve.r }}</text>
          <text v-for="(row, i) in rows" :key="'row' + i" x="246" :y="68 + 16 * i">{{ row }}</text>
          <g v-if="sec.refusal && (s.step.value >= 2 || sec.refusal.code === 'RADIUS_EXCEEDS_CURVATURE' && s.step.value >= 1)">
            <text v-for="(line, i) in codeLines(sec.refusal.code)" :key="'code' + i" x="246" :y="176 + 12 * i" class="refuse">{{ line }}</text>
            <text v-for="(line, i) in wrap(sec.refusal.text)" :key="'why' + i" x="246" :y="192 + 12 * codeLines(sec.refusal.code).length + 13 * i" class="why">{{ line }}</text>
          </g>
          <text v-else-if="s.step.value >= 3 && sec.C" x="246" y="176" class="ok">fits both faces</text>
        </g>
      </svg>
      <div class="controls">
        <div class="cases" role="group" aria-label="Section">
          <button v-for="(c, key) in CASES" :key="key" type="button" :aria-pressed="which === key" @click="pick(key)">{{ c.label }}</button>
        </div>
        <label>r <input type="range" :min="cs.min" :max="cs.max" step="0.05" :value="r" aria-label="Fillet radius" @input="drag"> <span>{{ num(r, 2) }} mm</span></label>
      </div>
      <template #note>Computed in the page with the kernel's section solver on two sections across straight edges. The
        rod-on-plate case is the conformance case <code>r10/translational-rod-on-plate</code> with the plate's top cut
        to 6 mm beside the rod, so its limit (r = 9.6) fits the picture; with the case's 15 mm the reach is exactly met at
        r = 37.5. The reach of each face is given here; the kernel finds it from the face's boundary edges beside the edge.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.body { fill: var(--vp-c-bg); stroke: var(--vp-c-text-3); stroke-width: 1; }
.face { fill: none; stroke-width: 1; } .face.a { stroke: var(--a); } .face.b { stroke: var(--b); }
.offset { fill: none; stroke-width: 1.4; stroke-dasharray: 4 3; } .offset.a { stroke: var(--a); } .offset.b { stroke: var(--b); }
.tool { fill: var(--keep); fill-opacity: 0.16; stroke: var(--keep); stroke-width: 0.8; stroke-dasharray: 2 2; }
.meet { fill: var(--vp-c-bg); stroke: var(--vp-c-text-1); stroke-width: 1.4; }
.reject line { stroke: var(--vp-c-text-3); stroke-width: 1.6; }
.ball { fill: var(--keep); fill-opacity: 0.08; stroke: var(--keep); stroke-width: 1; stroke-dasharray: 3 3; }
.ball.bad { fill: var(--hot); stroke: var(--hot); }
.radius { stroke: var(--vp-c-text-2); stroke-width: 1; }
.contact { fill: var(--keep); stroke: var(--vp-c-bg); stroke-width: 1; } .contact.bad { fill: var(--hot); }
.arc { fill: none; stroke: var(--keep); stroke-width: 3; stroke-linecap: round; } .arc.bad { stroke: var(--hot); }
.centre { fill: var(--vp-c-text-1); } .centre.bad { fill: var(--hot); }
.edge { fill: var(--vp-c-bg); stroke: var(--hot); stroke-width: 2; }
.tag { font-weight: 700; fill: var(--vp-c-text-1); } .tag.x { fill: var(--hot); }
.readout text { font-size: 11px; }
.split { stroke: var(--vp-c-divider); stroke-width: 1; }
.name { font-weight: 700; } .name.a { fill: var(--a); } .name.b { fill: var(--b); }
.refuse { fill: var(--hot); font-weight: 700; font-size: 9.5px; }
.ok { fill: var(--keep); font-weight: 700; }
.readout .why { font-size: 10.5px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 8px 16px; border-top: 1px solid var(--vp-c-divider); font-size: 13px; }
.cases { display: flex; gap: 4px; }
.cases button { border: 1px solid var(--vp-c-divider); border-radius: 5px; padding: 3px 10px; font-size: 13px; background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.cases button[aria-pressed='true'] { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: var(--vp-c-white); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
label { display: flex; align-items: center; gap: 8px; color: var(--vp-c-text-2); }
label input { width: 150px; }
label span { min-width: 64px; font-variant-numeric: tabular-nums; color: var(--vp-c-text-1); }
</style>
