// The studio document: plain data, one node per feature. Every command appends or edits nodes; the
// worker evaluates it on the kernel's B-rep part model (node i is feature `n<i>`, see part.ts).

export type Axis = 'x' | 'y' | 'z';
export type Dim = number | { parameter: string };
/** `part<k>`: solid k of an imported STEP file that holds several (see the import node's `solids`). */
export type Side = 'solid' | 'negative' | 'positive' | 'instance1' | 'instance2' | 'instance3' | `part${number}`;
export interface BodyRef { node: number; side: Side }

/** Where a sketch lies (see sketch/plane.ts); none: the XY plane at Z 0. */
export interface DocPlane { origin: [number, number, number]; normal: [number, number, number]; xAxis: [number, number, number] }
export type LoopSegment = { kind: 'line'; start: [Dim, Dim] } | { kind: 'arc'; start: [Dim, Dim]; center: [Dim, Dim]; direction: 'ccw' | 'cw' };
/**
 * The closed outline a polygon / loop profile was drawn from, with its constraints and driving dimensions
 * (see sketch/rules.ts): lengths and radii by segment, tangent joints, arc pairs, kept H/V edges, rules.
 */
export interface SketchOutline {
  points: [number, number][]; bulges?: number[]; lengths?: Record<number, number>; radii?: Record<number, number>; tangents?: number[];
  equalRadii?: [number, number][]; concentric?: [number, number][]; hv?: { h: number[]; v: number[] }; rules?: SketchRule[];
  /** Circles dimensioned from the outline (they are also the profile's holes or regions). */
  circles?: { c: [number, number]; r: number }[];
}
/** `regions`: more loops of material; `holes`: loops cut from them (straight extrudes only); `outline`: the main loop as drawn and constrained. */
/** `on`: the body the sketch was drawn on (a feature from it joins or cuts that body by default). */
/** A body's own look in the modelling view (see StudioDoc.bodies). */
export interface BodyLook { name?: string; color?: string; hidden?: boolean }
/** A solid made by a shape command (Box, Sphere …) with these values: picking it again edits those values. */
export interface Made { command: string; values: Record<string, number | string> }
type OnPlane = { plane?: DocPlane; regions?: LoopSegment[][]; holes?: LoopSegment[][]; outline?: SketchOutline; on?: BodyRef };
export type SketchNode =
  | ({ kind: 'sketch'; profile: 'rectangle'; min: [Dim, Dim]; max: [Dim, Dim] } & OnPlane)
  | ({ kind: 'sketch'; profile: 'circle'; center: [Dim, Dim]; radius: Dim } & OnPlane)
  | ({ kind: 'sketch'; profile: 'polygon'; points: [Dim, Dim][] } & OnPlane)
  | ({ kind: 'sketch'; profile: 'loop'; segments: LoopSegment[] } & OnPlane);

export type ModelNode = SketchNode
  /** `draft` (degrees) leans the walls into the material away from the sketch plane. */
  | { kind: 'extrude'; sketch: number; height: Dim; from?: Dim; draft?: number; made?: Made }
  /** The sketch turned about its X or Y axis (through `origin`, default the sketch origin) towards +Z. */
  | { kind: 'revolve'; sketch: number; axis: 'x' | 'y'; origin?: [Dim, Dim]; angleDegrees: number; /** Any direction in the sketch plane (a picked edge), instead of its X or Y. */ dir?: [number, number]; made?: Made }
  | { kind: 'translate'; parent: BodyRef; offset: [Dim, Dim, Dim] }
  /** About the axis through `pivot` (none: the origin, as parts placed by rotation steps). */
  | { kind: 'rotate'; parent: BodyRef; axis: Axis; angleDegrees: number; pivot?: [Dim, Dim, Dim] }
  | { kind: 'mirror'; parent: BodyRef; plane: 'xy' | 'xz' | 'yz' }
  /** About `pivot` (none: the origin). */
  | { kind: 'scale'; parent: BodyRef; factor: number; pivot?: [Dim, Dim, Dim] }
  | { kind: 'linear-pattern'; parent: BodyRef; axis: Axis; spacing: Dim; count: number }
  | { kind: 'circular-pattern'; parent: BodyRef; axis: Axis; angleDegrees: number; count: number }
  | { kind: 'union'; left: BodyRef; right: BodyRef }
  | { kind: 'intersect'; left: BodyRef; right: BodyRef }
  | { kind: 'difference'; parent: BodyRef; tool: BodyRef }
  | { kind: 'split'; parent: BodyRef; at: Dim; axis: Axis }
  /** The sketch swept along straight runs and bends (from the sketch plane up +Z). */
  | { kind: 'sweep'; sketch: number; path: ({ kind: 'straight'; length: Dim } | { kind: 'bend'; radius: Dim; angleDegrees: number; toward: 'x' | '-x' | 'y' | '-y' })[] }
  /** A ruled loft through sketches at increasing heights (each section's edges to the next one's). */
  /** `from`: the sketches the sections were carried over from, when they lay on offset planes (used by the loft). */
  | { kind: 'loft'; sections: { sketch: number; z: Dim }[]; smooth?: boolean; from?: number[] }
  /** A body read from a STEP file (the file's text is kept in the document). */
  /** `solids`: how many solids the file holds when more than one; each is then its own body (side `part<k>`). */
  | { kind: 'import'; name: string; step: string; solids?: number }
  /** Hollowed to walls `thickness` thick, the named faces removed (none: a closed hollow). */
  | { kind: 'shell'; parent: BodyRef; thickness: Dim; open: string[] }
  /** Edges by their persistent B-rep names (they follow the features, so edits keep the selection). */
  | { kind: 'chamfer'; parent: BodyRef; edges: string[]; distance: Dim }
  | { kind: 'fillet'; parent: BodyRef; edges: string[]; radius: Dim }
  /** Along `axis` (default z) through the body; `side` is the face it was picked on (default max). */
  | { kind: 'hole'; parent: BodyRef; center: [Dim, Dim]; radius: Dim; axis?: Axis; side?: 'min' | 'max'; depth?: Dim };

