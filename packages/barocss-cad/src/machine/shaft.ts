// R12c.3a (D156): shafts — steps along an axis, revolved exactly, with shoulder fillets, end chamfers, undercuts and
// ring grooves in the profile; keyseats (square, end-mill or disc-cutter ends) and cross holes cut by the analytic
// Boolean. Every size is the user's (a key's, a ring's or a pin's from their own rows: none built in, D139).
//
// The shaft in its own frame: its axis +Z from z 0, step 1 first. Its half-section (x the radius) walks from the axis at
// z 0 out along the first end, along each step and shoulder, and back down the last end to the axis; each piece is
// tagged, so its revolved face is named (R10a's side tags; each revolved face comes in two halves, `#1` and `#2`, one
// face in the studio):
//   `<id>.end0`, `.end1`, `.chamfer0`, `.chamfer1`; `.seatk` (step k's cylinder; a piece after a groove or an undercut
//   `.seatk.2`, `.seatk.3` …); `.shoulders` (between steps s and s + 1); `.fillets` (that shoulder's inner corner);
//   `.undercuts` and `.undercutwalls` (its relief); `.grooveg`, `.groovewallg.1`, `.groovewallg.2` (the shaft's g-th
//   groove, counted from z 0); `.keyseatj`, `.holej` (the tools' faces, in the order given). (The index is no `#k`
//   suffix: a Boolean reads a trailing `#k` as a piece number and numbers the pieces again, D156.)
// - A shoulder fillet of radius ρ joins the smaller step's seat to the shoulder: a concave quarter circle.
// - An undercut is a rectangular relief { width, depth } in the smaller step against its shoulder (not with a fillet).
// - A ring groove on a step: { diameter (its bottom), width, at (from the step's start) }.
// - A keyseat on a step: { width b, depth t1 (from the step's cylinder, on the seat's centre line), length, offset (from
//   the step's start), ends, angle (degrees about the axis from +X, default 0), cutterRadius (disc) }:
//   square — a box; end-mill — a stadium of radius b/2, `length` overall; disc — a flat floor `length` long running out
//   at each end along the cutter's circle (radius R_c > t1, its centre R − t1 + R_c from the axis), the seat at the
//   surface longer by 2√(R_c² − (R_c − t1)²).
// - A cross hole { diameter, at (z), angle (degrees about the axis from +X, default 90) } runs through the shaft.
import type { Brep } from '../brep/brep-core.js';
import { booleanAnalytic } from '../brep/analytic-boolean.js';
import { transformBrep } from '../brep/brep-transform.js';
import { evaluateCadPart, outputOf } from '../part/part-model.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';

