import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

/** Exact diameter-driven primary recipe. Native geometry is the stored rational boundary. */
export function makeRoundPost(): CadModelSnapshot {
  const model = cad.model();
  const centerX = model.parameter('centerX', 2), centerY = model.parameter('centerY', -3);
  const diameter = model.parameter('diameter', 8), height = model.parameter('height', 6);
  const post = model.sketch.circle({ center: [centerX, centerY], radius: model.dimension.scale(diameter, 0.5) }).extrude(height);
  return model.build({ post });
}

/** An exact qualification refusal keeps the accepted immutable snapshot available. */
export function tryRoundPostParameters(accepted: CadModelSnapshot, changes: Readonly<Record<string, number>>) {
  try { return { snapshot: accepted.withParameters(changes), error: null }; }
  catch (error) { if (!(error instanceof CadModelError)) throw error; return { snapshot: accepted, error }; }
}
export function tallerRoundPost(accepted: CadModelSnapshot) { return accepted.withParameters({ height: 9 }); }
export function narrowerRoundPost(accepted: CadModelSnapshot) { return accepted.withParameters({ diameter: 4 }); }
export function saveAndReopenRoundPost(accepted: CadModelSnapshot) { return cad.load(accepted.save()); }
export function roundPostBody(snapshot: CadModelSnapshot) {
  const body = snapshot.bodies.post;
  if (body.family !== 'stored-rational-circle-prism') throw new Error('Expected a qualified stored-rational round post.');
  return body.native;
}
// Baseline center[2,-3], diameter8, height6; height9 then diameter4 are ordinary edits.
// The body's qualification does not supply certified pi-volume, area or mass.
// Its parent reference measurements and sampled-preview flags retain their own meaning.
// Save contains authored numeric drivers and the owned radius expression, not display data.
// The editor uses the original k4 preview and one explicit authored-XYZ to display conversion.
