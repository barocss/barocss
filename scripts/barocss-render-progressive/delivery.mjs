import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';

const MAX_LINE_BYTES = 1_000_000;
const MAX_TURN_BYTES = 2_000_000;
const MAX_SCREEN_BYTES = 32_768;
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const ownKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function readScreen(text) {
  if (typeof text !== 'string' || byteLength(text) > MAX_SCREEN_BYTES) return null;
  let envelope;
  try { envelope = JSON.parse(text); } catch { return null; }
  if (!ownKeys(envelope, ['specJson']) || typeof envelope.specJson !== 'string') return null;
  let spec;
  try { spec = JSON.parse(envelope.specJson); } catch { return null; }
  return validateSpec(spec).ok ? spec : null;
}

export function createDelivery({ clock = () => performance.now(), onAction = () => {} } = {}) {
  let decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  let receivedBytes = 0;
  let text = '';
  let itemId = null;
  let itemComplete = false;
  let completedText = null;
  let startedAt = null;
  let actionUsed = false;
  let queuedAction = null;
  let state = {
    phase: 'idle', processId: null, threadId: null, turnId: null,
    revision: 0, visibleSpec: null, committedSpec: null, inputName: '',
    previewMs: null, actionReadyMs: null, completedMs: null, error: null,
  };
  const snapshot = () => structuredClone(state);
  const fail = (reason) => {
    state = { ...state, phase: 'failed', visibleSpec: state.committedSpec, error: reason };
    queuedAction = null;
    return { ok: false, reason };
  };
  const active = () => ['generating', 'preview', 'action-ready'].includes(state.phase);
  function checkIds(params, method) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
    if (params.threadId !== state.threadId) return false;
    if ('turnId' in params && params.turnId !== state.turnId) return false;
    if ((method.startsWith('item/') || method === 'error') && params.turnId !== state.turnId) return false;
    if (method === 'turn/completed' || method === 'turn/started') return params.turn?.id === state.turnId;
    return true;
  }
  function handle(event) {
    if (!active()) return fail('event-after-terminal');
    if (!event || typeof event !== 'object' || typeof event.method !== 'string'
      || !checkIds(event.params, event.method)) return fail('event-id-or-shape');
    const { method, params } = event;
    if (method === 'turn/started') {
      if (params.turn.status !== 'inProgress') return fail('turn-status');
      return { ok: true };
    }
    if (method === 'item/started') {
      if (itemId || !Number.isFinite(params.startedAtMs)
        || params.item?.type !== 'agentMessage' || !ID.test(params.item.id)) return fail('unexpected-item');
      itemId = params.item.id;
      return { ok: true };
    }
    if (method === 'item/agentMessage/delta') {
      if (itemComplete || params.itemId !== itemId || typeof params.delta !== 'string') return fail('invalid-delta');
      text += params.delta;
      if (byteLength(text) > MAX_SCREEN_BYTES) return fail('screen-limit');
      const spec = readScreen(text);
      if (spec) {
        state = { ...state, phase: 'preview', visibleSpec: spec,
          previewMs: state.previewMs ?? Math.round(clock() - startedAt) };
      }
      return { ok: true };
    }
    if (method === 'item/completed') {
      if (itemComplete || !Number.isFinite(params.completedAtMs)
        || params.item?.type !== 'agentMessage' || params.item.id !== itemId
        || typeof params.item.text !== 'string' || (text && params.item.text !== text)
        || (params.item.phase && params.item.phase !== 'final_answer')) return fail('item-mismatch');
      text = params.item.text;
      const spec = readScreen(params.item.text);
      if (!spec) return fail('invalid-screen');
      itemComplete = true;
      completedText = params.item.text;
      state = { ...state, phase: 'action-ready', visibleSpec: spec,
        previewMs: state.previewMs ?? Math.round(clock() - startedAt),
        actionReadyMs: Math.round(clock() - startedAt) };
      return { ok: true };
    }
    if (method === 'turn/completed') {
      if (params.turn.status !== 'completed' || !itemComplete || !completedText
        || completedText !== text) return fail('turn-incomplete');
      const items = params.turn.items;
      const messages = Array.isArray(items) ? items.filter((item) => item?.type === 'agentMessage') : [];
      if (!Array.isArray(items) || messages.length !== 1 || messages[0].id !== itemId
        || messages[0].text !== completedText
        || (messages[0].phase && messages[0].phase !== 'final_answer')
        || items.some((item) => !['userMessage', 'reasoning', 'agentMessage'].includes(item?.type))) {
        return fail('final-item-mismatch');
      }
      const spec = readScreen(completedText);
      if (!spec) return fail('final-screen-mismatch');
      state = { ...state, phase: 'committed', visibleSpec: spec, committedSpec: spec,
        revision: state.revision + 1, completedMs: Math.round(clock() - startedAt), error: null };
      if (queuedAction) {
        const action = queuedAction;
        queuedAction = null;
        onAction(action);
      }
      return { ok: true };
    }
    if (method === 'error') return fail('turn-error');
    return fail('unexpected-event');
  }
  return {
    snapshot,
    start({ processId, threadId, turnId }) {
      if (active() || ![processId, threadId, turnId].every((value) => typeof value === 'string' && ID.test(value))) {
        return { ok: false, reason: 'invalid-start' };
      }
      decoder = new TextDecoder('utf-8', { fatal: true });
      pending = ''; receivedBytes = 0; text = ''; itemId = null; itemComplete = false;
      completedText = null; startedAt = clock(); actionUsed = false; queuedAction = null;
      state = { ...state, phase: 'generating', processId, threadId, turnId,
        visibleSpec: state.committedSpec, previewMs: null, actionReadyMs: null,
        completedMs: null, error: null };
      return { ok: true };
    },
    push(bytes, processId) {
      if (processId !== state.processId) return { ok: false, reason: 'stale-process' };
      if (!active()) return state.phase === 'committed'
        ? fail('event-after-terminal') : { ok: false, reason: 'inactive' };
      const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
      if (!(data instanceof Uint8Array)) return fail('invalid-bytes');
      receivedBytes += data.byteLength;
      if (receivedBytes > MAX_TURN_BYTES) return fail('turn-limit');
      try { pending += decoder.decode(data, { stream: true }); }
      catch { return fail('invalid-utf8'); }
      if (byteLength(pending) > MAX_LINE_BYTES) return fail('line-limit');
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline).replace(/\r$/, '');
        pending = pending.slice(newline + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { return fail('invalid-jsonrpc'); }
        const result = handle(event);
        if (!result.ok) return result;
      }
      return { ok: true };
    },
    finish(processId) {
      if (processId !== state.processId) return { ok: false, reason: 'stale-process' };
      try { pending += decoder.decode(); } catch { return fail('invalid-utf8'); }
      if (pending.trim() || state.phase !== 'committed') return fail('transport-incomplete');
      return { ok: true };
    },
    action({ revision, name }) {
      if (!Number.isSafeInteger(revision) || typeof name !== 'string' || name.length < 1 || name.length > 80
        || actionUsed || !['action-ready', 'committed'].includes(state.phase)
        || revision !== state.revision + (state.phase === 'action-ready' ? 1 : 0)) {
        return { ok: false, reason: 'stale-or-duplicate-action' };
      }
      actionUsed = true;
      state = { ...state, inputName: name };
      const action = { action: 'save', revision, name, processId: state.processId,
        threadId: state.threadId, turnId: state.turnId };
      if (state.phase === 'action-ready') {
        queuedAction = action;
        return { ok: true, queued: true };
      }
      onAction(action);
      return { ok: true, queued: false };
    },
    cancel() {
      if (!active()) return { ok: false, reason: 'inactive' };
      queuedAction = null;
      state = { ...state, phase: 'cancelled', visibleSpec: state.committedSpec, error: null };
      return { ok: true };
    },
  };
}