export type ShaftDiagnosticCode = 'INVALID_INPUT' | 'SHAFT_STEPS' | 'KEYSEAT_DIMENSIONS' | 'GROOVE_DIMENSIONS' | 'HOLE_DIMENSIONS';
/** This module's refusal (R7.3a batch 2: the ShaftError class folded, D279): a BarocssError, `details.source` 'shaft'. */
export const shaftError = (code: ShaftDiagnosticCode, detail: string) => kernelRefusal('shaft', code, `shaft: ${detail}`) as KernelError & { readonly code: ShaftDiagnosticCode };
/** Whether something thrown is this module's refusal. */
export const isShaftError = (e: unknown): e is KernelError & { readonly code: ShaftDiagnosticCode } => isFrom<ShaftDiagnosticCode>(e, 'shaft');
export interface ShaftGroove { readonly diameterMM: number; readonly widthMM: number; readonly atMM: number }
export interface ShaftKeyseat { readonly widthMM: number; readonly depthMM: number; readonly lengthMM: number; readonly offsetMM: number; readonly ends?: 'square' | 'end-mill' | 'disc'; readonly cutterRadiusMM?: number; readonly angleDeg?: number }
export interface ShaftHole { readonly diameterMM: number; readonly atMM: number; readonly angleDeg?: number }
export interface ShaftStep {
  readonly diameterMM: number; readonly lengthMM: number;
  /** The fillet at the shoulder after this step (its radius, in the smaller step's corner). */
  readonly filletMM?: number;
  /** A relief in the smaller step against the shoulder after this step. */
  readonly undercut?: { readonly widthMM: number; readonly depthMM: number };
  readonly grooves?: readonly ShaftGroove[];
  readonly keyseats?: readonly ShaftKeyseat[];
}
export interface ShaftSpec {
  readonly steps: readonly ShaftStep[];
  /** 45° chamfers at the two ends (their legs, mm). */
  readonly chamfersMM?: readonly [number, number];
  readonly holes?: readonly ShaftHole[];
}
export interface ShaftKeyseatReport { readonly index: number; readonly step: number; readonly ends: 'square' | 'end-mill' | 'disc'; readonly widthMM: number; readonly depthMM: number; readonly lengthMM: number; readonly fromMM: number; readonly floorRadiusMM: number; readonly surfaceLengthMM: number; readonly angleDeg: number; readonly cutterRadiusMM?: number }
export interface ShaftReport {
  readonly generator: 'shaft@0';
  readonly lengthMM: number;
  readonly steps: readonly { readonly index: number; readonly diameterMM: number; readonly fromMM: number; readonly toMM: number }[];
  readonly keyseats: readonly ShaftKeyseatReport[];
  readonly grooves: readonly { readonly index: number; readonly step: number; readonly diameterMM: number; readonly widthMM: number; readonly fromMM: number }[];
  readonly holes: readonly { readonly index: number; readonly diameterMM: number; readonly atMM: number; readonly angleDeg: number }[];
  /** Each shoulder s (between steps s and s + 1): where it stands, the two diameters, its fillet and undercut (R12c.4's seats read them). */
  readonly shoulders: readonly { readonly index: number; readonly atMM: number; readonly beforeMM: number; readonly afterMM: number; readonly filletMM: number; readonly undercut?: { readonly widthMM: number; readonly depthMM: number } }[];
  readonly manufacturingValidated: false;
}

const fail = (code: ShaftDiagnosticCode, detail: string): never => { throw shaftError(code, detail); };
const pos = (v: unknown, what: string, code: ShaftDiagnosticCode): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fail(code, `${what} must be a number of mm above 0`));
const nonneg = (v: unknown, what: string, code: ShaftDiagnosticCode): number => (v === undefined ? 0 : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail(code, `${what} must be a number of mm, 0 or more`));
const ang = (v: unknown, what: string, dflt: number): number => (v === undefined ? dflt : typeof v === 'number' && Number.isFinite(v) ? v : fail('INVALID_INPUT', `${what} must be a number of degrees`));
type Seg = { kind: 'line'; start: [number, number] } | { kind: 'arc'; start: [number, number]; center: [number, number]; direction: 'cw' | 'ccw' };
/** A face name as a side tag (letters, digits, _ and -): `.` as `-`; and back. */
const tagOf = (name: string) => name.replace(/\./g, '-');
const nameOf = (t: string) => t.replace(/-/g, '.');
const EPS = 1e-9;

