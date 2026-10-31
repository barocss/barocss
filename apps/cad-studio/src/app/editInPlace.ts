import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import { placeBody, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { placementOf } from '@barocss/cad-model/engine/placement';
import { editDefinition, sharing } from '@barocss/cad-model/assembly/definitions';
import type { HeldLook } from '@barocss/cad-model/assembly/looks';

// Roadmap 10 ⑧: a part edited in place inside its assembly. The Studio's working document becomes the instance's definition document (the part's own
// coordinates, every tool as it is); the assembly waits here, and the other parts are drawn around it, ghosted, where they are relative to it.

/** The undo and redo stacks, rollback marker and unsaved flag of the assembly, kept while its part is edited. */
export interface AssemblySaved { undo: { doc: StudioDoc; marker: number | null }[]; redo: { doc: StudioDoc; marker: number | null }[]; marker: number | null; dirty: boolean }

export interface InPlaceSession {
  /** The placed instance edited (a pattern's occurrence stands for its seed). */
  owner: string; name: string;
  /** How many instances share the definition (itself included). */
  shared: number;
  /** The assembly as it was when the session began, and the part as it was placed in it. */
  assembly: StudioDoc; base: StudioDoc;
  /** The assembly's other bodies in the part's coordinates: see-through context, never picked. */
  context: BodyResult[];
  saved: AssemblySaved;
}

type Rows = readonly number[];
const mulMat = (a: Rows, b: Rows): number[] => { const o = Array<number>(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j]; return o; };
const turnVec = (m: Rows, v: Rows): [number, number, number] => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const transpose = (m: Rows): number[] => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/**
 * Where a body of the assembly stands in the edited part's coordinates: the inverse of the edited instance's placement after the other
 * instance's own placement (`other` absent: a body of the assembly itself). x ↦ m·x + t.
 */
export function contextTransform(edited: PartInstance, other?: PartInstance): { m: number[]; t: [number, number, number] } {
  const e = placementOf(edited), inv = transpose(e.m), back = turnVec(inv, e.t), o = other ? placementOf(other) : { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] as [number, number, number] };
  const t = turnVec(inv, o.t);
  return { m: mulMat(inv, o.m), t: [t[0] - back[0], t[1] - back[1], t[2] - back[2]] };
}

const copied = (b: BodyResult): BodyResult => ({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } });
/** The assembly's own bodies and its other visible instances' (`instanceBodies`: placed, in the assembly's coordinates), in the edited part's coordinates. */
export function inPlaceContext(assembly: StudioDoc, owner: string, own: readonly BodyResult[], instanceBodies: ReadonlyMap<string, { bodies: BodyResult[] }>): BodyResult[] {
  const edited = (assembly.instances ?? []).find(i => i.id === owner);
  if (!edited) return [];
  const out: BodyResult[] = [], base = contextTransform(edited);
  for (const b of own) out.push(placeBody(copied(b), base.m, base.t));
  // (The placed lane's bodies are already in the assembly's coordinates, like the assembly's own: all take the edited part's inverse placement only.)
  for (const i of assembly.instances ?? []) {
    const entry = i.id === owner || i.hidden ? undefined : instanceBodies.get(i.id);
    if (!entry) continue;
    for (const b of entry.bodies) out.push(placeBody(copied(b), base.m, base.t));
  }
  return out;
}

/** Why a part cannot be edited in place now, or null. `owner` is a selected instance id (a path into a sub-assembly has a `/`). */
export function editInPlaceRefusal(assembly: StudioDoc, owner: string, state: { session: boolean; working: boolean; fresh: boolean; elsewhere?: string | null }): string | null {
  if (state.session) return 'Finish or cancel the part being edited first.';
  if (owner.includes('/')) return 'A part inside a sub-assembly is edited through its sub-assembly.';
  if (!(assembly.instances ?? []).some(i => i.id === owner)) return 'That part is not placed any more.';
  if (state.working) return 'Finish or cancel the running command, sketch, drawing or render first.';
  if (state.elsewhere) return `Wait for ${state.elsewhere} to finish: it would land in the part being edited.`;
  if (!state.fresh) return 'The part has not finished computing, or does not compute: wait for it or fix it first.';
  return null;
}

/** The session for `owner`, or why not. */
export function beginInPlace(assembly: StudioDoc, owner: string, own: readonly BodyResult[], instanceBodies: ReadonlyMap<string, { bodies: BodyResult[] }>, saved: AssemblySaved): InPlaceSession | null {
  const inst = (assembly.instances ?? []).find(i => i.id === owner);
  if (!inst) return null;
  const seed = inst.pattern ? (assembly.instances ?? []).find(i => i.id === assembly.instancePatterns?.find(p => p.id === inst.pattern!.id)?.seed) ?? inst : inst;
  return { owner, name: seed.name, shared: seed.part ? sharing(assembly, seed.part.id).length : 1, assembly, base: inst.doc, context: inPlaceContext(assembly, owner, own, instanceBodies), saved };
}

/** Whether the part is not as it was placed. */
export const sessionChanged = (s: InPlaceSession, doc: StudioDoc): boolean => doc !== s.base && JSON.stringify(doc) !== JSON.stringify(s.base);

/** Finish: the assembly with the part taken (one commit), or the assembly as it was when nothing changed. */
export function finishInPlace(s: InPlaceSession, doc: StudioDoc): { doc: StudioDoc; held: HeldLook[]; changed: boolean } | { error: string } {
  return sessionChanged(s, doc) ? editDefinition(s.assembly, s.owner, doc) : { doc: s.assembly, held: [], changed: false };
}

/** The notice for an action the session does not allow, or null (null session: everything is allowed). */
export const inPlaceBlock = (s: InPlaceSession | null, doing: string): string | null => s ? `Finish or cancel editing ${s.name} before ${doing}.` : null;

/** The undo and redo stacks the assembly has after the session: one more step when the part was taken, else as they were. */
export function stacksAfter(s: InPlaceSession, changed: boolean): Pick<AssemblySaved, 'undo' | 'redo'> {
  return changed ? { undo: [...s.saved.undo.slice(-49), { doc: s.assembly, marker: s.saved.marker }], redo: [] } : { undo: s.saved.undo, redo: s.saved.redo };
}

/** What else is running that would land in the part being edited (or the assembly), or null: the reason Edit part waits. */
export const elsewhereOf = (r: { chat: boolean; importing: boolean; projectOpening: boolean }): string | null =>
  r.chat ? 'the chat turn' : r.importing ? 'the import' : r.projectOpening ? 'a project file that is opening' : null;
/** Whether a file, import or link check arriving now may replace or touch the document: never while a part is edited in place. */
export const openAccepted = (session: object | null | undefined): boolean => !session;
/** The version log a finished chat turn brought back, to be merged into the project's: none when the turn moved (its versions belong to the other document). */
export function versionsToMerge<T>(moved: boolean, versions: T | undefined): T | undefined { return moved ? undefined : versions; }

/** Whether a chat turn that began on `began` ends on another document (an edited part started or ended meanwhile): its changes are not applied. */
export const turnMoved = (began: object | null | undefined, now: object | null | undefined): boolean => (began ?? null) !== (now ?? null);
