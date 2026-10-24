// P1: a single-cylinder four-stroke engine, 125 cc class — bore 56, stroke 50 (crank radius 25), rod 100 between
// centres — built on the object facade (@barocss/cad-model/api), the core functions where it doesn't reach. Every part
// is in its own frame; the assembly places them (milestone 2). Run through run.mjs.
//
// The engine's frame: the crank's axis along Y through the origin, the cylinder's axis up Z; the piston at top dead
// centre has its pin 125 above the crank axis (crank 25 + rod 100).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { part, sketch, Plane, type StudioPart } from '../../../packages/barocss-cad-model/src/api';

type XY = [number, number];

// ── sizes (mm) ──
export const BORE = 56, STROKE = 50, CRANK = STROKE / 2, ROD = 100;
const JOURNAL_R = 12.5, PIN_R = 10, WEB_T = 12, WEB_GAP = 18;
const SMALL_END_PIN_R = 7;

// (Arc-and-line loops for the sketcher: the outline of two circles joined by their outer tangents, a cam lobe, a web.)
function tangents(c1: XY, r1: number, c2: XY, r2: number): { right: [XY, XY]; left: [XY, XY] } {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const a = (r1 - r2) / d, b = Math.sqrt(1 - a * a);
  // (The unit normals n with n·(c2 − c1)/d = (r1 − r2)/d: the outer tangent on each side.)
  const nR: XY = [a * ux + b * uy, a * uy - b * ux], nL: XY = [a * ux - b * uy, a * uy + b * ux];
  const at = (c: XY, r: number, n: XY): XY => [round(c[0] + r * n[0]), round(c[1] + r * n[1])];
  return { right: [at(c1, r1, nR), at(c2, r2, nR)], left: [at(c1, r1, nL), at(c2, r2, nL)] };
}
const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
/** Two circles joined by their outer tangents, as one closed loop (c2's arc over its far side, c1's over its own). */
function stadium(c1: XY, r1: number, c2: XY, r2: number) {
  const t = tangents(c1, r1, c2, r2);
  return sketch().moveTo(t.right[0]).lineTo(t.right[1]).arcTo(t.left[1], { center: c2 }).lineTo(t.left[0]).arcTo(t.right[0], { center: c1 }).close();
}
const rotate = ([x, y]: XY, deg: number): XY => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [round(x * c - y * s), round(x * s + y * c)]; };

// ── 1. the crankshaft (own frame: its axis Z, the crankpin toward +X) ──
// Two main journals, two webs whose counterweights sit opposite the pin, the crankpin between them, and the timing
// gear's seat beyond the right journal.
function web(z: number) {
  // (The web's outline: a counterweight half disc of radius 40 about the axis on −X, joined to a lobe of radius 16
  // round the crankpin.)
  const loop = sketch(Plane.XY.offset(z)).moveTo([0, 40]).arcTo([0, -40], { center: [0, 0] }).lineTo([CRANK, -16]).arcTo([CRANK, 16], { center: [CRANK, 0] }).close();
  return loop;
}
export function crankshaft(): StudioPart {
  const half = WEB_GAP / 2, z1 = -half - WEB_T, journal = 24;
  return part('crankshaft')
    .cylinder({ r: JOURNAL_R, h: journal, z: z1 - journal })
    .union(p => p.extrude(web(z1), { h: WEB_T }))
    .union(p => p.cylinder({ r: PIN_R, h: WEB_GAP + 2, x: CRANK, z: -half - 1 }))
    .union(p => p.extrude(web(half), { h: WEB_T }))
    .union(p => p.cylinder({ r: JOURNAL_R, h: journal, z: half + WEB_T }))
    .union(p => p.cylinder({ r: 10, h: 15, z: half + WEB_T + journal }))
    .material('steel');
}

