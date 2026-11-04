// D523: FIFO hold of original native engine Worker MessageEvents. No replacement payload or product action.
export function installD523PlacedReplyScheduler() {
  const NativeWorker = window.Worker, records = new WeakMap(), events = [];
  let prototype = NativeWorker.prototype, onmessageDescriptor;
  while (prototype && !onmessageDescriptor) {
    onmessageDescriptor = Object.getOwnPropertyDescriptor(prototype, 'onmessage');
    prototype = Object.getPrototypeOf(prototype);
  }
  if (!onmessageDescriptor?.set) throw new Error('Native Worker onmessage setter is required');
  let serial = 0, armed = false, claimed = null;
  const log = (kind, data = {}) => events.push({ sequence: events.length, time: performance.now(), kind, ...data });
  window.__d523Placed = {
    arm() { if (armed || claimed) throw new Error('One placed hold per fresh context'); armed = true; log('arm'); },
    release() {
      if (!claimed) return;
      const record = records.get(claimed.worker); record.holding = false;
      log('release', { key: record.key, count: record.held.length });
      for (const event of record.held.splice(0)) {
        log('original-event-forwarded', { key: record.key, id: event.data?.id ?? null });
        if (typeof record.callback !== 'function') throw new Error('The real EngineClient onmessage callback is absent');
        log('client-callback-reached', { key: record.key, id: event.data?.id ?? null, delivery: 'held-original-event' });
        record.callback.call(claimed.worker, event);
      }
    },
    snapshot() { return { armed, claimed: claimed ? { key: claimed.key, id: claimed.id, revision: claimed.revision, place: claimed.place } : null, events: events.slice() }; },
  };
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const record = { key: ++serial, relevant: String(url).includes('engine.worker'), holding: false, held: [], dead: false, callback: null };
      records.set(this, record);
      // Native Worker event-handler redispatch is not portable. Capture the actual assigned client callback,
      // install a transparent native-delivery wrapper, and forward each held original event to that callback.
      Object.defineProperty(this, 'onmessage', {
        configurable: true,
        get() { return record.callback; },
        set(callback) {
          record.callback = callback;
          log('client-handler-assigned', { key: record.key, installed: typeof callback === 'function' });
          const wrapper = typeof callback === 'function' ? function (event) {
            log('client-callback-reached', { key: record.key, id: event.data?.id ?? null, delivery: 'native' });
            return callback.call(this, event);
          } : null;
          onmessageDescriptor.set.call(this, wrapper);
        },
      });
      this.addEventListener('message', event => {
        const data = event.data;
        log('native-receive', { key: record.key, id: data?.id ?? null, resultOK: data?.result?.ok ?? null, bodyCount: data?.result?.bodies?.length ?? null });
        if (record.dead) { event.stopImmediatePropagation(); return; }
        if (record.holding) {
          event.stopImmediatePropagation(); record.held.push(event);
          log('native-event-held', { key: record.key, id: data?.id ?? null, resultOK: data?.result?.ok ?? null });
        } else log('native-event-delivered', { key: record.key, id: data?.id ?? null });
      });
    }
    postMessage(message, ...rest) {
      const record = records.get(this);
      if (record.relevant) {
        log('submit', { key: record.key, type: message?.type, id: message?.id, revision: message?.revision ?? null, place: message?.place ?? null });
        if (armed && message?.type === 'placed') {
          armed = false; record.holding = true;
          claimed = { worker: this, key: record.key, id: message.id, revision: message.revision, place: message.place };
          log('claimed', { key: record.key, id: message.id, revision: message.revision, place: message.place });
        }
      }
      return super.postMessage(message, ...rest);
    }
    terminate() {
      const record = records.get(this); record.dead = true;
      log('terminate', { key: record.key, discardedHeld: record.held.length }); record.held.length = 0;
      return super.terminate();
    }
  };
}
