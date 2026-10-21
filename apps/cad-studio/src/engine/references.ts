// Stored face and edge references with their geometry (A1.3b, A1.3c). Every place the document names a face or
// an edge keeps a compact signature of what it named (`Sig`):
// - a fillet's or chamfer's edges, a shell's open faces, a draft's faces (`node.sigs`, by name; geometry from
//   the feature's parent body);
// - a mate's faces, on the base part or an instance (`sig`; geometry from the part's face table: plane or
//   cylinder, in the part's own coordinates);
// - a drawing dimension's edges (`sig`) and a body's per-face colours (`look.faceSigs`; geometry from the part's
//   bodies).
// Holes and face-anchored sketches store their placement as geometry (a centre and an axis, a DocPlane), not
// as a face's name: nothing to match. Selections an agent holds are not stored in the document (A4's proposals,
// when they hold some, join this list).
//
// - Written: a reference gets its signature when it is written (from what it was picked on).
// - Refreshed: only after an accepted edit went through the prior-document match (engine/rematch.ts), and
//   never for one still marked re-matched; not on open, a plain re-evaluation or a kernel change, so a
//   renumbering that still resolves (to the wrong face) cannot overwrite a good signature.
// - Verified (on open, with no prior document): the one matcher (rematch.ts `matchSignature`) runs against the
//   stored signature. Its clear best being the name stored, the reference stands; another name, it is
//   substituted and marked re-matched (until confirmed). Unclear or gone, it is a problem: the document opens,
//   the feature holding it is held (suppressed, with the reason) so the rest builds, and the user picks.
import { frameFace, type FaceTable, type MateFace } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { bodyKeyFor } from './ids';
import { prefixDoc, type ModelNode, type StudioDoc } from './doc';
import { rememberedEvaluate } from './evalMemo';
import type { BodyResult, EvalResult } from './evaluate';
import { matchSignature, rankAlike, signaturesOf, type Signature } from './rematch';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

/** A stored signature (rounded: positions to 1e-6 mm, directions to 1e-9, sizes to 1e-6). */
export interface Sig { k: string; p: Vec3; d?: Vec3; s: number; r?: number }
const round = (x: number, q: number) => Math.round(x / q) * q;
const r3 = (v: Vec3, q: number): Vec3 => [round(v[0], q), round(v[1], q), round(v[2], q)];
export const toSig = (s: Signature): Sig => ({ k: s.kind, p: r3(s.at, 1e-6), ...(s.dir ? { d: r3(s.dir, 1e-9) } : {}), s: round(s.size, 1e-6), ...(s.radius !== undefined ? { r: round(s.radius, 1e-9) } : {}) });
export const fromSig = (s: Sig): Signature => ({ kind: s.k, at: s.p, dir: s.d ?? null, size: s.s, ...(s.r !== undefined ? { radius: s.r } : {}) });

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
type Tables = (part: string) => FaceTable | undefined;

/** One stored reference: what it names, and where its geometry is. */
export interface Ref {
  where: string; edge: boolean; name: string; sig?: Sig; rematched: boolean;
  /** `node`: that feature's parent body; `part`: that part's face table (a mate); neither: the part's bodies. */
  node: number | null; parent?: { node: number; side: string }; part?: string;
  /** The name it had before a re-match (while marked). */
  was?: string;
  /** Names it `to` (its stored signature kept), marked re-matched or not. */
  rename(to: string, mark: boolean): void;
  setSig(sig: Sig): void;
  /** Its re-match confirmed: the mark gone. */
  clear(): void;
}

type Named = { sigs?: Record<string, Sig>; rematched?: Record<string, string> };
type Pointed = { sig?: Sig; was?: string };

/** The list of names a feature references (its key), or null. */
function refKey(node: ModelNode): 'edges' | 'open' | 'faces' | null {
  const key = node.kind === 'fillet' || node.kind === 'chamfer' || node.kind === 'sheet-flange' || node.kind === 'sheet-corner-relief' ? 'edges' : node.kind === 'shell' ? 'open' : node.kind === 'draft' ? 'faces' : null;
  return key && 'parent' in node ? key : null;
}
/**
 * The document with a copy of every object the references' setters change — a referencing feature and its list,
 * mate sides, dimension points, body looks — and the rest shared (PERF3 A6: a deep copy of the whole document,
 * an imported STEP text and all, on every check; every node then new to the engine's wire and memo).
 */
