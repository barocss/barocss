// Instance looks (roadmap row 10 ①, #2233): a placed part's bodies look as its definition says (the part's own colours, face
// colours, material, hidden), and one occurrence may set its own on top (PartInstance.looks). The effective look is the
// occurrence's field, else the definition's; each field says which it is. Overrides are keyed by the definition's look key
// (`b3`, `b3_negative`) and, for a part inside a sub-assembly, by its path first (`p2/b3`); they outlive a new revision
// of the part: one whose body the revision no longer has is held (listed, never dropped, never aimed at another body).
import type { BodyLook, InstanceLook, ModelNode, PartInstance, StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { lookKey, rootOf } from '../app/lookKey';
import { refOf } from '../app/bodyRef';
import { bodyKeyFor, featureId, featureIdsOf, nodeIndexOf, serialOf } from '../engine/ids';
import { leafBodies } from '../engine/doc';
import { flatFaceOf, serialOriginOf, splitPart } from '../engine/occurrences';
import { refusal } from '../engine/refusal';
import { MATERIALS } from '../library/materials';
import { drivenRefusal, expandPatterns } from './patterns';

/** Where a field of an effective look comes from. */
export type LookSource = 'definition' | 'occurrence';
/** A body's look as one occurrence shows it: the effective fields, and where each comes from. */
export interface EffectiveLook extends InstanceLook {
  from: { color?: LookSource; material?: LookSource; hidden?: LookSource; faces?: Record<string, LookSource> };
}
/** The fields an override has. */
export const LOOK_FIELDS = ['color', 'material', 'hidden', 'faces'] as const;
export type LookField = typeof LOOK_FIELDS[number];

const COLOUR = /^#[0-9a-f]{6}$/i;
/** The key of an override: the path of the nested part (if any), then the body's look key. */
export const lookPathKey = (path: readonly string[], key: string): string => path.length ? `${path.join('/')}/${key}` : key;
const splitKey = (full: string): { path: string[]; key: string } => { const at = full.lastIndexOf('/'); return at < 0 ? { path: [], key: full } : { path: full.slice(0, at).split('/'), key: full.slice(at + 1) }; };

/** The occurrences from the host down to the part at `path` (null when the path leads to no part). */
function chainOf(host: PartInstance, path: readonly string[]): PartInstance[] | null {
  const out = [host]; let at = host;
  for (const id of path) { const n = at.doc.instances?.find(i => i.id === id); if (!n) return null; out.push(n); at = n; }
  return out;
}

/**
 * The layers over a definition's own looks that apply to the part at `path` under `host`, lowest first: a sub-assembly's own
 * saved overrides of its nested part (definition side), then the host occurrence's (this occurrence's).
 */
function layersOf(chain: readonly PartInstance[], path: readonly string[]): { source: LookSource; looks: Record<string, InstanceLook>; prefix: string }[] {
  const out: { source: LookSource; looks: Record<string, InstanceLook>; prefix: string }[] = [];
  for (let j = chain.length - 1; j >= 0; j--) {
    const l = chain[j].looks; if (!l) continue;
    out.push({ source: j === 0 ? 'occurrence' : 'definition', looks: l, prefix: j === chain.length - 1 ? '' : `${path.slice(j).join('/')}/` });
  }
  return out;
}

/** The effective look of the body `key` of the part at `path` under `host` (path empty: the host's own bodies). */
function resolve(chain: readonly PartInstance[], path: readonly string[], key: string): EffectiveLook {
  const base: BodyLook = chain[chain.length - 1].doc.bodies?.[key] ?? {};
  const out: EffectiveLook = { from: {} };
  const take = (source: LookSource, o: InstanceLook | undefined) => {
    if (!o) return;
    if (o.color !== undefined) { out.color = o.color; out.from.color = source; }
    if (o.material !== undefined) { out.material = o.material; out.from.material = source; }
    if (o.hidden !== undefined) { out.hidden = o.hidden; out.from.hidden = source; }
    if (o.faces) for (const [f, c] of Object.entries(o.faces)) { (out.faces ??= {})[f] = c; (out.from.faces ??= {})[f] = source; }
  };
  take('definition', base);
  for (const layer of layersOf(chain, path)) take(layer.source, layer.looks[layer.prefix + key]);
  return out;
}

/**
 * A body's look as this occurrence shows it, and where each field comes from. `body` is a body of the part's own
 * evaluation (its key names the look); `path` the nested part inside a sub-assembly (empty: the occurrence's own bodies).
 */
export function instanceLookOf(inst: PartInstance, body: BodyResult, path: readonly string[] = []): EffectiveLook {
  const chain = chainOf(inst, path);
  if (!chain) return { from: {} };
  return resolve(chain, path, lookKey(chain[chain.length - 1].doc.nodes, body));
}
/** The same by the look key (`b3`, or `p2/b3` for a nested part: the path is split off). */
export function instanceLookByKey(inst: PartInstance, key: string): EffectiveLook {
  const k = splitKey(key), chain = chainOf(inst, k.path);
  return chain ? resolve(chain, k.path, k.key) : { from: {} };
}

/**
 * The part's document with this occurrence's looks applied to its bodies map: every reader of a body's material or colour
 * (the BOM, mass, the drawing, 3MF) then reads the occurrence's. The very document when no look is set anywhere above it.
 */
export function looksDocOf(host: PartInstance, path: readonly string[] = []): StudioDoc {
  const chain = chainOf(host, path);
  if (!chain) return host.doc;
  const last = chain[chain.length - 1].doc, layers = layersOf(chain, path);
  const keys = new Set<string>();
  for (const l of layers) for (const k of Object.keys(l.looks)) { if (l.prefix === '' ? !k.includes('/') : k.startsWith(l.prefix) && !k.slice(l.prefix.length).includes('/')) keys.add(k.slice(l.prefix.length)); }
  if (!keys.size) return last;
  const bodies: Record<string, BodyLook> = { ...last.bodies };
  for (const key of keys) {
    const e = resolve(chain, path, key), was = bodies[key] ?? {}, next: BodyLook = { ...was };
    if (e.color !== undefined) next.color = e.color; if (e.material !== undefined) next.material = e.material; if (e.hidden !== undefined) next.hidden = e.hidden;
    if (e.faces) next.faces = e.faces;
    bodies[key] = next;
  }
  return { ...last, bodies };
}

/** A copy of the document `d` (a resolved or evaluated form of the occurrence's part) with this occurrence's looks over its bodies' map; `d` itself when none is set. */
export function withInstanceLooks(d: StudioDoc, host: PartInstance): StudioDoc {
  const looked = looksDocOf(host);
  return looked === host.doc ? d : { ...d, bodies: looked.bodies };
}
/** The part's document with only the occurrence's material overrides over it (colours and visibility left out): what a material digest reads. */
export function materialLooksDocOf(host: PartInstance): StudioDoc {
  const looked = looksDocOf(host);
  if (looked === host.doc) return host.doc;
  const bodies: Record<string, BodyLook> = { ...host.doc.bodies };
  for (const [k, l] of Object.entries(looked.bodies ?? {})) if (l.material !== host.doc.bodies?.[k]?.material) bodies[k] = { ...host.doc.bodies?.[k], material: l.material };
  return Object.keys(bodies).length === Object.keys(host.doc.bodies ?? {}).length && Object.keys(bodies).every(k => bodies[k] === host.doc.bodies?.[k]) ? host.doc : { ...host.doc, bodies };
}
/** What of the occurrence's looks reaches the material of a nested part (the keys under a path): the materials only, for a freshness digest. */
export const nestedMaterialLooks = (host: PartInstance): [string, string][] => Object.entries(host.looks ?? {}).filter(([k, l]) => k.includes('/') && l.material !== undefined).map(([k, l]) => [k, l.material!]);

/** Where each body of an occurrence's evaluated nodes comes from: the nested part's path and its look key (the folded keys of a sub-assembly undone). */
export interface LookTarget { path: string[]; key: string }
/**
 * Each body's target: `nodes` are the nodes the bodies were evaluated from (the occurrence placed — placedDoc — or unplaced — placedBase —
 * both carry the part's own features first), `body.ref` the feature and side. Done once per evaluation; resolve with `looksOf`.
 */
export function lookTargetsOf(host: PartInstance, nodes: readonly ModelNode[], bodies: readonly BodyResult[]): LookTarget[] {
  return bodies.map(b => {
    if (!/^b\d+(_.+)?$/.test(b.key)) return { path: [], key: b.key };
    const ref = refOf(b), root = rootOf(nodes, ref.node), s = serialOf(featureId(nodes, root));
    const side = ref.side === 'negative' || ref.side.startsWith('part') ? ref.side : 'solid';
    if (s < 0) return { path: [], key: lookKey(nodes, b) };
    const at = serialOriginOf(host.doc, s);
    return { path: at.path, key: `b${at.serial}${side === 'solid' ? '' : `_${side}`}` };
  });
}
/** The effective looks of bodies by their targets. */
export const looksOf = (host: PartInstance, targets: readonly LookTarget[]): EffectiveLook[] => targets.map(t => { const chain = chainOf(host, t.path); return chain ? resolve(chain, t.path, t.key) : { from: {} }; });

/**
 * The same looks for the folded meshes of a sub-assembly: a nested part's face colours are named in its own faces (`n1.side0`); the fold
 * names them by its shifted ids, so each face name is carried through the fold (the part's definition's and the occurrence's alike).
 * What draws or writes the folded bodies (the viewers, 3MF) reads these; the panel lists `looksOf`'s, in the part's own names.
 */
export function looksOnFold(host: PartInstance, targets: readonly LookTarget[]): EffectiveLook[] {
  return looksOf(host, targets).map((l, k) => {
    const path = targets[k].path;
    if (!l.faces || !path.length) return l;
    const faces: Record<string, string> = {}, from: Record<string, LookSource> = {};
    for (const [name, c] of Object.entries(l.faces)) { const at = flatFaceOf(host.doc, path, name) ?? name; faces[at] = c; if (l.from.faces?.[name]) from[at] = l.from.faces[name]; }
    return { ...l, faces, from: { ...l.from, faces: from } };
  });
}

// ---- Editing --------------------------------------------------------------------------------------------------

/** What may be set on an occurrence's body look; `null` for a field clears it (back to the definition's). */
export interface InstanceLookPatch { color?: string | null; material?: string | null; hidden?: boolean | null; faces?: Record<string, string | null> }
export interface SetInstanceLookOptions { part: string; body: string; patch: InstanceLookPatch }
export interface ResetInstanceLookOptions { part: string; body: string; /** One field, or `face:<name>` for one face colour; left out: every field of this body. */ field?: LookField | `face:${string}` }

function target(doc: StudioDoc, o: { part: string; body: string }): { inst: PartInstance; full: string; path: string[]; key: string } {
  const instances = doc.instances ?? [], names = instances.map(i => i.id).join(', ') || 'none';
  if (typeof o.part !== 'string' || typeof o.body !== 'string' || !o.body) throw refusal('VALUE', 'A look is set on a part and one of its bodies: {"part": "<part id>", "body": "<body key, as the part lists it>"}.');
  const p = splitPart(o.part), b = splitKey(o.body), inst = instances.find(i => i.id === p.host);
  if (!inst) throw refusal('NO_PART', `No part "${o.part}"; parts: ${names}${o.part === 'base' ? ' (the base part\'s looks are its own: set them on its bodies)' : ''}.`);
  const path = [...p.path, ...b.path], chain = chainOf(inst, path);
  if (!chain) { throw refusal('VALUE', `${inst.name} (${inst.id}) has no part "${path.join('/')}" inside it${inst.doc.instances?.length ? ` (its parts: ${inst.doc.instances.map(i => i.id).join(', ')})` : ' (it holds no parts)'}.`); }
  const last = chain[chain.length - 1];
  if (!keyExists(last.doc, b.key)) throw refusal('VALUE', `${last.name} (${path.length ? `${inst.id}/${path.join('/')}` : inst.id}) has no body "${b.key}": the keys are those its bodies are listed by (partLooks, get_assembly).`);
  return { inst, full: lookPathKey(path, b.key), path, key: b.key };
}
/**
 * The look keys the part's bodies have: each visible body (a feature nothing builds on, a split's side, a member) by the feature it
 * was first made by and its side — what an evaluation keys them by, found from the features alone.
 */
export function lookKeysOf(doc: StudioDoc): Set<string> {
  const out = new Set<string>();
  // (A suppressed feature neither consumes what it is built on nor makes a body: left in place by index, as a sketch is, which does neither.)
  const live = doc.nodes.map(n => n.suppressed ? { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [0, 0] } as unknown as typeof n : n);
  for (const ref of leafBodies(live)) {
    const root = rootOf(doc.nodes, ref.node);
    out.add(bodyKeyFor(doc.nodes, root, ref.side === 'negative' || ref.side.startsWith('part') ? ref.side : 'solid'));
  }
  return out;
}
/** Whether a body key can name a body of the document: the feature it is first made by is there and is a solid. */
function keyExists(doc: StudioDoc, key: string): boolean {
  const m = /^b(\d+)(?:_(.+))?$/.exec(key);
  if (!m) return true;
  const at = nodeIndexOf(doc.nodes, `n${m[1]}`);
  return at >= 0 && doc.nodes[at].kind !== 'sketch';
}
/** Whether a face name can name a face of the part: every feature it names is in the part. */
const faceExists = (doc: StudioDoc, name: string): boolean => { const ids = featureIdsOf(name); return ids.length > 0 && ids.every(id => nodeIndexOf(doc.nodes, id) >= 0); };
function checked(patch: InstanceLookPatch, who: string): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw refusal('VALUE', `${who}: the look to set is an object: {color?, material?, hidden?, faces?}.`);
  for (const k of Object.keys(patch)) if (!(LOOK_FIELDS as readonly string[]).includes(k)) throw refusal('VALUE', `${who}: "${k}" is not a look field; the fields are ${LOOK_FIELDS.join(', ')}.`);
  const colour = (v: unknown, what: string) => { if (typeof v !== 'string' || !COLOUR.test(v)) throw refusal('VALUE', `${who}: ${what} must be a colour like "#d9534f" (or null for the definition's), not ${JSON.stringify(v)}.`); };
  if (patch.color != null) colour(patch.color, 'the colour');
  if (patch.material != null && !MATERIALS.some(m => m.id === patch.material)) throw refusal('VALUE', `${who}: no material "${String(patch.material)}"; the materials: ${MATERIALS.map(m => m.id).join(', ')}.`);
  if (patch.hidden != null && typeof patch.hidden !== 'boolean') throw refusal('VALUE', `${who}: "hidden" is true or false (or null for the definition's), not ${JSON.stringify(patch.hidden)}.`);
  if (patch.faces !== undefined) {
    if (!patch.faces || typeof patch.faces !== 'object' || Array.isArray(patch.faces)) throw refusal('VALUE', `${who}: "faces" is an object of face name to colour.`);
    for (const [f, c] of Object.entries(patch.faces)) if (c !== null) colour(c, `face ${f}'s colour`);
  }
}
/** The instances with one occurrence's looks replaced (the property dropped when none is left); patterns follow. */
function withLooks(doc: StudioDoc, id: string, looks: Record<string, InstanceLook>): StudioDoc {
  const instances = (doc.instances ?? []).map(i => { if (i.id !== id) return i; const { looks: _was, ...rest } = i; void _was; return Object.keys(looks).length ? { ...rest, looks } : rest; });
  return expandPatterns({ ...doc, instances });
}
const clean = (l: InstanceLook): InstanceLook => { const o: InstanceLook = { ...l }; if (o.faces && !Object.keys(o.faces).length) delete o.faces; return o; };

