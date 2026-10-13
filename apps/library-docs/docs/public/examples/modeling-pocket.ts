import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

/** Both extrusions begin at Z=0: an underside-entry pocket, not a top recess. */
export function makeUndersidePocket(): CadModelSnapshot {
  const model = cad.model();
  const toolX = model.parameter('toolX', 8), toolY = model.parameter('toolY', 8);
  const toolWidth = model.parameter('toolWidth', 16), toolSpanY = model.parameter('toolSpanY', 8), depth = model.parameter('depth', 4);
  const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
  const tool = model.sketch.rectangle({ min: [toolX, toolY],
    max: [model.dimension.add(toolX, toolWidth), model.dimension.add(toolY, toolSpanY)] }).extrude(depth);
  const part = plate.cut(tool);
  return model.build({ plate, tool, part });
}

/** Retain the accepted immutable snapshot when the native operation refuses an edit. */
export function tryPocketParameters(accepted: CadModelSnapshot, changes: Readonly<Record<string, number>>) {
  try { return { snapshot: accepted.withParameters(changes), error: null }; }
  catch (error) { if (!(error instanceof CadModelError)) throw error; return { snapshot: accepted, error }; }
}
export function openThroughWindow(accepted: CadModelSnapshot) { return accepted.withParameters({ depth: 8 }); }
export function saveAndReopenUndersidePocket(accepted: CadModelSnapshot) { return cad.load(accepted.save()); }
export function pocketVolumeMM3(snapshot: CadModelSnapshot): number {
  const body = snapshot.bodies.part;
  if (body.family !== 'orthogonal-cell') throw new Error('Expected a qualified rectangular difference.');
  return body.native.report.volumeMM3;
}
// Baseline:5632 mm³, depth8 window:5120 mm³. All plate/tool/part outputs stay in the file.
// The editor preset selects part. Generic Open selects the last saved output (tool);
// choose part to inspect the result. This does not restore a serialized viewport.
// Exact native qualification and complete64-panel preview limits can refuse an edit.
