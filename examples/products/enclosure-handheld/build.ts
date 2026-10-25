// P2: a handheld device's two-part moulded housing — a 150 × 72 × 28 ABS case split at z 18, a lip on the lower half
// and a rebate in the cover taking it, screwed at the corners into heat-set inserts and held along its long sides by
// four snap hooks; inside, a board (a sized placeholder: PCB/ECAD is deferred) on standoffs, an 18650 cell in its bay,
// an aluminium heat sink on the board under the cover's vents, a USB-C opening in the end wall. Built on the object
// facade (@barocss/cad-model/api), the core functions where it doesn't reach. Run through run.mjs.
//
// The device's frame: X along its length, Y across, Z up; the case's bottom on z 0, its rim (the split) on z 18, the
// cover's top on z 28. Each part is in its own frame; the assembly places them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assembly, part, sketch, Plane, Location, type Assembly, type BodyQuery, type FaceInfo, type StudioPart } from '../../../packages/barocss-cad-model/src/api';
import { checkEnclosure, failure, type OutputFile } from './check';

type XY = [number, number];
type V3 = [number, number, number];

// ── sizes (mm) ──
export const LENGTH = 150, WIDTH = 72, CORNER_R = 8, SPLIT = 18, COVER_H = 10, HEIGHT = SPLIT + COVER_H;
/** The nominal wall, the draft on every wall along the pull (the smooth finish's recommended 1°). */
export const WALL = 2, DRAFT = 1;
/** The fit between the halves: the lower half's lip (the inner part of its wall, standing above the split) in the cover's rebate, 0.1 clear (the injection profile's fit clearance) all round and above. */
export const LIP_IN = 1.1, LIP_H = 2, FIT = 0.1;
/** The corner screws' axes: on the inner corners' centres. */
export const SCREWS: readonly XY[] = [[67, 28], [-67, 28], [67, -28], [-67, -28]];
/** The snap hooks, two on each long side; their beams 1.5 thick, 6 wide, 12 long, a 1 mm undercut, 0.2 clear of wall and ledge. */
export const HOOK_X = [-35, 35] as const, HOOK = { L: 12, t: 1.5, b: 6, y: 1 }, HOOK_GAP = 0.2;
/** The board (a placeholder): 62 × 52 × 1.6 on four M3 standoffs 5 high, its corner holes 4 in. */
export const BOARD = { x: 0, y: -26, w: 62, d: 52, t: 1.6, z: WALL + 5 }, BOARD_HOLES: readonly XY[] = [[4, 4], [58, 4], [58, 48], [4, 48]];
/** The cell: an 18650's nominal 18.4 × 65 (a stand-in: no person's cell rows), along X in its bay. */
export const CELL = { r: 9.2, l: 65, x: -67.5, z: WALL + 0.3 + 9.2 };
/** The heat sink: on the board's middle, 28 × 28 × 3 with six fins 1.5 × 12, under the cover's vents. */
export const SINK = { x: BOARD.x + BOARD.w / 2, base: 3, w: 28, fins: 6, fin: 1.5, finH: 12 };
/** The USB-C opening: a stand-in slot 9.0 × 3.2 (no person's connector rows — gap PG-11), in the +X end wall over the board. */
export const USB = { w: 9.0, h: 3.2, z: BOARD.z + BOARD.t + 1.6 };

const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const TAN = Math.tan(DRAFT * Math.PI / 180);

/** A rounded rectangle centred on the plane's origin. */
export function roundedRect(plane: Plane, l: number, w: number, r: number) {
  const a = round(l / 2), b = round(w / 2);
  r = round(r);
  return sketch(plane).moveTo([-a + r, -b]).lineTo([a - r, -b]).arcTo([a, -b + r], { center: [a - r, -b + r] }).lineTo([a, b - r]).arcTo([a - r, b], { center: [a - r, b - r] })
    .lineTo([-a + r, b]).arcTo([-a, b - r], { center: [-a + r, b - r] }).lineTo([-a, -b + r]).arcTo([-a + r, -b], { center: [-a + r, -b + r] }).close();
}
/** A slot (a stadium) w × h centred at (u, v) on the plane. */
function slot(plane: Plane, u: number, v: number, w: number, h: number) {
  const r = h / 2, a = w / 2 - r;
  return sketch(plane).moveTo([u - a, v - r]).lineTo([u + a, v - r]).arcTo([u + a, v + r], { center: [u + a, v] }).lineTo([u - a, v + r]).arcTo([u - a, v - r], { center: [u - a, v] }).close();
}

