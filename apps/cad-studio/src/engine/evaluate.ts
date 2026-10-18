import { evaluateCadPart, FACET_PREVIEW_TRIANGLES, type Brep, type CadPartSnapshot, exportStep } from '@barocss/cad';
import { bodyMesh, type DisplayEdge, type DisplayMesh } from './mesh';
import { friendly, type FriendlyError } from './errors';
import { bodyKeyOf, toPartDocument } from './part';
import { placedDoc, type BodyRef, type ModelNode, type Side, type StudioDoc } from './doc';
import { bodyNodeOf } from './ids';

/** A kernel output's body key and the node and side it is now. */
function keyed(outputId: string, nodes: readonly ModelNode[]): { key: string; ref?: BodyRef } {
  const key = bodyKeyOf(outputId, nodes), at = bodyNodeOf(nodes, key);
  return at ? { key, ref: { node: at.node, side: at.side as Side } } : { key };
}

export interface BodyResult {
  /** `b<k>` by the stable id of the feature that made it (engine/ids.ts); `ref`: that feature's node and side now. */
  key: string;
  ref?: BodyRef;
  /** 'upright' (Z-prismatic: holes, fillets, curved Booleans), 'planar' or 'curved' (general B-rep). */
  family: string; mesh: DisplayMesh;
  volumeMM3: number | null; massG: number | null;
  /** Centre of mass (mm), with the volume (uniform density). */
  centroid?: [number, number, number];
  /** Inertia about the centre of mass (kg·m², aluminium at 2700 kg/m³; scale by density for another material). */
  inertia?: number[][];
  /** A body in several separate pieces (a cut right through it): how many. */
  pieces?: number;
}
export type EvalResult =
  | { ok: true; revision: number; bodies: BodyResult[]; ms: number }
  | { ok: false; revision: number; error: FriendlyError; ms: number };

const ALUMINIUM = 2700;
// The last successful evaluation: unchanged features are reused by the next one.
let last: CadPartSnapshot | null = null;

// Unchanged features keep their B-rep objects from one evaluation to the next: their tessellation (per
// quality) and mass properties are worked out once. The meshes handed out are copies (the worker
// transfers their buffers away).
const meshes = new WeakMap<Brep, Map<number, DisplayMesh>>();
const masses = new WeakMap<Brep, ReturnType<CadPartSnapshot['outputs'][number]['massProperties']> | null>();
function meshOf(brep: Brep, revision: number, quality: number): DisplayMesh {
  let byQuality = meshes.get(brep); if (!byQuality) meshes.set(brep, byQuality = new Map());
  let m = byQuality.get(quality); if (!m) byQuality.set(quality, m = bodyMesh(brep, revision, quality));
  return { ...m, positions: m.positions.slice(), normals: m.normals.slice(), faceOfVertex: m.faceOfVertex.slice(), indices: m.indices.slice(), edgeLines: m.edgeLines.slice(), edgeOfSegment: m.edgeOfSegment.slice() };
}
/** A body's evaluated result: its mesh, and its volume, mass, centroid and inertia when it has a volume. */
function bodyOf(o: CadPartSnapshot['outputs'][number], doc: StudioDoc, revision: number, quality: number): BodyResult {
  let m = masses.get(o.brep);
  if (m === undefined) { try { m = o.massProperties(ALUMINIUM); } catch { m = null; /* no positive volume */ } masses.set(o.brep, m); }
  const mass = m ? { volumeMM3: m.volumeMM3, massG: m.massKG * 1000, centroid: [m.centroidMM[0], m.centroidMM[1], m.centroidMM[2]] as [number, number, number], inertia: m.inertiaCentroidKgM2.map(r => [...r]) } : { volumeMM3: null, massG: null };
  return { ...keyed(o.id, doc.nodes), family: o.representation, mesh: meshOf(o.brep, revision, quality), ...mass, ...(o.bodyCount > 1 ? { pieces: o.bodyCount } : {}) };
}

function snapshotOf(doc: StudioDoc): CadPartSnapshot {
  const part = toPartDocument(doc);
  return last ? last.withDocument(part) : evaluateCadPart(part);
}

export function evaluateDoc(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const snapshot = snapshotOf(doc); last = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => bodyOf(o, doc, revision, quality));
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/** A preview's planar-path limit for meshes (F0, D42): about a second, so it stays live; applying runs up to the committed limit. */
const PREVIEW = { facetExplodeTriangles: FACET_PREVIEW_TRIANGLES };
/** The previews' caches: a command's, and the section view's (each reuses its own last snapshot). */
const lastPreview: Record<'preview' | 'section', CadPartSnapshot | null> = { preview: null, section: null };
/**
 * A command's preview: through its own cache (the features it leaves alone are not built again while
 * it is dragged) and without mass properties (worked out when the part is evaluated).
 */
