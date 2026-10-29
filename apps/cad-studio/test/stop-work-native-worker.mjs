// D321 test-only FIFO client-delivery hold. Real Worker source/results/transfers and mass payloads are untouched.
export function installD321NativeWorkerHold() {
  const NativeWorker = window.Worker, records = new Map(), byWorker = new WeakMap(), events = [];
  let serial = 0, armed = false, claimed = null;
  const log = (kind, value = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...value });
  window.__d321Worker = {
    arm() {
      if (armed || claimed && !records.get(claimed.key)?.dead) throw new Error('The prior claimed native Worker must terminate before rearming');
      armed = true; claimed = null; log('arm');
    },
    snapshot() { return { armed, claimed, timeUnit: 'ms', events: events.slice() }; },
  };
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const key = ++serial, relevant = String(url).includes('engine.worker');
      const record = { key, relevant, held: [], dead: false, holding: false };
      records.set(key, record); byWorker.set(this, record);
      log('construct', { key, relevant, url: String(url) });
      // Installed before EngineClient.onmessage. Hold original native MessageEvents together, in arrival order.
      this.addEventListener('message', event => {
        const data = event.data, info = { key, id: data?.id ?? null, progress: data?.progress ?? null,
          masses: Array.isArray(data?.masses), revision: data?.result?.revision ?? null, resultOK: data?.result?.ok ?? null,
          bodyCount: data?.result?.bodies?.length ?? null };
        log('native-receive', info);
        if (record.dead) { event.stopImmediatePropagation(); log('discard-after-termination', info); }
        else if (record.holding) { event.stopImmediatePropagation(); record.held.push(event); log('held', info); }
        else log('delivery-to-client', info);
      });
      this.addEventListener('error', event => log('worker-error', { key, message: event.message }));
    }
    postMessage(message, ...rest) {
      const record = byWorker.get(this);
      if (record.relevant) {
        const nativeSource = message?.nativeSource ? { ...message.nativeSource } : null;
        const sourceNodeCount = message?.doc?.ids?.length ?? null;
        const sourceNodes = Array.isArray(message?.doc?.added) ? message.doc.added.map(([wireId, node]) => ({ wireId, id: node?.id ?? null, kind: node?.kind ?? null })) : null;
        log('submit', { key: record.key, type: message?.type, id: message?.id, revision: message?.revision ?? null, nativeSource, sourceNodeCount, sourceNodes });
        if (armed && message?.type === 'evaluate') {
          armed = false; claimed = { key: record.key, id: message.id, revision: message.revision, nativeSource, sourceNodeCount };
          record.holding = true; log('claimed', claimed);
        }
      }
      return super.postMessage(message, ...rest);
    }
    terminate() {
      const record = byWorker.get(this);
      record.dead = true; log('terminate', { key: record.key, discardedHeld: record.held.length }); record.held.length = 0;
      return super.terminate();
    }
  };
}
