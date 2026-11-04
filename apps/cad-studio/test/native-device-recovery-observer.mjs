// D525: observe real native device-loss recovery and existing callbacks. Never invoke a recovery callback.
export function installD525DeviceRecoveryObserver() {
  const viewer = window.__studioViewer;
  if (!viewer?.loseDeviceForTesting || !viewer.computeDevice) throw new Error('Existing Studio Viewer and owned GPUDevice are required');
  const events = [], notices = [], restores = [], ids = new WeakMap(); let serial = 0, visible = null;
  const id = object => { if (!object) return null; if (!ids.has(object)) ids.set(object, ++serial); return ids.get(object); };
  const log = (kind, extra = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...extra });
  const originalDevice = viewer.computeDevice, originalId = id(originalDevice);
  originalDevice.lost.then(info => log('original-native-device-lost', { device: originalId, reason: info.reason, message: info.message }));
  for (const name of ['lose', 'start']) {
    const original = viewer[name];
    if (typeof original !== 'function') throw new Error(`Actual Viewer.${name} method is unavailable`);
    viewer[name] = function (...args) {
      log(`viewer-${name}-entered`, { device: id(this.computeDevice), ready: this.ready });
      return original.apply(this, args);
    };
    restores.push(() => { viewer[name] = original; });
  }
  for (const name of ['onRecover', 'onRecoverError', 'onRecoverStart']) {
    if (!(name in viewer)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(viewer, name); let callback = viewer[name];
    const wrapper = function (...args) {
      log(`actual-${name}-called`, { device: id(viewer.computeDevice), ready: viewer.ready,
        error: args[0] ? { code: args[0].code ?? null, message: args[0].message ?? String(args[0]) } : null });
      return typeof callback === 'function' ? callback.apply(this, args) : undefined;
    };
    Object.defineProperty(viewer, name, { configurable: true, enumerable: descriptor?.enumerable ?? true,
      get() { return wrapper; }, set(value) { callback = value; } });
    restores.push(() => {
      if (descriptor) Object.defineProperty(viewer, name, { ...descriptor, value: callback });
      else { delete viewer[name]; viewer[name] = callback; }
    });
  }
  const observer = new MutationObserver(() => {
    const toast = document.querySelector('.toast[role="alert"]');
    const notice = toast ? { title: toast.querySelector('.toast-title')?.textContent ?? '', hint: toast.querySelector('.toast-hint')?.textContent ?? '' } : null;
    const signature = notice ? JSON.stringify(notice) : null;
    if (signature !== visible && notice) notices.push({ sequence: notices.length, time: performance.now(), ...notice });
    visible = signature;
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true });
  const camera = () => ({ position: Array.from(viewer.camera.position), target: Array.from(viewer.camera.target), up: Array.from(viewer.camera.up),
    fovY: viewer.camera.fovY, projection: viewer.camera.projection });
  log('observer-installed', { originalDevice: originalId });
  window.__d525Device = {
    snapshot() { return { observation: 'Actual Viewer methods/callbacks and native GPUDevice.lost; callbacks are never fabricated', originalDevice: originalId,
      currentDevice: id(viewer.computeDevice), replacement: viewer.computeDevice !== null && viewer.computeDevice !== originalDevice,
      ready: viewer.ready, recoveryPending: viewer.recovery !== null, camera: camera(), events: events.slice(), notices: notices.slice() }; },
    restore() { observer.disconnect(); for (const restore of restores.reverse()) restore(); },
  };
}

// Test-only replacement-acquisition boundary. Hold forwards the real acquired device unchanged.
// Reject is explicitly injected; it does not claim organic adapter/device failure.
export function installD525ReplacementDeviceGate({ mode }) {
  if (!['hold-return', 'reject'].includes(mode)) throw new Error('Unknown D525 device gate mode');
  const sentinel = 'D525_INJECTED_REPLACEMENT_REQUEST_DEVICE_REJECTION';
  let prototype = GPUAdapter.prototype;
  while (prototype && !Object.getOwnPropertyDescriptor(prototype, 'requestDevice')) prototype = Object.getPrototypeOf(prototype);
  if (!prototype) throw new Error('Native GPUAdapter.requestDevice descriptor is unavailable');
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'requestDevice'), original = descriptor.value;
  const events = []; let armed = true, release;
  const hold = new Promise(resolve => { release = resolve; });
  const log = (kind, extra = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...extra });
  Object.defineProperty(prototype, 'requestDevice', { ...descriptor, value: async function (...args) {
    if (!armed) return original.apply(this, args);
    armed = false; log('replacement-request-entered', { mode });
    if (mode === 'reject') { log('injected-request-rejection', { sentinel, nativeRequestForwarded: false }); throw new Error(sentinel); }
    const device = await original.apply(this, args);
    log('native-replacement-acquired-return-held'); await hold;
    log('native-replacement-return-released'); return device;
  } });
  window.__d525DeviceGate = {
    snapshot() { return { mode, sentinel, armed, events: events.slice() }; },
    release() { log('release-requested'); release(); },
    restore() { release(); Object.defineProperty(prototype, 'requestDevice', descriptor); },
  };
}
