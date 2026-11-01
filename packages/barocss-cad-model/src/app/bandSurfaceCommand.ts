// Band surface (B2): an exact ruled sheet between two edge chains of two bodies, kept associative — the node stores the kernel's
// edge names (strict references, references.ts), and the kernel rebuilds the band whenever the bodies change.
// The command's values carry the picks as JSON `BandSide` strings (`a`, `b`; '' while empty) so the HUD, the viewport highlight
// (`bandPicksOf`) and the build all read the same thing. Thickening waits on exact thicken (#2258): there is no thickness value.
import { bandSurfaceNodeProblem, BAND_MAX_EDGES, prefixDoc, withNode, type BandSide, type ModelNode, type StudioDoc } from '../engine/doc';
import { bodyKeyFor } from '../engine/ids';
import { captureSignatures } from '../engine/references';
import { refusal } from '../engine/refusal';
import { evaluateDoc, type BodyResult } from '../engine/evaluate';
import type { DisplayEdge, Vec3 } from '../engine/mesh';
import { refOf } from './bodyRef';
import { edgeChain } from './edgeChain';
import type { Command, Ctx, EdgeSel, FaceSel, Field, Values } from './commands';

type Band = Extract<ModelNode, { kind: 'band-surface' }>;
const HINT = 'An exact ruled surface between two edge chains of two bodies, kept in step with them: pick the first chain (edges, or a face for all its edges), then click the second. Both chains open or both closed.';

const sideOf = (value: number | string | undefined): BandSide | null => {
  if (typeof value !== 'string' || !value) return null;
  try {
    const x = JSON.parse(value) as BandSide;
    return x && x.parent && Array.isArray(x.edges) ? { parent: { node: x.parent.node, side: x.parent.side }, edges: x.edges.filter(n => typeof n === 'string') } : null;
  } catch { return null; }
};
const text = (side: BandSide): string => JSON.stringify({ parent: side.parent, edges: side.edges });

/** The picks held in a band command's values, for the viewport to highlight (the Studio merges them into its shown selection). */
export function bandPicksOf(values: Values): { side: 'a' | 'b'; parent: BandSide['parent']; names: string[] }[] {
  const out: { side: 'a' | 'b'; parent: BandSide['parent']; names: string[] }[] = [];
  for (const side of ['a', 'b'] as const) { const s = sideOf(values[side]); if (s && s.edges.length) out.push({ side, parent: s.parent, names: [...s.edges] }); }
  return out;
}

const bodyOf = (ctx: Ctx, side: BandSide): BodyResult | undefined => ctx.bodies.find(b => b.key === bodyKeyFor(ctx.doc.nodes, side.parent.node, side.parent.side));
const edgesNamed = (body: BodyResult, names: readonly string[]): DisplayEdge[] => body.mesh.edges.filter(e => e.names.some(n => names.includes(n)));
const key = (p: Vec3) => p.map(x => Math.round(x * 1e4)).join(',');
/** 'closed' when every end point of the edges is met twice (one loop, or several), 'open' otherwise. */
function closure(edges: readonly DisplayEdge[]): 'open' | 'closed' {
  const count = new Map<string, number>();
  for (const e of edges) for (const p of [e.a, e.b]) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  return edges.length > 0 && [...count.values()].every(n => n === 2) ? 'closed' : 'open';
}
const names = (edges: readonly DisplayEdge[]): string[] => [...new Set(edges.flatMap(e => e.names))];

/** The names of every edge of face `face` of `body`: one loop only (a face with several loops is refused). */
function faceEdges(body: BodyResult, face: number): DisplayEdge[] | string {
  const edges = body.mesh.edges.filter(e => e.faces[0] === face || e.faces[1] === face);
  if (!edges.length) return 'That face has no edges to use.';
  // Loops: connected components over shared end points.
  const parent = new Map<string, string>();
  const find = (k: string): string => { let r = k; while ((parent.get(r) ?? r) !== r) r = parent.get(r)!; parent.set(k, r); return r; };
  for (const e of edges) { const a = key(e.a), b = key(e.b); if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); }
  if (new Set([...parent.keys()].map(find)).size > 1) return 'That face has several loops of edges: pick the edges of the one you mean.';
  return edges;
}

