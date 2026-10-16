// A body's own name, colour and visibility (StudioDoc.bodies). They are kept by the feature the body was
// first made by — its first solid, found by following each feature back to what it was built on — so a
// box keeps its colour when holes and fillets are added to it.
import { featureLabel, parentsOf, type BodyLook, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { commands } from './commands';

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
/** The key of a body's look: `b<first feature>`, and its side when it is one of several parts. */
export function lookKey(nodes: readonly ModelNode[], body: BodyResult): string {
  const m = /^b(\d+)(_.+)?$/.exec(body.key); if (!m) return body.key;
  const side = m[2] && m[2] !== '_negative' && !m[2].startsWith('_part') ? '' : m[2] ?? '';
  return `b${rootOf(nodes, Number(m[1]))}${side}`;
}
export const lookOf = (doc: StudioDoc, body: BodyResult): BodyLook => doc.bodies?.[lookKey(doc.nodes, body)] ?? {};
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
  const m = /^b(\d+)(?:_(.+))?$/.exec(body.key); if (!m) return body.key;
  const root = rootOf(doc.nodes, Number(m[1])), node = doc.nodes[root];
  const made = node && (node.kind === 'extrude' || node.kind === 'revolve') ? node.made : undefined;
  // (A shape by its name alone — its sizes are in its feature's label.)
  const base = made ? commands.find(c => c.id === made.command)?.label ?? made.command : node ? featureLabel(node, root, doc.nodes) : body.key;
  return m[2] ? `${base} · ${m[2].startsWith('part') ? `solid ${Number(m[2].slice(4)) + 1}` : m[2]}` : base;
}
/** The newest feature on a body, when it is not the one it was first made by (shown beside its name). */
export function lastFeature(doc: StudioDoc, body: BodyResult): string | null {
  const m = /^b(\d+)/.exec(body.key); if (!m) return null;
  const top = Number(m[1]), node = doc.nodes[top];
  return node && rootOf(doc.nodes, top) !== top ? featureLabel(node, top, doc.nodes) : null;
}
/** A colour as 0…1 RGB. */
export const rgbOf = (hex: string): [number, number, number] => { const v = parseInt(hex.replace('#', ''), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
