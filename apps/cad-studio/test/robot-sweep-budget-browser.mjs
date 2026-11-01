// #2229 qualification: a robot sweep that runs out of its sample budget is "not certified", never a contact and never clear.
// Fixture robot-sweep-budget.bcad: the conformance rm/chain-2r arm (joints base~a, a~b) plus two grounded boxes.
//   post: its face lies 1e-5 mm beyond link b's farthest reach from the axis of base~a, so a swing never touches it and the default 20000-sample budget cannot certify it (the step is (gap - tol) / rate).
//   wall: a box 3 mm inside b's reach on the -y side, hit by b at about -69 degrees (a real collision, contact wall - b).
// Steps (actual Studio UI, one Chrome, two sequential contexts): Open; Joint base~a pose -22.918 + Add waypoint + pose +22.918 + Check path -> the Path check status reads "Not certified ..." (no "Contact", no collision tint:
// window.__studioContactLinks() is empty); Clear waypoints, pose -91.7 + Check path -> "Contact wall - b ..." (as before); choose the saved motion "graze" -> the toast "Motion contact check not certified", no tint;
// Save, fresh Open, the graze check again -> the same. Readonly hooks (__studioDoc, __studioBodies, __studioContactLinks) observe only.
// Root must freeze all sources first. Run from apps/cad-studio:
//   ROBOT_SWEEP_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
//   CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/robot-sweep-budget-browser.mjs /absolute/artifacts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