/**
 * set_part_look: this occurrence's own look for a body: the fields given (`null` clears one). A body of a part inside a
 * sub-assembly is named `p2/b3` (or `part: "sub1/p2"`). Refused for an occurrence a pattern places (set it on the seed).
 */
export function setInstanceLook(doc: StudioDoc, o: SetInstanceLookOptions): { doc: StudioDoc } {
  const t = target(doc, o), who = `${t.inst.name} (${t.inst.id})`;
  const driven = drivenRefusal(doc, t.inst.id, 'set the look on its seed, or edit the pattern.');
  if (driven) throw driven;
  checked(o.patch, who);
  const owner = chainOf(t.inst, t.path)![chainOf(t.inst, t.path)!.length - 1];
  for (const f of Object.keys(o.patch.faces ?? {})) if (!faceExists(owner.doc, f)) throw refusal('VALUE', `${who}: body ${t.key} has no face "${f}": a face is named by its feature, like "n1.top".`);
  const looks = { ...t.inst.looks }, next: InstanceLook = { ...looks[t.full] };
  for (const f of ['color', 'material', 'hidden'] as const) { const v = o.patch[f]; if (v === undefined) continue; if (v === null) delete next[f]; else (next as Record<string, unknown>)[f] = v; }
  if (o.patch.faces) { const faces = { ...next.faces }; for (const [f, c] of Object.entries(o.patch.faces)) { if (c === null) delete faces[f]; else faces[f] = c; } next.faces = faces; }
  const kept = clean(next);
  if (Object.keys(kept).length) looks[t.full] = kept; else delete looks[t.full];
  return { doc: withLooks(doc, t.inst.id, looks) };
}

