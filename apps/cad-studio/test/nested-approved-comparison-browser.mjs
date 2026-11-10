import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, prior, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok([output, prior].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'apps/cad-studio/src/storage/ApprovedRequirementChecks.tsx', 'apps/cad-studio/src/storage/approvedRequirementCompare.ts',
  'packages/barocss-cad-model/src/chat/nestedParameterProposal.ts', 'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/team/requirementScope.ts', 'packages/barocss-cad-model/src/versions/log.ts',
];
const oracleSource = String.raw`
import json, sys
d = json.load(sys.stdin)
for stage, heights in [('first', [6, 7]), ('approved', [4, 7]), ('working', [8, 7])]:
    for host, height in zip(d[stage]['instances'], heights, strict=True):
        leaf, = host['doc']['instances']
        part = leaf['doc']
        sketch, extrusion = part['nodes']
        assert sketch['min'] == [0, 0] and sketch['max'] == [20, 10]
        assert extrusion['height'] == {'parameter':'H'} and part['parameters']['H'] == height
        assert next(r['check']['value'] for r in part['requirements'] if r['id'] == 'HEIGHT') == 5
assert d['historical'] == '6 mm → 4 mm'
assert d['current'] == '8 mm (want <= 5 mm)'
print(json.dumps({'status':'PASS','localHeightChecks':6}))
`;
const f = await createFlow({
  name: 'nested-approved-comparison', envFrozen: 'D608_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  qualification: 'Historical comparison of an exact saved nested approval with a different working verdict',
  limits: ['D607 saved root approval and initial failure; ordinary static nested prisms. Delay is applied after real Worker transport decoding.'],
  snapshotExtra: () => ({
    comparison: document.querySelector('[aria-label="Saved approval checks"], [aria-label="Approved requirement checks"]')?.textContent ?? null,
    overlay: window.__studioCompareOverlay?.() ?? null,
  }),
});
const filename = 'D608-root.bcad', project = 'D608 saved nested approval';
const button = name => f.page.getByRole('button', { name, exact: true });
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const history = () => versions().getByRole('region', { name: 'Saved approval checks', exact: true });
const workingChecks = () => versions().getByRole('region', { name: 'Approved requirement checks', exact: true });
const selectTarget = () => versions().getByLabel('Compare to', { exact: true });
const summary = () => versions().getByRole('status', { name: 'Compared changes', exact: true });

async function open(bytes, expected) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: filename, mimeType: 'application/json', buffer: bytes });
  await f.same(expected);
}