// ── faces, chosen by where they are (each part's own frame) ──
// Prefer the largest supporting plane, or the nearest boss end at a specified XY point.
// Ties remain multiple selections and are refused by the facade; never take an arbitrary first face.
export const flatAt = (nz: 1 | -1, z: number, at?: XY) => (b: BodyQuery) => {
  const faces = b.faces().where((f: FaceInfo) => f.kind === 'plane' && f.normal[2] * nz > 0.99 && Math.abs(f.centroid[2] - z) < 1e-6);
  const score = (f: FaceInfo) => at ? Math.hypot(f.centroid[0] - at[0], f.centroid[1] - at[1]) : -(f.area ?? 0);
  const best = Math.min(...faces.list().map(score));
  return faces.where(f => Math.abs(score(f) - best) < 1e-12);
};
/** A long wall's inner face: the one facing in from the side `side` (+1: +Y). */
const innerWall = (side: 1 | -1) => (b: BodyQuery) => {
  const faces = b.faces().where((f: FaceInfo) => f.kind === 'plane' && f.normal[1] * side < -0.99 && f.centroid[1] * side > 0);
  const largest = Math.max(...faces.list().map(f => f.area ?? 0));
  return faces.where(f => f.area === largest);
};

// ── how each part is made: moulded ABS, pulled out of its cavity, the smooth finish ──
function moulded(p: StudioPart, pull: V3): StudioPart {
  return p.material('abs').process('injection', { pull, finish: 'smooth' });
}
function drawn(p: StudioPart, title: string): StudioPart { return p.drawingSettings({ title }).autoDimension(); }

// ── 1. the lower case (own frame: the device's) ──
// A drafted rounded box open at the split, shelled to the wall, its floor's inside corners rounded; the lip round the
// rim; the screws' bosses with their clearance holes and counterbores from below; the board's standoffs, the cell's
// bay, two ribs under the board, the hooks' ledges on the long walls, and the USB-C opening.
export function caseBottom(): StudioPart {
  // (Drafted so the walls widen toward the split, the rim exactly 150 × 72: the sketch at the floor that much smaller.)
  const g = SPLIT * TAN;
  let p = part('case-bottom')
    .extrude(roundedRect(Plane.XY, LENGTH - 2 * g, WIDTH - 2 * g, CORNER_R - g), { h: SPLIT, draft: -DRAFT })
    .shell(b => b.faces().facing('+z'), { t: WALL });
  p = moulded(p, [0, 0, 1])
    .fillet(b => b.edges().where(e => Math.abs(e.a[2] - WALL) < 1e-6 && Math.abs(e.b[2] - WALL) < 1e-6), { radius: 1 })
    // (The lip: the wall's inner part, from LIP_IN to the wall's inside, standing LIP_H above the rim.)
    .union(q => q.extrude(roundedRect(Plane.XY.offset(SPLIT), LENGTH - 2 * LIP_IN, WIDTH - 2 * LIP_IN, CORNER_R - LIP_IN), { h: LIP_H })
      .subtract(r => r.extrude(roundedRect(Plane.XY.offset(SPLIT - 1), LENGTH - 2 * WALL, WIDTH - 2 * WALL, CORNER_R - WALL), { h: LIP_H + 2 })));
  // (The screws' bosses, Ø7.6 from the floor to 0.1 under the split; each screw's clearance hole Ø3.4 through it and the
  // floor, and a counterbore Ø6 × 3 for its head from below.)
  for (const [x, y] of SCREWS) p = p.union(q => q.cylinder({ r: 3.8, h: SPLIT - 0.1 - WALL, x, y, z: WALL }));
  for (const [x, y] of SCREWS) {
    p = p.hole(flatAt(-1, 0), { type: 'through', d: 3.4, x, y })
      .hole(flatAt(-1, 0), { type: 'blind', d: 6, depth: 3, x, y });
  }
  // (The board's standoffs: the enclosure library's, for M3 screws, 5 high.)
  for (const [u, v] of BOARD_HOLES) p = p.libraryPart('enclosure', 'pcb-standoff', { face: flatAt(1, WALL), point: [BOARD.x + u, BOARD.y + v, WALL], variant: 'M3', params: { h: BOARD.z - WALL } });
  // (The cell's bay: two walls along it and its two ends, 1.2 thick (0.6 × the wall) and 6 high (3 × the wall).)
  const bayY = CELL.r + 0.4, bayX0 = CELL.x - 0.5 - 1.2, bayX1 = CELL.x + CELL.l + 0.5;
  for (const y of [bayY, -bayY - 1.2]) p = p.union(q => q.box({ w: bayX1 + 1.2 - bayX0, d: 1.2, h: 6, x: bayX0, y, z: WALL }));
  for (const x of [bayX0, bayX1]) p = p.union(q => q.box({ w: 1.2, d: 2 * bayY + 2.4, h: 6, x, y: -bayY - 1.2, z: WALL }));
  // (Two ribs across the floor under the board, between its standoffs.)
  for (const x of [20, 40]) p = p.union(q => q.box({ w: 1.2, d: 50, h: 3, x: x - 0.6, y: -25, z: WALL }));
  // (The hooks' ledges: the library's, on the long walls' insides, their latch faces HOOK_GAP under the hooks' catches.)
  const ledgeZ = HEIGHT - WALL - HOOK.L + HOOK_GAP + 0.75;
  for (const side of [1, -1] as const) for (const x of HOOK_X) {
    p = p.libraryPart('enclosure', 'snap-ledge', { face: innerWall(side), point: [x, side * (WIDTH / 2 - WALL - (SPLIT - ledgeZ) * TAN), ledgeZ], xDirection: [-side, 0, 0], params: { e: HOOK.y, b: HOOK.b } });
  }
  // (The USB-C opening, a stand-in slot through the +X end wall.)
  p = p.subtract(q => q.extrude(slot(Plane.YZ.offset(LENGTH / 2 - 6), 0, USB.z, USB.w, USB.h), { h: 10 }));
  return drawn(p, 'case-bottom');
}

