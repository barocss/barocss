import { createClothWorld } from '@barocss/physics/cloth';
import { DT, STEPS, scene, frameFromState, copyData, sameState } from './frame.mjs';

export class ClothHostError extends Error {
  constructor(code, message) { super(message); this.name = 'ClothHostError'; this.code = code; }
}

function freshPair() {
  let first = null, second = null;
  try {
    first = createClothWorld(scene()); second = createClothWorld(scene());
    const state = first.getState(), spareState = second.getState();
    if (!sameState(state, spareState)) throw new ClothHostError('TWIN_MISMATCH', 'Fresh cloth worlds disagree');
    return { active: first, shadow: second, state };
  } catch (error) { first?.dispose(); second?.dispose(); throw error; }
}

/** Two actual worlds keep the accepted CPU state separate from an attempted Viewer submission. */
export function createHostController(viewer, { generation = 1 } = {}) {
  if (!Number.isSafeInteger(generation) || generation < 1) throw new ClothHostError('INVALID_GENERATION', 'Positive generation required');
  let pair = freshPair(), acceptedState = pair.state, frame;
  try { frame = frameFromState(acceptedState, generation); viewer.setClothFrame(frame); }
  catch (error) { pair.active.dispose(); pair.shadow.dispose(); throw error; }
  let displayStep = 0, phase = 'paused', needsReset = false, disposed = false, lastWork = null;
  function live() { if (disposed) throw new ClothHostError('DISPOSED', 'Cloth host is disposed'); }
  function snapshot() {
    return { state: copyData(acceptedState), frame: copyData(frame), displayStep, phase, needsReset, generation, lastWork: copyData(lastWork) };
  }
  return {
    getSnapshot() { live(); return snapshot(); },
    step() {
      live();
      if (needsReset) throw new ClothHostError('RESET_REQUIRED', 'Reset is required before stepping');
      if (acceptedState.stepIndex >= STEPS) throw new ClothHostError('WORLD_LIMIT', 'Cloth host reached step240');
      const started = performance.now();
      let solverMs = 0, submitMs = 0, twinSteps = 0, stage = 'shadow-step', promoted = false;
      try {
        let marked = performance.now();
        twinSteps++;
        const candidate = pair.shadow.step(DT);
        const candidateFrame = frameFromState(candidate, generation);
        solverMs += performance.now() - marked;
        stage = 'viewer-submit'; marked = performance.now();
        try { viewer.setClothFrame(candidateFrame); }
        finally { submitMs += performance.now() - marked; }
        // Display now names the new genuine state. A later spare failure cannot undo this boundary.
        const previousActive = pair.active;
        pair.active = pair.shadow; pair.shadow = previousActive;
        acceptedState = candidate; frame = candidateFrame; displayStep = candidate.stepIndex; promoted = true;
        stage = 'spare-step'; marked = performance.now();
        twinSteps++;
        const spare = pair.shadow.step(DT);
        if (!sameState(candidate, spare)) throw new ClothHostError('TWIN_MISMATCH', 'Accepted and spare cloth worlds disagree');
        const returnedState = copyData(acceptedState), returnedFrame = copyData(frame);
        solverMs += performance.now() - marked;
        phase = acceptedState.stepIndex === STEPS ? 'complete' : 'paused';
        lastWork = { stepIndex: acceptedState.stepIndex, solverMs, submitMs, hostMs: performance.now() - started,
          twinSteps, stage: 'accepted', accepted: true };
        return { state: returnedState, frame: returnedFrame, stepIndex: acceptedState.stepIndex,
          solverMs, submitMs, hostMs: lastWork.hostMs, twinSteps };
      } catch (error) {
        needsReset = true;
        phase = promoted ? 'spare-unsynchronized' : stage === 'viewer-submit' ? 'submit-failed' : 'solver-failed';
        // Includes failed solver time even if no copied step result was returned.
        const hostMs = performance.now() - started;
        solverMs = Math.max(solverMs, hostMs - submitMs);
        lastWork = { stepIndex: acceptedState.stepIndex, solverMs, submitMs, hostMs, twinSteps, stage,
          accepted: promoted, error: { name: error.name, code: error.code, message: error.message } };
        throw error;
      }
    },
    reset() {
      live();
      const nextGeneration = generation + 1;
      if (!Number.isSafeInteger(nextGeneration)) throw new ClothHostError('WORLD_LIMIT', 'Host generation limit exhausted');
      const candidates = freshPair();
      let nextFrame;
      let cleared = false;
      try {
        nextFrame = frameFromState(candidates.state, nextGeneration);
        viewer.setClothFrame(null); cleared = true;
        frame = null; displayStep = null;
        viewer.setClothFrame(nextFrame);
      } catch (error) {
        candidates.active.dispose(); candidates.shadow.dispose(); needsReset = true;
        phase = cleared ? 'reset-display-empty' : 'reset-clear-failed';
        lastWork = { stage: phase, accepted: false, error: { name: error.name, code: error.code, message: error.message } };
        throw error;
      }
      const old = pair;
      pair = candidates; acceptedState = candidates.state; frame = nextFrame; displayStep = 0; generation = nextGeneration;
      phase = 'paused'; needsReset = false; lastWork = null;
      old.active.dispose(); old.shadow.dispose();
      return snapshot();
    },
    dispose() {
      if (!disposed) { disposed = true; pair.active.dispose(); pair.shadow.dispose(); }
    },
  };
}
