// D334: one serial WebGPU profile. Public controls edit; development hooks only observe.
// PW_DIR=/absolute/playwright CHROME=/absolute/chrome node test/curve-cut-pattern-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const report = { status: 'RUNNING', profiles: 1, backend: 'webgpu', states: [], errors: [], consoleErrors: [], changes: [], files: [], cleanup: [] };
let phase = 'seed generation', server, browser, context, page;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const generator = `import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part, Location } from '../../packages/barocss-cad-model/src/api/index.ts';
const seed = part('Path cut seed').box({w:60,d:40,h:10})
  .subtract(p => p.box({w:4,d:2,h:10,x:0,y:8}).moved(Location.at([8,0,0])));
assert.ok(Math.abs(seed.mass({density:1}).volume - 23920) < 1e-7);
writeFileSync(process.argv[2], JSON.stringify(seed.doc,null,2)+'\\n');`;
const hud = () => page.getByRole('dialog', { name: 'Path cut pattern', exact: true });
// Independent stock-minus-prisms first moments, fixed asymmetric 4×2×10 cutter orientation.
function centroid(minima) {
  const moment = [720000, 480000, 120000], volume = 24000 - minima.length * 80;
  for (const [x, y] of minima) { moment[0] -= 80 * (x + 2); moment[1] -= 80 * (y + 1); moment[2] -= 400; }
  return moment.map(value => value / volume);
}
const minima = [[8, 8], [16, 8], [24, 8], [24, 16], [24, 24]];