// ── 2. the cover (own frame: its rim on z 0, its top on z 10) ──
// A drafted rounded box open at the rim (the walls widen toward it), shelled; the rebate taking the lip; the screws'
// bosses (the library's, M3, to the rim) with heat-set insert holes; the hooks hanging from the top's inside; the
// vents over the heat sink.
export function cover(): StudioPart {
  let p = part('cover')
    .extrude(roundedRect(Plane.XY, LENGTH, WIDTH, CORNER_R), { h: COVER_H, draft: DRAFT })
    .shell(b => b.faces().facing('-z'), { t: WALL });
  p = moulded(p, [0, 0, -1])
    .fillet(b => b.edges().where(e => Math.abs(e.a[2] - (COVER_H - WALL)) < 1e-6 && Math.abs(e.b[2] - (COVER_H - WALL)) < 1e-6), { radius: 1 })
    // (The rebate: the wall cut back to LIP_IN − FIT from its outside, LIP_H + FIT up from the rim.)
    .subtract(q => q.extrude(roundedRect(Plane.XY.offset(-1), LENGTH - 2 * (LIP_IN - FIT), WIDTH - 2 * (LIP_IN - FIT), CORNER_R - (LIP_IN - FIT)), { h: LIP_H + FIT + 1 }));
  const top = flatAt(-1, COVER_H - WALL);
  for (const [x, y] of SCREWS) p = p.libraryPart('enclosure', 'screw-boss', { face: top, point: [x, y, COVER_H - WALL], variant: 'M3', params: { h: COVER_H - WALL, ribs: 0 } });
  for (const [x, y] of SCREWS) p = p.libraryPart('enclosure', 'insert-hole', { face: flatAt(-1, 0, [x, y]), point: [x, y, 0], variant: 'M3', params: { Lh: 6 } });
  // (Each hook's beam e + gap in from its wall, its catch toward the wall, the gap short of it.)
  for (const side of [1, -1] as const) for (const x of HOOK_X) {
    // (The wall the catch passes is the lower case's, where the catch hangs: HEIGHT − WALL − L up.)
    const wall = WIDTH / 2 - WALL - (SPLIT - (HEIGHT - WALL - HOOK.L)) * TAN;
    p = p.libraryPart('enclosure', 'snap-hook', { face: top, point: [x, side * round(wall - (HOOK.y + HOOK_GAP + HOOK.t / 2)), COVER_H - WALL], xDirection: [side, 0, 0], params: HOOK });
  }
  p = p.libraryPart('enclosure', 'slot-vent', { face: flatAt(1, COVER_H), point: [SINK.x, 0, COVER_H], params: { n: 8, sl: 22, sw: 1.5, p: 3.5 } });
  return drawn(p, 'cover');
}

