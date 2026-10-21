// RB9 rungs 1, 2, 3 and 13 (O70): a block with a hole, a washer, a printed phone stand, a product from a brief (a knob on
// a D-shaft, a wall hook). Each: its sampled space, the brief in words, the ideal agent's calls, the hidden checker by
// closed forms and exact faces, and mutants that each must fail a named predicate.
import { readBrief, briefGaps } from '@barocss/cad-model/chat/brief';
import { processProfile } from '@barocss/cad-model/library/materials';
import type { Call, Mutant, Outcome, Params, Rung } from './core';
import { axisDistance, boxIs, cylindersOf, distinctCylinders, holds, near, parallel, studioChecks, volumeOf } from './measure';

const PI = Math.PI;
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { command, values, ...sel } });
const num = (p: Params, k: string) => p[k] as number;
const solids = (n: number, bodies: number): Outcome => holds('solids', bodies === n, bodies, `${n} solid${n === 1 ? '' : 's'}`);
/** Calls with one replaced (index i: the new call, or null to drop it). */
const swap = (calls: Call[], i: number, c: Call | null): Call[] => calls.flatMap((x, k) => (k === i ? (c ? [c] : []) : [x]));

// ——— 1. block with hole
const block = (p: Params): Call[] => [cmd('box', { w: num(p, 'w'), d: num(p, 'd'), h: num(p, 'h'), x: 0, y: 0, z: 0 }), cmd('hole', { d: num(p, 'dh'), x: num(p, 'w') / 2, y: num(p, 'd') / 2 }, { faces: ['n1.top'] })];
export const RUNG1: Rung = {
  n: 1, id: 'block-hole', title: 'block with hole',
  space: [{ key: 'w', lo: 30, hi: 120, step: 1 }, { key: 'd', lo: 30, hi: 120, step: 1 }, { key: 'h', lo: 8, hi: 40, step: 1 }, { key: 'dh', lo: 3, hi: p => 0.4 * Math.min(num(p, 'w'), num(p, 'd')), step: 0.5 }],
  prompt: p => `A ${p.w} × ${p.d} × ${p.h} mm block with a Ø${p.dh} mm hole straight through it, top to bottom, in the middle of the top face.`,
  scripted: block,
  async check({ bodies }, p) {
    const w = num(p, 'w'), d = num(p, 'd'), h = num(p, 'h'), r = num(p, 'dh') / 2;
    const bore = cylindersOf(bodies).find(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, [0, 0, 1]) && axisDistance(c, [w / 2, d / 2, 0]) <= 1e-9);
    return [boxIs('box', bodies, [w, d, h]), near('volume', volumeOf(bodies), w * d * h - PI * r * r * h, 1e-9, true), solids(1, bodies.length),
      holds('bore', !!bore, cylindersOf(bodies).map(c => ({ r: c.r, a: c.a })), `an exact cylinder Ø${2 * r} on Z through (${w / 2}, ${d / 2})`),
      holds('through', !!bore && Math.abs(bore.zMax - bore.zMin - h) <= 1e-4, bore ? +(bore.zMax - bore.zMin).toFixed(6) : null, `the bore spans the block's ${h} mm`)];
  },
  mutants: [
    { id: 'diameter', target: 'bore', why: 'the hole 1 mm too big', calls: p => swap(block(p), 1, cmd('hole', { d: num(p, 'dh') + 1, x: num(p, 'w') / 2, y: num(p, 'd') / 2 }, { faces: ['n1.top'] })) },
    { id: 'offset', target: 'bore', why: 'the hole 2 mm off the middle', calls: p => swap(block(p), 1, cmd('hole', { d: num(p, 'dh'), x: num(p, 'w') / 2 + 2, y: num(p, 'd') / 2 }, { faces: ['n1.top'] })) },
    { id: 'blind', target: 'through', why: 'a blind hole half way', calls: p => swap(block(p), 1, cmd('hole', { type: 'blind', d: num(p, 'dh'), depth: num(p, 'h') / 2, x: num(p, 'w') / 2, y: num(p, 'd') / 2 }, { faces: ['n1.top'] })) },
    { id: 'wide', target: 'box', why: 'the block 5 mm too wide', calls: p => swap(block(p), 0, cmd('box', { w: num(p, 'w') + 5, d: num(p, 'd'), h: num(p, 'h'), x: 0, y: 0, z: 0 })) },
    { id: 'no-hole', target: 'volume', why: 'no hole', calls: p => block(p).slice(0, 1) },
    { id: 'loose', target: 'solids', why: 'a second block beside it', calls: p => [...block(p), cmd('box', { w: 5, d: 5, h: 5, x: num(p, 'w') + 10, y: 0, z: 0 })] },
  ],
};

