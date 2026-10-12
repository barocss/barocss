// Complete example for the current owned modeling API. All dimensions are mm.
import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

// #region overlap
export function makeOverlap(): CadModelSnapshot {
  const model = cad.model();
  const rearX = model.parameter('rearX', 16), leftX = model.parameter('leftX', 8), rightX = model.parameter('rightX', 40);
  const lowY = model.parameter('lowY', -8), highY = model.parameter('highY', 24), height = model.parameter('height', 4);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(8);
  const tool = model.sketch.rectangle({ min: [leftX, lowY], max: [rightX, highY] }).extrude(height);
  return model.build({ overlap: blank.intersect(tool) });
}
// #endregion overlap

// #region edit-overlap
export function shiftOverlap(previous: CadModelSnapshot): CadModelSnapshot {
  // Change both rectangle bounds in one candidate. The old snapshot is unchanged.
  return previous.withParameters({ leftX: 16, rightX: 48 });
}

export function reopenOverlap(authoredText: string): CadModelSnapshot {
  return cad.load(authoredText); // Freshly rebuilds the authored operations.
}

export function shorterOverlap(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ height: 2 });
}
// #endregion edit-overlap

// #region refused-overlap
export function tryTouchingOnly(previous: CadModelSnapshot) {
  try {
    // The tool begins at the blank's furthest X support: no positive-volume body.
    return { accepted: previous.withParameters({ leftX: 32, rightX: 64 }), error: null };
  } catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    // Keep the complete previous snapshot, its named bodies and save() bytes.
    return { accepted: previous, error: { code: error.code, operation: error.operation, message: error.message } };
  }
}
// #endregion refused-overlap

// #region workflow
export function overlapWorkflow() {
  const initial = makeOverlap();
  const shifted = shiftOverlap(initial);
  const authoredText = shifted.save();
  const reopened = reopenOverlap(authoredText);
  const shorter = shorterOverlap(reopened);
  return { initial, shifted, authoredText, reopened, shorter };
}
// #endregion workflow
