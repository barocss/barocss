// D522 test-only injection at the real OPFS writable.write boundary. This does not simulate host quota exhaustion.
export function installD522AutosaveFailureScheduler({ projectName }) {
  const namespace = `projects/${projectName}/`, target = `${namespace}.barocss/autosave/A.bcad`;
  const directories = new WeakMap(), files = new WeakMap(), streams = new WeakMap(), events = [], notices = [];
  let failing = false;
  const log = (kind, data = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...data });
  const storage = Object.getPrototypeOf(navigator.storage), nativeRoot = storage.getDirectory;
  storage.getDirectory = async function (...args) { const root = await nativeRoot.apply(this, args); directories.set(root, ''); return root; };
  const directory = FileSystemDirectoryHandle.prototype, nativeDirectory = directory.getDirectoryHandle, nativeFile = directory.getFileHandle;
  directory.getDirectoryHandle = async function (name, ...args) {
    const result = await nativeDirectory.call(this, name, ...args), parent = directories.get(this);
    if (parent !== undefined) directories.set(result, parent ? `${parent}/${name}` : name);
    return result;
  };
  directory.getFileHandle = async function (name, ...args) {
    const result = await nativeFile.call(this, name, ...args), parent = directories.get(this);
    if (parent !== undefined) files.set(result, parent ? `${parent}/${name}` : name);
    return result;
  };
  const file = FileSystemFileHandle.prototype, nativeWritable = file.createWritable;
  file.createWritable = async function (...args) {
    const result = await nativeWritable.apply(this, args), path = files.get(this);
    streams.set(result, path);
    if (path?.startsWith(namespace)) log('native-createWritable-return', { path, streamType: result.constructor.name });
    return result;
  };
  const stream = FileSystemWritableFileStream.prototype, nativeWrite = stream.write, nativeClose = stream.close, nativeAbort = stream.abort;
  stream.write = async function (...args) {
    const path = streams.get(this);
    if (path?.startsWith(namespace)) log('native-write-attempt', { path });
    if (path === target && failing) {
      log('injected-native-write-rejection', { path, name: 'NotAllowedError', nativeWriteForwarded: false });
      throw new DOMException('D522 injected native autosave write denial', 'NotAllowedError');
    }
    return nativeWrite.apply(this, args);
  };
  stream.close = async function (...args) {
    const result = await nativeClose.apply(this, args), path = streams.get(this);
    if (path?.startsWith(namespace)) log('native-close-committed', { path });
    return result;
  };
  stream.abort = async function (...args) {
    const result = await nativeAbort.apply(this, args), path = streams.get(this);
    if (path?.startsWith(namespace)) log('native-abort-return', { path });
    return result;
  };
  const read = async path => {
    if (!path.startsWith(namespace)) throw new Error('Inspection outside the owned namespace');
    let directory = await nativeRoot.call(navigator.storage);
    const segments = path.split('/');
    for (const name of segments.slice(0, -1)) directory = await nativeDirectory.call(directory, name);
    try {
      const handle = await nativeFile.call(directory, segments.at(-1)), file = await handle.getFile();
      return { path, tag: `${file.size}-${file.lastModified}`, size: file.size, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) };
    } catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
  };
  let visible = null;
  new MutationObserver(() => {
    const alert = document.querySelector('.toast[role="alert"]');
    const next = alert ? { title: alert.querySelector('.toast-title')?.textContent ?? '', hint: alert.querySelector('.toast-hint')?.textContent ?? '' } : null;
    const signature = next ? JSON.stringify(next) : null;
    if (signature !== visible && next) notices.push({ sequence: notices.length, time: performance.now(), ...next });
    visible = signature;
  }).observe(document, { subtree: true, childList: true, characterData: true });
  window.__d522Autosave = {
    read,
    async fail() {
      const copy = await read(target);
      if (!copy?.size || !events.some(event => event.kind === 'native-close-committed' && event.path === target)) throw new Error('A genuine successful autosave must exist before failure injection');
      failing = true; log('failure-injection-enabled', { path: target, name: 'NotAllowedError' });
    },
    recover() { failing = false; log('failure-injection-disabled', { path: target }); },
    snapshot() { return { namespace, target, failing, injection: 'test-only NotAllowedError before native writable.write forwarding; no host quota claim', events: events.slice(), notices: notices.slice() }; },
  };
}
