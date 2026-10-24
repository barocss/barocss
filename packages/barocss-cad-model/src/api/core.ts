// R7 (the facade): the one place the facade reads results from today's core. When R7.3 lands — one error type, cad's
// result methods as functions, public results in MMGS — this file is the switch: the rest of src/api/ never calls the
// core's evaluation, mass or export functions directly.
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
// (Today's core gives a body's inertia in kg·mm² — app/mass.ts bodyMass; MMGS is g·mm². R7.3 moves the core to MMGS and this goes.)
const G_PER_KG = 1000;

/** The document's bodies as the core evaluates them, or its refusal. */
export function bodiesOf(doc: StudioDoc): BodyResult[] {
  const result = evaluateDoc(doc, REVISION);
  if (!result.ok) throw fromEvaluation(result.error);
  return result.bodies;
}

/** A body's mass properties at a density (g/cm³). */
export function massOf(body: BodyResult, gPerCm3: number): MassResult {
  const props = bodyMass(body, gPerCm3);
  if (!props || body.volumeMM3 === null) throw refuse('MASS_UNKNOWN', `the body ${body.key} has no volume the core could work out`, 'evaluate');
  return { volumeMM3: body.volumeMM3, massG: props.massG, centroidMM: props.centroid, inertiaGMM2: props.inertia.map(row => row.map(v => v * G_PER_KG)) };
}

/** Each body's display triangles and lines, as the core's evaluation made them, with the material id the body names. */
export function meshesOf(doc: StudioDoc): MeshData[] {
  return bodiesOf(doc).map(b => {
    const material = materialIdOf(doc, b);
    return { key: b.key, positions: b.mesh.positions, normals: b.mesh.normals, indices: b.mesh.indices, lines: b.mesh.edgeLines, ...(material !== undefined ? { material } : {}) };
  });
}

/** The document's exact solids as one STEP AP214 file. */
export function stepOf(doc: StudioDoc, name: string): string {
  try { return exportStudioStep(doc, { name }).text; } catch (e) { throw fromExport(e instanceof Error ? e.message : String(e)); }
}

/** The material id a body names (its own, else the brief's), if any. */
export function materialOf(doc: StudioDoc, key: string): string | undefined {
  return materialIdOf(doc, bodiesOf(doc).find(b => b.key === key)!);
}

/** The document with a body's material set (`key` null: every body's), as set_material writes it. */
export function withMaterial(doc: StudioDoc, key: string | null, id: string): StudioDoc {
  const picked = bodiesOf(doc).filter(b => key === null || b.key === key);
  if (!picked.length) throw refuse('NO_BODY', 'the part has no body to set a material on');
  let out = doc;
  for (const b of picked) out = withLook(out, b, { material: id });
  return out;
}
