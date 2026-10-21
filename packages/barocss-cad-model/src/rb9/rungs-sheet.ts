// RB9 rungs 5 and 10 (O70): the sheet-metal L-bracket and PCB enclosure of R12.5 (D121), now sampled. The checker's
// closed forms are R12.5's: the volume by the middle line, the flat's size by the textbook bend deduction
// BD = 2(R + T)·tan(θ/2) − θ(R + K·T), its area by the K-factor's identity A = V/T + (K − ½)·T·θ·(bend length); the bends'
// directions, angles and radii; the holes on their exact axes.
import type { Call, Outcome, Params, Rung } from './core';
import { axisDistance, cylindersOf, distinctCylinders, holds, near, parallel, volumeOf } from './measure';
import type { BodyResult } from '../engine/evaluate';

const PI = Math.PI, TH = PI / 2;
const num = (p: Params, k: string) => p[k] as number;
const cmd = (command: string, values: Record<string, unknown>): Call => ({ tool: 'run_command', args: { command, values } });
const feats = (features: unknown[]): Call => ({ tool: 'add_features', args: { features } });
const bd = (R: number, T: number, K: number) => 2 * (R + T) * Math.tan(TH / 2) - TH * (R + K * T);
const solids = (n: number, bodies: readonly BodyResult[]): Outcome => holds('solids', bodies.length === n, bodies.length, `${n} solid`);
/** A sheet value moved toward the middle of its range by d (so the mutant stays a valid sheet). */
const inward = (v: number, lo: number, hi: number, d: number) => (v > (lo + hi) / 2 ? v - d : v + d);

