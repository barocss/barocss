import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { validateSpec } from '../../packages/barocss-render/src/index.jsx';
import { BASE_CLASSES } from './visual.jsx';
import { INITIAL, editedSpec } from './fixture.mjs';
import { createJsonState, JsonArm, validateJsonSpec } from './json-adapter.jsx';
import { PrototypeArm } from './prototype-adapter.jsx';

let arm, root, lastSpec, store, prototypeState = { name: 'Ada' };
const actionLog = [];
const onSave = () => actionLog.push({ name: 'save', value: window.COMPARE.state().name });
function render(spec) {
  const checked = validateSpec(spec);
  if (!checked.ok) return checked;
  if (arm === 'json-render') {
    const official = validateJsonSpec(spec);
    if (!official.ok) return official;
  }
  const runtime = window.BaroCSS.getRuntime();
  for (const token of BASE_CLASSES.split(' ')) runtime.addClass(token);
  flushSync(() => root.render(arm === 'prototype'
    ? <PrototypeArm spec={spec} onSave={onSave} onState={(next) => { prototypeState = next; }} />
    : <JsonArm spec={spec} store={store} onSave={onSave} />));
  lastSpec = spec;
  return { ok: true, errors: [] };
}

window.COMPARE = {
  mount(selectedArm, spec = INITIAL) {
    if (root || !['prototype', 'json-render'].includes(selectedArm)) throw new Error('Choose one arm on first mount');
    arm = selectedArm;
    store = createJsonState();
    root = createRoot(document.getElementById('out'));
    return render(spec);
  },
  update(spec) { if (!root) throw new Error('Mount first'); return render(spec); },
  editedSpec,
  initialSpec: () => structuredClone(INITIAL),
  state: () => arm === 'prototype' ? { ...prototypeState } : store.getSnapshot(),
  actions: () => actionLog.slice(),
  currentSpec: () => structuredClone(lastSpec),
};

const selectedArm = new URLSearchParams(location.search).get('arm');
if (selectedArm) {
  const result = window.COMPARE.mount(selectedArm);
  if (!result.ok) document.getElementById('out').textContent = JSON.stringify(result.errors);
}
