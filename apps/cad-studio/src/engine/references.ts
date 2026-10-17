// Stored face and edge references with their geometry (A1.3b). Every place the document names a face or an
// edge — a fillet's or chamfer's edges, a shell's open faces, a draft's faces, a mate's face on the base part,
// a drawing dimension's edges, a body's per-face colours — keeps a compact signature of what it named: kind,
// normal or direction, centroid or midpoint, size, radius (`Sig`).
//
// - Written: a reference gets its signature when it is written (from the bodies it was picked on).
// - Refreshed: only after an accepted edit went through the prior-document match (engine/rematch.ts), and
//   never for one still marked re-matched; not on open, a plain re-evaluation or a kernel change, so a
//   renumbering that still resolves (to the wrong face) cannot overwrite a good signature.
// - Verified (on open, with no prior document): the one matcher (rematch.ts `matchSignature`) runs against the
//   stored signature. Its clear best being the name stored, the reference stands; another name, it is
//   substituted and marked re-matched (until confirmed); unclear or gone, it is refused with the candidates.
import { BASE } from '../assembly/mates';
import { bodyKeyFor } from './ids';
import { prefixDoc, type StudioDoc } from './doc';
import type { BodyResult, EvalResult } from './evaluate';
import { matchSignature, signaturesOf, type Signature } from './rematch';
import type { Vec3 } from './mesh';

/** A stored signature (rounded: positions to 1e-6 mm, directions to 1e-9, sizes to 1e-6). */
export interface Sig { k: string; p: Vec3; d?: Vec3; s: number; r?: number }
const round = (x: number, q: number) => Math.round(x / q) * q;
const r3 = (v: Vec3, q: number): Vec3 => [round(v[0], q), round(v[1], q), round(v[2], q)];
export const toSig = (s: Signature): Sig => ({ k: s.kind, p: r3(s.at, 1e-6), ...(s.dir ? { d: r3(s.dir, 1e-9) } : {}), s: round(s.size, 1e-6), ...(s.radius !== undefined ? { r: round(s.radius, 1e-9) } : {}) });
export const fromSig = (s: Sig): Signature => ({ kind: s.k, at: s.p, dir: s.d ?? null, size: s.s, ...(s.r !== undefined ? { radius: s.r } : {}) });

/** One stored reference: what it names, where its geometry is (`node`: that node's parent body; null: the part's bodies). */
export interface Ref {
  where: string; edge: boolean; node: number | null; parent?: { node: number; side: string };
  name: string; sig?: Sig; rematched: boolean;
  /** Names it `to`, with that signature (kept: the stored one), marked re-matched or not. */
  rename(to: string, mark: boolean): void;
  setSig(sig: Sig): void;
}

type Named = { names: string[]; sigs?: Record<string, Sig>; rematched?: Record<string, string> };
type Pointed = { sig?: Sig; was?: string };

