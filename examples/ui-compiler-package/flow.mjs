import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { compileUi } from './.build/consumer.mjs';
import { createFixtureServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_DIR ?? 'playwright-core');
const source = await fs.readFile(new URL('./app.jsx', import.meta.url), 'utf8');
for (const invalid of [
  'export default function Broken(',
  "import x from 'evil'; export default () => null",
  "export default () => import('react')",
]) await assert.rejects(compileUi(invalid, { moduleId: 'counter' }), /syntax|dependency/);
const app = await createFixtureServer();
const artifact = app.artifact;
assert.equal(artifact.version, 1);
assert.equal(Object.hasOwn(artifact, 'cssDigest'), false);
assert.equal(artifact.sourceDigest, createHash('sha256').update(source).digest('hex'));
assert.equal(artifact.bundleDigest, createHash('sha256').update(artifact.bundle).digest('hex'));
assert(artifact.css.includes('display: grid'));
const v2 = await compileUi(source, { moduleId: 'counter', artifactVersion: 2 });
assert.equal(v2.version, 2);
assert.equal(v2.cssDigest, createHash('sha256').update(v2.css, 'utf8').digest('hex'));
assert.equal(v2.sourceDigest, artifact.sourceDigest);
assert.equal(v2.bundleDigest, artifact.bundleDigest);
assert.deepEqual(v2.bundle, artifact.bundle);
assert.equal(v2.css, artifact.css);
await assert.rejects(compileUi(source, { moduleId: 'counter', artifactVersion: 3 }), /Invalid artifact version/);
let browser;
const pageErrors = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(app.url);
  const frame = page.frameLocator('iframe');
  await frame.getByText('Count: 2').waitFor();
  assert.equal(await frame.getByText('Total: 3600').count(), 1);
  await frame.getByRole('button', { name: 'Add' }).click();
  await frame.getByText('Count: 3').waitFor();
  assert.equal(await frame.getByText('Total: 5400').count(), 1);
  await frame.getByRole('textbox', { name: 'Name' }).fill('Lee');
  await page.waitForFunction(() => window.FIXTURE.inspect().selectedState?.name === 'Lee');
  const seen = await page.evaluate(() => window.FIXTURE.inspect());
  assert.deepEqual(seen.selectedState, { name: 'Lee', count: 3 });
  assert(seen.messages.some((message) => message.type === 'ready' && message.origin === 'null'));
  assert.equal(await frame.getByRole('button', { name: 'Save' }).isDisabled(), true);
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ status: 'passed', moduleId: artifact.moduleId,
    sourceDigest: artifact.sourceDigest, bundleDigest: artifact.bundleDigest,
    bundleBytes: artifact.bundle.length, cssBytes: Buffer.byteLength(artifact.css), cssDigest: v2.cssDigest,
    versions: artifact.versions, state: seen.selectedState, pageErrors }));
} finally {
  await browser?.close();
  await app.close();
}
