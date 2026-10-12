import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region centered-split
export function makeCenteredSplit(): CadModelSnapshot {
  const model = cad.model();
  const width = model.parameter('width', 32), offset = model.parameter('offset', 0);
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const at = model.dimension.add(model.dimension.scale(width, 0.5), offset);
  const blank = model.sketch.rectangle({ width, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
  const parts = finished.split({ axis: 'x', at });
  return model.build({ negative: parts.negative, positive: parts.positive });
}
// #endregion centered-split

// #region edit-centered-split
export function offsetSplit(accepted: CadModelSnapshot): CadModelSnapshot {
  return accepted.withParameters({ offset: 4 });
}
export function widenRail(accepted: CadModelSnapshot): CadModelSnapshot {
  return accepted.withParameters({ width: 40 });
}
export function centerRail(accepted: CadModelSnapshot): CadModelSnapshot {
  return accepted.withParameters({ offset: 0 });
}
/** Rebuilds cold from authored dimensions/formulas, without a saved geometry cache. */
export function reopenCenteredSplit(text: string): CadModelSnapshot { return cad.load(text); }
export function centeredSplitWorkflow() {
  const initial = makeCenteredSplit();
  const offset = offsetSplit(initial), wider = widenRail(offset), centered = centerRail(wider);
  const signedZero = centered.withParameters({ offset: -0 });
  const saved = signedZero.save(), reopened = reopenCenteredSplit(saved), reedited = offsetSplit(reopened);
  return { initial, offset, wider, centered, signedZero, saved, reopened, reedited };
}
// #endregion edit-centered-split

// #region refused-centered-split
/** The numeric driver changes; the fixed owned formula remains authored intent. */
export function tryOutsideCenteredSplit(accepted: CadModelSnapshot) {
  try { return { ok: true as const, snapshot: accepted.withParameters({ offset: 40 }) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: accepted, error };
  }
}
// #endregion refused-centered-split
