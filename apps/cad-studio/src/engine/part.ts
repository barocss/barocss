// The studio document as a kernel part document: node i is feature `n<i>`, so persistent face and edge
// names read `n1.side0`, `n1.top`, `n2.side0|n1.top`, and a kernel output `n5` / `n5/0` / `n5/1` is the
// studio body `b5` / `b5_negative` / `b5_positive`.
import type { CadPartDocument, CadPartFeature } from '@barocss/cad';
import type { BodyRef, ModelNode, StudioDoc } from './doc';

const id = (index: number) => `n${index}`;
const ref = (r: BodyRef) => r.side === 'negative' ? `n${r.node}/0` : r.side === 'positive' ? `n${r.node}/1` : `n${r.node}`;

export function featureOf(node: ModelNode, index: number): CadPartFeature {
  const at = { id: id(index) };
  switch (node.kind) {
    case 'sketch': return { ...at, ...node } as CadPartFeature;
    case 'extrude': return { ...at, kind: 'extrude', sketch: id(node.sketch), height: node.height, ...(node.from === undefined ? {} : { from: node.from }), ...(node.draft ? { draft: node.draft } : {}) };
    case 'revolve': return { ...at, kind: 'revolve', sketch: id(node.sketch), axis: { origin: node.origin ?? [0, 0], direction: node.axis }, angleDegrees: node.angleDegrees };
    case 'union': case 'intersect': return { ...at, kind: node.kind, target: ref(node.left), tool: ref(node.right) };
    case 'difference': return { ...at, kind: 'difference', target: ref(node.parent), tool: ref(node.tool) };
    case 'hole': return { ...at, kind: 'hole', target: ref(node.parent), center: node.center, radius: node.radius,
      ...(node.axis ? { axis: node.axis } : {}), ...(node.side ? { side: node.side } : {}), ...(node.depth === undefined ? {} : { depth: node.depth }) };
    case 'translate': return { ...at, kind: 'translate', target: ref(node.parent), offset: node.offset };
    case 'rotate': return { ...at, kind: 'rotate', target: ref(node.parent), axis: node.axis, angleDegrees: node.angleDegrees };
    // Studio mirrors keep the original, as a mirror copy beside it.
    case 'mirror': return { ...at, kind: 'mirror', target: ref(node.parent), plane: node.plane, keep: true };
    case 'scale': return { ...at, kind: 'scale', target: ref(node.parent), factor: node.factor };
    case 'linear-pattern': return { ...at, kind: 'linear-pattern', target: ref(node.parent), axis: node.axis, spacing: node.spacing, count: node.count };
    case 'circular-pattern': return { ...at, kind: 'circular-pattern', target: ref(node.parent), axis: node.axis, angleDegrees: node.angleDegrees, count: node.count };
    case 'split': return { ...at, kind: 'split', target: ref(node.parent), axis: node.axis, at: node.at };
    case 'sweep': return { ...at, kind: 'sweep', sketch: id(node.sketch), path: node.path };
    case 'import': return { ...at, kind: 'import', step: node.step };
    case 'shell': return { ...at, kind: 'shell', target: ref(node.parent), thickness: node.thickness, open: node.open };
    case 'chamfer': return { ...at, kind: 'chamfer', target: ref(node.parent), edges: node.edges, distance: node.distance };
    case 'fillet': return { ...at, kind: 'fillet', target: ref(node.parent), edges: node.edges, radius: node.radius };
  }
}

export const toPartDocument = (doc: StudioDoc): CadPartDocument =>
  ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: doc.nodes.map(featureOf) });

/** Studio body key of a kernel output id. */
export const bodyKeyOf = (outputId: string) => {
  const m = /^n(\d+)(?:\/(\d+))?$/.exec(outputId);
  if (!m) return outputId;
  return m[2] === undefined ? `b${m[1]}` : `b${m[1]}_${m[2] === '0' ? 'negative' : 'positive'}`;
};
