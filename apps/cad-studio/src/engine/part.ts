// The studio document as a kernel part document: a node is the feature of its stable id (`n<k>`, see ids.ts),
// so persistent face and edge names read `n1.side0`, `n1.top`, `n2.side0|n1.top` and keep their names as other
// features come and go; a kernel output `n5` / `n5/0` / `n5/1` is the studio body `b5` / `b5_negative` /
// `b5_positive` (keyed by the id too); the solids of a STEP file holding several are `n5/k`, `b5_part<k>`.
import type { CadPartDocument, CadPartFeature } from '@barocss/cad';
import { holeCentres, type BodyRef, type ModelNode, type StudioDoc } from './doc';
import { featureId, nodeIndexOf, serialOf, withIds } from './ids';

// (The nodes being converted: a feature's id and its references' ids are read from them.)
let current: readonly ModelNode[] = [];
const id = (index: number) => featureId(current, index);
const ref = (r: BodyRef) => r.side === 'negative' ? `${id(r.node)}/0` : r.side === 'positive' ? `${id(r.node)}/1` : r.side.startsWith('part') ? `${id(r.node)}/${r.side.slice(4)}` : id(r.node);

/** One node as a kernel feature (`nodes`: the document's, for its ids; without them node i is `n<i>`). */
export function featureOf(node: ModelNode, index: number, nodes?: readonly ModelNode[]): CadPartFeature {
  if (nodes) current = nodes;
  const at = { id: id(index) };
  switch (node.kind) {
    // The drawn outline and its constraints are the studio's own (the kernel takes the solved profile).
    case 'sketch': { const profile = { ...node }; delete profile.outline; delete profile.on; delete profile.construction; return { ...at, ...profile } as CadPartFeature; }
    case 'extrude': return { ...at, kind: 'extrude', sketch: id(node.sketch), height: node.height, ...(node.from === undefined ? {} : { from: node.from }), ...(node.draft ? { draft: node.draft } : {}) };
    case 'revolve': return { ...at, kind: 'revolve', sketch: id(node.sketch), axis: { origin: node.origin ?? [0, 0], direction: node.dir ?? node.axis }, angleDegrees: node.angleDegrees };
    case 'union': case 'intersect': return { ...at, kind: node.kind, target: ref(node.left), tool: ref(node.right) };
    case 'difference': return { ...at, kind: 'difference', target: ref(node.parent), tool: ref(node.tool) };
    case 'hole': return { ...at, kind: 'hole', target: ref(node.parent), center: node.center, radius: node.radius,
      ...(node.axis ? { axis: node.axis } : {}), ...(node.side ? { side: node.side } : {}), ...(node.depth === undefined ? {} : { depth: node.depth }), ...(node.countersink ? { countersink: node.countersink } : {}) };
    case 'translate': return { ...at, kind: 'translate', target: ref(node.parent), offset: node.offset };
    case 'rotate': return { ...at, kind: 'rotate', target: ref(node.parent), axis: node.axis, angleDegrees: node.angleDegrees, ...(node.pivot ? { pivot: node.pivot } : {}) };
    // Studio mirrors keep the original, as a mirror copy beside it.
    case 'mirror': return { ...at, kind: 'mirror', target: ref(node.parent), plane: node.plane, keep: true };
    case 'scale': return { ...at, kind: 'scale', target: ref(node.parent), factor: node.factor, ...(node.pivot ? { pivot: node.pivot } : {}) };
    case 'linear-pattern': return { ...at, kind: 'linear-pattern', target: ref(node.parent), axis: node.axis, spacing: node.spacing, count: node.count };
    case 'circular-pattern': return { ...at, kind: 'circular-pattern', target: ref(node.parent), axis: node.axis, angleDegrees: node.angleDegrees, count: node.count, ...(node.pivot ? { pivot: node.pivot } : {}) };
    case 'split': return { ...at, kind: 'split', target: ref(node.parent), ...(node.normal ? { normal: node.normal } : { axis: node.axis }), at: node.at };
    case 'separate': return { ...at, kind: 'separate', target: ref(node.parent) };
    case 'sweep': return { ...at, kind: 'sweep', sketch: id(node.sketch), path: node.path };
    case 'sweep-curve': return { ...at, kind: 'sweep-curve', sketch: id(node.sketch), path: node.path };
    case 'loft': return { ...at, kind: 'loft', sections: node.sections.map(s => ({ sketch: id(s.sketch), z: s.z })), ...(node.smooth ? { smooth: true } : {}) };
    case 'import': return { ...at, kind: 'import', step: node.step, ...((node.solids ?? 1) > 1 ? { each: true } : {}) };
    case 'mesh': return { ...at, kind: 'mesh', positions: node.positions, indices: node.indices, ...(node.representation ? { representation: node.representation } : {}) };
    case 'thread': return { ...at, kind: 'thread', diameter: node.diameter, pitch: node.pitch, center: node.center, seat: node.seat, ...(node.length !== undefined ? { length: node.length } : {}), ...(node.hex ? { hex: node.hex } : {}), ...(node.form ? { form: node.form } : {}) };
    case 'shell': return { ...at, kind: 'shell', target: ref(node.parent), thickness: node.thickness, open: node.open };
    case 'chamfer': return { ...at, kind: 'chamfer', target: ref(node.parent), edges: node.edges, distance: node.distance };
    case 'thicken': return { ...at, kind: 'thicken', surface: node.surface, thickness: node.thickness, ...(node.side ? { side: node.side } : {}) };
    case 'sew': return { ...at, kind: 'sew', surfaces: node.surfaces, ...(node.tolerance !== undefined ? { tolerance: node.tolerance } : {}) };
    case 'draft': return { ...at, kind: 'draft', target: ref(node.parent), faces: node.faces, angleDegrees: node.angleDegrees };
    case 'fillet': return { ...at, kind: 'fillet', target: ref(node.parent), edges: node.edges, radius: node.radius };
  }
}

