import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import { bodiesWithin, hostOf, occurrenceProblem, splitPart } from '@barocss/cad-model/engine/occurrences';

// Roadmap 10 ②c: the Studio's instance selection may hold an occurrence path (`sub1/p2`) beside the top-level ids. These
// are the pure rules for it: which selection entries are hosts, which are nested, the outliner's tree rows, the parts of a
// placed body that light up, and the read-only card. (A nested part is placed by its sub-assembly's definition, so the
// placement actions only ever see the host.)

/** An entry that names a part inside a sub-assembly. */
export const isNestedId = (id: string): boolean => id.includes('/');
/** The top-level instances a selection moves with (a nested path counts as its host), each once. */
export const hostsOf = (selection: readonly string[]): string[] => [...new Set(selection.map(hostOf))];
/** The selection's plain top-level ids only (what a placement action may act on). */
export const topLevelIds = (selection: readonly string[]): string[] => selection.filter(id => !isNestedId(id));
/** The one top-level instance selected (placement actions), undefined for none, several or a nested path. */
export const singleTop = (selection: readonly string[]): string | undefined => selection.length === 1 && !isNestedId(selection[0]) ? selection[0] : undefined;
/** The one nested occurrence path selected, undefined otherwise. */
export const singleNested = (selection: readonly string[]): string | undefined => selection.length === 1 && isNestedId(selection[0]) ? selection[0] : undefined;

/** Whether an instance is a sub-assembly with at least one shown part. */
export const hasNestedParts = (inst: PartInstance): boolean => !!inst.doc.instances?.some(i => !i.hidden);

export interface NestedRow {
  /** The occurrence path from the top-level instance (`sub1/p2`). */
  path: string;
  name: string;
  depth: number;
  /** It is a sub-assembly itself, with shown parts. */
  expandable: boolean;
  open: boolean;
  /** `Block B in Sub`: the part and the sub-assembly path's names above it. */
  label: string;
}

function walkRows(out: NestedRow[], open: ReadonlySet<string>, inst: PartInstance, path: string, names: string[], depth: number): void {
  for (const child of inst.doc.instances ?? []) {
    if (child.hidden) continue;
    const at = `${path}/${child.id}`, expandable = hasNestedParts(child), isOpen = expandable && open.has(at);
    out.push({ path: at, name: child.name, depth, expandable, open: isOpen, label: `${child.name} in ${names.join(' › ')}` });
    if (isOpen) walkRows(out, open, child, at, [...names, child.name], depth + 1);
  }
}
/** The shown parts under a top-level instance, depth first, those of an open (by full path) sub-assembly listed too. */
export function nestedRows(host: PartInstance, open: ReadonlySet<string>): NestedRow[] {
  const out: NestedRow[] = [];
  walkRows(out, open, host, host.id, [host.name], 1);
  return out;
}

/** The instance a nested path names with the names above it, null when it leads to no shown part. */
export function nestedInstance(doc: StudioDoc, path: string): { inst: PartInstance; parent: PartInstance; names: string[] } | null {
  const { host, path: rest } = splitPart(path), top = doc.instances?.find(i => i.id === host);
  if (!top || !rest.length || occurrenceProblem(top.doc, host, rest)) return null;
  const names = [top.name];
  let at = top, parent = top;
  for (const id of rest) { parent = at; at = at.doc.instances!.find(i => i.id === id)!; names.push(at.name); }
  return { inst: at, parent, names };
}

/** The mesh faces' names of a placed body; the one part of BodyResult these rules read. */
interface BodyLike { mesh: { faces: readonly { name: string }[] }; volume: number | null; massRef?: number }
const faceNamesOf = (bodies: readonly BodyLike[]): string[][] => bodies.map(b => b.mesh.faces.map(f => f.name));

/** A host's placed bodies as App holds them: the instance actually evaluated (its document is what the face names follow) and its bodies. */
export interface PlacedEntry { inst: Pick<PartInstance, 'doc'>; bodies: readonly BodyLike[] }

/**
 * Which of the host's placed bodies come from nested path `path` (or from inside it): their indexes. The names are read
 * through the evaluated instance's document, never the current one (an edit may be ahead of the bodies); a document that
 * refuses to flatten yields null (nothing can be said), no bodies yet an empty list.
 */
export function nestedBodyIndexes(path: string, entry: PlacedEntry | undefined): number[] | null {
  if (!entry) return [];
  try { return bodiesWithin(entry.inst.doc, faceNamesOf(entry.bodies), splitPart(path).path); } catch { return null; }
}

/**
 * The selection as the viewport lights it: a top-level id lights the whole instance, a nested path only the host's bodies
 * that come from that part, as `host#bodyIndex` (viewport/instanceSelection.ts reads both). With no nested entry the
 * selection itself comes back (same array), so an unrelated change does not re-set the viewport's instances.
 */
export function viewportInstanceSelection(selection: readonly string[], entryOf: (host: string) => PlacedEntry | undefined): readonly string[] {
  if (!selection.some(isNestedId)) return selection;
  const out = new Set<string>();
  for (const id of selection) {
    if (!isNestedId(id)) { out.add(id); continue; }
    for (const k of nestedBodyIndexes(id, entryOf(hostOf(id))) ?? []) out.add(`${hostOf(id)}#${k}`);
  }
  return [...out];
}

/**
 * The Render panel's target for a selection: a part inside a sub-assembly has no appearance key (it is styled through its
 * host). `mode`: 'default' nothing selected (the default appearance), 'keys' top-level parts, 'disabled' only nested parts
 * (the controls have no target and must not fall back to the default).
 */
export function renderKeysOf(selection: readonly string[]): { keys: string[]; nested: boolean; mode: 'default' | 'keys' | 'disabled' } {
  const keys = topLevelIds(selection).map(id => 'inst:' + id), nested = selection.some(isNestedId);
  return { keys, nested, mode: keys.length ? 'keys' : nested ? 'disabled' : 'default' };
}

export interface NestedCard {
  path: string;
  /** `Sub › Block B`: the host's name down to the part's. */
  title: string;
  bodies: number;
  /** mm³, null while a body's mass is being worked out (or no body is placed yet). */
  volume: number | null;
  /** True while the placed bodies are not there yet. */
  pending: boolean;
  /** The sub-assembly cannot be folded right now: its bodies cannot be attributed to the part. */
  unavailable?: true;
  part?: PartInstance['part'];
  /** Where it sits in the sub-assembly directly above it (read only). */
  placement: { in: string; position: readonly number[]; rotation: readonly number[] };
  /** The sub-assembly whose definition owns it: the top-level instance. */
  host: { id: string; name: string };
}

/** The read-only card of a nested selection; null when the path leads to no shown part. */
export function nestedCard(doc: StudioDoc, path: string, entry: PlacedEntry | undefined): NestedCard | null {
  const found = nestedInstance(doc, path); if (!found) return null;
  const at = nestedBodyIndexes(path, entry), mine = entry && at ? at.map(k => entry.bodies[k]) : [];
  const unknown = !entry || !at || !mine.length || mine.some(b => b.massRef !== undefined);
  return {
    path, title: found.names.join(' › '), bodies: mine.length, pending: !entry, ...(at ? {} : { unavailable: true as const }),
    volume: unknown ? null : mine.reduce((v, b) => v + (b.volume ?? 0), 0),
    ...(found.inst.part ? { part: found.inst.part } : {}),
    placement: { in: found.parent.name, position: found.inst.position, rotation: found.inst.rotation },
    host: { id: hostOf(path), name: found.names[0] },
  };
}