// ── 3. the heat sink (own frame: its base's underside on z 0, centred) ──
export function heatSink(): StudioPart {
  const h = SINK.w / 2, pitch = (SINK.w - SINK.fin) / (SINK.fins - 1);
  const p = part('heat-sink')
    .box({ w: SINK.w, d: SINK.w, h: SINK.base, x: -h, y: -h })
    .union(q => q.box({ w: SINK.fin, d: SINK.w, h: SINK.finH, x: -h, y: -h, z: SINK.base }).linearPattern({ axis: 'x', spacing: round(pitch), count: SINK.fins }))
    .material('al6061').process('cnc-milling');
  return drawn(p, 'heat-sink');
}

// ── 4. the board, a sized placeholder (own frame: its corner on the origin) ──
export function board(): StudioPart {
  let p = part('board').box({ w: BOARD.w, d: BOARD.d, h: BOARD.t });
  for (const [x, y] of BOARD_HOLES) p = p.hole(flatAt(1, BOARD.t), { type: 'through', d: 3.4, x, y });
  return p.named('board (placeholder)');
}

// ── 5. the cell, a stand-in (own frame: its axis Z from z 0) ──
export const cell = () => part('cell-18650').cylinder({ r: CELL.r, h: CELL.l }).named('cell 18650 (stand-in)').bought();

// ── 6. the heat-set inserts, stand-ins sized from the library's M3 insert (its own estimate: Ø4.0 as pressed, 5 long),
// their bore the screw's Ø3 (the thread not modelled) ──
export const insert = () => part('insert-m3').cylinder({ r: 2, h: 5 }).subtract(q => q.cylinder({ r: 1.5, h: 7, z: -1 })).material('brass').named('heat-set insert M3 (stand-in)').bought();

// ── 7. fasteners, from shipped example rows: fixture evidence, not person-supplied product acceptance ──
let sizes: { name: string; text: string } | null = null;
const SIZES = () => sizes ??= { name: 'fastener-sizes.json', text: readFileSync(join(import.meta.dirname, '../../../packages/barocss-cad-model/samples/rows/fastener-sizes.json'), 'utf8') };
export const caseScrew = () => part('case-screw-m3x20').loadRows('fastener-sizes', SIZES()).fastener({ kind: 'socket-screw', size: 'M3', length: '20', joint: 'free', x: 0, y: 0, z: 0 }).material('steel');
// No length 5 in the sample rows. Use explicit illustrative solids, not invented rows or a standards claim (PG-12).
export const boardScrew = () => part('board-screw-m3x5').cylinder({ r: 1.5, h: 5, z: -5 })
  .union(q => q.cylinder({ r: 2.5, h: 1.6 })).material('steel').named('board screw (unthreaded stand-in)').bought();

// ── the parts, built once each and timed ──
export const PARTS: readonly [string, () => StudioPart][] = [
  ['case-bottom', caseBottom], ['cover', cover], ['heat-sink', heatSink], ['board', board], ['cell-18650', cell],
  ['insert-m3', insert], ['case-screw-m3x20', caseScrew], ['board-screw-m3x5', boardScrew],
];

