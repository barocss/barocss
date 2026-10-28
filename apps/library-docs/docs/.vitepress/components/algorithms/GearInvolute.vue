<script setup>
// The involute spur gear (packages/barocss-cad/src/machine/gear.ts) on the kernel's test gear: m 2, z 20, α 20°, no
// profile shift (test/gear.test.mjs's fixture). The circles, the half thickness ψ(r), the C¹ Hermite fit of a flank and
// its measured deviation (flankPoles, flankDeviation), the schematic root and the generated root's tool and envelope
// (rackRoot, filletPoint, spur case) are the kernel's formulas, run here in the page. The numbers they give match the
// built kernel's report (dist/index.js, spurGearProfile): 3 flank pieces at 4.80e-5 mm; generated: form Ø37.640.
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, num, useSteps } from './useSteps.mjs';

const root = ref(null);
const M = 2, Z = 20, ALPHA = 20 * Math.PI / 180;
const inv = p => Math.tan(p) - p;
const R = M * Z / 2, RB = R * Math.cos(ALPHA), RA = R + M, RF = R - 1.25 * M, S = Math.PI * M / 2;
const PSI = S / (2 * R) + inv(ALPHA), T1 = Math.sqrt((RA / RB) ** 2 - 1), PSI_TIP = PSI - inv(Math.acos(RB / RA));
const GAM = Math.PI / 2, STEP = 2 * Math.PI / Z, TOL = 1e-4 * M;

const rot = (p, a) => [Math.cos(a) * p[0] - Math.sin(a) * p[1], Math.sin(a) * p[0] + Math.cos(a) * p[1]];
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
/** The involute at roll t (from the base circle at angle 0, unwinding counter-clockwise) and its derivative. */
const invo = t => [RB * (Math.cos(t) + t * Math.sin(t)), RB * (Math.sin(t) - t * Math.cos(t))];
const invoD = t => [RB * t * Math.cos(t), RB * t * Math.sin(t)];
/** The kernel's flankPoles: N C¹ Hermite cubic pieces over the roll t0 → t1, turned by `turn`. */
function flankPoles(t0, t1, N, turn) {
  const out = [];
  for (let k = 0; k < N; k++) {
    const ta = t0 + (t1 - t0) * k / N, tb = t0 + (t1 - t0) * (k + 1) / N, h = tb - ta, P0 = invo(ta), P3 = invo(tb), D0 = invoD(ta), D3 = invoD(tb);
    if (k === 0) out.push(rot(P0, turn));
    out.push(rot([P0[0] + h / 3 * D0[0], P0[1] + h / 3 * D0[1]], turn), rot([P3[0] - h / 3 * D3[0], P3[1] - h / 3 * D3[1]], turn), rot(P3, turn));
  }
  return out;
}
/** The kernel's flankDeviation: the fit's largest distance from the involute, along the circle at each radius, 65 points a piece. */
function flankDeviation(t0, t1, N) {
  const P = flankPoles(t0, t1, N, 0);
  let worst = 0;
  for (let k = 0; k < N; k++) for (let i = 0; i <= 64; i++) {
    const s = i / 64, u = 1 - s, a = P[3 * k], b = P[3 * k + 1], c = P[3 * k + 2], d = P[3 * k + 3];
    const x = u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * d[0], y = u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * d[1];
    const rho = Math.hypot(x, y), t = Math.sqrt(Math.max(0, (rho / RB) ** 2 - 1)), q = invo(t);
    let da = Math.atan2(y, x) - Math.atan2(q[1], q[0]); if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    worst = Math.max(worst, Math.abs(da) * rho);
  }
  return worst;
}
const DEV = [1, 2, 3].map(N => flankDeviation(0, T1, N)); // 2.81e-3, 2.21e-4, 4.80e-5 mm
const POLES = [1, 2, 3].map(N => flankPoles(0, T1, N, GAM - PSI));

