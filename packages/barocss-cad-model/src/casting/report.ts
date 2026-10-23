// IM8a (O106): casting's process rules in the manufacturability report — die casting and sand casting, each limit by the
// material's casting family (`castFamily`: zinc, aluminium, magnesium, copper, steel), read off a public page or derived
// from one by a stated rule (the profile's `page`), never assumed. The pull is the mould's (as moulding, doc.mould.pull);
// the thinnest wall (IM4's ray) against the family's least and typical; every face's exact draft (IM2) against the
// family's least (fails) and achievable (warns); the general tolerance where a page gives it. A family with no value read
// for the process is unknown and said so.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { partMaterial } from '../app/bodies';
import { materialData, type CastFamily, type ProcessProfile, type ProcessThreshold } from '../library/materials';
import { castingProfileOf, hasCastingRules, noCastingRules } from '../engine/castingRuleRows';
import { wallsOf } from '../mould/walls';
import { draftField, type DraftFace } from '../mould/draft';
import type { PrintabilityReport, PrintRule } from '../print/rules';
import { solidification, type Solidification } from './solidification';
import { machinedFaces, machiningOf, machiningView, partExtent, shrinkByDimension, shrinkOf, shrinkView, type MachiningAllowance, type ShrinkAllowance } from './allowances';
import { r3, r6 } from '../util/round';

export type CastingProcess = 'die-casting' | 'sand-casting';
export const CASTING_PROCESSES: readonly CastingProcess[] = ['die-casting', 'sand-casting'];
/** The casting summary: the material and its family, and the tolerance where one is read. */
export interface CastingSummary {
  readonly material: string | null; readonly family: CastFamily | null;
  readonly tolerance: { readonly mm: number; readonly source: string; readonly page: string } | null;
  /** The faces under the least draft, and under the achievable one (by name). */
  readonly steep: readonly string[]; readonly underRecommended: readonly string[];
  /** IM8b (O108): the pattern's shrinkage and the machining allowance (null: not known), and the faces it goes on. */
  readonly shrink: ShrinkAllowance | null; readonly machining: MachiningAllowance | null; readonly machined: readonly string[];
  /** IM8c (O109): the distance field's hot spots, their feeding from the gate, the grid. */
  readonly solidification: Solidification | null;
}

/** O108's simplification said: one factor by the largest extent; each dimension's own band, where they differ. */
const bandNote = (by: readonly { axis: string; factor: number; band: string }[]) => `; a simplification: one factor by the largest extent — a pattern maker may scale each dimension by its own band${new Set(by.map(d => d.factor)).size > 1 ? ` (${by.map(d => `${d.axis} ${d.factor}, ${d.band}`).join('; ')})` : ''}`;
const unit = (v: readonly number[]): [number, number, number] => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
/** A family's threshold, or the process's own for every family (sand casting's draft). */
const limitOf = (profile: ProcessProfile, family: CastFamily, key: string): ProcessThreshold | undefined => profile.thresholds[`${family}${key}`] ?? profile.thresholds[key[0].toLowerCase() + key.slice(1)];
const pageOf = (t: ProcessThreshold) => t.page?.url ?? t.source;
const faceNames = (fs: readonly DraftFace[]) => fs.map(f => f.face).slice(0, 40);

/**
 * O-G6 (the GPU lane's draft map): a cast part's least and achievable draft (degrees) by its alloy's family — the limits
 * the casting report's draft rule judges by — with their pages; null when the material, its family or the limit is not
 * known (the report then says why). One material for the part, as the report takes it.
 */
export function castingDraftLimits(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile): { minDeg: number; recDeg: number | null; source: string } | null {
  profile = castingProfileOf(doc, profile.id) ?? profile; // (O7c: the limits are the document's rows.)
  const { id } = partMaterial(doc, bodies), family = id ? materialData(id)?.castFamily ?? null : null;
  const dMin = family ? limitOf(profile, family, 'DraftMinDeg') : undefined, dRec = family ? limitOf(profile, family, 'DraftRecDeg') : undefined;
  return dMin ? { minDeg: dMin.value, recDeg: dRec?.value ?? null, source: pageOf(dMin) } : null;
}

