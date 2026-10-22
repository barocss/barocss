// Narrow actual-App flow. No browser starts without the new coordinator lease and exact clean SHA.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadavg } from 'node:os';
import { parseArgs, assertRunAuthority } from './cad-display-browser.mjs';

// The instance branch creates data files outside the served checkout, then opens them through
// the actual Model file input. The probes below only read the real renderer/document.
async function runInstanceAppFlow({ page, backend, result, out, root, app, doc, choose }) {
  const outside = relative(root, out);
  assert.ok(outside === '..' || outside.startsWith('..' + sep) || isAbsolute(outside), 'Assembly data artifacts must be outside the served checkout.');
  const raw = async name => {
    const file = join(out, backend + '-instances-' + name + '.json');
    await writeFile(file, JSON.stringify(JSON.parse(await doc()), null, 2) + '\n');
    (result.rawDocuments ??= []).push(file);
  };
  const newEmpty = async () => {
    await page.evaluate(() => { window.__g21BeforeNew = window.__studioDoc; });
    await page.getByLabel('New part', { exact: true }).click();
    await page.waitForFunction(() => window.__studioDoc !== window.__g21BeforeNew && window.__studioDoc?.nodes.length === 0 && window.__studioFresh === true);
  };
  const open = async (file, instances) => {
    await page.evaluate(() => { window.__g21BeforeOpen = window.__studioDoc; });
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await page.waitForFunction(instances => window.__studioDoc !== window.__g21BeforeOpen && window.__studioFresh === true && (instances === null || window.__studioDoc.instances?.length === instances), instances);
  };
  await open(join(app, 'test/fixtures/bracket.bcad'), null);
  const part = JSON.parse(await doc()); assert.equal(part.nodes.find(n => n.kind === 'extrude').height, 6);
  await raw('migrated-bracket');
  await open(join(app, 'test/fixtures/bracket-rev-b.bcad'), null);
  const different = JSON.parse(await doc()); assert.equal(different.nodes.find(n => n.kind === 'extrude').height, 12);
  await raw('migrated-different');
  await newEmpty(); const empty = JSON.parse(await doc());
  const assembly = { ...empty, instances: [
    { id: 'g21-a', name: 'G21 A', doc: part, part: { id: 'g21-shared', rev: 'A', source: 'bracket.bcad' }, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'g21-b', name: 'G21 B', doc: part, part: { id: 'g21-shared', rev: 'A', source: 'bracket.bcad' }, position: [70, 0, 0], rotation: [0, 0, 90] },
    { id: 'g21-c', name: 'G21 different', doc: different, part: { id: 'g21-different', rev: 'B', source: 'bracket-rev-b.bcad' }, position: [140, 0, 0], rotation: [0, 0, 0] },
    { id: 'g21-hidden', name: 'G21 hidden', doc: part, part: { id: 'g21-shared', rev: 'A', source: 'bracket.bcad' }, position: [210, 0, 0], rotation: [0, 0, 0], hidden: true },
  ] };
  const fixture = join(out, backend + '-instances-input.bcad'); await writeFile(fixture, JSON.stringify(assembly, null, 2) + '\n');
  await choose('wireframe'); await open(fixture, 4);
  await page.waitForFunction(() => {
    const d = document.querySelector('.viewport')?.dataset;
    return d?.displayModeRequested === 'wireframe' && d.displayModeEffective === 'wireframe' && d.displayModeSupported === 'true';
  });
  assert.equal(await page.getByLabel('CAD display mode', { exact: true }).isDisabled(), false);
  await choose('shaded-with-edges');
  const bounds = async (id, min, max, absent = false) => {
    await page.waitForFunction(({ id, min, max, absent }) => {
      const list = window.__studioInstanceBounds?.(); if (!list) return false;
      const b = list.find(x => x.id === id);
      return absent ? !b : !!b?.min && min.every((n, k) => Math.abs(b.min[k] - n) < 1e-5 && Math.abs(b.max[k] - max[k]) < 1e-5);
    }, { id, min, max, absent });
  };
  await bounds('g21-a', [0, 0, 0], [30, 12, 6]);
  await bounds('g21-b', [58, 0, 0], [70, 30, 6]);
  await bounds('g21-c', [140, 0, 0], [170, 12, 12]);
  await bounds('g21-hidden', null, null, true);
  await page.getByTitle('Frame all (F)', { exact: true }).click();
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const actualPick = point => page.evaluate(point => window.__studioInstanceAt(point), point);
  for (const [id, point] of [['g21-a', [15, 6, 6]], ['g21-c', [155, 6, 12]]]) {
    const hit = await actualPick(point); assert.equal(hit?.id, id); assert.equal(hit.body, 0); assert.ok(hit.face >= 0);
  }
  const modeDocument = await doc(), modeFrames = {}, modeDirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
  result.instanceModes = [];
  for (const mode of modes) {
    await choose(mode);
    await page.waitForFunction(mode => {
      const d = document.querySelector('.viewport')?.dataset;
      return d?.displayModeRequested === mode && d.displayModeEffective === mode && d.displayModeSupported === 'true';
    }, mode);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    const picks = [];
    for (const point of [[15, 6, 6], [64, 15, 6], [155, 6, 12]]) picks.push(await actualPick(point));
    assert.deepEqual(picks.map(p => p?.id), ['g21-a', 'g21-b', 'g21-c']);
    assert.ok(picks.every(p => p.body === 0 && p.face >= 0));
    assert.equal(await doc(), modeDocument, 'Changing instance appearance must not edit the document.');
    assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), modeDirty);
    modeFrames[mode] = await page.evaluate(() => window.__studioFrame(48));
    await page.screenshot({ path: join(out, backend + '-instances-mode-' + mode + '.png') });
    result.instanceModes.push({ mode, picks, supported: true });
  }
  assert.notDeepEqual(modeFrames.wireframe, modeFrames['shaded-with-edges']);
  assert.notDeepEqual(modeFrames['x-ray'], modeFrames['shaded-with-edges']);
  await page.getByRole('button', { name: 'Render', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.displayModeEffective === 'shaded-with-edges');
  assert.equal(await page.getByLabel('CAD display mode', { exact: true }).isDisabled(), true);
  assert.match(await page.locator('#cad-display-mode-status').innerText(), /Model view.*Shaded with edges is active/);
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.displayModeEffective === 'x-ray');
  assert.equal(await doc(), modeDocument);
  result.steps.push('assembly five modes keep document/dirty state; Render guard and Model x-ray restore');
  await choose('shaded-with-edges');
  // Root geometry is empty. At the default world-Y midpoint A/C are removed and B is cut.
  // A generated cap is still an instance selection target, never a native mate-face target.
  await page.getByLabel('Section view', { exact: true }).click();
  await page.waitForFunction(() => window.__studioSection?.()?.planes?.length === 1);
  const sectionState = await page.evaluate(() => window.__studioSection());
  assert.deepEqual(sectionState.planes[0].normal, [0, 1, 0]); assert.equal(sectionState.planes[0].offset, 15, 'default section must be the expected world-Y midpoint');
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Front', exact: true }).click();
  await page.waitForFunction(() => {
    const hit = window.__studioInstanceAt?.([64, 15, 3]);
    return hit?.id === 'g21-b' && hit.body === 0 && hit.face === -1 && hit.cap === true;
  });
  const capPoint = [64, 15, 3], capHit = await actualPick(capPoint);
  const capProjected = await page.evaluate(point => window.__studioProject(point), capPoint), capCanvas = await page.locator('.vp-canvas').boundingBox();
  await page.mouse.click(capCanvas.x + capProjected[0], capCanvas.y + capProjected[1]);
  await page.waitForFunction(() => document.querySelector('.ol.instance.sel')?.textContent?.includes('G21 B') && document.querySelector('[role="alert"]')?.textContent?.includes('Use an original face for face operations'));
  assert.equal(await page.locator('[aria-label="Instance"] input[aria-label="Instance Name"]').inputValue(), 'G21 B');
  result.sectionCap = { section: sectionState, point: capPoint, hit: capHit, notice: await page.getByRole('alert').innerText() };
  await raw('cap-selected'); await page.screenshot({ path: join(out, backend + '-instances-cap-selected.png') });
  const capDocument = await doc(), capDirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Isolate selection', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Restore view"]')?.getAttribute('aria-pressed') === 'true');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  assert.deepEqual(await actualPick(capPoint), capHit, 'isolation retains the selected instance generated cap without native face authority');
  assert.equal(await doc(), capDocument); assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), capDirty);
  result.sectionCap.isolatedHit = await actualPick(capPoint);
  await page.screenshot({ path: join(out, backend + '-instances-isolated-cap.png') });
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Restore view', exact: true }).click();
  await page.getByLabel('Section view', { exact: true }).click();
  await page.waitForFunction(() => window.__studioSection?.()?.mode === null);
  await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Iso', exact: true }).click();
  await page.getByTitle('Frame all (F)', { exact: true }).click();
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const clearCanvasSelection = async (verified = null) => {
    const candidates = verified ? [verified.world] : [-40, 0, 85, 170, 220].flatMap(x => [-60, -25, 45, 80].flatMap(y => [30, 60].map(z => [x, y, z])));
    const empty = await page.evaluate(candidates => {
      const canvas = document.querySelector('.vp-canvas'), box = canvas.getBoundingClientRect(), padding = 16;
      const handles = [...document.querySelectorAll('.viewport [data-gizmo], .viewport [data-handle], .viewport .gizmo-origin')].map(node => node.getBoundingClientRect());
      for (const world of candidates) {
        const css = window.__studioProject(world), x = box.left + css[0], y = box.top + css[1];
        if (!css.every(Number.isFinite) || css[0] < 20 || css[1] < 20 || css[0] > box.width - 20 || css[1] > box.height - 20) continue;
        if (document.elementFromPoint(x, y) !== canvas) continue;
        if (handles.some(rect => x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding)) continue;
        if (window.__studioInstanceAt(world) !== null) continue;
        return { world, css, client: [x, y] };
      }
      return null;
    }, candidates);
    assert.ok(empty, 'No verified in-canvas non-UI/gizmo empty point among the ' + candidates.length + ' bounded candidates.');
    await page.mouse.click(empty.client[0], empty.client[1]);
    await page.waitForFunction(() => document.querySelectorAll('.ol.instance.sel').length === 0);
    (result.selectionClears ??= []).push(empty);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  };
  const click = async (point, id) => {
    await clearCanvasSelection();
    const hit = await actualPick(point); assert.equal(hit?.id, id); assert.equal(hit.body, 0); assert.ok(hit.face >= 0);
    const projected = await page.evaluate(point => window.__studioProject(point), point), box = await page.locator('.vp-canvas').boundingBox();
    await page.mouse.click(box.x + projected[0], box.y + projected[1]);
    await page.waitForFunction(id => document.querySelector('.ol.instance.sel')?.textContent?.includes(id), id === 'g21-b' ? 'G21 B' : 'G21 A');
    return hit;
  };
  const baseline = await click([64, 15, 6], 'g21-b');
  assert.equal(await page.locator('[aria-label="Instance"] input[aria-label="Instance Name"]').inputValue(), 'G21 B');
  result.instancePicks = [{ stage: 'initial', point: [64, 15, 6], hit: baseline }];
  const isolate = page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Isolate selection', exact: true });
  const restore = page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: 'Restore view', exact: true });
  const isolationDocument = await doc(), isolationDirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
  const isolationPoints = [[15, 6, 6], [64, 15, 6], [155, 6, 12]], isolationEmpty = result.selectionClears.at(-1);
  const settledFrame = async () => {
    await page.mouse.move(1, 1);
    await page.waitForFunction(() => {
      const eye = window.__studioEye(), previous = window.__g21IsolationEye;
      window.__g21IsolationEye = [...eye];
      return previous && eye.every((value, index) => value === previous[index]);
    });
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    return page.evaluate(() => window.__studioFrame(48));
  };
  const beforeIsolation = await settledFrame(), beforePixels = await page.evaluate(points => window.__studioPixels(points), isolationPoints);
  await page.screenshot({ path: join(out, backend + '-instances-isolation-before.png') });
  const beforePicks = await Promise.all(isolationPoints.map(actualPick));
  assert.deepEqual(beforePicks.map(p => p?.id), ['g21-a', 'g21-b', 'g21-c']);
  assert.equal(await isolate.isDisabled(), false); await isolate.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Restore view"]')?.getAttribute('aria-pressed') === 'true');
  const isolatedFrame = await settledFrame(), isolatedPixels = await page.evaluate(points => window.__studioPixels(points), isolationPoints);
  const isolatedPicks = await Promise.all(isolationPoints.map(actualPick));
  assert.deepEqual(isolatedPicks, [null, baseline, null], 'faded instances lose native picking while the isolated instance retains its source face');
  for (const i of [0, 2]) assert.ok(beforePixels[i].reduce((sum, value, k) => sum + Math.abs(value - isolatedPixels[i][k]), 0) > 3, 'The actual faded A/C interior pixels must change.');
  assert.notDeepEqual(isolatedFrame, beforeIsolation);
  assert.equal(await doc(), isolationDocument); assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), isolationDirty);
  await raw('isolated'); await page.screenshot({ path: join(out, backend + '-instances-isolated.png') });
  // Reuse a point verified empty before fading: an unpickable faded solid is not an empty-space control.
  await clearCanvasSelection(isolationEmpty);
  assert.equal(await restore.isDisabled(), false, 'clearing the selection must leave restoration available');
  assert.equal(await restore.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await Promise.all(isolationPoints.map(actualPick)), [null, baseline, null], 'clearing selection must not change the isolated ID snapshot');
  await restore.click();
  await click([64, 15, 6], 'g21-b');
  const restoredFrame = await settledFrame(), restoredPixels = await page.evaluate(points => window.__studioPixels(points), isolationPoints);
  const restoredPicks = await Promise.all(isolationPoints.map(actualPick));
  assert.deepEqual(restoredPicks, beforePicks); assert.deepEqual(restoredPixels, beforePixels); assert.deepEqual(restoredFrame, beforeIsolation);
  assert.equal(await doc(), isolationDocument); assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), isolationDirty);
  result.isolation = { points: isolationPoints, beforePicks, isolatedPicks, restoredPicks, beforePixels, isolatedPixels, restoredPixels, selectionCleared: true, frameRestored: true, capRetained: result.sectionCap.isolatedHit };
  await page.screenshot({ path: join(out, backend + '-instances-isolation-restored.png') });
  const change = async (axis, occurrence, value, field, index) => {
    const input = page.locator('[aria-label="Instance"] [aria-label="Instance ' + axis + '"]').nth(occurrence);
    await input.fill(String(value)); await input.press('Enter');
    await page.waitForFunction(({ field, index, value }) => window.__studioDoc.instances.find(i => i.id === 'g21-b')[field][index] === value, { field, index, value });
  };
  await change('X', 0, 85, 'position', 0);
  await bounds('g21-b', [73, 0, 0], [85, 30, 6]);
  await change('Z', 0, 8, 'position', 2);
  await bounds('g21-b', [73, 0, 8], [85, 30, 14]);
  await change('Z', 1, 180, 'rotation', 2);
  await bounds('g21-b', [55, -12, 8], [85, 0, 14]);
  const editedPoint = [70, -6, 14], editedPick = await actualPick(editedPoint);
  assert.deepEqual(editedPick, baseline, 'native top-face identity stays with the placed source after UI edits');
  result.instancePicks.push({ stage: 'edited', point: editedPoint, hit: editedPick });
  await raw('edited'); await page.screenshot({ path: join(out, backend + '-instances-edited.png') });
  await page.locator('[aria-label="Instance"]').getByRole('button', { name: 'Hide', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.instances.find(i => i.id === 'g21-b').hidden === true);
  await bounds('g21-b', null, null, true); assert.notEqual((await actualPick(editedPoint))?.id, 'g21-b');
  await page.locator('.ol.instance').filter({ hasText: 'G21 B' }).click();
  await page.locator('[aria-label="Instance"]').getByRole('button', { name: 'Show', exact: true }).click();
  await bounds('g21-b', [55, -12, 8], [85, 0, 14]); assert.deepEqual(await actualPick(editedPoint), baseline);
  await raw('shown-again');
  await isolate.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Restore view"]')?.getAttribute('aria-pressed') === 'true');
  const savedDoc = JSON.parse(await doc());
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Save', { exact: true }).click()]);
  const saved = join(out, backend + '-instances-saved.bcad'); await download.saveAs(saved);
  assert.deepEqual(JSON.parse(await readFile(saved, 'utf8')), savedDoc);
  assert.equal(savedDoc.instances[0].part.id, savedDoc.instances[1].part.id);
  assert.notEqual(savedDoc.instances[2].part.id, savedDoc.instances[0].part.id);
  assert.equal(savedDoc.instances[3].hidden, true); assert.equal(Object.hasOwn(savedDoc, 'displayMode'), false);
  assert.equal(Object.hasOwn(savedDoc, 'isolatedInstances'), false);
  assert.equal(Object.hasOwn(savedDoc, 'isolation'), false);
  await newEmpty();
  assert.equal(await restore.count(), 0); assert.equal(await isolate.isDisabled(), true, 'New resets view focus and leaves no placed selection to isolate');
  result.isolation.newReset = true;
  await open(saved, 4);
  await page.waitForFunction(expected => window.__g21DocJson() === expected, JSON.stringify(savedDoc));
  await bounds('g21-b', [55, -12, 8], [85, 0, 14]); await bounds('g21-hidden', null, null, true);
  assert.equal(await restore.count(), 0);
  await click(editedPoint, 'g21-b'); await raw('reopened');
  await isolate.click(); await page.waitForFunction(() => document.querySelector('[aria-label="Restore view"]')?.getAttribute('aria-pressed') === 'true');
  await open(saved, 4);
  await page.waitForFunction(expected => window.__g21DocJson() === expected, JSON.stringify(savedDoc));
  assert.equal(await restore.count(), 0); assert.equal(await isolate.isDisabled(), true, 'Open resets an active view focus even when the same instance IDs recur');
  result.isolation.openReset = true;
  await click(editedPoint, 'g21-b');
  await change('X', 0, 90, 'position', 0); await bounds('g21-b', [60, -12, 8], [90, 0, 14]);
  const reedit = await actualPick([75, -6, 14]); assert.deepEqual(reedit, baseline);
  result.instancePicks.push({ stage: 'reedited', point: [75, -6, 14], hit: reedit });
  await raw('reedited'); await page.screenshot({ path: join(out, backend + '-instances-reedited.png') });
  result.instanceBounds = await page.evaluate(() => window.__studioInstanceBounds());
  result.steps.push('session isolate: real A/C pixel change and pick exclusion, B native/cap retained; empty-canvas selection clear; frame/picks restore; Save omits focus and New/Open reset it');
  result.steps.push('actual Model-file assembly: identical/rotated/different/hidden placed sources; all five modes supported; canvas face select; X/Z UI edits; Hide/Show; Save/New/Open references and placements; reselect/re-edit');
  await runCurvedAppFlow({ page, backend, result, out, root, doc, choose, newEmpty, open, settledFrame });
}

