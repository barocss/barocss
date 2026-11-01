// Facade adapters over the R7 MMGS core contract. Results are plain data; expensive work stays explicit.
import type { StudioDoc } from '../engine/doc';
import { evaluateDoc, exportStudioStep, type BodyResult } from '../engine/evaluate';
import { bodyMass } from '../app/mass';
import { materialIdOf, withLook } from '../app/bodies';
import { fromEvaluation, fromExport, refuse } from './refusal';


/** A body's display triangles: its key, positions and normals (x, y, z per vertex) and indices — the shape gpu's GeometryInput takes. */
export type { MeshData, MassResult } from '@barocss/cad/api';
import type { MeshData, MassResult } from '@barocss/cad/api';


// (The evaluation's revision tag: the facade keeps no revision history of its own; the core's evaluation memo keys on the document.)
const REVISION = 0;
// R7 requires the outer core to return g and g·mm². Do not add a second inertia conversion.

/** The document's bodies as the core evaluates them, or its refusal. */
export function bodiesOf(doc: StudioDoc): BodyResult[] {
  const result = evaluateDoc(doc, REVISION);
  if (!result.ok) throw fromEvaluation(result.error);
  return result.bodies;
}

/** A body's mass properties at a density (g/cm³). */
export function massOf(body: BodyResult, density: number): MassResult {
  const props = bodyMass(body, density);
  if (!props || body.volume === null) throw refuse('MASS_UNKNOWN', `the body ${body.key} has no volume the core could work out`, 'evaluate');
  return { volume: body.volume, mass: props.mass, centroid: props.centroid, inertia: props.inertia.map(row => [...row]) };
}

/** Each body's display triangles and lines, as the core's evaluation made them, with the material id the body names. */
export function meshesOf(doc: StudioDoc): MeshData[] {
  return bodiesOf(doc).map(b => {
    const material = materialIdOf(doc, b);
    return { key: b.key, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), indices: b.mesh.indices.slice(), lines: b.mesh.edgeLines.slice(), ...(material !== undefined ? { material } : {}) };
  });
}

/** The document's exact solids as one STEP AP214 file. */
export function stepOf(doc: StudioDoc, name: string): string {
  // (A band sheet is not in STEP yet and this call has no channel to say so: refused rather than dropped silently.)
  try {
    const step = exportStudioStep(doc, { name }), sheet = step.omitted?.find(x => x.startsWith('band sheet'));
    if (sheet) throw new Error(sheet);
    return step.text;
  } catch (e) { throw fromExport(e instanceof Error ? e.message : String(e)); }
}

/** The material id a body names (its own, else the brief's), if any. */
export function materialOf(doc: StudioDoc, key: string): string | undefined {
  const body = bodiesOf(doc).find(b => b.key === key);
  if (!body) throw refuse('NO_BODY', `the part has no body ${String(key)}`);
  return materialIdOf(doc, body);
}

/** The document with a body's name set, as the studio's Rename writes it (its look's name): what the BOM and the drawings call it. */
export function withBodyName(doc: StudioDoc, key: string, name: string): StudioDoc {
  const b = bodiesOf(doc).find(x => x.key === key);
  if (!b) throw refuse('NO_BODY', `the part has no body ${key}`);
  return withLook(doc, b, { name });
}

/** The document with a body's material set (`key` null: every body's), as set_material writes it. */
export function withMaterial(doc: StudioDoc, key: string | null, id: string): StudioDoc {
  const picked = bodiesOf(doc).filter(b => key === null || b.key === key);
  if (!picked.length) throw refuse('NO_BODY', 'the part has no body to set a material on');
  let out = doc;
  for (const b of picked) out = withLook(out, b, { material: id });
  return out;
}
