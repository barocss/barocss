import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region union-bracket
/** Exact producer unionBracket recipe. Importing this file does not evaluate it. */
export function makeUnionBracket(): CadModelSnapshot {
  const model = cad.model();
  const legMinX = model.parameter('legMinX', -0);
  const legMinY = model.parameter('legMinY', -0);
  const legWidth = model.parameter('legWidth', 8);
  const legHeight = model.parameter('legHeight', 8);
  const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
  const leg = model.sketch.rectangle({
    min: [legMinX, legMinY],
    max: [model.dimension.add(legMinX, legWidth), 24],
  }).extrude(legHeight);
  const bracket = base.union(leg);
  return model.build({ base, leg, bracket });
}
// #endregion union-bracket

// #region refused-union
/** Preserve the actual accepted snapshot and native cause on refusal. */
export function tryUnionParameters(
  accepted: CadModelSnapshot, edits: Readonly<Record<string, number>>,
) {
  try { return { ok: true as const, snapshot: accepted.withParameters(edits) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: accepted, error };
  }
}
// #endregion refused-union

// #region edit-union
/** Producer-measured edits, beginning with makeUnionBracket(). */
export function editUnionBracket(initial: CadModelSnapshot) {
  const wide = initial.withParameters({ legWidth: 12 });
  const faceContact = wide.withParameters({ legMinY: 8 });
  const edgeRefusal = tryUnionParameters(faceContact, { legMinX: 32 });
  if (edgeRefusal.ok) throw new Error('Expected the edge-only union to refuse');
  const disconnectedRefusal = tryUnionParameters(edgeRefusal.snapshot, { legMinX: 40 });
  if (disconnectedRefusal.ok) throw new Error('Expected the disconnected union to refuse');
  // Both refused candidates leave the same accepted face-contact snapshot reusable.
  const restored = disconnectedRefusal.snapshot.withParameters({ legWidth: 8, legMinY: -0 });
  return { wide, faceContact, edgeRefusal, disconnectedRefusal, restored };
}
// #endregion edit-union

// #region save-reopen-union
/** Save authored intent only. The caller owns storage; these APIs do no file I/O. */
export function saveAndReopenUnionBracket(accepted: CadModelSnapshot) {
  const saved = accepted.save();
  const reopened = cad.load(saved);
  const taller = reopened.withParameters({ legHeight: 16 });
  return { saved, reopened, taller };
}

/** Optional native workflow; never called by an import or the documentation checker. */
export function unionBracketWorkflow() {
  const initial = makeUnionBracket();
  const edits = editUnionBracket(initial);
  const persistence = saveAndReopenUnionBracket(edits.restored);
  return { initial, ...edits, ...persistence };
}
// #endregion save-reopen-union

// #region qualified-union-output
export function inspectUnionBracket(accepted: CadModelSnapshot) {
  const base = accepted.bodies.base, leg = accepted.bodies.leg, bracket = accepted.bodies.bracket;
  if (!base || base.family !== 'convex-planar') throw new Error('Expected the convex base');
  if (!leg || leg.family !== 'convex-planar') throw new Error('Expected the convex leg');
  if (!bracket || bracket.family !== 'orthogonal-cell') throw new Error('Expected the connected union');
  return {
    baseVolumeMM3: base.native.certificate.volumeMM3,
    legVolumeMM3: leg.native.certificate.volumeMM3,
    bracketVolumeMM3: bracket.native.report.volumeMM3,
    qualification: bracket.native.report.quality,
    panels: bracket.native.panels,
    sources: bracket.native.sources,
    parameters: accepted.parameters,
    features: accepted.features,
  };
}
// #endregion qualified-union-output