/** The document (a copy, which the references' setters change) and its stored references. */
export function referencesOf(source: StudioDoc): { doc: StudioDoc; refs: Ref[] } {
  const doc = structuredClone(source), refs: Ref[] = [];
  doc.nodes.forEach((node, k) => {
    const key = node.kind === 'fillet' || node.kind === 'chamfer' ? 'edges' : node.kind === 'shell' ? 'open' : node.kind === 'draft' ? 'faces' : null;
    if (!key || !('parent' in node)) return;
    const n = node as unknown as Record<string, unknown> & Named, list = n[key] as string[];
    list.forEach((name, i) => refs.push({
      where: `feature ${k}`, edge: key === 'edges', node: k, parent: node.parent, name, sig: n.sigs?.[name], rematched: !!n.rematched?.[name],
      rename(to, mark) {
        const sig = n.sigs?.[list[i]]; list[i] = to;
        if (sig) { n.sigs = { ...n.sigs }; delete n.sigs[name]; n.sigs[to] = sig; }
        if (mark) { n.rematched = { ...n.rematched, [to]: n.rematched?.[name] ?? name }; delete n.rematched[name]; }
      },
      setSig(sig) { n.sigs = { ...n.sigs, [list[i]]: sig }; },
    }));
  });
  for (const mate of doc.mates ?? []) for (const side of [mate.a, mate.b] as (typeof mate.a & Pointed)[]) {
    if (side.part !== BASE) continue;
    refs.push(pointed(`mate ${mate.id}`, false, side, () => side.face, f => { side.face = f; }));
  }
  for (const d of doc.drawing?.dimensions ?? []) {
    if (d.kind === 'diameter' || d.kind === 'radius') { const x: Pointed & { edge: string } = d; refs.push(pointed(`dimension ${d.id}`, true, x, () => x.edge, e => { x.edge = e; })); }
    else if ('a' in d) for (const p of [d.a, d.b] as (Pointed & { edge: string })[]) refs.push(pointed(`dimension ${d.id}`, true, p, () => p.edge, e => { p.edge = e; }));
  }
  for (const [key, look] of Object.entries(doc.bodies ?? {})) {
    if (!look.faces) continue;
    const l = look as typeof look & { faceSigs?: Record<string, Sig>; facesWas?: Record<string, string> };
    for (const name of Object.keys(look.faces)) refs.push({
      where: `colours of ${key}`, edge: false, node: null, name, sig: l.faceSigs?.[name], rematched: !!l.facesWas?.[name],
      rename(to, mark) {
        const faces = { ...l.faces! }; faces[to] = faces[name]; delete faces[name]; l.faces = faces;
        if (l.faceSigs?.[name]) { l.faceSigs = { ...l.faceSigs, [to]: l.faceSigs[name] }; delete l.faceSigs[name]; }
        if (mark) { l.facesWas = { ...l.facesWas, [to]: l.facesWas?.[name] ?? name }; delete l.facesWas[name]; }
      },
      setSig(sig) { l.faceSigs = { ...l.faceSigs, [name]: sig }; },
    });
  }
  return { doc, refs };
}
function pointed(where: string, edge: boolean, at: Pointed, get: () => string, set: (name: string) => void): Ref {
  return { where, edge, node: null, name: get(), sig: at.sig, rematched: at.was !== undefined,
    rename(to, mark) { const was = get(); set(to); if (mark) at.was = at.was ?? was; },
    setSig(sig) { at.sig = sig; } };
}

/** The faces' (or edges') signatures a reference is matched among. */
function candidatesOf(ref: Ref, nodes: StudioDoc['nodes'], finals: readonly BodyResult[], parents: ReadonlyMap<number, BodyResult | undefined>): Map<string, Signature> | null {
  const bodies = ref.node === null ? finals : [parents.get(ref.node)].filter((b): b is BodyResult => !!b);
  if (!bodies.length) return null;
  const out = new Map<string, Signature>();
  for (const b of bodies) { const s = signaturesOf(b); for (const [n, sig] of ref.edge ? s.edges : s.faces) out.set(n, sig); }
  return out;
}

/**
 * Signatures for the references `doc` has none for, from the bodies they were picked on: `bodies` (the part as
 * it stood when they were written; a feature's parent among them, as a new feature is added on a body).
 */
export function captureSignatures(doc: StudioDoc, bodies: readonly BodyResult[]): StudioDoc {
  // (Every commit passes here: the document is copied only when a reference lacks its signature.)
  if (!unsigned(doc)) return doc;
  const { doc: out, refs } = referencesOf(doc);
  let changed = false;
  for (const ref of refs) {
    if (ref.sig) continue;
    const body = ref.parent ? bodies.find(b => b.key === bodyKeyFor(out.nodes, ref.parent!.node, ref.parent!.side)) : undefined;
    const cands = candidatesOf(ref, out.nodes, bodies, new Map(ref.node !== null ? [[ref.node, body]] : []));
    const sig = cands?.get(ref.name); if (sig) { ref.setSig(toSig(sig)); changed = true; }
  }
  return changed ? out : doc;
}

