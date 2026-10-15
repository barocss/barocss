// The studio document: plain data, one node per feature. Every command appends or edits nodes; the
// worker evaluates it on the kernel's B-rep part model (node i is feature `n<i>`, see part.ts).

export type Axis = 'x' | 'y' | 'z';
export type Dim = number | { parameter: string };
export type Side = 'solid' | 'negative' | 'positive' | 'instance1' | 'instance2' | 'instance3';
export interface BodyRef { node: number; side: Side }

export type SketchNode =
  | { kind: 'sketch'; profile: 'rectangle'; min: [Dim, Dim]; max: [Dim, Dim] }
  | { kind: 'sketch'; profile: 'circle'; center: [Dim, Dim]; radius: Dim }
  | { kind: 'sketch'; profile: 'polygon'; points: [Dim, Dim][] }
  | { kind: 'sketch'; profile: 'loop'; segments: ({ kind: 'line'; start: [Dim, Dim] } | { kind: 'arc'; start: [Dim, Dim]; center: [Dim, Dim]; direction: 'ccw' | 'cw' })[] };

export type ModelNode = SketchNode
  /** `draft` (degrees) leans the walls into the material away from the sketch plane. */
  | { kind: 'extrude'; sketch: number; height: Dim; from?: Dim; draft?: number }
  /** The sketch turned about its X or Y axis (through `origin`, default the sketch origin) towards +Z. */
  | { kind: 'revolve'; sketch: number; axis: 'x' | 'y'; origin?: [Dim, Dim]; angleDegrees: number }
  | { kind: 'translate'; parent: BodyRef; offset: [Dim, Dim, Dim] }
  | { kind: 'rotate'; parent: BodyRef; axis: Axis; angleDegrees: number }
  | { kind: 'mirror'; parent: BodyRef; plane: 'xy' | 'xz' | 'yz' }
  | { kind: 'scale'; parent: BodyRef; factor: number }
  | { kind: 'linear-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number }
  | { kind: 'circular-pattern'; parent: BodyRef; axis: Axis; angleDegrees: number; count: number }
  | { kind: 'union'; left: BodyRef; right: BodyRef }
  | { kind: 'intersect'; left: BodyRef; right: BodyRef }
  | { kind: 'difference'; parent: BodyRef; tool: BodyRef }
  | { kind: 'split'; parent: BodyRef; at: Dim; axis: Axis }
  /** Hollowed to walls `thickness` thick, the named faces removed (none: a closed hollow). */
  | { kind: 'shell'; parent: BodyRef; thickness: Dim; open: string[] }
  /** Edges by their persistent B-rep names (they follow the features, so edits keep the selection). */
  | { kind: 'chamfer'; parent: BodyRef; edges: string[]; distance: Dim }
  | { kind: 'fillet'; parent: BodyRef; edges: string[]; radius: Dim }
  /** Along `axis` (default z) through the body; `side` is the face it was picked on (default max). */
  | { kind: 'hole'; parent: BodyRef; center: [Dim, Dim]; radius: Dim; axis?: Axis; side?: 'min' | 'max'; depth?: Dim };

export interface StudioDoc {
  format: 'barocss-cad-model';
  schema: 1;
  units: 'mm';
  parameters: Record<string, number>;
  nodes: ModelNode[];
  outputs: Record<string, BodyRef>;
}

export const emptyDoc = (): StudioDoc => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} });

export const isSolidNode = (node: ModelNode) => node.kind !== 'sketch';

export function parentsOf(node: ModelNode): number[] {
  switch (node.kind) {
    case 'sketch': return [];
    case 'extrude': case 'revolve': return [node.sketch];
    case 'union': case 'intersect': return [node.left.node, node.right.node];
    case 'difference': return [node.parent.node, node.tool.node];
    default: return [node.parent.node];
  }
}

