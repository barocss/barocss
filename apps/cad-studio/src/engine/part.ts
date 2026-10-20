// The studio document as a kernel part document: a node is the feature of its stable id (`n<k>`, see ids.ts),
// so persistent face and edge names read `n1.side0`, `n1.top`, `n2.side0|n1.top` and keep their names as other
// features come and go; a kernel output `n5` / `n5/0` / `n5/1` is the studio body `b5` / `b5_negative` /
// `b5_positive` (keyed by the id too); the solids of a STEP file holding several are `n5/k`, `b5_part<k>`.
import { getBlob } from './blobs';
import { mirrorCage } from '@barocss/cad';
import type { BendTable, CadPartDocument, CadPartFeature, CadPartFrameOverride, CadPartSection } from '@barocss/cad';
import { holeCentres, type BodyRef, type FrameOverride, type MemberSection, type ModelNode, type StudioDoc } from './doc';
import { featureId, nodeIndexOf, serialOf, withIds } from './ids';
import { rotationSteps } from '../assembly/mates';

// (The nodes being converted: a feature's id and its references' ids are read from them.)
let current: readonly ModelNode[] = [];
const id = (index: number) => featureId(current, index);
const ref = (r: BodyRef) => r.side === 'negative' ? `${id(r.node)}/0` : r.side === 'positive' ? `${id(r.node)}/1` : r.side.startsWith('part') ? `${id(r.node)}/${r.side.slice(4)}` : id(r.node);

