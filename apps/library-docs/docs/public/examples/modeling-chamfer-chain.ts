// Current owned modeling API. Edge coordinates and bevel distances are mm.
import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

// #region two-chamfers
export function makeTwoChamferPart(): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const part = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
  return model.build({ part });
}
// #endregion two-chamfers

// #region edit-chamfers
export function enlargeBackBevel(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ backDistance: 3 });
}

export function enlargeBothBevels(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ frontDistance: 2, backDistance: 3 });
}

export function reopenChamferPart(authoredText: string): CadModelSnapshot {
  return cad.load(authoredText);
}
// #endregion edit-chamfers

// #region refused-chamfer
export function tryRemovedFrontEdge(previous: CadModelSnapshot) {
  try {
    // For makeTwoChamferPart(), the original y=0, z=max edge was removed.
    return { accepted: previous.withParameters({ backY: 0 }), error: null };
  } catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    // Keep the actual typed error/cause and the previously accepted model.
    return { accepted: previous, error };
  }
}
// #endregion refused-chamfer

// #region chamfer-workflow
export function twoChamferWorkflow() {
  const initial = makeTwoChamferPart();
  const backEdited = enlargeBackBevel(initial);
  const bothEdited = enlargeBothBevels(initial);
  const authoredText = backEdited.save();
  const reopened = reopenChamferPart(authoredText);
  const restored = reopened.withParameters({ backDistance: 2 });
  return { initial, backEdited, bothEdited, authoredText, reopened, restored };
}
// #endregion chamfer-workflow

// #region inspect-recomputation
export function inspectRecomputation(snapshot: CadModelSnapshot) {
  // Model feature indices only. No native call totals, tessellation work or timings.
  return snapshot.recomputation;
}
// #endregion inspect-recomputation