type Dip = { from: number; to: number; r: number; kind: 'undercut' | 'groove'; n: number; w: number };
/** The checked spec's half-section: its outline pieces and their face names. */
function section(spec: ShaftSpec): { segs: Seg[]; names: string[]; z: number[]; grooves: ShaftReport['grooves'] } {
  if (!Array.isArray(spec.steps) || !spec.steps.length) fail('SHAFT_STEPS', 'a shaft needs at least one step');
  const steps = spec.steps, n = steps.length, z = [0], R: number[] = [];
  steps.forEach((s, k) => { R.push(pos(s.diameterMM, `step ${k + 1}'s diameter`, 'SHAFT_STEPS') / 2); z.push(z[k] + pos(s.lengthMM, `step ${k + 1}'s length`, 'SHAFT_STEPS')); });
  for (let k = 0; k + 1 < n; k++) if (Math.abs(R[k] - R[k + 1]) < EPS) fail('SHAFT_STEPS', `steps ${k + 1} and ${k + 2} have one diameter: make them one step`);
  const ch = spec.chamfersMM ?? [0, 0];
  if (!Array.isArray(ch) || ch.length !== 2) fail('SHAFT_STEPS', 'chamfersMM must be [start, end]');
  const c0 = nonneg(ch[0], 'the start chamfer', 'SHAFT_STEPS'), c1 = nonneg(ch[1], 'the end chamfer', 'SHAFT_STEPS');
  // Each shoulder's treatment, on its smaller step.
  const fil: number[] = [], und: ({ widthMM: number; depthMM: number } | undefined)[] = [];
  for (let k = 0; k < n; k++) {
    const s = steps[k], f = nonneg(s.filletMM, `step ${k + 1}'s fillet`, 'SHAFT_STEPS');
    if (k === n - 1 && (f || s.undercut)) fail('SHAFT_STEPS', `the last step has no shoulder after it for a fillet or an undercut`);
    if (f && s.undercut) fail('SHAFT_STEPS', `shoulder ${k + 1} takes a fillet or an undercut, not both`);
    if (k < n - 1) {
      const h = Math.abs(R[k] - R[k + 1]), small = R[k] < R[k + 1] ? k : k + 1;
      if (f >= h) fail('SHAFT_STEPS', `shoulder ${k + 1}'s fillet ${f} mm reaches past its height ${+h.toFixed(6)} mm`);
      if (f >= steps[small].lengthMM) fail('SHAFT_STEPS', `shoulder ${k + 1}'s fillet ${f} mm is longer than step ${small + 1}`);
      if (s.undercut) {
        const w = pos(s.undercut.widthMM, `shoulder ${k + 1}'s undercut width`, 'SHAFT_STEPS'), d = pos(s.undercut.depthMM, `shoulder ${k + 1}'s undercut depth`, 'SHAFT_STEPS');
        if (d >= R[small]) fail('SHAFT_STEPS', `shoulder ${k + 1}'s undercut ${d} mm deep reaches the axis of step ${small + 1}`);
        if (w >= steps[small].lengthMM) fail('SHAFT_STEPS', `shoulder ${k + 1}'s undercut ${w} mm wide is longer than step ${small + 1}`);
      }
    }
    fil.push(f); und.push(s.undercut);
  }
  if (c0 >= Math.min(R[0], steps[0].lengthMM) || c1 >= Math.min(R[n - 1], steps[n - 1].lengthMM)) fail('SHAFT_STEPS', 'a chamfer must be smaller than its end step\'s radius and length');
  const segs: Seg[] = [], names: string[] = [], grooves: { index: number; step: number; diameterMM: number; widthMM: number; fromMM: number }[] = [];
  const line = (x: number, y: number, name: string) => { segs.push({ kind: 'line', start: [x, y] }); names.push(name); };
  line(0, 0, 'end0');
  if (c0 > 0) line(R[0] - c0, 0, 'chamfer0');
  let g = 0;
  for (let k = 0; k < n; k++) {
    const r = R[k], z0 = z[k], z1 = z[k + 1], label = k + 1, last = k === n - 1;
    const prevBigger = k > 0 && R[k - 1] > r, nextBigger = !last && R[k + 1] > r;
    const fStart = prevBigger ? fil[k - 1] : 0, uStart = prevBigger ? und[k - 1] : undefined, fEnd = nextBigger ? fil[k] : 0, uEnd = nextBigger ? und[k] : undefined;
    // The seat runs from after the chamfer or the fillet below to before the fillet or the chamfer above.
    const seatFrom = z0 + (k === 0 ? c0 : 0) + fStart, seatTo = z1 - (last ? c1 : 0) - fEnd;
    const dips: Dip[] = [];
    if (uStart) dips.push({ from: z0, to: z0 + uStart.widthMM, r: r - uStart.depthMM, kind: 'undercut', n: k, w: uStart.widthMM });
    for (const [gi, gr] of (steps[k].grooves ?? []).entries()) {
      const w = pos(gr.widthMM, `step ${label}'s groove ${gi + 1}'s width`, 'GROOVE_DIMENSIONS'), at = nonneg(gr.atMM, `step ${label}'s groove ${gi + 1}'s position`, 'GROOVE_DIMENSIONS'), rb = pos(gr.diameterMM, `step ${label}'s groove ${gi + 1}'s diameter`, 'GROOVE_DIMENSIONS') / 2;
      if (!(rb < r - EPS)) fail('GROOVE_DIMENSIONS', `step ${label}'s groove ${gi + 1}: its bottom Ø${2 * rb} must be below the step's Ø${2 * r}`);
      dips.push({ from: z0 + at, to: z0 + at + w, r: rb, kind: 'groove', n: gi, w });
    }
    if (uEnd) dips.push({ from: z1 - uEnd.widthMM, to: z1, r: r - uEnd.depthMM, kind: 'undercut', n: k + 1, w: uEnd.widthMM });
    dips.sort((a, b) => a.from - b.from);
    for (const [i, d] of dips.entries()) {
      if (d.kind === 'groove' && (d.from < seatFrom - EPS || d.to > seatTo + EPS)) fail('GROOVE_DIMENSIONS', `step ${label}'s groove ${d.n + 1} (${+(d.from - z0).toFixed(6)} to ${+(d.to - z0).toFixed(6)} mm) runs off the step's seat (${+(seatFrom - z0).toFixed(6)} to ${+(seatTo - z0).toFixed(6)})`);
      if (i > 0 && d.from < dips[i - 1].to + EPS) fail('GROOVE_DIMENSIONS', `step ${label}'s grooves and undercuts meet or overlap: leave seat between them`);
    }
    // The start: a fillet from the shoulder above it round to the seat (its centre (r + ρ, z0 + ρ)).
    let cur = seatFrom;
    if (fStart > 0) { segs.push({ kind: 'arc', start: [r + fStart, z0], center: [r + fStart, z0 + fStart], direction: 'cw' }); names.push(`fillet${k}`); }
    let piece = 1;
    const seat = (from: number) => { line(r, from, piece === 1 ? `seat${label}` : `seat${label}.${piece}`); piece++; };
    for (const d of dips) {
      if (d.from > cur + EPS) seat(cur);
      const atShoulder = d.kind === 'undercut' && Math.abs(d.from - z0) < EPS;
      if (!atShoulder) line(r, d.from, d.kind === 'groove' ? `groovewall${g + 1}.1` : `undercutwall${d.n}`);
      if (d.kind === 'groove') { g++; grooves.push({ index: g, step: label, diameterMM: 2 * d.r, widthMM: d.w, fromMM: d.from }); }
      line(d.r, d.from, d.kind === 'groove' ? `groove${g}` : `undercut${d.n}`);
      const atNext = d.kind === 'undercut' && Math.abs(d.to - z1) < EPS;
      if (!atNext) line(d.r, d.to, d.kind === 'groove' ? `groovewall${g}.2` : `undercutwall${d.n}`);
      cur = d.to;
    }
    if (seatTo > cur + EPS) seat(cur);
    // The step's end: the last end's chamfer and face; else the shoulder (a fillet into it when the next step is bigger).
    if (last) {
      if (c1 > 0) line(r, z1 - c1, 'chamfer1');
      line(r - c1, z1, 'end1');
      line(0, z1, 'axis');
    } else if (nextBigger) {
      if (fEnd > 0) { segs.push({ kind: 'arc', start: [r, z1 - fEnd], center: [r + fEnd, z1 - fEnd], direction: 'cw' }); names.push(`fillet${label}`); line(r + fEnd, z1, `shoulder${label}`); }
      else line(uEnd ? r - uEnd.depthMM : r, z1, `shoulder${label}`);
    } else line(r, z1, `shoulder${label}`);
  }
  return { segs, names, z, grooves };
}

