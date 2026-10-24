// P1: a single-cylinder four-stroke engine, 125 cc class — bore 56, stroke 50 (crank radius 25), rod 100 between
// centres — built on the object facade (@barocss/cad-model/api), the core functions where it doesn't reach. Every part
// is in its own frame; the assembly places them (milestone 2). Run through run.mjs.
//
// The engine's frame: the crank's axis along Y through the origin, the cylinder's axis up Z; the piston at top dead
// centre has its pin 125 above the crank axis (crank 25 + rod 100).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assembly, part, sketch, Plane, Location, type Assembly, type StudioPart } from '../../../packages/barocss-cad-model/src/api';
import { checkEngine, type OutputFile } from './check';

type XY = [number, number];

// ── sizes (mm) ──
export const BORE = 56, STROKE = 50, CRANK = STROKE / 2, ROD = 100;
const JOURNAL_R = 12.5, PIN_R = 10, WEB_T = 12, WEB_GAP = 18;
/** The webs' counterweights: half discs of 48 — the rod's turning share and about 60 % of the reciprocating mass. */
const WEB_R = 48;
/** The journals run out to ±62 on the axis, through the case's bearing bosses (y ±49 … ±63); the gear's seat beyond, 12 long. */
export const JOURNAL_END = 62, SEAT_LENGTH = 12;
/** The timing gears' face, y 64 … 74: on the seat, clear of the bearing boss's face (y 63). */
const GEAR_Y = JOURNAL_END + 2;
const SMALL_END_PIN_R = 7;