// The generated root (spur, x 0, no thickness reduction): the basic rack's tip round ρ = 0.38 m, its centre (xc, yc)
// with the gear at 0, in the kernel's frame (the tooth space on +Y); turned here by π/z so the tooth it bounds is ours.
const RHO = 0.38 * M, HC = 1.25 * M - RHO, TA = Math.tan(ALPHA);
const XC = Math.PI * M / 4 - HC * TA - RHO / Math.cos(ALPHA), YC = R - HC, PHI_ROOT = XC / R, PHI_END = (XC - (R - YC) / TA) / R;
function filletPoint(phi) {
  const c = Math.cos(phi), s = Math.sin(phi), dx = XC - R * phi, dy = YC - R, L = Math.hypot(dx, dy), wx = dx + RHO * dx / L, wy = YC + RHO * dy / L;
  return rot([c * wx + s * wy, -s * wx + c * wy], Math.PI / Z);
}
const R_START = Math.hypot(...filletPoint(PHI_END)); // 18.820 mm: the form circle Ø37.640
const T0G = Math.sqrt((R_START / RB) ** 2 - 1);
/** The rack's tooth (the tool) in the gear's frame at the gear's turn φ: its two flanks, tip rounds and flat tip. */
function toolOutline(phi) {
  const pts = [], top = R + 1.1 * M, ca = Math.cos(ALPHA), sa = Math.sin(ALPHA);
  const side = sgn => { const tx = sgn * (XC + RHO * ca), ty = YC - RHO * sa, s = (top - ty) / ca; return [[tx + sgn * s * sa, top], [tx, ty]]; };
  const [lTop, lTan] = side(-1);
  pts.push(lTop, lTan);
  for (let i = 0; i <= 8; i++) { const a = Math.PI + ALPHA + (Math.PI / 2 - ALPHA) * i / 8; pts.push([-XC + RHO * Math.cos(a), YC + RHO * Math.sin(a)]); }
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (Math.PI / 2 - ALPHA) * i / 8; pts.push([XC + RHO * Math.cos(a), YC + RHO * Math.sin(a)]); }
  const [rTop, rTan] = side(1);
  pts.push(rTan, rTop);
  const c = Math.cos(phi), s = Math.sin(phi);
  return pts.map(([x, y]) => rot([c * (x - R * phi) + s * y, -s * (x - R * phi) + c * y], Math.PI / Z));
}
const toolCentre = phi => { const c = Math.cos(phi), s = Math.sin(phi), x = XC - R * phi; return rot([c * x + s * YC, -s * x + c * YC], Math.PI / Z); };

// One tooth, counter-clockwise from the middle of the space before it to the middle of the space after it.
const arcPts = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => polar(r, a0 + (a1 - a0) * i / n));
const flankL = (t0, t1, n) => Array.from({ length: n + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / n; return rot(invo(t), GAM - PSI); });
const flankR = (t0, t1, n) => Array.from({ length: n + 1 }, (_, i) => { const t = t1 - (t1 - t0) * i / n, p = invo(t); return rot([p[0], -p[1]], GAM + PSI); });
const mirror = p => [-p[0], p[1]];
const filletPts = (n, back) => Array.from({ length: n + 1 }, (_, i) => filletPoint(back ? PHI_END + (PHI_ROOT - PHI_END) * i / n : PHI_ROOT + (PHI_END - PHI_ROOT) * i / n));
const TOOTH_SCHEMATIC = [...arcPts(RF, GAM - STEP / 2, GAM - PSI, 5), polar(RB, GAM - PSI), ...flankL(0, T1, 18), ...arcPts(RA, GAM - PSI_TIP, GAM + PSI_TIP, 5), ...flankR(0, T1, 18), ...arcPts(RF, GAM + PSI, GAM + STEP / 2, 5)];
const TOOTH_GENERATED = [...arcPts(RF, GAM - STEP / 2, GAM - STEP / 2 + PHI_ROOT, 1), ...filletPts(24, false).map(mirror), ...flankL(T0G, T1, 18), ...arcPts(RA, GAM - PSI_TIP, GAM + PSI_TIP, 5), ...flankR(T0G, T1, 18), ...filletPts(24, true), ...arcPts(RF, GAM + STEP / 2 - PHI_ROOT, GAM + STEP / 2, 1)];
const pattern = (tooth, n) => { const out = []; for (let k = 0; k < n; k++) for (const p of tooth) out.push(rot(p, STEP * k)); return out; };
const GEAR_SCHEMATIC = pattern(TOOTH_SCHEMATIC, Z), GEAR_GENERATED = pattern(TOOTH_GENERATED, Z), PER_TOOTH = TOOTH_SCHEMATIC.length;
const ENVELOPE = Array.from({ length: 61 }, (_, i) => PHI_ROOT + (PHI_END - PHI_ROOT) * i / 60);

