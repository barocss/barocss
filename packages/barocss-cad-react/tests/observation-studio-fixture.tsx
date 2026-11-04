// D529: existing EngineClient/Viewer/ProfileApp, plus deliberate consumer mutation of public read() results only.
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {ProfileApp} from '../examples/ProfileApp';
import type {EnginePort, ModelHost, MassPolicy} from '../src/engine';
import {EngineClient} from '../../../apps/cad-studio/src/engine/client';
import {withMasses} from '../../../apps/cad-studio/src/app/bodyResults';

const client = new EngineClient(), calls: {doc: unknown; revision: number; reply?: unknown}[] = [];
let observed: ModelHost | null = null;
const engine: EnginePort = {
  evaluate(doc, revision) {
    const entry = {doc: structuredClone(doc), revision} as typeof calls[number]; calls.push(entry);
    return client.evaluate(doc, revision).then(reply => { entry.reply = structuredClone(reply); return reply; });
  },
  restart: () => client.restart(), dispose: () => client.dispose(), onFailure: listener => client.onFailure(listener), onMasses: listener => client.onMasses(listener),
};
const massPolicy: MassPolicy = {merge: (bodies, patches) => withMasses(bodies, new Map(patches.map(patch => [patch.ref, patch.fields])))};
const onHost = (host: ModelHost | null) => { observed = host; };
type MutableConsumerView = {
  currentDocument: {nodes: Record<string, unknown>[]}; submitted: {fingerprint: string; revision: number}[];
  native: {centroid: number[]; bounds: {min: number[]; max: number[]}};
  adapter: {phase: string; freshNative: boolean}; viewer: {pixels: {sha256: string; bytes: number}};
};
const traces: unknown[] = [];
const fields = ['document', 'submitted-list', 'submitted-entry', 'native-centroid', 'native-bounds-min', 'native-bounds-max', 'adapter-phase', 'adapter-fresh', 'viewer-pixels'] as const;
type Field = typeof fields[number];
function ownerFacts() {
  const first = observed!.read(), second = observed!.read();
  return {nativeOwnerShared: first.nativeOwner === second.nativeOwner, nativeOwnerFrozen: Object.isFrozen(first.nativeOwner),
    renderedOwnerShared: first.renderedOwner === second.renderedOwner, renderedOwnerFrozen: Object.isFrozen(first.renderedOwner)};
}
function mutateRead(field: Field) {
  if (!observed || !fields.includes(field)) throw new Error('Current public ModelHost and known observation field required');
  const direct = observed.read(); // Crucial: mutate this original PUBLIC result, before any outer cloning can mask an alias.
  const before = structuredClone(direct), view = direct as unknown as MutableConsumerView;
  let mutationError: string | null = null;
  try {
    switch (field) {
      case 'document': view.currentDocument.nodes[1].height = 19; break;
      case 'submitted-list': view.submitted.push({fingerprint: 'D529_CONSUMER_LIST_ONLY', revision: -529}); break;
      case 'submitted-entry': view.submitted[0].fingerprint = 'D529_CONSUMER_ENTRY_ONLY'; break;
      case 'native-centroid': view.native.centroid[0] += 1000; break;
      case 'native-bounds-min': view.native.bounds.min[0] -= 1000; break;
      case 'native-bounds-max': view.native.bounds.max[0] += 1000; break;
      case 'adapter-phase': view.adapter.phase = 'D529_CONSUMER_PHASE_ONLY'; break;
      case 'adapter-fresh': view.adapter.freshNative = false; break;
      case 'viewer-pixels': view.viewer.pixels.sha256 = 'D529_CONSUMER_PIXEL_METADATA_ONLY'; break;
    }
  } catch (error) { mutationError = String(error); }
  const after = structuredClone(observed.read()); // A new public read, not a clone of the mutated result.
  const trace = {field, classification: 'DELIBERATE_CONSUMER_OBSERVATION_MUTATION', before, after, mutationError, ownerFacts: ownerFacts()};
  traces.push(trace); return trace;
}
Object.defineProperty(window, 'd529Profiles', {value: Object.freeze({
  read: () => { const direct = observed?.read() ?? null; return structuredClone({host: direct, calls, traces, ownerFacts: observed ? ownerFacts() : null}); },
  mutateRead,
})});
const root = createRoot(document.getElementById('root')!);
window.addEventListener('pagehide', () => { try { root.unmount(); } finally { client.dispose(); } }, {once: true});
root.render(<ProfileApp engine={engine} massPolicy={massPolicy} onHost={onHost}/>);