/** The casting report for a die- or sand-casting profile; `direction` overrides the mould's pull. */
export function castability(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, options: { direction?: readonly number[] } = {}): PrintabilityReport {
  // (O7c: the limits and allowances are the document's rows; with none, each rule reading them is unknown, and says why.)
  profile = castingProfileOf(doc, profile.id) ?? profile;
  const rules: PrintRule[] = hasCastingRules(doc, profile.id) ? [] : [{ id: 'casting-rules', level: 'feasible', status: 'unknown', message: noCastingRules(profile.id), why: 'none is built in: the person loads their foundry\'s rules' }];
  // The material: one for the part, its casting family the library's.
  const { id, mixed } = partMaterial(doc, bodies), m = id ? materialData(id) : undefined;
  const family = m?.castFamily ?? null;
  const has = (k: string) => !!family && !!limitOf(profile, family, k);
  if (!m) rules.push({ id: 'material', level: 'feasible', status: 'unknown', message: 'the material (its casting family sets the limits)', why: mixed ? 'the bodies are of different materials' : 'the material is not set (set_material, or the brief\'s stated material): none is assumed' });
  else if (!family) rules.push({ id: 'material', level: 'feasible', status: 'fail', message: `${m.label} is not a casting alloy here (no casting family): choose a casting alloy for ${profile.label.toLowerCase()}`, entities: bodies.map(b => b.key) });
  else if (!has('WallMinMM') && !has('DraftMinDeg')) rules.push({ id: 'material', level: 'feasible', status: 'unknown', message: `${m.label}: a ${family} alloy`, why: `no ${profile.label.toLowerCase()} limit for a ${family} alloy was read from a public page: set yours, or ask your caster` });
  else rules.push({ id: 'material', level: 'feasible', status: 'pass', message: `${m.label}: a ${family} alloy, cast to its ${profile.label.toLowerCase()} limits` });
  const noFamily = !m ? 'the material is not set' : !family ? `${m.label} is not a casting alloy` : null;
  // The pull: the mould opens along it (as moulding's).
  const pullIn = options.direction ?? doc.mould?.pull, pull = pullIn ? unit(pullIn) : null;
  rules.push(pull ? { id: 'pull', level: 'feasible', status: 'pass', message: `the pull direction (the mould opens along it): ${pull.map(v => +v.toFixed(6)).join(', ')}` }
    : { id: 'pull', level: 'feasible', status: 'unknown', message: 'the pull direction', why: 'no pull direction is given or set (the mould\'s opening): none is assumed' });
  // Walls: the thinnest against the family's least (fails) and typical (warns).
  const walls = wallsOf(doc, bodies, 0.6), thin = walls.filter(w => w.thinnestMM !== null).sort((a, b) => a.thinnestMM! - b.thinnestMM!)[0];
  const wMin = family ? limitOf(profile, family, 'WallMinMM') : undefined, wRec = family ? limitOf(profile, family, 'WallRecMM') : undefined;
  if (!thin) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: 'the thinnest wall', why: 'no wall measured' });
  else if (!wMin) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: `the thinnest wall, ${r3(thin.thinnestMM!)} mm`, why: noFamily ?? `no least wall for a ${family} alloy in ${profile.label.toLowerCase()} was read: set yours, or ask your caster` });
  else {
    const w = thin.thinnestMM!, below = w < wMin.value - 1e-9, under = !below && !!wRec && w < wRec.value - 1e-9;
    rules.push({ id: 'wall', level: below ? 'feasible' : 'recommended', status: below ? 'fail' : under ? 'warn' : 'pass',
      message: `the thinnest wall, ${r3(w)} mm, against a ${family} alloy's least ${wMin.value} mm${wRec ? ` and typical ${wRec.value} mm` : ''}`, value: r3(w), limit: under ? wRec!.value : wMin.value, unit: 'mm', source: pageOf(under ? wRec! : wMin), entities: [thin.body] });
  }
  // Draft: every face's exact draft along the pull, against the family's least (fails) and achievable (warns).
  const dMin = family ? limitOf(profile, family, 'DraftMinDeg') : undefined, dRec = family ? limitOf(profile, family, 'DraftRecDeg') : undefined;
  let steep: DraftFace[] = [], underRec: DraftFace[] = [];
  if (!pull || !dMin) rules.push({ id: 'draft', level: 'recommended', status: 'unknown', message: 'draft on every face along the pull', why: !pull ? 'no pull direction: the draft is measured along it' : noFamily ?? `no least draft for a ${family} alloy in ${profile.label.toLowerCase()} was read: set yours, or ask your caster` });
  else {
    const field = draftField(doc, bodies, pull, dMin.value).faces;
    steep = field.filter(f => f.cls === 'steep');
    const straddle = field.filter(f => f.cls === 'straddle');
    underRec = dRec ? draftField(doc, bodies, pull, dRec.value).faces.filter(f => f.cls === 'steep' && !steep.some(s => s.face === f.face && s.body === f.body)) : [];
    const least = field.length ? Math.min(...field.map(f => f.steepestDeg)) : 0;
    rules.push({ id: 'draft', level: steep.length ? 'feasible' : 'recommended', status: steep.length ? 'fail' : straddle.length || underRec.length ? 'warn' : 'pass',
      message: `every face's draft (its exact normal), the least ${r3(least)}°, against a ${family} alloy's least ${dMin.value}°${dRec ? ` and achievable ${dRec.value}°` : ''}${steep.length ? `: ${steep.length} under the least` : ''}${underRec.length ? `; ${underRec.length} under the achievable` : ''}${straddle.length ? `; ${straddle.length} straddle the pull (a parting line crosses them, IM5)` : ''}`,
      value: r3(least), limit: steep.length || !dRec ? dMin.value : dRec.value, unit: 'deg', source: pageOf(steep.length || !dRec ? dMin : dRec), entities: faceNames([...steep, ...underRec, ...straddle]) });
  }
  // IM8b (O108): the pattern's allowances — the shrinkage it is scaled by, the machining allowance on the faces marked machined.
  const size = bodies.length ? partExtent(bodies).largestMM : 0;
  const shrink = family && bodies.length ? shrinkOf(doc, profile, family, size) : null;
  if (!shrink) rules.push({ id: 'shrink', level: 'recommended', status: 'unknown', message: 'the pattern\'s shrinkage', why: noFamily ?? 'no body' });
  else if (!shrink.ok) rules.push({ id: 'shrink', level: 'recommended', status: 'unknown', message: 'the pattern\'s shrinkage', why: shrink.why });
  else rules.push({ id: 'shrink', level: 'recommended', status: 'pass', message: `the pattern scaled ${r6(1 + shrink.ratio)} (${shrink.basis === 'set' ? 'your shrinkage' : `${shrink.label}, ${shrink.band}: the part's largest ${r3(size)} mm`})${shrink.basis === 'table' ? bandNote(shrinkByDimension(doc, profile, family!, bodies)) : ''}`, value: r6(1 + shrink.ratio), unit: 'ratio', ...(shrink.page ? { source: shrink.page } : {}) });
  const marked = machinedFaces(doc, bodies), flat = marked.found.filter(f => f.flat), curved = marked.found.filter(f => !f.flat);
  const machining = family && bodies.length ? machiningOf(doc, profile, family, size) : null;
  if (!marked.found.length && !marked.missing.length) rules.push({ id: 'machining-allowance', level: 'recommended', status: 'n/a', message: 'no face is marked machined (set_casting machined): no machining allowance' });
  else if (marked.missing.length) rules.push({ id: 'machining-allowance', level: 'feasible', status: 'fail', message: `[CASTING_FACE] marked machined but not on the part: ${marked.missing.join(', ')}`, entities: marked.missing });
  else if (!machining || !machining.ok) rules.push({ id: 'machining-allowance', level: 'recommended', status: 'unknown', message: `the machining allowance on ${marked.found.length} face${marked.found.length === 1 ? '' : 's'}`, why: machining ? machining.why : noFamily ?? 'no body', entities: marked.found.map(f => f.name) });
  else rules.push({ id: 'machining-allowance', level: 'recommended', status: curved.length ? 'unknown' : 'pass',
    message: `${machining.mm} mm on ${flat.length} flat face${flat.length === 1 ? '' : 's'} (${machining.basis === 'set' ? 'your allowance' : `${machining.label}, ${machining.band}`})${curved.length ? `; ${curved.length} curved (${curved.map(f => f.name).join(', ')}) take none here` : ''}`,
    value: machining.mm, unit: 'mm', ...(machining.page ? { source: machining.page } : {}), entities: marked.found.map(f => f.name), ...(curved.length ? { why: 'only flat faces are moved out by the allowance (offset-face)' } : {}) });
  // IM8c (O109): where it freezes last (the distance field's hot spots), whether each is fed from the gate, and how steep its section changes are.
  const sol = bodies.length ? solidification(bodies, doc.casting?.gate ?? null) : null;
  if (!sol || !sol.hotSpots.length) rules.push({ id: 'hot-spots', level: 'recommended', status: 'unknown', message: 'where the casting freezes last', why: sol ? 'no hot spot resolved on the grid' : 'no body' });
  else { const big = sol.hotSpots[0]; rules.push({ id: 'hot-spots', level: 'recommended', status: 'pass', message: `${sol.hotSpots.length} hot spot${sol.hotSpots.length === 1 ? '' : 's'} (where it freezes last: the largest inscribed balls), the largest r ${big.radiusMM} mm at (${big.at.join(', ')}), modulus ≈ ${big.modulusMM} mm (an estimate from its shape, a ${big.shape}: within ${big.modulusRangeMM[0]} … ${big.modulusRangeMM[1]} mm, r/3 … r); grid ${sol.grid.h} mm`, value: big.radiusMM, unit: 'mm' }); }
  if (!sol || !sol.hotSpots.length) rules.push({ id: 'feeding', level: 'recommended', status: 'unknown', message: 'the hot spots fed from the gate', why: 'no hot spot' });
  else if (!sol.gate) rules.push({ id: 'feeding', level: 'recommended', status: 'unknown', message: 'the hot spots fed from the gate', why: 'no gate is set (set_casting gate: where the metal comes in): feeding is judged from it, none is assumed' });
  else {
    const isolated = sol.hotSpots.filter(x => !x.fed);
    rules.push({ id: 'feeding', level: 'recommended', status: isolated.length ? 'warn' : 'pass',
      message: isolated.length ? `[SHRINK_POROSITY] ${isolated.length} hot spot${isolated.length === 1 ? '' : 's'} not fed from the gate through sections at least as thick (Chvorinov: they freeze last, cut off): ${isolated.map(x => `r ${x.radiusMM} mm at (${x.at.join(', ')})`).join('; ')} — feed ${isolated.length === 1 ? 'it' : 'them'} (a riser, a gate there) or make the way thicker`
        : `every hot spot (${sol.hotSpots.length}) fed from the gate at (${sol.gate.join(', ')}) through sections at least as thick`, value: isolated.length, unit: 'hot spots' });
  }
  const ratioMax = profile.thresholds.sectionRatioMax, nominal = walls.filter(w => w.nominalMM !== null).map(w => w.nominalMM!)[0];
  if (!sol || !nominal) rules.push({ id: 'section-change', level: 'recommended', status: 'unknown', message: 'the thickest section against the nominal wall', why: 'no wall measured' });
  else if (!ratioMax) rules.push({ id: 'section-change', level: 'recommended', status: 'unknown', message: `the thickest section, ${r3(2 * sol.maxRadiusMM)} mm, against the nominal wall, ${r3(nominal)} mm`, why: `no ${profile.label.toLowerCase()} section-change ratio was read from a public page` });
  else {
    const ratio = 2 * sol.maxRadiusMM / nominal;
    rules.push({ id: 'section-change', level: 'recommended', status: ratio > ratioMax.value + 1e-9 ? 'warn' : 'pass', message: `the thickest section (2r = ${r3(2 * sol.maxRadiusMM)} mm) against the nominal wall (${r3(nominal)} mm): ${r3(ratio)} : 1, against ${ratioMax.value} : 1${ratio > ratioMax.value + 1e-9 ? ' — a wedge between the unequal sections, or two castings' : ''}`, value: r3(ratio), limit: ratioMax.value, unit: 'ratio', source: pageOf(ratioMax) });
  }
  // Tolerance: the family's general linear tolerance where a page gives one.
  const tol = family ? limitOf(profile, family, 'TolMM') : undefined;
  rules.push(tol ? { id: 'tolerance', level: 'recommended', status: 'pass', message: `a ${family} alloy holds about ±${tol.value} mm (${tol.page?.label ?? tol.description})`, value: tol.value, unit: 'mm', source: pageOf(tol) }
    : { id: 'tolerance', level: 'recommended', status: 'unknown', message: 'the general tolerance', why: noFamily ?? `no ${profile.label.toLowerCase()} tolerance for a ${family} alloy was read from a public page: ask your caster` });
  const casting: CastingSummary = { material: id, family, tolerance: tol ? { mm: tol.value, source: tol.source, page: pageOf(tol) } : null, steep: faceNames(steep), underRecommended: faceNames(underRec),
    shrink: shrink?.ok ? shrinkView(shrink) : null, machining: machining?.ok ? machiningView(machining) : null, machined: marked.found.filter(f => f.flat).map(f => f.name), solidification: sol };
  return { process: profile.id, direction: pull, rules, casting };
}
