// A sub-assembly as one part: a document's own features, then each visible instance's features placed as
// they stand (their mates were solved when the file was saved), renumbered after them. Inserted into
// another assembly, it is then one instance with several bodies whose faces mate like any part's.
import { placedDoc, prefixDoc, type BodyRef, type Dim, type MemberSection, type ModelNode, type StudioDoc } from '../engine/doc';
import { nextSerial, renameFeatureIds, withIds } from '../engine/ids';

/** The document with its instances folded in as features (nested sub-assemblies too). */
export function flattenAssembly(doc: StudioDoc): StudioDoc {
  const own: StudioDoc = { ...doc, instances: undefined, mates: undefined, render: undefined, direct: undefined };
  const shown = (doc.instances ?? []).filter(i => !i.hidden);
  if (!shown.length) return own;
  let nodes = withIds(own).nodes;
  for (const inst of shown) {
    // (placedDoc folds the instance's own instances first. Its features' ids move past every id so far, the
    // document's handed-out ones too: with none deleted, by its node count, as its names always moved.)
    const placed = withIds(placedDoc(inst)), serial = nextSerial({ nodes, nextId: own.nextId });
    nodes = [...nodes, ...placed.nodes.map(n => shiftNode(inlineParameters(n, placed.parameters), nodes.length, serial))];
  }
  return prefixDoc({ ...own, nodes, nextId: nextSerial({ nodes, nextId: own.nextId }) }, nodes.length);
}

/**
 * A node's references to earlier nodes moved `k` on (indices), and its feature ids, its own and those inside
 * face and edge names, `s` on (serials).
 */
function shiftNode(node: ModelNode, k: number, s: number): ModelNode {
  const ref = (r: BodyRef): BodyRef => ({ ...r, node: r.node + k });
  const id = (x: string) => x.replace(/^n(\d+)/, (_, d: string) => `n${Number(d) + s}`), name = (x: string) => renameFeatureIds(x, id);
  if (node.id !== undefined) node = { ...node, id: id(node.id) };
  // (What the studio keeps by name — references' signatures, re-match marks — renamed alike.)
  if (node.sigs) node = { ...node, sigs: Object.fromEntries(Object.entries(node.sigs).map(([n, v]) => [name(n), v])) };
  if (node.rematched) node = { ...node, rematched: Object.fromEntries(Object.entries(node.rematched).map(([n, v]) => [name(n), name(v)])) };
  switch (node.kind) {
    case 'sketch': return node.on ? { ...node, on: ref(node.on) } : node;
    case 'import': case 'mesh': case 'thread': case 'thicken': case 'sew': case 'subd': case 'gear': case 'internal-gear': case 'bevel-gear': case 'worm': case 'worm-wheel': case 'spring': case 'rack': case 'library': case 'sheet-contour': return node;
    case 'extrude': case 'revolve': case 'sweep': case 'sweep-curve': case 'sheet-base': return { ...node, sketch: node.sketch + k };
    case 'frame-member': return node.section.kind === 'sketch' ? { ...node, section: { kind: 'sketch', sketch: node.section.sketch + k } } : node;
    case 'skeleton': return node;
    case 'frame': {
      const shift = (sec: MemberSection): MemberSection => sec.kind === 'sketch' ? { kind: 'sketch', sketch: sec.sketch + k } : sec;
      return { ...node, ...(node.follows && !('part' in node.follows) ? { follows: 'skeleton' in node.follows ? { skeleton: node.follows.skeleton + k } : { sketch: node.follows.sketch + k } } : {}), section: shift(node.section), ...(node.overrides ? { overrides: node.overrides.map(o => o.section ? { ...o, section: shift(o.section) } : o) } : {}), ...(node.trims ? { trims: node.trims.map(t => 'body' in t ? { ...t, body: ref(t.body) } : t) } : {}) };
    }
    case 'loft': return { ...node, sections: node.sections.map(s => ({ ...s, sketch: s.sketch + k })), ...(node.from ? { from: node.from.map(i => i + k) } : {}) };
    case 'union': case 'intersect': return { ...node, left: ref(node.left), right: ref(node.right) };
    case 'difference': return { ...node, parent: ref(node.parent), tool: ref(node.tool) };
    case 'chamfer': case 'fillet': return { ...node, parent: ref(node.parent), edges: node.edges.map(name) };
    case 'sheet-flange': case 'sheet-corner-relief': return { ...node, parent: ref(node.parent), edges: [name(node.edges[0])] };
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