// ── 2. the connecting rod (own frame: in XY, big end at the origin, small end at +Y, 18 thick from z 0) ──
export function connectingRod(): StudioPart {
  const t = 18, big: XY = [0, 0], small: XY = [0, ROD];
  return part('connecting-rod')
    .extrude(stadium(big, 22, small, 12), { h: t })
    .subtract(p => p.cylinder({ r: PIN_R + 0.05, h: t + 2, z: -1 }))
    .subtract(p => p.cylinder({ r: SMALL_END_PIN_R + 0.02, h: t + 2, y: ROD, z: -1 }))
    // (The I-beam: a pocket 5 deep in each face, between the ends.)
    .subtract(p => p.extrude(sketch(Plane.XY.offset(t - 5)).polygon([[-7, 32], [7, 32], [5, 78], [-5, 78]]), { h: 6 }))
    .subtract(p => p.extrude(sketch(Plane.XY.offset(-1)).polygon([[-7, 32], [7, 32], [5, 78], [-5, 78]]), { h: 6 }))
    .material('steel');
}

// ── 3. the piston, its rings and its pin (own frame: axis Z, skirt from z 0, crown at z 50; pin axis along Y at z 20) ──
const PISTON_R = BORE / 2 - 0.1, GROOVE_R = PISTON_R - 2.5, PIN_Z = 20;
const GROOVES: readonly [number, number][] = [[44, 45.5], [40, 41.5], [35, 38]];
export function piston(): StudioPart {
  const pts: XY[] = [[23, 0], [PISTON_R, 0]];
  for (const [lo, hi] of [...GROOVES].reverse()) pts.push([PISTON_R, lo], [GROOVE_R, lo], [GROOVE_R, hi], [PISTON_R, hi]);
  pts.push([PISTON_R, 50], [0, 50], [0, 42], [23, 42]);
  return part('piston')
    .revolve(sketch(Plane.XZ).polygon(pts))
    // (The pin's bosses, inside the skirt either side, reaching a millimetre into its wall, and the pin's bore through both.)
    .union(p => p.box({ w: 18, d: 12, h: 16, x: -9, y: 12, z: PIN_Z - 8 }))
    .union(p => p.box({ w: 18, d: 12, h: 16, x: -9, y: -24, z: PIN_Z - 8 }))
    .subtract(p => p.extrude(sketch(Plane.XZ.offset(-30)).circle({ r: SMALL_END_PIN_R + 0.02, y: PIN_Z }), { h: 60 }))
    .material('a356');
}
export function ring(name: string, [lo, hi]: readonly [number, number]): StudioPart {
  // (A ring in its groove, 0.05 short of its floor and 0.05 thinner: own frame, its groove's height from z 0.)
  const h = hi - lo - 0.05;
  return part(name).revolve(sketch(Plane.XZ).polygon([[GROOVE_R + 0.05, 0], [PISTON_R + 0.05, 0], [PISTON_R + 0.05, h], [GROOVE_R + 0.05, h]])).material('steel');
}
export function pistonPin(): StudioPart {
  return part('piston-pin').revolve(sketch(Plane.XZ).polygon([[4, 0], [SMALL_END_PIN_R, 0], [SMALL_END_PIN_R, 46], [4, 46]])).material('steel');
}

// ── 4. the finned cylinder block (own frame: bore axis Z, from z 0 on the crankcase to z 90 under the head) ──
export const BLOCK_H = 90;
export function cylinderBlock(): StudioPart {
  const fin = 2, pitch = 8, fins = 9;
  return part('cylinder-block')
    .box({ w: 76, d: 76, h: 10, x: -38, y: -38 })
    .union(p => p.cylinder({ r: 36, h: BLOCK_H }))
    .union(p => p.box({ w: 100, d: 100, h: fin, x: -50, y: -50, z: 14 }).linearPattern({ axis: 'z', spacing: pitch, count: fins }))
    .subtract(p => p.cylinder({ r: BORE / 2, h: BLOCK_H + 2, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: 40, y: 40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: -40, y: 40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: 40, y: -40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: -40, y: -40, z: -1 }))
    .material('a356');
}

