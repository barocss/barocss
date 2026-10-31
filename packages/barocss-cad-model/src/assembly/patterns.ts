// Patterns of instances (roadmap row 10 ③, RS7.4): a seed instance repeated along a line or about an axis. The pattern
// is the document's (`instancePatterns`); its occurrences are instances regenerated from the seed after every edit
// (expandPatterns), driven — grounded, so no mate moves them — and sharing the seed's part definition, so the BOM, the
// revisions and every export see one part placed `count` times. A mate may hold an occurrence as its fixed side.
import type { InstancePattern, PartInstance, StudioDoc } from '../engine/doc';
import { firstProblem, refusal, type CadModelCode } from '../engine/refusal';
import { axisAngle, clean, DEG, eulerOf, matMul, placementOf, type Mat3 } from '../engine/placement';
import { freshPartId, revisionOf } from './definitions';
import { patternProblem, patternsProblem, PATTERN_MAX, PATTERN_MIN, PATTERN_SPACING_MAX } from './patternCheck';
import { solveDoc, type Edited, type SolveProblem } from './edit';
import { checkPartDelete } from '../frames/skeleton';
import { BASE, type Vec3 } from './mates';
import { hostOf } from '../engine/occurrences';

export { PATTERN_MAX, PATTERN_MIN, PATTERN_SPACING_MAX };

type Tuple3 = [number, number, number];
/** A copy of a vector as given (a value that is not one is left for `check` to refuse). */
const copy3 = <T>(v: T): T => Array.isArray(v) ? [...v] as T : v;
const unit = (v: readonly number[]): Tuple3 => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };

/** The occurrences k = 1 … count − 1 of a pattern, not skipped, as the seed would have them placed. */
function occurrencesOf(seed: PartInstance, p: InstancePattern): PartInstance[] {
  const out: PartInstance[] = [], skip = new Set(p.skip ?? []);
  const u = p.kind === 'linear' ? unit(p.dir) : unit(p.axis), { m, t } = placementOf(seed);
  for (let k = 1; k < p.count; k++) {
    if (skip.has(k)) continue;
    let position: Tuple3, rotation: Tuple3;
    if (p.kind === 'linear') {
      position = [clean(seed.position[0] + k * p.spacing * u[0]), clean(seed.position[1] + k * p.spacing * u[1]), clean(seed.position[2] + k * p.spacing * u[2])];
      rotation = [...seed.rotation];
    } else {
      const R = axisAngle(u, k * p.angle * DEG), d = [t[0] - p.origin[0], t[1] - p.origin[1], t[2] - p.origin[2]];
      position = [0, 1, 2].map(i => clean(R[i * 3] * d[0] + R[i * 3 + 1] * d[1] + R[i * 3 + 2] * d[2] + p.origin[i])) as Tuple3;
      rotation = [...eulerOf(matMul(R, m as Mat3))] as Tuple3;
    }
    out.push({ id: `${p.id}-${k}`, name: `${seed.name} ${k + 1}`, doc: seed.doc, position, rotation, grounded: true, ...(seed.joints ? { joints: seed.joints } : {}), ...(seed.looks ? { looks: seed.looks } : {}), ...(seed.hidden ? { hidden: true } : {}), ...(seed.part ? { part: seed.part } : {}), pattern: { id: p.id, k } });
  }
  return out;
}

/**
 * The document with every pattern's occurrences regenerated from its seed: the old ones removed, the new ones put right
 * after the seed (stable ids `<pattern>-<k>`). A pattern whose seed is gone is dropped.
 */
export function expandPatterns(doc: StudioDoc): StudioDoc {
  const patterns = doc.instancePatterns;
  if (!patterns?.length && !doc.instances?.some(i => i.pattern)) return doc;
  const own = (doc.instances ?? []).filter(i => !i.pattern), live = (patterns ?? []).filter(p => own.some(i => i.id === p.seed));
  // (A pattern that breaks its rules — a file's, a doc built by hand — makes no occurrences: never NaN, never more than PATTERN_MAX.)
  const sound = (p: InstancePattern, seed: PartInstance) => patternProblem(seed.name, p) === undefined;
  const instances = own.flatMap(i => [i, ...live.filter(p => p.seed === i.id && sound(p, i)).flatMap(p => occurrencesOf(i, p))]);
  const out: StudioDoc = { ...doc, instances };
  if (live.length) out.instancePatterns = live.length === patterns!.length ? patterns : live; else delete out.instancePatterns;
  return out;
}

const names = (doc: StudioDoc) => (doc.instancePatterns ?? []).map(p => p.id).join(', ') || 'none';
const nameOf = (doc: StudioDoc, id: string) => { const i = doc.instances?.find(x => x.id === id); return i ? `${i.name} (${id})` : id; };