async function openProject() {
  if (!(await versions().isVisible())) await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

async function makeVersion(name) {
  if (!(await versions().isVisible())) await button('Project and versions').click();
  await versions().getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await versions().getByRole('button', { name: 'Make version', exact: true }).click();
  await versions().getByRole('listitem', { name: 'Version ' + name, exact: true }).waitFor();
}

function projectBytes() {
  return f.page.evaluate(async ({ project, filename }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const read = async (folder, name) => (await (await folder.getFileHandle(name)).getFile()).text();
    const meta = await dir.getDirectoryHandle('.barocss');
    const log = await read(await meta.getDirectoryHandle('versions'), filename + '.json');
    const snapshots = await meta.getDirectoryHandle('snapshots');
    return { doc: await read(dir, filename), log, snapshots: await Promise.all(JSON.parse(log).versions.map(v => read(snapshots, v.snapshot + '.bcad'))) };
  }, { project, filename });
}

// Stage the exact native files as a separate project writer. Reopen through the product to get a fresh file tag.
async function replaceProjectHead(bytes, expected) {
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await f.page.evaluate(async ({ project, filename, text }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const writer = await (await dir.getFileHandle(filename)).createWritable();
    await writer.write(text);
    await writer.close();
  }, { project, filename, text: bytes.toString('utf8') });
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(expected);
}

async function inspectWorkingFailure() {
  const leaf = f.page.locator('.ol.instance.nested[data-path="p1/p1"]');
  if (!(await leaf.isVisible())) await button('Show the parts of Left module').click();
  await leaf.click();
  const row = f.page.getByRole('group', { name: 'Local requirement HEIGHT', exact: true });
  const measurement = row.getByText('8 mm (want <= 5 mm)', { exact: true });
  await measurement.waitFor();
  assert.match(await row.innerText(), /HEIGHT · Fail/);
  return measurement.innerText();
}

async function installHold() {
  await f.page.evaluate(async () => {
    const url = '/src/engine/client.ts';
    const { EngineClient } = await import(url);
    const original = EngineClient.prototype.part;
    let armed = false, held, completed = 0;
    EngineClient.prototype.part = async function (doc, revision, slot) {
      const capture = armed && slot === 'read';
      if (capture) armed = false;
      const result = await original.call(this, doc, revision, slot);
      if (capture) {
        if (!result?.ok) throw new Error('Expected a decoded read result');
        await new Promise(resolve => { held = resolve; });
        completed++;
      }
      return result;
    };
    window.__d608Hold = {
      arm() { armed = true; }, held: () => Boolean(held), completed: () => completed,
      release() { const deliver = held; held = undefined; deliver(); },
    };
  });
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
    return context;
  };
  const firstBytes = await readFile(join(prior, 'pending-root.bcad')), approvedBytes = await readFile(join(prior, 'approved-root.bcad'));
  assert.equal(sha256(firstBytes), '4a171b922166b99ca5cf9488ffe94b2b8717809c616fd6ddabde1def9c6a727c');
  assert.equal(sha256(approvedBytes), '60005695aaf7a59dd6599f1f17058cb24a3f355ea9acd997992595188f0bab6c');
  const first = JSON.parse(firstBytes), approved = JSON.parse(approvedBytes);
  const pair = approved.history.at(-1).evidence_revisions;
  assert.deepEqual(pair, approved.proposals[0].decided.evidence_revisions);
  const working = structuredClone(approved);
  working.instances[0].part.rev = 'C';
  working.instances[0].doc.instances[0].doc.parameters.H = 8;
  const workingBytes = Buffer.from(JSON.stringify(working));

  f.phase = 'save the two exact D607 revisions and a later failing working version';
  await f.newPage();
  await open(firstBytes, first);
  await openProject();
  await makeVersion('Initial nested failure');
  const original = await projectBytes();
  await replaceProjectHead(approvedBytes, approved);
  await makeVersion('Approved nested repair');
  await replaceProjectHead(workingBytes, working);
  await makeVersion('Later working failure');
  const saved = await projectBytes();
  assert.deepEqual(saved.snapshots.map(bytes => JSON.parse(bytes)), [first, approved, working]);
  assert.deepEqual(saved.snapshots.slice(0, 2), [firstBytes.toString('utf8'), approvedBytes.toString('utf8')]);
  assert.equal(saved.snapshots[0], original.snapshots[0]);
  assert.deepEqual(JSON.parse(saved.doc), working);

  f.phase = 'project reload and compare the saved pair';
  await f.page.reload();
  await f.ready();
  await openProject();
  await versions().getByRole('button', { name: 'Open ' + filename, exact: true }).click();
  await f.same(working);
  const current = await inspectWorkingFailure();
  await versions().getByRole('button', { name: 'Compare Initial nested failure', exact: true }).click();
  await summary().getByText('From the version to the working document', { exact: true }).waitFor();
  assert.equal(await workingChecks().count(), 0);
  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await summary().getByText('Initial nested failure → Approved nested repair · saved versions', { exact: true }).waitFor();
  if (mode === '--baseline') {
    assert.equal(await history().count(), 0);
    await f.snapshot('00-baseline-no-nested-checks');
    f.report.observations.push({ scopeAvailable: false, source: sha256(firstBytes), approved: sha256(approvedBytes), pair });
    return;
  }
  const recovery = history().getByText('6 mm → 4 mm', { exact: true });
  await recovery.waitFor();
  assert.match(await history().innerText(), /HEIGHT · Fail → Pass/);
  const choices = await history().getByLabel('Requirement occurrence', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(choices, ['p1/p1']);
  const historical = await recovery.innerText();
  assert.equal(await inspectWorkingFailure(), current);
  const compared = await f.snapshot('01-saved-repair-and-working-failure');
  assert.equal(compared.overlay, null);

  f.phase = 'retire a held comparison when the target changes';
  await selectTarget().selectOption({ label: 'Later working failure' });
  await summary().getByText('Initial nested failure → Later working failure · saved versions', { exact: true }).waitFor();
  assert.equal(await history().count(), 0);
  await installHold();
  await f.page.evaluate(() => window.__d608Hold.arm());
  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await f.page.waitForFunction(() => window.__d608Hold.held());
  await history().getByText('Checking both revisions…', { exact: true }).waitFor();
  await selectTarget().selectOption({ label: 'Later working failure' });
  await summary().getByText('Initial nested failure → Later working failure · saved versions', { exact: true }).waitFor();
  await f.page.evaluate(() => window.__d608Hold.release());
  await f.page.waitForFunction(() => window.__d608Hold.completed() === 1);
  await f.snapshot('02-retired-read');
  assert.equal(await history().count(), 0);
  assert.equal(await workingChecks().count(), 0);

  await selectTarget().selectOption({ label: 'Approved nested repair' });
  await recovery.waitFor();
  await f.same(working);
  assert.deepEqual(await projectBytes(), saved);
  await f.snapshot('03-reselected-saved-repair');
  await f.runOracle({ first, approved, working, historical, current }, 'saved-versus-working-heights');
  f.report.observations.push({ pair, choices, historical, current, source: sha256(firstBytes), approved: sha256(approvedBytes),
    saved: saved.snapshots.map(sha256), heldReads: 1 });
  assert.deepEqual(f.report.downloads, []);
});