/** Whether any stored reference has no signature (without copying the document). */
function unsigned(doc: StudioDoc): boolean {
  for (const n of doc.nodes) {
    const list = n.kind === 'fillet' || n.kind === 'chamfer' ? n.edges : n.kind === 'shell' ? n.open : n.kind === 'draft' ? n.faces : null;
    if (list?.some(name => !n.sigs?.[name])) return true;
  }
  for (const m of doc.mates ?? []) for (const side of [m.a, m.b]) if (side.part === BASE && !side.sig) return true;
  for (const d of doc.drawing?.dimensions ?? []) if ('a' in d ? !d.a.sig || !d.b.sig : !d.sig) return true;
  for (const look of Object.values(doc.bodies ?? {})) if (look.faces && Object.keys(look.faces).some(f => !look.faceSigs?.[f])) return true;
  return false;
}

/** Each named feature's parent body as it stands (the document evaluated up to that feature). */
async function parentBodies(doc: StudioDoc, refs: readonly Ref[], evaluate: (doc: StudioDoc) => Promise<EvalResult | null>): Promise<Map<number, BodyResult | undefined>> {
  const out = new Map<number, BodyResult | undefined>();
  for (const ref of refs) {
    if (ref.node === null || out.has(ref.node)) continue;
    const r = await evaluate(prefixDoc(doc, ref.node));
    out.set(ref.node, r?.ok ? r.bodies.find(b => b.key === bodyKeyFor(doc.nodes, ref.parent!.node, ref.parent!.side)) : undefined);
  }
  return out;
}

/**
 * Every signature taken again from the part as it now stands (after an accepted edit, its names already matched
 * against the document before it), except a reference still marked re-matched.
 */
export async function refreshSignatures(doc: StudioDoc, finals: readonly BodyResult[], evaluate: (doc: StudioDoc) => Promise<EvalResult | null>): Promise<StudioDoc> {
  const { doc: out, refs } = referencesOf(doc), live = refs.filter(r => !r.rematched);
  if (!live.length) return doc;
  const parents = await parentBodies(out, live, evaluate);
  for (const ref of live) { const sig = candidatesOf(ref, out.nodes, finals, parents)?.get(ref.name); if (sig) ref.setSig(toSig(sig)); }
  return out;
}

export interface Verified { where: string; was: string; now: string }
/**
 * The stored references checked against their signatures (a document opened, no prior one to compare with):
 * those whose geometry is now named otherwise substituted and marked; or why one cannot be told.
 */
export async function verifyReferences(doc: StudioDoc, finals: readonly BodyResult[], evaluate: (doc: StudioDoc) => Promise<EvalResult | null>): Promise<{ doc: StudioDoc; changes: Verified[] } | { error: string }> {
  const { doc: out, refs } = referencesOf(doc), signed = refs.filter(r => r.sig);
  if (!signed.length) return { doc, changes: [] };
  const parents = await parentBodies(out, signed, evaluate), changes: Verified[] = [];
  for (const ref of signed) {
    const cands = candidatesOf(ref, out.nodes, finals, parents); if (!cands) continue;
    const m = matchSignature(fromSig(ref.sig!), cands, ref.edge);
    if (typeof m !== 'string') return { error: m.length ? `${ref.where}: the ${ref.edge ? 'edge' : 'face'} "${ref.name}" is now one of ${m.join(', ')}; name the one you mean.` : `${ref.where}: the ${ref.edge ? 'edge' : 'face'} "${ref.name}" is gone (nothing like it is left).` };
    if (m !== ref.name) { changes.push({ where: ref.where, was: ref.name, now: m }); ref.rename(m, true); }
  }
  return { doc: changes.length ? prefixDoc(out, out.nodes.length) : doc, changes };
}
