import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { REQUEST_CONTRACT, TRANSITIONS, requestScreen, checkRequestScreen } from './scenario.mjs';

// Resolve the package's published root export. Never import source JSX or experiment runners.
const packageRoot = new URL('../../packages/barocss-render/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
const { validateSpec } = await import(new URL(manifest.exports['.'].import, packageRoot));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const validInput = (input) => exact(input, ['draft']) && exact(input.draft, ['name', 'topic'])
  && ['name', 'topic'].every((field) => typeof input.draft[field] === 'string'
    && input.draft[field].length >= 1 && input.draft[field].length <= 80);
const reject = (status, error) => ({ ok: false, status, error });
const safeErrors = new Set(['Invalid generation envelope', 'Generation correlation changed',
  'Generated screen is not JSON', 'Invalid generated screen', 'Screen actions do not match the host transition',
  'Screen fields do not match the host stage', 'Screen summary does not match host input']);

export function createRequestSession({ generate, contract = REQUEST_CONTRACT, createId = randomUUID }) {
  if (typeof generate !== 'function' || typeof createId !== 'function') throw new Error('Host functions are required');
  // Copy host declarations; later caller mutation cannot change this session's permissions.
  const sample = { draft: { name: 'Ada', topic: 'Coffee' } };
  if (['form', 'review', 'confirmed'].some((stage) => !validateSpec(requestScreen(stage, sample), contract).ok))
    throw new Error('Invalid host contract');
  contract = Object.freeze({ textBindings: Object.freeze([...contract.textBindings]), actions: Object.freeze([...contract.actions]) });
  let epoch = 0, serial = 0, pending = null;
  let state = { phase: 'idle', sessionId: null, revision: 0, displays: 0, stage: 'form', spec: null,
    input: { draft: { name: '', topic: '' } }, screenRequest: null, timings: null, error: null };
  const snapshot = () => structuredClone(state);
  const usable = () => state.spec && ['ready', 'failed', 'cancelled'].includes(state.phase);

  function launch(kind, action, target) {
    const ticket = ++epoch;
    const abort = new AbortController();
    const started = performance.now();
    const request = { kind, sessionId: state.sessionId, revision: state.revision,
      requestId: `${state.sessionId}:${++serial}`, action, target, input: structuredClone(state.input), screenRequest: state.screenRequest };
    // State and transport never share mutable payload objects.
    const done = Promise.resolve().then(() => {
      if (ticket !== epoch) return null;
      return generate({ ...structuredClone(request), signal: abort.signal, contract });
    }).then((result) => {
      if (ticket !== epoch) return;
      const generated = performance.now();
      if (!exact(result, ['sessionId', 'revision', 'requestId', 'specJson'])
        || typeof result.specJson !== 'string' || Buffer.byteLength(result.specJson) > 32_768)
        throw new Error('Invalid generation envelope');
      if (result.sessionId !== request.sessionId || result.revision !== request.revision || result.requestId !== request.requestId)
        throw new Error('Generation correlation changed');
      let spec;
      try { spec = JSON.parse(result.specJson); } catch { throw new Error('Generated screen is not JSON'); }
      if (!validateSpec(spec, contract).ok) throw new Error('Invalid generated screen');
      checkRequestScreen(spec, target, request.input);
      state = { ...state, phase: 'ready', stage: target, spec, revision: state.revision + 1,
        displays: state.displays + 1, timings: { generationMs: generated - started, validationMs: performance.now() - generated }, error: null };
      pending = null;
    }).catch((error) => {
      if (ticket !== epoch) return;
      state = { ...state, phase: 'failed', revision: state.revision + 1,
        error: safeErrors.has(error?.message) ? error.message : 'Generation failed' };
      pending = null;
    });
    pending = { abort, done };
  }

  function current(request, keys) {
    if (!exact(request, keys) || !Number.isSafeInteger(request.revision) || typeof request.sessionId !== 'string')
      return reject(400, 'Invalid request');
    if (!usable() || request.sessionId !== state.sessionId || request.revision !== state.revision)
      return reject(409, 'Stale or duplicate request');
    return null;
  }

  return {
    contract, snapshot,
    settled: () => pending?.done ?? Promise.resolve(),
    start(request) {
      if (state.phase !== 'idle') return reject(409, 'Session already started');
      const legacy = exact(request, ['input']);
      if ((!legacy && !exact(request, ['input', 'screenRequest'])) || !validInput(request.input)) return reject(400, 'Invalid input');
      const screenRequest = legacy ? 'Create a request form' : request.screenRequest;
      if (typeof screenRequest !== 'string' || screenRequest.length < 1 || screenRequest.length > 300)
        return reject(400, 'Invalid screen request');
      const sessionId = createId();
      if (typeof sessionId !== 'string' || !uuid.test(sessionId)) throw new Error('Invalid host session ID');
      state = { ...state, sessionId, screenRequest, input: structuredClone(request.input), phase: 'generating', error: null };
      launch('initial', null, 'form');
      return { ok: true, status: 202 };
    },
    updateInput(request) {
      const error = current(request, ['sessionId', 'revision', 'input']);
      if (error) return error;
      if (state.stage !== 'form') return reject(409, 'Input is not editable in this stage');
      if (!validInput(request.input)) return reject(400, 'Invalid input');
      state = { ...state, input: structuredClone(request.input) };
      return { ok: true, status: 200 };
    },
    action(request) {
      const error = current(request, ['sessionId', 'revision', 'action']);
      if (error) return error;
      if (!contract.actions.includes(request.action)) return reject(400, 'Undeclared action');
      const exposed = Object.values(state.spec.elements).some((node) => node.type === 'Button' && node.on.press.action === request.action);
      if (!exposed || !Object.hasOwn(TRANSITIONS[state.stage], request.action)) return reject(409, 'Action is not permitted in this stage');
      state = { ...state, phase: 'action-pending', error: null };
      launch('next', request.action, TRANSITIONS[state.stage][request.action]);
      return { ok: true, status: 202 };
    },
    cancel() {
      if (!pending) return reject(409, 'Nothing to cancel');
      epoch++; pending.abort.abort(); pending = null;
      state = { ...state, phase: 'cancelled', revision: state.revision + 1, error: null };
      return { ok: true, status: 200 };
    },
    restart() {
      epoch++; pending?.abort.abort(); pending = null;
      state = { phase: 'idle', sessionId: null, revision: state.revision + 1, displays: 0,
        stage: 'form', spec: null, input: { draft: { name: '', topic: '' } }, screenRequest: null, timings: null, error: null };
      return { ok: true, status: 200 };
    },
  };
}