function writable(d: StudioDoc): StudioDoc {
  const out: StudioDoc = { ...d, nodes: d.nodes.map(n => { const key = refKey(n); return key ? { ...n, [key]: [...(n as unknown as Record<string, string[]>)[key]] } as ModelNode : n; }) };
  if (d.mates) out.mates = d.mates.map(m => ({ ...m, a: { ...m.a }, b: { ...m.b } }));
  if (d.drawing?.dimensions) out.drawing = { ...d.drawing, dimensions: d.drawing.dimensions.map(x => 'a' in x ? { ...x, a: { ...x.a }, b: { ...x.b } } as typeof x : { ...x }) };
  if (d.bodies) { const bodies: NonNullable<StudioDoc['bodies']> = {}; for (const [k, look] of Object.entries(d.bodies)) bodies[k] = { ...look }; out.bodies = bodies; }
  return out;
}
/**
 * The document and its stored references: a copy the references' setters change, or (`readOnly`, for reading
 * them only) the document itself, whose setters must then not be called.
 */
export function referencesOf(source: StudioDoc, readOnly = false): { doc: StudioDoc; refs: Ref[] } {
  const doc = readOnly ? source : writable(source), refs: Ref[] = [];
  doc.nodes.forEach((node, k) => {
    const key = refKey(node);
    if (!key || !('parent' in node)) return;
    const n = node as unknown as Record<string, unknown> & Named, list = n[key] as string[];
    list.forEach((name, i) => refs.push({
      where: `feature ${k}`, edge: key === 'edges', node: k, parent: node.parent, name, sig: n.sigs?.[name], rematched: !!n.rematched?.[name], was: n.rematched?.[name],
      rename(to, mark) {
        const from = list[i], sig = n.sigs?.[from]; list[i] = to;
        if (sig) { n.sigs = { ...n.sigs }; delete n.sigs[from]; n.sigs[to] = sig; }
        if (mark) { n.rematched = { ...n.rematched, [to]: n.rematched?.[from] ?? from }; delete n.rematched[from]; }
      },
      setSig(sig) { n.sigs = { ...n.sigs, [list[i]]: sig }; },
      clear() { if (n.rematched) { n.rematched = { ...n.rematched }; delete n.rematched[list[i]]; if (!Object.keys(n.rematched).length) delete n.rematched; } },
    }));
  });
  for (const mate of doc.mates ?? []) for (const side of [mate.a, mate.b] as (typeof mate.a & Pointed)[]) {
    // (A lock's faces are unused, ''; an origin plane is the part's own, not a face of its B-rep.)
    if (!side.face || frameFace(side.face)) continue;
    refs.push({ ...pointed(`mate ${mate.id}`, false, side, () => side.face, f => { side.face = f; }), part: side.part });
  }
  for (const d of doc.drawing?.dimensions ?? []) {
    if (d.kind === 'diameter' || d.kind === 'radius') { const x: Pointed & { edge: string } = d; refs.push(pointed(`dimension ${d.id}`, true, x, () => x.edge, e => { x.edge = e; })); }
    // (A pitch circle, or a point at its centre: each member hole's edge, R14.5.)
    else if (d.kind === 'pcd') for (const m of d.ring as (Pointed & { edge: string })[]) refs.push(pointed(`dimension ${d.id}`, true, m, () => m.edge, e => { m.edge = e; }));
    else if ('a' in d) for (const p of [d.a, d.b] as unknown as (Pointed & { edge: string; at?: string; ring?: (Pointed & { edge: string })[] })[]) {
      if (p.at === 'pcd' && p.ring) for (const m of p.ring) refs.push(pointed(`dimension ${d.id}`, true, m, () => m.edge, e => { m.edge = e; }));
      else refs.push(pointed(`dimension ${d.id}`, true, p, () => p.edge, e => { p.edge = e; }));
    }
  }
  for (const [key, look] of Object.entries(doc.bodies ?? {})) {
    if (!look.faces) continue;
    const l = look;
    for (const name of Object.keys(look.faces)) refs.push({
      where: `colours of ${key}`, edge: false, node: null, name, sig: l.faceSigs?.[name], rematched: !!l.facesWas?.[name], was: l.facesWas?.[name],
      rename(to, mark) {
        const faces = { ...l.faces! }; faces[to] = faces[name]; delete faces[name]; l.faces = faces;
        if (l.faceSigs?.[name]) { l.faceSigs = { ...l.faceSigs, [to]: l.faceSigs[name] }; delete l.faceSigs[name]; }
        if (mark) { l.facesWas = { ...l.facesWas, [to]: l.facesWas?.[name] ?? name }; delete l.facesWas[name]; }
      },
      setSig(sig) { l.faceSigs = { ...l.faceSigs, [name]: sig }; },
      clear() { if (l.facesWas) { l.facesWas = { ...l.facesWas }; delete l.facesWas[name]; if (!Object.keys(l.facesWas).length) delete l.facesWas; } },
    });
  }
  return { doc, refs };
}
function pointed(where: string, edge: boolean, at: Pointed, get: () => string, set: (name: string) => void): Ref {
  return { where, edge, node: null, name: get(), sig: at.sig, rematched: at.was !== undefined, was: at.was,
    rename(to, mark) { const was = get(); set(to); if (mark) at.was = at.was ?? was; },
    setSig(sig) { at.sig = sig; },
    clear() { delete at.was; } };
}

