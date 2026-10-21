// R12c.3b (D157): what goes on a shaft — a parallel key in a keyseat, the hub's keyway on a bore, a retaining ring in a
// groove, a pin in a cross hole — each built where its feature on the shaft says, with the pair's checks. Every size is
// the user's (their own rows; the studio's prefills are labelled estimates; none built in, D139). Where a pair is a fit
// (a key's width in its seat and keyway, a pin in its hole), the classes and the user's fit tables go through R12c.2
// (fitLimits, checkFit) — never a built-in table.
// - A key: { keyseat (its index on the shaft), width (default the seat's), height, length (default the seat's), ends
//   round | square (default: an end-milled seat's round, else square) }, its bottom on the seat's floor, centred in the
//   seat. Checks: its width against the seat's (wider: KEY_FIT unless classes make it a declared fit), its length within
//   the seat's (KEY_FIT), how far it stands above the shaft (h − t1). With a hub keyway: coaxial, over the seat, its
//   width against the key's, and the clearance between the key's top and the keyway's floor, (r_h + t2) − (R − t1 + h)
//   (≤ 0: KEY_FIT).
// - A keyway on a bore: { face (a cylindrical hole's), width, depth t2 (from the bore's surface on the centre line),
//   angle (degrees about the bore's axis from its reference direction: +X projected, else +Y) }, through the face.
// - A retaining ring: { groove (its index), thickness, outerDiameter (its envelope), row?: the user's ring row
//   { shaftDiameterMM?, grooveDiameterMM?, grooveWidthMM?, source | estimate } }: an annulus from the groove's bottom to
//   its outer diameter, centred in the groove. Checks: thickness within the groove (RING_FIT), the row's sizes against
//   the shaft's step and groove (RING_FIT, naming both).
// - A pin: { hole (its index), diameter (default the hole's), length (default the step's diameter) }, centred on the
//   shaft's axis along the hole. A pin larger than its hole needs fit classes (PIN_FIT otherwise).
import type { Brep } from './brep-core.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { transformBrep, type BrepAffine } from './brep-transform.js';
import { evaluateCadPart } from './part-model.js';
import { fitLimits, type FitLimits, type FitTable } from './fits.js';
import type { ShaftReport } from './shaft.js';
import type { Point } from './types.js';

export type ShaftPartCode = 'INVALID_INPUT' | 'KEY_FIT' | 'RING_FIT' | 'PIN_FIT';
export class ShaftPartError extends Error {
  constructor(readonly code: ShaftPartCode, detail: string) { super(`shaft part: ${detail}`); this.name = 'ShaftPartError'; }
}
const fail = (code: ShaftPartCode, detail: string): never => { throw new ShaftPartError(code, detail); };
const pos = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fail('INVALID_INPUT', `${what} must be a number of mm above 0`));
const EPS = 1e-9;
const mm = (x: number) => +x.toFixed(6);

/** The shaft as placed: its report and the map from its own frame (axis +Z) into the part. */
export interface PlacedShaft { readonly report: ShaftReport; readonly place: BrepAffine }
/** A hub keyway as cut: its sizes, the bore's axis and the keyway's direction from it. */
export interface KeywayReport { readonly face: string; readonly widthMM: number; readonly depthMM: number; readonly boreRadiusMM: number; readonly floorRadiusMM: number; readonly axisPoint: Point; readonly axis: Point; readonly direction: Point; readonly angleDeg: number; readonly fromMM: number; readonly toMM: number }
export interface KeyFitClasses { readonly tables: readonly FitTable[]; readonly key: string; readonly seat?: string; readonly hub?: string }
export interface KeyReport {
  readonly keyseat: number; readonly widthMM: number; readonly heightMM: number; readonly lengthMM: number; readonly ends: 'round' | 'square';
  /** The seat's width less the key's (negative: the key is the wider), how far the key stands above the shaft, its length's room in the seat. */
  readonly seatPlayMM: number; readonly standsMM: number; readonly lengthRoomMM: number;
  /** With a hub: the keyway's width less the key's and the clearance over the key's top. */
  readonly hub?: { readonly keywayPlayMM: number; readonly topClearanceMM: number };
  /** With classes: the seat's and the hub's fits on the key's width (R12c.2). */
  readonly seatFit?: FitLimits; readonly hubFit?: FitLimits;
}
export interface RingRow { readonly shaftDiameterMM?: number; readonly grooveDiameterMM?: number; readonly grooveWidthMM?: number; readonly source?: string; readonly estimate?: boolean }
export interface RingReport { readonly groove: number; readonly thicknessMM: number; readonly innerDiameterMM: number; readonly outerDiameterMM: number; readonly axialPlayMM: number; readonly estimate: boolean; readonly source?: string }
export interface PinReport { readonly hole: number; readonly diameterMM: number; readonly lengthMM: number; readonly holeDiameterMM: number; readonly clearanceMM: number }

