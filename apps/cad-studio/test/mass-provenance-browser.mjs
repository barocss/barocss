// D530/P0-R10: exact D526 catalog numeric consumer plus passive real Worker mass-method observation.
// D530_SOURCE_FROZEN=1 node test/mass-provenance-browser.mjs /ABS/NEW/OUTPUT
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { build } from 'esbuild';

const expectation = process.argv.find(arg => arg.startsWith('--expect='))?.split('=')[1] ?? 'fixed';
assert.ok(['repro', 'fixed'].includes(expectation));
const output = process.argv[2]; assert.ok(output && isAbsolute(output));
assert.ok(relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
await mkdir(output);
const repo = resolve(import.meta.dirname, '../../..'), producerSources = [];
for (const name of ['barocss-cad', 'barocss-cad-model']) {
  const directory = `packages/${name}/src`;
  for (const file of await readdir(join(repo, directory), { recursive: true })) if (/\.(ts|tsx|json)$/.test(file)) producerSources.push(`${directory}/${file}`);
}
const oracleSource = String.raw`import json, math, sys
d=json.load(sys.stdin); s=d['state']; rho=d['density']/1000
# Literal public Box dimensions, independent of product geometry/material helpers.
L,W,H=20,10,10; volume=L*W*H; mass=volume*rho
expectedI=[mass*(W*W+H*H)/12,mass*(L*L+H*H)/12,mass*(L*L+W*W)/12]
def nums(text):
 import re
 return [float(v.replace(',','')) for v in re.findall(r'[-+]?\d[\d,]*(?:\.\d+)?(?:[eE][-+]?\d+)?',text)]
assert s['material']['label']==d['label']
assert abs(nums(s['mass'])[0]-mass)<=0.05000001, (s['mass'],mass)
assert abs(nums(s['volume'])[0]-volume)<1e-8
centroid=nums(s['centroid'])
assert centroid==[10,5,5],centroid
got=nums(s['inertia'])
assert len(got)==3 and all(math.isfinite(v) for v in got)
assert all(abs(got[k]-expectedI[k])<=0.50000001 for k in range(3)),(got,expectedI)
if d.get('bom') is not None:
 totals=d['bom']['bomTotals']; quantities=nums(totals)
 assert quantities[0]==1 and abs(quantities[-1]-mass)<=0.05000001,totals
 assert len(d['bom']['bomRows'])==1
print(json.dumps({'status':'PASS','productImports':0,'literalDimensions':[L,W,H],'densityGPerCm3':d['density'],'densityGPerMm3':rho,
 'expectedMassG':mass,'expectedCentralInertiaGmm2':expectedI,'displayTolerance':{'massG':0.05,'inertiaGmm2':0.5},'bomChecked':d.get('bom') is not None}))
`;
// Same accepted StudioDoc, same Model/native producer path. This internal lookup returns ORIGINAL native MassProps,
// independently of the new public body.massMethod transport field. It is not a separate physical accuracy oracle.
const inspectorSource = `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateDoc, deferMasses, nativeMassPropertiesOfBody } from '@barocss/cad-model/engine/evaluate';
import { evaluatedPart } from '@barocss/cad-model/engine/wireDoc';
import { evaluationKey } from '@barocss/cad-model/engine/evalMemo';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
deferMasses(false);
const result = evaluateDoc(doc, 0); assert.ok(result.ok, JSON.stringify(result));
const bodies = result.bodies.map(body => {
  const native = nativeMassPropertiesOfBody(body); assert.ok(native, body.key);
  assert.equal(typeof native.method, 'string'); assert.ok(Number.isFinite(native.volume));
  return { key: body.key, method: native.method, volume: native.volume, volumeBound: native.volumeBound ?? null };
});
console.log(JSON.stringify({ source: 'ORIGINAL_NATIVE_MASS_PROPS_OF_SAME_ACCEPTED_DOC', inputDoc: evaluatedPart(doc), inputKey: evaluationKey(doc), bodies }));`;

// Passive observation: native Worker messages, handlers and results pass through unchanged.
function installD530MassObserver(WireReceiver, evaluationKey) {
  const NativeWorker = window.Worker, records = [], events = [], observerErrors = []; let next = 0;
  const fieldRead = (fields, context) => records.push({ sequence: records.length, ...context,
    volume: fields.volume ?? null, massRef: fields.massRef ?? null,
    massMethodPresent: Object.hasOwn(fields, 'massMethod'), massMethod: fields.massMethod ?? null,
    volumeBasisPresent: Object.hasOwn(fields, 'volumeBasis'), volumeBasis: fields.volumeBasis ? structuredClone(fields.volumeBasis) : null });
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      const key = ++next, relevant = String(url).includes('engine.worker'), requests = new Map(), receiver = new WireReceiver(), pendingBodies = new Map();
      events.push({ kind: 'construct', key, relevant, url: String(url) });
      this.addEventListener('message', event => {
        if (!relevant) return;
        const data = event.data, request = requests.get(data?.id);
        events.push({ kind: 'native-message', key, id: data?.id ?? null, resultOK: data?.result?.ok ?? null, massPatches: data?.masses?.length ?? 0 });
        if (data?.result?.ok) for (const [index, body] of (data.result.bodies ?? []).entries()) {
          const envelope = data.nativeMass?.[index];
          const context = { channel: 'native-result-body', key, requestId: data.id, requestType: request?.type ?? null,
            revision: data.result.revision, bodyKey: body.key, ref: body.massRef ?? null,
            inputDoc: request?.inputDoc ?? null, inputKey: request?.inputKey ?? null, requestSource: request?.source ?? null,
            nativeSource: envelope ? { epoch: envelope.epoch, requestId: envelope.requestId, revision: envelope.revision, slot: envelope.slot } : null };
          if (body.massRef !== undefined) pendingBodies.set(`${data.id}:${body.massRef}`, structuredClone(context));
          fieldRead(body, context);
        }
        for (const patch of data?.masses ?? []) {
          const envelope = patch.nativeMass, sourceRequest = requests.get(envelope?.requestId), pending = pendingBodies.get(`${envelope?.requestId}:${patch.ref}`);
          fieldRead(patch.fields, { channel: 'native-mass-patch', key, requestId: envelope?.requestId ?? null,
            requestType: sourceRequest?.type ?? null, revision: envelope?.revision ?? null,
            ref: patch.ref, bodyKey: pending?.bodyKey ?? null, pendingBody: pending ?? null,
            inputDoc: sourceRequest?.inputDoc ?? null, inputKey: sourceRequest?.inputKey ?? null, requestSource: sourceRequest?.source ?? null,
            nativeSource: envelope ? { epoch: envelope.epoch, requestId: envelope.requestId, revision: envelope.revision, slot: envelope.slot } : null,
            provenanceKind: envelope?.kind ?? null, provenanceSlot: envelope?.slot ?? null });
        }
      });
      const originalPost = this.postMessage;
      this.postMessage = function (message, ...rest) {
        if (relevant) {
          try {
            // The existing decoder runs on a clone in this observer's separately bundled module copy.
            // Follow the same doc/base/proposed order as the real Worker; never alter the posted payload.
            let inputDoc = null;
            if (message?.doc) inputDoc = receiver.unpack(structuredClone(message.doc));
            if (message?.type === 'placed') receiver.unpack(structuredClone(message.base));
            if (message?.type === 'proposalDiff') receiver.unpack(structuredClone(message.proposed));
            requests.set(message?.id, { type: message?.type, inputDoc: inputDoc ? structuredClone(inputDoc) : null,
              inputKey: inputDoc ? evaluationKey(inputDoc) : null, source: message?.nativeSource ? structuredClone(message.nativeSource) : null });
          } catch (error) { observerErrors.push(String(error)); }
          events.push({ kind: 'actual-submit', key, id: message?.id, type: message?.type, revision: message?.revision ?? null });
        }
        return originalPost.call(this, message, ...rest);
      };
    }
  };
  window.__d530Mass = { snapshot: () => ({ passive: true, records: records.slice(), events: events.slice(), observerErrors: observerErrors.slice() }) };
}

