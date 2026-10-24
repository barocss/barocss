// R7 (cad's facade): the one place the facade reads results from today's kernel. When R7.3 lands — one error type,
// CadPartOutput's methods as functions, public results in MMGS — this file is the switch: the rest of src/api/ never
// calls evaluateCadPart or an output's methods directly.
import { evaluateCadPart, exportStl, massPropertiesOf, CadPartError, type CadPartDocument, type CadPartOutput } from '../part/part-model.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { exportStep } from '../io/step.js';
import { brepLines, brepSelection, type BodyQuery } from './select.js';
import { BarocssError, bracketedCode, refuse } from './refusal.js';

// (One Vec3 for the facades, api-conventions §10.2: `readonly [x, y, z]`, as gpu's core/geometry-types.ts declares it.)
export type { Vec3 } from './select.js';
import type { Vec3 } from './select.js';

/** A body's mass properties at a density, in MMGS (api-conventions.md §2): mm³, g, mm, and g·mm² about the centre of mass. */
export interface MassResult { volumeMM3: number; massG: number; centroidMM: Vec3; inertiaGMM2: number[][] }
/** A body's display triangles in the common mesh shape (api-conventions.md §10.3): mm, Z up — what gpu's GeometryInput takes. */
export interface MeshData {
  key: string; positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  /** Its display lines (the edges a person sees) as segment pairs, x, y, z each end — gpu's line geometry (R7.5b). */
  lines?: Float32Array;
  /** The material id its body names (cad-model: the body's own, else the brief's), for gpu's scene materials (§10.6). */
  material?: string;
}

// (Today's kernel: density in kg/m³, mass in kg, inertia in kg·m² — brep/solid-mass.ts. MMGS: g/cm³, g, g·mm².
// R7.3 moves the kernel's public results to MMGS and these go.)

function fromKernel(error: unknown): BarocssError {
  if (error instanceof CadPartError) {
    return new BarocssError(bracketedCode(error.message) ?? error.code, error.message, 'evaluate', { feature: error.feature, kernelCode: error.code });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new BarocssError(bracketedCode(message) ?? 'EVALUATION', message, 'evaluate');
}

/** The document's outputs (the parts no later feature consumes), or the kernel's refusal. */
export function outputsOf(doc: CadPartDocument): readonly CadPartOutput[] {
  try { return evaluateCadPart(doc).outputs; } catch (e) { throw fromKernel(e); }
}

/** An output's mass properties at a density (g/cm³). */
export function massOf(output: CadPartOutput, gPerCm3: number): MassResult {
  if (!(Number.isFinite(gPerCm3) && gPerCm3 > 0)) throw refuse('DENSITY', `a density must be a positive number of g/cm³, not ${gPerCm3}`);
  let m;
  // (The core's mass is in MMGS since R7.3b: the facade's adapter converts nothing.)
  try { m = massPropertiesOf(output, gPerCm3); } catch (e) { throw fromKernel(e); }
  return {
    volumeMM3: m.volume, massG: m.mass, centroidMM: [m.centroid[0], m.centroid[1], m.centroid[2]],
    inertiaGMM2: m.inertia.map(row => [...row]),
  };
}

/** The outputs as one STEP AP214 file: one through its own export, several as the kernel writes a list of bodies. */
export function stepOf(outputs: readonly CadPartOutput[], name: string): string {
  if (!outputs.length) throw refuse('NO_BODY', 'the part has no body to export');
  try { return outputs.length === 1 ? exportStep(outputs[0], { name }) : exportStep(outputs.map(o => o.brep), { name }); } catch (e) { throw new BarocssError(bracketedCode(String(e)) ?? 'EXPORT', e instanceof Error ? e.message : String(e), 'export'); }
}

/** An output as binary STL (its display tessellation). */
export function stlOf(output: CadPartOutput): Uint8Array {
  try { return exportStl(output); } catch (e) { throw new BarocssError(bracketedCode(String(e)) ?? 'EXPORT', e instanceof Error ? e.message : String(e), 'export'); }
}

/** An output's display triangles, from the kernel's tessellation (its Float64 positions and normals as the common shape's Float32). */
export function meshOf(output: CadPartOutput): MeshData {
  const m = tessellateBrep(output.brep);
  return { key: output.id, positions: Float32Array.from(m.positionsMM), normals: Float32Array.from(m.normals), indices: m.indices, lines: brepLines(output.brep, m) };
}

/** An output's edges and faces, to select from. */
export function selectionOf(output: CadPartOutput): BodyQuery { return brepSelection(output.brep, tessellateBrep(output.brep)); }