/** Whether any stored reference has no signature (without copying the document). */
function unsigned(doc: StudioDoc): boolean {
  for (const n of doc.nodes) {
    const list = n.kind === 'fillet' || n.kind === 'chamfer' || n.kind === 'sheet-flange' || n.kind === 'sheet-corner-relief' ? n.edges : n.kind === 'shell' ? n.open : n.kind === 'draft' ? n.faces : null;
    if (list?.some(name => !n.sigs?.[name])) return true;
  }
  for (const m of doc.mates ?? []) for (const side of [m.a, m.b]) if (side.face && !frameFace(side.face) && !side.sig) return true;
  for (const d of doc.drawing?.dimensions ?? []) {
    const unsignedPoint = (p: { sig?: unknown; at?: string; ring?: { sig?: unknown }[] }) => p.at === 'pcd' ? (p.ring ?? []).some(m => !m.sig) : !p.sig;
    if (d.kind === 'pcd' ? d.ring.some(m => !m.sig) : 'a' in d ? (d.kind === 'linear' ? unsignedPoint(d.a) || unsignedPoint(d.b) : !d.a.sig || !d.b.sig) : !d.sig) return true;
  }
  for (const look of Object.values(doc.bodies ?? {})) if (look.faces && Object.keys(look.faces).some(f => !look.faceSigs?.[f])) return true;
  return false;
}

/** A mate face as a signature: a plane's point and normal, a cylinder's axis point, direction (one way) and radius. */
function mateSignature(f: MateFace): Signature {
  if (f.kind === 'plane') return { kind: 'plane', at: f.point, dir: f.normal, size: 0 };
  const a = f.axis, k = Math.abs(a[0]) > 1e-12 ? 0 : Math.abs(a[1]) > 1e-12 ? 1 : 2, s = a[k] < 0 ? -1 : 1;
  return { kind: f.outer ? 'cylinder' : 'bore', at: f.point, dir: [a[0] * s, a[1] * s, a[2] * s], size: 0, radius: f.radius };
}

/** The faces' (or edges') signatures a reference is matched among. */
function candidatesOf(ref: Ref, finals: readonly BodyResult[], parents: ReadonlyMap<number, BodyResult | undefined>, tables: Tables): Map<string, Signature> | null {
  if (ref.part !== undefined) {
    const t = tables(ref.part); if (!t) return null;
    const out = new Map<string, Signature>();
    for (const [name, f] of Object.entries(t)) if (!frameFace(name)) out.set(name, mateSignature(f));
    return out;
  }
  const bodies = ref.node === null ? finals : [parents.get(ref.node)].filter((b): b is BodyResult => !!b);
  if (!bodies.length) return null;
  const out = new Map<string, Signature>();
  for (const b of bodies) { const s = signaturesOf(b); for (const [n, sig] of ref.edge ? s.edges : s.faces) out.set(n, sig); }
  return out;
}

/**
 * Signatures for the references `doc` has none for, from what they were picked on: `bodies` (the part as it
 * stood when they were written; a feature's parent among them, as a new feature is added on a body) and the
 * parts' face tables (a mate).
 */
export function captureSignatures(doc: StudioDoc, bodies: readonly BodyResult[], tables: Tables = tablesFor(doc)): StudioDoc {
  // (Every commit passes here: the document is copied only when a reference lacks its signature.)
  if (!unsigned(doc)) return doc;
  const { doc: out, refs } = referencesOf(doc);
  let changed = false;
  for (const ref of refs) {
    if (ref.sig) continue;
    const body = ref.parent ? bodies.find(b => b.key === bodyKeyFor(out.nodes, ref.parent!.node, ref.parent!.side)) : undefined;
    const sig = candidatesOf(ref, bodies, new Map(ref.node !== null ? [[ref.node, body]] : []), tables)?.get(ref.name);
    if (sig) { ref.setSig(toSig(sig)); changed = true; }
  }
  return changed ? out : doc;
}

/** Each named feature's parent body as it stands (the document evaluated up to that feature). */
async function parentBodies(doc: StudioDoc, refs: readonly Ref[], evaluate: Evaluate): Promise<Map<number, BodyResult | undefined>> {
  const out = new Map<number, BodyResult | undefined>();
  for (const ref of refs) {
    if (ref.node === null || out.has(ref.node)) continue;
    const r = await rememberedEvaluate(evaluate)(prefixDoc(doc, ref.node));
    out.set(ref.node, r?.ok ? r.bodies.find(b => b.key === bodyKeyFor(doc.nodes, ref.parent!.node, ref.parent!.side)) : undefined);
  }
  return out;
}