/** Several bodies' looks of one occurrence at once: each key (`b3`, `p2/b3`) set to its patch, or reset to the definition's when `null`. */
export function setInstanceLooks(doc: StudioDoc, part: string, looks: Record<string, InstanceLookPatch | null>): { doc: StudioDoc } {
  if (!looks || typeof looks !== 'object' || Array.isArray(looks)) throw refusal('VALUE', '"looks" is an object of body key to a look {color?, material?, hidden?, faces?} (null: back to the definition\'s).');
  let next = doc;
  for (const [body, patch] of Object.entries(looks)) next = (patch === null ? resetInstanceLook(next, { part, body }) : setInstanceLook(next, { part, body, patch })).doc;
  return { doc: next };
}

/** reset: one field (or face colour) of an occurrence's look back to the definition's, or all of the body's. */
export function resetInstanceLook(doc: StudioDoc, o: ResetInstanceLookOptions): { doc: StudioDoc } {
  const t = target(doc, o), who = `${t.inst.name} (${t.inst.id})`;
  const driven = drivenRefusal(doc, t.inst.id, 'reset the look on its seed, or edit the pattern.');
  if (driven) throw driven;
  const looks = { ...t.inst.looks }, had = looks[t.full];
  if (!had) return { doc };
  const f = o.field;
  if (f === undefined) delete looks[t.full];
  else if (typeof f === 'string' && f.startsWith('face:')) {
    const name = f.slice(5), faces = { ...had.faces }; delete faces[name];
    const next = clean({ ...had, faces }); if (!Object.keys(faces).length) delete next.faces;
    if (Object.keys(next).length) looks[t.full] = next; else delete looks[t.full];
  } else if ((LOOK_FIELDS as readonly string[]).includes(f as string)) {
    const next = { ...had }; delete next[f as LookField];
    if (Object.keys(next).length) looks[t.full] = next; else delete looks[t.full];
  } else throw refusal('VALUE', `${who}: no look field "${String(f)}"; the fields are ${LOOK_FIELDS.join(', ')}, or face:<name>.`);
  return { doc: withLooks(doc, t.inst.id, looks) };
}