/** A side from a selection of edges on one body, or one face (all its edges). */
function selectedSide(ctx: Ctx): BandSide | string {
  const { edges, faces } = ctx.selection;
  if (ctx.selection.sketches?.length || ctx.selection.bodies.length && !edges.length && !faces.length) return 'Pick the edges of the first chain (or a face for all its edges).';
  if (edges.length && faces.length) return 'Pick edges or one face for the first chain, not both.';
  let body: BodyResult | undefined, list: DisplayEdge[];
  if (faces.length) {
    if (faces.length !== 1) return 'Pick one face (all its edges are used) or the edges themselves.';
    body = ctx.bodies[faces[0].body]; if (!body) return 'Pick the first chain on a body.';
    const f = faceEdges(body, body.mesh.faces[faces[0].face]?.index ?? faces[0].face);
    if (typeof f === 'string') return f;
    list = f;
  } else if (edges.length) {
    if (new Set(edges.map(e => e.body)).size !== 1) return 'The first chain must be on one body.';
    body = ctx.bodies[edges[0].body]; if (!body) return 'Pick the first chain on a body.';
    list = edges.flatMap(e => body!.mesh.edges[e.edge] ? [body!.mesh.edges[e.edge]] : []);
  } else return 'Pick the edges of the first chain (or a face for all its edges).';
  const n = names(list);
  if (!n.length) return 'Pick edges with names.';
  if (n.length > BAND_MAX_EDGES) return `A chain has at most ${BAND_MAX_EDGES} edges.`;
  return { parent: refOf(body), edges: n };
}

function sideText(ctx: Ctx, side: BandSide | null, what: string): { label: string; text: string; done: boolean } {
  if (!side || !side.edges.length) return { label: what, text: what === 'A' ? 'pick edges or a face on a body' : 'click the second chain (edges, or a face for all its edges)', done: false };
  const body = bodyOf(ctx, side), list = body ? edgesNamed(body, side.edges) : [];
  return { label: what, text: `${side.edges.length} edge${side.edges.length === 1 ? '' : 's'} on ${body ? body.key : `feature ${side.parent.node}`}${list.length ? ` (${closure(list)})` : ''}`, done: true };
}
/** The kernel's own pairing once evaluated (the band body whose stored picks are these), else the picks counted as edge names. */
function pairingText(ctx: Ctx, a: BandSide | null, b: BandSide | null): { label: string; text: string; done: boolean } {
  if (!a?.edges.length || !b?.edges.length) return { label: 'Pairing', text: 'once both chains are picked', done: false };
  const evaluated = ctx.bodies.find(x => {
    const n = x.ref ? ctx.doc.nodes[x.ref.node] : undefined;
    return !!x.band && n?.kind === 'band-surface' && JSON.stringify([n.a.edges, n.b.edges]) === JSON.stringify([a.edges, b.edges]);
  })?.band;
  if (evaluated) return { label: 'Pairing', text: `${evaluated.pieces[0]}↔${evaluated.pieces[1]} ${evaluated.pairing === 'pieces' ? 'pieces' : 'by length'} → ${evaluated.pairs} patches`, done: true };
  return { label: 'Pairing', text: `${a.edges.length}↔${b.edges.length} edges, paired when it is built`, done: true };
}
const steps = (ctx: Ctx, v: Values) => { const a = sideOf(v.a), b = sideOf(v.b); return [sideText(ctx, a, 'A'), sideText(ctx, b, 'B'), pairingText(ctx, a, b)]; };