/** A node's kernel features: one, or a patterned hole's copies one after another (the last named `n<i>`). */
function featuresOf(node: ModelNode, index: number): CadPartFeature[] {
  if (node.kind !== 'hole' || !node.pattern || node.pattern.count <= 1) return [featureOf(node, index, current)];
  const centres = holeCentres(node.center.map(Number), node.pattern), base = featureOf(node, index, current) as CadPartFeature & { target: string };
  return centres.map((center, j) => ({ ...base, id: j === centres.length - 1 ? id(index) : `${id(index)}_p${j}`, center, target: j === 0 ? base.target : `${id(index)}_p${j - 1}` }));
}

/**
 * The kernel's features, suppressed ones left out: a suppressed feature that changes a body passes it on
 * unchanged (an identity move under its id, so what follows still finds it); one that makes a body takes
 * that body away, and with it what is built on it alone (a Boolean with one side gone keeps the other;
 * an intersection or a subtraction from nothing is gone too).
 */
export function toPartDocument(doc: StudioDoc): CadPartDocument {
  doc = withIds(doc); current = doc.nodes;
  const gone = new Set<number>(), features: CadPartFeature[] = [];
  const pass = (i: number, r: BodyRef) => features.push({ id: id(i), kind: 'translate', target: ref(r), offset: [0, 0, 0] } as CadPartFeature);
  doc.nodes.forEach((node, i) => {
    if (node.kind === 'sketch') { features.push(...featuresOf(node, i)); return; }
    const makes = node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'sweep' || node.kind === 'loft' || node.kind === 'import' || node.kind === 'mesh' || node.kind === 'thread' || node.kind === 'sweep-curve' || node.kind === 'thicken' || node.kind === 'sew';
    const two = node.kind === 'union' || node.kind === 'intersect' ? [node.left, node.right] : node.kind === 'difference' ? [node.parent, node.tool] : null;
    if (two) {
      const [a, b] = two, ga = gone.has(a.node), gb = gone.has(b.node);
      // (Suppressed, a Boolean keeps its first body as it was.)
      if (node.suppressed) { if (ga) gone.add(i); else pass(i, a); return; }
      if (ga && gb) { gone.add(i); return; }
      if (node.kind === 'difference') { if (ga) { gone.add(i); return; } if (gb) { pass(i, a); return; } }
      else if (node.kind === 'intersect') { if (ga || gb) { gone.add(i); return; } }
      else if (ga || gb) { pass(i, ga ? b : a); return; }
      features.push(...featuresOf(node, i)); return;
    }
    if (makes) {
      if (node.suppressed || ('from' in node && Array.isArray(node.from) && node.from.some(p => gone.has(p)))) { gone.add(i); return; }
      features.push(...featuresOf(node, i)); return;
    }
    const parent = (node as { parent: BodyRef }).parent;
    if (gone.has(parent.node)) { gone.add(i); return; }
    if (node.suppressed) { pass(i, parent); return; }
    features.push(...featuresOf(node, i));
  });
  return { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features };
}

/** Studio body key of a kernel output id (`nodes`: to tell an imported file's solids from a split's halves). */
export const bodyKeyOf = (outputId: string, nodes?: readonly ModelNode[]) => {
  const m = /^([^/]+)(?:\/(\d+))?$/.exec(outputId);
  if (!m) return outputId;
  // (The node whose id the output carries; without the nodes, an id `n<i>` reads as node i.)
  // (Keyed by the id's serial, `b<k>` for `n<k>`, see ids.ts; the node only tells a file's solids from a split's halves.)
  const k = serialOf(m[1]), i = nodes ? nodeIndexOf(nodes, m[1]) : k;
  if (!(k >= 0)) return outputId;
  if (m[2] !== undefined && (nodes?.[i]?.kind === 'import' || nodes?.[i]?.kind === 'separate')) return `b${k}_part${m[2]}`;
  return m[2] === undefined ? `b${k}` : `b${k}_${m[2] === '0' ? 'negative' : 'positive'}`;
};
