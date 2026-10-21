// IM7 S0 (O110): a mould's two halves where the part needs no face split — from IM5's parting line, when no face
// straddles the pull and the parting line lies in one plane across it: a block about the part (a margin a side), the
// part taken out of it, cut at that plane along the pull. The half on the +pull side moves along it (IM5's "+": the
// moving half, B side, usually the core); the other stays (the fixed half, A side, usually the cavity). Inner parting
// loops in the plane are shut-offs: where the halves touch across an opening of the part (the core half's metal fills
// it up to the plane). IM3's undercuts freed across the pull give the side cores' directions (their bodies wait); one
// freed by none is said. IM7a (O111): parting loops at several heights meet on risers — the part's flat walls from one
// height to another — whose planes cut the block too; the pieces separated into lumps and each given to a half by rays
// along the pull, so a cup's inside (open above, on the part below) goes to the moving half as its core. Refused by
// code, and what each waits for said: a face that straddles the pull waits for the kernel's face split (D149,
// splitFaceAlongCurve); a sloped or curved parting line, or a riser off the axis planes, is IM7b's.
import type { StudioDoc, Axis } from '../engine/doc';
import { withNode } from '../engine/doc';
import { evaluateDoc, partBreps, type BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { refOf } from '../app/bodyRef';
import { pointTriangleDistance2, rayHit, triangleBvh } from '@barocss/cad';
import { partingLine, type Half, type PartingReport } from './parting';
import type { UndercutRegion } from './undercut';

export type ToolingCode = 'MOULD_NO_PULL' | 'MOULD_PULL_AXIS' | 'MOULD_ONE_BODY' | 'MOULD_STRADDLE' | 'MOULD_NO_PARTING' | 'MOULD_STEPPED' | 'MOULD_BUILD';
/** What each waiting code waits for: the kernel's face split (D149), or the next stage (IM7b). */
export const WAITS_FOR: Readonly<Partial<Record<ToolingCode, string>>> = { MOULD_STRADDLE: 'splitStraddles, the kernel\'s isocline split (D149)', MOULD_STEPPED: 'a parting surface off the axis planes (IM7b)' };
export interface ShutOff { readonly at: number; readonly lengthMM: number; readonly areaMM2: number; readonly centroid: Vec3 }
export interface SideCore { readonly faces: readonly string[]; readonly direction: Vec3; readonly areaMM2: number; readonly centroid: Vec3 }
export interface ToolingPlan {
  readonly pull: Vec3; readonly axis: Axis; readonly sign: 1 | -1;
  /** The parting plane: axis = at. */
  readonly planeAt: number; readonly marginMM: number;
  /** IM7a (O111): every parting height (on the axis), the planes the block is cut by (the heights' and the risers'), and the loops (for the lumps beside the part). */
  readonly levels: readonly number[]; readonly cuts: readonly { readonly axis: Axis; readonly at: number }[]; readonly loops: readonly { readonly at: number; readonly points: readonly Vec3[] }[];
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

/**
 * IM7b (O113): the straddling faces split first. A display face IM5 finds straddling the pull is one or more of the
 * kernel's faces (a full cylinder's side is two half-faces under one name): each is split along its isocline n·d = 0
 * for the pull, a `split-face` node in the document's history (the kernel's D149; pieces `<face>#1` on the + side, …);
 * one the kernel finds one-sided already (NO_SPLIT: its seam on the isocline) needs none. IM5's parting line, which
 * traces the isocline across a straddling face, then holds as the halves' line. Any other refusal is said with its tag.
 */
export function splitStraddles(doc: StudioDoc, bodies: readonly BodyResult[], pull: readonly number[], sides: Readonly<Record<string, Half>> = {}):
  { ok: true; doc: StudioDoc; bodies: BodyResult[]; parting: PartingReport; split: string[]; resolved: string[] } | { ok: false; code: 'MOULD_STRADDLE'; message: string } {
  const parting = partingLine(doc, bodies, pull, sides), straddling = [...new Set(parting.split.map(x => x.face))];
  if (!straddling.length || bodies.length !== 1) return { ok: true, doc, bodies: [...bodies], parting, split: [], resolved: [] };
  let breps: { key: string; brep: { faces: readonly { name?: string }[] } }[] = [];
  try { breps = partBreps(doc) as never; } catch { return { ok: false, code: 'MOULD_STRADDLE', message: 'no exact B-rep to split the straddling faces on' }; }
  const brep = breps.find(b => b.key === bodies[0].key)?.brep ?? breps[0]?.brep;
  let d = doc, at = refOf(bodies[0]), last: BodyResult[] = [...bodies];
  const split: string[] = [];
  for (const face of straddling) {
    const names = (brep?.faces ?? []).map(f => f.name ?? '').filter(n => n === face || n.startsWith(`${face}#`));
    if (!names.length) return { ok: false, code: 'MOULD_STRADDLE', message: `${face}: no exact face of that name to split` };
    for (const name of names) {
      const tried = withNode(d, { kind: 'split-face', parent: at, face: name, pull: [pull[0], pull[1], pull[2]] }), r = evaluateDoc(tried, 1);
      if (r.ok) { d = tried; at = { node: d.nodes.length - 1, side: 'solid' }; last = r.bodies; split.push(name); continue; }
      const why = String((r.error as { detail?: string }).detail ?? JSON.stringify(r.error));
      // (One-sided already — its seam on the isocline, as a full cylinder drawn with its seam across the pull: no split;
      // the kernel says NO_SPLIT, or ON_BOUNDARY with the face wholly on one side.)
      if (/\[NO_SPLIT\]/.test(why) || (/\[ON_BOUNDARY\]/.test(why) && /wholly on one side/.test(why))) continue;
      return { ok: false, code: 'MOULD_STRADDLE', message: `${name} would not split along its isocline: ${why.slice(0, 240)}` };
    }
  }
  // (On the split part a display face carries its kernel pieces' name, `<face>#k`: those are resolved too.)
  const after = split.length ? partingLine(d, last, pull, sides) : parting;
  const resolved = [...new Set([...straddling, ...after.split.map(x => x.face).filter(n => straddling.some(f => n === f || n.startsWith(`${f}#`)))])];
  return { ok: true, doc: d, bodies: last, parting: after, split, resolved };
}

/** The halves' plan, from IM5's parting line and IM3's undercuts at the pull. */
export function toolingPlan(bodies: readonly BodyResult[], pull: readonly number[] | null, parting: PartingReport | null, regions: readonly UndercutRegion[], marginMM = MARGIN_ESTIMATE_MM, resolved: readonly string[] = []): ToolingResult {
  const sideCores: SideCore[] = regions.filter(r => r.sideAction).map(r => ({ faces: r.faces, direction: r.sideAction!, areaMM2: r6(r.areaMM2), centroid: r.centroid.map(r6) as Vec3 }));
  const stuck = regions.filter(r => !r.sideAction).map(r => ({ faces: r.faces, areaMM2: r6(r.areaMM2) })), refuse = refusal(sideCores, stuck);
  if (!pull || !parting) return refuse('MOULD_NO_PULL', 'no pull direction: the halves part along it');
  const k = pull.findIndex(v => Math.abs(Math.abs(v) - 1) <= 1e-9);
  if (k < 0 || pull.some((v, i) => i !== k && Math.abs(v) > 1e-9)) return refuse('MOULD_PULL_AXIS', 'the halves here are cut across an axis: a pull along ±X, ±Y or ±Z');
  if (bodies.length !== 1) return refuse('MOULD_ONE_BODY', `a mould of one body; the part has ${bodies.length}`);
  const unsplit = parting.split.filter(x => !resolved.includes(x.face));
  if (unsplit.length) return refuse('MOULD_STRADDLE', `${unsplit.length} face${unsplit.length === 1 ? '' : 's'} straddle the pull (${[...new Set(unsplit.map(x => x.face))].join(', ')}), not split along the isocline: split them first (${WAITS_FOR.MOULD_STRADDLE}) — or put the whole face in one half (sides)`);
  if (!parting.loops.length) return refuse('MOULD_NO_PARTING', 'no parting line: every face in one half');
  const s = pull[k] > 0 ? 1 : -1 as 1 | -1, size = Math.max(...[0, 1, 2].map(i => bodies[0].mesh.bounds.max[i] - bodies[0].mesh.bounds.min[i])), tol = 1e-4 * (1 + size);
  // (Each loop's height: a flat loop's own; IM7b (O113): a loop that climbs only along walls of the pull — a rod's end
  // caps above its split isocline — takes the height of its runs across the pull, the cut plane crossing those walls.)
  const levelOf = new Map<PartingReport['loops'][number], number>();
  for (const l of parting.loops) {
    const lv = l.flat ? l.rangeMM[0] : loopLevel(l.points, bodies[0], pull, tol);
    if (lv === null) return refuse('MOULD_STEPPED', `a parting loop not across the pull in one plane (${r6(l.rangeMM[0])} … ${r6(l.rangeMM[1])}), climbing across faces that are not along the pull: it waits for ${WAITS_FOR.MOULD_STEPPED}`);
    levelOf.set(l, lv);
  }
  const heights: number[] = [];
  for (const h of [...levelOf.values()].sort((a, b) => a - b)) if (!heights.length || h - heights[heights.length - 1] > tol) heights.push(h);
  const at = (h: number) => r6(s * h);
  // IM7a (O111): between two heights the halves meet on a riser — a flat wall (along the pull) of the part running from
  // one parting height to the other; its plane, across an axis, cuts the block too.
  const risers = heights.length > 1 ? risersOf(bodies[0], pull, heights, tol) : { cuts: [], missing: null };
  if (heights.length > 1 && risers.missing) return refuse('MOULD_STEPPED', `parting loops at ${heights.length} heights (${heights.map(r6).join(', ')}) with ${risers.missing}: it waits for ${WAITS_FOR.MOULD_STEPPED}`);
  const cuts: { axis: Axis; at: number }[] = [...heights.map(h => ({ axis: AXES[k], at: at(h) })), ...(heights.length > 1 ? risers.cuts : [])];
  const outer = [...parting.loops].sort((a, b) => b.lengthMM - a.lengthMM)[0];
  const b = bodies[0].mesh.bounds, min = [0, 1, 2].map(i => r6(b.min[i] - marginMM)), max = [0, 1, 2].map(i => r6(b.max[i] + marginMM));
  // (A shut-off: a closed loop inside another at its height — smaller, a point of it within — the halves touching across an opening there.)
  const loops = parting.loops.map(l => ({ at: at(levelOf.get(l)!), points: l.points }));
  const shutOffs: ShutOff[] = parting.loops.filter(l => l.closed && parting.loops.some(o => o !== l && Math.abs(levelOf.get(o)! - levelOf.get(l)!) <= tol && loopArea(l.points, k) < loopArea(o.points, k) && inside(l.points[0], o.points, k))).map(l => ({ at: at(levelOf.get(l)!), lengthMM: r6(l.lengthMM), areaMM2: r6(loopArea(l.points, k)), centroid: loopCentroid(l.points, k, at(levelOf.get(l)!)) }));
  const notBuilt = [...(sideCores.length ? [`${sideCores.length} side core${sideCores.length === 1 ? '' : 's'}: their directions given, their bodies not built`] : []),
    'no gate, runner, cooling, ejectors or mould base: the halves are the impression only'];
  return { ok: true, plan: { pull: pull.map(r6) as Vec3, axis: AXES[k], sign: s, planeAt: at(levelOf.get(outer)!), levels: heights.map(at), cuts, loops, marginMM, block: { min, max }, shutOffs, sideCores, stuck, notBuilt } };
}

/**
 * A non-flat loop's height (IM7b, O113): its runs across the pull all at one height, and every run that climbs lying on
 * a face along the pull (its display normals ⟂ the pull: the cut plane crosses it anywhere); else null.
 */
function loopLevel(points: readonly Vec3[], body: BodyResult, pull: readonly number[], tol: number): number | null {
  const m = body.mesh, P = m.positions, N = m.normals, F = m.faceOfVertex, I = m.indices, wall = new Uint8Array(m.faces.length).fill(1);
  for (let v = 0; v < F.length; v++) if (Math.abs(N[3 * v] * pull[0] + N[3 * v + 1] * pull[1] + N[3 * v + 2] * pull[2]) > 1e-4) wall[F[v]] = 0;
  const h = (p: readonly number[]) => p[0] * pull[0] + p[1] * pull[1] + p[2] * pull[2];
  let level: number | null = null;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (Math.abs(h(a) - h(b)) <= tol) { if (level === null) level = h(a); else if (Math.abs(level - h(a)) > tol) return null; continue; }
    // (A climbing run: its middle on a wall's triangle, to the mesh's precision.)
    const q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    let on = false;
    for (let t = 0; t < I.length && !on; t += 3) {
      if (!wall[F[I[t]]]) continue;
      on = pointTriangleDistance2(P, I, t / 3, q[0], q[1], q[2]) <= 1e-6;
    }
    if (!on) return null;
  }
  return level;
}
/** The flat walls along the pull from one parting height to another, as axis planes; or what is missing. */
function risersOf(body: BodyResult, pull: readonly number[], heights: readonly number[], tol: number): { cuts: { axis: Axis; at: number }[]; missing: string | null } {
  const m = body.mesh, P = m.positions, F = m.faceOfVertex, lo = new Float64Array(m.faces.length).fill(Infinity), hi = new Float64Array(m.faces.length).fill(-Infinity);
  for (let v = 0; v < F.length; v++) { const f = F[v], t = P[3 * v] * pull[0] + P[3 * v + 1] * pull[1] + P[3 * v + 2] * pull[2]; if (t < lo[f]) lo[f] = t; if (t > hi[f]) hi[f] = t; }
  const isLevel = (t: number) => heights.some(h => Math.abs(h - t) <= tol);
  const cuts: { axis: Axis; at: number }[] = [], off: string[] = [];
  for (const f of m.faces) {
    const along = Math.abs(f.normal[0] * pull[0] + f.normal[1] * pull[1] + f.normal[2] * pull[2]) <= 1e-6;
    if (!along || !isLevel(lo[f.index]) || !isLevel(hi[f.index]) || hi[f.index] - lo[f.index] <= tol) continue;
    const i = f.normal.findIndex(v => Math.abs(Math.abs(v) - 1) <= 1e-6);
    if (f.kind !== 'plane' || i < 0) { off.push(f.name); continue; }
    const a = r6(f.centroid[i]);
    if (!cuts.some(c => c.axis === AXES[i] && Math.abs(c.at - a) <= tol)) cuts.push({ axis: AXES[i], at: a });
  }
  return { cuts, missing: off.length ? `a riser not flat across an axis (${off.slice(0, 6).join(', ')})` : !cuts.length ? 'no flat riser between them' : null };
}

/** A lump of the block less the part, with the half it goes to and why. */
export interface MouldLump { readonly body: BodyResult; readonly half: '+' | '-'; readonly basis: 'under the part' | 'over the part' | 'between' | 'beside' }
/**
 * The halves as bodies (IM7a, O111): the block less the part cut by the plan's planes (the parting heights, the
 * risers'), each piece separated into lumps, each lump given to a half by rays along the pull from a point inside it:
 * shadowed from above (the part over it) the fixed half; open above but on the part below (a cup's inside) the moving
 * half; neither, or both, by the nearest parting loop's height. The lumps partition the block less the part.
 */
export function mouldHalves(doc: StudioDoc, bodies: readonly BodyResult[], plan: ToolingPlan): { ok: true; doc: StudioDoc; plus: BodyResult[]; minus: BodyResult[]; lumps: MouldLump[] } | { ok: false; code: 'MOULD_BUILD'; message: string } {
  const part = refOf(bodies[0]), { min, max } = plan.block;
  let d = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [min[0], min[1]], max: [max[0], max[1]], plane: { origin: [0, 0, min[2]], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  d = withNode(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: max[2] - min[2] });
  d = withNode(d, { kind: 'difference', parent: { node: d.nodes.length - 1, side: 'solid' }, tool: part });
  const fail = (why: string) => ({ ok: false as const, code: 'MOULD_BUILD' as const, message: why });
  let r = evaluateDoc(d, 1); if (!r.ok) return fail(`the block less the part does not evaluate: ${JSON.stringify(r.error).slice(0, 200)}`);
  const span = 1e-6 * (1 + Math.max(...[0, 1, 2].map(i => max[i] - min[i])));
  for (const c of plan.cuts) {
    const i = AXES.indexOf(c.axis);
    for (const piece of r.bodies) if (piece.mesh.bounds.min[i] < c.at - span && piece.mesh.bounds.max[i] > c.at + span) d = withNode(d, { kind: 'split', parent: refOf(piece), axis: c.axis, at: c.at });
    r = evaluateDoc(d, 1); if (!r.ok) return fail(`a cut at ${c.axis} = ${c.at} does not evaluate: ${JSON.stringify(r.error).slice(0, 200)}`);
  }
  // (Only a piece of more than one lump is separated: the kernel refuses a body already in one piece.)
  for (const piece of r.bodies) if (lumpCount(piece) > 1) d = withNode(d, { kind: 'separate', parent: refOf(piece) });
  r = evaluateDoc(d, 1); if (!r.ok) return fail(`the lumps do not evaluate: ${JSON.stringify(r.error).slice(0, 200)}`);
  const bvh = triangleBvh(bodies[0].mesh.positions, bodies[0].mesh.indices), k = AXES.indexOf(plan.axis), up = plan.pull, down: Vec3 = [-up[0], -up[1], -up[2]];
  const lumps: MouldLump[] = r.bodies.map(body => classify(body, bvh, up, down, plan, k));
  return { ok: true, doc: d, plus: lumps.filter(l => l.half === '+').map(l => l.body), minus: lumps.filter(l => l.half === '-').map(l => l.body), lumps };
}

/** How many pieces a closed mesh is in: its triangles joined at shared positions (union–find). */
function lumpCount(b: BodyResult): number {
  const P = b.mesh.positions, I = b.mesh.indices, key = new Map<string, number>(), parent: number[] = [];
  const id = (v: number) => { const k = `${Math.round(P[3 * v] * 1e4)},${Math.round(P[3 * v + 1] * 1e4)},${Math.round(P[3 * v + 2] * 1e4)}`; let n = key.get(k); if (n === undefined) { n = parent.length; parent.push(n); key.set(k, n); } return n; };
  for (let t = 0; t < I.length; t += 3) { const a = rootOf(parent, id(I[t])), c = rootOf(parent, id(I[t + 1])), e = rootOf(parent, id(I[t + 2])); parent[c] = a; parent[rootOf(parent, e)] = a; }
  let n = 0; for (let i = 0; i < parent.length; i++) if (parent[i] === i) n++;
  return n;
}
function rootOf(parent: number[], x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
/** Votes by area over a lump's largest triangles (a point a hair inside each): which half, and the basis most of it has. */
const SAMPLES = 32, HAIR = 1e-3;
function classify(body: BodyResult, bvh: ReturnType<typeof triangleBvh>, up: readonly number[], down: readonly number[], plan: ToolingPlan, k: number): MouldLump {
  const P = body.mesh.positions, I = body.mesh.indices, tris: { t: number; A: number; n: number[] }[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], c = 3 * I[t + 1], e = 3 * I[t + 2], ux = P[c] - P[a], uy = P[c + 1] - P[a + 1], uz = P[c + 2] - P[a + 2], vx = P[e] - P[a], vy = P[e + 1] - P[a + 1], vz = P[e + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, A = Math.hypot(nx, ny, nz);
    if (A > 0) tris.push({ t, A, n: [nx / A, ny / A, nz / A] });
  }
  tris.sort((x, y) => y.A - x.A);
  const vote = { '+': 0, '-': 0 }, bases = new Map<MouldLump['basis'], number>();
  for (const { t, A, n } of tris.slice(0, SAMPLES)) {
    const a = 3 * I[t], c = 3 * I[t + 1], e = 3 * I[t + 2], p = [0, 1, 2].map(i => (P[a + i] + P[c + i] + P[e + i]) / 3 - HAIR * n[i]);
    const over = rayHit(bvh, p, up) < Infinity, under = rayHit(bvh, p, down) < Infinity;
    // (Shadowed from above: the fixed half; open above, on the part below: the moving half; else the nearest loop's side.)
    const [half, basis]: ['+' | '-', MouldLump['basis']] = over && !under ? ['-', 'under the part'] : under && !over ? ['+', 'over the part']
      : [p[k] * plan.sign > nearestLoop(p, plan.loops, k) * plan.sign ? '+' : '-', over && under ? 'between' : 'beside'];
    vote[half] += A; bases.set(basis, (bases.get(basis) ?? 0) + A);
  }
  return { body, half: vote['+'] > vote['-'] ? '+' : '-', basis: [...bases].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'beside' };
}
/** The height (on the axis) of the parting loop nearest p across the pull. */
function nearestLoop(p: readonly number[], loops: ToolingPlan['loops'], k: number): number {
  const a = (k + 1) % 3, b = (k + 2) % 3;
  let best = Infinity, at = loops[0]?.at ?? 0;
  for (const l of loops) for (let i = 0; i + 1 < l.points.length; i++) {
    const q = l.points[i], r = l.points[i + 1], dx = r[a] - q[a], dy = r[b] - q[b], L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((p[a] - q[a]) * dx + (p[b] - q[b]) * dy) / L)) : 0, ex = q[a] + t * dx - p[a], ey = q[b] + t * dy - p[b], d2 = ex * ex + ey * ey;
    if (d2 < best) { best = d2; at = l.at; }
  }
  return at;
}
/** Whether point p lies inside the polygon (projected across axis k), by ray crossings. */
function inside(p: readonly number[], points: readonly Vec3[], k: number): boolean {
  const a = (k + 1) % 3, b = (k + 2) % 3; let c = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i], pj = points[j];
    if ((pi[b] > p[b]) !== (pj[b] > p[b]) && p[a] < (pj[a] - pi[a]) * (p[b] - pi[b]) / (pj[b] - pi[b]) + pi[a]) c = !c;
  }
  return c;
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
