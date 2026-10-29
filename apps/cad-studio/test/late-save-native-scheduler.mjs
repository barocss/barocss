// D322 test-only native I/O scheduler. Native handles, stream methods, receiver and result values remain unchanged.
export function installD322NativeSaveScheduler({ projectName }) {
  const directories = new WeakMap(), files = new WeakMap(), streams = new WeakMap(), inspected = new WeakSet(), events = [];
  const namespace = `projects/${projectName}/`;
  let armed = null, claimed = null, releaseHold;
  const hold = new Promise(resolve => { releaseHold = resolve; });
  const log = (kind, value = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...value });
  const own = path => typeof path === 'string' && (path === namespace.slice(0, -1) || path.startsWith(namespace));
  const scope = handle => inspected.has(handle) ? 'inspection' : 'production';
  const storage = Object.getPrototypeOf(navigator.storage), nativeRoot = storage.getDirectory;
  storage.getDirectory = async function (...args) {
    const result = await nativeRoot.apply(this, args); directories.set(result, ''); return result;
  };
  const directory = FileSystemDirectoryHandle.prototype, nativeDirectory = directory.getDirectoryHandle, nativeFile = directory.getFileHandle, nativeRemove = directory.removeEntry;
  directory.getDirectoryHandle = async function (name, ...rest) {
    const result = await nativeDirectory.call(this, name, ...rest), parent = directories.get(this);
    if (parent !== undefined) directories.set(result, parent ? `${parent}/${name}` : name);
    if (inspected.has(this)) inspected.add(result);
    return result;
  };
  directory.getFileHandle = async function (name, ...rest) {
    const result = await nativeFile.call(this, name, ...rest), parent = directories.get(this);
    if (parent !== undefined) files.set(result, parent ? `${parent}/${name}` : name);
    if (inspected.has(this)) inspected.add(result);
    return result;
  };
  directory.removeEntry = async function (name, ...rest) {
    const parent = directories.get(this), path = parent === undefined ? null : parent ? `${parent}/${name}` : name;
    try { const result = await nativeRemove.call(this, name, ...rest); if (own(path)) log('native-remove-complete', { path, scope: scope(this) }); return result; }
    catch (error) { if (own(path)) log('native-remove-rejected', { path, scope: scope(this), reason: error?.name ?? String(error) }); throw error; }
  };
  const nativeEntries = directory.entries;
  directory.entries = async function* (...args) {
    const parent = directories.get(this), origin = scope(this);
    for await (const item of nativeEntries.apply(this, args)) {
      const [name, handle] = item, child = parent === undefined ? null : parent ? `${parent}/${name}` : name;
      if (child !== null) { if (handle.kind === 'directory') directories.set(handle, child); else files.set(handle, child); }
      if (inspected.has(this)) inspected.add(handle);
      yield item;
    }
    if (own(parent)) log('native-entries-complete', { path: parent, scope: origin });
  };
  const file = FileSystemFileHandle.prototype, nativeGetFile = file.getFile, nativeWritable = file.createWritable;
  file.getFile = async function (...args) {
    const result = await nativeGetFile.apply(this, args), path = files.get(this);
    if (own(path)) log('native-getFile-return', { path, scope: scope(this), size: result.size, tag: `${result.size}-${result.lastModified}` });
    return result;
  };
  file.createWritable = async function (...args) {
    const result = await nativeWritable.apply(this, args), path = files.get(this);
    const record = { path, selected: path === armed, arguments: args.length };
    streams.set(result, record);
    if (own(path)) log('native-createWritable-return', { path, arguments: args.length, streamType: result.constructor.name, observedMode: result.mode ?? null });
    if (record.selected) { armed = null; claimed = { path, closedNative: false, returnedToCaller: false }; log('claimed', { path }); }
    return result;
  };
  const writable = FileSystemWritableFileStream.prototype, nativeClose = writable.close;
  writable.close = async function (...args) {
    const record = streams.get(this), result = await nativeClose.apply(this, args);
    if (own(record?.path)) log('native-close-committed', { path: record.path });
    if (record?.selected) {
      claimed.closedNative = true; log('native-close-return-held', { path: record.path }); await hold;
      claimed.returnedToCaller = true; log('native-close-return-released', { path: record.path });
    }
    return result;
  };
  window.__d322Save = {
    async inspectRoot() { const result = await nativeRoot.call(navigator.storage); directories.set(result, ''); inspected.add(result); return result; },
    arm(path) { if (!own(path) || armed || claimed) throw new Error('D322 arms one exact file in its own project namespace'); armed = path; log('arm', { path }); },
    release() { log('release-requested'); releaseHold(); },
    snapshot() { return { namespace, armed, claimed: claimed ? { ...claimed } : null, timeUnit: 'ms', events: events.slice() }; },
  };
}
