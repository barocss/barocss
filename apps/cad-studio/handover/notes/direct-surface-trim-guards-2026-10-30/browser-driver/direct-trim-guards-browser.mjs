// D336: source preparation is safe; execution requires an explicit frozen-source gate.
// D336_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/direct-trim-guards-browser.mjs /absolute/artifacts
// One Chrome WebGPU process, serial fresh contexts. Public UI mutates; hooks read only.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { importIGES } from '../../../packages/barocss-cad/dist/index.js';

assert.equal(process.env.D336_SOURCE_FROZEN, '1', 'Root must freeze and qualify source before D336 execution');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const report = { status: 'RUNNING', profiles: 1, backend: 'webgpu', states: [], refusals: [], errors: [], consoleErrors: [], changes: [], downloads: [], files: [], cleanup: [],
  limits: ['Authored exact trim metadata; public trimByCurve producer is separate probe evidence.', 'No UV remapping, new geometry support, exact sampled trim precision or thicken UI claim.', 'Native files are checked for semantic equality; hashes record provenance only.'] };
let phase = 'seed generation', server, browser, context, page;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exactTrims = [{ keep: 'outside', uv: [[-1, 2], [1, 2], [1, 4], [-1, 4]] }];
const fixtureCSS = `@model d336 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
 @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }
}`;
// Public facade witness matches the probe's independent 12 × 7 × 5 box.
// Only this own fixture receives authored trim metadata; no browser state is injected.
const generator = `import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part } from '../../packages/barocss-cad-model/src/api/index.ts';
import { emptyDirect, importSource } from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness = part('witness').box({ w:12, d:7, h:5, x:80, y:-3, z:1 });
assert.ok(Math.abs(witness.mass({ density:1 }).volume - 420) < 1e-7);
const imported = importSource(emptyDirect(), ${JSON.stringify(fixtureCSS)}, 'D336');
const direct = { ...imported, objects: imported.objects.map(o => o.geometry === 'panel'
  ? { ...o, trims: ${JSON.stringify(exactTrims)} } : o.geometry === 'hole' ? { ...o, hidden:true } : o) };
assert.deepEqual(direct.objects.map(o => [o.id,o.name]), [['obj_1','D336 · panel'],['obj_2','D336 · hole'],['obj_3','D336 · wall']]);
writeFileSync(process.argv[2], JSON.stringify({ ...witness.doc, direct },null,2)+'\\n');`;
const doc = () => page.evaluate(() => window.__studioDoc);
const panel = () => page.getByRole('complementary', { name: 'Direct geometry', exact: true });
const byId = (state, id) => state.direct.objects.find(o => o.id === id);
async function ready(requireWitness = true) {
  await page.waitForFunction(requireWitness => {
    const state = window.__studioBodies?.(), body = state?.bodies[0];
    return window.__studioFresh === true && state?.fresh && state.massReady && (!requireWitness || state.bodies.length === 1 &&
      Math.abs(body.volume - 420) < 1e-7 && body.centroid?.every((v, i) => Math.abs(v - [86, 0.5, 3.5][i]) < 1e-7));
  }, requireWitness, { timeout: 60000 });
}
async function same(expected) {
  await page.waitForFunction(value => JSON.stringify(window.__studioDoc) === value, JSON.stringify(expected), { timeout: 60000 });
  await ready(); assert.deepEqual(await doc(), expected);
}
async function changed(before) {
  await page.waitForFunction(value => JSON.stringify(window.__studioDoc) !== value, JSON.stringify(before), { timeout: 60000 });
  await ready();
}
async function selection() {
  return page.evaluate(() => ({ hook: window.__studioSelection ?? null,
    directNames: [...document.querySelectorAll('.ol.direct.sel')].map(row => row.textContent),
    directSelectionSource: 'Read-only selected outliner rows; __studioSelection does not expose directSel' }));
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(),
    selection: window.__studioSelection ?? null,
    directRows: [...document.querySelectorAll('.ol.direct')].map(row => ({ text: row.textContent, className: row.className, title: row.title })),
    feedback: [...document.querySelectorAll('.toast[role="alert"]')].map(e => e.textContent),
    buttonLabels: [...document.querySelectorAll('button')].map(e => ({ text: e.textContent, aria: e.getAttribute('aria-label') })) }), label);
  if (state.bodies?.bodies.length === 1) {
    const body = state.bodies.bodies[0];
    report.witnessKey ??= body.key;
    assert.equal(body.key, report.witnessKey, 'Witness body identity remains stable');
    assert.ok(Math.abs(body.volume - 420) < 1e-7);
    assert.ok(body.centroid?.every((v, i) => Math.abs(v - [86, 0.5, 3.5][i]) < 1e-7));
  }
  report.states.push(state);
  await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2));
  await writeFile(join(output, `${label}.html`), await page.content());
  await page.screenshot({ path: join(output, `${label}.png`), fullPage: true });
  await persist(); return state;
}
async function freshPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e)));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() }));
  page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready(false);
}
async function select(id, shift = false) {
  const object = byId(await doc(), id); assert.ok(object); assert.ok(!object.hidden, `Selection must not show hidden ${id}`);
  const escaped = object.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Icon text precedes the exact object name; no history-row label assumptions.
  const row = page.locator('.ol.direct').filter({ hasText: new RegExp(`${escaped}$`) });
  assert.equal(await row.count(), 1, `One direct outliner row for ${object.name}`);
  await row.click({ modifiers: shift ? ['Shift'] : [] }); await panel().waitFor();
}
async function dismissNotice() {
  const toast = page.locator('.toast[role="alert"]');
  if (await toast.count()) await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await toast.waitFor({ state: 'hidden' });
}
async function refuse(label, action, exportCase = false) {
  phase = `guard ${label}`; await dismissNotice();
  const before = await doc(), selected = await selection(), downloads = report.downloads.length;
  await action();
  const toast = page.locator('.toast[role="alert"]'); await toast.waitFor();
  assert.equal(await toast.locator('.toast-title').textContent(), exportCase ? 'Could not write IGES' : 'The operation was refused');
  const hint = await toast.locator('.toast-hint').textContent();
  assert.match(hint, /does not preserve surface trims/i); assert.match(hint, /Untrim/);
  // Dismiss-before-click ensures this is a newly produced notice, even for repeated titles.
  await same(before); assert.deepEqual(await selection(), selected, 'Refusal preserves selection');
  assert.deepEqual(byId(await doc(), 'obj_1').trims, exactTrims);
  assert.equal(report.downloads.length, downloads, 'Refusal emits no file download');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []);
  report.refusals.push({ label, title: await toast.locator('.toast-title').textContent(), hint,
    documentUnchanged: true, selectionUnchanged: true, noDownload: true, newNotice: true });
  await snapshot(`guard-${label}`);
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const before = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file);
  assert.deepEqual(JSON.parse(bytes), before, 'Native save semantic equality');
  report.files.push({ file, sha256: hash(bytes), semanticEquality: true, byteIdentityClaim: false }); return { file, doc: before };
}
async function freshOpen(saved, label) {
  phase = `fresh Open ${label}`; await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', saved.file);
  await same(saved.doc); await snapshot(label);
}
async function undo(expected, label) { phase = label; await page.keyboard.press('Meta+z'); await same(expected); await snapshot(label); }
async function redo(expected, label) { phase = label; await page.keyboard.press('Meta+Shift+z'); await same(expected); await snapshot(label); }
try {
  const seedFile = join(output, 'seed.bcad');
  const built = await build({ stdin: { contents: generator, resolveDir: app, sourcefile: 'direct-trim-seed.ts', loader: 'ts' }, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  const bundle = join(output, 'seed-generator.mjs');
  await writeFile(join(output, 'seed-generator.ts'), generator); await writeFile(bundle, built.outputFiles[0].contents);
  await writeFile(join(output, 'seed-metafile.json'), JSON.stringify(built.metafile, null, 2));
  const run = spawnSync(process.execPath, [bundle, seedFile], { encoding: 'utf8' });
  await writeFile(join(output, 'seed.stdout.txt'), run.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr);
  const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  report.seed = { file: seedFile, sha256: hash(await readFile(seedFile)), generatorSHA256: hash(generator),
    bundleSHA256: hash(built.outputFiles[0].contents), trimAuthorship: 'Own exact metadata, not public projection output',
    analyticMaterialArea: 1100, existingProbeSampledMaterialArea: 1100.0813802331686 };
  phase = 'actual Studio start';
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  server.watcher.on('change', file => report.changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  await freshOpen({ file: seedFile, doc: seed }, '01-authored-trim-open');
  const initialSaved = await save('authored-trim'); await freshOpen(initialSaved, '02-authored-trim-native-roundtrip');
  const guardDownloadBaseline = report.downloads.length;
  await select('obj_1');
  await panel().getByLabel('Surface direction', { exact: true }).selectOption('u');
  await refuse('reverse', () => panel().getByRole('button', { name: 'Reverse', exact: true }).click());
  await panel().getByLabel('At u', { exact: true }).fill('2');
  await refuse('split', () => panel().getByRole('button', { name: 'Split', exact: true }).click());
  for (const [label, value] of [['u from', -1], ['u to', 3], ['v from', 1.5], ['v to', 5.5]])
    await panel().getByLabel(label, { exact: true }).fill(String(value));
  await refuse('region', () => panel().getByRole('button', { name: 'Extract region', exact: true }).click());
  await panel().getByLabel('Extend edge', { exact: true }).selectOption('u-max');
  await panel().getByLabel('Extend by', { exact: true }).fill('5');
  await refuse('extend', () => panel().getByRole('button', { name: 'Extend the surface', exact: true }).click());
  await select('obj_3', true);
  await refuse('intersection', () => panel().getByRole('button', { name: 'Intersect the surfaces', exact: true }).click());
  await refuse('iges', () => page.getByRole('button', { name: 'Export IGES', exact: true }).click(), true);
  assert.equal(report.refusals.length, 6); await same(seed);
  assert.equal(report.downloads.length, guardDownloadBaseline, 'All six guards produce no extra file');
  const guardedSaved = await save('all-six-guards'); await freshOpen(guardedSaved, '03-guards-native-roundtrip');

  phase = 'intentional public Untrim'; await select('obj_1'); await dismissNotice();
  const trimmed = await doc(); await panel().getByRole('button', { name: 'Untrim', exact: true }).click(); await changed(trimmed);
  const untrimmed = await doc(), expectedUntrimmed = structuredClone(trimmed);
  delete byId(expectedUntrimmed, 'obj_1').trims; assert.deepEqual(untrimmed, expectedUntrimmed, 'Untrim changes only the selected trim metadata');
  await snapshot('04-intentional-untrim');
  phase = 'public Reverse after intentional Untrim';
  await panel().getByRole('button', { name: 'Reverse', exact: true }).click(); await changed(untrimmed);
  const reversed = await doc(), added = reversed.direct.objects.filter(o => !untrimmed.direct.objects.some(old => old.id === o.id));
  assert.equal(added.length, 1); assert.ok(!added[0].hidden && !added[0].trims?.length);
  assert.equal(byId(reversed, 'obj_1').hidden, true); assert.ok(!byId(reversed, 'obj_1').trims);
  assert.deepEqual(reversed.nodes, trimmed.nodes); await snapshot('05-untrimmed-reverse');
  await undo(untrimmed, '06-undo-reverse'); await undo(trimmed, '07-undo-untrim-restores-exact-loops');
  await redo(untrimmed, '08-redo-untrim'); await redo(reversed, '09-redo-reverse');

  phase = 'positive public Export IGES'; await dismissNotice();
  assert.ok((await doc()).direct.objects.filter(o => !o.hidden).every(o => !o.trims?.length));
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export IGES', exact: true }).click()]);
  const igesFile = join(output, 'intentional-untrim.igs'); await download.saveAs(igesFile);
  const igesBytes = await readFile(igesFile); assert.ok(igesBytes.length > 0);
  // Public built Kernel parser reads actual downloaded bytes; separate from browser state checks.
  const parsed = importIGES(igesBytes.toString('utf8'), { sourceId: 'd336', modelName: 'd336', idPrefix: 'd336', maximumEntities: 16, maximumRecords: 8192 });
  assert.equal(parsed.report.surfaceCount, 2); assert.equal(parsed.report.curveCount, 0);
  await writeFile(join(output, 'positive-iges-reimport-report.json'), JSON.stringify(parsed.report, null, 2));
  report.files.push({ file: igesFile, sha256: hash(igesBytes), bytes: igesBytes.length, publicKernelReimport: true, surfaces: parsed.report.surfaceCount,
    scope: 'Successful import of two intentionally untrimmed visible surfaces; no trim preservation claim' });
  await same(reversed); await snapshot('10-positive-iges');
  const finalSaved = await save('intentional-untrim-reversed'); await freshOpen(finalSaved, '11-final-native-roundtrip');
  assert.deepEqual(byId((await doc()), 'obj_1'), byId(reversed, 'obj_1'));
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1;
  if (page) { try { await snapshot('failure'); } catch (captureError) { report.captureFailure = captureError.stack ?? String(captureError); } }
} finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) {
    if (!resource) continue;
    try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); }
    catch (error) { report.cleanup.push({ resource: label, error: error.stack ?? String(error) });
      if (report.status !== 'FAIL') { report.status = 'FAIL'; report.failure = `Cleanup ${label}: ${error.stack ?? String(error)}`; process.exitCode = 1; } }
  }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
