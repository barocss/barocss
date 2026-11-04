// D528: observe real own Worker construction/messages/errors. Fault injection is one explicit invalid wire request.
export function installD528NativeWorkerObserver() {
  const NativeWorker = window.Worker, records = [], events = []; let next = 0;
  const log = (kind, data = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...data });
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const record = { key: ++next, worker: this, relevant: String(url).includes('engine.worker'), terminated: false };
      records.push(record); log('construct', { key: record.key, relevant: record.relevant, url: String(url) });
      this.addEventListener('error', event => log('native-error-event', { key: record.key, message: event.message, filename: event.filename }));
      this.addEventListener('message', event => log('native-message-event', { key: record.key, id: event.data?.id ?? null, resultOK: event.data?.result?.ok ?? null }));
    }
    postMessage(message, ...rest) {
      const record = records.find(record => record.worker === this);
      log('actual-client-submit', { key: record.key, type: message?.type, id: message?.id, revision: message?.revision ?? null });
      return super.postMessage(message, ...rest);
    }
    terminate() {
      const record = records.find(record => record.worker === this); record.terminated = true;
      log('actual-client-terminate', { key: record.key }); return super.terminate();
    }
  };
  let injected = false;
  window.__d528Worker = {
    injectInvalidWire() {
      if (injected) throw new Error('Only one deliberate native protocol fault per context');
      const record = records.findLast(record => record.relevant && !record.terminated);
      if (!record) throw new Error('No live owned engine Worker'); injected = true;
      log('deliberate-invalid-wire-submit', { key: record.key, missingWireNode: -52500001 });
      NativeWorker.prototype.postMessage.call(record.worker, { type: 'evaluate', id: -525, revision: -525, doc: { added: [], ids: [-52500001], doc: {} } });
    },
    snapshot() { return { fault: 'Deliberate malformed wire request to real own Worker; no fabricated ErrorEvent/onerror/onFailure/result', injected,
      workers: records.map(({ key, relevant, terminated }) => ({ key, relevant, terminated })), events: events.slice() }; },
  };
}