// The views: a tooth close up, the whole gear, the root close up (mm → px).
const DETAIL = { cx: -2, cy: 19, sc: 17 }, WHOLE = { cx: 0, cy: 0, sc: 4.8 }, ROOTV = { cx: -2.9, cy: 19.0, sc: 24 };
const mix = (a, b, u) => ({ cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, sc: a.sc * (b.sc / a.sc) ** u });

const sup = n => String(n).split('').map(ch => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]).join('');
const sci = x => { const e = Math.floor(Math.log10(x)); return `${(x / 10 ** e).toFixed(2)} × 10${sup(e)}`; };

const steps = [
  { label: 'Four circles from three numbers', text: `The module m, the number of teeth z and the pressure angle α fix the gear's circles. This is the kernel's test gear: m = 2 mm, z = 20, α = 20°. The reference (pitch) circle is where two gears roll on each other; the involute flanks grow out of the base circle; the teeth run from the root circle to the tip circle.`, formula: 'd = m z = 40 &nbsp; d<sub>b</sub> = d cos α = 37.588 &nbsp; d<sub>a</sub> = d + 2m = 44 &nbsp; d<sub>f</sub> = d − 2.5m = 35 (mm)' },
  { label: 'Unwind a string from the base circle', text: `A taut string unwound from the base circle traces the involute with its end. At roll angle t the string has come off a length r<sub>b</sub> t and leaves the circle at a right angle to its radius, so the curve's normal is always tangent to the base circle. The flank runs from the base circle (t = 0) to the tip circle (t = ${num(T1, 4)}).`, formula: 'X(t) = r<sub>b</sub> (cos t + t sin t), &nbsp; Y(t) = r<sub>b</sub> (sin t − t cos t), &nbsp; r(t) = r<sub>b</sub> √(1 + t²)' },
  { label: 'Place the two flanks', text: `The tooth is s = πm/2 = ${num(S, 4)} mm thick on the reference circle; that sets where its flanks stand. At radius r the half thickness, as an angle about the gear's centre, is ψ(r). One flank is the involute turned to γ − ψ(r<sub>b</sub>) (γ the tooth's middle), the other its mirror turned to γ + ψ(r<sub>b</sub>). At the tip, ψ gives a land ${num(2 * RA * PSI_TIP, 3)} mm wide; a tooth that comes to a point below its tip is refused (SELF_INTERSECTION).`, formula: 'inv φ = tan φ − φ, &nbsp; φ(r) = acos(r<sub>b</sub> / r)<br>ψ(r) = s/d + inv α − inv φ(r), &nbsp; ψ(r<sub>b</sub>) = 0.07854 + 0.01490 = 0.09344' },
  { label: 'Fit the flank with cubic pieces', text: `The kernel has no involute curve type: each flank is a cubic B-spline fitted to it. The roll range is cut into N equal pieces, each matching the involute's point and tangent at both ends (C¹ Hermite). The fit's distance from the involute is measured at 65 points a piece, along the circle at each radius. N grows until it is within the profile tolerance, 10⁻⁴ m = ${sci(TOL)} mm: here N = 1 is ${sci(DEV[0])} mm off, N = 2 ${sci(DEV[1])}, N = 3 ${sci(DEV[2])}. Three it is. Past five pieces the gear is refused (PROFILE_BUDGET_EXCEEDED); the tolerance is never loosened.`, formula: 'piece [t<sub>a</sub>, t<sub>b</sub>], h = t<sub>b</sub> − t<sub>a</sub>: &nbsp; P(t<sub>a</sub>), &nbsp; P(t<sub>a</sub>) + h/3 · P′(t<sub>a</sub>), &nbsp; P(t<sub>b</sub>) − h/3 · P′(t<sub>b</sub>), &nbsp; P(t<sub>b</sub>)<br>P′(t) = r<sub>b</sub> t (cos t, sin t)' },
  { label: 'Tip, root and the join', text: 'The tip is an arc of the tip circle (an exact rational quadratic). Here the root circle (Ø35) lies inside the base circle (Ø37.588), where the involute does not exist. By default a radial line joins the flank to the root circle, and a root arc runs to the next tooth. That root is schematic, not the one a cutter makes, and the report says so: ROOT_TRANSITION_UNVALIDATED, manufacturingValidated false.' },
  { label: 'Repeat the tooth, pull it through the width', text: `The tooth's six curves, repeated z times about the axis, make the closed profile. It is pulled through the face width: each curve becomes a side face with its own name (flankL#k, flankR#k, tip#k, root#k, rootL#k, rootR#k), plus the two planar ends, so 20 × 6 + 2 = 122 faces. A helical gear turns the profile by z tan β / r as it rises, with a cubic fit of the rotation, again within the tolerance.` },
  { label: 'The root a rack would cut', text: `With rootPolicy 'generated' the root is the one the basic rack cuts as the gear rolls on it: while the gear turns φ, the rack moves −rφ. The rack's tip round (radius ρ = 0.38 m = ${num(RHO, 3)} mm) sweeps an envelope, in closed form: at each φ it touches the gear where the line from the pitch point through the round's centre leaves the round. The fillet meets the involute tangentially at the form circle Ø${num(2 * R_START, 3)}, just outside the base circle; the kernel fits it with 7 cubic pieces, within ${sci(1.4959e-4)} mm.`, formula: 'form circle: √(r<sub>b</sub>² + (r sin α − h<sub>F</sub> / sin α)²), &nbsp; h<sub>F</sub> = (1.25 − x) m − ρ (1 − sin α)' },
];
const s = useSteps(steps.length, [3000, 4200, 3600, 5400, 3200, 4200, 5200], root);
const k = computed(() => ease(s.t.value));
const st = computed(() => s.step.value);

