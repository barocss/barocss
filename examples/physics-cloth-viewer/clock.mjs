import { DT, STEPS } from './frame.mjs';

const MAX_STEPS_PER_RAF = 12, MAX_DEBT_SECONDS = .1;

export function createPlaybackClock({ step, onProgress = () => {}, onError = () => {}, onStop = () => {} }) {
  let playing = false, disposed = false, raf = null, anchor = null, debt = 0, intervalStart = null;
  let cursor = 0, acceptedSteps = 0, wallSeconds = 0;
  let solverSamplesMs = [], submitSamplesMs = [], hostSamplesMs = [], rafRecords = [], submissions = 0, twinSteps = 0;
  let stopReason = null;
  function stats() {
    const currentWall = wallSeconds + (playing && intervalStart !== null ? (performance.now() - intervalStart) / 1000 : 0);
    const simulatedSeconds = acceptedSteps * DT;
    return { playing, stepIndex: cursor, acceptedSteps, simulatedSeconds, playWallSeconds: currentWall,
      simulatedToWallRatio: currentWall > 0 ? simulatedSeconds / currentWall : null,
      debtSeconds: debt, rafCount: rafRecords.length, submissions, twinSteps, stopReason,
      solverSamplesMs: [...solverSamplesMs], submitSamplesMs: [...submitSamplesMs], hostSamplesMs: [...hostSamplesMs],
      rafRecords: rafRecords.map(record => ({ ...record })) };
  }
  function stop(reason, notify = true) {
    if (playing && intervalStart !== null) wallSeconds += (performance.now() - intervalStart) / 1000;
    playing = false; intervalStart = null; anchor = null; debt = 0; stopReason = reason;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    if (notify) onStop({ reason, stats: stats() });
  }
  function tick(now) {
    raf = null;
    if (!playing || disposed) return;
    const elapsed = Math.max(0, (now - anchor) / 1000); anchor = now;
    debt += elapsed;
    const record = { timestampMs: now, elapsedSeconds: elapsed, debtBeforeSeconds: debt, debtAfterSeconds: null, steps: 0 };
    rafRecords.push(record);
    if (debt > MAX_DEBT_SECONDS) {
      record.debtAfterSeconds = debt;
      stop('debt-overflow'); return;
    }
    try {
      while (playing && debt >= DT && record.steps < MAX_STEPS_PER_RAF && cursor < STEPS) {
        const result = step();
        cursor = result.stepIndex; acceptedSteps++; record.steps++; submissions++; twinSteps += result.twinSteps;
        solverSamplesMs.push(result.solverMs); submitSamplesMs.push(result.submitMs); hostSamplesMs.push(result.hostMs);
        debt -= DT;
        onProgress({ result, stats: stats() });
      }
      record.debtAfterSeconds = debt;
      if (cursor >= STEPS) { stop('complete'); return; }
      if (debt >= DT && record.steps >= MAX_STEPS_PER_RAF) { stop('raf-step-limit'); return; }
    } catch (error) {
      record.debtAfterSeconds = debt;
      stop('error', false); onError(error, stats()); onStop({ reason: 'error', stats: stats() }); return;
    }
    if (playing) raf = requestAnimationFrame(tick);
  }
  return {
    play() {
      if (disposed) throw new Error('Playback clock is disposed');
      if (playing) return;
      if (cursor >= STEPS) { stop('complete'); return; }
      debt = 0; playing = true; stopReason = null; anchor = performance.now(); intervalStart = anchor;
      raf = requestAnimationFrame(tick);
    },
    pause() { if (!disposed) stop('paused'); },
    reset(stepIndex = 0) {
      if (disposed) throw new Error('Playback clock is disposed');
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > STEPS) throw new Error('Invalid clock cursor');
      stop('reset', false); cursor = stepIndex; acceptedSteps = 0; wallSeconds = 0;
      solverSamplesMs = []; submitSamplesMs = []; hostSamplesMs = []; rafRecords = []; submissions = 0; twinSteps = 0; stopReason = null;
    },
    getStats() { return stats(); },
    dispose() { if (!disposed) { stop('disposed', false); disposed = true; } },
  };
}
