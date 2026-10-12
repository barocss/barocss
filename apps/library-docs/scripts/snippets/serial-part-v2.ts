// Documentation/typecheck fixture. This module is not executed by the docs checks.
// #region open
import { cad, type XYAffinePrismFeatureResultV2 } from '@barocss/cad';
const { prismV2 } = cad.document; // Explicit v2; never auto-upgrade a v0/v1 file.

export function openSerialPart(authoredText: string) {
  // The complete downloaded serial-part-v2.json is the input.
  // parse evaluates the document and rebuilds geometry, lineage and selection.
  return prismV2.parse(authoredText);
}
// #endregion open

// #region outputs
export function serialPartOutputs(result: XYAffinePrismFeatureResultV2) {
  const first = result.subtraction.first.outcome;
  const intermediate = result.subtraction.second.outcome;
  const retained = result.chamfer.split.negative;
  const removed = result.chamfer.split.positive;
  if (first.kind !== 'solid' || intermediate.kind !== 'solid' ||
      retained.kind !== 'solid' || removed.kind !== 'solid') {
    throw new Error('This fixture requires two components and a removed wedge');
  }
  return {
    unchangedFirst: first.solid,         // left_part
    preChamferSecond: intermediate.solid, // right_part, not the finished part
    finishedSecond: retained.solid,      // detailed_part
    removedWedge: removed.solid,         // front_wedge
    resolution: result.chamferResolution,
  };
}
// #endregion outputs

// #region edit
export function setSerialParameter(
  previous: XYAffinePrismFeatureResultV2,
  parameterId: string,
  valueMM: number,
) {
  // This already validates/reconstructs the whole previous result.
  // On refusal, the caller keeps `previous` as its accepted state.
  const update = prismV2.update(previous, {
    expectedRevision: previous.document.revision,
    revision: previous.document.revision + 1,
    parameterEdits: [{ parameterId, valueMM }],
  });
  return update; // Accept update.result only after this call succeeds.
}

export function editHeightAndRear(originalText: string) {
  const initial = openSerialPart(originalText);
  const rear = setSerialParameter(initial, 'rearX', 20);
  const height = setSerialParameter(rear.result, 'parentHeight', 6);
  return {
    result: height.result,
    actions: height.transaction.report.actions,
    priorValidation: height.transaction.report.validation,
    candidateWork: height.transaction.report.candidate,
  };
}
// #endregion edit

// #region serialize
export function saveSerialPart(accepted: XYAffinePrismFeatureResultV2) {
  // serialize also evaluates; its argument is authored state, not a result/mesh.
  return prismV2.serialize(accepted.document);
}

export function auditSerialPart(accepted: XYAffinePrismFeatureResultV2) {
  return prismV2.validate(accepted); // A full reconstruction, not a cheap shape check.
}

export function auditSerialUpdate(update: ReturnType<typeof setSerialParameter>) {
  return prismV2.validateUpdate(update); // Includes prior authored state and edits.
}
// #endregion serialize