// Consumer flow only: the renderer matrix supplies the same-geometry curved-face negative control.
// These source documents use the existing feature constructors and enter through the real Model file input.
async function runCurvedAppFlow({ page, backend, result, out, root, doc, choose, newEmpty, open, settledFrame }) {
  const { build } = await import('esbuild'), helper = join(out, backend + '-curved-doc-helpers.mjs');
  await build({
    stdin: { contents: 'export { cylinderPart, withNode } from "./packages/barocss-cad-model/src/engine/doc.ts";', resolveDir: root },
    outfile: helper, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  const { cylinderPart, withNode } = await import(pathToFileURL(helper).href);
  result.curvedSolids = [];
  for (const kind of ['cylinder', 'sphere']) {
    await newEmpty(); const blank = JSON.parse(await doc());
    assert.deepEqual(blank.nodes, []); assert.equal(blank.instances?.length ?? 0, 0);
    // The half-disc/revolve is the actual engine.test.ts sphere construction, not a faceted mesh import.
    const part = kind === 'cylinder' ? cylinderPart(8, 24) : withNode(withNode(blank, {
      kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -6], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 6] }],
    }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
    const id = 'g21-curved-' + kind, position = [0, 0, kind === 'sphere' ? 12 : 0];
    const source = { ...blank, instances: [{ id, name: 'G21 ' + kind, doc: part, position, rotation: [0, 0, 0] }] };
    const input = join(out, backend + '-curved-' + kind + '-input.bcad');
    await writeFile(input, JSON.stringify(source, null, 2) + '\n'); await open(input, 1);
    await page.waitForFunction(id => {
      const b = window.__studioInstanceBounds?.().find(item => item.id === id);
      return b?.min.every((value, k) => Number.isFinite(value) && Number.isFinite(b.max[k]) && b.max[k] > value);
    }, id);
    const accepted = await doc(), dirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
    const acceptedDoc = JSON.parse(accepted);
    assert.equal(acceptedDoc.instances[0].doc.nodes.some(node => node.kind === 'mesh'), false);
    assert.equal(acceptedDoc.instances[0].doc.nodes.at(-1).kind, kind === 'sphere' ? 'revolve' : 'extrude');
    const item = { kind, input, rows: [], eyes: {} }, viewFrames = {}; result.curvedSolids.push(item);
    for (const view of ['Front', 'Right', 'Iso']) {
      await choose('shaded-with-edges');
      await page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name: view, exact: true }).click();
      await page.getByTitle('Frame all (F)', { exact: true }).click();
      await settledFrame();
      item.eyes[view] = await page.evaluate(() => window.__studioEye());
      const point = [0, 0, 12], native = await page.evaluate(point => window.__studioInstanceAt(point), point), frames = {};
      assert.equal(native?.id, id); assert.equal(native.body, 0); assert.ok(native.face >= 0); assert.notEqual(native.cap, true);
      for (const mode of modes) {
        await choose(mode); frames[mode] = await settledFrame();
        assert.ok(Array.isArray(frames[mode]) && frames[mode].length === 48 * 48 * 3);
        const hit = await page.evaluate(point => window.__studioInstanceAt(point), point);
        assert.deepEqual(hit, native, 'curved contour appearance must retain the original native face pick');
        assert.equal(await doc(), accepted); assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), dirty);
        const capture = join(out, backend + '-curved-' + kind + '-' + view.toLowerCase() + '-' + mode + '.png');
        await page.screenshot({ path: capture }); item.rows.push({ view, mode, point, hit, capture });
      }
      assert.notDeepEqual(frames.wireframe, frames['shaded-with-edges']);
      assert.notDeepEqual(frames['x-ray'], frames['shaded-with-edges']);
      viewFrames[view] = frames['shaded-with-edges'];
    }
    assert.notDeepEqual(item.eyes.Front, item.eyes.Right); assert.notDeepEqual(item.eyes.Front, item.eyes.Iso);
    // A sphere can have the same image after rotation; the cylinder supplies the view-image change witness.
    if (kind === 'cylinder') assert.notDeepEqual(viewFrames.Iso, viewFrames.Front, 'the actual view buttons must change the cylinder image');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Save', { exact: true }).click()]);
    item.saved = join(out, backend + '-curved-' + kind + '-saved.bcad'); await download.saveAs(item.saved);
    assert.deepEqual(JSON.parse(await readFile(item.saved, 'utf8')), acceptedDoc);
    assert.equal(Object.hasOwn(acceptedDoc, 'displayMode'), false); assert.equal(Object.hasOwn(acceptedDoc, 'isolatedInstances'), false);
  }
  result.steps.push('actual Model-file cylinder and analytic half-disc/revolve sphere: Front/Right/Iso × five Views modes; native face picks and document/dirty state retained; separate curved BCAD saves');
}

