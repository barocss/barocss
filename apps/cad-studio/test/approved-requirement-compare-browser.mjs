import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, prior, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
const historical = mode === 'historical';
assert.ok([output, prior].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const filename = historical ? 'D595-evidence.bcad' : 'D594-evidence.bcad';
const project = historical ? 'D595 version evidence' : 'D594 version evidence';
const pins = ['apps/cad-studio/test/approved-requirement-compare-browser.mjs', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/storage/VersionsPanel.tsx', 'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/storage/ApprovedRequirementChecks.tsx', 'apps/cad-studio/src/storage/approvedRequirementCompare.ts',
  'packages/barocss-cad-model/src/chat/outputs.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts', 'packages/barocss-cad-model/src/versions/log.ts'];
const f = await createFlow({
  name: 'approved-requirement-compare', envFrozen: historical ? 'D595_SOURCE_FROZEN' : 'D594_SOURCE_FROZEN', output,
  qualification: historical ? 'Saved approval evidence after a later working regression' : 'One accepted occurrence compared with its saved first failure',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Actual user approval, browser project versions, two top-level occurrences and two unchanged checks.'],
  snapshotExtra: () => ({
    comparison: document.querySelector('[aria-label="Approved requirement checks"], [aria-label="Saved approval checks"]')?.textContent ?? null,
    overlay: window.__studioCompareOverlay?.() ?? null,
    placed: window.__studioInstanceBounds?.() ?? [],
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const proof = () => panel().getByRole('region', { name: 'Approved requirement checks', exact: true });
const savedProof = () => panel().getByRole('region', { name: 'Saved approval checks', exact: true });
async function loadFile(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(JSON.parse(bytes));
}
async function openProject() {
  await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}
async function makeVersion(name) {
  await panel().getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await panel().getByRole('button', { name: 'Make version', exact: true }).click();
  await panel().getByRole('listitem', { name: 'Version ' + name, exact: true }).waitFor();
}
async function storedVersions() {
  const files = await f.page.evaluate(async ({ project, filename }) => {
    const root = await navigator.storage.getDirectory();
    const directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const metadata = await directory.getDirectoryHandle('.barocss');
    const versions = await metadata.getDirectoryHandle('versions');
    const snapshots = await metadata.getDirectoryHandle('snapshots');
    const read = async (dir, name) => (await (await dir.getFileHandle(name)).getFile()).text();
    const log = await read(versions, filename + '.json');
    const parts = await Promise.all(JSON.parse(log).versions.map(version => read(snapshots, version.snapshot + '.bcad')));
    return { doc: await read(directory, filename), log, parts };
  }, { project, filename });
  return { doc: sha256(files.doc), log: sha256(files.log), snapshots: files.parts.map(part => sha256(part)) };
}
const compare = () => panel().getByRole('button', { name: 'Compare Initial failure', exact: true }).click();
const proposal = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });

const versionLog = replacement => f.page.evaluate(async ({ project, filename, replacement }) => {
  const root = await navigator.storage.getDirectory();
  const directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
  const metadata = await directory.getDirectoryHandle('.barocss');
  const versions = await metadata.getDirectoryHandle('versions');
  const log = await versions.getFileHandle(filename + '.json');
  if (replacement !== undefined) {
    const writer = await log.createWritable();
    await writer.write(replacement);
    await writer.close();
  }
  return (await log.getFile()).text();
}, { project, filename, replacement });

async function historicalCompare(approved, stored, initialLog) {
  f.phase = 'make a later working edit that fails the same check';
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Target plate' }).click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByRole('button', { name: 'Edit part', exact: true }).click();
  const editing = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
  await editing.waitFor();
  const changed = await f.setParameter('H', 12, '06-later-height');
  assert.ok(Math.abs(changed.bodies.bodies[0].volume - 20 * 10 * 12) <= 1e-8);
  await f.page.locator('.req.fail[aria-label="Requirement H-CAP"]').waitFor();
  await editing.getByRole('button', { name: 'Finish', exact: true }).click();
  await editing.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioDoc?.instances?.find(item => item.id === 'p1')?.doc.parameters.H === 12);
  await f.ready();
  const working = await f.doc();
  assert.deepEqual(working.instances.find(item => item.id === 'p2'), approved.instances.find(item => item.id === 'p2'));
  assert.deepEqual(working.history, approved.history);
  await button('Project and versions').click();
  await makeVersion('Later regression');
  const versions = await storedVersions();
  assert.deepEqual(versions.snapshots.slice(0, 2), stored.snapshots);
  assert.equal(versions.snapshots.length, 3);
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(working);

  f.phase = 'select two saved versions while the working part still fails';
  await compare();
  await panel().getByRole('status', { name: 'Compared changes', exact: true }).waitFor();
  assert.equal(await proof().count(), 0);
  await f.page.waitForFunction(() => Boolean(window.__studioCompareOverlay?.()));
  await f.snapshot('07-working-regression');
  const target = panel().getByLabel('Compare to', { exact: true });
  await target.waitFor({ timeout: 5000 });
  await target.selectOption({ label: 'Approved correction' });
  await savedProof().getByText('11 mm → 10 mm', { exact: true }).waitFor();
  await savedProof().getByText('2200 mm³ → 2000 mm³', { exact: true }).waitFor();
  await panel().getByText('Initial failure → Approved correction · saved versions', { exact: true }).waitFor();
  assert.equal(await proof().count(), 0);
  await f.same(working);
  const result = await f.snapshot('08-historical-recovery');
  assert.equal(result.overlay, null);
  assert.equal(result.placed.find(item => item.id === 'p1').max[2], 12);

  await target.selectOption({ label: 'Later regression' });
  await panel().getByText('Initial failure → Later regression · saved versions', { exact: true }).waitFor();
  assert.equal(await savedProof().count(), 0);
  await f.page.evaluate(() => window.__d594Hold.arm());
  await target.selectOption({ label: 'Approved correction' });
  await f.page.waitForFunction(() => window.__d594Hold.held());
  await target.selectOption({ label: 'Later regression' });
  await f.page.evaluate(() => window.__d594Hold.release());
  await f.same(working);
  assert.equal(await savedProof().count(), 0);
  await target.selectOption({ label: 'Working document' });
  await panel().getByText('From the version to the working document', { exact: true }).waitFor();
  assert.equal(await savedProof().count(), 0);
  assert.equal(await proof().count(), 0);
  await f.same(working);
  await f.page.waitForFunction(() => Boolean(window.__studioCompareOverlay?.()));
  await f.snapshot('09-working-view-restored');
  assert.deepEqual(await storedVersions(), versions);
  f.report.historicalProjectHashes = versions;

  f.phase = 'reload after a separate writer replaces the active version log';
  await panel().getByRole('button', { name: 'Compare Approved correction', exact: true }).click();
  await f.page.waitForFunction(() => Boolean(window.__studioCompareOverlay?.()));
  assert.equal(await versionLog(initialLog), initialLog);
  await panel().getByLabel('Branch name', { exact: true }).fill('concurrent');
  await panel().getByRole('button', { name: 'Make branch', exact: true }).click();
  await f.waitToast(/versions changed elsewhere/i);
  await panel().getByRole('listitem', { name: 'Version Approved correction', exact: true }).waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioCompareOverlay?.() === null);
  await f.same(working);
  assert.equal(await versionLog(), initialLog);
  await f.snapshot('10-replaced-log-retired-overlay');
}

function installHold() {
  const worker = Worker.prototype, handler = Object.getOwnPropertyDescriptor(worker, 'onmessage'), post = worker.postMessage;
  let armed = false, target, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'part' && request.slot === 'read') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        if (target?.worker === this && target.id === event.data?.id && event.data.result) {
          target = null;
          deliver = () => callback.call(this, event);
        } else callback.call(this, event);
      });
    },
  });
  window.__d594Hold = { arm() { armed = true; }, held: () => Boolean(deliver), release() { deliver(); deliver = null; } };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(installHold);
    return context;
  };
  const pending = await readFile(join(prior, 'pending.bcad')), first = JSON.parse(pending);
  const retained = JSON.parse(await readFile(join(prior, 'initial-p1-evidence.json')));
  const retainedAfter = JSON.parse(await readFile(join(prior, 'accepted-p1-evidence.json')));
  f.report.inputSHA256 = sha256(pending);
  f.phase = 'save the initial failure and preview the candidate';
  await f.newPage();
  await loadFile(pending);
  await openProject();
  await makeVersion('Initial failure');
  const initialLog = historical ? await versionLog() : undefined;
  await button('Chat').first().click();
  await proposal().getByRole('button', { name: 'Preview', exact: true }).click();
  await proposal().getByRole('button', { name: 'Hide', exact: true }).waitFor();
  await compare();
  await panel().getByRole('status', { name: 'Compared changes', exact: true }).waitFor();
  assert.equal(await proof().count(), 0);
  await f.same(first);
  await f.snapshot('01-candidate-unapproved');

  f.phase = 'save explicit approval and compare its exact history pair';
  await proposal().getByRole('button', { name: 'Accept', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const accepted = await f.doc(), decision = accepted.history.at(-1);
  assert.equal(decision.kind, 'accept');
  assert.deepEqual(decision.evidence_revisions, { before: retained.revision, after: retainedAfter.revision });
  await makeVersion('Approved correction');
  const stored = await storedVersions();
  assert.equal(new Set(stored.snapshots).size, 2);
  await panel().getByRole('status', { name: 'Compared changes', exact: true }).waitFor();
  await proof().getByText('11 mm → 10 mm', { exact: true }).waitFor();
  await proof().getByText('2200 mm³ → 2000 mm³', { exact: true }).waitFor();
  assert.match(await proof().textContent(), /H-CAP.*Fail.*Pass/s);
  await f.same(accepted);
  await f.snapshot('02-linked-first-failure');
  await button('Project and versions').click();
  await panel().waitFor({ state: 'hidden' });
  await button('Project and versions').click();
  await proof().getByText('11 mm → 10 mm', { exact: true }).waitFor();
  assert.equal(await panel().getByRole('button', { name: 'Compare Initial failure', exact: true }).textContent(), 'Hide');

  await proof().getByLabel('Requirement occurrence').selectOption('p2');
  await proof().getByText('No verified failure-to-pass checks.', { exact: true }).waitFor();
  await f.same(accepted);
  await f.snapshot('03-control-still-fails');

  f.phase = 'hide before a retained read finishes';
  await compare();
  await f.page.evaluate(() => window.__d594Hold.arm());
  await compare();
  await f.page.waitForFunction(() => window.__d594Hold.held());
  await proof().getByRole('status').getByText('Checking both revisions…').waitFor();
  await compare();
  await f.page.evaluate(() => window.__d594Hold.release());
  await f.same(accepted);
  assert.equal(await proof().count(), 0);
  await f.snapshot('04-retired-read');

  f.phase = 'reload the browser project and compare the durable snapshots';
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(accepted);
  await compare();
  await proof().getByText('11 mm → 10 mm', { exact: true }).waitFor();
  await f.snapshot('05-reopened-version-evidence');
  assert.deepEqual(await storedVersions(), stored);
  f.report.projectHashes = stored;
  if (historical) await historicalCompare(accepted, stored, initialLog);
  assert.deepEqual(f.report.downloads, []);
});