/** Solid nodes that no later solid node consumes: the visible bodies of a model prefix. */
export function leafBodies(nodes: readonly ModelNode[]): BodyRef[] {
  // Every operation consumes what it acts on (patterns and kept mirrors include the original); a split
  // side is consumed on its own.
  const consumed = new Set<string>();
  nodes.forEach(node => {
    if (node.kind === 'sketch' || node.kind === 'extrude' || node.kind === 'revolve') return;
    const refs = node.kind === 'union' || node.kind === 'intersect' ? [node.left, node.right] : node.kind === 'difference' ? [node.parent, node.tool] : [node.parent];
    refs.forEach(r => consumed.add(r.side === 'solid' ? String(r.node) : `${r.node}_${r.side}`));
  });
  const refs: BodyRef[] = [];
  nodes.forEach((node, index) => {
    if (!isSolidNode(node) || consumed.has(String(index))) return;
    if (node.kind === 'split') (['negative', 'positive'] as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else refs.push({ node: index, side: 'solid' });
  });
  return refs;
}

/** The document evaluated at a rollback marker: nodes before it, outputs = its leaf bodies. */
export function prefixDoc(doc: StudioDoc, marker: number): StudioDoc {
  const nodes = doc.nodes.slice(0, marker);
  const outputs: Record<string, BodyRef> = {};
  leafBodies(nodes).forEach(ref => { outputs[bodyKey(ref)] = ref; });
  return { ...doc, nodes, outputs };
}

export const bodyKey = (ref: BodyRef) => ref.side === 'solid' ? `b${ref.node}` : `b${ref.node}_${ref.side}`;

export function withNode(doc: StudioDoc, node: ModelNode): StudioDoc {
  const next = { ...doc, nodes: [...doc.nodes, node] };
  return prefixDoc(next, next.nodes.length);
}

export function featureLabel(node: ModelNode, index: number, nodes: readonly ModelNode[]): string {
  const n = (v: Dim) => typeof v === 'number' ? fmt(v) : v.parameter;
  switch (node.kind) {
    case 'sketch': return `Sketch · ${node.profile === 'loop' ? 'outline' : node.profile}`;
    case 'extrude': {
      const s = nodes[node.sketch];
      const kind = s && s.kind === 'sketch' && s.profile === 'circle' ? 'Cylinder' : 'Extrude';
      return `${kind} ${n(node.height)}${node.draft ? ` · ${node.draft}°` : ''}`;
    }
    case 'revolve': return `Revolve ${node.angleDegrees}°`;
    case 'hole': return `Hole Ø${typeof node.radius === 'number' ? fmt(node.radius * 2) : node.radius.parameter}`;
    case 'chamfer': return `Chamfer ${n(node.distance)}`;
    case 'fillet': return `Fillet R${n(node.radius)}`;
    case 'union': return 'Union';
    case 'intersect': return 'Intersect';
    case 'difference': return 'Subtract';
    case 'translate': return 'Move';
    case 'rotate': return `Rotate ${node.angleDegrees}°`;
    case 'mirror': return `Mirror ${node.plane.toUpperCase()}`;
    case 'scale': return `Scale ×${node.factor}`;
    case 'linear-pattern': return `Pattern ×${node.count}`;
    case 'circular-pattern': return `Circular ×${node.count}`;
    case 'split': return `Split ${node.axis.toUpperCase()}=${n(node.at)}`;
    case 'shell': return `Shell ${n(node.thickness)}`;
  }
  return `Feature ${index + 1}`;
}

export const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

export function rectanglePart(width: number, depth: number, thickness: number): StudioDoc {
  const doc = emptyDoc();
  doc.nodes = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, depth] }, { kind: 'extrude', sketch: 0, height: thickness }];
  return prefixDoc(doc, 2);
}

export function cylinderPart(radius: number, height: number): StudioDoc {
  const doc = emptyDoc();
  doc.nodes = [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius }, { kind: 'extrude', sketch: 0, height }];
  return prefixDoc(doc, 2);
}

/** A starter part: a 64 × 32 × 8 mm plate with one hole — values the kernel admits today. */
export function starterDoc(): StudioDoc {
  const doc = rectanglePart(64, 32, 8);
  return withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [32, 16], radius: 4 });
}