/** A pattern's values checked, each refusal naming the part and the bound. */
function check(who: string, p: InstancePattern): void {
  const why = patternProblem(who, p);
  if (why) throw refusal('PATTERN_VALUE', why);
}
/** The document's patterns checked together (a copy numbered as a placed part is). */
function checkAll(doc: Parameters<typeof patternsProblem>[0]): void {
  const why = patternsProblem(doc);
  if (why) throw refusal('PATTERN_VALUE', why);
}

// The live fields of the document that name a placed part by id (and so stop its removal): the robot's base, joints and
// frames, the inputs' bindings and the drawing's scope and balloons. The mates and the features (a base frame following a
// part's sketch) are read apart. Past records and text — history, baselines, proposals, the brief — never block.
const REFERRERS: readonly (readonly [string, (doc: StudioDoc) => unknown])[] = [['robot', d => d.robot], ['variability', d => d.variability], ['drawing.scope', d => d.drawing?.scope], ['drawing.balloons', d => (d.drawing as { balloons?: unknown } | undefined)?.balloons]];
const SEPARATORS = /[~/:,\s]/;
/** Where a string in `value` (or a key; a joint's `a~b`, a face's `id/face` read by its parts) satisfies `named`: its path, or undefined. */
function mention(value: unknown, named: (token: string) => boolean, path: string, depth = 0): string | undefined {
  if (typeof value === 'string') return value.split(SEPARATORS).some(named) ? path : undefined;
  if (!value || typeof value !== 'object' || depth > 8) return undefined;
  if (Array.isArray(value)) {
    for (const [i, x] of value.entries()) { const at = mention(x, named, `${path}[${i}]`, depth + 1); if (at) return at; }
    return undefined;
  }
  for (const [k, x] of Object.entries(value)) {
    if (k.split(SEPARATORS).some(named)) return `${path}.${k}`;
    const at = mention(x, named, `${path}.${k}`, depth + 1); if (at) return at;
  }
  return undefined;
}
/** What names a part by id in the document, as words: a mate (its id), or the robot, drawing … field's path; undefined when nothing does. */
function referrerOf(doc: StudioDoc, named: (token: string) => boolean): string | undefined {
  const m = (doc.mates ?? []).find(x => named(hostOf(x.a.part)) || named(hostOf(x.b.part)));
  if (m) return `mate ${m.id}`;
  for (const [path, of] of REFERRERS) { const at = mention(of(doc), named, path); if (at) return at; }
  return undefined;
}

/** What is named in the document stops its removal: a mate or another field that holds one of `gone`. */
function referenced(doc: StudioDoc, gone: readonly PartInstance[], what: string): void {
  for (const o of gone) {
    // (The features: a base frame following a copy's sketch is the part-delete rule's to say.)
    const by = referrerOf(doc, t => t === o.id) ?? firstProblem(checkPartDelete(doc, o.id));
    if (by) throw refusal('PATTERN_REFERENCED', `${what} would remove ${nameOf(doc, o.id)}, and ${/^mate /.test(by) ? `${by} holds it` : /\s/.test(by) ? by : `${by} refers to it`}: change that first.`, { by, part: o.id });
  }
}

/** The least `pat<n>` that no pattern, placed part, mate or other field of the document has or names (a deleted pattern's id is not taken again while a frame still points at its copies). */
function freshPatternId(doc: StudioDoc): string {
  const used = (t: string, id: string) => t === id || t.startsWith(`${id}-`);
  for (let n = 1; ; n++) {
    const id = `pat${n}`;
    if (!(doc.instancePatterns ?? []).some(p => p.id === id) && !(doc.instances ?? []).some(i => used(i.id, id)) && !referrerOf(doc, t => used(t, id))) return id;
  }
}

/** The occurrences `doc` has that `next` no longer has. */
const lost = (doc: StudioDoc, next: StudioDoc) => (doc.instances ?? []).filter(i => i.pattern && !next.instances?.some(x => x.id === i.id));

const find = (doc: StudioDoc, id: string) => {
  const p = doc.instancePatterns?.find(x => x.id === id);
  if (!p) throw refusal('NO_PATTERN', `No pattern "${String(id)}"; patterns: ${names(doc)}.`);
  return p;
};

type Without<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A pattern to add: the seed (an instance id), the count with the seed, and a line or an axis. */
export type AddPatternOptions = Without<InstancePattern, 'id'>;