// ---- Revisions ------------------------------------------------------------------------------------------------

/** An override whose body is not in the part any more: kept (never dropped, never aimed at another body), with why in words. */
export interface HeldLook { part: string; body: string; problem: string }
function heldOf(inst: PartInstance, docOf: StudioDoc): HeldLook[] {
  const out: HeldLook[] = [];
  for (const full of Object.keys(inst.looks ?? {})) {
    const k = splitKey(full), who = `${inst.name} (${inst.id})`;
    let at = docOf, why: string | null = null;
    for (const id of k.path) { const n = at.instances?.find(i => i.id === id); if (!n) { why = `this revision of ${inst.name} has no part "${id}" inside it`; break; } at = n.doc; }
    // (By the keys the revision's bodies have, side included: a vanished split side, or a body another one absorbed, is held, not re-aimed.)
    if (!why && /^b\d+(_.+)?$/.test(k.key) && !lookKeysOf(at).has(k.key)) why = `this revision of ${k.path.length ? `${k.path.join('/')} in ${inst.name}` : inst.name} has no body ${k.key}`;
    if (why) out.push({ part: inst.id, body: full, problem: `The look set on ${who} for body ${full} is held: ${why}. It stays on the occurrence and shows again if a later revision has that body.` });
  }
  return out;
}
/** The overrides of the document that match no body of their part now (after a revision was accepted). */
export const heldLooks = (doc: StudioDoc): HeldLook[] => (doc.instances ?? []).flatMap(i => i.looks ? heldOf(i, i.doc) : []);
/** The overrides that would be held if the waiting revision of definition `id` were accepted (listed when it is offered, before it is taken). */
export function heldByRevision(doc: StudioDoc, id: string): HeldLook[] {
  const p = doc.pendingParts?.[id];
  return p ? (doc.instances ?? []).filter(i => i.part?.id === id).flatMap(i => i.looks ? heldOf(i, p.doc) : []) : [];
}

/** A look as the occurrence's override says, for listing: its key, the override, and the held problem if its body is gone. */
export function instanceLooksListing(doc: StudioDoc, part: string): { body: string; look: InstanceLook; held?: string }[] {
  const inst = (doc.instances ?? []).find(i => i.id === part);
  if (!inst) throw refusal('NO_PART', `No part "${part}"; parts: ${(doc.instances ?? []).map(i => i.id).join(', ') || 'none'}.`);
  const held = new Map(heldOf(inst, inst.doc).map(h => [h.body, h.problem]));
  return Object.entries(inst.looks ?? {}).map(([body, look]) => ({ body, look, ...(held.has(body) ? { held: held.get(body)! } : {}) }));
}