import type { RenderSettings } from './render';
import type { SketchRule } from '../sketch/terms';
import type { DirectGeometry } from './direct';
import type { DrawingSettings } from '../drawing/types';
import { rotationSteps, type Mate } from '../assembly/mates';
import { flattenAssembly } from '../assembly/flatten';

export interface StudioDoc {
  format: 'barocss-cad-model';
  schema: 1;
  units: 'mm';
  parameters: Record<string, number>;
  nodes: ModelNode[];
  outputs: Record<string, BodyRef>;
  /** How the part is rendered (the Render workspace); absent until first rendered. */
  render?: RenderSettings;
  /** NURBS curves and surfaces beside the model (imported CAD sources and what tools made of them). */
  direct?: DirectGeometry;
  /** Other parts placed beside this one (a simple assembly). */
  instances?: PartInstance[];
  /** The 2D drawing of the part (the Drawing workspace); absent until first drawn. */
  drawing?: DrawingSettings;
  /**
   * Bodies' own names, colours and visibility, by the feature each body was first made by (`b<node>`, with
   * `_<side>` for a split's or an import's parts): they stay with a body as features are added to it.
   */
  bodies?: Record<string, BodyLook>;
  /** Mates placing instances by their faces (see assembly/mates.ts). */
  mates?: Mate[];
}

/** A copy of another part placed by a rotation (degrees about X, then Y, then Z, through the origin) and a move. */
export interface PartInstance {
  id: string; name: string;
  /** The part as inserted (a sub-assembly keeps its own instances, placed as saved). */
  doc: StudioDoc;
  position: [number, number, number];
  rotation: [number, number, number];
  hidden?: boolean;
  /** Fixed in place: mates never move it. */
  grounded?: boolean;
}

/** An instance's part with its placement applied: every body rotated and moved by the part's own features. */
export function placedDoc(inst: PartInstance): StudioDoc {
  // (A sub-assembly: its own instances folded in as features, see assembly/flatten.ts.)
  const flat = flattenAssembly(inst.doc), base = prefixDoc(flat, flat.nodes.length);
  let doc = base;
  for (const ref of Object.values(base.outputs)) {
    let at: BodyRef = ref;
    // (Any rotation: the kernel turns about X and Y by quarter turns only, see rotationSteps.)
    rotationSteps(inst.rotation).forEach(({ axis, angleDegrees }) => {
      doc = { ...doc, nodes: [...doc.nodes, { kind: 'rotate', parent: at, axis, angleDegrees }] };
      at = { node: doc.nodes.length - 1, side: 'solid' };
    });
    if (inst.position.some(v => v !== 0)) {
      doc = { ...doc, nodes: [...doc.nodes, { kind: 'translate', parent: at, offset: [...inst.position] }] };
    }
  }
  return prefixDoc(doc, doc.nodes.length);
}

export const emptyDoc = (): StudioDoc => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} });

export const isSolidNode = (node: ModelNode) => node.kind !== 'sketch';