/** add_pattern: `seed` repeated (its first occurrences k = 1 … count − 1 beside it); the seed becomes a shared definition when it was not. */
export function addInstancePattern(doc: StudioDoc, o: AddPatternOptions): Edited & { id: string } {
  const instances = doc.instances ?? [], seed = instances.find(i => i.id === o.seed);
  if (!seed) throw refusal('PATTERN_VALUE', `No part "${String(o.seed)}" to repeat; parts: ${instances.filter(i => !i.pattern).map(i => i.id).join(', ') || `none (${BASE} is the fixed base part)`}.`);
  if (seed.pattern) throw refusal('PATTERN_VALUE', `${nameOf(doc, seed.id)} is itself occurrence ${seed.pattern.k} of pattern ${seed.pattern.id}: repeat its seed, or edit that pattern.`);
  const was = (doc.instancePatterns ?? []).find(p => p.seed === seed.id);
  if (was) throw refusal('PATTERN_VALUE', `${nameOf(doc, seed.id)} is the seed of pattern ${was.id} already: edit that pattern.`);
  const id = freshPatternId(doc);
  const p = { ...o, id, ...(o.skip?.length ? { skip: [...new Set(o.skip)].sort((a, b) => a - b) } : {}) } as InstancePattern;
  if (!o.skip?.length) delete p.skip;
  if (p.kind === 'linear') p.dir = copy3(p.dir); else if (p.kind === 'circular') { p.axis = copy3(p.axis); p.origin = copy3(p.origin); }
  check(seed.name, p);
  checkAll({ instances, instancePatterns: [...(doc.instancePatterns ?? []), p] });
  // (The occurrences are the seed's part: one definition, so the BOM and the revisions see one part placed count times.)
  const shared = seed.part ? instances : instances.map((i): PartInstance => i === seed ? { ...i, part: { id: freshPartId(doc), rev: revisionOf(i.doc) } } : i);
  return { ...solveDoc({ ...doc, instances: shared, instancePatterns: [...(doc.instancePatterns ?? []), p] }, instances), id };
}

export interface EditPatternOptions { id: string; count?: number; skip?: number[]; spacing?: number; dir?: Vec3; angle?: number; axis?: Vec3; origin?: Vec3 }
/** edit_pattern: a pattern's count, skipped occurrences and line or axis changed (each left out: kept); occurrences a mate holds stay. */
export function editInstancePattern(doc: StudioDoc, o: EditPatternOptions): Edited {
  const old = find(doc, o.id), who = doc.instances?.find(i => i.id === old.seed)?.name ?? old.seed;
  const alien = old.kind === 'linear' ? (['angle', 'axis', 'origin'] as const).filter(k => o[k] !== undefined) : (['spacing', 'dir'] as const).filter(k => o[k] !== undefined);
  if (alien.length) throw refusal('PATTERN_VALUE', `Pattern of ${who}: a ${old.kind} pattern has no ${alien.join(' or ')}${old.kind === 'linear' ? ' (angle, axis and origin are a circular pattern\'s)' : ' (spacing and dir are a linear pattern\'s)'}.`);
  // (A lower count leaves the skipped numbers it no longer has out of the list, unless the same call gives the list.)
  const kept = o.skip !== undefined ? o.skip : o.count !== undefined && Number.isInteger(o.count) ? (old.skip ?? []).filter(k => k < o.count!) : undefined;
  const next = { ...old, ...(o.count !== undefined ? { count: o.count } : {}), ...(kept !== undefined ? { skip: [...new Set(kept)].sort((a, b) => a - b) } : {}),
    ...(old.kind === 'linear' ? { ...(o.spacing !== undefined ? { spacing: o.spacing } : {}), ...(o.dir !== undefined ? { dir: copy3(o.dir) } : {}) } : { ...(o.angle !== undefined ? { angle: o.angle } : {}), ...(o.axis !== undefined ? { axis: copy3(o.axis) } : {}), ...(o.origin !== undefined ? { origin: copy3(o.origin) } : {}) }) } as InstancePattern;
  if (!next.skip?.length) delete next.skip;
  check(who, next);
  const list = doc.instancePatterns!.map(p => p === old ? next : p);
  checkAll({ instances: doc.instances, instancePatterns: list });
  const after = expandPatterns({ ...doc, instancePatterns: list });
  referenced(doc, lost(doc, after), `Changing pattern ${old.id}`);
  return solveDoc(after, doc.instances);
}

/** delete_pattern: the pattern and its occurrences removed (the seed stays); refused while a mate holds an occurrence. */
export function deleteInstancePattern(doc: StudioDoc, id: string): Edited {
  const p = find(doc, id), rest = doc.instancePatterns!.filter(x => x !== p);
  const next: StudioDoc = { ...doc, instancePatterns: rest.length ? rest : undefined };
  if (!rest.length) delete next.instancePatterns;
  const after = expandPatterns(next);
  referenced(doc, lost(doc, after), `Deleting pattern ${p.id}`);
  return solveDoc(after, doc.instances);
}

