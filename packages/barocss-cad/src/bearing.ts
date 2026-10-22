// R12c.4 (D158): rolling bearings as envelopes from the user's catalogue rows, and their seats on a shaft and in a housing.
//
// No bearing is built in (the owner's data rule): a row is the user's — { id, designation?, boreMM d, outsideMM D,
// widthMM B, chamferMM r (the corners), and the abutment values daMinMM, daMaxMM, DaMaxMM, raMaxMM when the catalogue
// gives them; boreDeviationUM / outsideDeviationUM [upper, lower] (the rings' tolerances, µm); source | estimate }.
// - The envelope is the section d…D × B with its four corners rounded r, revolved exactly: faces `<id>.bore`,
//   `.outside`, `.face0`, `.face1`, `.corner1`…`.corner4`. It is a simplified envelope: not for structural calculation
//   (no rolling elements, no load ratings or life).
// - On a shaft: its bore on step k's cylinder (of the bearing's bore diameter: SEAT_FIT otherwise), its face against the
//   shoulder at the step's start or end. Checks (SEAT_ABUTMENT): the shoulder's diameter within da min … da max, its
//   fillet within ra max (and within the bearing's own corner r), the seat at least B long; the other side located by a
//   ring groove whose near wall lies within 1 mm of the bearing's face, or a shoulder there — else a warning. The shaft less
//   the bearing keeps its volume (the analytic Boolean): no overlap.
// - In a housing (optional): a bore of the bearing's outside diameter on the bearing's axis (SEAT_FIT otherwise), covering
//   its width; the housing less the bearing keeps its volume.
// - Fits (R12c.2): the shaft's class at d and the housing's at D from the user's fit tables (a class they lack is
//   SEAT_FIT), against the rings' deviations from the row when it gives them: the clearance (bore − shaft, housing − OD).
import type { Brep } from './brep-core.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { brepMassProperties } from './solid-mass.js';
import { transformBrep, type BrepAffine } from './brep-transform.js';
import { evaluateCadPart } from './part-model.js';
import { lookupFit, FitError, type FitLimit, type FitTable } from './fits.js';
import type { PlacedShaft } from './shaft-parts.js';
import type { Point } from './types.js';

export type BearingCode = 'INVALID_INPUT' | 'SEAT_ABUTMENT' | 'SEAT_FIT';
export class BearingError extends Error {
  constructor(readonly code: BearingCode, detail: string) { super(`bearing: ${detail}`); this.name = 'BearingError'; }
}
const fail = (code: BearingCode, detail: string): never => { throw new BearingError(code, detail); };
const EPS = 1e-6;
const mm = (x: number) => +x.toFixed(6);

