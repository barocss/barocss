// G22 source-only acceptance extension. Called only after the existing App runner's lease/SHA/load gates.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

export async function runClearanceAppFlow({ page, backend, result, out, root, app, doc, choose }) {
  const outside = relative(root, out);
  assert.ok(outside === '..' || outside.startsWith('..' + sep) || isAbsolute(outside), 'Clearance data artifacts must be outside the served checkout.');
  const open = async file => {
    await page.evaluate(() => { window.__g22BeforeOpen = window.__studioDoc; });
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(() => window.__studioDoc !== window.__g22BeforeOpen && window.__studioFresh === true);
  };
  await open(join(app, 'test/fixtures/bracket.bcad'));
  const part = JSON.parse(await doc());
  await page.getByLabel('New part', { exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc?.nodes.length === 0 && window.__studioFresh === true);
  const assembly = { ...JSON.parse(await doc()), instances: [
    { id: 'g22-a', name: 'G22 A', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'g22-b', name: 'G22 B', doc: part, position: [30.5, 0, 0], rotation: [0, 0, 0] },
  ] };
  const fixture = join(out, backend + '-clearance-input.bcad');
  await writeFile(fixture, JSON.stringify(assembly, null, 2) + '\n'); await open(fixture);
  await choose('shaded-with-edges');
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Iso', exact: true }).click();
  await page.getByTitle('Frame all (F)', { exact: true }).click();
  await page.waitForFunction(() => window.__studioInstanceAt?.([15, 6, 6])?.id === 'g22-a' && window.__studioInstanceAt?.([45.5, 6, 6])?.id === 'g22-b');
  const toggle = page.getByRole('checkbox', { name: 'Assembly clearance', exact: true });
  if (await toggle.isChecked()) await toggle.uncheck();
  const settle = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await settle();
  const before = await doc(), dirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
  const points = [[29.9, 6, 6], [30.6, 6, 6]], offPixels = await page.evaluate(points => window.__studioPixels(points), points);
  const native = await page.evaluate(() => window.__studioInstanceAt([15, 6, 6]));
  await toggle.check();
  const ready = async (state, gap, count = 1) => {
    await page.waitForFunction(({ state, gap, count }) => {
      const d = window.__studioClearance?.();
      return d?.stage === 'ready' && d.pairs.length === count && (!count || d.pairs.every(p => p.state === state && Math.abs(p.minGapMM - gap) < 1e-5 && !(p.overlap && ('pending' in p.overlap || 'refused' in p.overlap))));
    }, { state, gap, count });
    await settle();
  };
  const capture = async name => {
    const file = join(out, backend + '-clearance-' + name + '.png'); await page.screenshot({ path: file });
    const data = await page.evaluate(() => {
      const d = window.__studioClearance();
      return { request: d.request, revision: d.revision, stage: d.stage, pairs: d.pairs.map(p => ({ a: p.a, b: p.b, pose: p.pose, state: p.state, minGapMM: p.minGapMM, volumeMM3: p.overlap?.volumeMM3 })), overlays: d.overlays.map(o => ({ id: o.id, bodyKey: o.bodyKey, state: o.state, model: Array.from(o.model), fieldCount: o.field?.length, vertexCount: o.positions.length / 3 })), clip: d.clip };
    });
    return { file, ...data };
  };
  await ready('near', 0.5);
  const near = await capture('near'), onPixels = await page.evaluate(points => window.__studioPixels(points), points);
  assert.ok(onPixels.some((pixel, i) => pixel.slice(0, 3).reduce((sum, value, k) => sum + Math.abs(value - offPixels[i][k]), 0) > 3), 'Actual top-surface band pixels must change when clearance is enabled.');
  assert.ok(near.overlays.length === 2 && near.overlays.every(o => o.fieldCount === o.vertexCount));
  assert.equal(await doc(), before); assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), dirty);
  assert.deepEqual(await page.evaluate(() => window.__studioInstanceAt([15, 6, 6])), native);
  const rows = [near];
  for (const mode of ['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray', 'shaded-with-edges']) {
    await choose(mode); await ready('near', 0.5); rows.push(await capture('near-' + mode));
    assert.deepEqual(await page.evaluate(() => window.__studioInstanceAt([15, 6, 6])), native, 'analysis does not change native face identity in any base mode');
  }
  await toggle.uncheck(); await page.waitForFunction(() => window.__studioClearance?.() === null); await settle();
  assert.deepEqual(await page.evaluate(points => window.__studioPixels(points), points), offPixels, 'disabling analysis restores the original surface pixels');
  await toggle.check(); await ready('near', 0.5);
  await page.locator('.ol.instance').filter({ hasText: 'G22 B' }).click();
  const change = async (axis, occurrence, value, field, index) => {
    const input = page.locator('[aria-label="Instance"] [aria-label="Instance ' + axis + '"]').nth(occurrence);
    await input.fill(String(value)); await input.press('Enter');
    await page.waitForFunction(({ value, field, index }) => window.__studioDoc.instances.find(i => i.id === 'g22-b')[field][index] === value, { value, field, index });
  };
  await change('X', 0, 31.5, 'position', 0); await ready(null, null, 0);
  const far = await capture('far'); assert.equal(far.overlays.length, 0);
  assert.match(await page.getByRole('status').filter({ hasText: 'No candidate pairs' }).innerText(), /within the 1 mm band/);
  await change('X', 0, 30, 'position', 0); await ready('touching', 0); rows.push(await capture('touching'));
  await change('X', 0, 29.5, 'position', 0); await ready('overlap', 0);
  const overlap = await capture('overlap'); assert.ok(Math.abs(overlap.pairs[0].volumeMM3 - 36) < 1e-5); rows.push(overlap);
  await change('Z', 1, 90, 'rotation', 2); await change('X', 0, 42.5, 'position', 0); await ready('near', 0.5);
  const rotated = await capture('rotated-near'); assert.notEqual(rotated.pairs[0].pose, near.pairs[0].pose); rows.push(rotated);
  await page.locator('[aria-label="Instance"]').getByRole('button', { name: 'Hide', exact: true }).click();
  await ready(null, null, 0); assert.equal((await capture('hidden')).overlays.length, 0);
  await page.locator('.ol.instance').filter({ hasText: 'G22 B' }).click();
  await page.locator('[aria-label="Instance"]').getByRole('button', { name: 'Show', exact: true }).click(); await ready('near', 0.5);
  await page.getByLabel('Section view', { exact: true }).click();
  await page.waitForFunction(() => window.__studioClearance?.()?.clip?.planes.length === 1); await settle(); rows.push(await capture('section'));
  await page.getByLabel('Section view', { exact: true }).click();
  await page.waitForFunction(() => !window.__studioClearance?.()?.clip);
  const savedDoc = JSON.parse(await doc()), [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Save', { exact: true }).click()]);
  const saved = join(out, backend + '-clearance-saved.bcad'); await download.saveAs(saved);
  assert.deepEqual(JSON.parse(await readFile(saved, 'utf8')), savedDoc);
  for (const key of ['clearance', 'clearanceEnabled', 'clearanceNearMM']) assert.equal(Object.hasOwn(savedDoc, key), false);
  await page.getByLabel('New part', { exact: true }).click(); await ready(null, null, 0);
  await open(saved); await ready('near', 0.5); assert.deepEqual(JSON.parse(await doc()), savedDoc, 'Open retains the complete saved document, placements and references'); rows.push(await capture('reopened'));
  await toggle.uncheck(); await page.waitForFunction(() => window.__studioClearance?.() === null);
  result.clearance = { fixture, saved, offPixels, onPixels, native, far, rows };
  result.steps.push('G22 actual App: near/touching/36mm3 overlap/far, current pose rotation, Hide/Show, section, five modes, native pick, unchanged toggle document and Save/New/Open');
}