/** A click while the band runs: adds (or, clicking again, removes) a chain or a face's edges on the `which` side; null when it hit nothing. */
function pickInto(ctx: Ctx, v: Values, which: 'a' | 'b', hit: { face: FaceSel | null; edge: EdgeSel | null }, other: BandSide | null, tooLate?: (b: BodyResult) => string | null): Values | { error: string } | null {
  let body: BodyResult | undefined, list: DisplayEdge[] = [];
  if (hit.edge) {
    body = ctx.bodies[hit.edge.body]; const e = body?.mesh.edges[hit.edge.edge]; if (!body || !e) return null;
    const single = v.chain === 'single';
    list = (single ? [e.index] : edgeChain(body.mesh, e.index)).flatMap(i => body!.mesh.edges[i] ? [body!.mesh.edges[i]] : []);
  } else if (hit.face) {
    body = ctx.bodies[hit.face.body]; if (!body) return null;
    const f = faceEdges(body, body.mesh.faces[hit.face.face]?.index ?? hit.face.face);
    if (typeof f === 'string') return { error: f };
    list = f;
  } else return null;
  const late = tooLate?.(body); if (late) return { error: late };
  const parent = refOf(body), add = names(list), held = sideOf(v[which]);
  if (other && add.some(n => other.edges.includes(n))) return { error: `That edge is already on side ${which === 'a' ? 'B' : 'A'}: a name may stand on one side only.` };
  const same = held && held.parent.node === parent.node && held.parent.side === parent.side;
  // A new body starts the side again; the same body adds, or removes what was already picked (a second click).
  let edges: string[];
  if (!same) edges = add;
  else if (add.every(n => held.edges.includes(n))) edges = held.edges.filter(n => !add.includes(n));
  else edges = [...held.edges, ...add.filter(n => !held.edges.includes(n))];
  if (edges.length > BAND_MAX_EDGES) return { error: `A chain has at most ${BAND_MAX_EDGES} edges.` };
  return { ...v, [which]: edges.length ? text({ parent, edges }) : '' };
}

