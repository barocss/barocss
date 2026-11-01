// Assembly instruction steps (roadmap 10 ⑥): an ordered explanation of how the assembly goes together. Each step introduces some
// top-level occurrences (`add`: pattern copies and whole sub-assemblies included), may recommend a camera and a display-only explode
// scale. PRESENTATION ONLY: nothing here changes a placement, a mate, a body, the BOM or an export, and no consumer reads it but the
// viewer's Steps panel. Step k's state is: installed = what steps before k introduce, active = what step k introduces, waiting = the
// rest of the placed parts; the base part is always shown. A part in no step is shown at the last step only (and reported).
// A step that names a part that is gone is kept and reported, never renamed to another part: occurrence ids are stable (patterns.ts).
import type { AssemblyStep, StudioDoc } from '../engine/doc';
import { refusal } from '../engine/refusal';
import { nextFreeId } from '../util/ids';
import type { Edited } from './edit';

type Tuple3 = [number, number, number];
const finite3 = (v: unknown): v is Tuple3 => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x));
/** The largest explode scale a step records (the studio's Explode button goes 0, 0.5, 1, 2). */
export const MAX_STEP_EXPLODE = 2;
/** A step as it is named in words: its name and id. */
export const nameOfStep = (s: Pick<AssemblyStep, 'id' | 'name'>) => s.name ? `${s.name} (${s.id})` : s.id;
const nameOfPart = (doc: Pick<StudioDoc, 'instances'>, id: string) => { const i = doc.instances?.find(x => x.id === id); return i ? `${i.name} (${id})` : id; };

/** The steps of a document (none: an empty list). */
export const stepsOf = (doc: Pick<StudioDoc, 'assemblySteps'>): readonly AssemblyStep[] => doc.assemblySteps ?? [];

/** Why a recommended view is not one (plain words), or undefined. */
function viewProblem(who: string, v: unknown): string | undefined {
  const o = v as { eye?: unknown; target?: unknown; up?: unknown } | null;
  if (!o || typeof o !== 'object' || !finite3(o.eye) || !finite3(o.target) || !finite3(o.up)) return `${who}: the view is {eye, target, up}, each [x, y, z] in mm.`;
  if (Math.hypot(o.eye[0] - o.target[0], o.eye[1] - o.target[1], o.eye[2] - o.target[2]) < 1e-9) return `${who}: the eye is at the target, so the view looks at nothing.`;
  if (!o.up.some(x => x !== 0)) return `${who}: up is [x, y, z], not all zero.`;
  return undefined;
}
/** Why a step's own values are not good (plain words naming it), or undefined: what Open refuses a file over. */
export function assemblyStepShapeProblem(step: AssemblyStep): string | undefined {
  if (!step || typeof step !== 'object' || typeof step.id !== 'string' || !step.id) return 'Each assembly step has an id.';
  const who = `Step ${nameOfStep(step)}`;
  if (typeof step.name !== 'string' || !step.name.trim()) return `${who}: a step has a name.`;
  if (step.note !== undefined && typeof step.note !== 'string') return `${who}: the note is text.`;
  if (!Array.isArray(step.add) || step.add.some(t => typeof t !== 'string' || !t)) return `${who}: add lists the placed parts it introduces, by id.`;
  if (step.view !== undefined) { const why = viewProblem(who, step.view); if (why) return why; }
  if (step.explode !== undefined && !(typeof step.explode === 'number' && step.explode >= 0 && step.explode <= MAX_STEP_EXPLODE)) return `${who}: the explode scale is a number from 0 to ${MAX_STEP_EXPLODE}, not ${String(step.explode)}.`;
  return undefined;
}
/**
 * The first problem among a document's steps' own values, those inside sub-assemblies' documents too, for Open: undefined when sound. A
 * repeated step id, or a part in two steps, is one (a part is introduced once). A part that is gone is not: the file keeps the step
 * and `assemblyStepProblems` reports it.
 */
export function assemblyStepsProblem(doc: Pick<StudioDoc, 'instances' | 'assemblySteps'>, depth = 0): string | undefined {
  const steps = doc.assemblySteps;
  if (steps !== undefined) {
    if (!Array.isArray(steps)) return 'The model\'s assemblySteps is a list of steps.';
    const ids = new Set<string>(), held = new Map<string, AssemblyStep>();
    for (const s of steps) {
      const why = assemblyStepShapeProblem(s); if (why) return why;
      if (ids.has(s.id)) return `Step ${s.id} is listed twice.`;
      ids.add(s.id);
      for (const part of s.add) {
        const other = held.get(part);
        if (other) return `${part} is in ${other === s ? `step ${nameOfStep(s)} twice` : `step ${nameOfStep(other)} and step ${nameOfStep(s)}`}: a part is introduced in one step.`;
        held.set(part, s);
      }
    }
  }
  if (depth < 8 && Array.isArray(doc.instances)) for (const i of doc.instances) { const why = i && typeof i === 'object' && i.doc ? assemblyStepsProblem(i.doc, depth + 1) : undefined; if (why) return why; }
  return undefined;
}

