// Deferred *real* browser/physical-file acceptance for #1867.
// CI checks syntax/source contracts only. Run this script in an eligible
// Node 22 + Playwright/Chromium + WebGL host; never infer GPU PASS from CI.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const repo = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const port = Number(option('--port', '52386'));
const evidence = resolve(option('--evidence', '/tmp/barocss-cad-top-pocket-browser'));
const headed = args.includes('--headed');
assert.ok(Number.isInteger(port) && port > 1024 && port <= 65535);
mkdirSync(evidence, { recursive: true });
const sha = data => createHash('sha256').update(data).digest('hex');
const git = (...values) => execFileSync('git', values, { cwd: repo, encoding: 'utf8' }).trim();
const receipt = {
  schema: 'cad-top-pocket-browser-v1', head: git('rev-parse', 'HEAD'),
  dirty: git('status', '--porcelain'), node: process.version,
  browser: null, port, headed, stages: [], screenshots: [],
  pageErrors: [], result: 'running', evidenceTier: 'real-browser-pending'
};
const write = () => writeFileSync(join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
let server = null, browser = null, firstContext = null, coldContext = null, active = null;
let serverOut = '';
const step = (name, properties = {}) => { receipt.stages.push({ name, ...properties }); write(); };
async function settle(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('section[aria-label="CAD model editor"]');
    const status = root?.querySelector(':scope > p[role="status"]')?.textContent;
    return status === 'Accepted model';
  }, null, { timeout: 120000 });
}
const partVolume = page => page.evaluate(() => {
  const root = document.querySelector('section[aria-label="CAD model editor"]');
  const row = [...(root?.querySelectorAll('dl > div') ?? [])].find(x => x.querySelector('dt')?.textContent === 'part');
  return row?.querySelector('dd')?.textContent ?? null;
});
const visible = page => page.locator('section[aria-label="CAD model editor"]').getByRole('status').filter({ hasText: 'Visible:' }).textContent();
async function screenshot(page, stage) {
  const path = join(evidence, stage + '.png');
  const bytes = await page.screenshot({ path });
  const canvas = await page.locator('section[aria-label="CAD model editor"] canvas').first().evaluate(el => ({
    width: el.width, height: el.height, clientWidth: el.clientWidth, clientHeight: el.clientHeight
  }));
  assert.ok(canvas.width > 0 && canvas.height > 0 && canvas.clientWidth > 0 && canvas.clientHeight > 0);
  receipt.screenshots.push({ stage, path, sha256: sha(bytes), bytes: bytes.length, canvas });
  write();
  // Screenshot existence is not a quantitative GPU readback certificate.
}
async function source(page) {
  const root = page.locator('section[aria-label="CAD model editor"]');
  const details = root.locator('details').filter({ has: root.getByText('Save or open a model', { exact: true }) });
  if (!(await details.evaluate(element => element.open))) await details.locator('summary').click();
  await root.getByRole('button', { name: 'Show saved model' }).click();
  return root.getByLabel('Saved model data').inputValue();
}
async function setDepth(page, value) {
  await page.getByLabel('Pocket depth downward from top Z=8 (mm)').fill(String(value));
  await page.getByRole('button', { name: 'Apply dimensions' }).click();
  await settle(page);
}
async function attach(page, bytes, name) {
  const input = page.getByRole('button', { name: 'Choose model file' });
  const chooser = page.waitForEvent('filechooser');
  await input.click();
  const modal = await chooser;
  await modal.setFiles({ name, mimeType: 'application/json', buffer: bytes });
}
async function pageSetup(page) {
  active = page;
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => { receipt.pageErrors.push(error.message); write(); });
  await page.goto('http://127.0.0.1:' + port + '/#/model');
  await settle(page);
  assert.equal(await page.getByRole('heading', { name: 'Model a part' }).count(), 1);
}
async function startServer() {
  const vite = join(repo, 'node_modules/vite/bin/vite.js');
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: join(repo, 'apps/cad-editor'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr])
    stream.on('data', chunk => { serverOut += chunk.toString(); writeFileSync(join(evidence, 'server.log'), serverOut); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error('Owned Vite exited: ' + server.exitCode);
    try { if ((await fetch('http://127.0.0.1:' + port)).ok) return; } catch {}
    await new Promise(done => setTimeout(done, 200));
  }
  throw Error('Vite did not become ready at owned port ' + port);
}
try {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw Error('Node 22 is required for this bounded acceptance');
  assert.equal(receipt.dirty, '', 'Acceptance requires a clean immutable checkout');
  let chromium;
  try {
    const module = option('--playwright-module', process.env.PLAYWRIGHT_MODULE || 'playwright');
    ({ chromium } = await import(module));
  } catch (cause) {
    receipt.result = 'UNRUN';
    receipt.reason = 'Playwright not installed/resolvable on this device: ' + String(cause);
    write();
    process.exitCode = 2;
  }
  if (chromium) {
    const launch = { headless: !headed };
    const binary = option('--chromium-path', process.env.CHROMIUM_PATH || '');
    if (binary) launch.executablePath = binary;
    try { browser = await chromium.launch(launch); }
    catch (cause) {
      receipt.result = 'UNRUN'; receipt.reason = 'Chromium unavailable on this device: ' + String(cause);
      write(); process.exitCode = 2;
    }
  }
  if (browser) {
    receipt.browser = browser.version();
    await startServer();
    firstContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
    const page = await firstContext.newPage();
    await pageSetup(page);
    await page.getByText('Modeling examples', { exact: true }).click();
    await page.getByLabel('Choose an example').selectOption('top-entry-pocket');
    await page.getByText('Replace accepted model and discard its history and pending dimensions').locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Load example' }).click();
    await settle(page);
    await page.waitForFunction(() => !!document.querySelector('select[id$="-visible-output"]'));
    assert.match(await visible(page), /Visible: part/);
    assert.equal(await partVolume(page), '5632 / 1 mm³');
    const baseline = await source(page);
    assert.deepEqual(Object.keys(JSON.parse(baseline).outputs), ['part', 'plate', 'tool']);
    step('top-pocket-preset', { partVolumeMM3: 5632, selectedOutput: 'part', sourceSHA256: sha(baseline) });
    await screenshot(page, 'baseline');
    await setDepth(page, 6);
    assert.equal(await partVolume(page), '5376 / 1 mm³');
    const edited = await source(page);
    assert.notEqual(edited, baseline);
    step('real-native-depth-4-to-6', { partVolumeMM3: 5376, sourceSHA256: sha(edited) });
    await screenshot(page, 'depth-6');

    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await settle(page);
    assert.equal(await source(page), baseline);
    assert.equal(await partVolume(page), '5632 / 1 mm³');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await settle(page);
    assert.equal(await source(page), edited);
    assert.equal(await partVolume(page), '5376 / 1 mm³');
    step('undo-redo-exact-source', { undoSHA256: sha(baseline), redoSHA256: sha(edited) });

    await page.getByLabel('Pocket depth downward from top Z=8 (mm)').fill('8');
    await page.getByLabel('Tool Y origin (mm)').fill('0');
    await page.getByLabel('Tool Y span (mm)').fill('24');
    await page.getByRole('button', { name: 'Apply dimensions' }).click();
    await page.getByRole('alert').first().waitFor();
    assert.equal(await partVolume(page), '5376 / 1 mm³');
    assert.equal(await source(page), edited);
    await screenshot(page, 'refused-two-body');
    await page.getByRole('button', { name: 'Discard draft' }).click();
    step('refused-two-body-retains-accepted-source', { sourceSHA256: sha(edited) });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download model' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'part.cad.json');
    const diskPath = await download.path();
    assert.ok(diskPath && statSync(diskPath).size > 0);
    const bytes = readFileSync(diskPath);
    assert.deepEqual(Object.keys(JSON.parse(bytes.toString('utf8')).outputs), ['part', 'plate', 'tool']);
    assert.equal(bytes.toString('utf8'), edited);
    step('physical-file-downloaded', { suggestedFilename: download.suggestedFilename(), bytes: bytes.length, sha256: sha(bytes) });

    coldContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
    const fresh = await coldContext.newPage();
    await pageSetup(fresh);
    const originalVolume = await partVolume(fresh);
    await fresh.getByText('Save or open a model', { exact: true }).click();
    await attach(fresh, bytes, 'part.cad.json');
    await fresh.getByLabel('Saved model data').waitFor();
    await fresh.waitForFunction(text => document.querySelector('section[aria-label="CAD model editor"] textarea')?.value === text, edited);
    assert.equal(await partVolume(fresh), originalVolume, 'File selection alone cannot replace accepted geometry');
    await fresh.getByText('Replace accepted model and discard its history and pending dimensions').locator('input[type="checkbox"]').check();
    await fresh.getByRole('button', { name: 'Open saved model' }).click();
    await settle(fresh);
    assert.equal(await source(fresh), edited);
    assert.match(await visible(fresh), /Visible: tool/);
    await fresh.getByLabel('Choose one output to inspect').selectOption('part');
    assert.match(await visible(fresh), /Visible: part/);
    assert.equal(await partVolume(fresh), '5376 / 1 mm³');
    await setDepth(fresh, 5);
    assert.equal(await partVolume(fresh), '5504 / 1 mm³');
    await screenshot(fresh, 'cold-reedit-5');
    step('fresh-context-open-reedit', { sourceSHA256: sha(await source(fresh)), partVolumeMM3: 5504 });

    const acceptedBeforeInvalid = await source(fresh);
    for (const [name, invalid] of [
      ['invalid-utf8.cad.json', Buffer.from([0xc3, 0x28])],
      ['oversize.cad.json', Buffer.alloc(262145, 32)]
    ]) {
      await attach(fresh, invalid, name);
      await fresh.getByRole('alert').filter({ hasText: 'Cannot read model file' }).waitFor();
      assert.equal(await source(fresh), acceptedBeforeInvalid);
      assert.equal(await partVolume(fresh), '5504 / 1 mm³');
    }
    step('malformed-utf8-and-oversized-file-refusal', { retainedSHA256: sha(acceptedBeforeInvalid) });
    assert.deepEqual(receipt.pageErrors, []);
    receipt.result = 'PASSED_BROWSER';
    receipt.evidenceTier = 'real headed/headless browser, actual downloaded file, screenshots; GPU quantitative readback not asserted';
    write();
    console.log(JSON.stringify({ result: receipt.result, head: receipt.head, stages: receipt.stages.length, evidence }));
  }
} catch (cause) {
  receipt.result = 'FAILED';
  receipt.failure = { message: String(cause), stack: cause?.stack || null };
  write();
  try { if (active && !active.isClosed()) await active.screenshot({ path: join(evidence, 'failure.png') }); } catch {}
  console.error(cause);
  process.exitCode = 1;
} finally {
  try { await coldContext?.close(); } catch {}
  try { await firstContext?.close(); } catch {}
  try { await browser?.close(); } catch {}
  if (server) {
    server.kill('SIGTERM');
    await new Promise(done => { if (server.exitCode !== null) return done(); server.once('exit', done); setTimeout(done, 1500); });
  }
  write();
}