// ── 5. the head (own frame: its gasket face at z 0, on the block's top) ──
// A finned block with the dome-shaped combustion chamber, the two valve seats and their ports out the sides, the valve
// guides, the spark plug's hole and the four stud holes.
const VALVE_X = 12;
export function cylinderHead(): StudioPart {
  // (The dome: a spherical cap 6 high over the bore's 28 radius — its sphere's centre 62.33 below the face.)
  const R = (28 * 28 + 6 * 6) / 12, dome = sketch(Plane.XZ).moveTo([0, 0]).lineTo([28, 0]).arcTo([0, 6], { center: [0, round(6 - R)] }).close();
  let p = part('cylinder-head')
    .box({ w: 100, d: 100, h: 12, x: -50, y: -50 })
    .union(q => q.cylinder({ r: 36, h: 46 }))
    .union(q => q.box({ w: 100, d: 100, h: 2, x: -50, y: -50, z: 16 }).linearPattern({ axis: 'z', spacing: 8, count: 4 }))
    .subtract(q => q.revolve(dome));
  for (const sx of [-1, 1]) {
    p = p.subtract(q => q.cylinder({ r: 11, h: 20, x: sx * VALVE_X, z: -1 }))
      .subtract(q => q.cylinder({ r: 3.6, h: 30, x: sx * VALVE_X, z: 18 }))
      // (The port: from the seat out the side, a Ø20 passage along X at z 12.)
      .subtract(q => q.extrude(sketch(sx > 0 ? Plane.YZ.offset(VALVE_X) : Plane.YZ.offset(-60)).circle({ r: 10, x: 0, y: 12 }), { h: 60 - VALVE_X }));
  }
  p = p.subtract(q => q.cylinder({ r: 7, h: 48, y: 16, z: -1 }));
  for (const [x, y] of [[40, 40], [-40, 40], [40, -40], [-40, -40]] as const) p = p.subtract(q => q.cylinder({ r: 4.25, h: 48, x, y, z: -1 }));
  return p.material('a356');
}

// ── 6. a valve (own frame: axis Z, its face at z 0, the stem up to z 70) ──
export function valve(name: string): StudioPart {
  return part(name).revolve(sketch(Plane.XZ).polygon([[0, 0], [10.5, 0], [10.5, 1.5], [3, 6], [3, 70], [0, 70]])).material('steel');
}

// ── 7. the camshaft and its followers (own frame: axis Z) ──
// (A lobe: a base circle of 14 and a nose of 6 at 14 out — 6 lift — joined by their tangents; the exhaust lobe turned
// 90° from the intake's, as the 2:1 timing puts them.)
function lobe(z: number, phase: number) {
  const t = tangents([0, 0], 14, [0, 14], 6), r = (q: XY) => rotate(q, phase);
  return sketch(Plane.XY.offset(z)).moveTo(r(t.right[0])).lineTo(r(t.right[1])).arcTo(r(t.left[1]), { center: r([0, 14]) }).lineTo(r(t.left[0])).arcTo(r(t.right[0]), { center: [0, 0] }).close();
}
export function camshaft(): StudioPart {
  return part('camshaft')
    .cylinder({ r: 8, h: 80 })
    .union(p => p.extrude(lobe(20, 0), { h: 10 }))
    .union(p => p.extrude(lobe(44, 90), { h: 10 }))
    .material('steel');
}
export function follower(name: string): StudioPart {
  return part(name).cylinder({ r: 8, h: 12 }).union(p => p.cylinder({ r: 4, h: 40, z: 12 })).material('steel');
}

