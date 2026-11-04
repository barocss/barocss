// D421: prepare STEP in memory and report header/product name replacement; no download.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and prepared native fixture folders are required');
const input = resolve(process.argv[3]);
const unicodeFile = join(input, '부품.bcad'), asciiFile = join(input, 'plate A_1.bcad');
const expectedDoc = JSON.parse(await readFile(unicodeFile, 'utf8'));
assert.deepEqual(JSON.parse(await readFile(asciiFile, 'utf8')), expectedDoc);
const nameLoss = 'Non-ASCII and control characters in the STEP header file name and product name are replaced with underscores.';
const f = await createFlow({
  name: 'step-name-loss', envFrozen: 'STEP_NAME_LOSS_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D421_STEP_NAME_LOSS_REPORT',
  inspectorSource: "export { exportStudioStep } from '@barocss/cad-model/engine/evaluate';", // Build graph for source freezing only; no inspector assertion.
  initialFiles: ['apps/cad-studio/test/step-name-loss-browser.mjs', unicodeFile, asciiFile],
  requiredFrozen: ['packages/barocss-cad-model/src/engine/evaluate.ts', 'packages/barocss-cad/src/io/step.ts', 'apps/cad-studio/src/files/stepExportPreparation.ts', 'apps/cad-studio/src/files/StepExportPanel.tsx'],
  limits: [
    'Existing native imported box and in-memory STEP preparation only; no new Unicode codec or geometry behavior.',
    'The raw intended download basename is shown unchanged. STEP header file/product names use the existing underscore replacement. Actual outbound download filename acceptance is NOT_RUN.',
    'Korean name plus printable ASCII control; Latin/control/quote/backslash cases are focused real-Model tests, not additional actual UI states.',
    'No Save, outbound Export, downloads, OCP, paid calls or broad format acceptance.',
  ],
});
async function open(file, name) {
  await f.page.setInputFiles('input[aria-label="Model file"]', file);
  await f.page.waitForFunction(expected => document.querySelector('.doc-tab input')?.value === expected, name, { timeout: 60000 });
  assert.equal(await f.page.getByLabel('File name', { exact: true }).inputValue(), name);
  await f.same(expectedDoc);
  const bodies = await f.bodies();
  assert.equal(bodies.bodies.length, 1);
  assert.ok(Math.abs(bodies.bodies[0].volume - 24) <= 1e-9);
}
async function prepare(name, encoded, label, expectedLosses) {
  const before = await f.doc();
  const replies = await f.page.evaluate(() => window.__d421StepReplies.length);
  await f.page.getByRole('button', { name: 'Export STEP', exact: true }).click();
  const panel = f.page.getByRole('region', { name: 'STEP export', exact: true });
  await panel.waitFor({ state: 'visible' });
  await f.page.waitForFunction(previous => window.__d421StepReplies.length > previous &&
    document.querySelector('[aria-label="STEP export"] button.primary')?.disabled === false, replies, { timeout: 60000 });
  await panel.getByText(`${name}.step`, { exact: true }).waitFor({ state: 'visible' });
  const result = await f.page.evaluate(() => window.__d421StepReplies.at(-1));
  assert.deepEqual(result.omitted ?? [], expectedLosses);
  assert.ok(result.text.includes(`PRODUCT('${encoded}','${encoded}'`));
  assert.ok(result.text.includes(`FILE_NAME('${encoded}.step'`));
  if (expectedLosses.length) await panel.getByText(nameLoss, { exact: true }).waitFor({ state: 'visible' });
  else {
    await panel.getByText('No additional losses reported for this input.', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await panel.getByText(nameLoss, { exact: true }).count(), 0);
  }
  assert.equal(result.source, 'b46faf1dcfd84471');
  await f.same(before);
  await writeFile(join(f.output, `${label}-prepared.step`), result.text);
  f.report.observations.push({ label, intendedDownloadBaseName: name, serializedHeaderBaseName: encoded,
    preparedSha256: sha256(result.text), source: result.source, losses: result.omitted ?? [], exactDocumentUnchanged: true, download: 'NOT_RUN' });
  await f.snapshot(label);
  return panel;
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.addInitScript(() => {
      const RealWorker = window.Worker;
      window.__d421StepReplies = [];
      window.Worker = class extends RealWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', event => {
            if (typeof event.data?.step?.text === 'string') window.__d421StepReplies.push(event.data.step);
          });
        }
      };
    });
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  f.phase = 'Open Korean basename and prepare explicit header/product replacement loss';
  await open(unicodeFile, '부품');
  const unicode = await prepare('부품', '__', '01-korean-name-loss', [nameLoss]);
  await unicode.getByRole('button', { name: 'Cancel', exact: true }).click();
  await unicode.waitFor({ state: 'hidden' });
  await f.same(expectedDoc);
  f.phase = 'Open ASCII basename and prepare unchanged name/loss control';
  await open(asciiFile, 'plate A_1');
  const ascii = await prepare('plate A_1', 'plate A_1', '02-ascii-name-control', []);
  await ascii.getByRole('button', { name: 'Close STEP export', exact: true }).focus();
  await f.page.keyboard.press('Escape');
  await ascii.waitFor({ state: 'hidden' });
  await f.same(expectedDoc);
  f.report.fontNetwork = fonts;
  assert.equal(fonts.assets, 0);
  assert.equal(f.report.downloads.length, 0);
});