// ── the assembly, closed ──
const at = (position: V3, rotation: V3 = [0, 0, 0]) => Location.of({ position, rotation });
export function enclosure(): Assembly {
  let a = assembly('enclosure-handheld', caseBottom())
    .addPart('cover', cover(), { at: at([0, 0, SPLIT]) })
    .addPart('board', board(), { at: at([BOARD.x, BOARD.y, BOARD.z]) })
    .addPart('heat-sink', heatSink(), { at: at([SINK.x, 0, BOARD.z + BOARD.t]) })
    .addPart('cell', cell(), { at: at([CELL.x, 0, CELL.z], [0, 90, 0]) });
  for (const [k, [x, y]] of SCREWS.entries()) {
    a = a.addPart(`insert-${k + 1}`, insert(), { at: at([x, y, SPLIT]) })
      // (From below, its head in the counterbore: seated on the counterbore's floor, 3 up, the shank upward.)
      .addPart(`case-screw-${k + 1}`, caseScrew(), { at: at([x, y, 3], [180, 0, 0]) });
  }
  for (const [k, [u, v]] of BOARD_HOLES.entries()) a = a.addPart(`board-screw-${k + 1}`, boardScrew(), { at: at([BOARD.x + u, BOARD.y + v, BOARD.z + BOARD.t]) });
  // Fastened: locked where they stand.
  a = a.lock('cover').lock('board').lock('heat-sink', 'board').lock('cell');
  for (let k = 1; k <= 4; k++) a = a.lock(`insert-${k}`, 'cover').lock(`case-screw-${k}`).lock(`board-screw-${k}`, 'board');
  return a;
}

/** A part's volume, mass and centre over all its bodies, each in its own material (none: left out, and said). */
export function partMass(p: StudioPart): { volume: number; mass: number | null } {
  let v = 0, g = 0, known = true;
  for (const key of p.bodies()) {
    const body = p.body(key);
    v += body.mass({ density: 1 }).volume;
    try { g += body.mass().mass; } catch (e) { if (failure(e).code !== 'MATERIAL_UNKNOWN') throw e; known = false; }
  }
  return { volume: v, mass: known ? g : null };
}

/** The assembly's drawing: A3, its BOM table and balloons. */
function assemblyDrawing(a: Assembly): OutputFile[] {
  try {
    const d = a.drawingSettings({ scope: { kind: 'assembly' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }], title: 'enclosure-handheld' }).drawing();
    return [{ path: 'assembly/drawing.svg', data: d.svg }, { path: 'assembly/drawing.dxf', data: d.dxf }, { path: 'assembly/drawing.pdf', data: d.pdf }, { path: 'assembly/issues.json', data: JSON.stringify(d.issues, null, 1) + '\n' }];
  } catch (e) { return [{ path: 'assembly/drawing.refused.txt', data: JSON.stringify(failure(e)) + '\n' }]; }
}

async function main(out: string) {
  mkdirSync(join(out, 'parts'), { recursive: true });
  const report: Record<string, unknown>[] = [];
  for (const [name, make] of PARTS) {
    const t0 = performance.now();
    try {
      const p = make(), built = performance.now() - t0, m = partMass(p), r = (v: number) => Math.round(v * 1000) / 1000;
      writeFileSync(join(out, 'parts', `${name}.bcad`), JSON.stringify(p.doc));
      report.push({ part: name, features: p.doc.nodes.length, bodies: p.bodies().length, volume: r(m.volume), mass: m.mass === null ? null : r(m.mass), warnings: p.libraryWarnings().length, duration: Math.round(built) / 1000 });
    } catch (e) {
      report.push({ part: name, error: failure(e), duration: Math.round(performance.now() - t0) / 1000 });
    }
  }
  const t0 = performance.now(); let asm: Assembly | null = null;
  try { asm = enclosure(); } catch (e) { report.push({ assembly: 'enclosure-handheld', error: failure(e) }); }
  if (asm) {
    report.push({ assembly: 'enclosure-handheld', parts: asm.parts().length, mates: asm.doc.mates?.length ?? 0, problems: asm.problems(), duration: Math.round(performance.now() - t0) / 1000 });
    // Keep generated documents outside the source tree.
    writeFileSync(join(out, 'enclosure.bcad'), JSON.stringify(asm.doc));
    const checked = await checkEnclosure(asm.doc, { files: true });
    for (const f of [...checked.files ?? [], ...assemblyDrawing(asm)]) { mkdirSync(join(out, 'outputs', dirname(f.path)), { recursive: true }); writeFileSync(join(out, 'outputs', f.path), f.data); }
    report.push({ checks: { ...checked, files: (checked.files ?? []).map(f => f.path) } });
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
  for (const r of report) console.log(JSON.stringify(r));
  process.exitCode = report.some(r => 'error' in r || (r.checks && !(r.checks as { ok: boolean }).ok)) ? 1 : 0;
}

if (process.argv[1]?.endsWith('build.mjs')) await main(process.argv[2]);
