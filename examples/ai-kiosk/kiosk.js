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

const OVERLAY_DELAY_MS = 300; // fast generations swap in place; the overlay only appears for slow ones
const DECODE_TIMEOUT_MS = 1500;

// Scroll offsets of the fragment's scroll containers, keyed by their index among all stage elements.
function saveScroll() {
  const out = [];
  stage.querySelectorAll('*').forEach((el, i) => { if (el.scrollTop || el.scrollLeft) out.push([i, el.scrollTop, el.scrollLeft]); });
  return out;
}
function restoreScroll(saved) {
  const all = stage.querySelectorAll('*');
  for (const [i, top, left] of saved) if (all[i]) { all[i].scrollTop = top; all[i].scrollLeft = left; }
}

// Build off-DOM, wait for images to decode (bounded), then swap in one step so no frame shows an empty stage.
async function swapScreen(html, step) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html; // already sanitised; template content is inert
  const next = document.importNode(tpl.content, true);
  const decoded = Promise.allSettled([...next.querySelectorAll('img')].map((img) => img.decode()));
  await Promise.race([decoded, new Promise((r) => setTimeout(r, DECODE_TIMEOUT_MS))]);
  const saved = stage.dataset.step === step ? saveScroll() : []; // keep scroll within a step, reset on change
  const apply = () => {
    stage.replaceChildren(next); // the runtime's MutationObserver styles it in a microtask, before paint
    stage.dataset.step = step;
    restoreScroll(saved);
  };
  if (document.startViewTransition && stage.childElementCount) await document.startViewTransition(apply).updateCallbackDone;
  else apply();
}

async function go(action, item, option) {
  if (busy) return;
  if (action !== 'regenerate' && action !== undefined && !isAction(action)) return; // client-side contract check
  busy = true;
  const overlay = setTimeout(() => $('loading').classList.replace('hidden', 'flex'), OVERLAY_DELAY_MS);
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
    await swapScreen(sanitize(data.html).html, data.facts.step);
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
    clearTimeout(overlay);
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
