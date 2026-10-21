// AM3 (D74): printability, rule by rule, from the part's printing process and printer (AM1) and how it lies (the build
// direction: chosen by AM4 or given). Each rule says pass, warn (recommended, not met), fail (feasible, not met),
// unknown (what it needs is not there — an orientation, a printer, a set material — said why) or n/a (the process does
// not have it: powder does not tip). Values and limits come with each, the limits' sources from the profile.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { faceTableOf } from '../assembly/faces';
import { interference, wallThickness } from '../chat/analysis';
import { materialIdOf } from '../app/bodies';
import { materialData, printerProfile, processProfile, type MouldFinish, type ProcessProfile } from '../library/materials';
import { overhangOf, type Vec3 } from './overhang';
import { draftField, type DraftFace } from '../mould/draft';
import { undercuts, type UndercutRegion } from '../mould/undercut';
import { wallsOf, type WallReport } from '../mould/walls';
import { partingLine, type Half, type PartingReport } from '../mould/parting';
import type { Hole, TappedHole } from '../machining/holes';
import type { Cavities } from '../machining/cavities';
import type { Access } from '../machining/access';
import type { DrawingCheck } from '../machining/drawing';
import type { Turning } from '../machining/turning';
import type { Feature } from '../machining/features';
import type { StockResult } from '../machining/stock';
import { machinability } from '../machining/report';

export type RuleStatus = 'pass' | 'warn' | 'fail' | 'unknown' | 'n/a';
export interface PrintRule {
  readonly id: string; readonly level: 'feasible' | 'recommended'; readonly status: RuleStatus; readonly message: string;
  readonly value?: number; readonly limit?: number; readonly unit?: string; readonly source?: string; readonly entities?: readonly string[]; readonly why?: string;
}
/**
 * The manufacturability report for the part's process (IM1, O77: printing, injection moulding; machining to come):
 * `process` the one judged by, null when none is chosen (none assumed); for moulding, `direction` is the pull and `mould`
 * says the finish, its least draft and each body's material and shrink.
 */
export interface PrintabilityReport {
  readonly process: string | null; readonly printer?: string; readonly direction: Vec3 | null; readonly rules: readonly PrintRule[];
  /** CNC1 (O84): the material's family, the general tolerance (sourced) and its class (named, not copied). */
  readonly machining?: { readonly family: 'metal' | 'plastic' | null; readonly material: string | null; readonly tolerance: { mm: number; feasibleMM: number; source: string }; readonly toleranceClass: { name: string; note: string; source: string } | null;
    /** CNC2 (O85): the holes found (steps, open ends, reaches) and the tapped holes matched to them. */
    readonly holes?: readonly Hole[]; readonly tapped?: readonly TappedHole[];
    /** CNC3 (O86): the inside corners, sharp edges, cavity floors and thin standing walls. */
    readonly cavities?: Cavities;
    /** CNC4 (O87): the area each set of the six directions reaches, what none does, and the greedy setups. */
    readonly access?: Access;
    /** CNC5 (O88): the drawing — needed, present, and its items each with its page. */
    readonly drawing?: DrawingCheck;
    /** CNC6 (O89): the turning axis, what is turned and what is not, size, profile, grooves, holes, points. */
    readonly turning?: Turning;
    /** CNC7a (O101): the machining features recognised, each with its setup, sizes and faces. */
    readonly features?: readonly Feature[];
    /** CNC7b (O102): the stock chosen from the shop's list, or why none is. */
    readonly stock?: StockResult };
  readonly mould?: { readonly finish: string | null; readonly minDraftDeg: number | null; readonly recDraftDeg: number | null; readonly bodies: readonly { body: string; material: string | null; wallMM: readonly [number, number] | null; wallNote?: string; shrink: number | null }[];
    /** IM2: each face's exact draft and class (with a pull and a finish). */
    readonly draft?: readonly { body: string; face: string; cls: string; min_deg: number; max_deg: number; steepest_deg: number; side: string; below_mm2: number; area_mm2: number; isocline_points?: number }[];
    /** IM5: the parting line — each face's half, the straddling faces to split, the loops. */
    readonly parting?: Record<string, unknown>;
    /** IM4: each body's walls — the nominal, the thinnest and thick sections, ribs, bosses, fillets, sharp inside corners. */
    readonly walls?: readonly Record<string, unknown>[];
    /** IM3: the undercut regions (with a pull): their faces, area, centre and the side action that frees each (null: none). */
    readonly undercuts?: readonly { body: string; faces: string[]; area_mm2: number; centroid: Vec3; side_action: Vec3 | null; best_share: number }[] };
}
type Evaluate = (doc: StudioDoc) => Promise<{ ok: boolean } | null>;

