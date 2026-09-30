import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { validateSpec } from '../../packages/barocss-render/src/contract.mjs';
import { BASE_CLASSES } from '../barocss-render-prototype/visual.jsx';
import { PrototypeArm } from '../barocss-render-prototype/prototype-adapter.jsx';
import { createDelivery } from './delivery.mjs';

const liveRoot = createRoot(document.getElementById('live'));
const baselineRoot = createRoot(document.getElementById('baseline'));
const runtime = window.BaroCSS.getRuntime();
for (const token of BASE_CLASSES.split(' ')) runtime.addClass(token);

let now = 0;
let inputState = { name: 'Ada' };
const actions = [];
const delivery = createDelivery({ clock: () => now, onAction: (action) => actions.push(action) });

function renderLive() {
  const state = delivery.snapshot();
  flushSync(() => liveRoot.render(<>
    <span data-live-phase={state.phase}>{state.phase}</span>
    {state.visibleSpec
      ? <fieldset id="live-render" disabled={!['action-ready', 'committed'].includes(state.phase)}
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <PrototypeArm spec={state.visibleSpec}
            onState={(value) => { inputState = value; }}
            onSave={() => delivery.action({ revision: state.revision + (state.phase === 'action-ready' ? 1 : 0),
              name: inputState.name })} />
        </fieldset>
      : <div data-live-empty="true">Waiting for a valid screen</div>}
  </>));
  return state;
}

window.LIVE_BROWSER = {
  start(ids, elapsedMs) {
    now = elapsedMs;
    const result = delivery.start(ids);
    renderLive();
    return result;
  },
  push(line, processId, elapsedMs) {
    now = elapsedMs;
    const result = delivery.push(line, processId);
    renderLive();
    return result;
  },
  finish(processId, elapsedMs) {
    now = elapsedMs;
    const result = delivery.finish(processId);
    renderLive();
    return result;
  },
  baseline(spec) {
    const checked = validateSpec(spec);
    if (!checked.ok) return { ok: false, reason: 'invalid-baseline-spec' };
    const started = performance.now();
    flushSync(() => baselineRoot.render(<fieldset id="baseline-render"
      style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <PrototypeArm spec={spec} onState={() => {}} onSave={() => {}} />
    </fieldset>));
    return { ok: true, renderApplyMs: performance.now() - started };
  },
  snapshot: () => delivery.snapshot(),
  actions: () => structuredClone(actions),
};
renderLive();
