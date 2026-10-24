// R7 (the facade): the one place the facade reads results from today's core. When R7.3 lands — one error type, cad's
// result methods as functions, public results in MMGS — this file is the switch: the rest of src/api/ never calls the
// core's evaluation, mass or export functions directly.
import type { StudioDoc } from '../engine/doc';
import { evaluateDoc, stepFor, type BodyResult } from '../engine/evaluate';
import { bodyMass } from '../app/mass';
import { fromEvaluation, fromExport, refuse } from './refusal';

export type Vec3 = [number, number, number];

/** A body's mass properties in a material, in MMGS (api-conventions.md §2): mm³, g, mm, and g·mm² about the centre of mass. */
export interface MassResult { volumeMM3: number; massG: number; centroidMM: Vec3; inertiaGMM2: number[][] }

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

/** The document's exact solids as one STEP AP214 file. */
export function stepOf(doc: StudioDoc, name: string): string {
  const out = stepFor(doc, name);
  if ('error' in out) throw fromExport(out.error);
  return out.text;
}
