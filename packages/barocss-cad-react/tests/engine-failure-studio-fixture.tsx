// D528 canonical existing ProfileApp + caller-owned EngineClient. This fixture supplies no renderer or status implementation.
import * as React from 'react';
import {createRoot} from 'react-dom/client';
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
Object.defineProperty(window, 'd528Profiles', {value: Object.freeze({read: () => structuredClone({host: observed?.read() ?? null, calls, failures, retries})})});
const root = createRoot(document.getElementById('root')!);
window.addEventListener('pagehide', () => { try { root.unmount(); } finally { client.dispose(); } }, {once: true});
root.render(<ProfileApp {...props}/>);