// ——— 5. the L-bracket: legs a and b outside the bend, w wide, a hole Ø dh in each leg's flat, half way along it
const bracket = (p: Params, o: { k?: number; a?: number; w?: number; r?: number; holes?: number; loose?: boolean } = {}): Call[] => {
  const a = o.a ?? num(p, 'a'), b = num(p, 'b'), w = o.w ?? num(p, 'w'), t = num(p, 't'), r = o.r ?? num(p, 'r'), k = o.k ?? num(p, 'k'), rh = num(p, 'dh') / 2, s = r + t;
  const c: Call[] = [cmd('sheet-profile', { shape: 'l', a, b, angle: 90, w, t, r, k, x: 0, y: 0, z: 0 })];
  const f: unknown[] = [];
  if ((o.holes ?? 2) >= 1) f.push({ kind: 'sketch', profile: 'circle', center: [(s + a) / 2, w / 2], radius: rh, plane: { origin: [0, 0, -1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: 1, height: t + 2 }, { kind: 'difference', parent: { node: 0, side: 'solid' }, tool: { node: 2, side: 'solid' } });
  if ((o.holes ?? 2) >= 2) f.push({ kind: 'sketch', profile: 'circle', center: [w / 2, (s + b) / 2], radius: rh, plane: { origin: [-1, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { kind: 'extrude', sketch: 4, height: t + 2 }, { kind: 'difference', parent: { node: 3, side: 'solid' }, tool: { node: 5, side: 'solid' } });
  if (f.length) c.push(feats(f));
  if (o.loose) c.push(cmd('box', { w: 5, d: 5, h: 5, x: a + 20, y: 0, z: 0 }));
  return c;
};
export const RUNG5: Rung = {
  n: 5, id: 'sheet-l-bracket', title: 'sheet-metal L-bracket',
  space: [{ key: 't', lo: 1, hi: 3, step: 0.5 }, { key: 'r', lo: p => num(p, 't'), hi: p => 3 * num(p, 't'), step: 0.5 }, { key: 'k', lo: 0.3, hi: 0.5, step: 0.02 },
    { key: 'a', lo: 30, hi: 60, step: 1 }, { key: 'b', lo: 25, hi: 50, step: 1 }, { key: 'w', lo: 20, hi: 40, step: 1 },
    { key: 'dh', lo: 3, hi: p => Math.min(num(p, 'w') / 3, (num(p, 'a') - num(p, 'r') - num(p, 't')) / 2, (num(p, 'b') - num(p, 'r') - num(p, 't')) / 2), step: 0.5 }],
  prompt: p => `A sheet-metal L-bracket: legs ${p.a} and ${p.b} mm to the outside of a 90° bend, ${p.w} mm wide, ${p.t} mm sheet, inner bend radius ${p.r}, K-factor ${p.k} (the shop's); a Ø${p.dh} mm hole through each leg, on its centre line half way along its flat.`,
  scripted: p => bracket(p),
  async check({ bodies }, p) {
    const a = num(p, 'a'), b = num(p, 'b'), w = num(p, 'w'), T = num(p, 't'), R = num(p, 'r'), K = num(p, 'k'), rh = num(p, 'dh') / 2, B = bd(R, T, K);
    const V = w * T * (a + b - 2 * (R + T) + TH * (R + T / 2)) - 2 * PI * rh * rh * T, f = bodies[0]?.flat;
    const holes = distinctCylinders(cylindersOf(bodies)).filter(c => Math.abs(c.r - rh) <= 1e-9);
    return [near('volume', volumeOf(bodies), V, 1e-9, true), solids(1, bodies),
      near('flat-length', f ? Math.max(...f.box.max) : null, a + b - B, 1e-9), near('flat-width', f ? Math.min(...f.box.max) : null, w, 1e-9),
      near('flat-area', f?.areaMM2 ?? null, V / T + (K - 0.5) * T * TH * w, 1e-9, true),
      holds('bend', !!f && f.bends.length === 1 && f.bends[0].direction === 'down' && Math.abs(f.bends[0].angleDegrees - 90) <= 1e-9 && Math.abs(f.bends[0].radiusMM - R) <= 1e-9, f?.bends.map(x => [x.direction, x.angleDegrees, x.radiusMM]), `one bend down, 90°, R ${R}`),
      holds('holes', holes.length === 2 && !!f && f.loops.length === 3, { holes: holes.length, loops: f?.loops.length }, `two Ø${2 * rh} holes; the flat's outline and their two loops`)];
  },
  mutants: [
    { id: 'k-off', target: 'flat-length', why: 'K 0.05 off', calls: p => bracket(p, { k: inward(num(p, 'k'), 0.3, 0.5, 0.05) }) },
    { id: 'k-area', target: 'flat-area', why: 'K 0.1 off', calls: p => bracket(p, { k: inward(num(p, 'k'), 0.3, 0.5, 0.1) }) },
    { id: 'short', target: 'volume', why: 'a leg 5 short', calls: p => bracket(p, { a: num(p, 'a') - 5 }) },
    { id: 'narrow', target: 'flat-width', why: '5 narrower', calls: p => bracket(p, { w: num(p, 'w') - 5 }) },
    { id: 'radius', target: 'bend', why: 'the bend radius 0.5 more', calls: p => bracket(p, { r: num(p, 'r') + 0.5 }) },
    { id: 'one-hole', target: 'holes', why: 'one hole only', calls: p => bracket(p, { holes: 1 }) },
    { id: 'loose', target: 'solids', why: 'a loose piece beside it', calls: p => bracket(p, { loose: true }) },
  ],
};

// ——— 10. the PCB enclosure: an A × B base, square corner reliefs R + T, four flanges h high, four standoff holes, a connector slot
const enclosure = (p: Params, o: { k?: number; h?: number; slot?: boolean; moved?: boolean; flanges?: number; loose?: boolean } = {}): Call[] => {
  const A = num(p, 'A'), B = num(p, 'B'), h = o.h ?? num(p, 'h'), T = num(p, 't'), R = num(p, 'r'), K = o.k ?? num(p, 'k'), i = num(p, 'inset'), rh = num(p, 'dh') / 2, cs = R + T, sw = num(p, 'sw'), sh = num(p, 'sh');
  const f: unknown[] = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, B] }, { kind: 'sheet-base', sketch: 0, thickness: T, bendRadius: R, kFactor: K }];
  ['n1.side0|n1.side1', 'n1.side1|n1.side2', 'n1.side2|n1.side3', 'n1.side0|n1.side3'].forEach(e => f.push({ kind: 'sheet-corner-relief', parent: { node: f.length - 1, side: 'solid' }, edges: [e], shape: 'square', size: cs }));
  ['n1.side0|n1.top', 'n1.side1|n1.top', 'n1.side2|n1.top', 'n1.side3|n1.top'].slice(0, o.flanges ?? 4).forEach(e => f.push({ kind: 'sheet-flange', parent: { node: f.length - 1, side: 'solid' }, edges: [e], length: h }));
  [[i, i], [A - i, i], [A - i, B - i], [i, B - i]].forEach(([x, y], k) => f.push({ kind: 'hole', parent: { node: f.length - 1, side: 'solid' }, center: [k === 0 && o.moved ? x + 1 : x, y], radius: rh }));
  if (o.slot !== false) {
    const z0 = cs + 2;
    f.push({ kind: 'sketch', profile: 'rectangle', min: [(A - sw) / 2, -(z0 + sh)], max: [(A + sw) / 2, -z0], plane: { origin: [0, -1, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: f.length, height: T + 2 }, { kind: 'difference', parent: { node: f.length - 1, side: 'solid' }, tool: { node: f.length + 1, side: 'solid' } });
  }
  const c: Call[] = [feats(f)];
  if (o.loose) c.push(cmd('box', { w: 5, d: 5, h: 5, x: A + 20, y: 0, z: 0 }));
  return c;
};
export const RUNG10: Rung = {
  n: 10, id: 'sheet-pcb-enclosure', title: 'sheet-metal PCB enclosure',
  space: [{ key: 't', lo: 1, hi: 2, step: 0.5 }, { key: 'r', lo: p => num(p, 't'), hi: p => 2 * num(p, 't'), step: 0.5 }, { key: 'k', lo: 0.3, hi: 0.5, step: 0.02 },
    { key: 'A', lo: 80, hi: 140, step: 1 }, { key: 'B', lo: 50, hi: 100, step: 1 }, { key: 'h', lo: 15, hi: 35, step: 1 }, { key: 'inset', lo: 8, hi: 15, step: 0.5 }, { key: 'dh', lo: 2.5, hi: 4, step: 0.1 },
    { key: 'sw', lo: 10, hi: 30, step: 1 }, { key: 'sh', lo: 4, hi: p => num(p, 'h') - (num(p, 'r') + num(p, 't')) - 4, step: 0.5 }],
  prompt: p => `A sheet-metal PCB enclosure: a ${p.A} × ${p.B} mm base of ${p.t} mm sheet (inner radius ${p.r}, K ${p.k} given), a square relief ${num(p, 'r') + num(p, 't')} mm off each corner, four ${p.h} mm flanges up along the full edges, four Ø${p.dh} mm holes ${p.inset} mm in from the base's corners for the board, and a ${p.sw} × ${p.sh} mm connector slot centred in the front flange, ${num(p, 'r') + num(p, 't') + 2} mm above the base.`,
  scripted: p => enclosure(p),
  async check({ bodies }, p) {
    const A = num(p, 'A'), B = num(p, 'B'), h = num(p, 'h'), T = num(p, 't'), R = num(p, 'r'), K = num(p, 'k'), i = num(p, 'inset'), rh = num(p, 'dh') / 2, cs = R + T, t = R + T, sw = num(p, 'sw'), sh = num(p, 'sh'), BD = bd(R, T, K);
    const V = A * B * T - 4 * cs * cs * T + [A, B, A, B].reduce((v, L) => v - t * T * (L - 2 * cs) + (L - 2 * cs) * (TH * T * (R + T / 2) + (h - t) * T), 0) - 4 * PI * rh * rh * T - sw * sh * T;
    const f = bodies[0]?.flat, holes = distinctCylinders(cylindersOf(bodies)).filter(c => Math.abs(c.r - rh) <= 1e-9 && parallel(c.a, [0, 0, 1]));
    const placed = [[i, i], [A - i, i], [A - i, B - i], [i, B - i]].every(([x, y]) => holes.some(c => axisDistance(c, [x, y, 0]) <= 1e-9));
    return [near('volume', volumeOf(bodies), V, 1e-9, true), solids(1, bodies),
      near('flat-length', f?.box.max[0] ?? null, A + 2 * (h - BD), 1e-9), near('flat-width', f?.box.max[1] ?? null, B + 2 * (h - BD), 1e-9),
      near('flat-area', f?.areaMM2 ?? null, V / T + (K - 0.5) * T * TH * (2 * (A + B) - 8 * cs), 1e-9, true),
      holds('bends', !!f && f.bends.length === 4 && f.bends.every(x => x.direction === 'up' && Math.abs(x.angleDegrees - 90) <= 1e-9), f?.bends.map(x => x.direction), 'four bends up, 90°'),
      holds('standoff-holes', holes.length === 4 && placed, holes.map(c => c.c.map(v => +v.toFixed(6))), `four Ø${2 * rh} holes ${i} in from the corners`),
      holds('loops', !!f && f.loops.length === 6, f?.loops.length, 'the outline, four holes and the slot')];
  },
  mutants: [
    { id: 'k-off', target: 'flat-length', why: 'K 0.05 off', calls: p => enclosure(p, { k: inward(num(p, 'k'), 0.3, 0.5, 0.05) }) },
    { id: 'k-area', target: 'flat-area', why: 'K 0.1 off', calls: p => enclosure(p, { k: inward(num(p, 'k'), 0.3, 0.5, 0.1) }) },
    { id: 'shallow', target: 'volume', why: 'the flanges 3 lower', calls: p => enclosure(p, { h: num(p, 'h') - 3 }) },
    { id: 'width', target: 'flat-width', why: 'the flanges 3 lower', calls: p => enclosure(p, { h: num(p, 'h') - 3 }) },
    { id: 'three', target: 'bends', why: 'three flanges', calls: p => enclosure(p, { flanges: 3 }) },
    { id: 'moved', target: 'standoff-holes', why: 'a hole 1 mm off', calls: p => enclosure(p, { moved: true }) },
    { id: 'no-slot', target: 'loops', why: 'no connector slot', calls: p => enclosure(p, { slot: false }) },
    { id: 'loose', target: 'solids', why: 'a loose piece beside it', calls: p => enclosure(p, { loose: true }) },
  ],
};
