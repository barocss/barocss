import { createJsonlDecoder } from '@barocss/render-stream/protocol';
import { classesFor, validateSpec } from '@barocss/render';

const phaseNode = document.getElementById('phase');
const view = document.getElementById('view');
const savedNode = document.getElementById('saved');
const sheet = document.createElement('style');
document.head.append(sheet);
let config, current = null, committed = null, phase = 'idle', draft = 'Mina';
let epoch = 0, controller = null, used = false, error = '';
const trace = [];

function element(id, spec) {
  const node = spec.elements[id];
  const tag = { Layout: 'section', Card: 'article', Text: 'p', Input: 'label', Button: 'button' }[node.type];
  const dom = document.createElement(tag);
  dom.dataset.node = id;
  if (node.type === 'Layout' || node.type === 'Card') dom.className = classesFor(node);
  if (node.type === 'Text') dom.textContent = node.props.text;
  if (node.type === 'Input') {
    dom.textContent = node.props.label;
    const input = document.createElement('input');
    input.setAttribute('aria-label', node.props.label); input.value = draft;
    input.addEventListener('input', () => { draft = input.value.slice(0, 80); });
    dom.append(input);
  }
  if (node.type === 'Button') {
    dom.textContent = node.props.label;
    dom.disabled = phase !== 'committed' || used;
    dom.addEventListener('click', save);
  }
  for (const child of node.children) dom.append(element(child, spec));
  return dom;
}

function apply(record, nextPhase) {
  current = record; phase = nextPhase;
  sheet.textContent = record?.css ?? '';
  phaseNode.textContent = nextPhase;
  view.replaceChildren(...(record ? [element(record.spec.root, record.spec)] : []));
  trace.push({ event: 'apply', phase, seq: record?.seq, streamId: record?.streamId,
    sourceSeq: record?.sourceSeq, at: performance.now() });
}

async function start(kind = 'ok') {
  controller?.abort();
  const ticket = ++epoch;
  const abort = new AbortController(); controller = abort;
  used = false; error = ''; savedNode.textContent = '';
  apply(committed, 'receiving');
  let reader;
  try {
    const response = await fetch(`/stream?case=${kind}`, { method: 'POST', signal: abort.signal,
      headers: { 'x-session-token': config.token } });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('application/x-ndjson'))
      throw new Error('Stream unavailable');
    const identity = { streamId: response.headers.get('x-stream-id'), revision: Number(response.headers.get('x-revision')) };
    let final = null;
    const decoder = createJsonlDecoder({ identity, kind: 'output', onRecord(record) {
      if (ticket !== epoch || abort.signal.aborted) throw new Error('Stale run');
      if (!validateSpec(record.spec, config.contract).ok) throw new Error('Invalid screen');
      if (record.phase === 'committed') final = record;
      else apply(record, 'preview');
    } });
    reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (ticket !== epoch || abort.signal.aborted) throw new Error('Stale run');
      if (chunk.done) break;
      decoder.push(chunk.value);
    }
    decoder.finish();
    if (!final) throw new Error('Missing final snapshot');
    committed = final; controller = null;
    apply(final, 'committed');
    return true;
  } catch (failure) {
    if (ticket !== epoch) return false;
    abort.abort(); controller = null;
    error = failure.message;
    apply(committed, 'error');
    return false;
  } finally { reader?.releaseLock(); }
}

function cancel() {
  epoch++; controller?.abort(); controller = null;
  apply(committed, 'cancelled');
}

async function save() {
  if (phase !== 'committed' || used || !committed) return false;
  used = true; apply(committed, 'committed');
  const response = await fetch('/save', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session-token': config.token },
    body: JSON.stringify({ streamId: committed.streamId, revision: committed.revision, name: draft }) });
  if (!response.ok) { error = 'Save unavailable'; return false; }
  savedNode.textContent = (await response.json()).saved;
  return true;
}

window.RENDER_STREAM = {
  start, cancel, state: () => ({ phase, current, committed, draft, used, error,
    css: sheet.textContent, trace: [...trace], saved: savedNode.textContent }),
  probeSave: async (identity, name) => (await fetch('/save', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-session-token': config.token },
    body: JSON.stringify({ ...identity, name }) })).status,
};
fetch('/session').then((response) => response.json()).then((value) => {
  config = value; phaseNode.textContent = 'ready'; window.RENDER_STREAM.ready = true;
});