// ——— 2. washer
const washer = (p: Params): Call[] => [cmd('tube', { r: num(p, 'D') / 2, ri: num(p, 'd') / 2, h: num(p, 't'), x: 0, y: 0, z: 0 })];
export const RUNG2: Rung = {
  n: 2, id: 'washer', title: 'washer',
  space: [{ key: 'D', lo: 8, hi: 40, step: 0.5 }, { key: 'd', lo: p => 0.4 * num(p, 'D'), hi: p => 0.7 * num(p, 'D'), step: 0.1 }, { key: 't', lo: 0.8, hi: 4, step: 0.1 }],
  prompt: p => `A flat washer: Ø${p.D} mm outside, a Ø${p.d} mm bore, ${p.t} mm thick.`,
  scripted: washer,
  async check({ bodies }, p) {
    const R = num(p, 'D') / 2, r = num(p, 'd') / 2, t = num(p, 't'), cyl = cylindersOf(bodies);
    const outer = cyl.find(c => Math.abs(c.r - R) <= 1e-9 && parallel(c.a, [0, 0, 1])), bore = cyl.find(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, [0, 0, 1]));
    return [boxIs('box', bodies, [2 * R, 2 * R, t], [-R, -R, 0]), near('volume', volumeOf(bodies), PI * (R * R - r * r) * t, 1e-9, true), solids(1, bodies.length),
      holds('outer', !!outer, cyl.map(c => c.r), `an exact cylinder Ø${2 * R}`), holds('bore', !!bore, cyl.map(c => c.r), `an exact cylinder Ø${2 * r}`),
      holds('coaxial', !!outer && !!bore && axisDistance(outer, bore.c) <= 1e-9, outer && bore ? axisDistance(outer, bore.c) : null, 'the bore on the outside\'s axis to 1e-9')];
  },
  mutants: [
    { id: 'offset-bore', target: 'coaxial', why: 'the bore 0.5 off its axis', calls: p => [cmd('cylinder', { r: num(p, 'D') / 2, h: num(p, 't'), x: 0, y: 0, z: 0 }), cmd('hole', { d: num(p, 'd'), x: 0.5, y: 0 }, { faces: ['n1.top'] })] },
    { id: 'thick', target: 'box', why: '1.5 times too thick', calls: p => [cmd('tube', { r: num(p, 'D') / 2, ri: num(p, 'd') / 2, h: num(p, 't') * 1.5, x: 0, y: 0, z: 0 })] },
    { id: 'big-bore', target: 'bore', why: 'the bore 0.9 D', calls: p => [cmd('tube', { r: num(p, 'D') / 2, ri: 0.45 * num(p, 'D'), h: num(p, 't'), x: 0, y: 0, z: 0 })] },
    { id: 'disc', target: 'volume', why: 'a solid disc', calls: p => [cmd('cylinder', { r: num(p, 'D') / 2, h: num(p, 't'), x: 0, y: 0, z: 0 })] },
    { id: 'outside', target: 'outer', why: 'the outside 1 mm too big', calls: p => [cmd('tube', { r: num(p, 'D') / 2 + 1, ri: num(p, 'd') / 2, h: num(p, 't'), x: 0, y: 0, z: 0 })] },
    { id: 'two', target: 'solids', why: 'two washers', calls: p => [...washer(p), cmd('tube', { r: num(p, 'D') / 2, ri: num(p, 'd') / 2, h: num(p, 't'), x: num(p, 'D') * 2, y: 0, z: 0 })] },
  ],
};

