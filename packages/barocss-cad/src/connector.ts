// R12c.7 (D162): connector envelopes from the user's rows (none built in), each citing its source or flagged an
// estimate — the opening a panel needs, the mating body's envelope, and the keep-out in front of the opening its plug
// and cable need. A composition of existing features: the opening's section (a stadium, a rounded rectangle or a
// circle) extruded and cut from the panel by the analytic Boolean; the body's section extruded along the opening's
// axis, seated at the opening's bottom. Its fit is a declared fit checked by exact Boolean overlap (as LIB2's): the
// body must touch nothing of the panel (`CONNECTOR_FIT`); its gaps across and how far it stands out are reported.
// The keep-out is a box in A6.3's form (a frame and a size) for the part's keep-out check.
//
// The opening's frame on a flat face: z the face's outward normal, x its width — the face's own x, world X projected
// on the face (world Y when the face is square to X), turned `rotation` degrees about z — and y = z × x.
import type { Brep } from './brep-core.js';
import type { Point } from './types.js';
import { booleanAnalytic, faceGeometry } from './analytic-boolean.js';
import { brepMassProperties } from './solid-mass.js';
import { transformBrep, type BrepAffine } from './brep-transform.js';
import { evaluateCadPart } from './part-model.js';
import { cross } from './vec3.js';

export type ConnectorCode = 'INVALID_INPUT' | 'CONNECTOR_PLACEMENT' | 'CONNECTOR_FIT';
export class ConnectorError extends Error {
  constructor(readonly code: ConnectorCode, detail: string) { super(`connector: ${detail}`); this.name = 'ConnectorError'; }
}
const fail = (code: ConnectorCode, detail: string): never => { throw new ConnectorError(code, detail); };
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const r6 = (x: number) => +x.toFixed(6);