/** skip_occurrence: one occurrence left out of its pattern (edit_pattern's skip restores it); refused while a mate holds it. */
export function skipOccurrence(doc: StudioDoc, occurrence: string): Edited {
  const inst = doc.instances?.find(i => i.id === occurrence);
  if (!inst?.pattern) throw refusal('NO_PATTERN', `${inst ? nameOf(doc, inst.id) : `"${String(occurrence)}"`} is not an occurrence of a pattern; occurrences: ${(doc.instances ?? []).filter(i => i.pattern).map(i => i.id).join(', ') || 'none'}.`);
  const p = find(doc, inst.pattern.id);
  return editInstancePattern(doc, { id: p.id, skip: [...(p.skip ?? []), inst.pattern.k] });
}

/** Why a part's placement cannot be edited by hand: it is an occurrence the seed drives. */
export function drivenRefusal(doc: StudioDoc, id: string, what: string) {
  const inst = doc.instances?.find(i => i.id === id);
  if (!inst?.pattern) return undefined;
  const seed = doc.instancePatterns?.find(p => p.id === inst.pattern!.id)?.seed ?? '';
  return refusal('PATTERN_DRIVEN', `${nameOf(doc, id)} is occurrence ${inst.pattern.k} of pattern ${inst.pattern.id}, driven by its seed ${nameOf(doc, seed)}: ${what}`);
}

/** The refusal when a mate's two parts are both fixed: an occurrence among them is the pattern's, so the words name it. */
export function bothFixedRefusal(doc: StudioDoc, a: string, b: string, code: CadModelCode, message: string) {
  return drivenRefusal(doc, a, 'it never moves for a mate; mate it as the fixed side to a free part.') ?? drivenRefusal(doc, b, 'it never moves for a mate; mate it as the fixed side to a free part.') ?? refusal(code, message);
}

/** The refusal for deleting a part a pattern holds: an occurrence (skip it, or delete the pattern) or a seed in use. */
export function patternDeleteRefusal(doc: StudioDoc, id: string) {
  const own = drivenRefusal(doc, id, 'skip it (edit_pattern skip) or delete the pattern.');
  if (own) return own;
  const p = doc.instancePatterns?.find(x => x.seed === id);
  return p ? refusal('PATTERN_REFERENCED', `${nameOf(doc, id)} is the seed of pattern ${p.id}: delete that pattern first.`, { pattern: p.id }) : undefined;
}

/** A mate or lock between a copy and its own seed would chase itself (the seed moves the copy, the copy moves the seed): refused. */
export function seedMateRefusal(doc: StudioDoc, a: string, b: string) {
  const [p, q] = [hostOf(a), hostOf(b)];
  for (const [x, y] of [[p, q], [q, p]]) {
    const inst = doc.instances?.find(i => i.id === x);
    if (inst?.pattern && doc.instancePatterns?.find(p => p.id === inst.pattern!.id)?.seed === y) return refusal('PATTERN_DRIVEN', `${nameOf(doc, x)} is a copy of ${nameOf(doc, y)} (pattern ${inst.pattern.id}): a mate between them would chase itself. Mate the copy to another part.`);
  }
  return undefined;
}

/** The mates joined to the pattern's seed and copies, through parts other than the base (the cycle a pattern that does not settle is on). */
function cycleMates(doc: StudioDoc, pattern: string): string[] {
  const seed = doc.instancePatterns?.find(p => p.id === pattern)?.seed, reach = new Set((doc.instances ?? []).filter(i => i.id === seed || i.pattern?.id === pattern).map(i => i.id)), out = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (const m of doc.mates ?? []) {
      const ends = [hostOf(m.a.part), hostOf(m.b.part)];
      if (out.has(m.id) || !ends.some(e => reach.has(e))) continue;
      out.add(m.id); grew = true;
      for (const e of ends) if (e !== BASE) reach.add(e);
    }
  }
  return [...out];
}
/** The problems for patterns that do not settle: each names the pattern and every mate on its cycle (the one that closed it included). */
export function unsettledProblems(doc: StudioDoc, ids: readonly string[]): SolveProblem[] {
  return ids.map(id => { const mates = cycleMates(doc, id); return { mate: mates[0] ?? id, pattern: id, mates, reason: `Pattern ${id} does not settle: the seed moves for ${mates.length > 1 ? 'mates' : 'mate'} ${mates.join(', ')} and its copies move with it, which moves the mated parts again. Delete one of those mates.` }; });
}
/** The refusal for a new mate `id` that leaves a pattern unsettled (the document is left as it was). */
export function unsettledRefusal(problems: readonly SolveProblem[], id: string, doc: StudioDoc, a: string, b: string) {
  const p = problems.find(x => x.pattern && x.mates?.includes(id));
  return p ? refusal('MATE_UNMET', `Mate ${id} (${nameOf(doc, a)} to ${nameOf(doc, b)}) would leave pattern ${p.pattern} unsettled: ${p.reason.replace(/^Pattern \S+ does not settle: /, '')}`, { mate: id }) : undefined;
}