/** A sheet node's K, as the kernel takes it: its K-factor or its bend table (R12.4). */
const sheetK = (n: { kFactor?: number; bendTable?: BendTable }) => (n.bendTable ? { bendTable: n.bendTable } : { kFactor: n.kFactor! }) as { kFactor: number } | { bendTable: BendTable };
/** One node as a kernel feature (`nodes`: the document's, for its ids; without them node i is `n<i>`). */
/** A member section for the kernel: a sketch section's node index as its feature id (FR2, D124). */
const kernelSection = (s: MemberSection, toId: (i: number) => string): CadPartSection => s.kind === 'sketch' ? { kind: 'sketch', sketch: toId(s.sketch) } : s;
/** A frame's override for the kernel: its sketch section by feature id. */
function kernelOverride(o: FrameOverride): CadPartFrameOverride { const { section, ...rest } = o; return { ...rest, ...(section ? { section: kernelSection(section, id) } : {}) }; }
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
    case 'decimate': return { ...at, kind: 'decimate', target: ref(node.parent), ...(node.ratio !== undefined ? { ratio: node.ratio } : {}), ...(node.triangles !== undefined ? { triangles: node.triangles } : {}), ...(node.maxError !== undefined ? { maxError: node.maxError } : {}), ...(node.featureAngle !== undefined ? { featureAngle: node.featureAngle } : {}) };
    case 'sweep': return { ...at, kind: 'sweep', sketch: id(node.sketch), path: node.path };
    case 'sweep-curve': return { ...at, kind: 'sweep-curve', sketch: id(node.sketch), path: node.path };
    case 'loft': return { ...at, kind: 'loft', sections: node.sections.map(s => ({ sketch: id(s.sketch), z: s.z })), ...(node.smooth ? { smooth: true } : {}) };
    case 'import': return { ...at, kind: 'import', step: node.step, ...((node.solids ?? 1) > 1 ? { each: true } : {}) };
    case 'mesh': return { ...at, kind: 'mesh', ...meshArrays(node.repair ? { blob: node.repair.result } : node), ...(node.repair ? repaired(node.repair) : {}), ...(node.representation ? { representation: node.representation } : {}), ...((node.pieces ?? 1) > 1 ? { each: true } : {}) };
    case 'thread': return { ...at, kind: 'thread', diameter: node.diameter, pitch: node.pitch, center: node.center, seat: node.seat, ...(node.length !== undefined ? { length: node.length } : {}), ...(node.hex ? { hex: node.hex } : {}), ...(node.form ? { form: node.form } : {}) };
    case 'shell': return { ...at, kind: 'shell', target: ref(node.parent), thickness: node.thickness, open: node.open };
    case 'chamfer': return { ...at, kind: 'chamfer', target: ref(node.parent), edges: node.edges, distance: node.distance };
    case 'sheet-base': return { ...at, kind: 'sheet-base', sketch: id(node.sketch), thickness: node.thickness, bendRadius: node.bendRadius, ...sheetK(node), ...(node.reverse ? { reverse: true } : {}) };
    case 'sheet-corner-relief': return { ...at, kind: 'sheet-corner-relief', target: ref(node.parent), corner: node.edges[0], shape: node.shape, size: node.size };
    case 'sheet-flange': return { ...at, kind: 'sheet-flange', target: ref(node.parent), edge: node.edges[0], length: node.length, ...(node.angleDegrees !== undefined ? { angleDegrees: node.angleDegrees } : {}), ...(node.bendRadius !== undefined ? { bendRadius: node.bendRadius } : {}), ...(node.measure ? { measure: node.measure } : {}), ...(node.position ? { position: node.position } : {}), ...(node.offsets ? { offsets: node.offsets } : {}), ...(node.relief ? { relief: node.relief } : {}) };
    case 'frame': return { ...at, kind: 'frame', points: node.points, segments: node.segments, section: kernelSection(node.section, id),
      ...(node.anchor ? { anchor: node.anchor } : {}), ...(node.offset ? { offset: node.offset } : {}), ...(node.roll ? { roll: node.roll } : {}), ...(node.mirror ? { mirror: true } : {}), ...(node.up ? { up: node.up } : {}),
      ...(node.overrides?.length ? { overrides: node.overrides.map(kernelOverride) } : {}), ...(node.corners ? { corners: node.corners } : {}), ...(node.trims?.length ? { trims: node.trims.map(t => 'body' in t ? { member: t.member, end: t.end, body: ref(t.body) } : t) } : {}) };
    case 'frame-member': return { ...at, kind: 'frame-member', section: node.section.kind === 'sketch' ? { kind: 'sketch', sketch: id(node.section.sketch) } : node.section, start: node.start, end: node.end,
      ...(node.anchor ? { anchor: node.anchor } : {}), ...(node.offset ? { offset: node.offset } : {}), ...(node.roll ? { roll: node.roll } : {}), ...(node.up ? { up: node.up } : {}) };
    case 'sheet-contour': return { ...at, kind: 'sheet-contour', path: node.path, ...(node.plane ? { plane: node.plane } : {}), side: node.side, width: node.width, thickness: node.thickness, bendRadius: node.bendRadius, ...sheetK(node) };
    case 'thicken': return { ...at, kind: 'thicken', surface: node.surface, thickness: node.thickness, ...(node.side ? { side: node.side } : {}) };
    case 'subd': return { ...at, kind: 'subd', cage: node.mirror ? mirrorCage(node.cage, node.mirror) as typeof node.cage : node.cage };
    // (A library part's own feature: its output passed on under the node's id; its features come before it, featuresOf.)
    case 'library': {
      // (Placed: its output turned and moved, `<prefix>_placed`; added to a body: united with it, as one step.)
      const out = node.placement ? `${node.prefix}_placed` : node.outputs[0];
      return node.addTo ? { ...at, kind: node.cut ? 'difference' : 'union', target: ref(node.addTo), tool: out } : { ...at, kind: 'translate', target: out, offset: [0, 0, 0] };
    }
    case 'rack': {
      const own = node.mesh ? { mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction !== undefined ? { direction: node.mesh.direction } : {}), ...(node.mesh.centerDistance !== undefined ? { centerDistance: node.mesh.centerDistance } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) } }
        : { origin: node.origin, ...(node.from ? { from: node.from } : {}), ...(node.angle ? { angle: node.angle } : {}) };
      // (Meshing: the module, helix angle and hand from the gear — the opposite hand; the kernel derives them.)
      return { ...at, kind: 'spur-rack', ...(node.mesh ? {} : { module: node.module }), teeth: node.teeth, faceWidth: node.faceWidth, height: node.height, generator: node.generator, ...own, ...(node.rootFillet !== undefined ? { rootFillet: node.rootFillet } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'gear': {
      const own = node.mesh ? { mesh: { gear: id(node.mesh.gear), ...(node.mesh.direction ? { direction: node.mesh.direction } : {}), ...(node.mesh.centerDistance !== undefined ? { centerDistance: node.mesh.centerDistance } : {}), ...(node.mesh.phase ? { phase: node.mesh.phase } : {}) } }
        : { center: node.center, ...(node.from ? { from: node.from } : {}), ...(node.rotation ? { rotation: node.rotation } : {}) };
      // (Helical: `module` is the normal module; a meshing gear takes the other's helix angle, of the opposite hand.)
      const helix = helixOf(node, nodes ?? current);
      const modules = helix ? { normalModule: node.module, helixAngle: helix.angle, hand: helix.hand } : { module: node.module };
      return { ...at, kind: 'spur-gear', ...modules, teeth: node.teeth, faceWidth: node.faceWidth, generator: node.generator, ...own, ...(node.toolTipRadius !== undefined ? { toolTipRadius: node.toolTipRadius } : {}), ...(node.profileShift ? { profileShift: node.profileShift } : {}), ...(node.bore !== undefined ? { bore: node.bore } : {}), ...(node.thicknessReduction !== undefined ? { thicknessReduction: node.thicknessReduction } : {}) };
    }
    case 'sew': return { ...at, kind: 'sew', surfaces: node.surfaces, ...(node.tolerance !== undefined ? { tolerance: node.tolerance } : {}) };
    case 'draft': return { ...at, kind: 'draft', target: ref(node.parent), faces: node.faces, angleDegrees: node.angleDegrees };
    case 'fillet': return { ...at, kind: 'fillet', target: ref(node.parent), edges: node.edges, ...(node.radii ? { radii: node.radii.map(p => ({ at: p.at, radius: p.radius })) } : { radius: node.radius }), ...(node.section ? { section: node.section } : {}) };
  }
}