/** A tool's part document: one sketch extruded `height` along its plane's normal. */
function prism(id: string, sketch: Record<string, unknown>, height: number): Brep {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: `${id}s`, kind: 'sketch', ...sketch }, { id, kind: 'extrude', sketch: `${id}s`, height }] };
  return evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(id).brep;
}
const named = (b: Brep, name: string): Brep => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, () => name);
/** A part's faces renamed from its tool's id to its own (`<tool>.top` → `<id>.top`). */
const own = (b: Brep, tool: string, id: string): Brep => transformBrep(b, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, n => n.split(`${tool}.`).join(`${id}.`));
const turnZ = (deg: number): BrepAffine['matrix'] => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const apply = (m: BrepAffine, p: Point): Point => { const a = m.matrix, t = m.offset ?? [0, 0, 0]; return [a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + t[0], a[3] * p[0] + a[4] * p[1] + a[5] * p[2] + t[1], a[6] * p[0] + a[7] * p[1] + a[8] * p[2] + t[2]]; };
const dirOf = (m: BrepAffine, v: Point): Point => { const a = m.matrix; return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]; };
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Point): Point => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: Point, s: number): Point => [a[0] * s, a[1] * s, a[2] * s];
/** A bore's reference direction square to its axis: +X projected, else +Y. */
function reference(a: Point): Point { const x: Point = [1, 0, 0], y: Point = [0, 1, 0], r = Math.abs(dot(a, x)) < 0.9 ? x : y; return unit(sub(r, scl(a, dot(r, a)))); }

