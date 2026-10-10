import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { url, close } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output'));
const composed = !!process.env.COMPOSED_ARTIFACTS;
await fs.mkdir(output, { recursive: true });
let browser;
let page;
const pageErrors = [];
const milestones = [];
const inspect = () => page.evaluate(() => window.fixture.inspect());
const visible = () => page.frameLocator('iframe:not([hidden])');
const phase = (value) => page.waitForFunction((expected) => window.fixture.inspect().phase === expected, value);
const state = (count, name) => page.waitForFunction(([expectedCount, expectedName]) => {
  const current = window.fixture.inspect().active?.state;
  return current?.count === expectedCount && current?.name === expectedName;
}, [count, name]);
const start = async (variant, expected = { count: 2, name: 'Mina' }) => {
  await page.evaluate((name) => { window.FLOW = window.fixture.start(name); }, variant);
  await phase('preview');
  await state(expected.count, expected.name);
};
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.fixture);

  await start('base');
  const first = await inspect();
  assert.equal(await visible().getByRole('button', { name: 'Save' }).isDisabled(), true);
  await visible().getByRole('button', { name: 'Add' }).click();
  await visible().getByLabel('Name').fill('Sujin');
  await state(3, 'Sujin');
  if (composed) assert.equal(await visible().getByText('Total: 5400').count(), 1);
  else assert.equal(await visible().locator('#value').textContent(), 'Count: 3; Price: 5400');
  await page.evaluate(() => window.fixture.hint({ name: 'Host hint', count: 90 }));
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');
  assert.deepEqual((await inspect()).active.state, { name: 'Sujin', count: 3 });
  milestones.push('preview interaction and same-module hint preservation');

  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.FLOW), true);
  await phase('committed');
  await visible().getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => window.fixture.saves.length === 1);
  await visible().getByRole('button', { name: 'Save' }).click({ force: true }).catch(() => {});
  assert.equal(await page.evaluate(() => window.fixture.saves.length), 1);
  await page.evaluate((identity) => window.postMessage({ type: 'state', instanceId: identity.instanceId,
    bundleDigest: identity.bundleDigest, state: { name: 'Forged', count: 99 } }, location.origin), first.active);
  assert.deepEqual((await inspect()).active.state, { name: 'Sujin', count: 3 });
  milestones.push('final action once and wrong-window bridge rejection');

  await start('different');
  assert.equal(await page.locator('iframe').count(), 2);
  await page.evaluate(() => window.fixture.cancel());
  assert.equal(await page.evaluate(() => window.FLOW), false);
  assert.equal((await inspect()).active.instanceId, first.active.instanceId);
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');
  milestones.push('changed-module cancellation restores same frame and state');

  await start('error', { count: 3, name: 'Sujin' });
  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.FLOW), false);
  assert.equal((await inspect()).active.instanceId, first.active.instanceId);
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');
  milestones.push('source error restores same-module frame');

  await start('different');
  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.FLOW), true);
  assert.notEqual((await inspect()).active.instanceId, first.active.instanceId);
  assert.deepEqual((await inspect()).active.state, { name: 'Mina', count: 2 });
  if (composed) assert.equal(await visible().getByText('Total: 4400').count(), 1);
  else assert.equal(await visible().locator('#value').textContent(), 'Count: 2; Price: 4400');
  milestones.push('changed module initializes new state and calculation');

  let blockedRoute;
  await page.route('**/bundle/*.js', (route) => { blockedRoute = route; });
  await page.evaluate(() => { window.FLOW = window.fixture.start('base'); });
  await page.waitForFunction(() => window.fixture.inspect().phase === 'preview');
  const deadline = Date.now() + 6000;
  while (!blockedRoute && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert(blockedRoute, 'blocked fixture script request');
  await page.evaluate(() => window.fixture.finish());
  await page.evaluate(() => window.fixture.cancel());
  assert.equal(await page.evaluate(() => window.FLOW), false);
  await blockedRoute.abort().catch(() => {});
  assert.equal(await page.locator('iframe').count(), 1);
  blockedRoute = undefined;
  await page.evaluate(() => { window.FLOW = window.fixture.start('base'); });
  await page.waitForFunction(() => window.fixture.inspect().phase === 'preview');
  const disposalDeadline = Date.now() + 6000;
  while (!blockedRoute && Date.now() < disposalDeadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert(blockedRoute, 'second blocked fixture script request');
  await page.evaluate(() => window.fixture.finish());
  await page.evaluate(() => window.fixture.dispose());
  assert.equal(await page.evaluate(() => window.FLOW), false);
  await blockedRoute.abort().catch(() => {});
  await page.unroute('**/bundle/*.js');
  assert.equal(await page.locator('iframe').count(), 0);
  assert.equal((await inspect()).phase, 'disposed');
  assert.deepEqual(pageErrors, []);
  milestones.push('blocked mount cancellation settles and owned frames dispose');

  const report = { status: 'passed', evidence: composed ? 'emitted @barocss/ui-compiler artifact from external staged public package' :
    'hand-authored artifact and bridge fixture, not emitted compiler output',
    browser: browser.version(), milestones, saves: await page.evaluate(() => window.fixture.saves),
    errors: await page.evaluate(() => window.fixture.errors), pageErrors };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, browser: report.browser, milestones: milestones.length,
    saves: report.saves.length, pageErrors: pageErrors.length, report: path.join(output, 'report.json') }));
} catch (error) {
  const failure = { status: 'failed', message: error.message, stack: error.stack, milestones, pageErrors,
    snapshot: await inspect().catch(() => null) };
  const file = path.join(output, 'failure.json');
  await fs.writeFile(file, JSON.stringify(failure, null, 2));
  console.error(`First failure preserved: ${file}`);
  throw error;
} finally {
  await browser?.close();
  await close();
}