// Decode the authored public Make curves source. Never infer world coordinates from mouse clicks.
function authoredCurve(doc, objectId) {
  const object = doc.direct.objects.find(object => object.id === objectId);
  assert.ok(object, 'the same live path object exists');
  const source = doc.direct.sources[object.source];
  assert.equal((source.match(/@curve\s+#/g) ?? []).length, 1, 'one authored curve');
  const field = name => { const value = source.match(new RegExp(`${name}\\s*:\\s*(.*?);`, 's'))?.[1]; assert.ok(value, name); return JSON.parse(value); };
  return { degree: field('degree'), knots: field('knots'), points: field('control-points'), weights: field('weights') };
}
function closePoints(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((point, i) => { assert.equal(point.length, 3); point.forEach((value, j) => assert.ok(Math.abs(value - expected[i][j]) < 1e-7, `pole ${i}, axis ${j}: ${value} vs ${expected[i][j]}`)); });
}
async function selectPath(objectId) {
  const object = await page.evaluate(id => window.__studioDoc.direct.objects.find(object => object.id === id), objectId);
  await page.locator('.outliner .ol.direct').filter({ hasText: object.name }).click();
  await page.getByRole('complementary', { name: 'Direct geometry', exact: true }).waitFor();
}
const directPanel = () => page.getByRole('complementary', { name: 'Direct geometry', exact: true });
async function waitDocChange(before) {
  await page.waitForFunction(before => JSON.stringify(window.__studioDoc) !== before, JSON.stringify(before), { timeout: 60000 });
}
async function movePath(objectId, by, volume, locations) {
  await selectPath(objectId); const before = await page.evaluate(() => window.__studioDoc);
  for (const [axis, value] of by.entries()) await directPanel().getByLabel(['ΔX', 'ΔY', 'ΔZ'][axis], { exact: true }).fill(String(value));
  await directPanel().getByRole('button', { name: 'Move', exact: true }).click();
  await waitDocChange(before); await ready(volume, centroid(locations));
  const after = await page.evaluate(() => window.__studioDoc);
  assert.deepEqual(after.nodes, before.nodes, 'consumed-path edit retains feature IDs and path reference');
  const previous = authoredCurve(before, objectId), next = authoredCurve(after, objectId);
  closePoints(next.points, previous.points.map(point => point.map((value, axis) => value + by[axis])));
  assert.deepEqual(next.weights, previous.weights); assert.deepEqual(next.knots, previous.knots);
  return { before, after };
}
async function sameDocAndMass(before, volume, locations) {
  await page.waitForFunction(expected => JSON.stringify(window.__studioDoc) === expected, JSON.stringify(before), { timeout: 60000 });
  await ready(volume, centroid(locations)); assert.deepEqual(await page.evaluate(() => window.__studioDoc), before);
}

async function ready(volume = null, expectedCentroid = null) {
  await page.waitForFunction(({ volume, expectedCentroid }) => {
    const state = window.__studioBodies?.();
    return window.__studioFresh === true && state?.fresh && state.massReady &&
      (volume === null || state.bodies.length === 1 && Math.abs(state.bodies[0].volume - volume) < 1e-7) &&
      (!expectedCentroid || state.bodies[0]?.centroid?.every((v, i) => Math.abs(v - expectedCentroid[i]) < 1e-7));
  }, { volume, expectedCentroid }, { timeout: 60000 });
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection,
    hud: document.querySelector('.hud')?.textContent, inspector: document.querySelector('[aria-label="Selection"]')?.textContent,
    feedback: [...document.querySelectorAll('.toast')].map(element => element.textContent) }), label);
  report.states.push(state); await persist(); await page.screenshot({ path: join(output, `${label}.png`) }); return state;
}
async function freshPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function command(label) {
  await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter');
}
async function selectBody() { await ready(); await page.locator('.outliner .ol:not(.ol-step)').first().click(); }
async function save(label) {
  await ready(); const before = await page.evaluate(() => window.__studioDoc);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file);
  const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), before);
  report.files.push({ file, sha256: hash(bytes) }); return { file, doc: before };
}
async function editCount(count, volume, locations) {
  const before = await page.evaluate(() => window.__studioDoc), index = before.nodes.length - 1;
  await page.locator(`.history .hs[data-node-index="${index}"]`).click();
  await page.locator('.node-editor').getByLabel('Count', { exact: true }).fill(String(count));
  await page.locator('.node-editor').getByRole('button', { name: 'Apply', exact: true }).click();
  await waitDocChange(before); await ready(volume, centroid(locations)); await page.waitForSelector('.node-editor', { state: 'hidden' });
  const after = await page.evaluate(() => window.__studioDoc);
  assert.equal(after.nodes.at(-1).count, count); assert.equal(after.nodes.at(-1).id, before.nodes.at(-1).id);
  assert.deepEqual(after.nodes.at(-1).path, before.nodes.at(-1).path); assert.deepEqual(after.nodes.slice(0, -1), before.nodes.slice(0, -1));
}
try {
  const built = await build({ stdin: { contents: generator, resolveDir: app, sourcefile: 'path-cut-seed.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  const bundle = join(output, 'seed-generator.mjs'), seedFile = join(output, 'seed.bcad');
  await writeFile(join(output, 'seed-generator.ts'), generator); await writeFile(bundle, built.outputFiles[0].contents);
  await writeFile(join(output, 'seed-metafile.json'), JSON.stringify(built.metafile, null, 2));
  const run = spawnSync(process.execPath, [bundle, seedFile], { encoding: 'utf8' });
  await writeFile(join(output, 'seed.stdout.txt'), run.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  report.seed = { file: seedFile, sha256: hash(await readFile(seedFile)), generatorSHA256: hash(generator), bundleSHA256: hash(built.outputFiles[0].contents) };
  phase = 'actual Studio start';
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  server.watcher.on('change', file => report.changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', seedFile); await ready(23920); await snapshot('01-seed');
  phase = 'public sketch and Make curves'; await command('Sketch'); await page.getByRole('complementary', { name: 'Sketch', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Line', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const point of [[0, 0, 0], [16, 0, 0], [16, 16, 0]]) {
    const pixel = await page.evaluate(point => window.__studioScreenOf(point), point); assert.ok(pixel, 'world point projects into sketch'); await page.mouse.click(pixel[0], pixel[1]);
  }
  // Switching to Select settles the open chain before Make curves consumes it.
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Make curves', exact: true }).click();
  await page.waitForFunction(() => window.__studioDoc.direct?.objects.length === 1);
  await ready(23920);
  const pathState = await snapshot('02-made-path'), pathObject = pathState.doc.direct?.objects.at(-1); assert.ok(pathObject);
  report.pathObjectId = pathObject.id;
  const madeCurve = authoredCurve(pathState.doc, pathObject.id);
  assert.equal(madeCurve.degree, 2); assert.deepEqual(madeCurve.knots, [0, 0, 0, 1, 1, 2, 2, 2]);
  assert.deepEqual(madeCurve.weights, [1, 1, 1, 1, 1]);
  closePoints(madeCurve.points, [[0, 0, 0], [8, 0, 0], [16, 0, 0], [16, 8, 0], [16, 16, 0]]);
  report.authoredCurve = madeCurve;
  phase = 'path pattern preview and refusal'; await selectBody(); await command('Path cut pattern'); await hud().waitFor();
  await hud().getByLabel('Path', { exact: true }).selectOption(pathObject.id);
  await hud().getByLabel('Spacing', { exact: true }).fill('8'); await hud().getByLabel('Count', { exact: true }).fill('5');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  const preview = await snapshot('03-preview'); assert.deepEqual(preview.doc, pathState.doc);
  await hud().getByLabel('Count', { exact: true }).fill('6');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused');
  const refused = await snapshot('04-distance-refused'); assert.deepEqual(refused.doc, pathState.doc); assert.match(refused.hud, /exceeds.*path length/i);
  assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true);
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await ready(23920);
  await selectBody(); await command('Path cut pattern'); await hud().waitFor();
  await hud().getByLabel('Path', { exact: true }).selectOption(pathObject.id); await hud().getByLabel('Spacing', { exact: true }).fill('8'); await hud().getByLabel('Count', { exact: true }).fill('5');
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview');
  phase = 'Apply Undo Redo'; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await ready(23600, centroid(minima));
  const accepted = await snapshot('05-applied'); assert.equal(accepted.doc.nodes.at(-1).kind, 'curve-feature-pattern'); assert.deepEqual(accepted.doc.nodes.at(-1).path, { objectId: pathObject.id });
  await page.keyboard.press('Meta+z'); await ready(23920); const undo = await snapshot('06-undo'); assert.deepEqual(undo.doc, pathState.doc);
  await page.keyboard.press('Meta+Shift+z'); await ready(23600, centroid(minima));
  const redo = await snapshot('07-redo'); assert.deepEqual(redo.doc, accepted.doc);
  phase = 'Save fresh Open re-edit'; const saved = await save('accepted'); await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', saved.file); await ready(23600, centroid(minima));
  assert.deepEqual(await page.evaluate(() => window.__studioDoc), saved.doc); await snapshot('08-fresh-open');
  await editCount(4, 23680, minima.slice(0, 4)); await snapshot('09-count-edit');
  const edited = await save('edited'); await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', edited.file); await ready(23680, centroid(minima.slice(0, 4)));
  assert.deepEqual(await page.evaluate(() => window.__studioDoc), edited.doc); await snapshot('10-edited-fresh-open');
  phase = 'consumed path Move candidate';
  const moved = await movePath(pathObject.id, [3, 4, 0], 23680, minima.slice(0, 4));
  await snapshot('11-consumed-path-move');
  await page.keyboard.press('Meta+z'); await sameDocAndMass(moved.before, 23680, minima.slice(0, 4));
  await page.keyboard.press('Meta+Shift+z'); await sameDocAndMass(moved.after, 23680, minima.slice(0, 4));
  await snapshot('12-path-move-redo');

  phase = 'consumed path delete refusal';
  await selectPath(pathObject.id);
  // The outliner button has focus, so Delete reaches the public document handler.
  await page.keyboard.press('Delete');
  await page.locator('.toast').filter({ hasText: /path object is missing/i }).waitFor();
  await sameDocAndMass(moved.after, 23680, minima.slice(0, 4));
  const deleted = await snapshot('13-consumed-path-delete-refused');
  assert.match(deleted.feedback.join(' '), /Direct geometry not changed/);
  // The preflight refusal must not add an Undo entry.
  await page.keyboard.press('Meta+z'); await sameDocAndMass(moved.before, 23680, minima.slice(0, 4));
  await page.keyboard.press('Meta+Shift+z'); await sameDocAndMass(moved.after, 23680, minima.slice(0, 4));
  phase = 'valid direct retry after refusal';
  const retry = await movePath(pathObject.id, [-2, 1, 0], 23680, minima.slice(0, 4));
  await snapshot('14-valid-path-retry');
  await page.keyboard.press('Meta+z'); await sameDocAndMass(retry.before, 23680, minima.slice(0, 4));
  await page.keyboard.press('Meta+Shift+z'); await sameDocAndMass(retry.after, 23680, minima.slice(0, 4));

  phase = 'same-volume path edit centroid';
  const beforeStretch = await page.evaluate(() => window.__studioDoc);
  await selectPath(pathObject.id);
  for (const [label, value] of [['× X', 2], ['× Y', 1], ['× Z', 1]]) await directPanel().getByLabel(label, { exact: true }).fill(String(value));
  await directPanel().getByRole('button', { name: 'Stretch', exact: true }).click();
  await waitDocChange(beforeStretch);
  const straightMinima = [[8, 8], [16, 8], [24, 8], [32, 8]];
  await ready(23680, centroid(straightMinima));
  const stretched = await snapshot('15-same-volume-new-centroid');
  assert.deepEqual(stretched.doc.nodes, beforeStretch.nodes);
  const relative = points => points.map(point => point.map((value, axis) => value - points[0][axis]));
  closePoints(relative(authoredCurve(stretched.doc, pathObject.id).points), [[0, 0, 0], [16, 0, 0], [32, 0, 0], [32, 8, 0], [32, 16, 0]]);
  assert.notDeepEqual(centroid(straightMinima), centroid(minima.slice(0, 4)));
  await page.keyboard.press('Meta+z'); await sameDocAndMass(beforeStretch, 23680, minima.slice(0, 4));
  await page.keyboard.press('Meta+Shift+z'); await sameDocAndMass(stretched.doc, 23680, straightMinima);
  const liveSaved = await save('live-path-edited'); await freshPage();
  await page.setInputFiles('input[aria-label="Model file"]', liveSaved.file); await sameDocAndMass(liveSaved.doc, 23680, straightMinima);
  await snapshot('16-live-path-fresh-open');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error);
  if (page) { try { await snapshot('failure'); } catch { /* Preserve the first failure even if capture fails. */ } }
  process.exitCode = 1;
} finally {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  if (browser) { await browser.close(); report.cleanup.push('BROWSER_CLOSED'); }
  if (server) { await server.close(); report.cleanup.push('SERVER_CLOSED'); }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
