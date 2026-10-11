import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { url, close } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const artifactsPath = process.env.COMPOSED_ARTIFACTS;
if (!artifactsPath) throw new Error('COMPOSED_ARTIFACTS is required');
const artifacts = JSON.parse(await fs.readFile(artifactsPath, 'utf8'));
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.env.RESULT_ROOT ?? path.join(here, 'output/identity'));
await fs.mkdir(output, { recursive: true });
const pageErrors = [];
let browser;
let page;
let serving = 'base';
let resourceRequests = 0;
const inspect = () => page.evaluate(() => window.fixture.inspect());
const visible = () => page.frameLocator('iframe:not([hidden])');
const phase = (value) => page.waitForFunction((expected) => window.fixture.inspect().phase === expected, value);
const start = async (variant) => {
  serving = variant;
  await page.evaluate((name) => { window.run = window.fixture.start(name); }, variant);
  await phase('preview');
};

try {
  assert.equal(artifacts.base.bundleDigest, artifacts.different.bundleDigest);
  assert.equal(artifacts.base.moduleId, 'counter');
  assert.equal(artifacts.different.moduleId, 'other');
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
  page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/artifact/*.json', async (route) => {
    resourceRequests += 1;
    const response = await route.fetch();
    await route.fulfill({ response, json: artifacts[serving] });
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.fixture);

  await start('base');
  assert.equal(await visible().getByRole('button', { name: 'Save' }).isDisabled(), true);
  await visible().getByRole('button', { name: 'Add' }).click();
  await visible().getByLabel('Name').fill('Sujin');
  await page.waitForFunction(() => {
    const state = window.fixture.inspect().active?.state;
    return state?.name === 'Sujin' && state?.count === 3;
  });
  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.run), true);
  await phase('committed');
  const first = await inspect();
  assert.deepEqual(first.active.state, { name: 'Sujin', count: 3 });
  await visible().getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => window.fixture.saves.length === 1);

  await start('base');
  assert.equal((await inspect()).active.instanceId, first.active.instanceId);
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');
  await page.evaluate(() => window.fixture.cancel());
  assert.equal(await page.evaluate(() => window.run), false);
  assert.deepEqual((await inspect()).active.state, { name: 'Sujin', count: 3 });

  await start('different');
  await page.waitForFunction(() => {
    const state = window.fixture.inspect().active?.state;
    return state?.name === 'Mina' && state?.count === 2;
  });
  const preview = await inspect();
  assert.notEqual(preview.active.instanceId, first.active.instanceId);
  assert.deepEqual(preview.active.state, { name: 'Mina', count: 2 });
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Mina');
  assert.equal(await visible().getByRole('button', { name: 'Save' }).isDisabled(), true);
  await page.evaluate(() => window.fixture.cancel());
  assert.equal(await page.evaluate(() => window.run), false);
  assert.equal((await inspect()).active.instanceId, first.active.instanceId);
  assert.equal(await visible().getByLabel('Name').inputValue(), 'Sujin');

  await start('different');
  await page.evaluate(() => window.fixture.finish());
  assert.equal(await page.evaluate(() => window.run), true);
  await phase('committed');
  const second = await inspect();
  assert.notEqual(second.active.instanceId, first.active.instanceId);
  assert.deepEqual(second.active.state, { name: 'Mina', count: 2 });
  assert.equal(await page.locator('iframe').count(), 1);
  await visible().getByRole('button', { name: 'Save' }).click();
  await page.waitForFunction(() => window.fixture.saves.length === 2);
  const saves = await page.evaluate(() => window.fixture.saves);
  assert.equal(saves[0].moduleId, 'counter');
  assert.equal(saves[1].moduleId, 'other');
  assert.deepEqual(saves[1].state, { name: 'Mina', count: 2 });
  assert.equal(saves[1].bundleDigest, artifacts.base.bundleDigest);
  assert.deepEqual(await page.evaluate(() => window.fixture.errors), []);
  assert.deepEqual(pageErrors, []);

  const report = { status: 'passed', evidence: 'two actual emitted Compiler artifacts with equal bundle bytes',
    browser: browser.version(), bundleDigest: artifacts.base.bundleDigest, resourceRequests,
    first: { instanceId: first.active.instanceId, state: first.active.state },
    preview: { instanceId: preview.active.instanceId, state: preview.active.state },
    second: { instanceId: second.active.instanceId, state: second.active.state },
    saves: saves.map(({ signal, ...request }) => request), pageErrors };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, browser: report.browser,
    resourceRequests, saves: saves.length, pageErrors: pageErrors.length }));
} catch (error) {
  const failure = { status: 'failed', message: error.message, stack: error.stack,
    snapshot: await inspect().catch(() => null), resourceRequests, pageErrors };
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify(failure, null, 2));
  console.error(`First failure preserved: ${path.join(output, 'failure.json')}`);
  throw error;
} finally {
  await browser?.close();
  await close();
}
