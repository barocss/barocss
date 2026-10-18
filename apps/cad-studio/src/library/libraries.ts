// Part libraries in the studio (LIB2–LIB4, D62–D64). Libraries are data (packages/barocss-cad library.ts); the studio
// keeps the built-in ones and those a team or user adds, inserts a part as a `library` node — its features kept in
// the document, so the part opens without the library — regenerates it when the library is there, and snaps one
// library part onto another by their interfaces: placed exactly (the frames facing), held by real mates on the
// interfaces' faces.
import { checkLibraryFit, instantiateLibraryPart, loadCadLibrary, placeByInterfaces, type CadLibrary, type CadLibraryInterface } from '@barocss/cad';
import { emptyDoc, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../engine/doc';
import { BASE, eulerOf, rotationMatrix, type Mate, type MateKind, type Vec3 } from '../assembly/mates';
import tslot20 from './builtin/tslot-20.json';
import { checkLibraryForSharing, estimateCount, licenseOf, sharingRefusal, type LibraryCheck } from './sharing';

/** Where a library comes from: built into the studio, shared by a team, or the user's own. */
export type LibrarySource = 'built-in' | 'team' | 'user';
/**
 * A loaded library and what is known of it (LIB4, D64): its licence (null: unlicensed, private use only), how many of
 * its values are estimates, who wrote it (an agent's stays marked until a person confirms it), and the check it last
 * passed or failed before sharing.
 */
export interface LibraryEntry {
  readonly library: CadLibrary; readonly source: LibrarySource; readonly license: string | null; readonly estimates: number;
  readonly authoredBy: 'person' | 'agent'; readonly confirmed: boolean; readonly check?: LibraryCheck;
}

const registry = new Map<string, LibraryEntry>();
/** Adds (or replaces) a library: checked on load, refused with its typed error; a built-in's id is not taken over. */
export function registerLibrary(json: unknown, source: LibrarySource, meta: { authoredBy?: 'person' | 'agent'; confirmed?: boolean; check?: LibraryCheck } = {}): CadLibrary {
  const library = loadCadLibrary(json);
  const kept = registry.get(library.manifest.id);
  if (kept && kept.source === 'built-in' && source !== 'built-in') throw new Error(`${library.manifest.id} is a built-in library: give yours another id`);
  const authoredBy = meta.authoredBy ?? 'person';
  registry.set(library.manifest.id, { library, source, license: licenseOf(library), estimates: estimateCount(library), authoredBy, confirmed: authoredBy === 'person' || meta.confirmed === true, ...(meta.check ? { check: meta.check } : {}) });
  if (source === 'user') saveUserLibraries();
  return library;
}
export const libraryEntry = (id: string): LibraryEntry | undefined => registry.get(id);
/** A person confirms an agent's library (it may then be shared, when its check passes). */
export function confirmLibrary(id: string): boolean {
  const e = registry.get(id); if (!e || e.authoredBy !== 'agent') return false;
  registry.set(id, { ...e, confirmed: true }); if (e.source === 'user') saveUserLibraries(); return true;
}
/** The check before sharing, run and kept with the entry. */
export function checkLibrary(id: string): LibraryCheck | null {
  const e = registry.get(id); if (!e) return null;
  const check = checkLibraryForSharing(e.library.manifest);
  registry.set(id, { ...e, check }); return check;
}
/** Why it may not go to the team now (null: it may), its check run first. */
export function shareRefusal(id: string): string | null {
  const e = registry.get(id); if (!e) return `No library ${id}`;
  if (e.source === 'built-in') return `${id} is built in: every studio has it`;
  return sharingRefusal(e.library, e, checkLibrary(id)!);
}

// The user's own libraries, kept in this browser (a convenience: they are files the user has besides).
const USER_KEY = 'barocss-cad-user-libraries';
function saveUserLibraries(): void {
  try { globalThis.localStorage?.setItem(USER_KEY, JSON.stringify([...registry.values()].filter(e => e.source === 'user').map(e => ({ library: e.library.manifest, authoredBy: e.authoredBy, confirmed: e.confirmed })))); } catch { /* storage unavailable */ }
}
/** The user's libraries kept in this browser, loaded again (each refused one skipped, said in the result). */
export function loadUserLibraries(): string[] {
  const problems: string[] = [];
  let kept: { library: unknown; authoredBy?: 'person' | 'agent'; confirmed?: boolean }[] = [];
  try { kept = JSON.parse(globalThis.localStorage?.getItem(USER_KEY) ?? '[]'); } catch { return problems; }
  for (const k of Array.isArray(kept) ? kept : []) { try { registerLibrary(k.library, 'user', { authoredBy: k.authoredBy, confirmed: k.confirmed }); } catch (cause) { problems.push(cause instanceof Error ? cause.message : String(cause)); } }
  return problems;
}
registerLibrary(tslot20, 'built-in');
export const libraries = (): LibraryEntry[] => [...registry.values()];
export const libraryById = (id: string): CadLibrary | undefined => registry.get(id)?.library;
/** Removes a team or user library (built-ins stay). */
export function unregisterLibrary(id: string): boolean { const e = registry.get(id); if (!e || e.source === 'built-in') return false; registry.delete(id); if (e.source === 'user') saveUserLibraries(); return true; }

type LibraryNode = Extract<ModelNode, { kind: 'library' }>;

/**
 * The document's own libraries (an agent's or a person's, D64) registered as user libraries so its parts can be
 * inserted; a refused one is skipped and said. (A library of the same id already registered from elsewhere stays.)
 */
export function registerDocLibraries(doc: StudioDoc): string[] {
  const problems: string[] = [];
  for (const d of doc.libraries ?? []) {
    const kept = registry.get(d.library.id);
    if (kept && kept.source !== 'user') continue;
    if (kept && JSON.stringify(kept.library.manifest) === JSON.stringify(d.library) && kept.confirmed === (d.authoredBy === 'person' || !!d.confirmed)) continue;
    try { registerLibrary(d.library, 'user', { authoredBy: d.authoredBy, confirmed: d.confirmed }); } catch (cause) { problems.push(cause instanceof Error ? cause.message : String(cause)); }
  }
  return problems;
}
/** The document with a library of its own added (an agent's: marked, unconfirmed), its check run; refused when it does not load. */
export function addDocLibrary(doc: StudioDoc, json: unknown, authoredBy: 'agent' | 'person'): { doc: StudioDoc; check: LibraryCheck; license: string | null; estimates: number } {
  const lib = loadCadLibrary(json), manifest = lib.manifest;
  const kept = registry.get(manifest.id);
  if (kept && kept.source !== 'user') throw new Error(`${manifest.id} is a ${kept.source} library: give this one another id`);
  const check = checkLibraryForSharing(manifest);
  const libs = [...(doc.libraries ?? []).filter(l => l.library.id !== manifest.id), { library: manifest, authoredBy, ...(authoredBy === 'agent' ? { confirmed: false } : {}) }];
  registerLibrary(manifest, 'user', { authoredBy, check });
  return { doc: { ...doc, libraries: libs }, check, license: licenseOf(lib), estimates: estimateCount(lib) };
}
/** A person confirms the document's agent-written library. */
export function confirmDocLibrary(doc: StudioDoc, id: string): StudioDoc {
  confirmLibrary(id);
  return { ...doc, libraries: (doc.libraries ?? []).map(l => l.library.id === id ? { ...l, confirmed: true } : l) };
}

/** A prefix for a new library node's features, unused in the document. */
function freshPrefix(doc: StudioDoc): string {
  const used = new Set(doc.nodes.flatMap(n => n.kind === 'library' ? [n.prefix] : []));
  let k = 1; while (used.has(`lib${k}`)) k++;
  return `lib${k}`;
}
/** The library node for a part with these values (its features made now, with `prefix`). */
export function libraryNode(lib: CadLibrary, part: string, options: { variant?: string; params?: Record<string, number> }, prefix: string): LibraryNode {
  const inst = instantiateLibraryPart(lib, part, { ...options, prefix });
  const p = lib.parts.get(part)!.part, variant = options.variant ? p.variants?.find(v => v.id === options.variant) : undefined;
  return { kind: 'library', name: `${p.name}${variant ? ` ${variant.name ?? variant.id}` : ''}`, library: inst.origin, prefix, features: inst.features, outputs: [...inst.outputs], interfaces: [...inst.interfaces], warnings: [...inst.warnings] };
}
/** The document with a library part added to its own feature tree. */
export function insertLibraryPart(doc: StudioDoc, libraryId: string, part: string, options: { variant?: string; params?: Record<string, number> } = {}): StudioDoc {
  registerDocLibraries(doc);
  const lib = libraryById(libraryId);
  if (!lib) throw new Error(`No library ${libraryId} (libraries: ${libraries().map(e => e.library.manifest.id).join(', ')})`);
  return withNode(doc, libraryNode(lib, part, options, freshPrefix(doc)));
}
/** A new assembly instance holding one library part. */
export function libraryInstance(doc: StudioDoc, libraryId: string, part: string, options: { variant?: string; params?: Record<string, number>; name?: string; position?: Vec3; rotation?: Vec3 } = {}): { doc: StudioDoc; id: string } {
  registerDocLibraries(doc);
  const instances = doc.instances ?? [];
  let n = 1; while (instances.some(i => i.id === `p${n}`)) n++;
  const id = `p${n}`, partDoc = insertLibraryPart(emptyDoc(), libraryId, part, options);
  const node = partDoc.nodes[partDoc.nodes.length - 1] as LibraryNode;
  const inst: PartInstance = { id, name: options.name ?? node.name, doc: partDoc, position: options.position ?? [0, 0, 0], rotation: options.rotation ?? [0, 0, 0] };
  return { doc: { ...doc, instances: [...instances, inst] }, id };
}

/**
 * A library node made again from its library (when it is there): the same part, variant and given values (changed by
 * `overrides`), the same prefix — so its face names hold — at the library's version now; null when the library is not
 * loaded (the part keeps the features it has) or nothing changed.
 */
export function regenerateLibraryNode(node: LibraryNode, overrides: { variant?: string | null; params?: Record<string, number> } = {}): LibraryNode | null {
  const lib = libraryById(node.library.library);
  if (!lib) return null;
  // (The values given stay given; the variant's row and every other value come from the library as it is now.)
  const variant = overrides.variant === undefined ? node.library.variant : overrides.variant ?? undefined;
  const next = libraryNode(lib, node.library.part, { ...(variant ? { variant } : {}), params: { ...node.library.params, ...overrides.params } }, node.prefix);
  return JSON.stringify(next) === JSON.stringify(node) ? null : next;
}

/** The library nodes of a part (the base document or an instance's), with their interfaces. */
function interfaceOf(doc: StudioDoc, part: string, id: string): { itf: CadLibraryInterface; node: LibraryNode } | string {
  const pd = part === BASE ? doc : doc.instances?.find(i => i.id === part)?.doc;
  if (!pd) return `no part ${part}`;
  const nodes = pd.nodes.filter((n): n is LibraryNode => n.kind === 'library');
  if (!nodes.length) return `${part} holds no library part`;
  for (const node of nodes) { const itf = node.interfaces.find(x => x.id === id); if (itf) return { itf, node }; }
  return `${part} has no interface ${id} (interfaces: ${nodes.flatMap(n => n.interfaces.map(x => x.id)).join(', ')})`;
}
/** Which mates two interfaces' faces make: flat faces flush, round ones on one axis. */
const MATE_OF: Readonly<Record<string, MateKind>> = { plane: 'coincident', axis: 'concentric' };

/**
 * Part `b` (an instance) snapped onto part `a` by their interfaces (LIB2): their roles must accept each other; b is
 * placed exactly — its interface frame facing a's, moved by `offset` along a's frame — and held by real mates on the
 * faces both interfaces name (flat ones flush, round ones on one axis), which the solver keeps where it was placed.
 */
export function snapByInterfaces(doc: StudioDoc, a: { part: string; interface: string }, b: { part: string; interface: string }, offset: readonly number[] = [0, 0, 0]): { doc: StudioDoc; mates: Mate[] } | { error: string } {
  if (b.part === BASE) return { error: 'The base part stays at the origin: snap an instance onto it' };
  if (a.part === b.part) return { error: 'Snap two different parts' };
  const A = interfaceOf(doc, a.part, a.interface), B = interfaceOf(doc, b.part, b.interface);
  if (typeof A === 'string') return { error: A }; if (typeof B === 'string') return { error: B };
  if (!(A.itf.accepts?.includes(B.itf.role) || B.itf.accepts?.includes(A.itf.role))) return { error: `${A.itf.role} and ${B.itf.role} do not mate (${a.interface} accepts ${A.itf.accepts?.join(', ') || 'nothing'})` };
  const instB = doc.instances!.find(i => i.id === b.part)!;
  if (instB.grounded) return { error: `${instB.name} is grounded: unground it to snap it` };
  // b in a's own coordinates, then into the world by a's placement.
  const p = placeByInterfaces(A.itf, B.itf, offset), instA = a.part === BASE ? null : doc.instances!.find(i => i.id === a.part)!;
  const RA = instA ? rotationMatrix(instA.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1], tA = instA ? instA.position : [0, 0, 0];
  const R: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.push(RA[3 * i] * p.rotation[j] + RA[3 * i + 1] * p.rotation[3 + j] + RA[3 * i + 2] * p.rotation[6 + j]);
  const position = [0, 1, 2].map(i => RA[3 * i] * p.translation[0] + RA[3 * i + 1] * p.translation[1] + RA[3 * i + 2] * p.translation[2] + tA[i]) as Vec3;
  const rotation = eulerOf(R as Parameters<typeof eulerOf>[0]);
  const used = new Set((doc.mates ?? []).map(m => m.id)), mates: Mate[] = [];
  for (const [key, kind] of Object.entries(MATE_OF)) {
    const fa = A.itf.faces?.[key], fb = B.itf.faces?.[key];
    if (!fa || !fb) continue;
    let n = 1; while (used.has(`m${n}`)) n++; used.add(`m${n}`);
    mates.push({ id: `m${n}`, kind, a: { part: a.part, face: fa }, b: { part: b.part, face: fb } });
  }
  if (!mates.length) return { error: `${a.interface} and ${b.interface} name no faces in common to mate (plane, axis)` };
  const instances = doc.instances!.map(i => i.id === b.part ? { ...i, position, rotation } : i);
  return { doc: { ...doc, instances, mates: [...(doc.mates ?? []), ...mates] }, mates };
}

/** A library's declared fits, each built and measured (the library's own tests; LIB2). */
export const checkFits = (lib: CadLibrary) => (lib.manifest.fits ?? []).map(f => checkLibraryFit(lib, f.id));