/** A tool's part document: one sketch (`profile`) extruded `height` along its plane's normal. */
function tool(id: string, sketch: Record<string, unknown>, height: number): Brep {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
  return outputOf(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]), id).brep;
}
const turnZ = (b: Brep, deg: number): Brep => { if (!deg) return b; const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return transformBrep(b, { matrix: [c, -s, 0, s, c, 0, 0, 0, 1] }); };
const renamed = (b: Brep, name: string): Brep => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => name);

/** A shaft (shaft@0) in its own frame: axis +Z from z 0. */
export function shaftSolid(spec: ShaftSpec, options: { readonly id?: string } = {}): { readonly brep: Brep; readonly report: ShaftReport } {
  const id = (options.id ?? 'shaft').replace(/[^A-Za-z0-9_.-]/g, '_');
  if (!spec || typeof spec !== 'object') fail('INVALID_INPUT', 'a shaft is { steps, chamfersMM?, holes? }');
  const { segs, names, z, grooves } = section(spec), L = z[z.length - 1], sub = `${id}__r`;
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: { outer: names.map(tagOf) } },
    { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }] };
  const prefix = `${sub}.side[`;
  let brep = transformBrep(outputOf(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]), sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    nm => nm.split('|').map(p => p.startsWith(prefix) ? `${id}.${nameOf(p.slice(prefix.length, p.indexOf(']')))}${p.slice(p.indexOf(']') + 1)}` : p).join('|'));
  // Keyseats, in order over the steps.
  const keyseats: ShaftKeyseatReport[] = [];
  spec.steps.forEach((s, k) => (s.keyseats ?? []).forEach((ks, j) => {
    const label = `step ${k + 1}'s keyseat ${j + 1}`, R = s.diameterMM / 2, z0 = z[k];
    const b = pos(ks.widthMM, `${label}'s width`, 'KEYSEAT_DIMENSIONS'), t1 = pos(ks.depthMM, `${label}'s depth`, 'KEYSEAT_DIMENSIONS'), l = pos(ks.lengthMM, `${label}'s length`, 'KEYSEAT_DIMENSIONS'), off = nonneg(ks.offsetMM, `${label}'s offset`, 'KEYSEAT_DIMENSIONS');
    const ends = ks.ends ?? 'end-mill', a = ang(ks.angleDeg, `${label}'s angle`, 0);
    if (ends !== 'square' && ends !== 'end-mill' && ends !== 'disc') fail('KEYSEAT_DIMENSIONS', `${label}: ends must be square, end-mill or disc`);
    if (!(t1 < R)) fail('KEYSEAT_DIMENSIONS', `${label}: its depth ${t1} mm reaches the axis of a Ø${2 * R} step`);
    const half = Math.sqrt(R * R - (R - t1) ** 2);
    if (!(b < 2 * half)) fail('KEYSEAT_DIMENSIONS', `${label}: ${b} mm wide is no narrower than the step's chord ${+(2 * half).toFixed(6)} mm at its floor (its sides would not stand)`);
    if (ends === 'end-mill' && !(l > b)) fail('KEYSEAT_DIMENSIONS', `${label}: an end-milled seat's length ${l} mm must exceed its width ${b} mm`);
    const Rc = ends === 'disc' ? pos(ks.cutterRadiusMM, `${label}'s cutter radius`, 'KEYSEAT_DIMENSIONS') : 0;
    if (ends === 'disc' && !(Rc > t1)) fail('KEYSEAT_DIMENSIONS', `${label}: a disc cutter of radius ${Rc} mm must be larger than the depth ${t1} mm`);
    const runout = ends === 'disc' ? Math.sqrt(Rc * Rc - (Rc - t1) ** 2) : 0, from = z0 + off;
    if (from - runout < z0 - EPS || from + l + runout > z[k + 1] + EPS) fail('KEYSEAT_DIMENSIONS', `${label}: ${ends === 'disc' ? `with its run-out (${+runout.toFixed(6)} mm each end) ` : ''}it runs off the step (${+off.toFixed(6)} to ${+(off + l).toFixed(6)} of ${s.lengthMM} mm): a seat crossing a step is refused`);
    const n = keyseats.length + 1, tid = `${id}__k${n}`, top = R + 1;
    let t: Brep;
    if (ends === 'square') t = tool(tid, { profile: 'rectangle', min: [-b / 2, from], max: [b / 2, from + l], plane: { origin: [R - t1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, top - (R - t1));
    else if (ends === 'end-mill') {
      const lo = from + b / 2, hi = from + l - b / 2, h = b / 2;
      t = tool(tid, { profile: 'loop', segments: [{ kind: 'line', start: [h, lo] }, { kind: 'arc', start: [h, hi], center: [0, hi], direction: 'ccw' }, { kind: 'line', start: [-h, hi] }, { kind: 'arc', start: [-h, lo], center: [0, lo], direction: 'ccw' }], plane: { origin: [R - t1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, top - (R - t1));
    } else {
      // (In the plane y = −b/2: its x the shaft's z, its y the radius; the cutter's circle at each end of the floor.)
      const rc = R - t1 + Rc;
      t = tool(tid, { profile: 'loop', segments: [{ kind: 'arc', start: [from - Rc, rc], center: [from, rc], direction: 'ccw' }, { kind: 'line', start: [from, R - t1] }, { kind: 'arc', start: [from + l, R - t1], center: [from + l, rc], direction: 'ccw' }, { kind: 'line', start: [from + l + Rc, rc] }], plane: { origin: [0, -b / 2, 0], normal: [0, 1, 0], xAxis: [0, 0, 1] } }, b);
    }
    brep = booleanAnalytic(brep, renamed(turnZ(t, a), `${id}.keyseat${n}`), 'difference');
    keyseats.push({ index: n, step: k + 1, ends, widthMM: b, depthMM: t1, lengthMM: l, fromMM: from, floorRadiusMM: R - t1, surfaceLengthMM: l + 2 * runout, angleDeg: a, ...(ends === 'disc' ? { cutterRadiusMM: Rc } : {}) });
  }));
  // Cross holes.
  const holes: { index: number; diameterMM: number; atMM: number; angleDeg: number }[] = [];
  (spec.holes ?? []).forEach((h, j) => {
    const label = `hole ${j + 1}`, dh = pos(h.diameterMM, `${label}'s diameter`, 'HOLE_DIMENSIONS'), at = typeof h.atMM === 'number' && Number.isFinite(h.atMM) ? h.atMM : fail('HOLE_DIMENSIONS', `${label}'s position must be a number of mm`), a = ang(h.angleDeg, `${label}'s angle`, 90);
    const k = z.findIndex((zz, i) => i > 0 && at <= zz) - 1;
    if (!(at - dh / 2 >= -EPS && at + dh / 2 <= L + EPS) || k < 0) fail('HOLE_DIMENSIONS', `${label} (Ø${dh} at ${at} mm) runs off the shaft (0 to ${L} mm)`);
    const R = spec.steps[k].diameterMM / 2;
    if (at - dh / 2 < z[k] - EPS || at + dh / 2 > z[k + 1] + EPS) fail('HOLE_DIMENSIONS', `${label} (Ø${dh} at ${at} mm) crosses a shoulder (step ${k + 1} runs ${z[k]} to ${z[k + 1]} mm)`);
    if (!(dh < 2 * R)) fail('HOLE_DIMENSIONS', `${label}: Ø${dh} is no smaller than step ${k + 1}'s Ø${2 * R}`);
    const far = Math.max(...spec.steps.map(s => s.diameterMM)) / 2 + 1, t = tool(`${id}__h${j + 1}`, { profile: 'circle', center: [0, 0], radius: dh / 2, plane: { origin: [-far, 0, at], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, 2 * far);
    brep = booleanAnalytic(brep, renamed(turnZ(t, a), `${id}.hole${j + 1}`), 'difference');
    holes.push({ index: j + 1, diameterMM: dh, atMM: at, angleDeg: a });
  });
  const steps = spec.steps.map((s, k) => ({ index: k + 1, diameterMM: s.diameterMM, fromMM: z[k], toMM: z[k + 1] }));
  const shoulders = spec.steps.slice(0, -1).map((s, k) => ({ index: k + 1, atMM: z[k + 1], beforeMM: s.diameterMM, afterMM: spec.steps[k + 1].diameterMM, filletMM: s.filletMM ?? 0, ...(s.undercut ? { undercut: s.undercut } : {}) }));
  return { brep, report: { generator: 'shaft@0', lengthMM: L, steps, keyseats, grooves, holes, shoulders, manufacturingValidated: false } };
}
