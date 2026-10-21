// IM7 S0 (O110): a mould's two halves where the part needs no face split — from IM5's parting line, when no face
// straddles the pull and the parting line lies in one plane across it: a block about the part (a margin a side), the
// part taken out of it, cut at that plane along the pull. The half on the +pull side moves along it (IM5's "+": the
// moving half, B side, usually the core); the other stays (the fixed half, A side, usually the cavity). Inner parting
// loops in the plane are shut-offs: where the halves touch across an opening of the part (the core half's metal fills
// it up to the plane). IM3's undercuts freed across the pull give the side cores' directions (their bodies wait); one
// freed by none is said. Refused by code, and what each waits for said: a face that straddles the pull waits for the
// kernel's face split (D149, splitFaceAlongCurve); a parting line not in one plane (a stepped parting surface) and a
// moving half's faces below the plane (a cup's core reaching into it: an insert) are IM7a's, the next stage.
import type { StudioDoc, Axis } from '../engine/doc';
import { withNode } from '../engine/doc';
import { evaluateDoc, type BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { refOf } from '../app/bodyRef';
import type { PartingReport } from './parting';
import type { UndercutRegion } from './undercut';

export type ToolingCode = 'MOULD_NO_PULL' | 'MOULD_PULL_AXIS' | 'MOULD_ONE_BODY' | 'MOULD_STRADDLE' | 'MOULD_NO_PARTING' | 'MOULD_STEPPED' | 'MOULD_ACROSS_PLANE' | 'MOULD_BUILD';
/** What each waiting code waits for: the kernel's face split (D149), or the next stage (IM7a). */
export const WAITS_FOR: Readonly<Partial<Record<ToolingCode, string>>> = { MOULD_STRADDLE: 'the kernel\'s face split (D149, splitFaceAlongCurve)', MOULD_STEPPED: 'a stepped parting surface (IM7a)', MOULD_ACROSS_PLANE: 'an insert for a core reaching past the parting plane (IM7a)' };
export interface ShutOff { readonly at: number; readonly lengthMM: number; readonly areaMM2: number; readonly centroid: Vec3 }
export interface SideCore { readonly faces: readonly string[]; readonly direction: Vec3; readonly areaMM2: number; readonly centroid: Vec3 }
export interface ToolingPlan {
  readonly pull: Vec3; readonly axis: Axis; readonly sign: 1 | -1;
  /** The parting plane: axis = at. */
  readonly planeAt: number; readonly marginMM: number;
  readonly block: { readonly min: readonly number[]; readonly max: readonly number[] };
  readonly shutOffs: readonly ShutOff[]; readonly sideCores: readonly SideCore[];
  /** Undercuts no side action across the pull frees (the part does not release with these halves). */
  readonly stuck: readonly { readonly faces: readonly string[]; readonly areaMM2: number }[];
  /** What these halves leave out, said. */
  readonly notBuilt: readonly string[];
}
/** A refusal still gives IM3's side-core directions (a side core's own faces often straddle or step the parting line). */
export type ToolingResult = { ok: true; plan: ToolingPlan } | { ok: false; code: ToolingCode; message: string; waitsFor: string | null; sideCores: readonly SideCore[]; stuck: ToolingPlan['stuck'] };
/** The margin a side, mm: an estimate (a mould base's wall is the toolmaker's). */
export const MARGIN_ESTIMATE_MM = 10;

const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const AXES: readonly Axis[] = ['x', 'y', 'z'];
const refusal = (sideCores: readonly SideCore[], stuck: ToolingPlan['stuck']) => (code: ToolingCode, message: string): ToolingResult => ({ ok: false, code, message, waitsFor: WAITS_FOR[code] ?? null, sideCores, stuck });

/** The halves' plan, from IM5's parting line and IM3's undercuts at the pull. */
export function toolingPlan(bodies: readonly BodyResult[], pull: readonly number[] | null, parting: PartingReport | null, regions: readonly UndercutRegion[], marginMM = MARGIN_ESTIMATE_MM): ToolingResult {
  const sideCores: SideCore[] = regions.filter(r => r.sideAction).map(r => ({ faces: r.faces, direction: r.sideAction!, areaMM2: r6(r.areaMM2), centroid: r.centroid.map(r6) as Vec3 }));
  const stuck = regions.filter(r => !r.sideAction).map(r => ({ faces: r.faces, areaMM2: r6(r.areaMM2) })), refuse = refusal(sideCores, stuck);
  if (!pull || !parting) return refuse('MOULD_NO_PULL', 'no pull direction: the halves part along it');
  const k = pull.findIndex(v => Math.abs(Math.abs(v) - 1) <= 1e-9);
  if (k < 0 || pull.some((v, i) => i !== k && Math.abs(v) > 1e-9)) return refuse('MOULD_PULL_AXIS', 'the halves here are cut across an axis: a pull along ±X, ±Y or ±Z');
  if (bodies.length !== 1) return refuse('MOULD_ONE_BODY', `a mould of one body; the part has ${bodies.length}`);
  if (parting.split.length) return refuse('MOULD_STRADDLE', `${parting.split.length} face${parting.split.length === 1 ? '' : 's'} straddle the pull (${parting.split.map(s => s.face).join(', ')}): each must be split along its isocline, which waits for ${WAITS_FOR.MOULD_STRADDLE} — or put the whole face in one half (sides)`);
  if (!parting.loops.length) return refuse('MOULD_NO_PARTING', 'no parting line: every face in one half');
  const s = pull[k] > 0 ? 1 : -1 as 1 | -1;
  // (The outer loop: the longest. Every loop flat and at one height along the pull: one parting plane.)
  const outer = [...parting.loops].sort((a, b) => b.lengthMM - a.lengthMM)[0];
  if (parting.loops.some(l => !l.flat)) return refuse('MOULD_STEPPED', `a parting loop not across the pull in one plane (stepped ${parting.loops.filter(l => !l.flat).map(l => `${r6(l.rangeMM[0])} … ${r6(l.rangeMM[1])}`).join('; ')}): it waits for ${WAITS_FOR.MOULD_STEPPED}`);
  const level = outer.rangeMM[0], tol = 1e-4 * (1 + Math.abs(level));
  if (parting.loops.some(l => Math.abs(l.rangeMM[0] - level) > tol)) return refuse('MOULD_STEPPED', `parting loops at more than one height along the pull (${parting.loops.map(l => r6(l.rangeMM[0])).join(', ')}): the halves meet on more than one plane; it waits for ${WAITS_FOR.MOULD_STEPPED}`);
  // (Every face on its half's side of the plane — the halves cut by it hold their own faces.)
  const across = facesAcross(bodies[0], parting, pull, level, tol);
  if (across.length) return refuse('MOULD_ACROSS_PLANE', `face${across.length === 1 ? '' : 's'} of a half on the other side of the parting plane (${across.slice(0, 8).join(', ')}: a core reaching into a cup, say): a plane cut would give them to the wrong half; it waits for ${WAITS_FOR.MOULD_ACROSS_PLANE}`);
  // (The loops' rangeMM is along the pull: the plane's coordinate on the axis.)
  const planeAt = s * level;
  const b = bodies[0].mesh.bounds, min = [0, 1, 2].map(i => r6(b.min[i] - marginMM)), max = [0, 1, 2].map(i => r6(b.max[i] + marginMM));
  const shutOffs: ShutOff[] = parting.loops.filter(l => l !== outer && l.closed).map(l => ({ at: r6(planeAt), lengthMM: r6(l.lengthMM), areaMM2: r6(loopArea(l.points, k)), centroid: loopCentroid(l.points, k, planeAt) }));
  const notBuilt = [...(sideCores.length ? [`${sideCores.length} side core${sideCores.length === 1 ? '' : 's'}: their directions given, their bodies not built`] : []),
    'no gate, runner, cooling, ejectors or mould base: the halves are the impression only'];
  return { ok: true, plan: { pull: pull.map(r6) as Vec3, axis: AXES[k], sign: s, planeAt: r6(planeAt), marginMM, block: { min, max }, shutOffs, sideCores, stuck, notBuilt } };
}

/** The halves as bodies: the block less the part, split at the plane; `plus` moves along the pull. */
export function mouldHalves(doc: StudioDoc, bodies: readonly BodyResult[], plan: ToolingPlan): { ok: true; doc: StudioDoc; plus: BodyResult; minus: BodyResult } | { ok: false; code: 'MOULD_BUILD'; message: string } {
  const part = refOf(bodies[0]), { min, max } = plan.block;
  let d = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [min[0], min[1]], max: [max[0], max[1]], plane: { origin: [0, 0, min[2]], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  d = withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: max[2] - min[2] });
  const block = { node: d.nodes.length - 1, side: 'solid' as const };
  d = withNode(d, { kind: 'difference', parent: block, tool: part });
  d = withNode(d, { kind: 'split', parent: { node: d.nodes.length - 1, side: 'solid' }, axis: plan.axis, at: plan.planeAt });
  const r = evaluateDoc(d, 1);
  if (!r.ok) return { ok: false, code: 'MOULD_BUILD', message: `the halves do not evaluate: ${JSON.stringify(r.error).slice(0, 200)}` };
  const last = d.nodes.length - 1, pos = r.bodies.find(x => x.ref?.node === last && x.ref.side === 'positive'), neg = r.bodies.find(x => x.ref?.node === last && x.ref.side === 'negative');
  if (!pos || !neg) return { ok: false, code: 'MOULD_BUILD', message: `the split made ${r.bodies.length} bodies, not two halves` };
  return { ok: true, doc: d, plus: plan.sign > 0 ? pos : neg, minus: plan.sign > 0 ? neg : pos };
}

