import { createUiRuntime } from '/runtime.js';

const container = document.getElementById('frames');
const saves = [];
const errors = [];
let gate = null;
let revision = 0;
let last = null;
const runtime = createUiRuntime({
  container,
  async resolveResource(record, { instanceId, hostOrigin, signal }) {
    const response = await fetch(`/artifact/${record.bundleDigest}.json`, { signal });
    if (!response.ok) throw new Error('Fixture artifact missing');
    const value = await response.json();
    return { artifact: { ...value, bundle: Uint8Array.from(atob(value.bundle), (char) => char.charCodeAt(0)) },
      frameUrl: `/frame/${record.bundleDigest}.html?instanceId=${instanceId}&hostOrigin=${encodeURIComponent(hostOrigin)}` };
  },
  async onSave(request) { saves.push({ ...request, signal: undefined }); },
  onError(error) { errors.push(error.message); },
});
const manifest = async (variant) => (await (await fetch(`/manifest/${variant}.json`)).json());
const start = async (variant = 'base') => {
  const item = await manifest(variant);
  const identity = { streamId: `fixture_${++revision}`, revision };
  const record = { version: 1, seq: 1, type: 'module', phase: 'preview', ...identity,
    moduleId: item.moduleId, sourceDigest: item.sourceDigest, bundleDigest: item.bundleDigest,
    initialState: { name: 'Mina', count: 2 } };
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  gate = release;
  last = record;
  return runtime.start((async function* () {
    yield record;
    await waiting;
    if (variant === 'error') throw new Error('Authored source failure');
    yield { version: 1, seq: 2, type: 'commit', ...identity, bundleDigest: record.bundleDigest };
  })());
};
window.fixture = {
  start,
  finish() { gate?.(); gate = null; },
  cancel() { runtime.cancel(); gate?.(); gate = null; },
  hint: (state) => runtime.hint(state),
  inspect: () => runtime.inspect(),
  dispose: () => runtime.dispose(),
  get saves() { return saves; },
  get errors() { return errors; },
  get last() { return last; },
};
