// Complete example for the current owned modeling API. All dimensions are mm.
import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';

// #region split-part
export function makeSplitPart(): CadModelSnapshot {
  const model = cad.model();
  const height = model.parameter('height', 8), splitHeight = model.parameter('splitHeight', 2);
  const blank = model.sketch.polygon([[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]]).extrude(height);
  const halves = blank.split({ axis: 'z', at: splitHeight });
  return model.build({ lower: halves.negative, upper: halves.positive });
}
// #endregion split-part

// #region edit-split
export function bisectPart(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ splitHeight: 4 });
}

export function reopenSplitPart(authoredText: string): CadModelSnapshot {
  return cad.load(authoredText);
}

export function raiseSplit(previous: CadModelSnapshot): CadModelSnapshot {
  return previous.withParameters({ splitHeight: 6 });
}
// #endregion edit-split

// #region refused-split
export function tryEmptyLower(previous: CadModelSnapshot) {
  try {
    // Both outputs are requested. At the base plane, the lower side is empty.
    return { accepted: previous.withParameters({ splitHeight: -0 }), error: null };
  } catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { accepted: previous, error: { code: error.code, operation: error.operation, message: error.message } };
  }
}
// #endregion refused-split

// #region split-workflow
export function splitPartWorkflow() {
  const initial = makeSplitPart();
  const bisected = bisectPart(initial);
  const authoredText = bisected.save();
  const reopened = reopenSplitPart(authoredText);
  const raised = raiseSplit(reopened);
  return { initial, bisected, authoredText, reopened, raised };
}
// #endregion split-workflow
