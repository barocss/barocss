import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';
import { BASE_CLASSES } from '../barocss-render-prototype/visual.jsx';
import { createJsonState, JsonArm, validateJsonSpec } from '../barocss-render-prototype/json-adapter.jsx';
import { PrototypeArm } from '../barocss-render-prototype/prototype-adapter.jsx';

let arm;
let root;
let store;
let currentSpec;
let prototypeState = { name: 'Ada' };
const actions = [];
const onSave = () => actions.push({ action: 'save', value: window.CORPUS_REPLAY.state().name });

function applySavedJson(specJson) {
  if (typeof specJson !== 'string') return { ok: false, source: 'capture', errors: [{ path: '$', message: 'Expected saved JSON text' }] };
  let spec;
  try { spec = JSON.parse(specJson); }
  catch { return { ok: false, source: 'capture', errors: [{ path: '$', message: 'Saved JSON cannot be parsed' }] }; }
  const shared = validateSpec(spec);
  if (!shared.ok) return { ...shared, source: 'shared-schema' };
  if (arm === 'json-render') {
    const official = validateJsonSpec(spec);
    if (!official.ok) return { ...official, source: 'official-schema' };
  }
  const started = performance.now();
  flushSync(() => root.render(arm === 'prototype'
    ? <PrototypeArm spec={spec} onSave={onSave} onState={(next) => { prototypeState = next; }} />
    : <JsonArm spec={spec} store={store} onSave={onSave} />));
  currentSpec = spec;
  return { ok: true, source: arm, errors: [], renderApplyMs: performance.now() - started };
}

window.CORPUS_REPLAY = {
  mount(selectedArm, specJson) {
    if (root || !['prototype', 'json-render'].includes(selectedArm)) throw new Error('Choose one arm on first mount');
    arm = selectedArm;
    store = createJsonState();
    root = createRoot(document.getElementById('out'));
    const runtime = window.BaroCSS.getRuntime();
    for (const token of BASE_CLASSES.split(' ')) runtime.addClass(token);
    return applySavedJson(specJson);
  },
  update(specJson) {
    if (!root) throw new Error('Mount first');
    return applySavedJson(specJson);
  },
  state: () => arm === 'prototype' ? { ...prototypeState } : store.getSnapshot(),
  actions: () => actions.slice(),
  currentSpec: () => currentSpec ? structuredClone(currentSpec) : null,
};
