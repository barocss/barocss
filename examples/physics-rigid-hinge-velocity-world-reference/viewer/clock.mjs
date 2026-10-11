/** Recorded cursor scheduling only. No physical state or integration. */
export function createPlaybackClock({dt, lastIndex, advance, changed = () => {},
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = handle => globalThis.cancelAnimationFrame(handle), maxCatchUpFrames = 8}) {
  if (!(Number.isFinite(dt) && dt > 0) || !Number.isInteger(lastIndex) || lastIndex < 0 ||
    typeof advance !== 'function' || !Number.isInteger(maxCatchUpFrames) || maxCatchUpFrames < 1)
    throw new Error('Recorded clock configuration is invalid');
  let cursor = 0, playing = false, disposed = false, handle = null, previous = null, debt = 0;
  let ticks = 0, advances = 0, stopReason = 'initial';
  function stats() { return {playing, cursor, stopReason, pendingRAF: handle === null ? 0 : 1, ticks, advances, disposed}; }
  function pause(reason = 'paused') {
    playing = false; previous = null; debt = 0; stopReason = reason;
    if (handle !== null) { cancelFrame(handle); handle = null; }
    changed(stats());
  }
  function tick(now) {
    handle = null;
    if (!playing || disposed) return;
    ticks++;
    if (!Number.isFinite(now)) { pause('error'); return; }
    if (previous === null) previous = now;
    const elapsed = Math.max(0, now - previous); previous = now;
    // Hidden-tab delay cannot enqueue an unbounded backlog or skip the trace.
    debt = Math.min(maxCatchUpFrames, debt + elapsed / (dt * 1000));
    const count = Math.min(Math.floor(debt + 1e-9), maxCatchUpFrames, lastIndex - cursor);
    for (let index = 0; index < count && playing && !disposed; index++) {
      const next = cursor + 1;
      let accepted = false;
      try { accepted = advance(next) === true; } catch { accepted = false; }
      if (!accepted) { pause('error'); return; }
      cursor = next; debt = Math.max(0, debt - 1); advances++;
      if (cursor === lastIndex) { pause('end'); return; }
    }
    if (cursor === lastIndex) { pause('end'); return; }
    if (playing && !disposed) handle = requestFrame(tick);
    changed(stats());
  }
  return Object.freeze({
    play(index = cursor) {
      if (disposed) return false;
      if (!Number.isInteger(index) || index < 0 || index > lastIndex) throw new Error('Recorded clock cursor is invalid');
      if (playing) return true;
      cursor = index;
      if (cursor === lastIndex) { pause('end'); return false; }
      previous = null; debt = 0; playing = true; stopReason = null; handle = requestFrame(tick); changed(stats()); return true;
    },
    pause,
    setCursor(index) {
      if (disposed) return;
      if (!Number.isInteger(index) || index < 0 || index > lastIndex) throw new Error('Recorded clock cursor is invalid');
      cursor = index; stopReason = cursor === lastIndex ? 'end' : 'paused'; changed(stats());
    },
    dispose() { if (disposed) return; disposed = true; pause('disposed'); },
    getStats: stats,
  });
}