/** The step that introduces an occurrence, with its position (0 is the first step), or undefined when it is in none. */
export function stepOfOccurrence(doc: Pick<StudioDoc, 'assemblySteps'>, id: string): { index: number; step: AssemblyStep } | undefined {
  const steps = stepsOf(doc);
  for (let index = 0; index < steps.length; index++) if (steps[index].add.includes(id)) return { index, step: steps[index] };
  return undefined;
}
/** The step that holds the occurrence, in words ("step Fit (step2) lists it"), or undefined: what stops a part's removal. */
export function stepHolding(doc: Pick<StudioDoc, 'assemblySteps' | 'instances'>, named: (id: string) => boolean): AssemblyStep | undefined {
  return stepsOf(doc).find(s => s.add.some(named));
}
/** The refusal words for removing a part a step lists. */
export const stepHoldWords = (doc: Pick<StudioDoc, 'instances'>, id: string, step: AssemblyStep) => `${nameOfPart(doc, id)} is in step ${nameOfStep(step)}: take it out of that step, or delete the step, first.`;

/** What step `index` shows. Each list is in the order of the steps, then of the step's own list. */
export interface StepState {
  index: number; step: AssemblyStep;
  /** Introduced by the steps before this one (and, at the last step, the parts in no step). */
  installed: string[];
  /** Introduced by this step. */
  active: string[];
  /** The placed parts not shown yet. */
  waiting: string[];
  /** Parts steps up to this one name that are not placed any more (kept, not shown). */
  unresolved: string[];
  /** The placed parts in no step. */
  unassigned: string[];
}
/** The state of step `index` (0 is the first). Pure: the same for next, back and a jump. */
export function stepStateOf(doc: Pick<StudioDoc, 'assemblySteps' | 'instances'>, index: number): StepState {
  const steps = stepsOf(doc);
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) throw refusal('NO_STEP', `No step ${String(index)}; ${steps.length ? `steps run from 0 to ${steps.length - 1}` : 'there are no steps'}.`);
  const placed = new Set((doc.instances ?? []).map(i => i.id)), listed = new Set(steps.flatMap(s => s.add));
  const unassigned = (doc.instances ?? []).map(i => i.id).filter(id => !listed.has(id));
  const installed: string[] = [], active: string[] = [], unresolved: string[] = [];
  steps.forEach((s, k) => { if (k > index) return; for (const id of s.add) (placed.has(id) ? k < index ? installed : active : unresolved).push(id); });
  if (index === steps.length - 1) installed.push(...unassigned);
  const shown = new Set([...installed, ...active]);
  return { index, step: steps[index], installed, active, waiting: [...placed].filter(id => !shown.has(id)), unresolved, unassigned };
}

/** A step that does not say what it should, in words (the assembly check lists each). */
export interface AssemblyStepProblem { step?: string; part?: string; kind: 'missing-part' | 'unlistable-part' | 'unassigned'; message: string }
/** What the steps get wrong about the placed parts now: a part a step names that is gone, and parts in no step. */
export function assemblyStepProblems(doc: Pick<StudioDoc, 'assemblySteps' | 'instances'>): AssemblyStepProblem[] {
  const steps = stepsOf(doc), out: AssemblyStepProblem[] = [];
  if (!steps.length) return out;
  const placed = new Set((doc.instances ?? []).map(i => i.id));
  for (const s of steps) for (const id of s.add) if (id === 'base') out.push({ step: s.id, part: id, kind: 'unlistable-part', message: `Step ${nameOfStep(s)}: base is the base part, always shown: a step does not list it.` });
    else if (id.includes('/')) out.push({ step: s.id, part: id, kind: 'unlistable-part', message: `Step ${nameOfStep(s)}: ${id} is a part inside a sub-assembly: steps list top-level parts only.` });
    else if (!placed.has(id)) out.push({ step: s.id, part: id, kind: 'missing-part', message: `Step ${nameOfStep(s)} names ${id}, which is not placed now: the step keeps it and shows nothing for it. Place the part again, or take it off the step.` });
  const listed = new Set(steps.flatMap(s => s.add)), loose = (doc.instances ?? []).filter(i => !listed.has(i.id));
  if (loose.length) out.push({ kind: 'unassigned', message: `${loose.length} placed part${loose.length > 1 ? 's are' : ' is'} in no step (${loose.map(i => `${i.name} (${i.id})`).join(', ')}): the steps show ${loose.length > 1 ? 'them' : 'it'} only at the last step.` });
  return out;
}

