// A body's own name, colour and visibility (StudioDoc.bodies). They are kept by the feature the body was
// first made by — its first solid, found by following each feature back to what it was built on — so a
// box keeps its colour when holes and fillets are added to it.
import { featureLabel, parentsOf, type BodyLook, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { commands } from './commands';
import { refOf } from './bodyRef';
import { bodyKeyFor } from '../engine/ids';
import { briefMaterial } from '../chat/brief';

/** The colours offered for bodies (the theme's grey is no colour). */
export const BODY_COLOURS = ['#d9534f', '#f0ad4e', '#e8d44d', '#5cb85c', '#3fb6a8', '#4a90d9', '#8e6bd8', '#d26fa9', '#8d6e63', '#5b6470'] as const;

/** The feature a body was first made by: back through each feature to the solid it was built on (a Boolean's first body). */
export function rootOf(nodes: readonly ModelNode[], index: number): number {
  for (let i = index, guard = 0; guard < 4096; guard++) {
    const n = nodes[i]; if (!n) return index;
    const solids = parentsOf(n).filter(p => nodes[p] && nodes[p].kind !== 'sketch');
    if (!solids.length) return i;
    i = solids[0];
  }
  return index;
}
/** The key of a body's look: `b<first feature's serial>`, and its side when it is one of several parts. */
export function lookKey(nodes: readonly ModelNode[], body: BodyResult): string {
  if (!/^b\d+(_.+)?$/.test(body.key)) return body.key;
  const { node, side } = refOf(body);
  return bodyKeyFor(nodes, rootOf(nodes, node), side === 'negative' || side.startsWith('part') ? side : 'solid');
}
export const lookOf = (doc: StudioDoc, body: BodyResult): BodyLook => doc.bodies?.[lookKey(doc.nodes, body)] ?? {};
/** A body's material id: its own, else the brief's stated library material (A6.1), else none (the default, assumed). */
export const materialIdOf = (doc: StudioDoc, body: BodyResult): string | undefined => lookOf(doc, body).material ?? briefMaterial(doc);
/** The part's one material: the id every body has (null when they differ, or none is set); `mixed` when they differ. */
export function partMaterial(doc: StudioDoc, bodies: readonly BodyResult[]): { id: string | null; mixed: boolean } {
  const ids = [...new Set(bodies.map(b => materialIdOf(doc, b) ?? null))];
  return { id: ids.length === 1 ? ids[0] : null, mixed: ids.length > 1 };
}
/** The document with a body's look changed (empty fields dropped). */
export function withLook(doc: StudioDoc, body: BodyResult, patch: BodyLook): StudioDoc {
  const key = lookKey(doc.nodes, body), next: BodyLook = { ...doc.bodies?.[key], ...patch };
  (Object.keys(next) as (keyof BodyLook)[]).forEach(k => { if (next[k] === undefined || next[k] === '' || next[k] === false) delete next[k]; });
  const bodies = { ...doc.bodies }; if (Object.keys(next).length) bodies[key] = next; else delete bodies[key];
  const out: StudioDoc = { ...doc, bodies }; if (!Object.keys(bodies).length) delete out.bodies;
  return out;
}
/** What a body is called: its own name, else the shape or feature it was first made by (and its part). */
export function bodyName(doc: StudioDoc, body: BodyResult): string {
  const own = lookOf(doc, body).name; if (own) return own;
  if (!/^b\d+(_.+)?$/.test(body.key)) return body.key;
  const ref = refOf(body), side = ref.side === 'solid' ? undefined : ref.side;
  // A part made in several steps (a bolt) is named by what it is.
  const top = doc.nodes[ref.node];
  if (top && 'made' in top && top.made && (top.kind === 'union' || top.kind === 'rotate' || top.kind === 'thread')) return top.made.command === 'fastener' ? featureLabel(top, ref.node, doc.nodes) : commands.find(c => c.id === top.made!.command)?.label ?? top.made.command;
  const root = rootOf(doc.nodes, ref.node), node = doc.nodes[root];
  const made = node && (node.kind === 'extrude' || node.kind === 'revolve') ? node.made : undefined;
  // (A shape by its name alone — its sizes are in its feature's label.)
  const base = made ? commands.find(c => c.id === made.command)?.label ?? made.command : node ? featureLabel(node, root, doc.nodes) : body.key;
  // (A frame's bodies are its members, FR2.)
  return side ? `${base} · ${side.startsWith('part') ? `${node?.kind === 'frame' ? 'member' : 'solid'} ${Number(side.slice(4)) + 1}` : side}` : base;
}
/** The newest feature on a body, when it is not the one it was first made by (shown beside its name). */
export function lastFeature(doc: StudioDoc, body: BodyResult): string | null {
  if (!/^b\d+/.test(body.key)) return null;
  const top = refOf(body).node, node = doc.nodes[top];
  return node && rootOf(doc.nodes, top) !== top && !('made' in node && node.made) ? featureLabel(node, top, doc.nodes) : null;
}
/** A colour as 0…1 RGB. */
export const rgbOf = (hex: string): [number, number, number] => { const v = parseInt(hex.replace('#', ''), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };

/**
 * What a change to the document did, in a few words (the undo and redo buttons say what they undo):
 * features added, deleted or edited, or a body's look changed.
 */
export function describeChange(before: StudioDoc, after: StudioDoc): string {
  const a = before.nodes, b = after.nodes, label = (n: StudioDoc['nodes'][number], i: number, all: StudioDoc['nodes']) => featureLabel(n, i, all);
  // (Edits keep the nodes they leave alone: the same object is the same node, without writing it out.)
  const differ = (x: unknown, y: unknown) => x !== y && JSON.stringify(x) !== JSON.stringify(y);
  if (b.length > a.length) { const i = b.length - 1; return label(b[i], i, b); }
  if (b.length < a.length) { const gone = a.findIndex((n, i) => differ(n, b[i])); const i = gone < 0 ? a.length - 1 : gone; return `delete ${label(a[i], i, a)}`; }
  const i = a === b ? -1 : b.findIndex((n, k) => differ(n, a[k]));
  if (i >= 0) return `edit ${label(b[i], i, b)}`;
  if (differ(before.bodies ?? {}, after.bodies ?? {})) return 'body look';
  return 'change';
}

/** The features a body was built up by, first to last (its main line: each feature's first solid input; sketches left out). */
export function bodySteps(nodes: readonly ModelNode[], top: number): number[] {
  const out: number[] = [];
  for (let i = top, guard = 0; nodes[i] && guard < 4096; guard++) {
    // (A shape of several steps shows as itself: skip over its inner steps.)
    out.push(i);
    const n = nodes[i], inner = 'made' in n && n.made?.nodes ? n.made.nodes - 1 : 0;
    const solids = parentsOf(n).filter(p => nodes[p] && nodes[p].kind !== 'sketch' && !(inner && p >= i - inner));
    if (!solids.length) break;
    i = solids[0];
  }
  return out.reverse();
}
