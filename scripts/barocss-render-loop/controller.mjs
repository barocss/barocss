import { performance } from 'node:perf_hooks';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';

const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function readScreen(result, expectedSessionId) {
  if (!exactKeys(result, ['threadId', 'specJson']) || !sessionIdPattern.test(result.threadId)
    || typeof result.specJson !== 'string' || Buffer.byteLength(result.specJson) > 32_768) {
    throw new Error('Invalid generation envelope');
  }
  if (expectedSessionId && result.threadId !== expectedSessionId) throw new Error('Session changed');
  let spec;
  try { spec = JSON.parse(result.specJson); }
  catch { throw new Error('Generated screen is not JSON'); }
  const checked = validateSpec(spec);
  if (!checked.ok) throw new Error(`Invalid generated screen at ${checked.errors[0].path}`);
  return spec;
}

export function createSessionController({ generate, clock = () => performance.now() }) {
  if (typeof generate !== 'function') throw new Error('A generation transport is required');
  let epoch = 0;
  let inFlight = null;
  let state = { phase: 'idle', revision: 0, turn: 0, spec: null, name: '', threadId: null,
    error: null, firstGenerationMs: null, actionGenerationMs: null, granularity: 'complete-response' };
  const snapshot = () => {
    const publicState = { ...state };
    delete publicState.threadId;
    return structuredClone(publicState);
  };

  function launch(kind, input) {
    const ticket = ++epoch;
    const abort = new AbortController();
    inFlight = abort;
    const started = clock();
    Promise.resolve().then(() => {
      if (ticket !== epoch) return null;
      return generate({ kind, ...input, signal: abort.signal });
    }).then((result) => {
      if (ticket !== epoch) return;
      const spec = readScreen(result, kind === 'next' ? state.threadId : null);
      if (kind === 'initial') {
        const nodes = Object.values(spec.elements);
        if (nodes.filter((node) => node.type === 'Input').length !== 1
          || nodes.filter((node) => node.type === 'Button' && node.on?.press?.action === 'save').length !== 1
          || spec.elements.name?.type !== 'Input' || spec.elements.save?.type !== 'Button') {
          throw new Error('Initial screen requires one name input and one save action');
        }
      } else if (!Object.values(spec.elements).some((node) => node.type === 'Text'
        && [input.input.name, `Name: ${input.input.name}`].includes(node.props.text))) {
        throw new Error('Next screen must show the exact entered name');
      }
      state = { ...state, phase: 'ready', revision: state.revision + 1,
        turn: kind === 'initial' ? 1 : 2, spec, threadId: result.threadId, error: null,
        [kind === 'initial' ? 'firstGenerationMs' : 'actionGenerationMs']: Math.round(clock() - started) };
      inFlight = null;
    }).catch((error) => {
      if (ticket !== epoch) return;
      const safeErrors = new Set(['Invalid generation envelope', 'Session changed',
        'Generated screen is not JSON', 'Initial screen requires one name input and one save action',
        'Next screen must show the exact entered name']);
      const message = error instanceof Error ? error.message : '';
      const safeMessage = safeErrors.has(message) || /^Invalid generated screen at [a-z0-9.$-]+$/i.test(message)
        ? message : 'Generation failed';
      state = { ...state, phase: 'failed', error: safeMessage };
      inFlight = null;
    });
  }

  return {
    snapshot,
    start(request) {
      if (state.phase !== 'idle') return { ok: false, status: 409, error: 'Session already started' };
      if (!exactKeys(request, ['prompt']) || typeof request.prompt !== 'string'
        || request.prompt.length < 1 || request.prompt.length > 300) {
        return { ok: false, status: 400, error: 'Expected a 1 to 300 character prompt' };
      }
      state = { ...state, phase: 'generating', error: null };
      launch('initial', { prompt: request.prompt });
      return { ok: true, status: 202 };
    },
    action(request) {
      if (!exactKeys(request, ['action', 'revision', 'input']) || request.action !== 'save'
        || !Number.isSafeInteger(request.revision) || !exactKeys(request.input, ['name'])
        || typeof request.input.name !== 'string' || request.input.name.length < 1
        || request.input.name.length > 80) {
        return { ok: false, status: 400, error: 'Invalid action payload' };
      }
      if (state.phase !== 'ready' || state.turn !== 1 || request.revision !== state.revision) {
        return { ok: false, status: 409, error: 'Stale or duplicate action' };
      }
      state = { ...state, phase: 'action-pending', name: request.input.name, error: null };
      launch('next', { threadId: state.threadId, action: 'save', revision: state.revision,
        input: { name: state.name } });
      return { ok: true, status: 202 };
    },
    cancel() {
      if (!['generating', 'action-pending'].includes(state.phase)) {
        return { ok: false, status: 409, error: 'Nothing to cancel' };
      }
      epoch++;
      inFlight?.abort();
      inFlight = null;
      state = { ...state, phase: 'cancelled', error: null };
      return { ok: true, status: 200 };
    },
    restart() {
      epoch++;
      inFlight?.abort();
      inFlight = null;
      state = { phase: 'idle', revision: state.revision, turn: 0, spec: null, name: '', threadId: null,
        error: null, firstGenerationMs: null, actionGenerationMs: null, granularity: 'complete-response' };
      return { ok: true, status: 200 };
    },
  };
}