/** The hub's keyway cut into `target` at its bore face. */
export function keywayCut(target: Brep, spec: { readonly face: string; readonly widthMM: number; readonly depthMM: number; readonly angleDeg?: number }, id: string): { readonly brep: Brep; readonly report: KeywayReport } {
  const face = target.faces.find(f => f.name === spec.face) ?? target.faces.find(f => f.name?.replace(/#\d+$/, '') === spec.face) ?? target.faces.find(f => f.id === spec.face);
  if (!face) return fail('INVALID_INPUT', `no face ${spec.face} on the hub`);
  const g = faceGeometry(face);
  if (g.kind !== 'cylinder' || g.out !== -1) fail('KEY_FIT', `${spec.face} is not a bore (a cylindrical hole's face): a keyway is cut into a hub's bore`);
  const cyl = g as Extract<typeof g, { kind: 'cylinder' }>, b = pos(spec.widthMM, 'the keyway\'s width'), t2 = pos(spec.depthMM, 'the keyway\'s depth'), r = cyl.r, a = unit([...cyl.a] as Point);
  if (!(b < 2 * r)) fail('KEY_FIT', `a keyway ${b} mm wide is no narrower than its Ø${mm(2 * r)} bore`);
  // The face's extent along its axis (its loops' vertices).
  const loops = new Set(face.loops), edges = new Map(target.edges.map(e => [e.id, e])), verts = new Map(target.vertices.map(v => [v.id, v.point]));
  let lo = Infinity, hi = -Infinity;
  for (const c of target.coedges) if (loops.has(c.loop)) for (const v of edges.get(c.edge)!.vertices) { const s = dot(sub(verts.get(v)!, cyl.c as Point), a); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  const deg = spec.angleDeg ?? 0, u0 = reference(a), u = unit(add(scl(u0, Math.cos(deg * Math.PI / 180)), scl(cross(a, u0), Math.sin(deg * Math.PI / 180)))), v = cross(a, u);
  // (The box starts inside the bore's air, short of its chord at the keyway's sides, and ends at the floor r + t2.)
  const inner = Math.sqrt(r * r - b * b / 4) - Math.min(0.5, r / 4), origin = add(cyl.c as Point, add(scl(u, inner), scl(a, lo - 1)));
  const tool = prism(`${id}__kw`, { profile: 'rectangle', min: [-b / 2, 0], max: [b / 2, hi - lo + 2], plane: { origin, normal: u, xAxis: v } }, r + t2 - inner);
  const brep = booleanAnalytic(target, named(tool, `${id}.keyway`), 'difference');
  return { brep, report: { face: spec.face, widthMM: b, depthMM: t2, boreRadiusMM: r, floorRadiusMM: r + t2, axisPoint: [...cyl.c] as Point, axis: a, direction: u, angleDeg: deg, fromMM: lo, toMM: hi } };
}

/** A parallel key in keyseat `spec.keyseat` of a placed shaft; with a hub keyway, checked against it. */
export function keySolid(shaft: PlacedShaft, spec: { readonly keyseat: number; readonly widthMM?: number; readonly heightMM: number; readonly lengthMM?: number; readonly ends?: 'round' | 'square'; readonly hub?: KeywayReport; readonly fit?: KeyFitClasses }, id: string): { readonly brep: Brep; readonly report: KeyReport } {
  const seat = shaft.report.keyseats.find(k => k.index === spec.keyseat) ?? fail('INVALID_INPUT', `the shaft has no keyseat ${spec.keyseat} (it has ${shaft.report.keyseats.length})`);
  const b = spec.widthMM === undefined ? seat.widthMM : pos(spec.widthMM, 'the key\'s width'), h = pos(spec.heightMM, 'the key\'s height'), floorLen = seat.lengthMM;
  const l = spec.lengthMM === undefined ? floorLen : pos(spec.lengthMM, 'the key\'s length'), ends = spec.ends ?? (seat.ends === 'end-mill' ? 'round' : 'square');
  if (ends !== 'round' && ends !== 'square') fail('INVALID_INPUT', 'a key\'s ends are round or square');
  if (ends === 'round' && !(l > b)) fail('KEY_FIT', `a round-ended key's length ${l} mm must exceed its width ${b} mm`);
  // Its length in the seat: an end-milled seat's ends are round (a square key's corners need the straight part), a square or disc seat's floor flat.
  const room = seat.ends === 'end-mill' && ends === 'square' ? floorLen - b - l : floorLen - l;
  if (room < -EPS) fail('KEY_FIT', `the key, ${l} mm long${ends === 'square' && seat.ends === 'end-mill' ? ' with square ends' : ''}, does not fit keyseat ${seat.index} (${floorLen} mm${seat.ends === 'end-mill' ? ', round-ended' : ''})`);
  const play = seat.widthMM - b;
  let seatFit: FitLimits | undefined, hubFit: FitLimits | undefined;
  if (spec.fit) {
    // (Classes apply to one nominal size, so the key is modelled at its seat's width: the classes carry the limits, R12c.2.)
    if (Math.abs(play) > EPS) fail('KEY_FIT', `with fit classes the key is modelled at its seat's nominal width ${mm(seat.widthMM)} mm (it is ${mm(b)}): the classes carry the limits`);
    if (spec.fit.seat) seatFit = fitLimits(spec.fit.tables, spec.fit.seat, spec.fit.key, seat.widthMM);
    if (spec.fit.hub) hubFit = fitLimits(spec.fit.tables, spec.fit.hub, spec.fit.key, seat.widthMM);
  }
  if (play < -EPS) fail('KEY_FIT', `the key is ${mm(b)} wide in a ${mm(seat.widthMM)} mm seat: model it at the seat's width and declare its width fit (classes from your fit tables) for an interference, or make it narrower`);
  // Built in the shaft's frame on +X, turned to the seat's angle, then placed with the shaft.
  const rf = seat.floorRadiusMM, z0 = seat.fromMM + (floorLen - l) / 2, plane = { origin: [rf, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const local = ends === 'square' ? prism(`${id}__k`, { profile: 'rectangle', min: [-b / 2, z0], max: [b / 2, z0 + l], plane }, h)
    : prism(`${id}__k`, { profile: 'loop', segments: [{ kind: 'line', start: [b / 2, z0 + b / 2] }, { kind: 'arc', start: [b / 2, z0 + l - b / 2], center: [0, z0 + l - b / 2], direction: 'ccw' }, { kind: 'line', start: [-b / 2, z0 + l - b / 2] }, { kind: 'arc', start: [-b / 2, z0 + b / 2], center: [0, z0 + b / 2], direction: 'ccw' }], plane }, h);
  const brep = transformBrep(transformBrep(own(local, `${id}__k`, id), { matrix: turnZ(seat.angleDeg) }), shaft.place);
  const stands = h - seat.depthMM;
  let hub: KeyReport['hub'];
  if (spec.hub) {
    // The hub's bore on the shaft's axis, its keyway over the seat, its floor above the key's top.
    const k = spec.hub, axisW = unit(dirOf(shaft.place, [0, 0, 1])), originW = apply(shaft.place, [0, 0, 0]), seatDir = unit(dirOf(shaft.place, [Math.cos(seat.angleDeg * Math.PI / 180), Math.sin(seat.angleDeg * Math.PI / 180), 0]));
    const off = sub(k.axisPoint, originW), offAxis = Math.hypot(...sub(off, scl(axisW, dot(off, axisW))));
    if (Math.abs(Math.abs(dot(k.axis, axisW)) - 1) > 1e-9 || offAxis > 1e-6) fail('KEY_FIT', `the hub's bore is not on the shaft's axis (${mm(offAxis)} mm off)`);
    if (dot(k.direction, seatDir) < 1 - 1e-9) fail('KEY_FIT', `the hub's keyway is not over keyseat ${seat.index} (${mm(Math.acos(Math.max(-1, Math.min(1, dot(k.direction, seatDir)))) * 180 / Math.PI)}° round from it)`);
    const top = rf + h, clear = k.floorRadiusMM - top, kplay = k.widthMM - b;
    if (clear <= EPS) fail('KEY_FIT', `the key's top at ${mm(top)} mm from the axis reaches the keyway's floor at ${mm(k.floorRadiusMM)} (t1 + t2 − h = ${mm(seat.depthMM + k.depthMM - h)} with the bore at the shaft's size)`);
    if (kplay < -EPS) fail('KEY_FIT', `the key is ${mm(b)} wide in a ${mm(k.widthMM)} mm keyway: widen the keyway (its fit on the key's width goes in the classes)`);
    // The key's span along the axis within the keyway's (the hub's frame: along its axis from its axis point).
    const zs = [z0, z0 + l].map(z => dot(sub(apply(shaft.place, [0, 0, z]), k.axisPoint), k.axis)), klo = Math.min(...zs), khi = Math.max(...zs);
    if (klo < k.fromMM - EPS || khi > k.toMM + EPS) { /* (a key longer than its hub stands out of it: allowed, said in the notes by the length room) */ }
    hub = { keywayPlayMM: kplay, topClearanceMM: clear };
  }
  return { brep, report: { keyseat: seat.index, widthMM: b, heightMM: h, lengthMM: l, ends, seatPlayMM: play, standsMM: stands, lengthRoomMM: room, ...(hub ? { hub } : {}), ...(seatFit ? { seatFit } : {}), ...(hubFit ? { hubFit } : {}) } };
}

/** A retaining ring's envelope in groove `spec.groove` of a placed shaft, checked against the user's row. */
export function ringSolid(shaft: PlacedShaft, spec: { readonly groove: number; readonly thicknessMM: number; readonly outerDiameterMM: number; readonly row?: RingRow }, id: string): { readonly brep: Brep; readonly report: RingReport } {
  const g = shaft.report.grooves.find(x => x.index === spec.groove) ?? fail('INVALID_INPUT', `the shaft has no groove ${spec.groove} (it has ${shaft.report.grooves.length})`);
  const step = shaft.report.steps[g.step - 1], s = pos(spec.thicknessMM, 'the ring\'s thickness'), D = pos(spec.outerDiameterMM, 'the ring\'s outer diameter');
  if (s > g.widthMM + EPS) fail('RING_FIT', `a ring ${mm(s)} thick does not fit groove ${g.index}, ${mm(g.widthMM)} wide`);
  if (!(D > g.diameterMM)) fail('RING_FIT', `the ring's outer Ø${mm(D)} must exceed the groove's Ø${mm(g.diameterMM)}`);
  const row = spec.row;
  if (row) {
    if ((row.source === undefined) === (row.estimate !== true)) fail('INVALID_INPUT', 'a ring row cites its source or says estimate: true (one of them)');
    const near = (a: number | undefined, b: number) => a === undefined || Math.abs(a - b) <= 1e-6;
    if (!near(row.shaftDiameterMM, step.diameterMM)) fail('RING_FIT', `the ring's row is for a Ø${row.shaftDiameterMM} shaft; step ${g.step} is Ø${mm(step.diameterMM)}`);
    if (!near(row.grooveDiameterMM, g.diameterMM)) fail('RING_FIT', `the ring's row wants a Ø${row.grooveDiameterMM} groove; groove ${g.index} is Ø${mm(g.diameterMM)}`);
    if (!near(row.grooveWidthMM, g.widthMM)) fail('RING_FIT', `the ring's row wants a groove ${row.grooveWidthMM} mm wide; groove ${g.index} is ${mm(g.widthMM)}`);
  }
  const z0 = g.fromMM + (g.widthMM - s) / 2;
  const local = prism(`${id}__r`, { profile: 'circle', center: [0, 0], radius: D / 2, holes: [[{ kind: 'arc', start: [g.diameterMM / 2, 0], center: [0, 0], direction: 'ccw' }, { kind: 'arc', start: [-g.diameterMM / 2, 0], center: [0, 0], direction: 'ccw' }]], plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, s);
  return { brep: transformBrep(own(local, `${id}__r`, id), shaft.place), report: { groove: g.index, thicknessMM: s, innerDiameterMM: g.diameterMM, outerDiameterMM: D, axialPlayMM: g.widthMM - s, estimate: !row || row.estimate === true, ...(row?.source ? { source: row.source } : {}) } };
}

/** A pin in cross hole `spec.hole` of a placed shaft. */
export function pinSolid(shaft: PlacedShaft, spec: { readonly hole: number; readonly diameterMM?: number; readonly lengthMM?: number; readonly fit?: boolean }, id: string): { readonly brep: Brep; readonly report: PinReport } {
  const h = shaft.report.holes.find(x => x.index === spec.hole) ?? fail('INVALID_INPUT', `the shaft has no cross hole ${spec.hole} (it has ${shaft.report.holes.length})`);
  const step = shaft.report.steps.find(s => h.atMM >= s.fromMM - EPS && h.atMM <= s.toMM + EPS)!, d = spec.diameterMM === undefined ? h.diameterMM : pos(spec.diameterMM, 'the pin\'s diameter'), L = spec.lengthMM === undefined ? step.diameterMM : pos(spec.lengthMM, 'the pin\'s length');
  if (d > h.diameterMM + EPS && !spec.fit) fail('PIN_FIT', `a Ø${mm(d)} pin in a Ø${mm(h.diameterMM)} hole: declare their fit (classes on the hole and the pin, from your fit tables) for an interference`);
  // (Along +X in the shaft's frame, turned to the hole's angle: centred on the axis.)
  const local = prism(`${id}__p`, { profile: 'circle', center: [0, 0], radius: d / 2, plane: { origin: [-L / 2, 0, h.atMM], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, L);
  return { brep: transformBrep(transformBrep(own(local, `${id}__p`, id), { matrix: turnZ(h.angleDeg) }), shaft.place), report: { hole: h.index, diameterMM: d, lengthMM: L, holeDiameterMM: h.diameterMM, clearanceMM: h.diameterMM - d } };
}