/** Why these parts cannot go in the step `own` (plain words), or undefined: each is a placed top-level part that no other step introduces. */
function partsProblem(doc: StudioDoc, add: readonly string[], own?: string): string | undefined {
  const instances = doc.instances ?? [];
  for (const id of add) {
    if (typeof id !== 'string') return 'Parts are named by id.';
    if (id === 'base') return 'The base part is always shown, so no step introduces it.';
    if (id.includes('/')) return `${id} is a part inside a sub-assembly: put the sub-assembly in a step as a whole.`;
    if (!instances.some(i => i.id === id)) return `No part "${id}" to put in a step; parts: ${instances.map(i => i.id).join(', ') || 'none'}.`;
    const at = stepOfOccurrence(doc, id);
    if (at && at.step.id !== own) return `${nameOfPart(doc, id)} is already in step ${nameOfStep(at.step)}: a part is introduced in one step; take it out of that step first.`;
  }
  return undefined;
}
const copy = (s: AssemblyStep): AssemblyStep => ({ ...s, add: [...s.add], ...(s.view ? { view: { eye: [...s.view.eye], target: [...s.view.target], up: [...s.view.up] } } : {}) });
function withSteps(doc: StudioDoc, steps: AssemblyStep[]): Edited {
  const next: StudioDoc = { ...doc, assemblySteps: steps.length ? steps : undefined };
  if (!steps.length) delete next.assemblySteps;
  return { doc: next, problems: [] };
}
function find(doc: StudioDoc, id: string): AssemblyStep {
  const s = stepsOf(doc).find(x => x.id === id);
  if (!s) throw refusal('NO_STEP', `No step "${String(id)}"; steps: ${stepsOf(doc).map(x => x.id).join(', ') || 'none'}.`);
  return s;
}

/** The longest a step's name and note may be (what the Steps panel's boxes take). */
export const MAX_STEP_NAME = 60, MAX_STEP_NOTE = 500;
/** Why a name or note is too long (plain words), or undefined: the editing ops refuse by this; Open stays tolerant. */
function textProblem(step: AssemblyStep): string | undefined {
  if (step.name.length > MAX_STEP_NAME) return `Step ${nameOfStep({ id: step.id, name: step.name.slice(0, 20) + '…' })}: the name is at most ${MAX_STEP_NAME} characters, not ${step.name.length}.`;
  if (step.note !== undefined && step.note.length > MAX_STEP_NOTE) return `Step ${nameOfStep(step)}: the note is at most ${MAX_STEP_NOTE} characters, not ${step.note.length}.`;
  return undefined;
}

export interface AddAssemblyStepOptions { name?: string; note?: string; add?: string[]; view?: AssemblyStep['view']; explode?: number }
export interface EditAssemblyStepOptions { id: string; name?: string; note?: string | null; add?: string[]; view?: AssemblyStep['view'] | null; explode?: number | null }
/** add_step: a step at the end, introducing the named placed parts (none yet is fine); its id. */
export function addAssemblyStep(doc: StudioDoc, o: AddAssemblyStepOptions): Edited & { id: string } {
  const steps = stepsOf(doc), id = nextFreeId('step', new Set(steps.map(s => s.id)));
  const add = [...new Set(o.add ?? [])], step: AssemblyStep = copy({ id, name: o.name?.trim() || `Step ${steps.length + 1}`, ...(o.note ? { note: o.note } : {}), add, ...(o.view ? { view: o.view } : {}), ...(o.explode !== undefined ? { explode: o.explode } : {}) });
  const why = assemblyStepShapeProblem(step) ?? textProblem(step) ?? partsProblem(doc, add); if (why) throw refusal('VALUE', why);
  return { ...withSteps(doc, [...steps, step]), id };
}
/** edit_step: a step's name, note, parts, view or explode scale changed (each left out: kept; null clears a note, a view or a scale). */
export function editAssemblyStep(doc: StudioDoc, o: EditAssemblyStepOptions): Edited {
  const old = find(doc, o.id), next = copy(old);
  if (o.name !== undefined) next.name = o.name.trim();
  if (o.note === null || o.note === '') delete next.note; else if (o.note !== undefined) next.note = o.note;
  if (o.add !== undefined) next.add = [...new Set(o.add)];
  if (o.view === null) delete next.view; else if (o.view !== undefined) next.view = copy({ ...old, view: o.view }).view;
  if (o.explode === null) delete next.explode; else if (o.explode !== undefined) next.explode = o.explode;
  const why = assemblyStepShapeProblem(next) ?? textProblem(next) ?? (o.add !== undefined ? partsProblem(doc, next.add, old.id) : undefined); if (why) throw refusal('VALUE', why);
  return withSteps(doc, stepsOf(doc).map(s => s === old ? next : s));
}
/** delete_step: the step removed (its parts are in no step then); the placed parts are not touched. */
export function deleteAssemblyStep(doc: StudioDoc, id: string): Edited {
  const old = find(doc, id);
  return withSteps(doc, stepsOf(doc).filter(s => s !== old));
}
/** move_step: the step put at position `to` (0 is first), the others keeping their order. */
export function moveAssemblyStep(doc: StudioDoc, id: string, to: number): Edited {
  const old = find(doc, id), steps = [...stepsOf(doc)];
  if (!Number.isInteger(to) || to < 0 || to >= steps.length) throw refusal('VALUE', `There ${steps.length === 1 ? 'is 1 step' : `are ${steps.length} steps`}: position ${String(to)} is not among them (0 is the first${steps.length > 1 ? `, ${steps.length - 1} the last` : ''}).`);
  steps.splice(steps.indexOf(old), 1); steps.splice(to, 0, old);
  return withSteps(doc, steps);
}