export interface ConnectorSection { readonly shape: 'stadium' | 'rect' | 'round'; readonly widthMM: number; readonly heightMM: number; readonly cornerRadiusMM?: number }
export interface ConnectorRow {
  readonly id: string; readonly name?: string;
  /** The opening: its section and how deep it is cut into the face. */
  readonly opening: ConnectorSection & { readonly depthMM: number };
  /** The mating body (a plug's envelope): its section and its length from the opening's bottom. */
  readonly body?: ConnectorSection & { readonly lengthMM: number };
  /** The space in front of the opening the plug and its cable need: grown by a margin round the body (or the opening), this deep. */
  readonly keepOut?: { readonly marginMM: number; readonly depthMM: number };
  readonly source?: string; readonly estimate?: boolean;
}
function sectionProblem(s: unknown, at: string, extra: string): string | null {
  if (typeof s !== 'object' || s === null) return `${at} must be { shape: stadium | rect | round, widthMM, heightMM, cornerRadiusMM?, ${extra} }`;
  const o = s as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['shape', 'widthMM', 'heightMM', 'cornerRadiusMM', extra].includes(k)) return `${at}: unknown field ${k}`;
  if (!['stadium', 'rect', 'round'].includes(o.shape as string)) return `${at}: shape must be stadium, rect or round`;
  for (const k of ['widthMM', 'heightMM', extra]) if (!(num(o[k]) && (o[k] as number) > 0)) return `${at}: ${k} must be a number of mm above 0`;
  const w = o.widthMM as number, h = o.heightMM as number;
  if (o.shape === 'stadium' && !(w >= h)) return `${at}: a stadium's width ${w} is at least its height ${h} (its ends are half circles)`;
  if (o.shape === 'round' && w !== h) return `${at}: a round section's width and height are its diameter (${w} ≠ ${h})`;
  if (o.cornerRadiusMM !== undefined && (o.shape !== 'rect' || !(num(o.cornerRadiusMM) && (o.cornerRadiusMM as number) >= 0 && (o.cornerRadiusMM as number) < Math.min(w, h) / 2))) return `${at}: cornerRadiusMM belongs to a rect, 0 to under half its smaller side`;
  return null;
}
/** Why a connector row is not one, or null. */
export function connectorRowProblem(r: unknown): string | null {
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return 'a connector row is an object { id, opening, body?, keepOut?, source | estimate }';
  const o = r as Record<string, unknown>, at = typeof o.id === 'string' && o.id.trim() ? `connector row ${o.id}` : '';
  if (!at) return 'a connector row needs an id';
  for (const k of Object.keys(o)) if (!['id', 'name', 'opening', 'body', 'keepOut', 'source', 'estimate'].includes(k)) return `${at}: unknown field ${k}`;
  const p = sectionProblem(o.opening, `${at}: opening`, 'depthMM') ?? (o.body === undefined ? null : sectionProblem(o.body, `${at}: body`, 'lengthMM'));
  if (p) return p;
  const op = o.opening as ConnectorSection, b = o.body as ConnectorSection | undefined;
  if (b && !(b.widthMM <= op.widthMM && b.heightMM <= op.heightMM)) return `${at}: the body ${b.widthMM} × ${b.heightMM} is larger than its opening ${op.widthMM} × ${op.heightMM}`;
  const k = o.keepOut as Record<string, unknown> | undefined;
  if (k !== undefined && !(typeof k === 'object' && k !== null && num(k.marginMM) && (k.marginMM as number) >= 0 && num(k.depthMM) && (k.depthMM as number) > 0 && Object.keys(k).every(x => x === 'marginMM' || x === 'depthMM'))) return `${at}: keepOut must be { marginMM (0 or more), depthMM (above 0) }`;
  if ((o.source !== undefined) === (o.estimate === true)) return `${at}: cite its source or say estimate: true — ${o.source !== undefined ? 'not both' : 'never neither'}`;
  if (o.source !== undefined && typeof o.source !== 'string') return `${at}: source must be text`;
  return null;
}
/** A section's area in closed form: a stadium (w − h)h + πh²/4, a rounded rectangle wh − (4 − π)r², a circle πw²/4. */
export function connectorSectionArea(s: ConnectorSection): number {
  const w = s.widthMM, h = s.heightMM, r = s.cornerRadiusMM ?? 0;
  return s.shape === 'stadium' ? (w - h) * h + Math.PI * h * h / 4 : s.shape === 'round' ? Math.PI * w * w / 4 : w * h - (4 - Math.PI) * r * r;
}
/** The section as a closed sketch loop about the origin, x along its width (counter-clockwise). */
function loop(s: ConnectorSection): unknown[] {
  const w = s.widthMM / 2, h = s.heightMM / 2, arc = (x: number, y: number, cx: number, cy: number) => ({ kind: 'arc', start: [x, y], center: [cx, cy], direction: 'ccw' }), line = (x: number, y: number) => ({ kind: 'line', start: [x, y] });
  if (s.shape === 'round') return [arc(w, 0, 0, 0), arc(-w, 0, 0, 0)];
  if (s.shape === 'stadium') { const a = w - h; return a > 0 ? [line(-a, -h), arc(a, -h, a, 0), line(a, h), arc(-a, h, -a, 0)] : [arc(w, 0, 0, 0), arc(-w, 0, 0, 0)]; }
  const r = s.cornerRadiusMM ?? 0;
  if (!r) return [line(-w, -h), line(w, -h), line(w, h), line(-w, h)];
  return [line(-w + r, -h), arc(w - r, -h, w - r, -h + r), line(w, h - r), arc(w - r, h, w - r, h - r), line(-w + r, h), arc(-w, h - r, -w + r, h - r), line(-w, -h + r), arc(-w + r, -h, -w + r, -h + r)];
}
/** A section extruded `height` along +Z from `z0`, its faces named under `id`. */
function prism(id: string, s: ConnectorSection, z0: number, height: number, tag: string): Brep {
  const segs = loop(s), sub = `${id}__${tag}`, doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: `${sub}s`, kind: 'sketch', profile: 'loop', segments: segs, plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, sideTags: { outer: segs.map((_, i) => `${tag}${i + 1}`) } },
    { id: sub, kind: 'extrude', sketch: `${sub}s`, height }] };
  const prefix = `${sub}.side[`;
  return transformBrep(evaluateCadPart(doc as unknown as Parameters<typeof evaluateCadPart>[0]).output(sub).brep, { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    nm => nm.split('|').map(q => q.startsWith(prefix) ? `${id}.${q.slice(prefix.length, q.indexOf(']'))}${q.slice(q.indexOf(']') + 1)}` : q.startsWith(`${sub}.`) ? `${id}.${tag}.${q.slice(sub.length + 1)}` : q).join('|'));
}
const vol = (b: Brep) => brepMassProperties(b, 1, { quadratureSegments: 12 }).volumeMM3;
const unit = (v: readonly number[]): Point => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
/** The opening's frame on a face of outward normal n at `origin`: x the face's width direction turned `rotationDeg` about n. */
export function connectorFrame(origin: readonly number[], normal: readonly number[], rotationDeg = 0): { readonly origin: Point; readonly x: Point; readonly y: Point; readonly z: Point } {
  const z = unit(normal), ref: Point = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = ref[0] * z[0] + ref[1] * z[1] + ref[2] * z[2];
  const x0 = unit([ref[0] - d * z[0], ref[1] - d * z[1], ref[2] - d * z[2]]), y0 = cross(z, x0), c = Math.cos(rotationDeg * Math.PI / 180), s = Math.sin(rotationDeg * Math.PI / 180);
  const x: Point = [c * x0[0] + s * y0[0], c * x0[1] + s * y0[1], c * x0[2] + s * y0[2]];
  return { origin: [origin[0], origin[1], origin[2]], x, y: cross(z, x), z };
}
const affine = (f: ReturnType<typeof connectorFrame>): BrepAffine => ({ matrix: [f.x[0], f.y[0], f.z[0], f.x[1], f.y[1], f.z[1], f.x[2], f.y[2], f.z[2]], offset: f.origin });

