// D425: display text only. No mesh/native geometry certification or outbound actions.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and original fixture folders required');
const input = resolve(process.argv[3]);
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
assert.deepEqual(manifest.cases.map(c => c.name), ['compound-far', 'compound-centered']);
const cases = await Promise.all(manifest.cases.map(async c => ({ ...c, step: await readFile(join(input, c.file), 'utf8') })));
for (const c of cases) assert.equal(sha256(c.step), c.sha256);
const output = resolve(process.argv[2]);
assert.ok(output.startsWith('/tmp/'), 'Generated evidence stays in temporary storage');
await mkdir(output, { recursive: true });
const centered = cases[1].step;
assert.equal(centered.split('SI_UNIT(.MILLI.,.METRE.)').length, 2, 'Exactly one source unit declaration');
const metreStep = centered.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT($,.METRE.)');
const metreFile = join(output, 'metre-centered-control.step');
await writeFile(metreFile, metreStep);
const metre = { name: 'metre-centered-control', step: metreStep, file: metreFile, sha256: sha256(metreStep), metre: true };
const f = await createFlow({
  name: 'tiny-quantity', envFrozen: 'TINY_QUANTITY_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D425_NONZERO_QUANTITY_DISPLAY',
  inspectorSource: "export { evaluatePart } from '@barocss/cad-model/engine/evaluate';",
  initialFiles: ['apps/cad-studio/test/tiny-quantity-browser.mjs', join(input, 'cases.json'), ...cases.map(c => join(input, c.file)), metreFile],
  requiredFrozen: ['apps/cad-studio/src/ui/quantityText.ts', 'apps/cad-studio/src/ui/SelectionInspector.tsx', 'apps/cad-studio/src/files/importedFile.ts'],
  snapshotExtra: () => ({ quantityTraffic: window.__quantityTraffic }),
  limits: ['Body/Part/STEP total text only; no general display-format migration.', 'Original display mesh bounds are preserved, including collapsed bounds. No tiny-shape rendering qualification.', 'The original two inputs retain their exact millimetre declarations. The additional centered control changes only the unit declaration to metres, giving radius1mm after existing product scaling.', 'No Save/export/download, dependency or model/schema change.'],
});
async function row(label) {
  return f.page.locator('aside[aria-label="Selection"] .kv').filter({ hasText: new RegExp(`^${label}`) }).first().locator('b').first().innerText();
}
async function inspect(label, tiny, metre = false) {
  const doc = await f.doc(), adopted = await f.bodies();
  const summary = { mass: await row('Mass'), bounds: await row('Bounds') };
  await f.page.locator('.ol-row:not(.stale) > button.ol').first().click();
  const text = { volume: await row('Volume'), mass: await row('Mass'), area: await row('Surface area'), bounds: await row('Bounds') };
  const traffic = await f.page.evaluate(() => window.__quantityTraffic);
  const result = traffic.findLast(e => e.ok && e.bodies?.length === 1 && e.bodies[0].volume === adopted.bodies[0].volume);
  assert.ok(result, 'Real worker fields match the adopted volume');
  const raw = result.bodies[0], bounds = raw.bounds;
  assert.ok(bounds?.min?.length === 3 && bounds.max?.length === 3, 'Real display mesh bounds captured');
  const extents = bounds.max.map((value, i) => value - bounds.min[i]);
  const shownBounds = text.bounds.split(' × ');
  for (const [i, value] of extents.entries()) {
    assert.equal(Number(shownBounds[i]) === 0, value === 0, 'Never manufacture nonzero mesh bounds');
  }
  if (tiny) {
    assert.equal(text.volume, '4.19e-9 mm³'); assert.equal(text.mass, '1.13e-11 g');
    assert.equal(text.area, '1.26e-5 mm²'); assert.equal(summary.mass, '1.13e-11 g');
    assert.ok(Math.abs(raw.volume / (4 * Math.PI * .001 ** 3 / 3) - 1) < 1e-6);
    assert.deepEqual(adopted.bodies[0].centroid, raw.centroid);
    if (label === 'compound-centered') assert.ok(extents.every(value => value > 0));
  } else if (metre) {
    assert.equal(text.volume, '4 mm³'); assert.equal(text.mass, '1.13e-2 g'); assert.equal(text.area, '13 mm²');
    assert.ok(Math.abs(raw.volume / (4 * Math.PI / 3) - 1) < 1e-6, 'Metre source scales to radius1mm once');
    assert.ok(extents.every(value => value > 1.9 && value < 2.01));
  } else {
    for (const value of [text.volume, text.mass, text.area]) assert.ok(!value.includes('e-') && Number.parseFloat(value) > 0, 'Ordinary Bracket retains ordinary nonzero text');
  }
  await f.same(doc);
  const observation = { label, tiny, text, summary, raw, adopted, extents, collapsedDisplayBounds: extents.some(value => value === 0), docUnchanged: true };
  f.report.observations.push(observation);
  await writeFile(join(f.output, `${label}-display.json`), JSON.stringify(observation, null, 2));
  await f.snapshot(label);
}
await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await context.route('https://fonts.gstatic.com/**', route => route.fulfill({ status: 204, body: '' }));
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__quantityTraffic = [];
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          const meshes = new Map();
          this.addEventListener('message', ({ data }) => {
            if (data?.result) window.__quantityTraffic.push({ id: data.id, ok: data.result.ok, error: structuredClone(data.result.error), bodies: data.result.bodies?.map(b => {
              if (b.mesh) meshes.set(b.meshToken, { bounds: structuredClone(b.mesh.bounds), positionsType: b.mesh.positions.constructor.name });
              return { key: b.key, volume: b.volume, mass: b.mass, area: b.area, centroid: structuredClone(b.centroid), massRef: b.massRef, ...structuredClone(meshes.get(b.meshToken ?? b.meshRef)) };
            }) });
            if (data?.masses) for (const patch of data.masses) for (const event of window.__quantityTraffic) for (const b of event.bodies ?? []) {
              if (b.massRef === patch.ref) Object.assign(b, structuredClone(patch.fields));
            }
          });
        }
      };
    });
    return context;
  };
  await f.newPage(); f.phase = 'ordinary Bracket display'; await inspect('ordinary-bracket', false);
  for (const c of [...cases, metre]) {
    await f.newPage(); f.phase = `Open ${c.name} display`;
    await f.page.setInputFiles('input[aria-label="Model file"]', resolve(input, c.file));
    await f.page.waitForFunction(step => window.__studioDoc?.nodes?.[0]?.step === step, c.step, { timeout: 60000 });
    await f.ready();
    assert.equal((await f.doc()).nodes[0].step, c.step);
    const notice = await f.waitToast(/STEP opened/);
    assert.match(notice, c.metre ? /scaled ×1000 to millimetres; 4 mm³ in all/ : /4.19e-9 mm³ in all/);
    f.report.reads.push({ label: c.name, inputSha256: c.sha256, notice });
    await inspect(c.name, !c.metre, !!c.metre);
  }
  assert.equal(f.report.downloads.length, 0);
});
