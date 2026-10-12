import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region beveled-split
/** The measured two-chamfer X/Z recipes; coordinate-side output names stay fixed. */
export function makeBeveledSplit(axis: 'x' | 'z' = 'x'): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const splitAt = model.parameter('splitAt', axis === 'z' ? 4 : 16);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
  const parts = finished.split({ axis, at: splitAt });
  return model.build({ negative: parts.negative, positive: parts.positive });
}
// #endregion beveled-split

// #region edit-beveled-split
export function moveSplit(snapshot: CadModelSnapshot): CadModelSnapshot {
  return snapshot.withParameters({ splitAt: 8 });
}
export function deepenBackBevel(snapshot: CadModelSnapshot): CadModelSnapshot {
  return snapshot.withParameters({ backDistance: 3 });
}
export function reopenBeveledSplit(text: string): CadModelSnapshot {
  return cad.load(text);
}
/** Measured X flow: 3032/3032 → 1516/4548 → 1496/4488 → cold → 2992/2992. */
export function beveledSplitWorkflow() {
  const initial = makeBeveledSplit('x');
  const moved = moveSplit(initial), beveled = deepenBackBevel(moved);
  const saved = beveled.save(), reopened = reopenBeveledSplit(saved);
  const centered = reopened.withParameters({ splitAt: 16 });
  return { initial, moved, beveled, saved, reopened, centered };
}
// #endregion edit-beveled-split

// #region refused-beveled-split
/** Keep the accepted snapshot and original error/cause when either requested side is empty. */
export function tryOutsideSplit(accepted: CadModelSnapshot) {
  try { return { ok: true as const, snapshot: accepted.withParameters({ splitAt: 40 }) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: accepted, error };
  }
}
// #endregion refused-beveled-split