export function parentsOf(node: ModelNode): number[] {
  switch (node.kind) {
    case 'sketch': return [];
    case 'extrude': case 'revolve': case 'sweep': return [node.sketch];
    case 'loft': return [...node.sections.map(s => s.sketch), ...(node.from ?? [])];
    case 'import': return [];
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
    if (node.kind === 'sketch' || node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'sweep' || node.kind === 'loft' || node.kind === 'import') return;
    const refs = node.kind === 'union' || node.kind === 'intersect' ? [node.left, node.right] : node.kind === 'difference' ? [node.parent, node.tool] : [node.parent];
    refs.forEach(r => consumed.add(r.side === 'solid' ? String(r.node) : `${r.node}_${r.side}`));
  });
  const refs: BodyRef[] = [];
  nodes.forEach((node, index) => {
    if (!isSolidNode(node) || consumed.has(String(index))) return;
    if (node.kind === 'split') (['negative', 'positive'] as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
    else if (node.kind === 'import' && (node.solids ?? 1) > 1) Array.from({ length: node.solids! }, (_, k) => `part${k}` as const).forEach(side => { if (!consumed.has(`${index}_${side}`)) refs.push({ node: index, side }); });
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

/**
 * A loft's top section from a drawn (numeric) sketch: the same shape, a circle or a rectangle, sized
 * `scale` times the sketch about the centre of its outline's box.
 */
export function loftTop(sketch: SketchNode, shape: 'scaled' | 'circle' | 'rectangle', scale: number): SketchNode {
  const pts: [number, number][] = sketch.profile === 'rectangle' ? [sketch.min, sketch.max].map(p => p.map(Number) as [number, number])
    : sketch.profile === 'circle' ? [[Number(sketch.center[0]) - Number(sketch.radius), Number(sketch.center[1]) - Number(sketch.radius)], [Number(sketch.center[0]) + Number(sketch.radius), Number(sketch.center[1]) + Number(sketch.radius)]]
      : sketch.profile === 'polygon' ? sketch.points.map(p => p.map(Number) as [number, number]) : sketch.segments.map(g => g.start.map(Number) as [number, number]);
  const lo = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], hi = [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  const c: [number, number] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], at = (p: readonly Dim[]): [number, number] => [c[0] + (Number(p[0]) - c[0]) * scale, c[1] + (Number(p[1]) - c[1]) * scale];
  // Loft sections share their plane.
  const on = sketch.plane ? { plane: sketch.plane } : {};
  if (shape === 'circle') return { kind: 'sketch', profile: 'circle', center: c, radius: Math.min(hi[0] - lo[0], hi[1] - lo[1]) / 2 * scale, ...on };
  if (shape === 'rectangle') return { kind: 'sketch', profile: 'rectangle', min: at(lo), max: at(hi), ...on };
  switch (sketch.profile) {
    case 'rectangle': return { ...sketch, min: at(sketch.min), max: at(sketch.max) };
    case 'circle': return { ...sketch, center: at(sketch.center), radius: Number(sketch.radius) * scale };
    case 'polygon': return { ...sketch, points: sketch.points.map(at) };
    case 'loop': return { ...sketch, segments: sketch.segments.map(g => g.kind === 'line' ? { ...g, start: at(g.start) } : { ...g, start: at(g.start), center: at(g.center) }) };
  }
}

/**
 * Nodes edited by hand (the feature editor, a feature's own fields): a shape's solid whose sketch or
 * itself changed is no longer what its shape values make, so it stops remembering them.
 */
export function dropStaleMade(before: readonly ModelNode[], after: ModelNode[]): ModelNode[] {
  const same = (i: number) => JSON.stringify(before[i]) === JSON.stringify(after[i]);
  return after.map((n, i) => (n.kind === 'extrude' || n.kind === 'revolve') && n.made && (!same(i) || !same(n.sketch)) ? (({ made: _made, ...rest }) => rest as ModelNode)(n) : n);
}
/** A shape command's solid by its shape and main sizes: Box 32×32×16, Cylinder Ø16×24, Sphere Ø20 … */
export function shapeLabel(made: Made): string {
  const v = (k: string) => fmt(Number(made.values[k])), d = (k: string) => fmt(Number(made.values[k]) * 2);
  switch (made.command) {
    case 'box': return `Box ${v('w')}×${v('d')}×${v('h')}`;
    case 'cylinder': return `Cylinder Ø${d('r')}×${v('h')}`;
    case 'sphere': return `Sphere Ø${d('r')}`;
    case 'cone': return Number(made.values.rt) > 0 ? `Frustum Ø${d('r')}–Ø${d('rt')}×${v('h')}` : `Cone Ø${d('r')}×${v('h')}`;
    case 'torus': return `Torus Ø${d('R')}×Ø${d('r')}`;
    case 'tube': return `Tube Ø${d('r')}/Ø${d('ri')}×${v('h')}`;
    case 'wedge': return `Wedge ${v('w')}×${v('d')}×${v('h')}`;
    case 'prism': return `Prism ${v('n')}-sided ${v('s')}×${v('h')}`;
    default: return made.command;
  }
}
export function featureLabel(node: ModelNode, index: number, nodes: readonly ModelNode[]): string {
  const n = (v: Dim) => typeof v === 'number' ? fmt(v) : v.parameter;
  if ((node.kind === 'extrude' || node.kind === 'revolve') && node.made) return shapeLabel(node.made);
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
    case 'import': return `Import ${node.name}`;
    case 'loft': return `Loft ${node.sections.length} sections${node.smooth ? ' · smooth' : ''}`;
    case 'sweep': return `Pipe ${node.path.length === 1 ? '1 step' : `${node.path.length} steps`}`;
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
