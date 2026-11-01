// D423: actual eager STEP read and adopted Model mass fields; no outbound actions.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and frozen input folders are required');
const input = resolve(process.argv[3]);
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
assert.deepEqual(manifest.cases.map(c => c.name), ['compound-far', 'compound-centered']);
assert.equal(manifest.density, 2.7, 'Existing Model aluminium density');
assert.deepEqual(manifest.units, { length: 'mm', volume: 'mm^3', area: 'mm^2', mass: 'g', inertia: 'g*mm^2', density: 'g/cm^3' });
const cases = await Promise.all(manifest.cases.map(async c => ({ ...c, step: await readFile(join(input, c.file), 'utf8') })));
for (const c of cases) assert.equal(sha256(c.step), c.sha256);
for (const field of ['volumeRelative', 'areaRelative', 'centroidAbsolute', 'inertiaRelative', 'inertiaCrossAbsolute']) {
  assert.ok(Number.isFinite(manifest.acceptance[field]) && manifest.acceptance[field] > 0, `Approved ${field} required`);
}

// This import graph freezes the actual Model/Kernel dependencies; it is not an alternate mass observation.
const inspectorSource = `export { evaluatePart, massOfRef } from '@barocss/cad-model/engine/evaluate';`;
function closeRelative(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label} must be finite`);
  const relative = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(relative <= tolerance, `${label}: relative error ${relative} exceeds ${tolerance}`);
  return relative;
}
function checkFields(fields, c, label, complete) {
  const volume = 4 * Math.PI * c.radius ** 3 / 3;
  const mass = volume * manifest.density / 1000;
  const inertia = 2 * mass * c.radius ** 2 / 5;
  const errors = { volume: closeRelative(fields.volume, volume, manifest.acceptance.volumeRelative, `${label} volume`) };
  assert.equal(fields.centroid?.length, 3);
  errors.centroid = fields.centroid.map((value, i) => {
    const error = Math.abs(value - c.center[i]);
    assert.ok(Number.isFinite(value) && error <= manifest.acceptance.centroidAbsolute, `${label} centroid ${i}: ${error}`);
    return error;
  });
  if (complete) {
    errors.mass = closeRelative(fields.mass, mass, manifest.acceptance.volumeRelative, `${label} mass`);
    assert.equal(fields.inertia?.length, 3);
    for (const row of fields.inertia) assert.equal(row.length, 3, `${label} inertia row width`);
    errors.inertia = fields.inertia.map((row, i) => row.map((value, j) => {
      if (i === j) return closeRelative(value, inertia, manifest.acceptance.inertiaRelative, `${label} inertia ${i}`);
      const error = Math.abs(value);
      assert.ok(Number.isFinite(value) && error <= manifest.acceptance.inertiaCrossAbsolute, `${label} cross inertia ${i},${j}: ${error}`);
      return error;
    }));
    assert.equal(fields.volumeBasis ?? null, null, 'No display mesh mass fallback accepted');
  }
  return { literal: { volume, mass, inertia }, errors };
}

const f = await createFlow({
  name: 'step-mass-translation', envFrozen: 'STEP_MASS_TRANSLATION_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D423_COMPOUND_TRANSLATED_SPHERE_MODEL_MASS', inspectorSource,
  snapshotExtra: () => ({ massTraffic: window.__d423MassTraffic ?? [], workerUrls: window.__d423WorkerUrls ?? [] }),
  initialFiles: ['apps/cad-studio/test/step-mass-translation-browser.mjs', 'packages/barocss-cad/test/brep-mass-translation-fixtures.mjs', join(input, 'cases.json'), ...cases.map(c => join(input, c.file))],
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'apps/cad-studio/src/engine/engine.worker.ts', 'apps/cad-studio/src/engine/client.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad/src/brep/brep-mass-quadrature.ts', 'packages/barocss-cad/src/brep/solid-mass.ts'],
  limits: [
    'Two literal compound-rotated sphere inputs only; no general mass or surface certification.',
    'Real worker replies supply mass, area and inertia. Final adopted hooks expose only unrounded volume and centroid. A deferred-pending transition is not forced when caches already contain mass.',
    'The product areaBasis exact value labels native-source integration; it is not a mathematical exactness certificate.',
    'Public Model mass is MMGS. Private native SI provenance is not an independent integration oracle.',
    'Tiny Body panel values round to zero. Screenshots do not prove numeric precision or readable tiny-shape rendering.',
    'No Save, export, downloads, OCP, paid calls, new public API or dependency.',
  ],
});

await f.run(async () => {
  assert.ok(f.output.startsWith('/tmp/'), 'Runtime source bodies belong only in task temporary evidence');
  const moduleResponses = [], captures = [];
  const modules = [
    { name: 'model-evaluate', path: '/barocss-cad-model/src/engine/evaluate.ts', tokens: ['massOfRef', 'massOfBrep', 'bodyOf'] },
    { name: 'mass-quadrature', path: '/barocss-cad/src/brep/brep-mass-quadrature.ts', tokens: ['wholePatchTest', 'hi[0] - lo[0]'] },
    { name: 'solid-mass', path: '/barocss-cad/src/brep/solid-mass.ts', tokens: ['quadratureOrigin', 'centralMassProperties', 'transferNativeMassBasis'] },
    { name: 'tessellate', path: '/barocss-cad/src/brep/brep-tessellate.ts', tokens: ['localNormalSurface', 'normalAt'] },
  ];
  const captureResponse = response => {
    const url = response.url(), path = decodeURIComponent(new URL(url).pathname);
    const module = modules.find(entry => path.includes(entry.path));
    const optimized = /\/node_modules\/\.vite[^/]*\/deps\//.test(path) && /(?:barocss|chunk-).*\.js$/.test(path);
    if (!module && !optimized) return;
    const record = { url, status: response.status(), module: module?.name ?? null, optimizedCandidate: optimized };
    const index = moduleResponses.push(record);
    captures.push((async () => {
      try {
        const body = await response.body(), text = body.toString('utf8');
        record.hash = sha256(body);
        record.length = body.length;
        record.file = `runtime-module-${String(index).padStart(3, '0')}.js`;
        record.tokens = Object.fromEntries(modules.map(entry => [entry.name, Object.fromEntries(entry.tokens.map(token => [token, text.includes(token)]))]));
        await writeFile(join(f.output, record.file), body);
        record.body = 'AVAILABLE';
      } catch (error) {
        record.body = 'UNAVAILABLE';
        record.reason = String(error);
      }
    })());
  };
  const finishCaptures = async () => {
    let completed = 0;
    while (completed < captures.length) {
      const pending = captures.slice(completed);
      completed = captures.length;
      await Promise.allSettled(pending);
    }
    const provenance = {
      scope: 'Passive real response bodies; transformed-source hashes and token presence, not source equivalence proof',
      responses: moduleResponses,
      missingDirectModules: modules.filter(entry => !moduleResponses.some(response => response.module === entry.name)).map(entry => entry.name),
    };
    f.report.runtimeModules = provenance;
    await writeFile(join(f.output, 'runtime-module-provenance.json'), JSON.stringify(provenance, null, 2));
  };
  const fonts = { stylesheets: 0, assets: 0 };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    context.on('response', captureResponse);
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__d423MassTraffic = [];
      window.__d423WorkerUrls = [];
      const fields = b => ({ key: b.key, volume: b.volume, mass: b.mass, centroid: b.centroid, inertia: b.inertia, volumeBasis: b.volumeBasis, massRef: b.massRef, area: b.area, areaBasis: b.areaBasis });
      window.Worker = class extends RealWorker {
        constructor(...workerArgs) {
          super(...workerArgs);
          window.__d423WorkerUrls.push(String(workerArgs[0]));
          this.addEventListener('message', event => {
            const data = event.data;
            if (data?.result) window.__d423MassTraffic.push({ direction: 'reply', id: data.id, ok: data.result.ok, revision: data.result.revision, error: structuredClone(data.result.error), bodies: data.result.bodies ? structuredClone(data.result.bodies.map(fields)) : undefined, nativeMass: structuredClone(data.nativeMass) });
            if (data?.masses) window.__d423MassTraffic.push({ direction: 'patch', masses: structuredClone(data.masses) });
          });
        }
        postMessage(...messageArgs) {
          const data = messageArgs[0];
          if (data?.doc) window.__d423MassTraffic.push({ ...structuredClone(data), direction: 'request', blobTypes: (data.doc.blobs ?? []).map(([hash, array]) => ({ hash, type: array.constructor.name, length: array.length })) });
          return super.postMessage(...messageArgs);
        }
      };
    });
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try {
    for (const [index, c] of cases.entries()) {
      await f.newPage();
      const label = `${String(index + 1).padStart(2, '0')}-${c.name}`;
      f.phase = `Open ${c.name} and inspect real eager/adopted mass`;
      const before = await f.page.evaluate(() => window.__d423MassTraffic.length);
      await f.page.setInputFiles('input[aria-label="Model file"]', join(input, c.file));
      await f.page.waitForFunction(({ step, before }) => {
        const adopted = window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].step === step && window.__studioBodies?.()?.bodies.length === 1;
        const traffic = window.__d423MassTraffic.slice(before);
        const request = traffic.find(e => e.direction === 'request' && e.type === 'part' && e.slot === 'read' && e.doc?.added?.some(pair => pair[1]?.kind === 'import' && pair[1].step === step));
        const refused = request && traffic.some(e => e.direction === 'reply' && e.id === request.id && e.ok === false);
        return adopted || refused;
      }, { step: c.step, before }, { timeout: 60000 });
      const readTraffic = await f.page.evaluate(start => window.__d423MassTraffic.slice(start), before);
      const readRequest = readTraffic.find(e => e.direction === 'request' && e.type === 'part' && e.slot === 'read' && e.doc?.added?.some(pair => pair[1]?.kind === 'import' && pair[1].step === c.step));
      const readReply = readRequest && readTraffic.find(e => e.direction === 'reply' && e.id === readRequest.id);
      if (readReply?.ok === false) {
        const refusal = { label, inputSha256: c.sha256, readRequest, readReply, traffic: readTraffic };
        f.report.observations.push(refusal);
        await writeFile(join(f.output, `${label}-read-refusal.json`), JSON.stringify(refusal, null, 2));
        assert.fail(`Actual eager STEP read refused: ${JSON.stringify(readReply.error)}`);
      }
      await f.ready();
      const doc = await f.doc(), adopted = await f.bodies();
      assert.equal(doc.nodes[0].kind, 'import');
      assert.equal(doc.nodes[0].step, c.step);
      assert.equal(doc.units, 'mm');
      assert.equal(adopted.fresh, true);
      assert.equal(adopted.massReady, true);
      assert.equal(adopted.bodies[0].massRef, null);
      const traffic = await f.page.evaluate(start => window.__d423MassTraffic.slice(start), before);
      const request = readRequest;
      assert.ok(request, 'Genuine eager STEP read request');
      const eager = traffic.find(e => e.direction === 'reply' && e.id === request.id);
      assert.equal(eager?.ok, true);
      assert.equal(eager.bodies.length, 1);
      assert.equal(eager.revision, request.revision);
      assert.equal(request.nativeSource?.slot, 'part:read');
      const eagerChecks = checkFields(eager.bodies[0], c, 'eager', true);
      eagerChecks.observedDensity = eager.bodies[0].mass / eager.bodies[0].volume * 1000;
      closeRelative(eagerChecks.observedDensity, manifest.density, 1e-14, 'Actual Model density');
      assert.equal(eager.bodies[0].areaBasis, 'exact');
      eagerChecks.errors.area = closeRelative(eager.bodies[0].area, 4 * Math.PI * c.radius ** 2, manifest.acceptance.areaRelative, 'eager area');
      const adoptedChecks = checkFields(adopted.bodies[0], c, 'adopted', false);
      const adoptionDifference = { volume: closeRelative(adopted.bodies[0].volume, eager.bodies[0].volume, manifest.acceptance.volumeRelative, 'eager/adopted volume'), centroid: adopted.bodies[0].centroid.map((value, i) => Math.abs(value - eager.bodies[0].centroid[i])) };
      assert.ok(adoptionDifference.centroid.every(error => error <= manifest.acceptance.centroidAbsolute));
      const evaluation = traffic.findLast(e => e.direction === 'request' && e.type === 'evaluate');
      assert.ok(evaluation, 'Genuine accepted-document evaluation request');
      const evaluationReply = traffic.find(e => e.direction === 'reply' && e.id === evaluation.id);
      assert.equal(evaluationReply?.ok, true);
      assert.equal(evaluationReply.revision, evaluation.revision);
      assert.equal(evaluationReply.bodies.length, 1);
      const pending = evaluationReply.bodies[0].massRef;
      const patch = pending === undefined ? null : traffic.flatMap(e => e.masses ?? []).find(m => m.ref === pending && m.nativeMass?.requestId === evaluation.id && m.nativeMass?.revision === evaluation.revision);
      const acceptedFields = pending === undefined ? evaluationReply.bodies[0] : patch?.fields;
      assert.ok(acceptedFields, 'Actual mass fields in evaluate reply or matching deferred patch');
      const evaluateChecks = checkFields(acceptedFields, c, 'evaluate', true);
      if (patch) for (const key of ['epoch', 'requestId', 'revision', 'slot']) assert.equal(patch.nativeMass[key], evaluation.nativeSource[key]);
      closeRelative(adopted.bodies[0].volume, acceptedFields.volume, manifest.acceptance.volumeRelative, 'evaluate/adopted volume');
      await f.page.locator('.ol-row:not(.stale) > button.ol').first().click();
      const panel = f.page.locator('.kv').filter({ hasText: /^Volume/ }).first();
      await panel.waitFor({ state: 'visible' });
      const displayedMaterial = await f.page.getByLabel('Material', { exact: true }).inputValue();
      assert.equal(displayedMaterial, 'al6061', 'Fresh default material is Aluminium6061 (density2.7)');
      await f.same(doc);
      const observation = { label, inputSha256: c.sha256, exactStoredSource: true, units: manifest.units, density: manifest.density, acceptance: manifest.acceptance, eager: eager.bodies[0], adopted, eagerChecks, adoptedChecks, evaluateChecks, adoptionDifference, deferredPatchObserved: patch !== null, traffic, displayedMaterial, displayedVolume: await panel.innerText(), displayPrecisionAcceptance: 'NOT_CLAIMED' };
      f.report.observations.push(observation);
      await writeFile(join(f.output, `${label}-mass.json`), JSON.stringify(observation, null, 2));
      await f.snapshot(label);
      await finishCaptures();
      await f.context.close();
      f.report.cleanup.push('CONTEXT_CLOSED');
      f.context = null;
      f.page = null;
    }
  } finally {
    await finishCaptures();
    f.browser.newContext = newContext;
  }
  f.report.fontNetwork = fonts;
  assert.equal(fonts.assets, 0);
  assert.equal(f.report.downloads.length, 0);
});