assert.equal(process.env.ROBOT_SWEEP_SOURCE_FROZEN, '1', 'Root must freeze all writers before the robot sweep budget driver runs');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]), fixture = join(import.meta.dirname, 'fixtures/robot-sweep-budget.bcad');
await mkdir(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { status: 'RUNNING', qualification: 'ROBOT_SWEEP_BUDGET_NOT_CERTIFIED', visualReview: 'ROOT_MUST_VIEW_SCREENSHOTS', states: [], observations: [], files: [], downloads: [], errors: [], consoleErrors: [], changes: [], cleanup: [],
  limits: ['The graze check is a draft path: home -> waypoint (-22.918 deg) -> pose (+22.918 deg) of joint base~a; the budget is per segment and does not depend on timing.', 'The 1e-5 mm gap exhausts the default 20000-sample budget (about 2 to 5 s per check).',
    'No collision tint means window.__studioContactLinks() is empty; the contact check uses the same Studio sweep (sweepTimed), not an independent oracle.', 'Hashes are source provenance.'] };
let phase = 'source preparation', server, browser, context, page, frozenFiles = [];
const persist = () => writeFile(join(output, 'receipt.json'), JSON.stringify({ ...report, phase }, null, 2));
async function capsule(label, files) {
  const unique = [...new Set(files.map(file => relative(repo, resolve(repo, file))))].sort(), hashes = {};
  for (const file of unique) hashes[file] = hash(await readFile(resolve(repo, file)));
  await writeFile(join(output, `source-${label}.json`), JSON.stringify({ count: unique.length, hashes }, null, 2)); return hashes;
}
const sources = async dir => (await readdir(join(repo, dir), { recursive: true })).filter(file => /\.(ts|tsx|css)$/.test(file)).map(file => join(dir, file));
const J = 'base~a', SWING = 22.918311805, HIT = -91.7;
const doc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioDoc)));
async function ready() { await page.waitForFunction(() => { const s = window.__studioBodies?.(); return window.__studioFresh === true && s?.fresh && s.massReady; }, null, { timeout: 60000 }); }
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent));
const contactLinks = () => page.evaluate(() => window.__studioContactLinks?.() ?? null);
const pathText = () => page.evaluate(() => document.querySelector('[aria-label="Path check"]')?.textContent ?? null);
async function snapshot(label) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const state = await page.evaluate(label => ({ label, nodes: window.__studioDoc?.nodes?.length, instances: window.__studioDoc?.instances?.map(i => i.id), notices: [...document.querySelectorAll('.toast')].map(x => x.textContent),
    pathCheck: document.querySelector('[aria-label="Path check"]')?.textContent ?? null, contactLinks: window.__studioContactLinks?.() ?? null, motionContact: document.querySelector('[aria-label="Motion contact"]')?.textContent ?? null }), label);
  report.states.push(state); await writeFile(join(output, `${label}.json`), JSON.stringify(state, null, 2)); await page.screenshot({ path: join(output, `${label}.png`), fullPage: true }); await persist(); return state;
}
async function newPage() {
  if (context) { await context.close(); report.cleanup.push('CONTEXT_CLOSED'); }
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }); page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.stack ?? String(e))); page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('download', d => report.downloads.push({ phase, suggestedFilename: d.suggestedFilename() })); page.on('dialog', d => d.accept());
  await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 }); await ready();
}
async function openFile(file) {
  await page.setInputFiles('input[aria-label="Model file"]', file);
  await page.waitForFunction(() => (window.__studioDoc?.instances ?? []).some(i => i.id === 'post') && (window.__studioDoc?.instances ?? []).some(i => i.id === 'wall'), null, { timeout: 60000 }); await ready();
  await page.locator('aside[aria-label="Joints"]').waitFor({ timeout: 30000 });
}
async function setPose(degrees) {
  const input = page.getByLabel(`Joint ${J} pose (degree)`, { exact: true }); await input.fill(String(degrees)); await input.press('Enter'); await page.waitForTimeout(250);
  assert.equal(Number(await input.inputValue()), degrees, 'the pose was applied (the field keeps the value)');
}
async function checkPath(label) {
  const button = page.getByRole('button', { name: 'Check path', exact: true }); await button.waitFor({ timeout: 15000 }); assert.equal(await button.isDisabled(), false, 'Check path is enabled');
  const previous = await pathText();
  await button.click(); await page.waitForFunction(previous => { const t = document.querySelector('[aria-label="Path check"]')?.textContent ?? ''; return t.length > 0 && t !== previous; }, previous, { timeout: 180000 });
  const text = await pathText(), links = await contactLinks(); report.observations.push({ label, pathCheck: text, contactLinks: links }); await persist(); return { text, links };
}
async function grazeCheck(label) {
  phase = `graze check ${label}`; await page.getByRole('button', { name: 'Joints home', exact: true }).click().catch(() => {}); await page.waitForTimeout(250);
  await setPose(-SWING); await page.getByRole('button', { name: 'Add waypoint', exact: true }).click(); await setPose(SWING);
  const { text, links } = await checkPath(label);
  assert.match(text, /^Not certified/, `${label}: the panel says "Not certified"`); assert.doesNotMatch(text, /^Contact/, `${label}: not a contact`); assert.doesNotMatch(text, /^Clear/, `${label}: not clear`);
  assert.deepEqual(links, [], `${label}: no collision tint`); assert.equal(await page.locator('[aria-label="Motion contact"]').count(), 0, `${label}: no motion contact status`);
  await snapshot(label); return text;
}
async function save(label) {
  phase = `native Save ${label}`; await ready(); const accepted = await doc();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const file = join(output, `${label}.bcad`); await download.saveAs(file); const bytes = await readFile(file); assert.deepEqual(JSON.parse(bytes), accepted);
  report.files.push({ file, hash: hash(bytes), semanticEquality: true }); return { file, doc: accepted };
}
try {
  report.sourceBefore = await capsule('initial', [fixture, 'apps/cad-studio/vite.config.ts']);
  frozenFiles = [fixture, 'apps/cad-studio/vite.config.ts', ...await sources('apps/cad-studio/src'), ...await sources('packages/barocss-cad-model/src/robot'), 'packages/barocss-cad-model/src/chat/robot.ts'];
  report.sourceFrozen = await capsule('frozen', frozenFiles); report.sourceFrozenCount = Object.keys(report.sourceFrozen).length; await persist();
  phase = 'actual Studio start'; server = await createServer({ root: app, configFile: join(app, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' }); server.watcher.on('all', (event, file) => { if (['change', 'add', 'unlink'].includes(event)) report.changes.push({ event, file }); }); await server.listen();
  const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright'); browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] }); report.chromeProcessesLaunched = 1;

  // Context 1: Open the fixture.
  phase = 'Open fixture'; await newPage(); await openFile(fixture); await snapshot('00-opened');
  const opened = await doc(); assert.deepEqual(opened.robot.motions.map(m => m.name), ['graze', 'collide'], 'the fixture carries both saved motions');

  // 1. The graze: the default budget is exhausted: "Not certified", neither a contact nor clear, no tint.
  const first = await grazeCheck('01-graze-not-certified');

  // 2. The real collision: contact as before (wall - b), tinted links known to the viewer.
  phase = 'collision check'; await page.getByRole('button', { name: 'Clear waypoints', exact: true }).click(); await setPose(HIT);
  const hit = await checkPath('02-collision'); assert.match(hit.text, /^Contact /, 'the collision reads "Contact ..."'); assert.match(hit.text, /wall/i, 'the contact names the wall'); assert.doesNotMatch(hit.text, /Not certified/);
  await snapshot('02-collision');

  // 3. Play the saved graze motion: a "not certified" toast and no tint.
  phase = 'play saved graze motion'; await page.getByRole('combobox', { name: 'Motion choice' }).selectOption('graze');
  // (The motion is swept once it plays: App sweeps the frozen motion, not the choice.)
  await page.getByRole('button', { name: 'Play motion', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some(x => /Motion contact check not certified/.test(x.textContent ?? '')), null, { timeout: 180000 }); await page.waitForTimeout(800);
  const playToasts = await toasts(), playLinks = await contactLinks(); report.observations.push({ label: '03-play-graze', toasts: playToasts, contactLinks: playLinks, motionContact: await page.locator('[aria-label="Motion contact"]').count() });
  assert.ok(playToasts.some(t => /Motion contact check not certified/.test(t ?? '')), 'the toast says the motion contact check is not certified'); assert.deepEqual(playLinks, [], 'no collision tint while the graze motion plays'); assert.equal(await page.locator('[aria-label="Motion contact"]').count(), 0);
  await snapshot('03-play-graze');

  // 4. Save, fresh Open, the same graze check again.
  const saved = await save('04-saved'); phase = 'fresh Open'; await newPage(); await openFile(saved.file); assert.deepEqual(await doc(), saved.doc, 'the reopened document equals the saved one');
  const again = await grazeCheck('04-reopened-graze-not-certified'); assert.equal(again.replace(/\(\d+ steps[^)]*\)/, ''), first.replace(/\(\d+ steps[^)]*\)/, ''), 'the same wording after Save and Open');

  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.changes, []);
  report.sourceAfter = await capsule('after', frozenFiles); assert.deepEqual(report.sourceAfter, report.sourceFrozen); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; if (page) try { await snapshot('failure'); } catch (capture) { report.captureFailure = capture.stack ?? String(capture); } }
finally {
  for (const [resource, label] of [[context, 'CONTEXT'], [browser, 'BROWSER'], [server, 'SERVER']]) { if (!resource) continue; try { await resource.close(); report.cleanup.push(`${label}_CLOSED`); } catch (error) { report.cleanup.push({ label, error: error.stack ?? String(error) }); report.status = 'FAIL'; process.exitCode = 1; } }
  try { report.sourceAfterCleanup = await capsule('after-cleanup', frozenFiles); if (report.sourceFrozen) assert.deepEqual(report.sourceAfterCleanup, report.sourceFrozen); } catch (error) { report.sourceFailure = error.stack ?? String(error); report.status = 'FAIL'; process.exitCode = 1; }
  await persist(); console.log(JSON.stringify({ status: report.status, phase, failure: report.failure, output }));
}
