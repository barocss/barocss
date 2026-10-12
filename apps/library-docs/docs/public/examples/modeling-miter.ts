import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region miter
/** cutPosition is an X + Y sum in mm, not perpendicular plane distance. */
export function makeMiter(): CadModelSnapshot {
  const model = cad.model(), cutPosition = model.parameter('cutPosition', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const parts = blank.split({ plane: 'x+y', at: cutPosition });
  return model.build({ negative: parts.negative, positive: parts.positive });
}
// #endregion miter

// #region edit-miter
export function moveMiter(accepted: CadModelSnapshot): CadModelSnapshot {
  return accepted.withParameters({ cutPosition: 32 });
}
export function bisectMiter(accepted: CadModelSnapshot): CadModelSnapshot {
  return accepted.withParameters({ cutPosition: 28 });
}
/** Rebuilds cold from authored intent; the file does not carry accepted geometry caches. */
export function reopenMiter(text: string): CadModelSnapshot {
  return cad.load(text);
}
export function miterWorkflow() {
  const initial = makeMiter(), moved = moveMiter(initial);
  const bisected = bisectMiter(moved), saved = bisected.save(), reopened = reopenMiter(saved);
  const restored = reopened.withParameters({ cutPosition: 24 });
  return { initial, moved, bisected, saved, reopened, restored };
}
// #endregion edit-miter

// #region refused-miter
/** Keep the accepted snapshot and typed error when a requested side is empty. */
export function tryOutsideMiter(accepted: CadModelSnapshot) {
  try { return { ok: true as const, snapshot: accepted.withParameters({ cutPosition: 60 }) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: accepted, error };
  }
}
// #endregion refused-miter