// ——— 3. printed phone stand: base w × D × 5, a back 5 thick at the rear, a lip 5 thick rising 8 above the base, the phone's slot between
const LIP = 8, WALL = 5;
const stand = (p: Params, o: { back?: number; lipY?: number; lip?: boolean; extra?: boolean; skin?: boolean; lipH?: number; H?: number } = {}): Call[] => {
  const w = num(p, 'w'), D = num(p, 'D'), H = o.H ?? num(p, 'H'), g = num(p, 'g'), back = o.back ?? WALL, lipY = o.lipY ?? D - back - g - 1 - WALL;
  const c: Call[] = [cmd('box', { w, d: D, h: WALL, x: 0, y: 0, z: 0 }), cmd('box', { w, d: back, h: H, x: 0, y: D - back, z: 0 }), cmd('union', {}, { bodies: ['b1', 'b3'] })];
  if (o.lip !== false) c.push(cmd('box', { w, d: WALL, h: o.lipH ?? WALL + LIP, x: 0, y: lipY, z: 0 }), cmd('union', {}, { bodies: ['b4', 'b6'] }));
  // (A pocket in the back from the slot's side, leaving a 0.5 mm skin: thinner than FDM's wall.)
  if (o.skin) c.push(cmd('box', { w: w - 10, d: back - 0.5, h: H - WALL - 5, x: 5, y: D - back, z: WALL }), cmd('difference', {}, { bodies: ['b7', 'b9'] }));
  if (o.extra) c.push(cmd('box', { w: 10, d: 10, h: 10, x: 0, y: 0, z: H + 20 }));
  return c;
};
export const RUNG3: Rung = {
  n: 3, id: 'phone-stand', title: 'printed phone stand',
  space: [{ key: 'w', lo: 60, hi: 100, step: 1 }, { key: 'D', lo: 50, hi: 90, step: 1 }, { key: 'H', lo: 40, hi: 80, step: 1 }, { key: 'g', lo: 10, hi: 14, step: 0.5 }],
  prompt: p => `A 3D-printed phone stand as one solid: a base plate ${p.w} mm wide, ${p.D} mm deep and 5 mm thick; a back ${p.H} mm high and 5 mm thick on the base's rear edge; and a lip 5 mm thick rising 8 mm above the base, in front of the back with a slot ${p.g} to ${num(p, 'g') + 2} mm wide between them for the phone. Printed in FDM.`,
  scripted: p => stand(p),
  async check({ doc, bodies }, p, evaluate) {
    const w = num(p, 'w'), D = num(p, 'D'), H = num(p, 'H'), g = num(p, 'g'), fdm = processProfile('fdm')!.thresholds;
    // (The slot: the back's front face to the lip's back face, from the faces' exact planes facing ±Y above the base.)
    const planes = bodies.flatMap(b => b.mesh.faces.filter(f => f.exact?.kind === 'plane' && Math.abs(Math.abs(f.normal[1]) - 1) < 1e-9 && f.centroid[2] > WALL + 1e-6).map(f => ({ y: (f.exact as { o: number[] }).o[1], n: f.normal[1] })));
    const backFront = planes.filter(q => q.n < 0).map(q => q.y).sort((a, b) => b - a)[0], lipBack = planes.filter(q => q.n > 0 && q.y < (backFront ?? Infinity)).map(q => q.y).sort((a, b) => b - a)[0];
    const slot = backFront !== undefined && lipBack !== undefined ? backFront - lipBack : null;
    const wall = await studioChecks(doc, evaluate, [{ id: 'min-wall', source: `FDM walls ≥ ${fdm.minWall.value} mm`, hard: true, check: { op: '>=', query: { fn: 'min_wall' }, value: fdm.minWall.value } } as never], { process: 'fdm' });
    return [boxIs('box', bodies, [w, D, H]), near('volume', volumeOf(bodies), w * D * WALL + w * WALL * (H - WALL) + w * WALL * LIP, 1e-9, true), solids(1, bodies.length),
      holds('slot', slot !== null && slot >= g - 1e-9 && slot <= g + 2 + 1e-9, slot, `the phone's slot ${g} … ${g + 2} mm`), ...wall];
  },
  mutants: [
    { id: 'no-lip', target: 'slot', why: 'no lip', calls: p => stand(p, { lip: false }) },
    { id: 'thin-back', target: 'min-wall', why: 'the back pocketed to a 0.5 mm skin', calls: p => stand(p, { skin: true }) },
    { id: 'tall', target: 'box', why: 'the back 5 mm too high', calls: p => stand(p, { H: num(p, 'H') + 5 }) },
    { id: 'tall-lip', target: 'volume', why: 'the lip 2 mm too high', calls: p => stand(p, { lipH: WALL + LIP + 2 }) },
    { id: 'narrow-slot', target: 'slot', why: 'the slot 3 mm too narrow', calls: p => stand(p, { lipY: num(p, 'D') - WALL - num(p, 'g') + 3 - 1 - WALL }) },
    { id: 'loose-piece', target: 'solids', why: 'a second solid floating above', calls: p => stand(p, { extra: true }) },
  ],
};