export function evaluatePreview(doc: StudioDoc, revision: number, quality = 8, slot: 'preview' | 'section' = 'preview'): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(doc), last = lastPreview[slot], snapshot = last ? last.withDocument(part) : evaluateCadPart(part, undefined, PREVIEW); lastPreview[slot] = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => ({ ...keyed(o.id, doc.nodes), family: o.representation, mesh: meshOf(o.brep, revision, quality), volumeMM3: null, massG: null }));
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    lastPreview[slot] = null;
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/** Another part's bodies on their own (instances: not through the main part's cache). */
// The last placed part: the next one (another copy of the same part, placed elsewhere) reuses its features.
let lastPart: CadPartSnapshot | null = null;
export function evaluatePart(doc: StudioDoc, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(doc), snapshot = lastPart ? lastPart.withDocument(part) : evaluateCadPart(part); lastPart = snapshot;
    const bodies: BodyResult[] = snapshot.outputs.map(o => bodyOf(o, doc, revision, quality));
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}

/**
 * A placed part's bodies for display. The placed part is evaluated as before (its features reused from
 * the copy before it), but a body whose faces and edges come out as the part's own at the origin — the
 * same names in the same order — shows the origin body's mesh moved by the placement (its tessellation
 * and mass worked out once for every copy): the mesh, its faces' and edges' points and directions, the
 * bounds, the centre of mass and the inertia. Other bodies are tessellated as placed.
 */
export function evaluatePlaced(placed: StudioDoc, base: StudioDoc, place: { m: number[]; t: [number, number, number] }, revision: number, quality = 8): EvalResult {
  const t0 = performance.now();
  try {
    const part = toPartDocument(placed), snapshot = lastPart ? lastPart.withDocument(part) : evaluateCadPart(part); lastPart = snapshot;
    const basePart = toPartDocument(base), origin = lastBase ? lastBase.withDocument(basePart) : evaluateCadPart(basePart); lastBase = origin;
    const bodies = snapshot.outputs.map((o, i) => {
      const at = origin.outputs[i];
      if (!at || origin.outputs.length !== snapshot.outputs.length || !samePlacedBody(o.brep, at.brep, place.m, place.t)) return bodyOf(o, placed, revision, quality);
      return { ...placeBody(bodyOf(at, base, revision, quality), place.m, place.t), ...keyed(o.id, placed.nodes) };
    });
    return { ok: true, revision, bodies, ms: performance.now() - t0 };
  } catch (cause) {
    return { ok: false, revision, error: friendly(cause instanceof Error ? cause.message : String(cause)), ms: performance.now() - t0 };
  }
}
let lastBase: CadPartSnapshot | null = null;
/**
 * Whether a placed body is the part's body at the origin moved by the placement: the same faces and edges
 * by name, in order — but for the numbers of repeated names (`x#2`), which an upright body's turn about Z
 * renumbers by position (they are display names here: mates read faces by name without the number) — and
 * its corners where the origin body's go under the placement (their box, to 1e-6 of its size).
 */
