import http from 'node:http';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCompiledResponse } from '@barocss/render-stream/fetch';
import { encodeRecord } from '@barocss/render-stream/protocol';

const appJs = fileURLToPath(new URL('../.build/app.js', import.meta.url));
const contract = { textBindings: ['/name'], actions: ['save'] };
const screens = Object.freeze({
  A: { identity: { streamId: 'host-a', revision: 1 }, title: 'A preview', tone: 'light' },
  B: { identity: { streamId: 'host-b', revision: 2 }, title: 'B current', tone: 'dark' },
});

function* records(identity, screen) {
  let seq = 0;
  const record = (type, fields = {}) => ({ version: 1, ...identity, seq: ++seq, type, ...fields });
  const node = (id, type, props, children = [], on) => record('node', { id,
    node: { type, props: { id, ...props }, children, ...(on ? { on } : {}) } });
  yield record('root', { id: 'root' });
  yield node('root', 'Layout', { columns: 'single', gap: 'fractional' }, ['card']);
  yield node('card', 'Card', { padding: 'spacious', tone: screen.tone }, ['title', 'name', 'save']);
  yield node('title', 'Text', { text: screen.title });
  yield node('name', 'Input', { label: 'Name', value: { $bindState: '/name' } });
  yield node('save', 'Button', { label: 'Save' }, [], { press: { action: 'save' } });
  yield record('checkpoint');
  yield record('commit');
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new Error('Body limit');
  }
  return JSON.parse(body);
}

