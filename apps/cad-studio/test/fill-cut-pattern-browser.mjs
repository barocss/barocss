// D335: one native Chrome WebGPU browser, serial contexts. Public controls mutate;
// development hooks observe only. Run only against a frozen qualified source capsule.
// D335_RESUME_FILE=/absolute/accepted.bcad runs only the source-sketch / snapshot replacement tail.
// PW_DIR=/absolute/playwright CHROME=/absolute/chrome node test/fill-cut-pattern-browser.mjs /absolute/artifacts
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
const report = { status: 'RUNNING', mode: 'FULL_FLOW', profiles: 1, backend: 'webgpu', states: [], errors: [], consoleErrors: [], changes: [], files: [], cleanup: [] };
let phase = 'seed generation', server, browser, context, page;
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const region = [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]];
const editedRegion = [[4, 4], [52, 4], [52, 20], [16, 20], [16, 36], [4, 36]];
// Independent stock-minus-disjoint-prisms arithmetic from /tmp/d335-plan oracle.
const expected = {
  seed: { volume: 23850, centroid: [9583 / 318, 6383 / 318, 5] },
  base: { volume: 22500, centroid: [4559 / 150, 607 / 30, 5] },
  spacing: { volume: 22800, centroid: [61 / 2, 765 / 38, 5] },
  replacement: { volume: 22650, centroid: [9159 / 302, 6127 / 302, 5] },
};
const generator = `import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part } from '../../packages/barocss-cad-model/src/api/index.ts';
const seed = part('Fill cut seed').box({w:60,d:40,h:10})
  .subtract(p => p.box({w:3,d:5,h:10,x:7,y:6}));
assert.ok(Math.abs(seed.mass({density:1}).volume - 23850) < 1e-7);
assert.ok(!seed.doc.nodes.some(n => n.kind === 'fill-feature-pattern'));
writeFileSync(process.argv[2], JSON.stringify(seed.doc,null,2)+'\\n');`;
const resumeFile = process.env.D335_RESUME_FILE;
if (resumeFile) assert.equal(resolve(resumeFile), resumeFile, 'D335_RESUME_FILE must be absolute');
report.mode = resumeFile ? 'RESUME_REGION_TAIL' : 'FULL_FLOW';
const hud = () => page.getByRole('dialog', { name: 'Fill cut pattern', exact: true });
const editor = () => page.locator('.node-editor');
const sketchPanel = () => page.getByRole('complementary', { name: 'Sketch', exact: true });
const doc = () => page.evaluate(() => window.__studioDoc);
async function ready(key = null) {
  await page.waitForFunction(e => {
    const s = window.__studioBodies?.();
    return window.__studioFresh === true && s?.fresh && s.massReady && (!e || s.bodies.length === 1 &&
      Math.abs(s.bodies[0].volume - e.volume) < 1e-7 && s.bodies[0].centroid?.every((v, i) => Math.abs(v - e.centroid[i]) < 1e-7));
  }, key ? expected[key] : null, { timeout: 60000 });
}
async function waitDocChange(before) {
  await page.waitForFunction(before => JSON.stringify(window.__studioDoc) !== before, JSON.stringify(before), { timeout: 60000 });
}
async function same(before, key) {
  await page.waitForFunction(before => JSON.stringify(window.__studioDoc) === before, JSON.stringify(before), { timeout: 60000 });
  await ready(key); assert.deepEqual(await doc(), before);
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(),
    hud: document.querySelector('.hud')?.textContent, editor: document.querySelector('.node-editor')?.textContent,
    feedback: [...document.querySelectorAll('.toast')].map(e => e.textContent) }), label);
  report.states.push(state); await persist(); await page.screenshot({ path: join(output, `${label}.png`) }); return state;
}
async function freshPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e)));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function command(label) {
  await page.keyboard.press('Space'); await page.locator('.palette input').fill(label); await page.keyboard.press('Enter');
}
async function selectBody() { await ready(); await page.locator('.outliner .ol:not(.ol-step)').first().click(); }
async function save(label) {
  await ready(); const before = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file);
  const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), before, 'native file semantic equality');
  report.files.push({ file, sha256: hash(bytes), semanticEquality: true, byteIdentityClaim: false }); return { file, doc: before };
}
async function freshOpen(saved, key, label) {
  await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', saved.file);
  await same(saved.doc, key); await snapshot(label);
}
async function openEditor(index) {
  const node = (await doc()).nodes[index];
  if (node.kind === 'sketch') await page.getByRole('group', { name: 'History', exact: true }).getByRole('button', { name: `Sketch ${index + 1}`, exact: true }).click();
  else await page.locator(`.history .hs[data-node-index="${index}"]`).click();
  await editor().waitFor();
}
function assertHint(text) {
  assert.match(text, /snapshot/i); assert.match(text, /Editing the source sketch does not change this pattern/);
  assert.match(text, /A cut may cross the region boundary/);
}
async function configure(sketchIndex) {
  await hud().getByLabel('Region snapshot', { exact: true }).selectOption(String(sketchIndex));
  for (const [label, value] of [['Reference X', 8.5], ['Reference Y', 8.5], ['X spacing', 12], ['Columns', 4], ['Y spacing', 10], ['Rows', 3]])
    await hud().getByLabel(label, { exact: true }).fill(String(value));
}
async function previewStatus(status) {
  await page.waitForFunction(s => document.querySelector('.hud .status')?.textContent === s, status, { timeout: 60000 });
}
function sketchPoints(node) {
  assert.equal(node.kind, 'sketch'); assert.equal(node.profile, 'loop'); assert.equal(node.segments.length, 6);
  assert.ok(node.segments.every(s => s.kind === 'line')); assert.ok(!node.holes?.length && !node.regions?.length);
  return node.segments.map(s => s.start);
}
async function finishSketch(before) {
  await page.locator('.topbar button.finish').click();
  await waitDocChange(before); await sketchPanel().waitFor({ state: 'hidden' });
}
async function assertEditable(index, spacing2, points) {
  await openEditor(index); assertHint(await editor().textContent());
  for (const [label, value] of [['Reference X', 8.5], ['Reference Y', 8.5], ['X spacing', 12], ['Columns', 4], ['Y spacing', spacing2], ['Rows', 3]])
    assert.equal(await editor().getByLabel(label, { exact: true }).inputValue(), String(value));
  assert.equal(await editor().getByLabel('Region snapshot', { exact: true }).inputValue(), '');
  assert.equal(await editor().getByLabel('Region snapshot', { exact: true }).locator('option:checked').textContent(), 'Current region snapshot');
  assert.deepEqual((await doc()).nodes[index].region, { points });
}
async function applyEditor(before, key) {
  await editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await waitDocChange(before); await ready(key); await editor().waitFor({ state: 'hidden' });
}
try {
  let sketchIndex, index, feature;
  const seedFile = join(output, 'seed.bcad');
  if (!resumeFile) {
  const built = await build({ stdin: { contents: generator, resolveDir: app, sourcefile: 'fill-cut-seed.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
  const bundle = join(output, 'seed-generator.mjs');
  await writeFile(join(output, 'seed-generator.ts'), generator); await writeFile(bundle, built.outputFiles[0].contents);
  await writeFile(join(output, 'seed-metafile.json'), JSON.stringify(built.metafile, null, 2));
  const run = spawnSync(process.execPath, [bundle, seedFile], { encoding: 'utf8' });
  await writeFile(join(output, 'seed.stdout.txt'), run.stdout ?? ''); await writeFile(join(output, 'seed.stderr.txt'), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
  report.seed = { file: seedFile, sha256: hash(await readFile(seedFile)), generatorSHA256: hash(generator), bundleSHA256: hash(built.outputFiles[0].contents) };
  }
  phase = 'actual Studio start';
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  server.watcher.on('change', file => report.changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
  if (resumeFile) {
    phase = 'public Open accepted ten-cut prefix for region tail';
    const bytes = await readFile(resumeFile), source = JSON.parse(bytes);
    index = source.nodes.length - 1; feature = source.nodes[index];
    sketchIndex = source.nodes.findLastIndex(node => node.kind === 'sketch');
    assert.equal(feature.kind, 'fill-feature-pattern'); assert.equal(feature.count, 4); assert.equal(feature.count2, 3);
    assert.equal(feature.spacing, 12); assert.equal(feature.spacing2, 10); assert.deepEqual(feature.anchor, [8.5, 8.5]);
    assert.deepEqual(feature.region, { points: region }); assert.deepEqual(sketchPoints(source.nodes[sketchIndex]), region);
    report.resume = { file: resumeFile, sha256: hash(bytes), prefix: 'NOT_RERUN: original creation/refusal/edit/native-file receipt is retained separately' };
    report.sketchIndex = sketchIndex; report.featureId = feature.id; report.parent = feature.parent;
    await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', resumeFile); await same(source, 'base'); await snapshot('resume-ten-cut-prefix');
  } else {
  await freshPage(); await page.setInputFiles('input[aria-label="Model file"]', seedFile); await ready('seed'); await snapshot('01-seed');

  phase = 'public closed L sketch';
  await page.keyboard.press('Escape'); const beforeSketch = await doc();
  await command('Sketch'); await sketchPanel().waitFor();
  await page.getByRole('button', { name: 'Line', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const point of [...region, region[0]]) {
    const pixel = await page.evaluate(p => window.__studioScreenOf(p), [...point, 0]);
    assert.ok(pixel, 'world point projects into sketch'); await page.mouse.click(pixel[0], pixel[1]);
  }
  // Public dimensions eliminate screen projection / snapping error. H/V constraints propagate paired axes.
  for (const [i, point] of region.entries()) for (const [axis, value] of point.entries())
    await sketchPanel().getByLabel(`Point ${i + 1} ${'XY'[axis]}`, { exact: true }).fill(String(value));
  await finishSketch(beforeSketch); await ready('seed');
  const withRegion = await doc(); sketchIndex = withRegion.nodes.length - 1;
  assert.equal(withRegion.nodes.length, beforeSketch.nodes.length + 1, 'Finish stores only the standalone region sketch');
  assert.deepEqual(sketchPoints(withRegion.nodes[sketchIndex]), region);
  report.sketchIndex = sketchIndex; await snapshot('02-authored-L');

  phase = 'preview candidate-product refusal and Cancel';
  await selectBody(); await command('Fill cut pattern'); await hud().waitFor(); await configure(sketchIndex);
  await previewStatus('preview'); assertHint(await hud().textContent());
  assert.deepEqual(await doc(), withRegion, 'valid preview does not mutate accepted document'); await snapshot('03-preview');
  await hud().getByLabel('Columns', { exact: true }).fill('22');
  await previewStatus('refused');
  const refused = await snapshot('04-product-refused'); assert.deepEqual(refused.doc, withRegion);
  assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true);
  assert.match(refused.hud, /64|cop|candidate|product/i);
  await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await same(withRegion, 'seed');

  phase = 'valid repair Apply Undo Redo';
  await selectBody(); await command('Fill cut pattern'); await hud().waitFor(); await configure(sketchIndex); await previewStatus('preview');
  await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await waitDocChange(withRegion); await ready('base');
  const accepted = await doc(); index = accepted.nodes.length - 1; feature = accepted.nodes[index];
  assert.equal(feature.kind, 'fill-feature-pattern'); assert.deepEqual(feature.region, { points: region });
  assert.deepEqual(feature.anchor, [8.5, 8.5]); assert.equal(accepted.nodes[feature.parent.node].kind, 'difference');
  assert.ok(feature.id, 'stable feature identity'); assert.ok(!JSON.stringify(feature.region).includes('objectId'));
  report.featureId = feature.id; report.parent = feature.parent; await snapshot('05-ten-cuts-applied');
  await page.keyboard.press('Meta+z'); await same(withRegion, 'seed'); await snapshot('06-undo');
  await page.keyboard.press('Meta+Shift+z'); await same(accepted, 'base'); await snapshot('07-redo');
  phase = 'Save fresh Open editable snapshot';
  const saved = await save('accepted'); await freshOpen(saved, 'base', '08-fresh-open');
  await assertEditable(index, 10, region);

  phase = 'separate Y spacing edit';
  const beforeSpacing = await doc(); await editor().getByLabel('Y spacing', { exact: true }).fill('12');
  await applyEditor(beforeSpacing, 'spacing');
  const spaced = await doc(); assert.equal(spaced.nodes[index].spacing2, 12);
  assert.equal(spaced.nodes[index].id, feature.id); assert.deepEqual(spaced.nodes[index].parent, feature.parent);
  assert.deepEqual(spaced.nodes[index].region, feature.region); await snapshot('09-eight-cuts-Y-spacing');
  await page.keyboard.press('Meta+z'); await same(accepted, 'base');

  }
  phase = 'source sketch edit retains accepted snapshot and mass';
  await openEditor(sketchIndex); await editor().getByRole('button', { name: 'Edit sketch', exact: true }).click(); await sketchPanel().waitFor();
  const beforeSource = await doc(); await sketchPanel().getByLabel('Point 4 X', { exact: true }).fill('16');
  await finishSketch(beforeSource); await ready('base');
  const sourceEdited = await doc(); assert.deepEqual(sketchPoints(sourceEdited.nodes[sketchIndex]), editedRegion);
  assert.deepEqual(sourceEdited.nodes[index], feature, 'source edit leaves captured snapshot recipe unchanged');
  await snapshot('10-source-edit-snapshot-unchanged');

  phase = 'explicit region snapshot reselection';
  await assertEditable(index, 10, region);
  await editor().getByLabel('Region snapshot', { exact: true }).selectOption(String(sketchIndex));
  await applyEditor(sourceEdited, 'replacement');
  const replaced = await doc(); assert.equal(replaced.nodes[index].id, feature.id);
  assert.deepEqual(replaced.nodes[index].parent, feature.parent); assert.deepEqual(replaced.nodes[index].region, { points: editedRegion });
  await snapshot('11-nine-cuts-new-snapshot');
  await page.keyboard.press('Meta+z'); await same(sourceEdited, 'base');
  await page.keyboard.press('Meta+Shift+z'); await same(replaced, 'replacement'); await snapshot('12-replacement-redo');
  phase = 'final native Save fresh Open editable fields';
  const finalSaved = await save('region-reselected'); await freshOpen(finalSaved, 'replacement', '13-final-fresh-open');
  await assertEditable(index, 10, editedRegion); await snapshot('14-final-editable');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.stack ?? String(error);
  if (page) { try { await snapshot('failure'); } catch { /* Preserve the original failure. */ } }
  process.exitCode = 1;
} finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) {
    if (!resource) continue;
    try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); }
    catch (error) {
      report.cleanup.push({ resource: label, error: error.stack ?? String(error) });
      if (report.status !== 'FAIL') { report.status = 'FAIL'; report.failure = `Cleanup ${label}: ${error.stack ?? String(error)}`; process.exitCode = 1; }
    }
  }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