/** The faces that reach past the plane on the other half's side (along the pull: + above it, − below it). */
function facesAcross(body: BodyResult, parting: PartingReport, pull: readonly number[], level: number, tol: number): string[] {
  const m = body.mesh, P = m.positions, F = m.faceOfVertex, lo = new Float64Array(m.faces.length).fill(Infinity), hi = new Float64Array(m.faces.length).fill(-Infinity);
  for (let v = 0; v < F.length; v++) { const f = F[v], t = P[3 * v] * pull[0] + P[3 * v + 1] * pull[1] + P[3 * v + 2] * pull[2]; if (t < lo[f]) lo[f] = t; if (t > hi[f]) hi[f] = t; }
  const half = new Map(parting.faces.filter(x => x.body === body.key).map(x => [x.face, x.half]));
  const out: string[] = [];
  for (const f of m.faces) { const h = half.get(f.name); if ((h === '+' && lo[f.index] < level - tol) || (h === '-' && hi[f.index] > level + tol)) out.push(f.name); }
  return out;
}
/** A loop's area in the plane across axis k (the shoelace formula on the other two coordinates). */
function loopArea(points: readonly Vec3[], k: number): number {
  const a = (k + 1) % 3, b = (k + 2) % 3;
  let s = 0;
  for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; s += p[a] * q[b] - q[a] * p[b]; }
  return Math.abs(s) / 2;
}
/** A loop's area centroid in the plane across axis k (the polygon's, not its points' mean: a repeated point weighs nothing), at the plane. */
function loopCentroid(points: readonly Vec3[], k: number, at: number): Vec3 {
  const a = (k + 1) % 3, b = (k + 2) % 3;
  let A = 0, ca = 0, cb = 0;
  for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length], w = p[a] * q[b] - q[a] * p[b]; A += w; ca += (p[a] + q[a]) * w; cb += (p[b] + q[b]) * w; }
  const c: Vec3 = [0, 0, 0]; c[k] = r6(at); c[a] = r6(ca / (3 * A)); c[b] = r6(cb / (3 * A));
  return c;
}