export async function createHost() {
  const token = randomBytes(24).toString('hex');
  const events = [], runs = [], saveLedger = [], active = new Set();
  let currentToken = null, accepted = null, sequence = 0, releaseA, closed = false;
  const holdA = new Promise((resolve) => { releaseA = resolve; });
  const log = (event, fields = {}) => {
    if (events.length >= 128) throw new Error('Event limit');
    events.push({ order: ++sequence, event, ...fields });
  };
  function admit(run, record, ownedSignal) {
    const why = ownedSignal.aborted ? 'aborted'
      : currentToken !== run.token ? 'stale'
        : accepted?.streamId === run.identity.streamId ? 'duplicate' : null;
    if (why) { log('admission-refused', { streamId: run.identity.streamId, why }); return false; }
    accepted = { ...run.identity, sourceSeq: record.sourceSeq, spec: structuredClone(record.spec),
      css: record.css, input: null, used: false };
    run.accepted = true;
    log('accepted-write', { streamId: run.identity.streamId, revision: run.identity.revision });
    return true;
  }
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (status, type, body) => {
      res.writeHead(status, { 'cache-control': 'no-store', 'content-type': type }); res.end(body);
    };
    const json = (status, body) => send(status, 'application/json', JSON.stringify(body));
    if (req.method === 'GET' && req.url === '/') return send(200, 'text/html; charset=utf-8',
      '<!doctype html><html><head><meta charset="utf-8"><title>Run ownership</title></head><body><main><h1>Run ownership</h1><p id="phase">idle</p><div id="view"></div><p id="saved"></p></main><script src="/app.js"></script></body></html>');
    if (req.method === 'GET' && req.url === '/app.js') return send(200, 'text/javascript', await fs.readFile(appJs));
    if (req.method === 'GET' && req.url === '/session') return json(200, { token, contract });
    if (req.method !== 'POST' || !req.url?.startsWith('/stream') && req.url !== '/save')
      return json(404, { error: 'Not found' });
    if (req.headers.origin !== origin || req.headers['x-session-token'] !== token)
      return json(403, { error: 'Invalid session' });
    if (req.url === '/save') {
      let body;
      try { body = await readBody(req); } catch { return json(400, { error: 'Invalid body' }); }
      if (!accepted || accepted.used || body.streamId !== accepted.streamId
        || body.revision !== accepted.revision || typeof body.name !== 'string'
        || !body.name || body.name.length > 80) return json(409, { error: 'Save unavailable' });
      accepted.used = true; accepted.input = body.name;
      saveLedger.push({ streamId: accepted.streamId, revision: accepted.revision, input: body.name });
      log('save-write', { streamId: accepted.streamId, input: body.name });
      return json(200, { saved: body.name });
    }
    const url = new URL(req.url, origin);
    if (url.pathname !== '/stream') return json(404, { error: 'Not found' });
    const kind = url.searchParams.get('case');
    const screen = kind === 'ok' && runs.length === 0 ? screens.A
      : kind === 'ok' && runs.length === 1 ? screens.B
        : kind === 'invalid-tail' && runs.length === 2 ? screens.B : null;
    if (!screen) return json(409, { error: 'Run limit or sequence' });
    const identity = kind === 'invalid-tail' ? { streamId: 'host-c', revision: 3 } : screen.identity;
    const run = { identity, kind, token: Symbol(identity.streamId), sourceReads: 0,
      sourceEOF: false, callbackEntered: false, callbackSettled: false, ownedAborted: false,
      ownedListenerRemoved: false, responseListenerRemoved: false, accepted: false,
      transportClosed: false, transportError: null, finalRecord: null };
    runs.push(run); currentToken = run.token;
    log('run-start', { streamId: identity.streamId, revision: identity.revision });
    for (const older of active) {
      if (older !== run && !older.abort.signal.aborted) {
        older.abort.abort(new Error('Superseded run'));
        log('supersede-abort', { streamId: older.identity.streamId, by: identity.streamId });
      }
    }
    run.abort = new AbortController(); active.add(run);
    const onResponseClose = () => {
      if (!res.writableFinished) run.abort.abort(new Error('Response closed'));
    };
    res.once('close', onResponseClose);
    const response = createCompiledResponse({ identity, contract, signal: run.abort.signal,
      source: async function* (ownedSignal) {
        const onOwnedAbort = () => {
          run.ownedAborted = true; log('owned-abort', { streamId: identity.streamId });
        };
        ownedSignal.addEventListener('abort', onOwnedAbort, { once: true });
        run.removeOwnedListener = () => {
          if (run.ownedListenerRemoved) return;
          ownedSignal.removeEventListener('abort', onOwnedAbort);
          run.ownedListenerRemoved = true;
          log('owned-listener-remove', { streamId: identity.streamId });
        };
        for (const record of records(identity, screen)) {
          if (ownedSignal.aborted) return;
          run.sourceReads++; log('source-read', { streamId: identity.streamId, seq: record.seq });
          yield encodeRecord(record);
        }
        if (kind === 'invalid-tail') {
          run.sourceReads++; log('invalid-tail', { streamId: identity.streamId });
          yield new TextEncoder().encode('bad-tail\n');
        }
        run.sourceEOF = true; log('source-eof', { streamId: identity.streamId });
      },
      async acceptFinal(record, ownedSignal) {
        run.callbackEntered = true; run.finalRecord = record;
        log('callback-enter', { streamId: identity.streamId, sourceEOF: run.sourceEOF,
          signalAborted: ownedSignal.aborted });
        if (identity.streamId === 'host-a') await holdA;
        const result = admit(run, record, ownedSignal);
        run.callbackSettled = true;
        log('callback-result', { streamId: identity.streamId, result });
        run.removeOwnedListener?.();
        return result;
      },
    });
    res.writeHead(200, { ...Object.fromEntries(response.headers), 'x-content-type-options': 'nosniff' });
    try {
      for await (const chunk of response.body) {
        if (!res.write(chunk)) await new Promise((resolve) => res.once('drain', resolve));
      }
      res.end();
    } catch (failure) {
      run.transportError = String(failure?.message ?? failure);
      res.destroy();
    } finally {
      res.off('close', onResponseClose);
      run.responseListenerRemoved = true;
      if (!run.callbackEntered) run.removeOwnedListener?.();
      run.transportClosed = true; active.delete(run);
      log('transport-close', { streamId: identity.streamId, error: run.transportError });
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    events, runs, saveLedger,
    get accepted() { return structuredClone(accepted); },
    get currentIdentity() { return runs.find((run) => run.token === currentToken)?.identity ?? null; },
    get activeCount() { return active.size; },
    releaseA() { releaseA(); log('release-a'); },
    probeDuplicateB() {
      const run = runs[1];
      if (!run?.finalRecord || !run.accepted) throw new Error('B must be accepted first');
      return admit(run, run.finalRecord, run.abort.signal);
    },
    async close() {
      if (closed) return;
      closed = true;
      releaseA();
      for (const run of active) run.abort.abort(new Error('Host disposed'));
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      log('server-close', { activeCount: active.size });
    },
  };
}