// ── 8. the crankcase halves (the engine's frame: split on y = 0, the crank's axis along Y) ──
// A box 120 × 55 × 110 each, hollow to 6 mm walls and open on the split face, a main bearing's boss round the axis in its
// outer wall and its bore, and the cylinder's opening in the top.
export function crankcaseHalf(name: string, side: 1 | -1): StudioPart {
  const outer = side > 0 ? Plane.of({ origin: [0, 49, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] }) : Plane.of({ origin: [0, -49, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  return part(name)
    .box({ w: 120, d: 55, h: 110, x: -60, y: side > 0 ? 0 : -55, z: -70 })
    .shell(b => b.faces().facing(side > 0 ? '-y' : '+y'), { t: 6 })
    .union(p => p.extrude(sketch(outer).circle({ r: 20 }), { h: 14 }))
    .subtract(p => p.extrude(sketch(Plane.of({ origin: [0, side * 70, 0], normal: [0, -side, 0], xAxis: [1, 0, 0] })).circle({ r: JOURNAL_R + 0.1 }), { h: 40 }))
    .subtract(p => p.cylinder({ r: BORE / 2 + 1, h: 20, z: 30 }))
    .material('a356');
}

// ── 9. the timing gears (own frame: axis Z, on z 0): 20 teeth on the crank, 40 on the camshaft — 2:1, module 1.5,
// their centres m (z1 + z2) / 2 = 45 apart ──
export const GEAR_M = 1.5, CRANK_TEETH = 20, CAM_TEETH = 40, GEAR_CENTRES = GEAR_M * (CRANK_TEETH + CAM_TEETH) / 2;
export const crankGear = () => part('crank-gear').gear({ m: GEAR_M, teeth: CRANK_TEETH, b: 10, bore: 20, x: 0, y: 0, z: 0 }).material('steel');
export const camGear = () => part('cam-gear').gear({ m: GEAR_M, teeth: CAM_TEETH, b: 10, bore: 16, x: 0, y: 0, z: 0 }).material('steel');

// ── 10. a valve spring (own frame: axis Z, standing on z 0) ──
export const valveSpring = (name: string) => part(name).spring({ type: 'compression', d: 2.5, D: 18, n: 5, p: 6, ends: 'closed-ground', hand: 'right', x: 0, y: 0, z: 0 }).material('steel');

// ── 11. fasteners, from the shipped sample fastener sizes loaded as a person's file (rows rule b: none built in) ──
const SIZES = { name: 'fastener-sizes.json', text: readFileSync(join(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8') };
export const headBolt = () => part('head-bolt-m8x60').loadRows('fastener-sizes', SIZES).fastener({ kind: 'hex-bolt', size: 'M8', length: '60', joint: 'free', x: 0, y: 0, z: 0, model: 'cosmetic' }).material('steel');
export const caseScrew = () => part('case-screw-m6x30').loadRows('fastener-sizes', SIZES).fastener({ kind: 'socket-screw', size: 'M6', length: '30', joint: 'free', x: 0, y: 0, z: 0 }).material('steel');

// ── the parts, built once each and timed ──
export const PARTS: readonly [string, () => StudioPart][] = [
  ['crankshaft', crankshaft], ['connecting-rod', connectingRod], ['piston', piston],
  ['ring-top', () => ring('ring-top', GROOVES[0])], ['ring-second', () => ring('ring-second', GROOVES[1])], ['ring-oil', () => ring('ring-oil', GROOVES[2])],
  ['piston-pin', pistonPin], ['cylinder-block', cylinderBlock], ['cylinder-head', cylinderHead],
  ['valve-intake', () => valve('valve-intake')], ['valve-exhaust', () => valve('valve-exhaust')],
  ['camshaft', camshaft], ['follower-intake', () => follower('follower-intake')], ['follower-exhaust', () => follower('follower-exhaust')],
  ['crankcase-right', () => crankcaseHalf('crankcase-right', 1)], ['crankcase-left', () => crankcaseHalf('crankcase-left', -1)],
  ['crank-gear', crankGear], ['cam-gear', camGear], ['valve-spring', () => valveSpring('valve-spring')],
  ['head-bolt-m8x60', headBolt], ['case-screw-m6x30', caseScrew],
];

function main(out: string) {
  mkdirSync(join(out, 'parts'), { recursive: true });
  const report: Record<string, unknown>[] = [];
  for (const [name, make] of PARTS) {
    const t0 = performance.now();
    try {
      const p = make(), built = performance.now() - t0, m = p.mass(), r = (v: number) => Math.round(v * 1000) / 1000;
      writeFileSync(join(out, 'parts', `${name}.bcad`), JSON.stringify(p.doc));
      report.push({ part: name, features: p.doc.nodes.length, bodies: p.bodies().length, volumeMM3: r(m.volumeMM3), massG: r(m.massG), centroidMM: m.centroidMM.map(r), ms: Math.round(built) });
    } catch (e) {
      report.push({ part: name, error: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - t0) });
    }
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
  for (const r of report) console.log(JSON.stringify(r));
}

main(process.argv[2]);
