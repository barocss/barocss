// The studio document is the kernel's own saved model format, kept as plain data.
// Every command appends or edits nodes; the worker evaluates it with `cad.load`.

export type Axis = 'x' | 'y' | 'z';
export type Dim = number | { parameter: string };
export type Side = 'solid' | 'negative' | 'positive' | 'instance1' | 'instance2' | 'instance3';
export interface BodyRef { node: number; side: Side }
export interface EdgeQuery { parallelTo?: Axis; at?: Partial<Record<Axis, Dim | 'min' | 'max'>> }

export type SketchNode =
  | { kind: 'sketch'; profile: 'rectangle'; min: [Dim, Dim]; max: [Dim, Dim] }
  | { kind: 'sketch'; profile: 'circle'; center: [Dim, Dim]; radius: Dim }
  | { kind: 'sketch'; profile: 'polygon'; points: [Dim, Dim][] }
  | { kind: 'sketch'; profile: 'loop'; segments: ({ kind: 'line'; start: [Dim, Dim] } | { kind: 'arc'; start: [Dim, Dim]; center: [Dim, Dim]; direction: 'ccw' | 'cw' })[] };

export type ModelNode = SketchNode
  | { kind: 'extrude'; sketch: number; height: Dim; from?: Dim }
  | { kind: 'translate'; parent: BodyRef; offset: [Dim, Dim, Dim] }
  | { kind: 'rotate'; parent: BodyRef; axis: Axis; angleDegrees: 90 | 180 | 270 | -90 | -180 | -270 }
  | { kind: 'mirror'; parent: BodyRef; plane: 'xy' | 'xz' | 'yz' }
  | { kind: 'scale'; parent: BodyRef; factor: 0.5 | 2 }
  | { kind: 'linear-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: 2 | 3 | 4 }
  | { kind: 'circular-pattern'; parent: BodyRef; axis: Axis; angleDegrees: 90 | -90; count: 3 | 4 }
  | { kind: 'union'; left: BodyRef; right: BodyRef }
  | { kind: 'intersect'; left: BodyRef; right: BodyRef }
  | { kind: 'difference'; parent: BodyRef; tool: BodyRef }
  | { kind: 'split'; parent: BodyRef; at: Dim; axis: Axis }
  | { kind: 'chamfer'; parent: BodyRef; edge: EdgeQuery; distance: Dim; name?: string; suppressed?: boolean }
  | { kind: 'hole'; parent: BodyRef; center: [Dim, Dim]; radius: Dim };

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
    case 'extrude': return [node.sketch];
    case 'union': case 'intersect': return [node.left.node, node.right.node];
    case 'difference': return [node.parent.node, node.tool.node];
    default: return [node.parent.node];
  }
}

/** Solid nodes that no later solid node consumes: the visible bodies of a model prefix. */
export function leafBodies(nodes: readonly ModelNode[]): BodyRef[] {
  // Patterns and mirrors add copies and keep their parent; every other operation consumes it.
  const keepsParent = (node: ModelNode) => node.kind === 'extrude' || node.kind === 'linear-pattern'
    || node.kind === 'circular-pattern' || node.kind === 'mirror';
  const consumed = new Set<number>();
  nodes.forEach(node => { if (!keepsParent(node)) parentsOf(node).forEach(index => consumed.add(index)); });
  const refs: BodyRef[] = [];
  nodes.forEach((node, index) => {
    if (!isSolidNode(node) || consumed.has(index)) return;
    if (node.kind === 'split') refs.push({ node: index, side: 'negative' }, { node: index, side: 'positive' });
    else if (node.kind === 'linear-pattern' || node.kind === 'circular-pattern') {
      for (let i = 1; i < node.count && i <= 3; i++) refs.push({ node: index, side: `instance${i}` as Side });
    } else refs.push({ node: index, side: 'solid' });
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
      return `${kind} ${n(node.height)}`;
    }
    case 'hole': return `Hole Ø${typeof node.radius === 'number' ? fmt(node.radius * 2) : node.radius.parameter}`;
    case 'chamfer': return `Chamfer ${n(node.distance)}`;
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
