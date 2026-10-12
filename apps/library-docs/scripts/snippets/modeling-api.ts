// Complete public examples, typechecked without executing native geometry.
// #region imports
import { cad, CadModelError, type CadModelSnapshot } from '@barocss/cad';
// #endregion imports

// #region plate
export function makePlate() {
  const m = cad.model();
  const width = m.parameter('width', 32);
  const depth = m.parameter('depth', 16);
  const height = m.parameter('height', 8);
  const plate = m.sketch.rectangle({ width, height: depth }).extrude(height);
  return m.build({ part: plate });
}
// #endregion plate

// #region edit-plate
export function editPlate() {
  const original = makePlate();
  const edited = original.withParameters({ width: 24, height: 6 });
  const authoredText = edited.save();
  const reopened = cad.load(authoredText);
  return reopened.withParameters({ width: 32 });
}
// #endregion edit-plate

// #region part
export function makePart() {
  const m = cad.model();
  const height = m.parameter('height', 8);
  const setback = m.parameter('setback', 1);
  const rearX = m.parameter('rearX', 16);
  const upperX = m.parameter('upperX', 16);

  const blank = m.sketch.polygon([
    [-0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32],
  ]).extrude(height);
  const tool = m.sketch.rectangle({
    min: [8, -16], max: [upperX, 48],
  }).extrude(8);
  const cut = blank.cut(tool, { axis: 'x' });
  const edge = cut.positive.edges({
    parallelTo: 'x', at: { y: 0, z: 'max' },
  }).one();
  const finished = cut.positive.chamfer(edge, setback);
  return m.build({ part: finished, other: cut.negative });
}
// #endregion part

// #region outputs
export function inspectPart(accepted: CadModelSnapshot) {
  const part = accepted.bodies.part;
  if (!part || part.family !== 'convex-planar') throw new Error('Expected a named convex part output');
  // This is the actual native Solid certificate, not a mesh-volume estimate.
  return {
    volumeMM3: part.native.certificate.volumeMM3,
    parameters: accepted.parameters,
    features: accepted.features,
    evidence: accepted.evidence,
  };
}
// #endregion outputs

// #region edit
export function editPart(previous: CadModelSnapshot) {
  // One candidate rebuild sees both edits together.
  return previous.withParameters({ height: 6, rearX: 20 });
}

export function trySetParameters(
  previous: CadModelSnapshot,
  edits: Readonly<Record<string, number>>,
) {
  try {
    return { accepted: previous.withParameters(edits), error: null };
  } catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    // The previous snapshot stays accepted when the candidate refuses.
    return {
      accepted: previous,
      error: { code: error.code, operation: error.operation, message: error.message },
    };
  }
}
// #endregion edit

// #region persistence
export function savePart(accepted: CadModelSnapshot): string {
  return accepted.save();
}

export function reopenAndEdit(authoredText: string) {
  const reopened = cad.load(authoredText); // Rebuilds all authored operations.
  return reopened.withParameters({ setback: 2 });
}
// #endregion persistence

// #region checks
export function checkBaseAndEdits() {
  const base = makePart();
  const edited = editPart(base);
  const reopened = cad.load(edited.save());
  const reedited = reopened.withParameters({ setback: 2 });
  const expected = [
    [base, '3064'], [edited, '2488'], [reopened, '2488'], [reedited, '2464'],
  ] as const;
  for (const [snapshot, numerator] of expected) {
    const volume = inspectPart(snapshot).volumeMM3;
    if (volume.numerator !== numerator || volume.denominator !== '1') {
      throw new Error(`Unexpected exact part volume: ${JSON.stringify(volume)}`);
    }
  }
  if (base.parameters.height !== 8 || base.parameters.rearX !== 16) {
    throw new Error('An edit mutated the previously accepted snapshot');
  }
  return { base, edited, reopened, reedited };
}
// #endregion checks
