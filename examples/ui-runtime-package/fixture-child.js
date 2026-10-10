const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content;
const hostOrigin = meta('host-origin');
const instanceId = meta('instance-id');
const bundleDigest = meta('bundle-digest');
if (!hostOrigin || new URL(hostOrigin).origin !== hostOrigin ||
  !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(instanceId ?? '') ||
  !/^[a-f0-9]{64}$/.test(bundleDigest ?? '')) throw new Error('Invalid frame metadata');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const valid = (state) => exact(state, ['name', 'count']) && typeof state.name === 'string' &&
  state.name.length <= 80 && Number.isInteger(state.count) && state.count >= 0 && state.count <= 1000;
let initialized = false;
let count = 0;
let name = '';
let canSave = false;
const root = document.getElementById('app');
const send = (type, state) => parent.postMessage({ type, instanceId, bundleDigest,
  ...(state ? { state: { name: state.name, count: state.count } } : {}) }, hostOrigin);
const state = () => ({ name, count });
const draw = () => {
  root.replaceChildren();
  const label = document.createElement('label'); label.textContent = 'Name';
  const input = document.createElement('input'); input.setAttribute('aria-label', 'Name'); input.value = name;
  input.oninput = () => { name = input.value.slice(0, 80); send('state', state()); draw(); };
  label.append(input);
  const value = document.createElement('p'); value.id = 'value'; value.textContent = `Count: ${count}; Price: ${count * UNIT_PRICE}`;
  const add = document.createElement('button'); add.textContent = 'Add'; add.disabled = count >= 1000;
  add.onclick = () => { count = Math.min(1000, count + 1); send('state', state()); draw(); };
  const save = document.createElement('button'); save.textContent = 'Save'; save.disabled = !canSave;
  save.onclick = () => send('save', state());
  root.append(label, value, add, save);
};
window.addEventListener('message', (event) => {
  const message = event.data;
  if (event.source !== parent || event.origin !== hostOrigin ||
    !exact(message, ['type', 'instanceId', 'bundleDigest', 'initialState', 'canSave']) ||
    message.type !== 'init' || message.instanceId !== instanceId || message.bundleDigest !== bundleDigest ||
    typeof message.canSave !== 'boolean' || !valid(message.initialState)) return;
  if (!initialized) { count = message.initialState.count; name = message.initialState.name; initialized = true; }
  canSave = message.canSave;
  draw();
  send('state', state());
});
send('ready');