const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const RANK: Record<RuleStatus, number> = { fail: 4, warn: 3, unknown: 2, pass: 1, 'n/a': 0 };
/** Two unit vectors across b (the bed's axes). */
function across(b: Vec3): [Vec3, Vec3] {
  const a: Vec3 = Math.abs(b[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], d = dot(a, b), u = unit([a[0] - d * b[0], a[1] - d * b[1], a[2] - d * b[2]]);
  return [u, [b[1] * u[2] - b[2] * u[1], b[2] * u[0] - b[0] * u[2], b[0] * u[1] - b[1] * u[0]]];
}
/** A mesh's extents along u, v and b. */
function extents(m: DisplayMesh, u: Vec3, v: Vec3, b: Vec3): [number, number, number] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], P = m.positions;
  for (let i = 0; i < P.length; i += 3) { const p = [P[i], P[i + 1], P[i + 2]]; [u, v, b].forEach((a, k) => { const t = dot(p, a); lo[k] = Math.min(lo[k], t); hi[k] = Math.max(hi[k], t); }); }
  return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
}
/**
 * Enclosed cavities: the mesh's surface pieces (triangles joined at shared positions), less the outer one; a piece
 * whose box lies inside the outer piece's box is a cavity (a separate piece beside it is not).
 */
export function cavitiesOf(m: DisplayMesh): number {
  const P = m.positions, I = m.indices, key = new Map<string, number>(), parent: number[] = [];
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const id = (v: number) => { const k = `${Math.round(P[3 * v] * 1e4)},${Math.round(P[3 * v + 1] * 1e4)},${Math.round(P[3 * v + 2] * 1e4)}`; let n = key.get(k); if (n === undefined) { n = parent.length; parent.push(n); key.set(k, n); } return n; };
  for (let t = 0; t < I.length; t += 3) { const a = find(id(I[t])), b = find(id(I[t + 1])), c = find(id(I[t + 2])); parent[b] = a; parent[find(c)] = a; }
  const boxes = new Map<number, { lo: number[]; hi: number[] }>();
  for (const [k, n] of key) { const r = find(n), p = k.split(',').map(Number), bx = boxes.get(r) ?? { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] }; for (let i = 0; i < 3; i++) { bx.lo[i] = Math.min(bx.lo[i], p[i]); bx.hi[i] = Math.max(bx.hi[i], p[i]); } boxes.set(r, bx); }
  const list = [...boxes.values()]; if (list.length < 2) return 0;
  const vol = (x: { lo: number[]; hi: number[] }) => (x.hi[0] - x.lo[0]) * (x.hi[1] - x.lo[1]) * (x.hi[2] - x.lo[2]);
  const outer = list.reduce((a, b) => vol(b) > vol(a) ? b : a);
  return list.filter(x => x !== outer && [0, 1, 2].every(i => x.lo[i] > outer.lo[i] && x.hi[i] < outer.hi[i])).length;
}