function fieldsOf(edit: boolean): Field[] {
  return [
    { key: 'flip', label: 'Flip', kind: 'choice', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    ...(edit ? [{ key: 'repick', label: 'Re-pick', kind: 'choice' as const, options: [{ value: 'keep', label: 'Keep' }, { value: 'a', label: 'Side A (click)' }, { value: 'b', label: 'Side B (click)' }] }] : []),
    { key: 'chain', label: 'Chain', kind: 'choice', options: [{ value: 'tangent', label: 'Tangent chain' }, { value: 'single', label: 'Single edge' }] },
  ];
}

function nodeOf(a: BandSide | null, b: BandSide | null, flip: boolean): Band {
  if (!a?.edges.length || !b?.edges.length) throw refusal('VALUE', 'Band surface: pick side A and side B.');
  return { kind: 'band-surface', version: 1, a: { parent: { ...a.parent }, edges: [...a.edges] }, b: { parent: { ...b.parent }, edges: [...b.edges] }, ...(flip ? { flip: true as const } : {}) };
}
/** `nodes`: the features before the band (an edit rolls forward: later features may have consumed its bodies since). */
function checked(node: Band, nodes: readonly ModelNode[], doc: StudioDoc): Band {
  const why = bandSurfaceNodeProblem(node, nodes, doc.parameters);
  if (why) throw refusal('VALUE', why);
  return node;
}

export const bandSurfaceCommand: Command = {
  id: 'band-surface', label: 'Band surface', icon: 'cad-loft', group: 'create', hint: HINT,
  keywords: 'band ruled surface between edges loft sheet associative',
  available: ctx => { const s = selectedSide(ctx); return typeof s === 'string' ? { ok: false, reason: s } : { ok: true }; },
  fields: () => fieldsOf(false),
  defaults: ctx => { const s = selectedSide(ctx); return { a: typeof s === 'string' ? '' : text(s), b: '', flip: 'no', chain: 'tangent' }; },
  steps,
  onPick: (ctx, v, hit) => pickInto(ctx, v, 'b', hit, sideOf(v.a)),
  build(ctx, values) {
    const node = checked(nodeOf(sideOf(values.a), sideOf(values.b), values.flip === 'yes'), ctx.doc.nodes, ctx.doc);
    return captureSignatures(withNode(ctx.doc, node), ctx.bodies);
  },
};

/** Edit of a stored band: Flip, and Re-pick of one side (the next clicks replace it). */
export class BandSurfaceEdit implements Command {
  readonly id = 'edit'; readonly label = 'Edit Band surface'; readonly icon = 'cad-loft'; readonly group = 'modify'; readonly hint = HINT;
  constructor(private readonly index: number, private readonly authoredId: string | undefined) {}
  private node(ctx: Ctx): Band {
    const node = ctx.doc.nodes[this.index];
    if (!node || node.kind !== 'band-surface' || node.id !== this.authoredId) throw refusal('BAD_REFERENCE', 'The band surface changed. Select it again.');
    return node;
  }
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string } {
    try { this.node(ctx); return { ok: true }; } catch { return { ok: false, reason: 'The band surface changed. Select it again.' }; }
  }
  fields(): Field[] { return fieldsOf(true); }
  defaults(ctx: Ctx): Values {
    const n = this.node(ctx);
    return { a: text(n.a), b: text(n.b), flip: n.flip ? 'yes' : 'no', repick: 'keep', chain: 'tangent' };
  }
  /** Choosing a side to re-pick empties it; Keep restores both. */
  derive(ctx: Ctx, values: Values, changed: readonly string[]): Values {
    if (!changed.includes('repick')) return values;
    const n = this.node(ctx);
    return { ...values, a: values.repick === 'a' ? '' : text(n.a), b: values.repick === 'b' ? '' : text(n.b) };
  }
  steps(ctx: Ctx, v: Values) { const a = sideOf(v.a), b = sideOf(v.b); return [sideText(ctx, a, 'A'), sideText(ctx, b, 'B'), pairingText(ctx, a, b)]; }
  onPick(ctx: Ctx, v: Values, hit: { face: FaceSel | null; edge: EdgeSel | null }): Values | { error: string } | null {
    if (v.repick !== 'a' && v.repick !== 'b') return null;
    const which = v.repick;
    // A body made at or after the band would make the band depend on itself.
    const late = (b: BodyResult) => { const r = refOf(b); return r.node >= this.index ? `Roll back to feature ${this.index - 1} to re-pick on this body: it was made at or after the band.` : null; };
    return pickInto(ctx, v, which, hit, sideOf(which === 'a' ? v.b : v.a), late);
  }
  build(ctx: Ctx, values: Values): StudioDoc {
    const before = this.node(ctx), a = sideOf(values.a), b = sideOf(values.b);
    const next = checked(nodeOf(a, b, values.flip === 'yes'), ctx.doc.nodes.slice(0, this.index), ctx.doc);
    // Signatures stay for the names kept; the new names get theirs from the bodies as they stand.
    // A side that was re-picked takes all its signatures afresh (the person just chose those edges); an untouched side keeps its own.
    const same = (x: BandSide, y: BandSide) => JSON.stringify(x) === JSON.stringify(y);
    const kept = new Set([...(same(next.a, before.a) ? next.a.edges : []), ...(same(next.b, before.b) ? next.b.edges : [])]);
    const node: Band = { ...before, ...next, ...(before.id !== undefined ? { id: before.id } : {}) };
    if (!next.flip) delete node.flip;
    if (before.sigs) { const sigs = Object.fromEntries(Object.entries(before.sigs).filter(([name]) => kept.has(name))); if (Object.keys(sigs).length) node.sigs = sigs; else delete node.sigs; }
    if (before.rematched) delete node.rematched;
    // (A band held for a lost name is released by its edit: the edit names new edges.)
    if (before.held !== undefined) { delete node.held; delete node.suppressed; }
    const nodes = [...ctx.doc.nodes]; nodes[this.index] = node;
    // The sigs of new names come from the parents as they stand before the band: the final bodies when they are still there, else
    // (a later feature consumed one) the document evaluated up to the band.
    const doc = { ...ctx.doc, nodes };
    let bodies = ctx.bodies;
    if (![next.a.parent, next.b.parent].every(p => bodies.some(x => x.key === bodyKeyFor(nodes, p.node, p.side)))) {
      const r = evaluateDoc(prefixDoc(doc, this.index), 0);
      if (r.ok) bodies = r.bodies;
    }
    return captureSignatures(doc, bodies);
  }
}
export function bandSurfaceEditCommand(index: number, node: Band): Command { return new BandSurfaceEdit(index, node.id); }
