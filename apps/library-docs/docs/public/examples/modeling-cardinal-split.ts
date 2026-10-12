// Current owned modeling API. World-axis coordinates and all dimensions are mm.
import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

// #region cardinal-part
export function makeCardinalSplit(axis: 'x' | 'y' = 'x'): CadModelSnapshot {
  const model = cad.model();
  const splitAt = model.parameter('splitAt', 16), rearX = model.parameter('rearX', 16);
  const height = model.parameter('height', 8);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32]]).extrude(height);
  const parts = blank.split({ axis, at: splitAt });
  return model.build({ negative: parts.negative, positive: parts.positive });
}
// #endregion cardinal-part

// #region edit-cardinal
export function moveSplit(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ splitAt: 24 });
}

export function reopenCardinalSplit(authoredText: string): CadModelSnapshot {
  return cad.load(authoredText); // The saved axis stays part of the authored graph.
}

export function returnSplit(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ splitAt: 16 });
}
// #endregion edit-cardinal

// #region refused-cardinal
export function trySlopedXCrossing(previousX: CadModelSnapshot) {
  try {
    // For makeCardinalSplit('x'), this crossing requires the exact Y value 80/3.
    return { accepted: previousX.withParameters({ rearX: 20, splitAt: 24 }), error: null };
  } catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    // Preserve the prior snapshot and the actual error, including its native cause.
    return { accepted: previousX, error };
  }
}
// #endregion refused-cardinal

// #region cardinal-workflow
export function cardinalSplitWorkflow() {
  const initial = makeCardinalSplit('x');
  const moved = moveSplit(initial);
  const authoredText = moved.save();
  const reopened = reopenCardinalSplit(authoredText);
  const returned = returnSplit(reopened);
  return { initial, moved, authoredText, reopened, returned };
}
// #endregion cardinal-workflow