function samePlacedBody(placed: Brep, origin: Brep, m: readonly number[], t: readonly number[]): boolean {
  if (placed.faces.length !== origin.faces.length || placed.edges.length !== origin.edges.length || placed.vertices.length !== origin.vertices.length) return false;
  if (!sameNames(placed.faces, origin.faces) || !sameNames(placed.edges, origin.edges)) return false;
  const a = boxOf(placed.vertices, null, null), b = boxOf(origin.vertices, m, t), size = Math.max(1, ...a.map(Math.abs));
  for (let k = 0; k < 6; k++) if (Math.abs(a[k] - b[k]) > 1e-6 * size) return false;
  return true;
}
const unnumbered = (name: string | undefined) => (name ?? '').replace(/#\d+/g, '');
/** The same names in order, or the same names (unnumbered) as sorted lists. */
function sameNames(a: readonly { name?: string }[], b: readonly { name?: string }[]): boolean {
  let same = true;
  for (let i = 0; i < a.length && same; i++) same = a[i].name === b[i].name;
  if (same) return true;
  const x = a.map(f => unnumbered(f.name)).sort(), y = b.map(f => unnumbered(f.name)).sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
/** The box of points (moved by m, t when given): [min x, y, z, max x, y, z]. */
function boxOf(vs: readonly { point: readonly number[] }[], m: readonly number[] | null, t: readonly number[] | null): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const v of vs) {
    const p = m && t ? move(m, t, v.point) : v.point;
    for (let k = 0; k < 3; k++) { out[k] = Math.min(out[k], p[k]); out[k + 3] = Math.max(out[k + 3], p[k]); }
  }
  return out;
}
const move = (m: readonly number[], t: readonly number[], p: readonly number[]): [number, number, number] => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]];
const turn = (m: readonly number[], p: readonly number[]): [number, number, number] => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
/** In place: each xyz triple of a ← m·xyz (+ t). */
function moveAll(a: Float32Array, m: readonly number[], t: readonly number[] | null): void {
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], z = a[i + 2];
    a[i] = m[0] * x + m[1] * y + m[2] * z + (t ? t[0] : 0); a[i + 1] = m[3] * x + m[4] * y + m[5] * z + (t ? t[1] : 0); a[i + 2] = m[6] * x + m[7] * y + m[8] * z + (t ? t[2] : 0);
  }
}
function placeBody(b: BodyResult, m: readonly number[], t: readonly number[]): BodyResult {
  const src = b.mesh, positions = src.positions, normals = src.normals, edgeLines = src.edgeLines;
  moveAll(positions, m, t); moveAll(normals, m, null); moveAll(edgeLines, m, t);
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { const v = positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  const faces = src.faces.map(f => ({ ...f, normal: turn(m, f.normal), centroid: move(m, t, f.centroid) }));
  const edges = src.edges.map(e => {
    const a = move(m, t, e.a), z = move(m, t, e.b), d = [z[0] - a[0], z[1] - a[1], z[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
    // (The axis an edge runs along, as the mesh reads it: a unit direction within 1e-9 of one.)
    const axis: DisplayEdge['axis'] = e.straight ? (Math.abs(Math.abs(d[0] / l) - 1) < 1e-9 ? 'x' : Math.abs(Math.abs(d[1] / l) - 1) < 1e-9 ? 'y' : Math.abs(Math.abs(d[2] / l) - 1) < 1e-9 ? 'z' : null) : null;
    return { ...e, a, b: z, axis };
  });
  const mesh = { ...src, positions, normals, edgeLines, faces, edges, bounds: { min, max } };
  const R = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
  const inertia = b.inertia ? R.map((_, i) => R.map((__, j) => { let v = 0; for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) v += R[i][k] * b.inertia![k][l] * R[j][l]; return v; })) : undefined;
  return { ...b, mesh, ...(b.centroid ? { centroid: move(m, t, b.centroid) } : {}), ...(inertia ? { inertia } : {}) };
}

/** The part's bodies as B-reps, keyed as the studio keys them (for exact views: chat/views.ts). */
export function partBreps(doc: StudioDoc): { key: string; brep: Brep }[] {
  return snapshotOf(doc).outputs.map(o => ({ key: bodyKeyOf(o.id, doc.nodes), brep: o.brep }));
}

/** The whole part (every visible body, and its placed instances) as one STEP file, or the reason it cannot be written. */
/** `meshes`: how mesh bodies are written (STEP export option, R3.5: auto, tessellated or planar). */
export function stepFor(doc: StudioDoc, name: string, meshes?: 'auto' | 'tessellated' | 'planar'): { text: string } | { error: string } {
  try {
    const breps = snapshotOf(doc).outputs.map(o => o.brep);
    for (const inst of doc.instances ?? []) if (!inst.hidden) breps.push(...evaluateCadPart(toPartDocument(placedDoc(inst))).outputs.map(o => o.brep));
    if (!breps.length) return { error: 'There is no body to export.' };
    return { text: exportStep(breps, { name, ...(meshes ? { meshes } : {}) }) };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}

export function stlFor(doc: StudioDoc, key: string): Uint8Array | null {
  try {
    const output = snapshotOf(doc).outputs.find(o => bodyKeyOf(o.id, doc.nodes) === key);
    return output ? output.exportStl() : null;
  } catch { return null; }
}

/**
 * The part's visible bodies and its shown instances' as B-reps (for drawings), with a name prefix for
 * each (an instance's `<id>/`, so its edges are told apart), or the reason they cannot be evaluated.
 */
export function brepsFor(doc: StudioDoc): { breps: Brep[]; prefixes: string[] } | { error: string } {
  try {
    const breps = snapshotOf(doc).outputs.map(o => o.brep), prefixes = breps.map(() => '');
    for (const inst of doc.instances ?? []) if (!inst.hidden) for (const o of evaluateCadPart(toPartDocument(placedDoc(inst))).outputs) { breps.push(o.brep); prefixes.push(`${inst.id}/`); }
    return { breps, prefixes };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
}