const observerSource = `import { WireReceiver } from '@barocss/cad-model/engine/wireDoc';
import { evaluationKey } from '@barocss/cad-model/engine/evalMemo';
(${installD530MassObserver.toString()})(WireReceiver, evaluationKey);`;
const observerBuild = await build({ stdin: { contents: observerSource, sourcefile: 'd530-observer.ts', resolveDir: resolve(import.meta.dirname, '..'), loader: 'ts' },
  bundle: true, platform: 'browser', format: 'iife', target: 'es2022', write: false, metafile: true });
const observerBundle = observerBuild.outputFiles[0].text;
await writeFile(join(output, 'observer-source.ts'), observerSource); await writeFile(join(output, 'observer-bundle.js'), observerBundle);
await writeFile(join(output, 'observer-metafile.json'), JSON.stringify(observerBuild.metafile, null, 2));

async function snapshotExtra() {
  const field = label => {
    const row = [...document.querySelectorAll('.kv')].find(row => row.firstChild?.textContent?.trim() === label);
    return row?.querySelector('b')?.textContent ?? null;
  };
  const material = document.querySelector('select[aria-label="Material"]');
  return { material: material ? { value: material.value, label: material.selectedOptions[0]?.textContent ?? null } : null,
    mass: field('Mass'), volume: field('Volume'), centroid: field('Centre of mass'),
    inertia: document.querySelector('[aria-label="Moments of inertia"] b')?.textContent ?? null,
    inertiaAbout: document.querySelector('select[aria-label="Inertia about"]')?.value ?? null,
    bomTotals: document.querySelector('[aria-label="BOM totals"]')?.textContent ?? null,
    bomRows: [...document.querySelectorAll('[aria-label="BOM lines"] [aria-label^="BOM line "]')].map(row => [...row.querySelectorAll('td')].map(td => td.textContent)),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'), nativeMassObservation: window.__d530Mass?.snapshot() ?? null };
}
const f = await createFlow({ name: 'mass-provenance', envFrozen: 'D530_SOURCE_FROZEN', output, oracleSource, inspectorSource, snapshotExtra,
  qualification: `D530/P0-R10 passive native massMethod transport vs same-Doc original native producer plus unchanged D526 catalog mass/inertia/BOM consumer; ${expectation}`,
  initialFiles: ['apps/cad-studio/test/mass-provenance-browser.mjs'],
  requiredFrozen: ['apps/cad-studio/src/ui/SelectionInspector.tsx', 'apps/cad-studio/src/ui/BomPanel.tsx'],
  extraFrozen: [...producerSources, ...Object.keys(observerBuild.metafile.inputs).filter(file => !file.includes('d530-observer.ts')).map(file => resolve(file)), 'packages/barocss-cad-model/src/library/builtin/materials.json', 'packages/barocss-cad-model/src/app/mass.ts', 'packages/barocss-cad-model/src/bom/bom.ts'],
  limits: ['Passive native Worker observation only: no substituted results, callbacks, handlers, geometry or UI status.', 'Native box method is read from original MassProps for the same accepted Doc, not inferred from its Box name. Imported and placed-method breadth require separate producer tests.', 'Worker volume matching uses absolute 1e-8 mm3 tolerance, consistent with the existing literal volume oracle; method equality is exact.', 'Desktop 1440x900 only; root must review screenshots.', 'Only existing valid Aluminium 6061 and Steel (mild) catalog inputs, 2.7 and 7.85 g/cm3.',
    'The catalog UI cannot enter arbitrary density. Invalid/nonfinite/overflow density public API behavior is NOT_TESTED by this GUI driver.',
    'Body mass/inertia UI and BOM consumer bypass the repaired public facade; this is a bounded regression smoke.',
    'BOM UI exposes root quantity and total mass, not a material column. Selected-body UI exposes material.',
    'Independent literal box and density arithmetic checks displayed quantities at declared display precision; no new general native mass/B-rep certificate.'],
});
f.report.expectation = expectation;
f.report.passiveObserverBundle = { sourceSha256: sha256(observerSource), bundleSha256: sha256(observerBundle),
  hashPurpose: 'Virtual source and artifact identity only', decoder: 'Existing WireReceiver in a separate bundled observer module copy' };
f.report.nativeMethodScope = 'Initial and fresh Open exact decoded native-input eligibility; material-only stages are numeric consumer regression only.';
const canonical = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const verifyNativeMethod = async (state, label) => {
  const producer = await f.inspect(`${label}-native-producer`, state.doc);
  assert.equal(producer.bodies.length, 1); const native = producer.bodies[0];
  assert.equal(native.key, 'b1'); assert.ok(Math.abs(native.volume - 2000) < 1e-8);
  assert.deepEqual(state.nativeMassObservation?.observerErrors, [], 'Passive wire decoder must succeed');
  const records = state.nativeMassObservation?.records.filter(record => ['evaluate', 'part'].includes(record.requestType)
    && record.bodyKey === native.key && record.inputKey === producer.inputKey
    && JSON.stringify(canonical(record.inputDoc)) === JSON.stringify(canonical(producer.inputDoc))
    && typeof record.volume === 'number' && Math.abs(record.volume - native.volume) < 1e-8) ?? [];
  assert.ok(records.length > 0, `${label}: actual committed/evaluated box settled native mass record required`);
  for (const record of records) {
    assert.deepEqual(record.nativeSource, record.requestSource, `${label}: actual request epoch/id/revision/slot must own the native mass envelope`);
    assert.equal(record.nativeSource.requestId, record.requestId); assert.equal(record.nativeSource.revision, record.revision);
    if (record.channel === 'native-mass-patch') {
      assert.ok(record.pendingBody); assert.equal(record.pendingBody.ref, record.ref); assert.equal(record.pendingBody.bodyKey, native.key);
      assert.deepEqual(record.pendingBody.nativeSource, record.nativeSource);
    }
    if (native.method !== 'tessellated') assert.equal(record.volumeBasisPresent, false, `${label}: integrated native mass has no display-mesh fallback basis`);
    else { assert.equal(record.volumeBasis?.method, 'tessellated'); assert.equal(record.volumeBasis?.bound, native.volumeBound); }
    if (expectation === 'repro') assert.equal(record.massMethodPresent, false, `${label}: baseline must actually omit producer massMethod`);
    else assert.equal(record.massMethod, native.method, `${label}: actual received settled native fields preserve the SAME accepted Doc's original native method`);
  }
  f.report.observations.push({ label, meaning: expectation === 'repro' ? 'BASELINE_MASS_METHOD_OMITTED_PRODUCT_FAIL' : 'ACTUAL_NATIVE_METHOD_MATCHES_SAME_DOC_PRODUCER', producer, volumeMatchAbs: 1e-8, records });
};
const observedPage = async () => {
  await f.newPage(); await f.page.setViewportSize({ width: 1440, height: 900 });
  await f.context.addInitScript({ content: observerBundle }); await f.page.reload(); await f.ready();
};
const labels = new Set();
const capture = async label => { assert.ok(!labels.has(label)); labels.add(label); return f.snapshot(label); };
const selectBody = async () => {
  await f.page.locator('.outliner .ol', { hasText: 'Box' }).first().click();
  await f.page.getByLabel('Moments of inertia', { exact: true }).waitFor();
  await f.page.getByLabel('Inertia about', { exact: true }).selectOption('centre');
};
const withBom = async label => {
  await f.page.locator('nav.toolbar button[aria-label="BOM"]').click();
  await f.page.getByRole('complementary', { name: 'BOM panel', exact: true }).waitFor();
  await f.page.getByLabel('BOM totals', { exact: true }).waitFor({ timeout: 30000 });
  const state = await capture(label);
  await f.page.getByRole('button', { name: 'Close BOM', exact: true }).click(); return state;
};
await f.run(async () => {
  await observedPage();
  f.phase = 'public native box with literal dimensions 20x10x10';
  await f.page.getByRole('button', { name: 'New part', exact: true }).click(); await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.page.keyboard.press('b'); const hud = f.page.getByRole('dialog', { name: 'Box', exact: true }); await hud.waitFor();
  for (const [label, value] of [['Width X', '20'], ['Depth Y', '10'], ['Height Z', '10']]) await hud.getByLabel(label, { exact: true }).fill(value);
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  await hud.getByRole('button', { name: 'Apply', exact: true }).click(); await f.ready(); await selectBody();
  await capture('00-native-box-material-controls');
  f.phase = 'public Aluminium 6061 material and independent body/BOM arithmetic';
  await f.page.getByLabel('Material', { exact: true }).selectOption({ label: 'Aluminium 6061' }); await f.ready();
  const aluminium = await capture('01-aluminium-body'); await verifyNativeMethod(aluminium, '01-native-box-method'); assert.equal(aluminium.inertiaAbout, 'centre');
  const aluminiumBom = await withBom('02-aluminium-bom');
  await f.runOracle({ state: aluminium, bom: aluminiumBom, density: 2.7, label: 'Aluminium 6061' }, '02-aluminium-consumer');

  f.phase = 'public Steel material and independent body/BOM arithmetic';
  await selectBody(); await f.page.getByLabel('Material', { exact: true }).selectOption({ label: 'Steel (mild)' }); await f.ready();
  const steel = await capture('03-steel-body'); const steelBom = await withBom('04-steel-bom');
  await f.runOracle({ state: steel, bom: steelBom, density: 7.85, label: 'Steel (mild)' }, '04-steel-consumer');
  assert.notDeepEqual(steel.doc, aluminium.doc, 'Body material is stored in the accepted document');

  f.phase = 'public material Undo/Redo';
  await f.undo(); await f.same(aluminium.doc); await selectBody();
  const undone = await capture('05-undo-aluminium'); await f.runOracle({ state: undone, density: 2.7, label: 'Aluminium 6061' }, '05-undo-aluminium');
  await f.redo(); await f.same(steel.doc); await selectBody();
  const redone = await capture('06-redo-steel'); await f.runOracle({ state: redone, density: 7.85, label: 'Steel (mild)' }, '06-redo-steel');

  f.phase = 'public Save and fresh own-file Open keep finite Steel material';
  const saved = await f.save('07-steel-native-box'); assert.deepEqual(saved.doc, steel.doc);
  await observedPage();
  await f.openFile(saved.file, saved.doc.nodes.length); await f.same(saved.doc); await selectBody();
  const reopened = await capture('08-fresh-own-open-steel-body'); await verifyNativeMethod(reopened, '08-fresh-open-native-method'); const reopenedBom = await withBom('09-fresh-own-open-steel-bom');
  await f.runOracle({ state: reopened, bom: reopenedBom, density: 7.85, label: 'Steel (mild)' }, '09-fresh-own-open-consumer');
});
