import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region mounting-plate
/** Calling this function evaluates the model; importing this file does not. */
export function makeMountingPlate(): CadModelSnapshot {
  const model = cad.model();
  const width = model.parameter('width', 80);
  const depth = model.parameter('depth', 40);
  const height = model.parameter('height', 8);
  const centerX = model.parameter('centerX', 40);
  const centerY = model.parameter('centerY', 20);
  const radius = model.parameter('radius', 5);
  const blank = model.sketch.rectangle({ width, height: depth }).extrude(height);
  const plate = blank.hole({ center: [centerX, centerY], radius });
  return model.build({ blank, plate });
}
// #endregion mounting-plate

// #region refused-hole
/** A refused candidate never replaces the last accepted snapshot. */
export function tryHoleParameters(
  accepted: CadModelSnapshot, edits: Readonly<Record<string, number>>,
) {
  try { return { ok: true as const, snapshot: accepted.withParameters(edits) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: accepted, error };
  }
}
// #endregion refused-hole

// #region edit-hole
/** The producer-measured sequence, starting from makeMountingPlate(). */
export function editMountingPlate(initial: CadModelSnapshot) {
  const narrow = initial.withParameters({ radius: 2.5 });
  const chartRefusal = tryHoleParameters(narrow, { width: 81 });
  if (chartRefusal.ok) throw new Error('Expected the stored-UV width edit to refuse');
  // Retry the same accepted narrow snapshot, never the refused candidate.
  const offset = chartRefusal.snapshot.withParameters({ centerX: 32.5, centerY: 18.75 });
  const tangentRefusal = tryHoleParameters(offset, { radius: 18.75 });
  if (tangentRefusal.ok) throw new Error('Expected the tangent hole to refuse');
  const noop = tangentRefusal.snapshot.withParameters({ centerX: 32.5, radius: 2.5 });
  return { narrow, chartRefusal, offset, tangentRefusal, noop };
}
// #endregion edit-hole

// #region save-reopen-hole
/** Authored text only: the caller chooses how to store it. No filesystem I/O. */
export function saveAndReopenMountingPlate(accepted: CadModelSnapshot) {
  const saved = accepted.save();
  const reopened = cad.load(saved);
  const reedited = reopened.withParameters({ radius: 5 });
  return { saved, reopened, reedited };
}

/** Optional complete runtime flow; nothing invokes it on module import. */
export function mountingPlateWorkflow() {
  const initial = makeMountingPlate();
  const edits = editMountingPlate(initial);
  const persistence = saveAndReopenMountingPlate(edits.noop);
  return { initial, ...edits, ...persistence };
}
// #endregion save-reopen-hole

// #region qualified-hole-output
export function inspectMountingPlate(accepted: CadModelSnapshot) {
  const blank = accepted.bodies.blank, plate = accepted.bodies.plate;
  if (!blank || blank.family !== 'convex-planar') throw new Error('Expected the convex blank');
  if (!plate || plate.family !== 'stored-rational-plate-hole') throw new Error('Expected the qualified plate');
  return {
    blankVolumeMM3: blank.native.certificate.volumeMM3,
    plateVolumeMM3: null, // Certified volume unavailable; neither Empty nor zero.
    qualification: plate.native.certificate,
    parentReport: plate.native.parentReport, // Original uncertified diagnostics stay separate.
    parameters: accepted.parameters,
    features: accepted.features,
  };
}
// #endregion qualified-hole-output
