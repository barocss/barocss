const phaseNode = document.getElementById('phase'), errorNode = document.getElementById('error');
const current = document.getElementById('current');
const config = await (await fetch('/session')).json();
let phase = 'idle', epoch = 0, abort = null, active = null, committed = null;
const events = [];
const mark = (kind, fields = {}) => events.push({ kind, at: performance.now(), ...fields });
const stateValid = (value) => value && Object.keys(value).sort().join(',') === 'count,name'
  && Number.isInteger(value.count) && value.count >= 0 && value.count <= 1000 && typeof value.name === 'string' && value.name.length <= 80;
const setPhase = (value) => { phase = value; phaseNode.textContent = value; mark('phase', { phase }); };
const sendInit = (frame, initialState = frame.record.initialState) => {
  if (frame.ready) frame.element.contentWindow.postMessage({ type: 'init', instanceId: frame.instanceId,
    bundleDigest: frame.record.bundleDigest, initialState, canSave: phase === 'committed' && active === committed && !frame.used }, '*');
};
const dispose = (frame) => { if (frame) {
  clearTimeout(frame.timeout); frame.rejectMounted(new DOMException('Frame disposed', 'AbortError')); frame.element.remove();
} };
const restore = (nextPhase) => {
  if (active !== committed) dispose(active);
  active = committed; if (active) active.element.hidden = false;
  setPhase(nextPhase); if (active) sendInit(active); mark('restored', { instanceId: active?.instanceId });
};
const cancel = () => { epoch++; abort?.abort(); abort = null; restore('cancelled'); };
async function save(frame, state) {
  if (phase !== 'committed' || frame !== committed || frame.used || frame.saving || !stateValid(state)) return;
  frame.saving = true;
  const response = await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-token': config.token },
    body: JSON.stringify({ ...state, streamId: frame.record.streamId, revision: frame.record.revision, bundleDigest: frame.record.bundleDigest }) });
  if (response.status === 200) {
    frame.used = true; const result = await response.json();
    if (active === frame) { document.getElementById('saved').textContent = `${result.saved.name}: ${result.saved.count}`; sendInit(frame); }
    mark('saved', { state: result.saved, instanceId: frame.instanceId });
  }
  frame.saving = false;
}
function handleMessage(event) {
  const frame = active, data = event.data;
  if (!frame || event.source !== frame.element.contentWindow || event.origin !== 'null' || !data || typeof data !== 'object'
    || data.instanceId !== frame.instanceId || data.bundleDigest !== frame.record.bundleDigest) return;
  const keys = Object.keys(data).sort().join(',');
  if (data.type === 'ready' && keys === 'bundleDigest,instanceId,type') { frame.ready = true; sendInit(frame); }
  else if (['state', 'save'].includes(data.type) && keys === 'bundleDigest,instanceId,state,type' && stateValid(data.state)) {
    frame.state = structuredClone(data.state); mark(data.type, { state: frame.state, instanceId: frame.instanceId });
    if (data.type === 'state') { clearTimeout(frame.timeout); frame.resolveMounted(); }
    else void save(frame, frame.state).catch((error) => { errorNode.textContent = error.message; });
  }
}
window.addEventListener('message', handleMessage);
const mount = (record) => {
  const element = document.createElement('iframe'), instanceId = crypto.randomUUID();
  element.setAttribute('sandbox', 'allow-scripts'); element.title = 'Generated JSX UI';
  let resolveMounted, rejectMounted;
  const mounted = new Promise((resolve, reject) => { resolveMounted = resolve; rejectMounted = reject; });
  // Early rejection is recorded until final admission awaits it.
  mounted.catch(() => {});
  const frame = { record, element, instanceId, ready: false, state: null, used: false, saving: false, mounted, resolveMounted, rejectMounted };
  frame.timeout = setTimeout(() => rejectMounted(new Error('Frame mount timeout')), 5000);
  active = frame; current.append(element);
  element.src = `${record.frameUrl}?instanceId=${instanceId}`; mark('module', { bundleDigest: record.bundleDigest, initialState: record.initialState, instanceId });
};
async function start(variant = 'counter') {
  abort?.abort(); const ticket = ++epoch, controller = new AbortController(); abort = controller;
  if (active && active !== committed) dispose(active);
  // Keep the browsing context in the same DOM parent. Reparenting an iframe reloads it.
  if (committed) committed.element.hidden = true;
  active = null; setPhase('receiving'); if (committed) sendInit(committed);
  errorNode.textContent = ''; document.getElementById('saved').textContent = '';
  let reader;
  try {
    const response = await fetch('/stream', { method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-session-token': config.token }, body: JSON.stringify({ variant }) });
    if (!response.ok || !response.body) throw new Error('Source unavailable');
    reader = response.body.getReader(); let pending = new Uint8Array(0), total = 0, seq = 0, final = false;
    const decode = new TextDecoder('utf-8', { fatal: true });
    const accept = (record) => {
      if (!record || record.version !== 1 || record.seq !== ++seq || seq > 2 || !/^[a-zA-Z0-9_-]{1,64}$/.test(record.streamId)
        || !Number.isSafeInteger(record.revision) || record.revision < 1 || final) throw new Error('Invalid stream record');
      if (seq === 1) {
        if (Object.keys(record).sort().join(',') !== 'bundleDigest,frameUrl,initialState,moduleId,phase,revision,seq,sourceDigest,streamId,type,version'
          || record.type !== 'module' || record.phase !== 'preview' || record.moduleId !== 'counter'
          || !/^[a-f0-9]{64}$/.test(record.bundleDigest) || !/^[a-f0-9]{64}$/.test(record.sourceDigest)
          || record.frameUrl !== `/frame/${record.bundleDigest}.html` || !stateValid(record.initialState)) throw new Error('Invalid module');
        mount(record); setPhase('preview');
      } else {
        if (Object.keys(record).sort().join(',') !== 'bundleDigest,revision,seq,streamId,type,version'
          || record.type !== 'commit' || !active || record.streamId !== active.record.streamId
          || record.revision !== active.record.revision || record.bundleDigest !== active.record.bundleDigest) throw new Error('Invalid final');
        final = true;
      }
    };
    while (true) {
      const chunk = await reader.read(); if (ticket !== epoch || controller.signal.aborted) throw new Error('Stale browser source');
      if (chunk.done) break;
      total += chunk.value.length; if (total > 16384) throw new Error('Stream byte limit');
      const bytes = new Uint8Array(pending.length + chunk.value.length); bytes.set(pending); bytes.set(chunk.value, pending.length);
      let startAt = 0;
      for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10) {
        if (i - startAt > 8192) throw new Error('Stream line limit');
        accept(JSON.parse(decode.decode(bytes.subarray(startAt, i)))); startAt = i + 1;
      }
      pending = bytes.slice(startAt); if (pending.length > 8192 || (final && pending.length)) throw new Error('Invalid tail');
    }
    if (pending.length || !final || !active) throw new Error('Incomplete source');
    await active.mounted;
    if (ticket !== epoch || controller.signal.aborted) throw new Error('Stale mount');
    if (committed && committed !== active) dispose(committed);
    committed = active; abort = null; setPhase('committed'); sendInit(active); mark('committed', { bundleDigest: active.record.bundleDigest });
    return true;
  } catch (error) {
    if (ticket !== epoch) return false;
    controller.abort(); abort = null; errorNode.textContent = error.message; restore('error'); return false;
  } finally { reader?.releaseLock(); }
}
document.getElementById('start').onclick = () => void start();
document.getElementById('different').onclick = () => void start('different');
document.getElementById('invalid').onclick = () => void start('invalid');
document.getElementById('cancel').onclick = cancel;
window.JSX_UI = { start, cancel, rerender: (initialState) => { if (!stateValid(initialState)) throw new Error('Invalid state hint'); if (active) sendInit(active, initialState); },
  inspect: () => structuredClone({ ready: true, phase, active: active && { record: active.record, instanceId: active.instanceId, state: active.state },
    committed: committed && { record: committed.record, instanceId: committed.instanceId, state: committed.state }, events }),
  async probeSave(value) { return (await fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-token': config.token }, body: JSON.stringify(value) })).status; },
  dispose() {
    epoch++; abort?.abort(); dispose(active); if (committed !== active) dispose(committed);
    window.removeEventListener('message', handleMessage);
    for (const id of ['start', 'different', 'invalid', 'cancel']) document.getElementById(id).onclick = null;
    delete window.JSX_UI;
  } };
