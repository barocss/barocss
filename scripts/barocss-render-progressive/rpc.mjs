// Bounded JSON-RPC over the stdio of a caller-owned child process.
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toError = (value) => value instanceof Error ? value : new Error(String(value));

export function createRpc({ child, clock = () => performance.now(), onEvent = () => {},
  onChunk = () => {}, onRequest = () => {}, onFailure = () => {},
  requestTimeoutMs = 180_000, maxBytes = 10_000_000, maxLineBytes = 1_000_000,
  maxEvents = 10_000 } = {}) {
  if (!child?.stdin?.write || !child?.stdout?.on || !child?.stderr?.on || !child?.on
    || [requestTimeoutMs, maxBytes, maxLineBytes, maxEvents].some((n) => !Number.isSafeInteger(n) || n < 1)) {
    throw new Error('A child with stdio and positive RPC limits is required');
  }

  let nextId = 1;
  let bytes = 0;
  let events = 0;
  let pendingLine = Buffer.alloc(0);
  let failure = null;
  let ended = false;
  let closing = false;
  let closeTask = null;
  let eventTail = Promise.resolve();
  const requests = new Map();
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  let markExited;
  const exited = new Promise((resolve) => { markExited = resolve; });

  const rejectPending = (error) => {
    for (const entry of requests.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    requests.clear();
  };
  const fail = (reason) => {
    if (failure) return;
    failure = toError(reason);
    rejectPending(failure);
    try { onFailure(failure); } catch { /* Failure reporting cannot revive the RPC. */ }
    finish({ ok: false, error: failure });
  };
  const available = () => {
    if (failure) throw failure;
    if (ended || closing) throw new Error('RPC closed');
  };
  const write = (message) => {
    available();
    const line = Buffer.from(JSON.stringify(message) + '\n');
    if (line.length > maxLineBytes) throw new Error('RPC request line limit');
    try { child.stdin.write(line, (error) => { if (error) fail(error); }); }
    catch (error) { fail(error); throw toError(error); }
  };
  const handleLine = (raw) => {
    let line;
    try { line = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
    catch { return fail('Invalid UTF-8 in RPC stdout'); }
    if (!line.trim()) return;
    if (++events > maxEvents) return fail('RPC event limit');
    let event;
    try { event = JSON.parse(line); }
    catch { return fail('Malformed RPC JSON'); }
    if (!isObject(event)) return fail('Invalid RPC message');
    if (Object.hasOwn(event, 'id')) {
      if (Object.hasOwn(event, 'method')) return fail('Unexpected RPC server request');
      const entry = requests.get(event.id);
      if (!entry) return fail('Unknown RPC response');
      if (Object.hasOwn(event, 'result') === Object.hasOwn(event, 'error')) {
        return fail('Invalid RPC response');
      }
      requests.delete(event.id);
      clearTimeout(entry.timer);
      if (Object.hasOwn(event, 'error')) entry.reject(new Error('RPC request rejected'));
      else entry.resolve(event.result);
      return;
    }
    if (typeof event.method !== 'string' || !event.method || !isObject(event.params)) {
      return fail('Invalid RPC notification');
    }
    const receivedMs = clock();
    eventTail = eventTail.then(() => onEvent({ event, line, receivedMs }));
    // Keep this chain settled so later events still reach the callback.
    eventTail = eventTail.catch((error) => { fail(error); });
  };
  const onStdout = (chunk) => {
    if (failure || ended) return;
    const raw = Buffer.from(chunk);
    const receivedMs = clock();
    bytes += raw.length;
    if (bytes > maxBytes) return fail('RPC byte limit');
    try { onChunk({ stream: 'stdout', bytes: raw, receivedMs }); }
    catch (error) { return fail(error); }
    let start = 0;
    for (let index = 0; index < raw.length; index++) {
      if (raw[index] !== 10) continue;
      const part = raw.subarray(start, index);
      if (pendingLine.length + part.length > maxLineBytes) return fail('RPC line limit');
      const line = pendingLine.length ? Buffer.concat([pendingLine, part]) : part;
      pendingLine = Buffer.alloc(0);
      handleLine(line);
      if (failure) return;
      start = index + 1;
    }
    const rest = raw.subarray(start);
    if (pendingLine.length + rest.length > maxLineBytes) return fail('RPC line limit');
    pendingLine = pendingLine.length ? Buffer.concat([pendingLine, rest]) : Buffer.from(rest);
  };
  const onStderr = (chunk) => {
    if (failure || ended) return;
    const raw = Buffer.from(chunk);
    bytes += raw.length;
    if (bytes > maxBytes) return fail('RPC byte limit');
    try { onChunk({ stream: 'stderr', bytes: raw, receivedMs: clock() }); }
    catch (error) { fail(error); }
  };
  child.stdout.on('data', onStdout);
  child.stdout.on('end', () => { if (!closing && !ended) fail('RPC stdout ended'); });
  child.stderr.on('data', onStderr);
  child.stdout.on('error', fail);
  child.stderr.on('error', fail);
  child.stdin.on('error', fail);
  child.on('error', fail);
  child.on('exit', (code, signal) => {
    if (ended) return;
    ended = true;
    markExited();
    if (!failure && pendingLine.length) fail('Incomplete RPC line at exit');
    if (!failure && requests.size) fail('RPC exited with pending requests');
    if (!failure) finish({ ok: closing, code, signal });
  });

  return {
    finished,
    request(method, params = {}) {
      try { available(); }
      catch (error) { return Promise.reject(error); }
      if (typeof method !== 'string' || !method || !isObject(params)) {
        return Promise.reject(new Error('Invalid RPC request'));
      }
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => fail(`RPC request timeout: ${method}`), requestTimeoutMs);
        requests.set(id, { resolve, reject, timer });
        try {
          onRequest({ id, method, sentMs: clock() });
          write({ id, method, params });
        } catch (error) {
          requests.delete(id);
          clearTimeout(timer);
          fail(error);
          reject(toError(error));
        }
      });
    },
    notify(method, params = {}) {
      if (typeof method !== 'string' || !method || !isObject(params)) {
        throw new Error('Invalid RPC notification');
      }
      write({ method, params });
    },
    async drain() {
      await eventTail;
      if (failure) throw failure;
    },
    close() {
      if (closeTask) return closeTask;
      closeTask = (async () => {
        if (ended) return finished;
        closing = true;
        rejectPending(new Error('RPC closed'));
        try { child.stdin.end(); } catch (error) { fail(error); }
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        await Promise.race([exited, wait(1_000)]);
        if (!ended) child.kill('SIGTERM');
        await Promise.race([exited, wait(1_000)]);
        if (!ended) {
          child.kill('SIGKILL');
          fail('RPC child did not exit');
        }
        return finished;
      })();
      return closeTask;
    },
  };
}
