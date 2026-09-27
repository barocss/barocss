// Kiosk client: posts actions to /screen, injects the sanitised fragment, BaroCSS styles it on insertion.
import { getRuntime } from '/vendor/barocss.js';
import { sanitize } from '/lib/sanitize.mjs';
import { isAction } from '/lib/contract.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
// constructable: CSS lives in adopted sheets, so the page CSP needs no 'unsafe-inline' or nonce for styles.
const runtime = getRuntime({ constructable: true });
runtime.observe(document.body, { scan: true }); // the stage and the chrome around it

let session = null;
let busy = false;
const context = () => ({ weather: $('weather').value, daypart: $('daypart').value, persona: $('persona').value });

async function go(action, item, option) {
  if (busy) return;
  if (action !== 'regenerate' && action !== undefined && !isAction(action)) return; // client-side contract check
  busy = true;
  $('loading').classList.replace('hidden', 'flex');
  $('dev-status').textContent = `generating (${action ?? 'initial'})…`;
  try {
    const res = await fetch('/screen', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session, action, item, option, context: context() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    session = data.session;
    // Defence in depth: sanitise again in the browser with the same allowlist before touching the DOM.
    stage.innerHTML = sanitize(data.html).html;
    stage.dataset.step = data.facts.step;
    if (data.facts.persona) $('persona').value = data.facts.persona;
    $('dev-status').textContent = `step=${data.facts.step} persona=${data.facts.persona ?? '-'} gen=${data.generator} ${data.timings.genMs}ms total=${data.facts.total}`;
    $('dev-noop').textContent = data.noop.unstyled.length
      ? `unstyled tokens (${data.noop.unstyled.length}/${data.noop.tokens}): ${data.noop.unstyled.join(' ')}`
      : `no-op check: 0 unstyled of ${data.noop.tokens} class tokens`;
    $('dev-removed').textContent = `sanitiser removed: tags=${data.removed.tags} attrs=${data.removed.attrs} actions=${data.removed.actions}`;
    $('dev-error').textContent = '';
  } catch (err) {
    $('dev-error').textContent = String(err.message || err);
  } finally {
    busy = false;
    $('loading').classList.replace('flex', 'hidden');
  }
}

stage.addEventListener('click', (ev) => {
  const el = ev.target instanceof Element ? ev.target.closest('[data-action]') : null;
  if (!el || !stage.contains(el)) return;
  const action = el.getAttribute('data-action');
  if (!isAction(action)) return;
  go(action, el.getAttribute('data-item') ?? undefined, el.getAttribute('data-option') ?? undefined);
});
$('regen').addEventListener('click', () => go('regenerate'));
for (const id of ['persona', 'weather', 'daypart']) $(id).addEventListener('change', () => go('regenerate'));

window.kiosk = { go, get busy() { return busy; } }; // for the headless check and manual poking
go();
