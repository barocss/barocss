import type { AssemblyCut, StudioDoc } from '@barocss/cad-model/engine/doc';
import { assemblyCutProblem, assemblyCutTrialProblem, type AddAssemblyCutOptions } from '@barocss/cad-model/assembly/cuts';

// Roadmap 10 ⑤: the Assembly cut HUD's values as text (what is typed), and the cut they make. Pure: the HUD, the viewport's
// preview and Apply all go through these, so what is previewed is what is applied.

type Vec3 = [number, number, number];
export const CUT_DIRS = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1] } as const satisfies Record<string, Vec3>;
export type CutAxis = keyof typeof CUT_DIRS;
export interface CutDraft {
  /** The cut being edited, or null for a new one. */
  editing: string | null;
  name: string;
  profile: 'circle' | 'rectangle';
  radius: string; w: string; d: string;
  at: [string, string, string];
  /** The direction as an axis, or 'Custom' for one a chat or a file made (kept as it is until the choice changes). */
  dir: CutAxis | 'Custom';
  custom: Vec3;
  depth: string; through: boolean;
  targets: string[];
}

const axisOf = (v: readonly number[]): CutAxis | 'Custom' => (Object.keys(CUT_DIRS) as CutAxis[]).find(a => CUT_DIRS[a].every((x, k) => x === v[k])) ?? 'Custom';
const text = (v: number) => String(+v.toFixed(6));

/** A new cut on these parts: a Ø10 circle at `at`, going down through. */
export function newCutDraft(targets: readonly string[], at: Vec3 = [0, 0, 0]): CutDraft {
  return { editing: null, name: '', profile: 'circle', radius: '5', w: '10', d: '10', at: [text(at[0]), text(at[1]), text(at[2])], dir: '-Z', custom: [0, 0, -1], depth: '10', through: true, targets: [...targets] };
}
/** The draft of an existing cut (to edit it). */
export function draftOfCut(cut: AssemblyCut): CutDraft {
  const p = cut.profile, rest = { name: cut.name ?? '', at: [text(cut.at[0]), text(cut.at[1]), text(cut.at[2])] as CutDraft['at'], dir: axisOf(cut.dir), custom: [...cut.dir] as Vec3, depth: cut.depth === 'through' ? '10' : text(cut.depth), through: cut.depth === 'through', targets: [...cut.targets] };
  return p.kind === 'circle' ? { editing: cut.id, profile: 'circle', radius: text(p.radius), w: '10', d: '10', ...rest } : { editing: cut.id, profile: 'rectangle', radius: '5', w: text(p.w), d: text(p.d), ...rest };
}

/** The cut a draft makes (its values, as the model takes them), or why it is not one yet. Numbers that are not numbers are refused here, in words. */
export function cutOfDraft(draft: CutDraft): AddAssemblyCutOptions | string {
  const num = (s: string, what: string): number | string => { const v = s.trim() === '' ? NaN : Number(s); return Number.isFinite(v) ? v : `${what} is not a number yet.`; };
  const at = draft.at.map((s, k) => num(s, `Centre ${'XYZ'[k]}`)), size = draft.profile === 'circle' ? [num(draft.radius, 'The radius')] : [num(draft.w, 'The width'), num(draft.d, 'The depth of the rectangle')], depth = draft.through ? 0 : num(draft.depth, 'The depth');
  const bad = [...at, ...size, depth].find(v => typeof v === 'string'); if (typeof bad === 'string') return bad;
  const dir: Vec3 = draft.dir === 'Custom' ? [...draft.custom] : [...CUT_DIRS[draft.dir]];
  return { ...(draft.name.trim() ? { name: draft.name.trim() } : {}), profile: draft.profile === 'circle' ? { kind: 'circle', radius: size[0] as number } : { kind: 'rectangle', w: size[0] as number, d: size[1] as number },
    at: at as Vec3, dir, depth: draft.through ? 'through' : depth as number, targets: [...draft.targets] };
}

/** Why the draft cannot be applied (plain words), or undefined: its numbers, its sizes and its targets, as the model checks them. Cheap: asked on every keystroke. */
export function draftProblem(doc: StudioDoc, draft: CutDraft): string | undefined {
  const o = cutOfDraft(draft); if (typeof o === 'string') return o;
  if (!draft.targets.length) return 'Pick the parts to cut: select them in the Browser or the view.';
  return assemblyCutProblem(doc, { id: draft.editing ?? 'cut-preview', ...o });
}
/** The trial of each draft cut against each document, kept while the document stands. */
const trials = new WeakMap<StudioDoc, Map<string, string | undefined>>();
/**
 * Whether every part the draft cuts still builds with it (never a cut that removes a part): a build of those parts, so it is run off the typing
 * path (a pause after the last change; the model's own add and edit run it again at Apply, which is what gates the commit).
 */
export function draftTrialProblem(doc: StudioDoc, draft: CutDraft): string | undefined {
  const o = cutOfDraft(draft); if (typeof o === 'string' || draftProblem(doc, draft)) return undefined;
  const cut: AssemblyCut = { id: draft.editing ?? 'cut-preview', ...o };
  let known = trials.get(doc); if (!known) trials.set(doc, known = new Map());
  const key = JSON.stringify(cut); if (!known.has(key)) known.set(key, assemblyCutTrialProblem(doc, cut));
  return known.get(key);
}

/** The document the viewport shows while the HUD is open: the draft's cut in place of the one it edits (or added); `doc` itself while it is not a cut yet. */
export function withDraftCut(doc: StudioDoc, draft: CutDraft | null): StudioDoc {
  if (!draft || draftProblem(doc, draft)) return doc;
  const o = cutOfDraft(draft) as AddAssemblyCutOptions, cuts = doc.assemblyCuts ?? [];
  const id = draft.editing ?? 'cut-preview', cut: AssemblyCut = { id, ...o };
  return { ...doc, assemblyCuts: draft.editing ? cuts.map(c => c.id === id ? cut : c) : [...cuts, cut] };
}

/** The parts of the selection a cut can take: top-level placed parts (not a part inside a sub-assembly, not a sub-assembly), by id. */
export function cuttableOf(doc: StudioDoc, selection: readonly string[]): string[] {
  return selection.filter(id => !id.includes('/') && doc.instances?.some(i => i.id === id && !i.doc.instances?.length));
}
/** Where a cut starts on a part: the middle of its box in X and Y, on its top face, going down. */
export function defaultCutAt(bounds: { min: readonly number[]; max: readonly number[] }[]): Vec3 {
  if (!bounds.length) return [0, 0, 0];
  const lo = [0, 1, 2].map(k => Math.min(...bounds.map(b => b.min[k]))), hi = [0, 1, 2].map(k => Math.max(...bounds.map(b => b.max[k])));
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, hi[2]].map(v => +v.toFixed(3)) as Vec3;
}
/** A one-line account of a cut for the Browser: its profile and size, depth and parts. */
export function cutLabel(cut: AssemblyCut, names: (id: string) => string): string {
  const size = cut.profile.kind === 'circle' ? `Ø${+(cut.profile.radius * 2).toFixed(3)}` : `${cut.profile.w} × ${cut.profile.d}`;
  return `${cut.name || cut.id} · ${size} ${cut.depth === 'through' ? 'through' : `× ${cut.depth}`} · ${cut.targets.map(names).join(', ')}`;
}
/** The parts to cut with the selected cuttable ones added: the ones already there kept in order, none twice. */
export const withAddedTargets = (targets: readonly string[], added: readonly string[]): string[] => [...targets, ...added.filter(t => !targets.includes(t))];