/** A node's kernel features: one, or a patterned hole's copies one after another (the last named `n<i>`). */
function featuresOf(node: ModelNode, index: number): CadPartFeature[] {
  if (node.kind === 'library') return [...node.features, ...placementOf(node), featureOf(node, index, current)];
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
    const makes = node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'sweep' || node.kind === 'loft' || node.kind === 'import' || node.kind === 'mesh' || node.kind === 'subd' || node.kind === 'gear' || node.kind === 'rack' || node.kind === 'library' || node.kind === 'thread' || node.kind === 'sweep-curve' || node.kind === 'thicken' || node.kind === 'sew' || node.kind === 'sheet-base' || node.kind === 'sheet-contour' || node.kind === 'frame-member' || node.kind === 'frame';
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
      // (A library part added to a body, suppressed or its body gone: the body passes on as it was, or is gone.)
      if (node.kind === 'library' && node.addTo) { if (gone.has(node.addTo.node)) { gone.add(i); return; } if (node.suppressed) { pass(i, node.addTo); return; } features.push(...featuresOf(node, i)); return; }
      if (node.suppressed || ('from' in node && Array.isArray(node.from) && node.from.some(p => gone.has(p))) || ((node.kind === 'gear' || node.kind === 'rack') && node.mesh && gone.has(node.mesh.gear))) { gone.add(i); return; }
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
  if (m[2] !== undefined && (nodes?.[i]?.kind === 'import' || nodes?.[i]?.kind === 'separate' || nodes?.[i]?.kind === 'mesh' || nodes?.[i]?.kind === 'frame')) return `b${k}_part${m[2]}`;
  return m[2] === undefined ? `b${k}` : `b${k}_${m[2] === '0' ? 'negative' : 'positive'}`;
};

/**
 * A mesh node's arrays as typed arrays: from the blob store when the node names blobs (M1), else made once per
 * inline node array (R3.2). The kernel takes them without copying, freezing or writing them into its reuse key (it
 * hashes each array object once); a blob or a node's arrays never change.
 */
const typedMeshes = new WeakMap<readonly number[], { positions: Float64Array; indices: Uint32Array }>();
function meshArrays(node: { positions?: number[]; indices?: number[]; blob?: { positions: string; indices: string } }): { positions: Float64Array | Float32Array; indices: Uint32Array } {
  if (node.blob) {
    // (Single-precision positions as stored: the kernel widens them when it reads them, D45.)
    const p = getBlob(node.blob.positions), i = getBlob(node.blob.indices);
    if (!(p instanceof Float64Array || p instanceof Float32Array) || !(i instanceof Uint32Array)) throw new Error(`The mesh's data (${(p ? node.blob.indices : node.blob.positions).slice(0, 12)}…) is not loaded: open the file it was saved in again`);
    return { positions: p, indices: i };
  }
  const P = node.positions ?? [], I = node.indices ?? [];
  let t = typedMeshes.get(P);
  if (!t || t.indices.length !== I.length) { t = { positions: Float64Array.from(P), indices: Uint32Array.from(I) }; typedMeshes.set(P, t); }
  return t;
}
/** A repair's fill patches (its faces of their own) and, when it could not close the mesh, a sheet said so (D47). */
function repaired(r: { result: { fill: string }; report: { closed: boolean } }): { groups?: Int32Array; open?: true } {
  const fill = getBlob(r.result.fill);
  return { ...(fill instanceof Int32Array ? { groups: fill } : {}), ...(r.report.closed ? {} : { open: true as const }) };
}

/** A gear node's helix: its own, or — meshing — the other gear's angle with the opposite hand (none: spur). */
export function helixOf(node: Extract<ModelNode, { kind: 'gear' }>, nodes: readonly ModelNode[]): { angle: number; hand: 'right' | 'left' } | null {
  if (node.mesh) {
    const other = nodes[node.mesh.gear];
    const h = other?.kind === 'gear' && other !== node ? helixOf(other, nodes) : null;
    return h ? { angle: h.angle, hand: h.hand === 'right' ? 'left' : 'right' } : null;
  }
  return node.helixAngle ? { angle: node.helixAngle, hand: node.hand ?? 'right' } : null;
}

/** A placed library part's turns (about X, then Y, then Z, through the origin) and move, ending at `<prefix>_placed`. */
function placementOf(node: Extract<ModelNode, { kind: 'library' }>): CadPartFeature[] {
  if (!node.placement) return [];
  const steps = rotationSteps(node.placement.rotation), out: CadPartFeature[] = [];
  let target = node.outputs[0];
  steps.forEach((s, k) => { const id = `${node.prefix}_turn${k}`; out.push({ id, kind: 'rotate', target, axis: s.axis, angleDegrees: s.angleDegrees } as CadPartFeature); target = id; });
  out.push({ id: `${node.prefix}_placed`, kind: 'translate', target, offset: node.placement.position } as CadPartFeature);
  return out;
}