const view = computed(() => st.value < 5 ? DETAIL : st.value === 5 ? mix(DETAIL, WHOLE, k.value) : mix(WHOLE, ROOTV, k.value));
const X = (p, v) => 190 + v.sc * (p[0] - v.cx), Y = (p, v) => 128 - v.sc * (p[1] - v.cy);
const line = pts => { const v = view.value; let d = ''; for (let i = 0; i < pts.length; i++) d += `${i ? 'L' : 'M'}${X(pts[i], v).toFixed(1)},${Y(pts[i], v).toFixed(1)}`; return d; };
const pt = p => { const v = view.value; return [X(p, v), Y(p, v)]; };
const circle = r => { const v = view.value; return { cx: X([0, 0], v), cy: Y([0, 0], v), r: Math.max(0.1, r * v.sc) }; };
const CIRCLES = [{ r: RA, label: 'tip Ø44' }, { r: R, label: 'reference Ø40' }, { r: RB, label: 'base Ø37.588' }, { r: RF, label: 'root Ø35' }];
const circleLabels = CIRCLES.map(c => ({ ...c, y: Y([0, Math.sqrt(c.r * c.r - 4.47 ** 2)], DETAIL) - 4 }));

// Step 2: the string and the traced flank.
const roll = computed(() => st.value < 1 ? 0 : st.value === 1 ? k.value * T1 : T1);
const stringEnd = computed(() => rot(invo(roll.value), GAM - PSI));
const stringFrom = computed(() => polar(RB, GAM - PSI + roll.value));
const traced = computed(() => line(flankL(0, Math.max(1e-6, roll.value), 40)));
// Step 3 onward: the other flank, the thickness on the reference circle.
const thickness = arcPts(R, GAM - S / (2 * R), GAM + S / (2 * R), 16);
const flankRPath = computed(() => line(flankR(0, T1, 40)));
const thickPath = computed(() => line(thickness));
const rays = computed(() => [GAM - PSI, GAM + PSI].map(a => line([polar(RF - 0.6, a), polar(RA + 0.6, a)])));
// Step 4: the fit, N = 1, 2, 3 in turn.
const fitN = computed(() => st.value < 3 ? 3 : st.value === 3 ? 1 + Math.min(2, Math.floor(s.t.value * 3)) : 3);
const fitPolygon = computed(() => line(POLES[fitN.value - 1]));
const fitCurve = computed(() => { const P = POLES[fitN.value - 1], v = view.value, q = p => `${X(p, v).toFixed(1)},${Y(p, v).toFixed(1)}`; let d = `M${q(P[0])}`; for (let i = 1; i < P.length; i += 3) d += `C${q(P[i])} ${q(P[i + 1])} ${q(P[i + 2])}`; return d; });
const fitPoles = computed(() => POLES[fitN.value - 1].map(pt));
const bar = d => 8 + 70 * (Math.log10(d) + 5) / 3;
// Step 5: tip, joins, root.
const tipPath = computed(() => line(arcPts(RA, GAM - PSI_TIP, GAM + PSI_TIP, 12)));
const joinPaths = computed(() => [GAM - PSI, GAM + PSI].map(a => line([polar(RF, a), polar(RB, a)])));
const rootPaths = computed(() => [line(arcPts(RF, GAM - STEP / 2, GAM - PSI, 8)), line(arcPts(RF, GAM + PSI, GAM + STEP / 2, 8))]);
// Step 6: the teeth repeated.
const teethShown = computed(() => st.value < 5 ? 1 : st.value === 5 ? Math.min(Z, 1 + Math.floor(k.value * Z)) : Z);
const gearPath = computed(() => line(GEAR_SCHEMATIC.slice(0, teethShown.value * PER_TOOTH)) + (teethShown.value === Z ? 'Z' : ''));
// Step 7: the rack's tip round rolling, its envelope.
const phiNow = computed(() => st.value < 6 ? PHI_ROOT : PHI_ROOT + (PHI_END - PHI_ROOT) * Math.min(1, Math.max(0, (s.t.value - 0.25) / 0.7)));
const generatedPath = computed(() => line(GEAR_GENERATED) + 'Z');
const toolPath = computed(() => line(toolOutline(phiNow.value)));
const ghosts = computed(() => { const out = []; for (let i = 0; i <= 6; i++) { const phi = PHI_ROOT + (PHI_END - PHI_ROOT) * i / 6; if ((phi - phiNow.value) * Math.sign(PHI_END - PHI_ROOT) <= 1e-12) out.push(pt(toolCentre(phi))); } return out; });
const envelopePath = computed(() => { const pts = ENVELOPE.filter(phi => (phi - phiNow.value) * Math.sign(PHI_END - PHI_ROOT) <= 1e-12).map(filletPoint); return pts.length > 1 ? line(pts) : ''; });
const toolDot = computed(() => pt(filletPoint(phiNow.value)));
</script>