/** The part's printability against its process, printer and orientation (given, else the document's chosen one). */
export async function printability(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, options: { direction?: readonly number[]; finish?: string; sides?: Readonly<Record<string, Half>> } = {}): Promise<PrintabilityReport> {
  const profile = processProfile(doc.process), printer = printerProfile(doc.printer), dir = options.direction ?? doc.print?.direction;
  const b = dir ? unit(dir) : null, rules: PrintRule[] = [];
  if (profile?.id === 'injection') return mouldability(doc, bodies, profile, options);
  if (profile?.id === 'cnc-milling' || profile?.id === 'cnc-turning') return machinability(doc, bodies, profile);
  if (!profile?.additive) {
    const why = profile ? `${profile.label} is not printing, and has no rules here yet` : 'no process is chosen: set the brief\'s process (or the studio\'s Process) — none is assumed';
    return { process: profile?.id ?? null, direction: b, rules: ['wall', 'hole', 'horizontal-hole', 'gap', 'cavity', 'bed-fit', 'overhang', 'warp', 'tip'].map(id => ({ id, level: 'recommended' as const, status: 'unknown' as const, message: id, why })) };
  }
  const t = (k: string) => profile.thresholds[k], noOrientation = 'no orientation is chosen or given (AM4)';
  // Wall: the thinnest wall of any body.
  const walls = bodies.map(x => ({ key: x.key, w: (wallThickness(x) as { thinnest_mm: number | null }).thinnest_mm })).filter(x => x.w !== null) as { key: string; w: number }[];
  const thin = walls.sort((a, c) => a.w - c.w)[0];
  rules.push(thin ? rule('wall', 'feasible', thin.w >= t('minWall').value, 'the thinnest wall, against the thinnest the process makes', thin.w, t('minWall').value, 'mm', t('minWall').source, [thin.key])
    : { id: 'wall', level: 'feasible', status: 'unknown', message: 'the thinnest wall', why: 'no wall measured' });
  if (thin) rules.push(rule('wall-rec', 'recommended', thin.w >= t('minWallRec').value, 'the thinnest wall, against the process\'s recommendation', thin.w, t('minWallRec').value, 'mm', t('minWallRec').source, [thin.key]));
  // Holes: inner round faces, the smallest.
  const table = faceTableOf(doc), holes = Object.entries(table).flatMap(([name, f]) => f.kind === 'cylinder' && !f.outer ? [{ name, d: 2 * f.radius, axis: f.axis }] : []);
  const smallest = [...holes].sort((a, c) => a.d - c.d)[0];
  rules.push(smallest ? rule('hole', 'feasible', smallest.d >= t('minHoleMM').value, 'the smallest hole, against the smallest that prints open', smallest.d, t('minHoleMM').value, 'mm', t('minHoleMM').source, [smallest.name])
    : { id: 'hole', level: 'feasible', status: 'pass', message: 'no holes' });
  // Horizontal holes (their axes across b) wider than the process prints round: their tops sag.
  if (!b) rules.push({ id: 'horizontal-hole', level: 'recommended', status: 'unknown', message: 'horizontal holes', why: noOrientation });
  else {
    const flat = holes.filter(h => Math.abs(dot(h.axis, b)) < 1e-6 && h.d > t('horizontalHoleMM').value);
    rules.push({ id: 'horizontal-hole', level: 'recommended', status: flat.length ? 'warn' : 'pass', message: 'horizontal holes wider than print round sag at their tops: a teardrop, or support', ...(flat.length ? { value: Math.max(...flat.map(h => h.d)), entities: flat.map(h => h.name) } : {}), limit: t('horizontalHoleMM').value, unit: 'mm', source: t('horizontalHoleMM').source });
  }
  // Gaps between bodies printed together.
  if (bodies.length < 2) rules.push({ id: 'gap', level: 'recommended', status: 'n/a', message: 'one body: no gaps between bodies' });
  else {
    const pairs = await interference(doc, bodies, evaluate as never) as { a?: string; b?: string; bodies?: string[]; overlap_mm3?: number; clearance_mm?: number }[];
    const overlap = pairs.find(p => (p.overlap_mm3 ?? 0) > 0), close = pairs.filter(p => p.clearance_mm !== undefined).sort((x, y) => x.clearance_mm! - y.clearance_mm!)[0];
    if (overlap) rules.push({ id: 'gap', level: 'feasible', status: 'fail', message: 'bodies overlap: they print as one', value: -(overlap.overlap_mm3 ?? 0), unit: 'mm³' });
    else rules.push(rule('gap', 'recommended', !close || close.clearance_mm! >= t('fitGap').value, 'the least gap between bodies printed together, against the gap that does not fuse', close?.clearance_mm ?? Infinity, t('fitGap').value, 'mm', t('fitGap').source));
  }
  // Enclosed cavities: powder and resin stay trapped without escape holes. Exactly, the B-rep's inner shells; the
  // display mesh's enclosed pieces only where a body has no shells to count (said which).
  const methods: string[] = [];
  const cav = bodies.reduce((n, x) => { if (x.innerShells !== undefined) { methods.push(`${x.key}: B-rep shells`); return n + x.innerShells; } methods.push(`${x.key}: display-mesh pieces`); return n + cavitiesOf(x.mesh); }, 0), needs = t('escapeHoles').value;
  rules.push({ ...(needs > 0 ? rule('cavity', 'feasible', cav === 0, `an enclosed cavity traps ${profile.id === 'sla' ? 'resin' : 'powder'}: give it ${needs} escape holes of at least Ø${t('escapeHoleMM').value} mm`, cav, 0, 'count', t('escapeHoles').source)
    : { id: 'cavity', level: 'recommended' as const, status: 'pass' as const, message: cav ? `${cav} enclosed cavities (filled or left as infill: nothing to drain)` : 'no enclosed cavity', value: cav }), why: `counted by ${methods.join('; ')}` });
  // Orientation's rules: bed fit, overhang, warp, tip.
  if (!b) for (const id of ['bed-fit', 'overhang', 'warp', 'tip']) rules.push({ id, level: 'recommended', status: id === 'tip' && !t('tipRatio') ? 'n/a' : 'unknown', message: id, why: id === 'tip' && !t('tipRatio') ? `${profile.label} does not tip: the part lies in powder` : noOrientation });
  else {
    const [u, v] = across(b);
    const per = bodies.map(x => ({ key: x.key, ext: extents(x.mesh, u, v, b), over: overhangOf(x.mesh, table, t('maxOverhangDeg').value, b), material: materialData(materialIdOf(doc, x)) }));
    // Bed fit: the whole part's extents (across the bed either way round, then height) within the printer's.
    if (!printer) rules.push({ id: 'bed-fit', level: 'feasible', status: 'unknown', message: 'the part within the printer\'s build volume', why: 'no printer is chosen' });
    else {
      const all = bodies.reduce((e, x) => { const q = extents(x.mesh, u, v, b); return [Math.max(e[0], q[0]), Math.max(e[1], q[1]), Math.max(e[2], q[2])]; }, [0, 0, 0]);
      const [a1, a2] = [Math.max(all[0], all[1]), Math.min(all[0], all[1])], [b1, b2] = [Math.max(printer.buildMM[0], printer.buildMM[1]), Math.min(printer.buildMM[0], printer.buildMM[1])];
      const fits = a1 <= b1 && a2 <= b2 && all[2] <= printer.buildMM[2];
      rules.push({ id: 'bed-fit', level: 'feasible', status: fits ? 'pass' : 'fail', message: `the part (${all.map(x => +x.toFixed(2)).join(' × ')} mm) within ${printer.label}`, value: Math.max(a1 / b1, a2 / b2, all[2] / printer.buildMM[2]), limit: 1, unit: 'ratio', source: printer.source });
    }
    const overArea = per.reduce((n, x) => n + x.over.totalMM2, 0);
    rules.push({ id: 'overhang', level: 'recommended', status: overArea > 0 ? 'warn' : 'pass', message: `the area past ${t('maxOverhangDeg').value}° from the vertical needs support${per.some(x => x.over.approximate) ? ' (curved faces to the chord error)' : ''}`, value: overArea, unit: 'mm²', source: t('maxOverhangDeg').source, entities: per.flatMap(x => x.over.faces.map(f => f.name)).slice(0, 20) });
    rules.push(warpRule(per, profile));
    rules.push(tipRule(per, profile));
  }
  return { process: profile.id, ...(printer ? { printer: printer.id } : {}), direction: b, rules };
}

