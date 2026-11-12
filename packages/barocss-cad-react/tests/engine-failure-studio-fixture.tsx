// D528 canonical existing ProfileApp + caller-owned EngineClient. This fixture supplies no renderer or status implementation.
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {Viewer} from '@barocss/viewer';
import {ProfileApp} from '../examples/ProfileApp';
import type {EnginePort, ModelHost, MassPolicy} from '../src/engine';
import {EngineClient} from '../../../apps/cad-studio/src/engine/client';
import {withMasses} from '../../../apps/cad-studio/src/app/bodyResults';

const client = new EngineClient();
const calls: {doc: unknown; revision: number; reply?: unknown}[] = [], failures: unknown[] = [], retries: unknown[] = [];
let observed: ModelHost | null = null;
const engine: EnginePort = {
  evaluate(doc, revision) {
    const entry = {doc: structuredClone(doc), revision} as typeof calls[number]; calls.push(entry);
    return client.evaluate(doc, revision).then(reply => { entry.reply = structuredClone(reply); return reply; });
  },
  restart: () => client.restart(), dispose: () => client.dispose(),
  onFailure: listener => client.onFailure(error => { failures.push(structuredClone(error)); listener(error); }),
  onMasses: listener => client.onMasses(listener),
};
const massPolicy: MassPolicy = {merge: (bodies, patches) => withMasses(bodies, new Map(patches.map(patch => [patch.ref, patch.fields])))};
const onHost = (host: ModelHost | null) => { observed = host; };
// The example owns its Retry button/rerender. The application alone owns this explicit restart callback.
const onRestart = () => { const result = client.restart(); retries.push({result}); return result; };
const props = {engine, massPolicy, onHost, onRestart};
const root = createRoot(document.getElementById('root')!);
const close = document.getElementById('unmount-profile');
const readPixels = Viewer.prototype.readPixels;
const readbacks: {bytes: number; released: boolean}[] = [];
let pendingRead: Promise<void> | null = null;
let disposedHost: ModelHost | null = null, closed = false;
if (close) {
  Viewer.prototype.readPixels = async function () {
    const hold = pendingRead;
    pendingRead = null;
    const pixels = await readPixels.call(this);
    if (hold) {
      const receipt = {bytes: pixels.length, released: false};
      readbacks.push(receipt);
      await hold;
      receipt.released = true;
    }
    return pixels;
  };
}
let release = () => {};
const armReadback = () => {
  if (!close || closed || pendingRead || readbacks.some(receipt => !receipt.released)) throw new Error('A live idle frame gate is required');
  const wait = new Promise<void>(done => { release = done; });
  pendingRead = wait;
};
const cleanup = () => {
  if (closed) return;
  closed = true;
  disposedHost = observed;
  if (close) Viewer.prototype.readPixels = readPixels;
  try { root.unmount(); } finally { client.dispose(); }
};
close?.addEventListener('click', cleanup, {once: true});
window.addEventListener('pagehide', cleanup, {once: true});
Object.defineProperty(window, 'd528Profiles', {value: Object.freeze({
  read: () => structuredClone({host: (observed ?? disposedHost)?.read() ?? null, calls, failures, retries, readbacks, closed}),
  armReadback, releaseReadback: () => release(),
})});
root.render(<ProfileApp {...props}/>);
