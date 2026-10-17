// A sub-assembly as one part: a document's own features, then each visible instance's features placed as
// they stand (their mates were solved when the file was saved), renumbered after them. Inserted into
// another assembly, it is then one instance with several bodies whose faces mate like any part's.
import { placedDoc, prefixDoc, type BodyRef, type Dim, type ModelNode, type StudioDoc } from '../engine/doc';

/** The document with its instances folded in as features (nested sub-assemblies too). */
export function flattenAssembly(doc: StudioDoc): StudioDoc {
  const own: StudioDoc = { ...doc, instances: undefined, mates: undefined, render: undefined, direct: undefined };
  const shown = (doc.instances ?? []).filter(i => !i.hidden);
  if (!shown.length) return own;
  let nodes = [...own.nodes];
  for (const inst of shown) {
    // (placedDoc folds the instance's own instances first.)
    const placed = placedDoc(inst);
    nodes = [...nodes, ...placed.nodes.map(n => shiftNode(inlineParameters(n, placed.parameters), nodes.length))];
  }
  return prefixDoc({ ...own, nodes }, nodes.length);
}

/** A node's references to earlier nodes moved `k` on (indices, and feature ids inside face and edge names). */
function shiftNode(node: ModelNode, k: number): ModelNode {
  const ref = (r: BodyRef): BodyRef => ({ ...r, node: r.node + k });
  const name = (s: string) => s.replace(/\bn(\d+)(?=[./#|]|$)/g, (_, d: string) => `n${Number(d) + k}`);
  switch (node.kind) {
    case 'sketch': return node.on ? { ...node, on: ref(node.on) } : node;
    case 'import': case 'mesh': case 'thread': return node;
    case 'extrude': case 'revolve': case 'sweep': case 'sweep-curve': return { ...node, sketch: node.sketch + k };
    case 'loft': return { ...node, sections: node.sections.map(s => ({ ...s, sketch: s.sketch + k })), ...(node.from ? { from: node.from.map(i => i + k) } : {}) };
    case 'union': case 'intersect': return { ...node, left: ref(node.left), right: ref(node.right) };
    case 'difference': return { ...node, parent: ref(node.parent), tool: ref(node.tool) };
    case 'chamfer': case 'fillet': return { ...node, parent: ref(node.parent), edges: node.edges.map(name) };
    case 'draft': return { ...node, parent: ref(node.parent), faces: node.faces.map(name) };
    case 'shell': return { ...node, parent: ref(node.parent), open: node.open.map(name) };
    default: return { ...node, parent: ref(node.parent) };
  }
}

/** Parameter references replaced by their values (the parts' parameters may share names). */
function inlineParameters(node: ModelNode, parameters: Record<string, number>): ModelNode {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === 'parameter') { const p = (v as { parameter: string }).parameter; return (parameters[p] ?? 0) as Dim; }
      return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, walk(x)]));
    }
    return v;
  };
  return walk(node) as ModelNode;
}