/**
 * The keep-out in front of an opening (A6.3's form: a box from its frame's origin along x, normal × x and normal): the
 * body's section (or the opening's) grown by the row's margin, the row's depth out from the seated body's front (or the
 * face, with no body); none without a keepOut.
 */
export function connectorKeepOut(row: ConnectorRow, center: readonly number[], normal: readonly number[], rotationDeg = 0): ConnectorReport['keepOut'] {
  const ko = row.keepOut;
  if (!ko) return undefined;
  // (From the seated body's front — the plug itself fills the space up to there — or from the face without a body: the
  // panel and the plug then only touch it, and neither enters it.)
  const f = connectorFrame(center, normal, rotationDeg), around = row.body ?? row.opening, W = around.widthMM + 2 * ko.marginMM, H = around.heightMM + 2 * ko.marginMM;
  const out = row.body ? Math.max(0, row.body.lengthMM - row.opening.depthMM) : 0;
  const o: Point = [0, 1, 2].map(k => center[k] - W / 2 * f.x[k] - H / 2 * f.y[k] + out * f.z[k]) as Point;
  return { frame: { origin: o, normal: f.z, xAxis: f.x }, size: [W, H, ko.depthMM], clearance: 0 };
}
export interface ConnectorReport {
  readonly generator: 'connector@0'; readonly row: string; readonly name?: string; readonly estimate: boolean; readonly source?: string;
  readonly opening: ConnectorSection & { readonly depthMM: number; readonly areaMM2: number };
  readonly frame: { readonly origin: Point; readonly x: Point; readonly y: Point; readonly z: Point };
  /** The body seated in the opening: its gaps across (each side), how far it stands out of the face, its overlap with the panel. */
  readonly body?: ConnectorSection & { readonly lengthMM: number; readonly areaMM2: number; readonly gapWidthMM: number; readonly gapHeightMM: number; readonly standsOutMM: number; readonly overlapMM3?: number };
  /** In A6.3's form: a box from its frame's origin along x, normal × x and normal. */
  readonly keepOut?: { readonly frame: { readonly origin: Point; readonly normal: Point; readonly xAxis: Point }; readonly size: readonly [number, number, number]; readonly clearance: 0 };
  readonly envelopeOnly: true;
}
export interface ConnectorSpec { readonly row: ConnectorRow; readonly face: string; readonly centerMM: readonly number[]; readonly rotationDeg?: number }
/** The opening cut into `target` at its flat face, centred at `centerMM`, and the report (with the keep-out). */
export function connectorOpening(target: Brep, spec: ConnectorSpec, id: string): { readonly brep: Brep; readonly report: ConnectorReport } {
  const p = connectorRowProblem(spec.row); if (p) fail('INVALID_INPUT', p);
  const row = spec.row, face = target.faces.find(f => f.name === spec.face) ?? target.faces.find(f => f.name?.replace(/#\d+$/, '') === spec.face) ?? fail('INVALID_INPUT', `no face ${spec.face}`);
  const g = faceGeometry(face);
  if (g.kind !== 'plane') fail('CONNECTOR_PLACEMENT', `${spec.face} is not flat: an opening is cut into a flat face`);
  const pl = g as Extract<typeof g, { kind: 'plane' }>, c = spec.centerMM;
  if (!(Array.isArray(c) && c.length === 3 && c.every(num))) fail('INVALID_INPUT', 'centerMM must be a point [x, y, z] on the face');
  const off = (c[0] - pl.o[0]) * pl.n[0] + (c[1] - pl.o[1]) * pl.n[1] + (c[2] - pl.o[2]) * pl.n[2];
  if (Math.abs(off) > 1e-6) fail('CONNECTOR_PLACEMENT', `the opening's centre is ${r6(off)} mm off the face's plane`);
  const f = connectorFrame(c, pl.n, spec.rotationDeg ?? 0), op = row.opening;
  // (The cutter from the face down its depth, and a hair proud of it so the cut is clean at the face.)
  const cutter = transformBrep(prism(id, op, -op.depthMM, op.depthMM + 1, 'opening'), affine(f));
  const before = vol(target), brep = booleanAnalytic(target, cutter, 'difference'), removed = before - vol(brep), want = connectorSectionArea(op) * op.depthMM;
  if (Math.abs(removed - want) > 1e-6 * Math.max(1, want)) fail('CONNECTOR_PLACEMENT', `the opening runs off the face (it took ${r6(removed)} mm³ of the ${r6(want)} its full section and depth would): move it onto the face, or the panel is thinner than its depth`);
  const b = row.body;
  const body = b ? { ...b, areaMM2: connectorSectionArea(b), gapWidthMM: (op.widthMM - b.widthMM) / 2, gapHeightMM: (op.heightMM - b.heightMM) / 2, standsOutMM: b.lengthMM - op.depthMM } : undefined;
  const keepOut = connectorKeepOut(row, c, pl.n, spec.rotationDeg ?? 0);
  return { brep, report: { generator: 'connector@0', row: row.id, ...(row.name ? { name: row.name } : {}), estimate: row.estimate === true, ...(row.source ? { source: row.source } : {}), opening: { ...op, areaMM2: connectorSectionArea(op) }, frame: f, ...(body ? { body } : {}), ...(keepOut ? { keepOut } : {}), envelopeOnly: true } };
}
/** The body's envelope seated in its opening (from the opening's bottom, `lengthMM` out along its axis), and its overlap with the panel (the declared fit). */
export function connectorBody(panel: Brep, report: ConnectorReport, id: string): { readonly brep: Brep; readonly overlapMM3: number } {
  const b = report.body ?? fail('INVALID_INPUT', `the connector row ${report.row} has no body`), f = report.frame;
  const brep = transformBrep(prism(id, b, -report.opening.depthMM, b.lengthMM, 'body'), affine(f));
  let overlap = 0;
  try { const both = booleanAnalytic(panel, brep, 'intersection'); overlap = both.bodies.length ? vol(both) : 0; } catch (cause) { if (!(cause instanceof Error && /empty|no solid|nothing/i.test(cause.message))) throw cause; overlap = 0; }
  if (overlap > 1e-6) fail('CONNECTOR_FIT', `the body overlaps the panel by ${r6(overlap)} mm³: it does not fit its opening (the declared fit is touching at most)`);
  return { brep, overlapMM3: overlap };
}
