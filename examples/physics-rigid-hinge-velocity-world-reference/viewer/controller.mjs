import {createPlaybackClock} from './clock.mjs';

const IDS = ['pairA0', 'pairB0', 'pairA1', 'pairB1'];
const BASIS = Object.freeze({basis: 'part-xyz-matches-rhyup'});
const key = ref => ref.modelId + '\u0000' + ref.surfaceId;
export function errorDiagnostic(error) {
  try {
    if (error instanceof Error) {
      const own = name => Object.getOwnPropertyDescriptor(error, name)?.value;
      const name = own('name') ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(error), 'name')?.value ?? 'Error';
      return {name: typeof name === 'string' ? name : 'Error', code: typeof own('code') === 'string' || typeof own('code') === 'number' ? own('code') : null,
        message: typeof own('message') === 'string' ? own('message') : 'Unknown error'};
    }
  } catch { /* No arbitrary thrown payload is inspected further. */ }
  return {name: 'UnknownThrown', code: null, message: 'Unknown thrown value'};
}

/** A submission is the only operation that can commit the confirmed cursor. */
export function createRecordedController({recording, createSession, validateFrame, makeViewerFrame,
  onChange = () => {}, requestFrame, cancelFrame}) {
  if (!recording || !Array.isArray(recording.frames) || recording.frames.length !== 1201 ||
    typeof recording.frameFor !== 'function' || typeof createSession !== 'function' ||
    typeof validateFrame !== 'function' || typeof makeViewerFrame !== 'function') throw new Error('Recorded controller configuration is invalid');
  let cursor = null, displayKnown = false, disposed = false;
  let session = null, lastViewer = null, sessionSerial = 0, presentationCount = 0, freshSerial = 0;
  const errors = [];
  let clock;
  function snapshot() {
    const stats = clock?.getStats();
    return {cursor, displayedCursor: displayKnown ? cursor : null,
      timeSeconds: cursor === null ? null : recording.frames[cursor].timeSeconds,
      playing: stats?.playing ?? false, ended: cursor === 1200, disposed, displayKnown,
      sessionSerial, presentationCount, pendingRAF: stats?.pendingRAF ?? 0,
      errors: structuredClone(errors)};
  }
  const notify = () => onChange(snapshot());
  function failure(phase, uncertain, error) {
    if (uncertain) displayKnown = false;
    errors.push({phase, message: phase === 'validation' ? '기록 또는 화면 바인딩을 확인할 수 없습니다.' : '화면 상태를 확인할 수 없습니다.', diagnostic: errorDiagnostic(error), unknownPayloadStored: false});
    clock.pause('error'); notify(); return false;
  }
  function checkBindings(motion, bindings) {
    if (!Array.isArray(bindings) || bindings.length !== 4 || !Array.isArray(motion.poses) || motion.poses.length !== 4)
      throw new Error('Recorded binding population is invalid');
    const state = session.viewer.getState();
    if (state.status !== 'ready' || !Array.isArray(state.surfaces) || state.surfaces.length !== 4)
      throw new Error('Recorded Viewer surfaces are unavailable');
    const surfaces = new Set(state.surfaces.map(key)), targets = new Set(), bound = new Set();
    for (const binding of bindings) {
      if (binding.contextId !== motion.contextId || !IDS.includes(binding.targetId) || targets.has(binding.targetId) ||
        !binding.ref || !surfaces.has(key(binding.ref)) || bound.has(key(binding.ref))) throw new Error('Recorded binding is stale');
      targets.add(binding.targetId); bound.add(key(binding.ref));
    }
    if (surfaces.size !== 4 || bound.size !== 4 || new Set(motion.poses.map(pose => pose.targetId)).size !== 4 ||
      motion.poses.some(pose => !targets.has(pose.targetId))) throw new Error('Recorded pose coverage is invalid');
  }
  function present(index) {
    if (disposed || !session) return false;
    let frame, motion, bindings;
    try {
      if (!Number.isInteger(index) || index < 0 || index > 1200) throw new Error('Recorded frame is missing');
      frame = recording.frameFor(index); validateFrame(frame);
      if (frame.stepIndex !== index || frame.timeSeconds !== index * recording.dt) throw new Error('Recorded cursor differs');
      bindings = structuredClone(session.bindings); motion = makeViewerFrame(frame, bindings);
      if (motion.timeSeconds !== frame.timeSeconds) throw new Error('Recorded Viewer time differs');
      checkBindings(motion, bindings);
    } catch (error) { return failure('validation', false, error); }
    try { session.viewer.applyMotionFrame(motion, bindings, BASIS); }
    catch (error) { return failure('submission', true, error); }
    if (disposed) return false;
    cursor = index; displayKnown = true; presentationCount++; notify(); return true;
  }
  clock = createPlaybackClock({dt: recording.dt, lastIndex: 1200, advance: present, changed: notify, requestFrame, cancelFrame});
  /** Session creation is asynchronous (the Viewer acquires a WebGPU device); a newer reset or disposal wins. */
  async function fresh() {
    if (disposed) return false;
    const serial = ++freshSerial;
    clock.pause('paused'); displayKnown = false;
    if (session) { lastViewer = session.viewer; session.viewer.dispose(); session = null; }
    let candidate = null;
    try {
      candidate = await createSession();
      if (disposed || serial !== freshSerial) { candidate?.viewer?.dispose?.(); return false; }
      if (!candidate || !candidate.viewer || !Array.isArray(candidate.bindings)) throw new Error('Recorded session is invalid');
      session = candidate; lastViewer = session.viewer; sessionSerial++;
    } catch (error) { session = null; return failure('session', true, error); }
    if (!present(0)) return false;
    clock.setCursor(0); notify(); return true;
  }
  return Object.freeze({
    initialize: fresh,
    reset: fresh,
    seek(index) { clock.pause('paused'); const accepted = present(index); if (accepted) clock.setCursor(index); return accepted; },
    oneStep() { if (disposed || cursor === 1200) return false; clock.pause('paused'); const next = (cursor ?? -1) + 1; const accepted = present(next); if (accepted) clock.setCursor(next); return accepted; },
    play() { if (disposed || !displayKnown || cursor === null) return false; return clock.play(cursor); },
    pause() { clock.pause('paused'); },
    dispose() {
      if (disposed) return;
      disposed = true; displayKnown = false; clock.dispose();
      if (session) { lastViewer = session.viewer; session.viewer.dispose(); session = null; }
      notify();
    },
    getSnapshot: snapshot,
    getClockStats: () => clock.getStats(),
    getViewerState() { return lastViewer?.getState() ?? null; },
    readPixels() { if (disposed || !displayKnown || !session) throw new Error('Recorded pixels are unavailable'); return session.viewer.readPixels(); },
    getRecordingFrame: index => recording.frameFor(index),
  });
}