export interface BearingRow {
  readonly id: string; readonly designation?: string;
  readonly boreMM: number; readonly outsideMM: number; readonly widthMM: number; readonly chamferMM?: number;
  readonly daMinMM?: number; readonly daMaxMM?: number; readonly DaMaxMM?: number; readonly raMaxMM?: number;
  readonly boreDeviationUM?: readonly [number, number]; readonly outsideDeviationUM?: readonly [number, number];
  readonly source?: string; readonly estimate?: boolean;
}
export interface BearingFitClasses { readonly tables: readonly FitTable[]; readonly shaft?: string; readonly housing?: string }
export interface BearingRingFit { readonly limit: FitLimit; readonly clearanceMinUM?: number; readonly clearanceMaxUM?: number; readonly kind?: 'clearance' | 'transition' | 'interference' }
export interface BearingReport {
  readonly row: string; readonly designation?: string; readonly boreMM: number; readonly outsideMM: number; readonly widthMM: number; readonly chamferMM: number;
  readonly estimate: boolean; readonly source?: string;
  /** On its shaft: the step, the side against a shoulder, the bearing's span, the shoulder's diameter and fillet, the other side's location. */
  readonly seat?: { readonly step: number; readonly against: 'start' | 'end'; readonly fromMM: number; readonly toMM: number; readonly shoulderMM: number; readonly shoulderFilletMM: number; readonly located: string | null; readonly overlapMM3: number };
  readonly housing?: { readonly boreMM: number; readonly overlapMM3: number; readonly covered: boolean };
  readonly shaftFit?: BearingRingFit; readonly housingFit?: BearingRingFit;
  readonly warnings: readonly string[];
  readonly notForStructuralCalculation: true;
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
/** Why a bearing row is not one, or null. */
export function bearingRowProblem(r: unknown): string | null {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return 'a bearing row is an object { id, boreMM, outsideMM, widthMM, chamferMM?, … , source | estimate }';
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `bearing row ${o.id}` : '';
  if (!at) return 'a bearing row needs an id';
  for (const k of Object.keys(o)) if (!['id', 'designation', 'boreMM', 'outsideMM', 'widthMM', 'chamferMM', 'daMinMM', 'daMaxMM', 'DaMaxMM', 'raMaxMM', 'boreDeviationUM', 'outsideDeviationUM', 'source', 'estimate'].includes(k)) return `${at}: unknown field ${k}`;
  for (const k of ['boreMM', 'outsideMM', 'widthMM']) if (!(num(o[k]) && (o[k] as number) > 0)) return `${at}: ${k} must be a number of mm above 0`;
  for (const k of ['chamferMM', 'daMinMM', 'daMaxMM', 'DaMaxMM', 'raMaxMM']) if (o[k] !== undefined && !(num(o[k]) && (o[k] as number) >= 0)) return `${at}: ${k} must be a number of mm, 0 or more`;
  const d = o.boreMM as number, D = o.outsideMM as number, B = o.widthMM as number, c = (o.chamferMM as number | undefined) ?? 0;
  if (!(D > d)) return `${at}: its outside Ø${D} must exceed its bore Ø${d}`;
  if (!(2 * c < Math.min(B, (D - d) / 2))) return `${at}: its corner r ${c} is too large for a ${B} × ${(D - d) / 2} section`;
  if (o.daMinMM !== undefined && o.daMaxMM !== undefined && (o.daMinMM as number) > (o.daMaxMM as number)) return `${at}: da min is above da max`;
  for (const k of ['boreDeviationUM', 'outsideDeviationUM']) { const v = o[k]; if (v !== undefined && !(Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) && v[0] >= v[1])) return `${at}: ${k} must be [upper, lower] µm, upper ≥ lower`; }
  if ((o.source !== undefined) === (o.estimate === true)) return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source must be text`;
  return null;
}

/** The envelope in its own frame: axis +Z, from z 0 to B, faces named under `id`. */
export function bearingEnvelope(row: BearingRow, id: string): Brep {
  const p = bearingRowProblem(row); if (p) fail('INVALID_INPUT', p);
  const ri = row.boreMM / 2, ro = row.outsideMM / 2, B = row.widthMM, c = row.chamferMM ?? 0, segs: unknown[] = [], tags: string[] = [];
  const line = (x: number, y: number, t: string) => { segs.push({ kind: 'line', start: [x, y] }); tags.push(t); };
  const arc = (x: number, y: number, cx: number, cy: number, t: string) => { segs.push({ kind: 'arc', start: [x, y], center: [cx, cy], direction: 'ccw' }); tags.push(t); };
  line(ri + c, 0, 'face0');
  if (c) arc(ro - c, 0, ro - c, c, 'corner1');
  line(ro, c, 'outside');
  if (c) arc(ro, B - c, ro - c, B - c, 'corner2');
  line(ro - c, B, 'face1');
  if (c) arc(ri + c, B, ri + c, B - c, 'corner3');
  line(ri, B - c, 'bore');
  if (c) arc(ri, c, ri + c, c, 'corner4');
  const sub = `${id}__e`, doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, sideTags: { outer: tags } },
    { id: sub, kind: 'revolve', sketch: `${sub}s`, axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }] };
  const prefix = `${sub}.side[`;
  return transformBrep(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    nm => nm.split('|').map(q => q.startsWith(prefix) ? `${id}.${q.slice(prefix.length, q.indexOf(']'))}${q.slice(q.indexOf(']') + 1)}` : q).join('|'));
}

const vol = (b: Brep) => brepMassProperties(b, 1, { quadratureSegments: 12 }).volumeMM3;
/** What the Boolean takes of `body` where `tool` stands (V(body) − V(body − tool)). */
function overlapOf(body: Brep, tool: Brep): number {
  const v0 = vol(body);
  let left: Brep;
  try { left = booleanAnalytic(body, tool, 'difference'); } catch (cause) { if (cause instanceof Error && /empty|no solid|nothing/i.test(cause.message)) return v0; throw cause; }
  return Math.max(0, v0 - (left.bodies.length ? vol(left) : 0));
}
const apply = (m: BrepAffine, p: Point): Point => { const a = m.matrix, t = m.offset ?? [0, 0, 0]; return [a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + t[0], a[3] * p[0] + a[4] * p[1] + a[5] * p[2] + t[1], a[6] * p[0] + a[7] * p[1] + a[8] * p[2] + t[2]]; };
const dirOf = (m: BrepAffine, v: Point): Point => { const a = m.matrix; return [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]]; };
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A ring's fit: the seat's class at its size against the ring's deviation (µm), as clearance = hole − shaft. */
function ringFit(tables: readonly FitTable[], cls: string, size: number, ring: readonly [number, number] | undefined, seatIsShaft: boolean): BearingRingFit {
  let limit: FitLimit;
  try { limit = lookupFit(tables, cls, size); } catch (cause) { if (cause instanceof FitError) fail('SEAT_FIT', cause.message.replace(/^\[[A-Z_]+\] /, '')); throw cause; }
  if (!ring) return { limit };
  // (Hole − shaft: on the shaft the bearing's bore is the hole; in the housing the housing's bore is.)
  const [hiH, loH, hiS, loS] = seatIsShaft ? [ring[0], ring[1], limit!.upperUM, limit!.lowerUM] : [limit!.upperUM, limit!.lowerUM, ring[0], ring[1]];
  const min = loH - hiS, max = hiH - loS;
  return { limit: limit!, clearanceMinUM: min, clearanceMaxUM: max, kind: min >= 0 ? 'clearance' : max <= 0 ? 'interference' : 'transition' };
}

/** A bearing from `row`, on step `step` of a placed shaft against the shoulder at its `against` end; optionally in a housing. */
export function seatedBearing(row: BearingRow, shaft: PlacedShaft & { readonly brep: Brep }, spec: { readonly step: number; readonly against: 'start' | 'end'; readonly housing?: Brep; readonly fit?: BearingFitClasses }, id: string): { readonly brep: Brep; readonly report: BearingReport } {
  const env = bearingEnvelope(row, id), d = row.boreMM, D = row.outsideMM, B = row.widthMM, c = row.chamferMM ?? 0, warnings: string[] = [];
  const s = shaft.report.steps[spec.step - 1] ?? fail('INVALID_INPUT', `the shaft has no step ${spec.step} (it has ${shaft.report.steps.length})`);
  if (Math.abs(s.diameterMM - d) > EPS) fail('SEAT_FIT', `step ${spec.step} is Ø${mm(s.diameterMM)}; bearing ${row.id}'s bore is Ø${mm(d)}: the seat is modelled at the bore's size (its class carries the limits)`);
  if (spec.against !== 'start' && spec.against !== 'end') fail('INVALID_INPUT', 'against is start or end');
  if (B > s.toMM - s.fromMM + EPS) fail('SEAT_ABUTMENT', `step ${spec.step}'s seat is ${mm(s.toMM - s.fromMM)} long, shorter than the bearing's ${mm(B)}`);
  const sh = spec.against === 'start' ? shaft.report.shoulders.find(x => x.index === spec.step - 1) : shaft.report.shoulders.find(x => x.index === spec.step);
  if (!sh) fail('SEAT_ABUTMENT', `step ${spec.step} has no shoulder at its ${spec.against}: the bearing has nothing to stand against`);
  const shoulderD = spec.against === 'start' ? sh!.beforeMM : sh!.afterMM;
  if (!(shoulderD > d)) fail('SEAT_ABUTMENT', `the shoulder at step ${spec.step}'s ${spec.against} steps down (Ø${mm(shoulderD)}): it does not hold the bearing`);
  if (row.daMinMM !== undefined && shoulderD < row.daMinMM - EPS) fail('SEAT_ABUTMENT', `the shoulder Ø${mm(shoulderD)} is below da min ${row.daMinMM} (bearing ${row.id}): the inner ring would not bear on it`);
  if (row.daMaxMM !== undefined && shoulderD > row.daMaxMM + EPS) fail('SEAT_ABUTMENT', `the shoulder Ø${mm(shoulderD)} is above da max ${row.daMaxMM} (bearing ${row.id}): it would reach the seals or the cage`);
  const fil = sh!.filletMM, raMax = row.raMaxMM ?? c;
  if (fil > raMax + EPS) fail('SEAT_ABUTMENT', `the shoulder's fillet r ${mm(fil)} exceeds ${row.raMaxMM !== undefined ? 'ra max' : 'the bearing\'s corner r'} ${mm(raMax)}: the bearing would stand on it`);
  const from = spec.against === 'start' ? s.fromMM : s.toMM - B, to = from + B, far = spec.against === 'start' ? to : from;
  // The other side: a ring groove's near wall within 1 mm of the face, or a shoulder there.
  const groove = shaft.report.grooves.find(g => g.step === spec.step && (spec.against === 'start' ? g.fromMM >= far - EPS && g.fromMM <= far + 1 + EPS : g.fromMM + g.widthMM <= far + EPS && g.fromMM + g.widthMM >= far - 1 - EPS));
  const otherShoulder = Math.abs(far - (spec.against === 'start' ? s.toMM : s.fromMM)) < EPS;
  const located = groove ? `ring groove ${groove.index}` : otherShoulder ? 'a shoulder' : null;
  if (!located) warnings.push(`the bearing's ${spec.against === 'start' ? 'end' : 'start'} side is not located: no ring groove within 1 mm of its face and no shoulder (a spacer is not modelled)`);
  const local = transformBrep(env, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 0, from] }), brep = transformBrep(local, shaft.place);
  const shaftOverlap = overlapOf(shaft.brep, brep);
  if (shaftOverlap > 1e-6 * vol(brep)) fail('SEAT_ABUTMENT', `the bearing overlaps the shaft by ${+shaftOverlap.toPrecision(4)} mm³`);
  let housing: BearingReport['housing'];
  if (spec.housing) {
    const axisW = dirOf(shaft.place, [0, 0, 1]), originW = apply(shaft.place, [0, 0, 0]);
    const bore = spec.housing.faces.map(f => ({ f, g: faceGeometry(f) })).find(({ g }) => {
      if (g.kind !== 'cylinder' || g.out !== -1 || Math.abs(2 * g.r - D) > EPS || Math.abs(Math.abs(dot(g.a as Point, axisW)) - 1) > 1e-9) return false;
      const off: Point = [g.c[0] - originW[0], g.c[1] - originW[1], g.c[2] - originW[2]], al = dot(off, axisW);
      return Math.hypot(off[0] - axisW[0] * al, off[1] - axisW[1] * al, off[2] - axisW[2] * al) < EPS;
    });
    if (!bore) fail('SEAT_FIT', `the housing has no Ø${mm(D)} bore on the bearing's axis`);
    const loops = new Set(bore!.f.loops), edges = new Map(spec.housing.edges.map(e => [e.id, e])), verts = new Map(spec.housing.vertices.map(v => [v.id, v.point]));
    let lo = Infinity, hi = -Infinity;
    for (const ce of spec.housing.coedges) if (loops.has(ce.loop)) for (const v of edges.get(ce.edge)!.vertices) { const p = verts.get(v)!, t = dot([p[0] - originW[0], p[1] - originW[1], p[2] - originW[2]], axisW); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    const covered = lo <= from + EPS && hi >= to - EPS;
    if (!covered) warnings.push(`the housing's bore (${mm(lo)} to ${mm(hi)} along the axis) does not cover the bearing (${mm(from)} to ${mm(to)})`);
    const hOverlap = overlapOf(spec.housing, brep);
    if (hOverlap > 1e-6 * vol(brep)) fail('SEAT_ABUTMENT', `the bearing overlaps the housing by ${+hOverlap.toPrecision(4)} mm³`);
    housing = { boreMM: D, overlapMM3: hOverlap, covered };
  }
  const shaftFit = spec.fit?.shaft ? ringFit(spec.fit.tables, spec.fit.shaft, d, row.boreDeviationUM, true) : undefined;
  const housingFit = spec.fit?.housing && spec.housing ? ringFit(spec.fit.tables, spec.fit.housing, D, row.outsideDeviationUM, false) : undefined;
  if (spec.fit?.housing && !spec.housing) warnings.push('a housing class is given but no housing');
  return { brep, report: { row: row.id, ...(row.designation ? { designation: row.designation } : {}), boreMM: d, outsideMM: D, widthMM: B, chamferMM: c, estimate: row.estimate === true, ...(row.source ? { source: row.source } : {}),
    seat: { step: spec.step, against: spec.against, fromMM: from, toMM: to, shoulderMM: shoulderD, shoulderFilletMM: fil, located, overlapMM3: shaftOverlap },
    ...(housing ? { housing } : {}), ...(shaftFit ? { shaftFit } : {}), ...(housingFit ? { housingFit } : {}), warnings, notForStructuralCalculation: true } };
}