// ——— 13. a product from a brief: a knob on a D-shaft, or a wall hook; the brief's purpose, process and material stated
const briefCall = (p: Params): Call => ({ tool: 'set_brief', args: { fields: {
  purpose: { value: p.kind === 'knob' ? 'a knob for a D-shaft' : 'a wall hook', basis: 'stated', source: p.kind === 'knob' ? 'a knob for a D-shaft' : 'a wall hook' },
  process: { value: 'fdm', basis: 'stated', source: 'printed in PLA' }, material: { value: 'pla', basis: 'stated', source: 'printed in PLA' } } } });
const knob = (p: Params, o: { bore?: number; flat?: boolean } = {}): Call[] => {
  const R = num(p, 'R'), H = num(p, 'H'), d = o.bore ?? num(p, 'ds'), f = num(p, 'f'), depth = num(p, 'depth');
  const c: Call[] = [briefCall(p), cmd('cylinder', { r: R, h: H, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'blind', d, depth, x: 0, y: 0 }, { faces: ['n1.bottom'] })];
  // (The flat: a block filling the bore beyond the chord d/2 − f from the axis, united; then the top edge rounded.)
  if (o.flat !== false) c.push(cmd('box', { w: f + 1, d: d + 2, h: depth, x: d / 2 - f, y: -d / 2 - 1, z: 0 }), cmd('union', {}, { bodies: ['b2', 'b4'] }));
  c.push(cmd('fillet', { radius: num(p, 'fr') }, { edges: [{ between: ['n1.top', 'n1.side0'] }] }));
  return c;
};
const hook = (p: Params, o: { holes?: number } = {}): Call[] => {
  const w = num(p, 'w'), t = num(p, 't'), H = num(p, 'H'), a = num(p, 'a'), l = num(p, 'l'), ds = num(p, 'ds');
  const c: Call[] = [briefCall(p), cmd('box', { w, d: t, h: H, x: 0, y: 0, z: 0 }), cmd('box', { w, d: a, h: t, x: 0, y: t, z: 0 }), cmd('union', {}, { bodies: ['b1', 'b3'] }),
    cmd('box', { w, d: t, h: l, x: 0, y: a, z: t }), cmd('union', {}, { bodies: ['b4', 'b6'] })];
  // (Blind, the back's thickness deep: a through hole runs on through the lip beyond it.)
  for (const z of [0.45 * H, 0.8 * H].slice(0, o.holes ?? 2)) c.push(cmd('hole', { type: 'blind', d: ds, depth: t, x: w / 2, y: z }, { faces: [{ normal: [0, -1, 0], pick: 'max' }] }));
  return c;
};
export const RUNG13: Rung = {
  n: 13, id: 'product-brief', title: 'product from a brief',
  space: [{ key: 'kind', choice: ['knob', 'hook'] }, { key: 'R', lo: 10, hi: 25, step: 0.5 }, { key: 'H', lo: 12, hi: 25, step: 0.5 }, { key: 'ds', lo: 4, hi: 8, step: 0.5 }, { key: 'f', lo: 0.4, hi: 1, step: 0.1 },
    { key: 'depth', lo: p => 0.4 * num(p, 'H'), hi: p => 0.7 * num(p, 'H'), step: 0.5 }, { key: 'fr', lo: 0.5, hi: p => Math.min(3, num(p, 'H') - num(p, 'depth') - 1), step: 0.5 },
    { key: 'w', lo: 20, hi: 40, step: 1 }, { key: 't', lo: 3, hi: 6, step: 0.5 }, { key: 'a', lo: 20, hi: 50, step: 1 }, { key: 'l', lo: 8, hi: 20, step: 1 }],
  prompt: p => p.kind === 'knob'
    ? `Make a knob for a D-shaft, printed in PLA: Ø${num(p, 'R') * 2} × ${p.H} mm, its top edge rounded ${p.fr} mm, with a blind bore up from the middle of the bottom ${p.depth} mm deep for a Ø${p.ds} mm shaft with a flat ${p.f} mm deep.`
    : `Make a wall hook, printed in PLA: a back plate ${p.w} mm wide, ${p.t} mm thick and ${p.H} mm high; an arm ${p.a} mm out from the back's bottom, ${p.t} mm thick; a lip ${p.l} mm high at the arm's end; two Ø${p.ds} mm screw holes through the back on its centre line, at 45 % and 80 % of its height.`,
  scripted: p => (p.kind === 'knob' ? knob(p) : hook(p)),
  async check({ doc, bodies }, p) {
    const gaps = briefGaps(readBrief(doc.brief)), brief = holds('brief', !gaps.length && !!doc.brief, gaps.map(g => `${g.field}: ${g.why}`), 'purpose, process and material stated, no gap');
    if (p.kind === 'knob') {
      const R = num(p, 'R'), H = num(p, 'H'), r = num(p, 'ds') / 2, f = num(p, 'f'), depth = num(p, 'depth'), fr = num(p, 'fr'), s = r - f;
      // (The bore less the flat's segment beyond the chord at s; the rounded edge by Pappus: its section's area and centroid.)
      const bore = PI * r * r - (r * r * Math.acos(s / r) - s * Math.sqrt(r * r - s * s)), A = (1 - PI / 4) * fr * fr;
      const xc = (fr * fr * (R - fr / 2) - (PI * fr * fr / 4) * (R - fr + 4 * fr / (3 * PI))) / A;
      const cyl = cylindersOf(bodies).find(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, [0, 0, 1]) && axisDistance(c, [0, 0, 0]) <= 1e-9);
      const flat = bodies.flatMap(b => b.mesh.faces).find(x => x.exact?.kind === 'plane' && Math.abs(Math.abs(x.normal[0]) - 1) < 1e-9 && Math.abs(Math.abs((x.exact as { o: number[] }).o[0]) - s) <= 1e-9);
      return [boxIs('box', bodies, [2 * R, 2 * R, H], [-R, -R, 0]), near('volume', volumeOf(bodies), PI * R * R * H - bore * depth - 2 * PI * xc * A, 1e-9, true), solids(1, bodies.length),
        holds('bore', !!cyl && Math.abs(cyl.zMax - cyl.zMin - depth) <= 1e-4, cyl ? { r: cyl.r, depth: +(cyl.zMax - cyl.zMin).toFixed(6) } : null, `a Ø${2 * r} bore ${depth} deep on the axis`),
        holds('flat', !!flat, null, `the shaft's flat ${f} deep: a plane ${s} from the axis`), brief];
    }
    const w = num(p, 'w'), t = num(p, 't'), H = num(p, 'H'), a = num(p, 'a'), l = num(p, 'l'), rr = num(p, 'ds') / 2;
    const holes = distinctCylinders(cylindersOf(bodies)).filter(c => Math.abs(c.r - rr) <= 1e-9 && parallel(c.a, [0, 1, 0]));
    const at = [0.45 * H, 0.8 * H].every(z => holes.some(c => axisDistance(c, [w / 2, 0, z]) <= 1e-9));
    return [boxIs('box', bodies, [w, t + a, Math.max(H, t + l)]), near('volume', volumeOf(bodies), w * t * H + w * a * t + w * t * l - 2 * PI * rr * rr * t, 1e-9, true), solids(1, bodies.length),
      holds('screw-holes', holes.length === 2 && at, holes.length, `two Ø${2 * rr} holes on the back's centre line at ${0.45 * H} and ${0.8 * H}`), brief];
  },
  mutants: [
    { id: 'bore', target: p => (p.kind === 'knob' ? 'bore' : 'screw-holes'), why: 'the bore 0.5 too big (knob) / one screw hole (hook)', calls: p => (p.kind === 'knob' ? knob(p, { bore: num(p, 'ds') + 0.5 }) : hook(p, { holes: 1 })) },
    { id: 'flat', target: p => (p.kind === 'knob' ? 'flat' : 'box'), why: 'no flat (knob) / the back too thin (hook)', calls: p => (p.kind === 'knob' ? knob(p, { flat: false }) : hook({ ...p, t: num(p, 't') - 1 })) },
    { id: 'no-brief', target: 'brief', why: 'the brief not written', calls: p => (p.kind === 'knob' ? knob(p) : hook(p)).slice(1) },
    { id: 'rounder', target: 'volume', why: 'the edge rounded 0.5 more (knob) / the lip 2 higher (hook)', calls: p => (p.kind === 'knob' ? knob({ ...p, fr: num(p, 'fr') + 0.5 }) : hook({ ...p, l: num(p, 'l') + 2 })) },
    { id: 'loose', target: 'solids', why: 'a loose piece beside it', calls: p => [...(p.kind === 'knob' ? knob(p) : hook(p)), cmd('box', { w: 3, d: 3, h: 3, x: 100, y: 100, z: 0 })] },
  ] as Mutant[],
};