const options = parseArgs(process.argv.slice(2));
assert.equal(options.mode, 'run', 'This App flow only supports --run.');
const root = resolve(import.meta.dirname, '../../..'), app = join(root, 'apps/cad-studio');
const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const state = () => ({ sha: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain', '--untracked-files=all']) });
assertRunAuthority(options, state());
await mkdir(options.out, { recursive: true });
assert.equal((await readdir(options.out)).length, 0, 'Output directory must be empty.');
const load = loadavg();
assert.ok(load[0] < 20 && load[1] < 25, `Load gate: ${load}`);
const record = { sha: options.sha, lease: options.lease, instances: !!options.instances, clearance: process.env.BAROCSS_G22_APP === '1', startedAt: new Date().toISOString(), runnerPid: process.pid, argv: process.argv, loadStart: load, cases: [], errors: [] };
let server;
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import(pathToFileURL(createRequire(join(app, 'package.json')).resolve('vite')).href);
const modes = ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray'];
try {
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { port: 52691, strictPort: true }, logLevel: 'error' });
  await server.listen();
  for (const backend of ['webgpu', 'webgl2']) {
    assertRunAuthority(options, state());
    const result = { backend, dpr: 1, steps: [], errors: [] }; record.cases.push(result);
    const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    result.browserVersion = browser.version();
    let page;
    try {
      page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      page.on('pageerror', error => result.errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()); });
      page.on('dialog', dialog => dialog.accept());
      await page.addInitScript(() => {
        // Compare document content without treating object insertion order as a persistence change.
        const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
          ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
        window.__g21DocJson = () => JSON.stringify(canonical(window.__studioDoc));
        window.__g21DeviceErrors = [];
        const proto = globalThis.GPUAdapter?.prototype, original = proto?.requestDevice;
        if (original) proto.requestDevice = async function (...args) {
          const info = this.info;
          window.__g21AdapterInfo = { vendor: info?.vendor ?? '', architecture: info?.architecture ?? '', device: info?.device ?? '', description: info?.description ?? '' };
          const device = await original.apply(this, args);
          device.addEventListener('uncapturederror', event => window.__g21DeviceErrors.push(String(event.error?.message ?? event.error)));
          device.lost.then(info => { if (info.reason !== 'destroyed') window.__g21DeviceErrors.push('Device lost: ' + info.message); });
          return device;
        };
      });
      await page.goto(server.resolvedUrls.local[0] + (backend === 'webgl2' ? '?renderer=webgl2' : ''));
      await page.waitForSelector(`.viewport[data-renderer="${backend}"]`);
      const fresh = () => page.waitForFunction(() => window.__studioFresh === true);
      const doc = () => page.evaluate(() => window.__g21DocJson());
      const mode = page.getByLabel('CAD display mode', { exact: true });
      const choose = async value => {
        await mode.selectOption(value);
        await page.waitForFunction(value => document.querySelector('.viewport')?.dataset.displayModeEffective === value && document.querySelector('.viewport')?.dataset.displayModeRequested === value && document.querySelector('.viewport')?.dataset.displayModeSupported === 'true', value);
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      };
      await fresh();
      result.environment = await page.evaluate(backend => {
        if (backend === 'webgpu') {
          const viewer = window.__studioViewer, info = viewer?.device?.adapterInfo ?? window.__g21AdapterInfo;
          return { backend: document.querySelector('.viewport')?.dataset.renderer, device: !!viewer?.device, adapter: info && { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description }, actualDpr: window.devicePixelRatio };
        }
        const gl = document.querySelector('.vp-canvas')?.getContext('webgl2'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
        return { backend: document.querySelector('.viewport')?.dataset.renderer, renderer: gl?.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER), version: gl?.getParameter(gl.VERSION), actualDpr: window.devicePixelRatio };
      }, backend);
      assert.equal(result.environment.backend, backend); assert.equal(result.environment.actualDpr, 1);
      if (backend === 'webgpu') assert.ok(result.environment.device && Object.values(result.environment.adapter ?? {}).some(value => typeof value === 'string' && value.trim()), 'Actual device adapter identity is required.');
      else assert.ok(result.environment.renderer && /WebGL\s*2/i.test(result.environment.version), 'Actual WebGL2 renderer/version is required.');
      if (process.env.BAROCSS_G22_APP === '1') {
        const { runClearanceAppFlow } = await import('./cad-clearance-app-flow.mjs');
        await runClearanceAppFlow({ page, backend, result, out: options.out, root, app, doc, choose });
        result.deviceErrors = await page.evaluate(() => window.__g21DeviceErrors ?? []);
        assert.deepEqual(result.deviceErrors, []); assert.deepEqual(result.errors, []);
        continue;
      }
      if (options.instances) {
        await runInstanceAppFlow({ page, backend, result, out: options.out, root, app, doc, choose });
        result.deviceErrors = await page.evaluate(() => window.__g21DeviceErrors ?? []);
        assert.deepEqual(result.deviceErrors, []); assert.deepEqual(result.errors, []);
        continue;
      }
      const before = await doc(), wasDirty = await page.getByLabel('Unsaved changes', { exact: true }).count();
      const frames = {};
      for (const value of modes) {
        await choose(value);
        assert.equal(await mode.inputValue(), value);
        assert.equal(await doc(), before, 'Display mode must not change the document.');
        assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), wasDirty);
        frames[value] = await page.evaluate(() => window.__studioFrame(48));
        await page.screenshot({ path: join(options.out, `${backend}-${value}.png`) });
      }
      assert.notDeepEqual(frames.wireframe, frames['shaded-with-edges']);
      assert.notDeepEqual(frames['x-ray'], frames['shaded-with-edges']);
      result.steps.push('five Views modes: effective/requested agree; document and dirty unchanged; visible frame changes');
      await page.getByRole('button', { name: 'Render', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.displayModeEffective === 'shaded-with-edges');
      assert.equal(await mode.inputValue(), 'shaded-with-edges'); assert.equal(await mode.isDisabled(), true);
      assert.match(await page.locator('#cad-display-mode-status').innerText(), /Model view.*Shaded with edges is active/);
      await page.getByRole('button', { name: 'Model', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.viewport')?.dataset.displayModeEffective === 'x-ray');
      assert.equal(await doc(), before);
      result.steps.push('Render unsupported reason/default, Model restores session request');
      // Actual edit, Undo and Redo on the same loaded document, after selecting the mode.
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      await page.keyboard.press('b');
      await page.waitForFunction(() => /preview/.test(document.querySelector('.hud .status')?.textContent ?? ''));
      await page.keyboard.press('Enter');
      await page.waitForFunction(previous => window.__g21DocJson() !== previous && window.__studioFresh === true && !document.querySelector('.hud'), before);
      const edited = await doc();
      await page.keyboard.press('Meta+z'); await page.waitForFunction(previous => window.__g21DocJson() === previous && window.__studioFresh === true, before);
      await page.keyboard.press('Meta+Shift+z'); await page.waitForFunction(edited => window.__g21DocJson() === edited && window.__studioFresh === true, edited);
      result.steps.push('same-document box edit / Undo / Redo');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Save', { exact: true }).click()]);
      const saved = join(options.out, `${backend}-saved.bcad`); await download.saveAs(saved);
      const bytes = await readFile(saved); const serialized = JSON.parse(bytes.toString('utf8'));
      assert.deepEqual(serialized, JSON.parse(edited), 'Saved JSON must contain exactly the edited document.');
      assert.equal(Object.hasOwn(serialized, 'displayMode'), false, 'Session mode must not be serialized.');
      assert.equal(await page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
      await page.getByLabel('New part', { exact: true }).click();
      await page.waitForFunction(edited => window.__g21DocJson() !== edited && window.__studioDoc?.nodes.length === 0 && window.__studioFresh === true, edited);
      await page.evaluate(() => { window.__g21BeforeOpen = window.__studioDoc; });
      await page.setInputFiles('input[aria-label="Model file"]', saved);
      await page.waitForFunction(edited => window.__studioDoc !== window.__g21BeforeOpen && window.__g21DocJson() === edited && window.__studioFresh === true, edited);
      await page.screenshot({ path: join(options.out, `${backend}-reopened.png`) });
      result.steps.push('Save/Open preserves edited document and excludes displayMode');
      result.deviceErrors = await page.evaluate(() => window.__g21DeviceErrors ?? []);
      assert.deepEqual(result.deviceErrors, []);
      assert.deepEqual(result.errors, []);
    } catch (error) {
      result.error = String(error.stack ?? error); record.errors.push(`${backend}: ${error.message}`);
      if (page) try { await page.screenshot({ path: join(options.out, `${backend}-failure.png`) }); } catch (captureError) { result.errors.push('Failure screenshot: ' + captureError.message); }
    }
    finally {
      await browser.close();
      // Include errors emitted during final screenshots/closing, after the earlier assertion.
      for (const error of result.errors) record.errors.push(`${backend}: ${error}`);
    }
  }
} catch (error) { record.errors.push(String(error.stack ?? error)); }
finally {
  await server?.close(); record.finishedAt = new Date().toISOString(); record.loadEnd = loadavg();
  record.finalGit = state();
  if (record.finalGit.sha !== options.sha || record.finalGit.status !== '') record.errors.push('Clean immutable SHA changed during App execution.');
  await writeFile(join(options.out, 'app-result.json'), JSON.stringify(record, null, 2) + '\n');
}
if (record.errors.length) process.exitCode = 1;
