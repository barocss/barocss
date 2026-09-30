import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BASE_CLASSES } from '../barocss-render-prototype/visual.jsx';
import { PrototypeArm } from '../barocss-render-prototype/prototype-adapter.jsx';
import { createDelivery } from './delivery.mjs';

const root = createRoot(document.getElementById('out'));
const runtime = window.BaroCSS.getRuntime();
for (const token of BASE_CLASSES.split(' ')) runtime.addClass(token);

let now = 0;
let inputState = { name: 'Ada' };
const actions = [];
const delivery = createDelivery({ clock: () => now, onAction: (action) => actions.push(action) });

function render() {
  const state = delivery.snapshot();
  flushSync(() => root.render(<>
    <div data-replay-phase={state.phase} aria-live="polite">{state.phase}</div>
    {state.visibleSpec
      ? <fieldset data-action-gate disabled={!['action-ready', 'committed'].includes(state.phase)}
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><PrototypeArm spec={state.visibleSpec}
          onState={(value) => { inputState = value; }}
          onSave={() => delivery.action({ revision: state.revision + (state.phase === 'action-ready' ? 1 : 0),
            name: inputState.name })} /></fieldset>
      : <div data-replay-empty="true">Waiting for a valid screen</div>}
  </>));
  return state;
}

window.PROGRESSIVE_REPLAY = {
  start(ids, elapsedMs = 0) { now = elapsedMs; const result = delivery.start(ids); render(); return result; },
  push(bytes, processId, elapsedMs) { now = elapsedMs; const result = delivery.push(bytes, processId); render(); return result; },
  finish(processId, elapsedMs) { now = elapsedMs; const result = delivery.finish(processId); render(); return result; },
  cancel(elapsedMs) { now = elapsedMs; const result = delivery.cancel(); render(); return result; },
  snapshot: () => delivery.snapshot(),
  inputState: () => ({ ...inputState }),
  actions: () => structuredClone(actions),
};
render();
