import { cad, CadModelError } from '@barocss/cad';
import type { CadModelSnapshot } from '@barocss/cad';

// #region configurable-rail
export function makeConfigurableRail(): CadModelSnapshot {
  const model = cad.model();
  const frontDistance = model.parameter('frontDistance', 1);
  const backDistance = model.parameter('backDistance', 2);
  const backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(
    blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(),
    frontDistance, { name: 'frontFinish' },
  );
  const back = front.chamfer(
    front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(),
    backDistance, { name: 'backFinish' },
  );
  const parts = back.split({ axis: 'x', at: 16 });
  return model.build({ negative: parts.negative, positive: parts.positive });
}
// #endregion configurable-rail

// #region finishing-states
export type RailFinishingState = 'both-on' | 'front-only' | 'back-only' | 'both-off';

/** Suppression true means off; both flags are submitted in one atomic batch. */
export function configureRailFinishes(
  accepted: CadModelSnapshot, state: RailFinishingState,
): CadModelSnapshot {
  const states = {
    'both-on': { frontFinish: false, backFinish: false },
    'front-only': { frontFinish: false, backFinish: true },
    'back-only': { frontFinish: true, backFinish: false },
    'both-off': { frontFinish: true, backFinish: true },
  };
  return accepted.withSuppression(states[state]);
}

export function readRailFinishes(accepted: CadModelSnapshot) {
  return accepted.suppression; // Readonly named booleans, separate from mm parameters.
}
// #endregion finishing-states

// #region refused-finish
/** Call with front on/back off. A disabled back chamfer still validates its selector. */
export function tryInvalidDisabledFinish(frontOnly: CadModelSnapshot) {
  try { return { ok: true as const, snapshot: frontOnly.withParameters({ backY: 1 }) }; }
  catch (error) {
    if (!(error instanceof CadModelError)) throw error;
    return { ok: false as const, snapshot: frontOnly, error };
  }
}
// #endregion refused-finish

// #region finishing-workflow
/** Optional runtime example; loading saved intent rebuilds without a serialized geometry cache. */
export function finishingWorkflow() {
  const initial = makeConfigurableRail();
  const noop = configureRailFinishes(initial, 'both-on');
  const bothOff = configureRailFinishes(initial, 'both-off');
  const frontOnly = configureRailFinishes(bothOff, 'front-only');
  const refused = tryInvalidDisabledFinish(frontOnly);
  const restored = configureRailFinishes(frontOnly, 'both-on');
  const saved = restored.save(), reopened = cad.load(saved);
  const backOnly = configureRailFinishes(reopened, 'back-only');
  return { initial, noop, bothOff, frontOnly, refused, restored, saved, reopened, backOnly };
}
// #endregion finishing-workflow

// #region numeric-finishes
/** Illustrative interleaving; these extra numeric states are not a measured native receipt. */
export function interleaveRailEdits(accepted: CadModelSnapshot) {
  const widerBackBevel = accepted.withParameters({ backDistance: 3 });
  const frontOnly = configureRailFinishes(widerBackBevel, 'front-only');
  const resetBackDistance = frontOnly.withParameters({ backDistance: 2 });
  return { widerBackBevel, frontOnly, resetBackDistance };
}
// #endregion numeric-finishes
