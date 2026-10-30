// D333 bounded rectangular cut pattern: one actual WebGPU Studio flow, serial fresh contexts.
// PW_DIR=/absolute/playwright CHROME=/absolute/chrome node test/rectangular-cut-pattern-browser.mjs /absolute/artifacts
// Optional D333_RESUME_FILE=/absolute/accepted.bcad reuses the saved 3×2 prefix and runs only the edit/file tail.
// Seed generation uses the existing public Model API. Dev hooks observe; public controls perform all Studio edits.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createServer } from 'vite';

assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2]); await mkdir(output, { recursive: true });
assert.ok(process.env.D333_RESUME_FILE === undefined || isAbsolute(process.env.D333_RESUME_FILE), 'D333_RESUME_FILE must be an absolute path');
const resumePath = process.env.D333_RESUME_FILE;
const states = [], errors = [], consoleErrors = [], changes = [];
const cleanup = { contexts: [], browser: 'NOT_STARTED', server: 'NOT_STARTED' };
let phase = 'public API seed generation', server, browser, context, page;
const report = { status: 'RUNNING', profiles: 1, backend: 'webgpu', mode: resumePath ? 'RESUME_EDIT_TAIL' : 'FULL_FLOW', prefix: resumePath ? 'NOT_RERUN_REUSE_ORIGINAL_RECEIPT' : 'RUN_IN_THIS_RECEIPT', states, errors, consoleErrors, changes, cleanup,
  limits: ['One bounded rectangular cut grid', 'Preview screenshot and HUD status; accepted mass is not preview mass', 'UI bounds are displayed extents, not an independent B-rep topology oracle', 'No curve/fill family, rendering matrix or release acceptance'] };
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const producerTest = resolve(app, '../../packages/barocss-cad-model/test/api-rectangular-feature-pattern.test.ts');
const generatorSource = `import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { part, Location } from '../../packages/barocss-cad-model/src/api/index.ts';
import { bindParameter } from '../../packages/barocss-cad-model/src/engine/parameters.ts';
const source = part('rectangular pattern seed').parameter('seedX', 8).parameter('spacing', 16).parameter('spacing2', 16).parameter('copies', 3)
  .box({ w: 60, d: 40, h: 10 })
  .subtract(p => p.box({ w: 4, d: 4, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
const doc = source.doc, translated = doc.nodes.findIndex(node => node.kind === 'translate');
assert.ok(translated >= 0);
const seed = part('bound seed', bindParameter(doc, { feature: translated, value: 'o0', parameter: 'seedX' }));
assert.equal(seed.doc.nodes.at(-1).kind, 'difference');
assert.ok(!seed.doc.nodes.some(node => node.kind === 'rectangular-feature-pattern'));
assert.ok(Math.abs(seed.mass({ density: 1 }).volume - 23840) < 1e-7);
writeFileSync(process.argv[2], JSON.stringify(seed.doc, null, 2) + '\\n');
`;
const hud = () => page.getByRole('dialog', { name: 'Rectangular cut pattern', exact: true });
// Independent first moments: stock minus disjoint 4×4×10 cut prisms at authored grid centres.
function gridCentroid(count, count2, spacing2) {
  const volume = 24000 - count * count2 * 160, moment = [24000 * 30, 24000 * 20, 24000 * 5];
  for (let row = 0; row < count2; row++) for (let column = 0; column < count; column++) {
    moment[0] -= 160 * (10 + column * 16); moment[1] -= 160 * (10 + row * spacing2); moment[2] -= 160 * 5;
  }
  return moment.map(value => value / volume);
}
async function ready(volume, nodes, observation = null) {
  await page.waitForFunction(({ volume, nodes, observation }) => {
    const doc = window.__studioDoc, state = window.__studioBodies?.();
    return doc && (nodes === null || doc.nodes.length === nodes) && window.__studioFresh === true && state?.fresh && state.massReady === true &&
      (volume === null || state.bodies.length === 1 && Math.abs(state.bodies[0].volume - volume) < 1e-7) &&
      (!observation || (!observation.field || doc.nodes.at(-1)?.[observation.field] === observation.value) &&
        state.bodies[0]?.centroid?.length === 3 && state.bodies[0].centroid.every((value, axis) => Math.abs(value - observation.centroid[axis]) < 1e-7));
  }, { volume: volume ?? null, nodes: nodes ?? null, observation }, { timeout: 60000 });
}
async function freshPage() {
  if (context) { await context.close(); cleanup.contexts.push('CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack ?? String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); }); page.on('dialog', dialog => dialog.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function open(file, expected, nodes) {
  await ready(); await page.setInputFiles('input[aria-label="Model file"]', file); await ready(expected, nodes);
}
async function snapshot(label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(label => ({ label, doc: window.__studioDoc, bodies: window.__studioBodies?.(), selection: window.__studioSelection,
    backend: document.querySelector('.viewport')?.dataset.renderer,
    hud: document.querySelector('.hud')?.textContent ?? null, hudStatus: document.querySelector('.hud .status')?.textContent ?? null,
    shownMesh: window.__studioSection?.(), inspector: document.querySelector('[aria-label="Selection"]')?.textContent ?? null,
    editor: document.querySelector('.node-editor')?.textContent ?? null,
    feedback: [...document.querySelectorAll('.toast')].map(element => element.textContent) }), label);
  states.push(state); await persist(); await page.screenshot({ path: join(output, `${label}.png`) }); return state;
}
async function selectBody() {
  await ready();
  const body = page.locator('.outliner .ol:not(.ol-step)').first();
  if (!(await page.evaluate(() => window.__studioSelection?.selection.bodies.length === 1))) await body.click();
  await page.waitForFunction(() => window.__studioSelection?.selection.bodies.length === 1);
  await page.waitForFunction(() => /Bounds\s*60\s*×\s*40\s*×\s*10/.test(document.querySelector('[aria-label="Selection"]')?.textContent ?? ''));
}
async function command() {
  await selectBody(); await page.keyboard.press('Space'); await page.locator('.palette input').fill('Rectangular cut pattern'); await page.keyboard.press('Enter'); await hud().waitFor();
}
async function preview() {
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'preview', null, { timeout: 60000 });
  assert.equal(await hud().getByLabel('First direction', { exact: true }).inputValue(), 'x');
  assert.equal(await hud().getByLabel('Second direction', { exact: true }).inputValue(), 'y');
  for (const [label, expected] of [['First spacing', '16'], ['First count', '3'], ['Second spacing', '16'], ['Second count', '2']]) assert.equal(await hud().getByLabel(label, { exact: true }).inputValue(), expected);
}
async function refusal(label, original, expression) {
  await page.waitForFunction(() => document.querySelector('.hud .status')?.textContent === 'refused', null, { timeout: 30000 });
  const state = await snapshot(label); assert.deepEqual(state.doc, original);
  assert.match(state.hud, expression); assert.equal(await hud().getByRole('button', { name: 'Apply', exact: true }).isDisabled(), true);
  assert.equal(state.bodies.bodies.length, 1); assert.ok(Math.abs(state.bodies.bodies[0].volume - 23840) < 1e-7);
}
async function save(label) {
  await ready(); const before = await page.evaluate(() => window.__studioDoc);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file), doc = JSON.parse(bytes);
  assert.deepEqual(doc, before); report.files ??= []; report.files.push({ file, sha256: hash(bytes) }); return { file, doc };
}
async function edit(label, value, expectedVolume) {
  await ready(); const before = await page.evaluate(() => window.__studioDoc), index = before.nodes.length - 1;
  await page.locator(`.history .hs[data-node-index="${index}"]`).click();
  await page.locator('.node-editor').getByLabel(label, { exact: true }).fill(String(value));
  const key = label === 'Second spacing' ? 'spacing2' : 'count';
  const next = { ...before.nodes.at(-1), [key]: value }, centroid = gridCentroid(next.count, next.count2, next.spacing2);
  report.editOracles ??= []; report.editOracles.push({ field: key, value, expectedVolume, expectedCentroid: centroid,
    basis: 'Independent stock first moments minus disjoint authored 4×4×10 cut prisms; volume and centroid tolerance 1e-7' }); await persist();
  await page.locator('.node-editor').getByRole('button', { name: 'Apply', exact: true }).click();
  await ready(expectedVolume, before.nodes.length, { field: key, value, centroid });
  // Applying a feature edit closes this editor in the actual Studio commit path.
  await page.waitForSelector('.node-editor', { state: 'hidden' });
  const after = await snapshot(`edit-${label.replaceAll(' ', '-').toLowerCase()}`), node = after.doc.nodes.at(-1), original = before.nodes.at(-1);
  assert.deepEqual(after.doc.nodes.slice(0, -1), before.nodes.slice(0, -1)); assert.deepEqual(after.doc.parameters, before.parameters);
  assert.equal(node.id, original.id); assert.deepEqual(node.parent, original.parent);
  assert.equal(node[key], value); assert.equal(after.editor, null);
  const { [key]: oldValue, ...oldFields } = original, { [key]: newValue, ...newFields } = node;
  assert.notEqual(oldValue, newValue); assert.deepEqual(newFields, oldFields);
  await selectBody(); return after;
}
async function editTail() {
  phase = 'public History/NodeEditor second spacing edit'; await edit('Second spacing', 12, 23040);
  phase = 'public History/NodeEditor first count edit'; const edited = await edit('First count', 2, 23360);
  phase = 'Save edited pattern and fresh Open'; const editedFile = await save('edited'); await freshPage(); await open(editedFile.file, 23360, edited.doc.nodes.length); await ready(23360, edited.doc.nodes.length, { centroid: gridCentroid(2, 2, 12) }); await selectBody(); const final = await snapshot('10-edited-fresh-open'); assert.deepEqual(final.doc.nodes, edited.doc.nodes); assert.deepEqual(final.doc.parameters, edited.doc.parameters);
  await page.locator(`.history .hs[data-node-index="${final.doc.nodes.length - 1}"]`).click();
  assert.equal(await page.locator('.node-editor').getByLabel('Second spacing', { exact: true }).inputValue(), '12'); assert.equal(await page.locator('.node-editor').getByLabel('First count', { exact: true }).inputValue(), '2'); await snapshot('11-reeditable');
}
try {
  let seed, seedFile, resumeDoc;
  if (resumePath) {
    const bytes = await readFile(resumePath); resumeDoc = JSON.parse(bytes);
    const pattern = resumeDoc.nodes?.at(-1);
    assert.equal(pattern?.kind, 'rectangular-feature-pattern');
    for (const [key, value] of Object.entries({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 })) assert.equal(pattern[key], value, `resume ${key}`);
    assert.equal(resumeDoc.nodes[pattern.parent.node]?.kind, 'difference');
    report.resumeInput = { file: resumePath, sha256: hash(bytes), nodeCount: resumeDoc.nodes.length, prefix: 'NOT_RERUN',
      expectedCentroid: gridCentroid(3, 2, 16), reusedPrefix: 'Original creation/refusal/Cancel/Apply/Undo/Redo/Save/fresh Open receipt remains separate' };
  } else {
    const generated = await build({ stdin: { contents: generatorSource, resolveDir: app, sourcefile: 'rectangular-cut-seed.ts', loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
    const sourceFile = join(output, 'seed-generator.ts'), bundleFile = join(output, 'seed-generator.mjs'); seedFile = join(output, 'seed.bcad');
    await writeFile(sourceFile, generatorSource); await writeFile(bundleFile, generated.outputFiles[0].contents);
    await writeFile(join(output, 'seed-generator-metafile.json'), JSON.stringify(generated.metafile, null, 2));
    const run = spawnSync(process.execPath, [bundleFile, seedFile], { encoding: 'utf8' });
    await writeFile(join(output, 'seed-generator.stdout.txt'), run.stdout ?? ''); await writeFile(join(output, 'seed-generator.stderr.txt'), run.stderr ?? ''); assert.equal(run.status, 0, run.stderr);
    const seedBytes = await readFile(seedFile); seed = JSON.parse(seedBytes);
    report.seed = { file: seedFile, sha256: hash(seedBytes), sourceFile, generatorSHA256: hash(generatorSource), bundleSHA256: hash(generated.outputFiles[0].contents),
      producerReference: producerTest, producerReferenceSHA256: hash(await readFile(producerTest)), nodeCount: seed.nodes.length,
      construction: 'Existing public part/Location seed recipe, seedX bound through existing bindParameter; pattern not generated before Studio' };
  }
  await persist(); phase = 'start actual Studio';
  server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  cleanup.server = 'OPEN'; server.watcher.on('change', file => changes.push(file)); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); cleanup.browser = 'OPEN';
  await freshPage();
  if (resumePath) {
    phase = 'public Open original accepted prefix for edit-tail resume';
    await open(resumePath, 23040, resumeDoc.nodes.length); await ready(23040, resumeDoc.nodes.length, { centroid: gridCentroid(3, 2, 16) }); await selectBody();
    const reopened = await snapshot('resume-original-accepted'); assert.deepEqual(reopened.doc.nodes, resumeDoc.nodes); assert.deepEqual(reopened.doc.parameters, resumeDoc.parameters);
  } else {
    phase = 'public Open API-generated seed'; await open(seedFile, 23840, seed.nodes.length); await selectBody(); const initial = await snapshot('01-open-seed'); assert.deepEqual(initial.doc.nodes, seed.nodes); assert.deepEqual(initial.doc.parameters, seed.parameters);
    phase = 'public valid preview leaves accepted seed unchanged'; await command(); await preview(); const shown = await snapshot('02-valid-preview'); assert.deepEqual(shown.doc, initial.doc);
    phase = 'same-axis refusal then Cancel'; await hud().getByLabel('Second direction', { exact: true }).selectOption('x'); await refusal('03-same-axis-refused', initial.doc, /different global directions/);
    await hud().getByRole('button', { name: 'Cancel', exact: true }).click(); await ready(23840, seed.nodes.length); const cancelled = await snapshot('03b-cancel-preserves-seed'); assert.deepEqual(cancelled.doc, initial.doc);
    phase = 'count product refusal then valid repair'; await command(); await preview(); await hud().getByLabel('First count', { exact: true }).fill('33'); await refusal('04-product-refused', initial.doc, /product.*at most 64/);
    await hud().getByLabel('First count', { exact: true }).fill('3'); await preview(); const repairedPreview = await snapshot('05-repaired-preview'); assert.deepEqual(repairedPreview.doc, initial.doc);
    phase = 'public Apply one rectangular cut pattern'; await hud().getByRole('button', { name: 'Apply', exact: true }).click(); await ready(23040, seed.nodes.length + 1); await selectBody(); const accepted = await snapshot('06-applied');
    const pattern = accepted.doc.nodes.at(-1); assert.equal(pattern.kind, 'rectangular-feature-pattern'); assert.deepEqual(pattern.parent, { node: seed.nodes.length - 1, side: 'solid' });
    for (const [key, value] of Object.entries({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 })) assert.equal(pattern[key], value);
    assert.deepEqual(accepted.doc.nodes.slice(0, -1), initial.doc.nodes); assert.deepEqual(accepted.doc.parameters, initial.doc.parameters);
    phase = 'public Undo and Redo'; await page.keyboard.press('Meta+z'); await ready(23840, seed.nodes.length); const undo = await snapshot('07-undo'); assert.deepEqual(undo.doc.nodes, initial.doc.nodes);
    await page.keyboard.press('Meta+Shift+z'); await ready(23040, seed.nodes.length + 1); const redo = await snapshot('08-redo'); assert.deepEqual(redo.doc.nodes, accepted.doc.nodes);
    phase = 'Save and fresh context Open'; const saved = await save('accepted'); await freshPage(); await open(saved.file, 23040, accepted.doc.nodes.length); await selectBody(); const reopened = await snapshot('09-fresh-open'); assert.deepEqual(reopened.doc.nodes, accepted.doc.nodes); assert.deepEqual(reopened.doc.parameters, accepted.doc.parameters);
  }
  await editTail();
  assert.equal(errors.length, 0, 'no page exception'); assert.equal(changes.length, 0, 'source must remain frozen'); report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.firstFailure = { phase, message: error.message, stack: error.stack }; if (page && !page.isClosed()) await snapshot('failure').catch(() => {}); process.exitCode = 1;
} finally {
  for (const [kind, resource] of [['context', context], ['browser', browser], ['server', server]]) {
    if (!resource) continue;
    try { await resource.close(); if (kind === 'context') cleanup.contexts.push('CLOSED'); else cleanup[kind] = 'CLOSED'; }
    catch (error) { report.status = 'FAIL'; cleanup[kind] = { status: 'CLOSE_FAILED', message: error.message }; process.exitCode = 1; report.firstFailure ??= { phase: `cleanup ${kind}`, message: error.message }; }
  }
  await persist();
}
process.stdout.write(JSON.stringify({ status: report.status, phase, output, cleanup, firstFailure: report.firstFailure }, null, 2) + '\n');