// (Arc-and-line loops for the sketcher: two circles' outer tangents, for a cam lobe.)
function tangents(c1: XY, r1: number, c2: XY, r2: number): { right: [XY, XY]; left: [XY, XY] } {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const a = (r1 - r2) / d, b = Math.sqrt(1 - a * a);
  // (The unit normals n with n·(c2 − c1)/d = (r1 − r2)/d: the outer tangent on each side.)
  const nR: XY = [a * ux + b * uy, a * uy - b * ux], nL: XY = [a * ux - b * uy, a * uy + b * ux];
  const at = (c: XY, r: number, n: XY): XY => [round(c[0] + r * n[0]), round(c[1] + r * n[1])];
  return { right: [at(c1, r1, nR), at(c2, r2, nR)], left: [at(c1, r1, nL), at(c2, r2, nL)] };
}
const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
// ── how each part is made (milestone 3) ──
// The Library panel's Process; a casting's pull out of the die, the casting rules (the shipped sample rows, loaded as a
// person loads them) and the pattern's inputs — the faces machined after casting (bores, seats, joint faces), where the
// metal comes in, and the shrinkage: ours, 0.6 % for A356 in a permanent mould (no public page gave one to read); then
// the part's drawing, titled and dimensioned.
type V3 = [number, number, number];
interface Make { process: 'die-casting' | 'cnc-turning' | 'cnc-milling'; cast?: { pull: V3; machined: string[]; gate: V3 } }
const SHRINK = 0.006;
let rules: { name: string; text: string } | undefined;
const RULES = () => rules ??= { name: 'casting-rules.json', text: readFileSync(join(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/casting-rules.json'), 'utf8') };
function made(p: StudioPart, title: string, how: Make): StudioPart {
  let q = p.process(how.process, how.cast ? { pull: how.cast.pull } : {});
  if (how.cast) q = q.loadRows('casting-rules', RULES()).casting({ machined: how.cast.machined, gate: how.cast.gate, shrink: SHRINK });
  return q.drawingSettings({ title }).autoDimension();
}
const TURNED: Make = { process: 'cnc-turning' }, MILLED: Make = { process: 'cnc-milling' };

const rotate = ([x, y]: XY, deg: number): XY => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [round(x * c - y * s), round(x * s + y * c)]; };

// ── 1. the crankshaft (own frame: its axis Z, the crankpin toward +X) ──
// Two main journals, two webs whose counterweights sit opposite the pin, the crankpin between them, and the timing
// gear's seat beyond the right journal.
function web(z: number) {
  // (The web's outline: a counterweight half disc of radius WEB_R about the axis on −X, joined to a lobe of radius 16
  // round the crankpin.)
  const loop = sketch(Plane.XY.offset(z)).moveTo([0, WEB_R]).arcTo([0, -WEB_R], { center: [0, 0] }).lineTo([CRANK, -16]).arcTo([CRANK, 16], { center: [CRANK, 0] }).close();
  return loop;
}
export function crankshaft(): StudioPart {
  const half = WEB_GAP / 2, z1 = -half - WEB_T, journal = JOURNAL_END - half - WEB_T;
  const p = part('crankshaft')
    .cylinder({ r: JOURNAL_R, h: journal, z: z1 - journal })
    .union(p => p.extrude(web(z1), { h: WEB_T }))
    .union(p => p.cylinder({ r: PIN_R, h: WEB_GAP + 2, x: CRANK, z: -half - 1 }))
    .union(p => p.extrude(web(half), { h: WEB_T }))
    .union(p => p.cylinder({ r: JOURNAL_R, h: journal, z: half + WEB_T }))
    .union(p => p.cylinder({ r: 10, h: SEAT_LENGTH, z: JOURNAL_END }))
    .material('steel')
    // (The timing gear on its seat, a body of the crankshaft's own: a gear on a part locked to the shaft is not coupled
    // to the camshaft's by the joint tree — gap PG-4.)
    .gear({ m: GEAR_M, teeth: CRANK_TEETH, b: 10, bore: 20, x: 0, y: 0, z: GEAR_Y }).material('steel');
  return made(p, 'crankshaft', TURNED);
}

// ── 2. the connecting rod (own frame: in XY, big end at the origin, small end at +Y, 18 thick from z 0) ──
export function connectingRod(): StudioPart {
  // (Its outline: the big end's Ø34 and the small end's Ø22 joined by a shank 16 wide at the big end and 14 at the small,
  // narrow enough to swing inside the bore's lower edge.)
  const t = 15, yb = round(Math.sqrt(17 * 17 - 8 * 8)), ys = round(ROD - Math.sqrt(11 * 11 - 7 * 7));
  const outline = sketch().moveTo([8, yb]).lineTo([7, ys]).arcTo([-7, ys], { center: [0, ROD] }).lineTo([-8, yb]).arcTo([8, yb], { center: [0, 0] }).close();
  return made(part('connecting-rod')
    .extrude(outline, { h: t })
    .subtract(p => p.cylinder({ r: PIN_R + 0.05, h: t + 2, z: -1 }))
    .subtract(p => p.cylinder({ r: SMALL_END_PIN_R + 0.02, h: t + 2, y: ROD, z: -1 }))
    // (The I-beam: a pocket 4 deep in each face, between the ends.)
    .subtract(p => p.extrude(sketch(Plane.XY.offset(t - 4)).polygon([[-5, 24], [5, 24], [4, 86], [-4, 86]]), { h: 5 }))
    .subtract(p => p.extrude(sketch(Plane.XY.offset(-1)).polygon([[-5, 24], [5, 24], [4, 86], [-4, 86]]), { h: 5 }))
    .material('steel'), 'connecting-rod', MILLED);
}

// ── 3. the piston, its rings and its pin (own frame: axis Z, skirt from z 0, crown at z 50; pin axis along Y at z 20) ──
const PISTON_R = BORE / 2 - 0.1, GROOVE_R = PISTON_R - 2.5, PIN_Z = 20;
const GROOVES: readonly [number, number][] = [[44, 45.5], [40, 41.5], [35, 38]];
export function piston(): StudioPart {
  const pts: XY[] = [[23, 0], [PISTON_R, 0]];
  for (const [lo, hi] of [...GROOVES].reverse()) pts.push([PISTON_R, lo], [GROOVE_R, lo], [GROOVE_R, hi], [PISTON_R, hi]);
  pts.push([PISTON_R, 50], [0, 50], [0, 42], [23, 42]);
  return made(part('piston')
    .revolve(sketch(Plane.XZ).polygon(pts))
    // (The pin's bosses, inside the skirt either side, reaching a millimetre into its wall, and the pin's bore through both.)
    .union(p => p.box({ w: 18, d: 12, h: 16, x: -9, y: 12, z: PIN_Z - 8 }))
    .union(p => p.box({ w: 18, d: 12, h: 16, x: -9, y: -24, z: PIN_Z - 8 }))
    .subtract(p => p.extrude(sketch(Plane.XZ.offset(-30)).circle({ r: SMALL_END_PIN_R + 0.02, y: PIN_Z }), { h: 60 }))
    .material('a356'), 'piston', { process: 'die-casting', cast: {
      // (Cast skirt-down, the core from below; the skirt, the lands, the grooves, the crown and the pin's bore machined.)
      pull: [0, 0, 1], gate: [0, 0, 50],
      machined: ['n9.side[e1]', 'n1.side[e2]', 'n1.side[e3]', 'n1.side[e4]', 'n1.side[e5]', 'n1.side[e6]', 'n1.side[e7]', 'n1.side[e8]', 'n1.side[e9]', 'n1.side[e10]', 'n1.side[e11]', 'n1.side[e12]', 'n1.side[e13]', 'n1.side[e14]', 'n1.side[e15]'],
    } });
}
export function ring(name: string, [lo, hi]: readonly [number, number]): StudioPart {
  // (A ring in its groove, 0.05 short of its floor and 0.05 thinner: own frame, its groove's height from z 0.)
  const h = hi - lo - 0.05;
  return made(part(name).revolve(sketch(Plane.XZ).polygon([[GROOVE_R + 0.05, 0], [PISTON_R + 0.05, 0], [PISTON_R + 0.05, h], [GROOVE_R + 0.05, h]])).material('steel'), name, TURNED);
}
export function pistonPin(): StudioPart {
  return made(part('piston-pin').revolve(sketch(Plane.XZ).polygon([[4, 0], [SMALL_END_PIN_R, 0], [SMALL_END_PIN_R, 46], [4, 46]])).material('steel'), 'piston-pin', TURNED);
}

// ── 4. the finned cylinder block (own frame: bore axis Z, from z 0 on the crankcase to z 95 under the head; its spigot
// 3 down into the case, clear of the rod as it swings) ──
/**
 * The case's top (z 60, clear of the counterweights) to the block's deck, 156 above the crank's axis: the crown at top
 * dead centre (155) a squish clearance of 1 below it.
 */
export const CASE_TOP = 60, SQUISH = 1, BLOCK_H = CRANK + ROD + 30 + SQUISH - CASE_TOP, SPIGOT = 3, SPIGOT_R = 31.5;
export function cylinderBlock(): StudioPart {
  const fin = 2, pitch = 8, fins = Math.floor((BLOCK_H - 20) / pitch);
  return made(part('cylinder-block')
    .box({ w: 76, d: 76, h: 10, x: -38, y: -38 })
    .union(p => p.cylinder({ r: 36, h: BLOCK_H }))
    .union(p => p.box({ w: 100, d: 100, h: fin, x: -50, y: -50, z: 14 }).linearPattern({ axis: 'z', spacing: pitch, count: fins }))
    .union(p => p.cylinder({ r: SPIGOT_R, h: SPIGOT + 1, z: -SPIGOT }))
    .subtract(p => p.cylinder({ r: BORE / 2, h: BLOCK_H + SPIGOT + 2, z: -SPIGOT - 1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: 40, y: 40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: -40, y: 40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: 40, y: -40, z: -1 }))
    .subtract(p => p.cylinder({ r: 4.25, h: BLOCK_H + 2, x: -40, y: -40, z: -1 }))
    .material('a356'), 'cylinder-block', { process: 'die-casting', cast: {
      // (The bore, the spigot, the flange's seat, the deck and the stud holes machined; fed at the flange.)
      pull: [0, 0, 1], gate: [38, 0, 5],
      machined: ['n13.side0', 'n10.side0', 'n10.bottom', 'n1.bottom', 'n3.top', 'n16.side0', 'n19.side0', 'n22.side0', 'n25.side0'],
    } });
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
    // (The fins above the ports' bosses, z 26 up; each port in a boss Ø22 round its Ø18 passage at z 14, from the seat out
    // to the side — a passage cut into the plate alone would leave a knife edge of wall, and one lower would run over the
    // combustion dome's edge.)
    .union(q => q.box({ w: 100, d: 100, h: 2, x: -50, y: -50, z: 26 }).linearPattern({ axis: 'z', spacing: 8, count: 3 }))
    .union(q => q.extrude(sketch(Plane.YZ.offset(VALVE_X)).circle({ r: 11, x: 0, y: 14 }), { h: 50 - VALVE_X }))
    .union(q => q.extrude(sketch(Plane.YZ.offset(-50)).circle({ r: 11, x: 0, y: 14 }), { h: 50 - VALVE_X }))
    .subtract(q => q.revolve(dome));
  for (const sx of [-1, 1]) {
    p = p.subtract(q => q.cylinder({ r: 11, h: 20, x: sx * VALVE_X, z: -1 }))
      .subtract(q => q.cylinder({ r: 3.6, h: 30, x: sx * VALVE_X, z: 18 }))
      // (The port: from the seat out the side, a Ø18 passage along X at z 14.)
      .subtract(q => q.extrude(sketch(sx > 0 ? Plane.YZ.offset(VALVE_X) : Plane.YZ.offset(-60)).circle({ r: 9, x: 0, y: 14 }), { h: 60 - VALVE_X }));
  }
  p = p.subtract(q => q.cylinder({ r: 7, h: 48, y: 16, z: -1 }));
  for (const [x, y] of [[40, 40], [-40, 40], [40, -40], [-40, -40]] as const) p = p.subtract(q => q.cylinder({ r: 4.25, h: 48, x, y, z: -1 }));
  return made(p.material('a356'), 'cylinder-head', { process: 'die-casting', cast: {
    // (The gasket face, the valve seats and guides, the plug's hole and the stud holes machined; fed from the side.)
    pull: [0, 0, 1], gate: [50, 0, 6],
    machined: ['n3.bottom', 'n19.side0', 'n28.side0', 'n22.side0', 'n31.side0', 'n37.side0', 'n40.side0', 'n43.side0', 'n46.side0', 'n49.side0'],
  } });
}

// ── 6. a valve (own frame: axis Z, its face at z 0, the stem up to z 70) ──
export function valve(name: string): StudioPart {
  return made(part(name).revolve(sketch(Plane.XZ).polygon([[0, 0], [10.5, 0], [10.5, 1.5], [3, 6], [3, 70], [0, 70]])).material('steel'), name, TURNED);
}

// ── 7. the camshaft and its followers (own frame: axis Z) ──
// (A lobe: a base circle of 14 and a nose of 6 at 14 out — 6 lift — joined by their tangents; the exhaust lobe turned
// 90° from the intake's, as the 2:1 timing puts them.)
function lobe(z: number, phase: number) {
  const t = tangents([0, 0], 14, [0, 14], 6), r = (q: XY) => rotate(q, phase);
  return sketch(Plane.XY.offset(z)).moveTo(r(t.right[0])).lineTo(r(t.right[1])).arcTo(r(t.left[1]), { center: r([0, 14]) }).lineTo(r(t.left[0])).arcTo(r(t.right[0]), { center: [0, 0] }).close();
}
// (The shaft from z 20, clear of the crank's webs; its timing gear on z 62 — a body of its own, as on the crankshaft.)
export function camshaft(): StudioPart {
  const p = part('camshaft')
    .cylinder({ r: 8, h: 60, z: 20 })
    .union(p => p.extrude(lobe(20, 0), { h: 10 }))
    .union(p => p.extrude(lobe(33, 90), { h: 10 }))
    .material('steel')
    .gear({ m: GEAR_M, teeth: CAM_TEETH, b: 10, bore: 16, x: 0, y: 0, z: GEAR_Y - 2 }).material('steel');
  return made(p, 'camshaft', TURNED);
}
export function follower(name: string): StudioPart {
  // (Its foot Ø10, the lobe's width: clear of the crank's webs beside it.)
  return made(part(name).cylinder({ r: 5, h: 12 }).union(p => p.cylinder({ r: 3, h: 20, z: 12 })).material('steel'), name, TURNED);
}

// The camshaft's axis: along Y, 45 (the gears' centres) from the crank's, down and back at 45°.
export const EXPECTED_GEAR_CENTRES = 45, CAM_X = round(-EXPECTED_GEAR_CENTRES / Math.SQRT2), CAM_Z = round(-EXPECTED_GEAR_CENTRES / Math.SQRT2);

// ── 8. the crankcase halves (the engine's frame: split on y = 0, the crank's axis along Y) ──
// A box 120 × 55 × 130 each, hollow to 6 mm walls and open on the split face, a main bearing's boss round the axis in its
// outer wall and its bore, and the cylinder's opening in the top.
export function crankcaseHalf(name: string, side: 1 | -1): StudioPart {
  const outer = side > 0 ? Plane.of({ origin: [0, 49, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] }) : Plane.of({ origin: [0, -49, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  return made(part(name)
    .box({ w: 120, d: 55, h: CASE_TOP + 70, x: -60, y: side > 0 ? 0 : -55, z: -70 })
    .shell(b => b.faces().facing(side > 0 ? '-y' : '+y'), { t: 6 })
    .union(p => p.extrude(sketch(outer).circle({ r: 20 }), { h: 14 }))
    .subtract(p => p.extrude(sketch(Plane.of({ origin: [0, side * 70, 0], normal: [0, -side, 0], xAxis: [1, 0, 0] })).circle({ r: JOURNAL_R + 0.1 }), { h: 40 }))
    .subtract(p => p.cylinder({ r: SPIGOT_R + 0.5, h: 20, z: CASE_TOP - 10 }))
    // (The camshaft's bearing, through the right half's wall only.)
    .subtract(p => side > 0 ? p.extrude(sketch(Plane.of({ origin: [0, 40, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] })).circle({ r: 8.1, x: CAM_X, y: -CAM_Z }), { h: 30 }) : p.box({ w: 1, d: 1, h: 1, x: 200, y: 200, z: 200 }))
    .material('a356').named(name), name, { process: 'die-casting', cast: {
      // (Pulled out of the open split face; the split face, the main bearing's bore and boss face, the cylinder's seat
      // and opening, and the right half's cam bearing machined; fed at the bottom.)
      pull: [0, -side, 0], gate: [0, side * 27, -70],
      machined: [side > 0 ? 'n1.side0' : 'n1.side2', 'n7.side[e1]', 'n4.top', 'n1.top', 'n10.side0', ...(side > 0 ? ['n13.side[e1]'] : [])],
    } });
}

// ── 9. the timing gears (on the crankshaft's seat and the camshaft, bodies of their own): 20 teeth on the crank, 40 on
// the camshaft — 2:1, module 1.5, their centres m (z1 + z2) / 2 = 45 apart ──
export const GEAR_M = 1.5, CRANK_TEETH = 20, CAM_TEETH = 40, GEAR_CENTRES = GEAR_M * (CRANK_TEETH + CAM_TEETH) / 2;
if (GEAR_CENTRES !== EXPECTED_GEAR_CENTRES) throw new Error('the gears\' centres and the camshaft\'s place disagree');

// ── 10. a valve spring (own frame: axis Z, standing on z 0) ──
// (Bought, as a valve spring is: the BOM and the purchase list carry it as bought.)
export const valveSpring = (name: string) => part(name).spring({ type: 'compression', d: 2.5, D: 18, n: 5, p: 6, ends: 'closed-ground', hand: 'right', x: 0, y: 0, z: 0 }).material('steel').bought();

// ── 11. fasteners, from the shipped sample fastener sizes loaded as a person's file (rows rule b: none built in) ──
let sizes: { name: string; text: string } | null = null;
const SIZES = () => sizes ??= { name: 'fastener-sizes.json', text: readFileSync(join(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8') };
export const headBolt = () => part('head-bolt-m8x60').loadRows('fastener-sizes', SIZES()).fastener({ kind: 'hex-bolt', size: 'M8', length: '60', joint: 'free', x: 0, y: 0, z: 0, model: 'cosmetic' }).material('steel');
export const caseScrew = () => part('case-screw-m6x30').loadRows('fastener-sizes', SIZES()).fastener({ kind: 'socket-screw', size: 'M6', length: '30', joint: 'free', x: 0, y: 0, z: 0 }).material('steel');

// ── the parts, built once each and timed ──
export const PARTS: readonly [string, () => StudioPart][] = [
  ['crankshaft', crankshaft], ['connecting-rod', connectingRod], ['piston', piston],
  ['ring-top', () => ring('ring-top', GROOVES[0])], ['ring-second', () => ring('ring-second', GROOVES[1])], ['ring-oil', () => ring('ring-oil', GROOVES[2])],
  ['piston-pin', pistonPin], ['cylinder-block', cylinderBlock], ['cylinder-head', cylinderHead],
  ['valve-intake', () => valve('valve-intake')], ['valve-exhaust', () => valve('valve-exhaust')],
  ['camshaft', camshaft], ['follower-intake', () => follower('follower-intake')], ['follower-exhaust', () => follower('follower-exhaust')],
  ['crankcase-right', () => crankcaseHalf('crankcase-right', 1)], ['crankcase-left', () => crankcaseHalf('crankcase-left', -1)],
  ['valve-spring', () => valveSpring('valve-spring')],
  ['head-bolt-m8x60', headBolt], ['case-screw-m6x30', caseScrew],
];

// ── the assembly, at top dead centre (the crankpin straight up) ──
// Each part goes in where it stands at TDC; what moves is mated (the crank in its bearings, the rod on the crankpin, the
// piston on the rod's small end and in the bore, the camshaft in its bearing), what is fastened is locked.
const Y_ALONG: [number, number, number] = [-90, 0, 0]; // (a part's own Z along the engine's Y)
const at = (position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => Location.of({ position, rotation });
export function engine(): Assembly {
  const PIN_TDC = CRANK + ROD, DECK = CASE_TOP + BLOCK_H, PISTON_Z0 = PIN_TDC - PIN_Z;
  let a = assembly('engine-1cyl', crankcaseHalf('crankcase-right', 1))
    .addPart('crankcase-left', crankcaseHalf('crankcase-left', -1)).lock('crankcase-left')
    .addPart('crankshaft', crankshaft(), { at: at([0, 0, 0], [-90, -90, 0]) })
    .addPart('camshaft', camshaft(), { at: at([CAM_X, 2, CAM_Z], Y_ALONG) })
    .addPart('connecting-rod', connectingRod(), { at: at([0, -9, CRANK], [90, 0, 180]) })
    .addPart('piston', piston(), { at: at([0, 0, PISTON_Z0]) })
    .addPart('piston-pin', pistonPin(), { at: at([0, -23, PIN_TDC], Y_ALONG) })
    .addPart('cylinder-block', cylinderBlock(), { at: at([0, 0, CASE_TOP]) })
    .addPart('cylinder-head', cylinderHead(), { at: at([0, 0, DECK]) });
  for (const [k, g] of GROOVES.entries()) a = a.addPart(['ring-top', 'ring-second', 'ring-oil'][k], ring(['ring-top', 'ring-second', 'ring-oil'][k], g), { at: at([0, 0, PISTON_Z0 + g[0]]) });
  for (const [side, sx] of [['intake', -1], ['exhaust', 1]] as const) {
    a = a.addPart(`valve-${side}`, valve(`valve-${side}`), { at: at([sx * VALVE_X, 0, DECK + 1]) })
      .addPart(`spring-${side}`, valveSpring(`spring-${side}`), { at: at([sx * VALVE_X, 0, DECK + 46]) });
  }
  // (The followers on the lobes' base circles, straight above the camshaft's axis.)
  a = a.addPart('follower-intake', follower('follower-intake'), { at: at([CAM_X, 27, CAM_Z + 14]) })
    .addPart('follower-exhaust', follower('follower-exhaust'), { at: at([CAM_X, 40, CAM_Z + 14]) });
  for (const [k, [x, y]] of ([[40, 40], [-40, 40], [40, -40], [-40, -40]] as const).entries()) a = a.addPart(`head-bolt-${k + 1}`, headBolt(), { at: at([x, y, DECK + 42]) });
  // Fastened: locked where they stand.
  a = a.lock('cylinder-block').lock('cylinder-head', 'cylinder-block')
    .lock('piston-pin', 'piston').lock('ring-top', 'piston').lock('ring-second', 'piston').lock('ring-oil', 'piston')
    .lock('valve-intake', 'cylinder-head').lock('valve-exhaust', 'cylinder-head').lock('spring-intake', 'cylinder-head').lock('spring-exhaust', 'cylinder-head')
    .lock('follower-intake').lock('follower-exhaust');
  for (let k = 1; k <= 4; k++) a = a.lock(`head-bolt-${k}`, 'cylinder-head');
  // What moves, mated as a mechanic assembles it — by the faces' persistent names, each part's own (see faces.md):
  // the crank in its main bearing and set 28 inside the right half's wall; the rod on the crankpin, flush with the
  // left web; the piston on the rod's small end and in the bore (the loop the slider-crank closes); the camshaft in its
  // bearing, 4 inside the wall.
  a = a.addMate('concentric', { part: 'base', face: 'n7.side[e1]' }, { part: 'crankshaft', face: 'n12.side0' })
    .addMate('distance', { part: 'base', face: 'n4.bottom' }, { part: 'crankshaft', face: 'n9.top' }, { distance: 28 })
    .addMate('concentric', { part: 'crankshaft', face: 'n6.side0' }, { part: 'connecting-rod', face: 'n3.side0' })
    .addMate('coincident', { part: 'crankshaft', face: 'n3.top' }, { part: 'connecting-rod', face: 'n1.bottom' })
    .addMate('concentric', { part: 'connecting-rod', face: 'n6.side0' }, { part: 'piston', face: 'n9.side[e1]' })
    .addMate('concentric', { part: 'cylinder-block', face: 'n13.side0' }, { part: 'piston', face: 'n1.side[e2]' })
    .addMate('concentric', { part: 'base', face: 'n13.side[e1]' }, { part: 'camshaft', face: 'n1.side0' })
    .addMate('distance', { part: 'base', face: 'n4.bottom' }, { part: 'camshaft', face: 'n6.top' }, { distance: 4 });
  return a;
}

/** A part's volume, mass and centre over all its bodies, each in its own material. */
export function partMass(p: StudioPart): { volume: number; mass: number; centroid: [number, number, number] } {
  let v = 0, g = 0, c: [number, number, number] = [0, 0, 0];
  for (const key of p.bodies()) {
    const m = p.body(key).mass();
    v += m.volume; g += m.mass; c = [c[0] + m.mass * m.centroid[0], c[1] + m.mass * m.centroid[1], c[2] + m.mass * m.centroid[2]];
  }
  return { volume: v, mass: g, centroid: [c[0] / g, c[1] / g, c[2] / g] };
}

/** The assembly's drawing: A3, its BOM table and balloons. */
function assemblyDrawing(a: Assembly): OutputFile[] {
  try {
    const d = a.drawingSettings({ scope: { kind: 'assembly' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }], title: 'engine-1cyl' }).drawing();
    return [{ path: 'assembly/drawing.svg', data: d.svg }, { path: 'assembly/drawing.dxf', data: d.dxf }, { path: 'assembly/drawing.pdf', data: d.pdf }, { path: 'assembly/issues.json', data: JSON.stringify(d.issues, null, 1) + '\n' }];
  } catch (e) { return [{ path: 'assembly/drawing.refused.txt', data: `${e instanceof Error ? e.message : String(e)}\n` }]; }
}

async function main(out: string) {
  mkdirSync(join(out, 'parts'), { recursive: true });
  const report: Record<string, unknown>[] = [];
  for (const [name, make] of PARTS) {
    const t0 = performance.now();
    try {
      const p = make(), built = performance.now() - t0, m = partMass(p), r = (v: number) => Math.round(v * 1000) / 1000;
      writeFileSync(join(out, 'parts', `${name}.bcad`), JSON.stringify(p.doc));
      report.push({ part: name, features: p.doc.nodes.length, bodies: p.bodies().length, volume: r(m.volume), mass: r(m.mass), centroid: m.centroid.map(r), duration: Math.round(built) / 1000 });
    } catch (e) {
      report.push({ part: name, error: e instanceof Error ? e.message : String(e), duration: Math.round(performance.now() - t0) / 1000 });
    }
  }
  const t0 = performance.now(); let asm: Assembly | null = null;
  try { asm = engine(); } catch (e) { report.push({ assembly: 'engine-1cyl', error: e instanceof Error ? e.message : String(e) }); }
  if (asm) {
    const built = performance.now() - t0;
    // (The assembly beside this file, committed: the build regenerates it byte for byte — engine.test.mjs.)
    writeFileSync(join(import.meta.dirname, 'engine.bcad'), JSON.stringify(asm.doc));
    const t1 = performance.now(), r = asm.robot(), tree = r.joints();
    report.push({ assembly: 'engine-1cyl', parts: asm.parts().length, mates: asm.doc.mates?.length ?? 0, problems: asm.problems(), duration: Math.round(built) / 1000,
      joints: tree.joints.map(j => ({ key: j.key, type: j.type, parent: j.parent, child: j.child })), loops: tree.loops.map(l => l.parts), couplings: tree.couplings.length, treeProblems: tree.problems.map(p => p.code), treeTime: Math.round(performance.now() - t1) / 1000 });
  }
  if (asm) {
    // (The checks, keeping the outputs they make: each made part's drawing, report and CAM package, the BOM and the
    // purchase list; and the assembly's drawing with its BOM table and balloons.)
    const checked = await checkEngine(asm.doc, { files: true });
    for (const f of [...checked.files ?? [], ...assemblyDrawing(asm)]) { mkdirSync(join(out, 'outputs', dirname(f.path)), { recursive: true }); writeFileSync(join(out, 'outputs', f.path), f.data); }
    report.push({ checks: { ...checked, files: (checked.files ?? []).map(f => f.path) } });
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
  for (const r of report) console.log(JSON.stringify(r));
}

if (process.argv[1]?.endsWith("build.mjs")) await main(process.argv[2]);