/**
 * Every signature taken again from the part as it now stands (after an accepted edit, its names already matched
 * against the document before it), except a reference still marked re-matched.
 */
export async function refreshSignatures(doc: StudioDoc, finals: readonly BodyResult[], evaluate: Evaluate, tables: Tables = tablesFor(doc)): Promise<StudioDoc> {
  const { doc: out, refs } = referencesOf(doc), live = refs.filter(r => !r.rematched);
  if (!live.length) return doc;
  const parents = await parentBodies(out, live, evaluate);
  for (const ref of live) { const sig = candidatesOf(ref, finals, parents, tables)?.get(ref.name); if (sig) ref.setSig(toSig(sig)); }
  return out;
}

export interface Verified { where: string; was: string; now: string }
/** A reference that cannot be told: several as near (`candidates`), or none alike (gone). */
export interface Problem { index: number; where: string; node: number | null; name: string; candidates: string[] }
/**
 * The stored references checked against their signatures (a document opened, no prior one to compare with):
 * those whose geometry is now named otherwise substituted and marked; those that cannot be told listed, and the
 * features holding them held (suppressed, `held` saying why) so the rest of the part builds.
 */
export async function verifyReferences(doc: StudioDoc, finals: readonly BodyResult[], evaluate: Evaluate, tables: Tables = tablesFor(doc)): Promise<{ doc: StudioDoc; changes: Verified[]; problems: Problem[] }> {
  const { doc: out, refs } = referencesOf(doc);
  if (!refs.some(r => r.sig)) return { doc, changes: [], problems: [] };
  const parents = await parentBodies(out, refs.filter(r => r.sig), evaluate), changes: Verified[] = [], problems: Problem[] = [];
  refs.forEach((ref, index) => {
    if (!ref.sig) return;
    const cands = candidatesOf(ref, finals, parents, tables); if (!cands) return;
    const m = matchSignature(fromSig(ref.sig), cands, ref.edge);
    if (typeof m === 'string') { if (m !== ref.name) { changes.push({ where: ref.where, was: ref.name, now: m }); ref.rename(m, true); } return; }
    problems.push({ index, where: ref.where, node: ref.node, name: ref.name, candidates: m });
    if (ref.node !== null) {
      const n = out.nodes[ref.node];
      if (!n.suppressed) out.nodes[ref.node] = { ...n, suppressed: true, held: m.length ? `"${ref.name}" could be ${m.join(' or ')}` : `"${ref.name}" is gone` };
    }
  });
  return { doc: changes.length || problems.length ? prefixDoc(out, out.nodes.length) : doc, changes, problems };
}

// The user's say on a re-match (A1.3c): every marked reference, by its place in `referencesOf`'s list.
export interface Marked { index: number; where: string; node: number | null; edge: boolean; was: string; now: string }
/** The references marked re-matched (substituted by a match, not yet confirmed). */
export function markedReferences(doc: StudioDoc): Marked[] {
  return referencesOf(doc, true).refs.flatMap((r, index) => r.rematched ? [{ index, where: r.where, node: r.node, edge: r.edge, was: r.was ?? r.name, now: r.name }] : []);
}
/**
 * Reference `index` confirmed (as it is, or as `to`, another of its candidates): its mark gone, its signature
 * taken from that face (edge) as the part now stands, and its feature released if it was held for it.
 */
export async function confirmReference(doc: StudioDoc, index: number, finals: readonly BodyResult[], evaluate: Evaluate, to?: string, tables: Tables = tablesFor(doc)): Promise<StudioDoc> {
  const { doc: out, refs } = referencesOf(doc), ref = refs[index];
  if (!ref) return doc;
  if (to !== undefined && to !== ref.name) { ref.rename(to, false); ref.name = to; }
  ref.clear();
  if (ref.node !== null && out.nodes[ref.node].held) { const n = { ...out.nodes[ref.node] }; delete n.held; delete n.suppressed; out.nodes[ref.node] = n; }
  const parents = await parentBodies(out, [ref], evaluate), sig = candidatesOf(ref, finals, parents, tables)?.get(ref.name);
  if (sig) ref.setSig(toSig(sig));
  return prefixDoc(out, out.nodes.length);
}
/** The faces (edges) reference `index` could be: those alike its stored signature, nearest first (at most `n`). */
export async function candidatesFor(doc: StudioDoc, index: number, finals: readonly BodyResult[], evaluate: Evaluate, n = 4, tables: Tables = tablesFor(doc)): Promise<string[]> {
  const { doc: out, refs } = referencesOf(doc), ref = refs[index];
  if (!ref?.sig) return [];
  const cands = candidatesOf(ref, finals, await parentBodies(out, [ref], evaluate), tables);
  return cands ? rankAlike(fromSig(ref.sig), cands, ref.edge).slice(0, n) : [];
}