<template>
  <div ref="root">
    <AlgoFigure title="An involute spur gear, from its circles to the solid" :steps="steps" :s="s">
      <svg viewBox="0 0 380 256" role="img" aria-label="A spur gear tooth built from the base circle's involute, then repeated twenty times">
        <defs><clipPath id="gear-involute-clip"><rect x="0" y="0" width="380" height="256" /></clipPath></defs>
        <g clip-path="url(#gear-involute-clip)">
          <!-- The circles. -->
          <circle v-for="c in CIRCLES" :key="c.r" v-bind="circle(c.r)" class="ring" :class="{ base: c.r === RB, ref: c.r === R }" :style="{ opacity: st >= 5 ? 0.55 : 1 }" />
          <!-- The whole gear (step 6), the generated one (step 7). -->
          <path v-if="st === 5" :d="gearPath" class="gear" :class="{ closed: teethShown === Z }" />
          <g v-if="st === 6">
            <path :d="generatedPath" class="gear closed" />
            <path :d="toolPath" class="tool" />
            <circle v-for="(g, i) in ghosts" :key="'g' + i" :cx="g[0]" :cy="g[1]" :r="RHO * view.sc" class="ghost" />
            <path v-if="envelopePath" :d="envelopePath" class="envelope" />
            <circle :cx="toolDot[0]" :cy="toolDot[1]" r="3.5" class="dot hot" />
          </g>
          <!-- One tooth, built up (steps 1–5). -->
          <g v-if="st <= 4">
            <path v-if="st >= 2" :d="flankRPath" class="flank" :style="{ opacity: st === 2 ? k : 1 }" />
            <path v-if="st === 1" :d="traced" class="flank" />
            <path v-if="st >= 2 && st !== 3" :d="traced" class="flank" />
            <g v-if="st === 1">
              <line :x1="pt(stringFrom)[0]" :y1="pt(stringFrom)[1]" :x2="pt(stringEnd)[0]" :y2="pt(stringEnd)[1]" class="string" />
              <circle :cx="pt(stringFrom)[0]" :cy="pt(stringFrom)[1]" r="3" class="dot b" />
              <circle :cx="pt(stringEnd)[0]" :cy="pt(stringEnd)[1]" r="3.8" class="dot hot" />
            </g>
            <g v-if="st === 2">
              <path v-for="(r, i) in rays" :key="'ray' + i" :d="r" class="ray" />
              <path :d="thickPath" class="thick" :style="{ opacity: k }" />
              <text :x="pt(polar(R, GAM))[0]" :y="pt(polar(R, GAM))[1] + 16" class="tag" text-anchor="middle">s = π m / 2</text>
            </g>
            <g v-if="st === 3">
              <path :d="fitPolygon" class="polygon" />
              <path :d="fitCurve" class="flank fit" />
              <rect v-for="(p, i) in fitPoles" :key="'pole' + i" :x="p[0] - 2.6" :y="p[1] - 2.6" width="5.2" height="5.2" class="pole" :class="{ end: i % 3 === 0 }" />
            </g>
            <g v-if="st === 4">
              <path :d="tipPath" class="flank part" /><path v-for="(d, i) in joinPaths" :key="'j' + i" :d="d" class="flank part" />
              <path v-for="(d, i) in rootPaths" :key="'rt' + i" :d="d" class="flank part" />
              <text :x="pt(polar(RA, GAM))[0]" :y="pt(polar(RA, GAM))[1] - 6" class="tag" text-anchor="middle">tip arc</text>
              <text :x="pt(polar(RB, GAM - PSI))[0] + 8" :y="pt(polar((RB + RF) / 2, GAM - PSI))[1] + 4" class="tag">radial join</text>
            </g>
          </g>
          <!-- Circle names (close-up steps). -->
          <g v-if="st <= 4" class="names">
            <text v-for="c in circleLabels" :key="'n' + c.r" x="300" :y="c.y" :class="{ base: c.r === RB, ref: c.r === R }">{{ c.label }}</text>
          </g>
          <g v-if="st === 6" class="names">
            <text x="12" y="240">form circle Ø{{ num(2 * R_START, 3) }} · base Ø{{ num(2 * RB, 3) }}</text>
          </g>
        </g>
        <!-- Readouts. -->
        <g class="readout">
          <text x="12" y="20">m 2 · z 20 · α 20°</text>
          <text v-if="st === 1" x="12" y="36">t = {{ num(roll, 4) }} · string r<tspan baseline-shift="sub" font-size="8">b</tspan>t = {{ num(RB * roll, 3) }} mm · r = {{ num(RB * Math.sqrt(1 + roll * roll), 3) }}</text>
          <text v-if="st === 2" x="12" y="36">ψ(r<tspan baseline-shift="sub" font-size="8">b</tspan>) = {{ num(PSI, 5) }} rad · tip land {{ num(2 * RA * PSI_TIP, 3) }} mm</text>
          <text v-if="st === 4" x="12" y="36">rootL / rootR: base circle → root circle</text>
          <text v-if="st === 5" x="12" y="36">{{ teethShown }} / 20 teeth · {{ teethShown === Z ? '122 faces' : '' }}</text>
          <text v-if="st === 6" x="12" y="36">ρ = {{ num(RHO, 2) }} mm · φ = {{ num(phiNow, 4) }} rad</text>
        </g>
        <!-- The fit's deviation per N (step 4), log scale. -->
        <g v-if="st === 3" class="inset">
          <rect x="250" y="160" width="122" height="84" rx="6" class="panel" />
          <text x="258" y="175" class="small">deviation (mm, log)</text>
          <line :x1="250 + bar(TOL)" y1="180" :x2="250 + bar(TOL)" y2="236" class="tolline" />
          <text :x="250 + bar(TOL) + 3" y="240" class="small hot">tol</text>
          <g v-for="(d, i) in DEV" :key="'dev' + i" :style="{ opacity: i < fitN ? 1 : 0.25 }">
            <rect x="258" :y="184 + 16 * i" :width="bar(d)" height="9" class="devbar" :class="{ ok: d <= TOL }" />
            <text x="254" :y="192 + 16 * i" class="small" text-anchor="end">{{ i + 1 }}</text>
            <text :x="262 + bar(d)" :y="192 + 16 * i" class="small">{{ sci(d) }}</text>
          </g>
        </g>
      </svg>
      <template #note>Computed in the page with the kernel's formulas on its test gear (m 2, z 20, α 20°, no shift): the
        involute, ψ(r), the Hermite fit and its deviation, the rack's tip round and its envelope. The fillet's seven pieces
        and their deviation are the built kernel's report (spurGearProfile); the page draws the envelope itself. The fitted
        flank and the involute differ by less than a thousandth of a pixel here, so the fit's error is shown as numbers.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