/**
 * IM1 (O77): injection moulding's process rule — the pull (given, else the document's), the finish and its least draft,
 * the walls against the process and each body's material range (sourced per value), the part against the largest a
 * moulder makes (its depth along the pull). The draft field (IM2) and undercuts (IM3) are said to come, not guessed.
 */
function mouldability(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, options: { direction?: readonly number[]; finish?: string; sides?: Readonly<Record<string, Half>> }): PrintabilityReport {
  const t = (k: string) => profile.thresholds[k], rules: PrintRule[] = [], pullIn = options.direction ?? doc.mould?.pull, pull = pullIn ? unit(pullIn) : null;
  const finishId = options.finish ?? doc.mould?.finish ?? null, finish: MouldFinish | undefined = finishId ? profile.finishes?.find(f => f.id === finishId) : undefined;
  rules.push(pull ? { id: 'pull', level: 'feasible', status: 'pass', message: `the pull direction (the mould opens along it): ${pull.map(v => +v.toFixed(6)).join(', ')}` }
    : { id: 'pull', level: 'feasible', status: 'unknown', message: 'the pull direction', why: 'no pull direction is given or set (the mould\'s opening): none is assumed' });
  rules.push(finish ? { id: 'finish', level: 'recommended', status: 'pass', message: `${finish.label}: at least ${finish.draftMinDeg}° of draft${finish.draftRecDeg !== undefined ? `, ${finish.draftRecDeg}° recommended` : ''}`, value: finish.draftMinDeg, unit: 'deg', source: finish.source }
    : { id: 'finish', level: 'recommended', status: 'unknown', message: 'the surface finish (its least draft)', why: finishId ? `"${finishId}" is not a finish here: ${(profile.finishes ?? []).map(f => f.id).join(', ')}` : 'no surface finish is set' });
  // Walls: the thinnest against the process, and each body's thinnest and thick sections against its material's range.
  // (IM4, O80: the walls by the local thickness — the inscribed sphere at each inward ray's middle — and the thinnest by the ray.)
  const wr: WallReport[] = wallsOf(doc, bodies, t('adjacentWallRatio')?.value ?? 0.6);
  const per = bodies.map((x, k) => { const w = wr[k], id = materialIdOf(doc, x) ?? null, m = id ? materialData(id) : undefined;
    return { key: x.key, thin: w.thinnestMM === null ? null : r3(w.thinnestMM), thick: w.thick95MM === null ? null : r3(w.thick95MM), material: id, range: (m?.wallMM?.injection ?? null) as readonly [number, number] | null, rangeSource: m ? m.sources['wallMM.injection'] ?? m.sources.wallMM : undefined, note: m?.pages?.['wallMM.injection']?.note, shrink: m?.mouldShrink ?? null }; });
  const thin = per.filter(x => x.thin !== null).sort((a, c) => a.thin! - c.thin!)[0];
  rules.push(thin ? rule('wall', 'feasible', thin.thin! >= t('minWall').value, 'the thinnest wall, against the thinnest that fills', thin.thin!, t('minWall').value, 'mm', t('minWall').source, [thin.key])
    : { id: 'wall', level: 'feasible', status: 'unknown', message: 'the thinnest wall', why: 'no wall measured' });
  const ranged = per.filter(x => x.range && x.thin !== null), unranged = per.filter(x => !x.range);
  if (!ranged.length) rules.push({ id: 'wall-material', level: 'recommended', status: 'unknown', message: 'the walls against the material\'s moulding range', why: unranged.length ? unranged.map(x => x.material ? `${x.key}: ${materialData(x.material)?.label ?? x.material} has no moulding wall range` : `${x.key}: its material is not set`).join('; ') : 'no wall measured' });
  else {
    const out = ranged.filter(x => x.thin! < x.range![0] - 1e-9 || (x.thick !== null && x.thick > x.range![1] + 1e-9)), worst = out[0] ?? ranged[0];
    rules.push({ id: 'wall-material', level: 'recommended', status: out.length ? 'warn' : unranged.length ? 'unknown' : 'pass',
      message: `the walls (the thinnest, and the thick sections: the depth 95 % of the surface is within) against the material's moulding range: ${worst.key} ${worst.thin} … ${worst.thick ?? '?'} mm in ${worst.range![0]} … ${worst.range![1]} mm${worst.note ? ` (${worst.note})` : ''}`,
      value: worst.thick ?? worst.thin!, limit: worst.range![1], unit: 'mm', source: worst.rangeSource, entities: (out.length ? out : ranged).map(x => x.key), ...(unranged.length && !out.length ? { why: `${unranged.map(x => x.key).join(', ')}: no moulding range` } : {}) });
  }
  // IM4 (O80): walls even, ribs thin enough, bosses' walls, inside corners rounded, no thick sections — against the nominal wall.
  const ratio = t('adjacentWallRatio'), ribRec = t('ribRec'), bMin = t('bossWallMin'), bMax = t('bossWallMax'), rIn = t('insideRadiusRatio'), named = wr.filter(w => w.nominalMM !== null);
  if (!named.length) for (const id of ['wall-uniform', 'rib', 'boss', 'inside-radius', 'sink']) rules.push({ id, level: 'recommended', status: 'unknown', message: id, why: 'no wall measured' });
  else {
    const uneven = named.map(w => ({ w, r: Math.min(w.thinnestMM! / w.nominalMM!, w.nominalMM! / (w.thick95MM ?? w.nominalMM!)) })).sort((a, b) => a.r - b.r)[0];
    rules.push({ id: 'wall-uniform', level: 'recommended', status: uneven.r >= ratio.value - 1e-9 ? 'pass' : 'warn', message: `the walls even: the thinnest and the thick sections against the nominal ${r3(uneven.w.nominalMM!)} mm (${uneven.w.body}: ${r3(uneven.w.thinnestMM!)} … ${r3(uneven.w.thick95MM ?? uneven.w.nominalMM!)} mm)`, value: r3(uneven.r), limit: ratio.value, unit: 'ratio', source: ratio.source, entities: [uneven.w.body] });
    const ribs = named.flatMap(w => w.ribs.map(r => ({ r, k: r.thicknessMM / w.nominalMM! }))), thickRibs = ribs.filter(x => x.k > ribRec.value + 1e-9);
    rules.push(!ribs.length ? { id: 'rib', level: 'recommended', status: 'n/a', message: 'no rib: no plate inside the part between two close opposite faces' }
      : { id: 'rib', level: 'recommended', status: thickRibs.length ? 'warn' : 'pass', message: `${ribs.length} rib${ribs.length > 1 ? 's' : ''}, the thickest ${r3(Math.max(...ribs.map(x => x.r.thicknessMM)))} mm against ${ribRec.value} × the nominal wall${thickRibs.length ? ` (${thickRibs.length} thicker: sink on the face opposite)` : ''}`, value: r3(Math.max(...ribs.map(x => x.k))), limit: ribRec.value, unit: 'ratio', source: ribRec.source, entities: (thickRibs.length ? thickRibs : ribs).flatMap(x => x.r.faces) });
    const nominal = named[0].nominalMM!, bosses = named.flatMap(w => w.bosses), off = bosses.filter(b => b.wallMM / nominal < bMin.value - 1e-9 || b.wallMM / nominal > bMax.value + 1e-9);
    rules.push(!bosses.length ? { id: 'boss', level: 'recommended', status: 'n/a', message: 'no boss: no outer cylinder with a bore on its axis' }
      : { id: 'boss', level: 'recommended', status: off.length ? 'warn' : 'pass', message: `${bosses.length} boss${bosses.length > 1 ? 'es' : ''}: the wall round the bore against ${bMin.value} … ${bMax.value} × the nominal wall (${bosses.map(b => `${b.outer} ${r3(b.wallMM)} mm`).join(', ')})`, value: r3(Math.max(...bosses.map(b => Math.abs(b.wallMM / nominal - (bMin.value + bMax.value) / 2)))), unit: 'ratio', source: bMin.source, entities: (off.length ? off : bosses).flatMap(b => [b.outer, b.inner]) });
    const sharp = named.flatMap(w => w.sharp), small = named.flatMap(w => w.fillets.filter(f => f.radiusMM < rIn.value * w.nominalMM! - 1e-9)), least = Math.min(...named.flatMap(w => w.fillets.map(f => f.radiusMM)), sharp.length ? 0 : Infinity);
    rules.push({ id: 'inside-radius', level: 'recommended', status: sharp.length || small.length ? 'warn' : 'pass', message: `inside corners rounded at least ${rIn.value} × the nominal wall (${r3(rIn.value * nominal)} mm)${sharp.length ? `: ${sharp.length} sharp` : ''}${small.length ? `${sharp.length ? ',' : ':'} ${small.length} rounded less` : ''}`, ...(Number.isFinite(least) ? { value: r3(least) } : {}), limit: r3(rIn.value * nominal), unit: 'mm', source: rIn.source, entities: [...sharp.flatMap(c => c.faces), ...small.map(f => f.face)].slice(0, 40) });
    const thick = named.flatMap(w => (w.thick ? [w.thick] : []));
    rules.push({ id: 'sink', level: 'recommended', status: thick.length ? 'warn' : 'pass', message: thick.length ? `thick sections past the nominal over ${ratio.value} (${thick.map(x => `${x.body}: ${r3(x.areaMM2)} mm², up to ${r3(x.maxMM)} mm`).join('; ')}): sink marks and voids — core them out` : 'no section thicker than the nominal wall over the adjacent-wall ratio', ...(thick.length ? { value: r3(Math.max(...thick.map(x => x.maxMM))) } : {}), limit: r3(nominal / ratio.value), unit: 'mm', source: ratio.source, entities: thick.flatMap(x => x.faces).slice(0, 40) });
  }
  // Size: the part's extents — its depth along the pull, the two across it either way round — within the largest part.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of bodies) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], x.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], x.mesh.bounds.max[k]); }
  const L = t('maxPartLongMM'), W = t('maxPartWideMM'), D = t('maxPartDepthMM');
  if (!bodies.length || !L || !W || !D) rules.push({ id: 'size', level: 'feasible', status: 'unknown', message: 'the part within the largest moulded part', why: bodies.length ? 'the profile has no size limit' : 'no body' });
  else if (!pull) {
    const e = [0, 1, 2].map(k => hi[k] - lo[k]).sort((a, c) => a - c), lim = [D.value, W.value, L.value];
    const fits = e.every((v, k) => v <= lim[k] + 1e-9);
    rules.push({ id: 'size', level: 'feasible', status: fits ? 'pass' : 'unknown', message: `the part (${e.map(v => +v.toFixed(2)).join(' × ')} mm) within the largest moulded part, ${lim.join(' × ')} mm`, value: Math.max(...e.map((v, k) => v / lim[k])), limit: 1, unit: 'ratio', source: L.source, ...(fits ? { why: 'it fits whichever way it is pulled' } : { why: 'it fits no way round its axes as sorted; the depth along the pull decides: give the pull' }) });
  } else {
    const [u, v] = across(pull), ext = bodies.map(x => x.mesh).reduce((e, m) => { const q = extents(m, u, v, pull); return [Math.max(e[0], q[0]), Math.max(e[1], q[1]), Math.max(e[2], q[2])]; }, [0, 0, 0]);
    const a1 = Math.max(ext[0], ext[1]), a2 = Math.min(ext[0], ext[1]), fits = a1 <= L.value + 1e-9 && a2 <= W.value + 1e-9 && ext[2] <= D.value + 1e-9;
    rules.push({ id: 'size', level: 'feasible', status: fits ? 'pass' : 'fail', message: `the part (${+a1.toFixed(2)} × ${+a2.toFixed(2)} across, ${+ext[2].toFixed(2)} mm deep along the pull) within the largest moulded part, ${L.value} × ${W.value} × ${D.value} mm`, value: Math.max(a1 / L.value, a2 / W.value, ext[2] / D.value), limit: 1, unit: 'ratio', source: L.source });
  }
  // IM2 (O78): every face's exact draft against the finish's least; straddling faces wait for the parting line (IM5).
  let field: DraftFace[] | null = null;
  if (!pull || !finish) rules.push({ id: 'draft', level: 'recommended', status: 'unknown', message: 'draft on every face along the pull', why: !pull ? 'no pull direction: the draft is measured along it' : 'no finish: it sets the least draft' });
  else {
    field = draftField(doc, bodies, pull, finish.draftMinDeg).faces;
    const steep = field.filter(f => f.cls === 'steep'), straddle = field.filter(f => f.cls === 'straddle');
    rules.push({ id: 'draft', level: 'recommended', status: steep.length || straddle.length ? 'warn' : 'pass',
      message: `every face's draft (its exact normal) against ${finish.label}'s least, ${finish.draftMinDeg}°${steep.length ? `: ${steep.length} too steep` : ''}${straddle.length ? `; ${straddle.length} straddle the pull (n·d takes both signs: a parting line crosses them, IM5)` : ''}`,
      value: steep.length ? Math.min(...steep.map(f => f.steepestDeg)) : Math.min(...field.map(f => f.steepestDeg)), limit: finish.draftMinDeg, unit: 'deg', source: finish.source, entities: [...steep, ...straddle].map(f => f.face).slice(0, 40) });
  }
  // IM3 (O79): what neither half sees along the pull; freed by a side action across it (warned), or by none (fails).
  let regions: UndercutRegion[] | null = null;
  if (!pull) rules.push({ id: 'undercut', level: 'feasible', status: 'unknown', message: 'undercuts against the pull', why: 'no pull direction: undercuts are what neither half sees along it' });
  else {
    const uc = undercuts(bodies, pull); regions = uc.regions;
    // (O80: the sampling's limit in the message itself — a pass is only as fine as the samples.)
    const limit = `sampled every ≤ ${+uc.coarsestMM.toFixed(3)} mm: an undercut smaller than that may be missed`;
    const stuck = regions.filter(r => !r.sideAction), sided = regions.filter(r => r.sideAction), dirName = (v: readonly number[]) => v.map(x => +x.toFixed(6)).join(', ');
    rules.push({ id: 'undercut', level: 'feasible', status: stuck.length ? 'fail' : sided.length ? 'warn' : 'pass',
      message: (!regions.length ? 'no undercut: every face seen along the pull one way or the other' : `${regions.length} undercut region${regions.length > 1 ? 's' : ''} (${+regions.reduce((a, r) => a + r.areaMM2, 0).toFixed(3)} mm²): ${sided.length ? `${sided.length} freed by a side action (${sided.map(r => `[${dirName(r.sideAction!)}]`).join(', ')})` : ''}${sided.length && stuck.length ? '; ' : ''}${stuck.length ? `${stuck.length} freed by no straight action across the pull (a collapsing core, a lifter or a redesign)` : ''}`) + ` (${limit})`,
      value: regions.reduce((a, r) => a + r.areaMM2, 0), unit: 'mm²', entities: [...new Set(regions.flatMap(r => r.faces))].slice(0, 40) });
  }
  // IM5 (O81): the parting line — the edges between the halves and the isoclines across straddling faces, in loops.
  let parting: PartingReport | null = null;
  if (!pull) rules.push({ id: 'parting', level: 'recommended', status: 'unknown', message: 'the parting line', why: 'no pull direction: the halves part along it' });
  else {
    parting = partingLine(doc, bodies, pull, { ...doc.mould?.sides, ...options.sides });
    const open = parting.loops.filter(l => !l.closed), sum = (v: number) => +v.toFixed(3);
    const loops = parting.loops.map(l => `${l.closed ? '' : 'open, '}${l.flat ? 'flat' : `stepped ${sum(l.rangeMM[0])} … ${sum(l.rangeMM[1])}`}, ${sum(l.lengthMM)} mm`).join('; ');
    rules.push({ id: 'parting', level: 'recommended', status: parting.split.length || open.length || !parting.loops.length ? 'warn' : 'pass',
      message: `${parting.loops.length} parting loop${parting.loops.length === 1 ? '' : 's'}${loops ? ` (${loops})` : ''}${parting.split.length ? `; ${parting.split.length} straddling face${parting.split.length > 1 ? 's' : ''} it crosses along the isocline (${parting.split.map(x => `${x.face} ${sum(x.isoclineMM)} mm`).join(', ')}): each must be split there to mould in two halves — a face split by a curve, not built (the kernel's), or put the whole face in one half (sides)` : ''}${open.length ? `; ${open.length} not closed` : ''}`,
      value: parting.loops.length, unit: 'loops', entities: parting.split.map(x => x.face) });
  }
  return { process: profile.id, direction: pull, rules, mould: { finish: finish?.id ?? null, minDraftDeg: finish?.draftMinDeg ?? null, recDraftDeg: finish ? finish.draftRecDeg ?? finish.draftMinDeg : null, bodies: per.map(x => ({ body: x.key, material: x.material, wallMM: x.range, ...(x.note ? { wallNote: x.note } : {}), shrink: x.shrink })),
    ...(parting ? { parting: { faces: parting.faces.map(f => ({ face: f.face, half: f.half, basis: f.basis })), split: parting.split.map(x => ({ face: x.face, isocline_mm: r6(x.isoclineMM) })), loops: parting.loops.map(l => ({ closed: l.closed, length_mm: r6(l.lengthMM), range_mm: l.rangeMM.map(r6), flat: l.flat, points: l.points.length })) } } : {}),
    walls: wr.map(w => ({ body: w.body, nominal_mm: w.nominalMM === null ? null : r6(w.nominalMM), thinnest_mm: w.thinnestMM === null ? null : r6(w.thinnestMM), thick95_mm: w.thick95MM === null ? null : r6(w.thick95MM), ribs: w.ribs.map(r => ({ faces: r.faces, thickness_mm: r6(r.thicknessMM) })), bosses: w.bosses.map(b => ({ outer: b.outer, inner: b.inner, wall_mm: r6(b.wallMM) })), fillets: w.fillets.map(f => ({ face: f.face, radius_mm: r6(f.radiusMM) })), sharp_corners: w.sharp.length, thick: w.thick ? { faces: w.thick.faces, area_mm2: r6(w.thick.areaMM2), max_mm: r6(w.thick.maxMM) } : null })),
    ...(regions ? { undercuts: regions.map(r => ({ body: r.body, faces: r.faces, area_mm2: r6(r.areaMM2), centroid: r.centroid.map(r6) as Vec3, side_action: r.sideAction, best_share: r6(r.best.clearShare) })) } : {}),
    ...(field ? { draft: field.map(f => ({ body: f.body, face: f.face, cls: f.cls, min_deg: r6(f.minDeg), max_deg: r6(f.maxDeg), steepest_deg: r6(f.steepestDeg), side: f.side, below_mm2: r6(f.belowMM2), area_mm2: r6(f.areaMM2), ...(f.isocline ? { isocline_points: f.isocline.length } : {}) })) } : {}) } };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0, r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
function rule(id: string, level: 'feasible' | 'recommended', met: boolean, message: string, value: number, limit: number, unitName: string, source: string, entities?: string[]): PrintRule {
  return { id, level, status: met ? 'pass' : level === 'feasible' ? 'fail' : 'warn', message, value, limit, unit: unitName, source, ...(entities ? { entities } : {}) };
}
type Per = { key: string; ext: [number, number, number]; over: ReturnType<typeof overhangOf>; material: ReturnType<typeof materialData> };
/**
 * Warp, corner lift (peer, D74): long continuous footprints in a material that shrinks, the more solid the first layer
 * the more stress — warp = warpRisk × (the footprint's longest extent / Lref) × (bed contact / the footprint's box).
 * A heuristic, sourced by the profile's Lref; warned above 0.5; the worst body's.
 */
function warpRule(per: readonly Per[], profile: ProcessProfile): PrintRule {
  const lref = profile.thresholds.warpLrefMM;
  let worst: { key: string; w: number } | null = null, unknownWhy = '';
  for (const x of per) {
    if (x.material?.warpRisk === undefined) { unknownWhy = x.material ? `${x.material.label} has no warp risk` : 'the body\'s material is not set'; continue; }
    const box = x.ext[0] * x.ext[1], solid = box > 0 ? Math.min(1, x.over.bedMM2 / box) : 0;
    const w = x.material.warpRisk * (Math.max(x.ext[0], x.ext[1]) / lref.value) * solid;
    if (!worst || w > worst.w) worst = { key: x.key, w };
  }
  if (!worst) return { id: 'warp', level: 'recommended', status: 'unknown', message: 'warp (corner lift)', why: unknownWhy || 'no body' };
  return { id: 'warp', level: 'recommended', status: worst.w > 0.5 ? 'warn' : 'pass', message: 'warp (corner lift), a heuristic: warpRisk × (longest footprint / Lref) × solid first-layer fraction — above 0.5, a brim, an enclosure, rounded corners or another orientation', value: worst.w, limit: 0.5, unit: 'ratio', source: lref.source, entities: [worst.key] };
}
/** Tipping or lifting (peer, D74): tall on a small contact — height / √(bed contact) against the profile's ratio; powder: n/a. */
function tipRule(per: readonly Per[], profile: ProcessProfile): PrintRule {
  const ratio = profile.thresholds.tipRatio;
  if (!ratio) return { id: 'tip', level: 'recommended', status: 'n/a', message: 'tipping', why: `${profile.label} does not tip: the part lies in powder` };
  let worst: { key: string; r: number } | null = null;
  for (const x of per) { const r = x.over.bedMM2 > 0 ? x.ext[2] / Math.sqrt(x.over.bedMM2) : Infinity; if (!worst || r > worst.r) worst = { key: x.key, r }; }
  if (!worst) return { id: 'tip', level: 'recommended', status: 'unknown', message: 'tipping', why: 'no body' };
  return { id: 'tip', level: 'recommended', status: worst.r > ratio.value ? 'warn' : 'pass', message: worst.r === Infinity ? 'nothing flat rests on the bed: a brim, a raft or another orientation' : 'height over √(bed contact): tall on a small foot may lift or tip — a brim or another orientation', value: worst.r, limit: ratio.value, unit: 'ratio', source: ratio.source, entities: [worst.key] };
}
export const worstOf = (rules: readonly PrintRule[]): RuleStatus => rules.reduce<RuleStatus>((w, r) => RANK[r.status] > RANK[w] ? r.status : w, 'n/a');
