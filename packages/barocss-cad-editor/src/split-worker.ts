import { createSplitWorkerRuntime } from './split-worker-runtime.js';

// Dedicated module-worker endpoint. No native operation is imported by the main-thread client.
const endpoint = globalThis as unknown as {
  postMessage(value: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
};
const runtime = createSplitWorkerRuntime({ postMessage: value => endpoint.postMessage(value) });
endpoint.addEventListener('message', event => { void runtime.receive(event.data); });
