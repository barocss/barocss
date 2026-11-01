import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { createStepPreparation, type StepOwner, type StepPreview } from '../src/files/stepExportPreparation';
const text = "FILE_SCHEMA(('AUTOMOTIVE_DESIGN')); geometry";
function setup() {
  const doc = emptyDoc(); let owner: StepOwner = { doc, shown: doc, evaluated: doc, name: 'part', fresh: true, hasBody: true, hasMeshes: true };
  let preview: StepPreview | null = null;
  const jobs: { doc: typeof doc; meshes: string; resolve(value: { text: string; omitted?: string[] } | { error: string }): void; reject(error: Error): void }[] = [];
  const downloads: { bytes: Uint8Array; name: string; doc: unknown }[] = [], notices: string[] = [];
  const control = createStepPreparation({ current: () => owner, changed: value => { preview = value; }, notice: value => notices.push(value), step: (doc, _name, meshes) => new Promise((resolve, reject) => jobs.push({ doc, meshes, resolve, reject })), download: (bytes, name, doc) => downloads.push({ bytes, name, doc }) });
  return { control, jobs, downloads, notices, get preview() { return preview; }, get owner() { return owner; }, set owner(value) { owner = value; } };
}
test('prepare reports actual losses and requires an explicit current download without mutating the document', async () => {
  const s = setup(), before = JSON.stringify(s.owner.doc), work = s.control.prepare();
  assert.equal(s.preview?.stage, 'preparing'); assert.equal(s.downloads.length, 0);
  s.jobs[0].resolve({ text, omitted: ['actual loss'] }); await work;
  assert.equal(s.preview?.stage, 'ready'); assert.deepEqual(s.preview?.losses, ['actual loss']); assert.match(s.preview!.profile, /AP214/);
  s.control.download(); assert.equal(s.preview, null); assert.equal(s.downloads.length, 1);
  assert.equal(new TextDecoder().decode(s.downloads[0].bytes), text); assert.equal(s.downloads[0].name, 'part.step'); assert.equal(s.downloads[0].doc, s.owner.doc);
  assert.equal(JSON.stringify(s.owner.doc), before); s.control.download(); assert.equal(s.downloads.length, 1);
});
for (const action of ['cancel', 'dispose'] as const) test(`${action} drops late success and error`, async () => {
  for (const reject of [false, true]) { const s = setup(), work = s.control.prepare(); s.control[action](); if (reject) s.jobs[0].reject(new Error('late')); else s.jobs[0].resolve({ text }); await work; s.control.download(); assert.equal(s.downloads.length, 0); assert.notEqual(s.preview?.stage, 'ready'); assert.equal(s.notices.length, 0); }
});
for (const key of ['doc', 'shown', 'evaluated', 'name', 'fresh', 'hasBody'] as const) test(`synchronous ${key} change rejects late results and final download before reconcile`, async () => {
  for (const afterReady of [false, true]) { const s = setup(), work = s.control.prepare(); if (afterReady) { s.jobs[0].resolve({ text }); await work; }
    s.owner = { ...s.owner, [key]: key === 'name' ? 'opened' : key === 'fresh' || key === 'hasBody' ? false : emptyDoc() };
    if (!afterReady) { s.jobs[0].resolve({ text }); await work; }
    s.control.download(); assert.equal(s.downloads.length, 0); assert.equal(s.preview, null);
  }
});
test('reconcile invalidates pending preparation and stale errors', async () => {
  const s = setup(), work = s.control.prepare(); s.owner = { ...s.owner, doc: emptyDoc() }; s.control.reconcile(); s.jobs[0].reject(new Error('old worker')); await work; assert.equal(s.preview, null); assert.deepEqual(s.notices, []);
});
test('mesh changes supersede bytes and late errors; selected representation reaches worker', async () => {
  const s = setup(), first = s.control.prepare('planar'), second = s.control.prepare('tessellated');
  assert.deepEqual(s.jobs.map(j => j.meshes), ['planar', 'tessellated']); s.jobs[1].resolve({ text: "FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF')); new" }); await second;
  s.jobs[0].reject(new Error('old planar failure')); await first; assert.equal(s.preview?.meshes, 'tessellated'); assert.match(s.preview!.profile, /AP242/); s.control.download(); assert.match(new TextDecoder().decode(s.downloads[0].bytes), /new$/);
});
test('not fresh and no exportable body refuse before worker; active worker refusal stays local', async () => {
  for (const key of ['fresh', 'hasBody'] as const) { const s = setup(); s.owner = { ...s.owner, [key]: false }; await s.control.prepare(); assert.equal(s.jobs.length, 0); assert.equal(s.preview, null); assert.equal(s.notices.length, 1); }
  const s = setup(), work = s.control.prepare(); s.jobs[0].resolve({ error: 'unsupported mesh' }); await work; assert.equal(s.preview?.stage, 'error'); assert.equal(s.preview?.error, 'unsupported mesh'); s.control.download(); assert.equal(s.downloads.length, 0);
});

test('shown variant placements and current decoration own the payload while evaluated prefix geometry remains exact', async () => {
  const s = setup(), old = s.owner.evaluated;
  const shown = { ...old, bodies: { b1: { name: 'New red name', color: '#f00' } }, instances: [{ id: 'variant', name: 'Variant', doc: emptyDoc(), position: [20, 0, 0] as [number, number, number], rotation: [0, 0, 90] as [number, number, number] }] };
  s.owner = { ...s.owner, shown }; const work = s.control.prepare();
  assert.equal(s.jobs[0].doc.instances, shown.instances); assert.equal(s.jobs[0].doc.bodies, shown.bodies); assert.equal(s.jobs[0].doc.nodes, old.nodes); assert.equal(s.jobs[0].doc.outputs, old.outputs);
  s.jobs[0].resolve({ text, omitted: ['Current decoration loss'] }); await work; assert.deepEqual(s.preview?.losses, ['Current decoration loss']);
});
