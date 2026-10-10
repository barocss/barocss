const frame = document.createElement('iframe');
frame.title = 'Compiled UI fixture';
frame.setAttribute('sandbox', 'allow-scripts');
const instanceId = crypto.randomUUID();
const bundleDigest = document.querySelector('meta[name="bundle-digest"]').content;
const messages = [];
let selectedState = null;
window.addEventListener('message', (event) => {
  const data = event.data;
  if (event.source !== frame.contentWindow || event.origin !== 'null' || !data || typeof data !== 'object'
    || data.instanceId !== instanceId || data.bundleDigest !== bundleDigest) return;
  messages.push({ ...data, origin: event.origin });
  if (data.type === 'ready') frame.contentWindow.postMessage({ type: 'init', instanceId, bundleDigest,
    initialState: { name: 'Min', count: 2 }, canSave: false }, '*');
  if (data.type === 'state') selectedState = data.state;
});
document.getElementById('frame').append(frame);
frame.src = `/frame/${bundleDigest}.html?instanceId=${instanceId}`;
window.FIXTURE = { inspect: () => structuredClone({ instanceId, bundleDigest, messages, selectedState }) };