svg .small { font-size: 10px; }
.ring { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.9; stroke-dasharray: 4 3; }
.ring.base { stroke: var(--b); stroke-dasharray: none; stroke-width: 1.2; }
.ring.ref { stroke: var(--a); stroke-dasharray: 6 3; }
.names text { font-size: 10px; } .names .base { fill: var(--b); } .names .ref { fill: var(--a); }
.flank { fill: none; stroke: var(--keep); stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
.flank.part { stroke: var(--a); stroke-width: 2; }
.flank.fit { stroke-width: 2.6; }
.gear { fill: none; stroke: var(--a); stroke-width: 1.3; stroke-linejoin: round; }
.gear.closed { fill: color-mix(in srgb, var(--a) 14%, transparent); }
.string { stroke: var(--b); stroke-width: 1.6; }
.dot { stroke: var(--vp-c-bg); stroke-width: 1; } .dot.b { fill: var(--b); } .dot.hot { fill: var(--hot); }
.ray { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; stroke-dasharray: 3 3; }
.thick { fill: none; stroke: var(--hot); stroke-width: 3; stroke-linecap: round; }
.tag { fill: var(--hot); font-weight: 600; font-size: 10px; }
.polygon { fill: none; stroke: var(--vp-c-text-3); stroke-width: 1; }
.pole { fill: var(--vp-c-bg); stroke: var(--b); stroke-width: 1.4; } .pole.end { fill: var(--b); }
.tool { fill: color-mix(in srgb, var(--b) 18%, transparent); stroke: var(--b); stroke-width: 1.4; stroke-linejoin: round; }
.ghost { fill: none; stroke: var(--b); stroke-width: 0.8; opacity: 0.45; }
.envelope { fill: none; stroke: var(--hot); stroke-width: 2.6; stroke-linecap: round; }
.readout text { font-family: var(--vp-font-family-mono); font-size: 10.5px; fill: var(--vp-c-text-1); paint-order: stroke; stroke: var(--vp-c-bg-soft); stroke-width: 3px; stroke-linejoin: round; }
.panel { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); }
.tolline { stroke: var(--hot); stroke-width: 1.2; stroke-dasharray: 3 2; }
.devbar { fill: color-mix(in srgb, var(--b) 60%, transparent); } .devbar.ok { fill: var(--keep); }
.inset .hot { fill: var(--hot); }
</style>
