// Facade adapters over the R7 MMGS core contract. Results are plain data; expensive work stays explicit.
import { evaluateCadPart, exportStl, massPropertiesOf, CadPartError } from '../part/part-model.js';
import { tessellateBrep } from '../brep/brep-tessellate.js';
import { exportStep } from '../io/step.js';
import { brepLines, brepSelection } from './select.js';
import { BarocssError, bracketedCode, refuse } from './refusal.js';
function fromKernel(error) {
    if (error instanceof CadPartError) {
        return new BarocssError(bracketedCode(error.message) ?? error.code, error.message, 'evaluate', { feature: error.feature, kernelCode: error.code });
    }
    const message = error instanceof Error ? error.message : String(error);
    return new BarocssError(bracketedCode(message) ?? 'EVALUATION', message, 'evaluate');
}
/** The document's outputs (the parts no later feature consumes), or the kernel's refusal. */
export function outputsOf(doc) {
    try {
        return evaluateCadPart(doc).outputs;
    }
    catch (e) {
        throw fromKernel(e);
    }
}
/** An output's mass properties at a density (g/cm³). */
export function massOf(output, density) {
    if (!(Number.isFinite(density) && density > 0))
        throw refuse('DENSITY', `a density must be a positive number of g/cm³, not ${density}`);
    let m;
    // (The core's mass is in MMGS since R7.3b: the facade's adapter converts nothing.)
    try {
        m = massPropertiesOf(output, density);
    }
    catch (e) {
        throw fromKernel(e);
    }
    return {
        volume: m.volume, mass: m.mass, centroid: [m.centroid[0], m.centroid[1], m.centroid[2]],
        inertia: m.inertia.map(row => [...row]),
    };
}
/** The outputs as one STEP AP214 file: one through its own export, several as the kernel writes a list of bodies. */
export function stepOf(outputs, name) {
    if (!outputs.length)
        throw refuse('NO_BODY', 'the part has no body to export');
    try {
        return outputs.length === 1 ? exportStep(outputs[0], { name }) : exportStep(outputs.map(o => o.brep), { name });
    }
    catch (e) {
        throw new BarocssError(bracketedCode(String(e)) ?? 'EXPORT', e instanceof Error ? e.message : String(e), 'export');
    }
}
/** An output as binary STL (its display tessellation). */
export function stlOf(output) {
    try {
        return exportStl(output);
    }
    catch (e) {
        throw new BarocssError(bracketedCode(String(e)) ?? 'EXPORT', e instanceof Error ? e.message : String(e), 'export');
    }
}
/** An output's display triangles, from the kernel's tessellation (its Float64 positions and normals as the common shape's Float32). */
export function meshOf(output) {
    const m = tessellateBrep(output.brep);
    return { key: output.id, positions: Float32Array.from(m.positions), normals: Float32Array.from(m.normals), indices: m.indices, lines: brepLines(output.brep, m) };
}
/** An output's edges and faces, to select from. */
export function selectionOf(output) { return brepSelection(output.brep, tessellateBrep(output.brep)); }
