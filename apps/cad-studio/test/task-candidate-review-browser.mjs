import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === undefined || mode === '--decision');
const decisionMode = mode === '--decision';
const pins = [
  'apps/cad-studio/test/task-candidate-review-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/test/fixtures/task-run-terminal.py',
  'apps/cad-studio/scripts/cad-cli.mjs',
  'apps/cad-studio/server/taskRun/cli.ts',
  'apps/cad-studio/server/taskRun/store.ts',
  'apps/cad-studio/server/taskRun/host.ts',
  'apps/cad-studio/server/taskRun/thread.ts',
  'apps/cad-studio/server/taskRun/workerEntry.ts',
  'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/src/files/taskCandidateReview.ts',
  'apps/cad-studio/src/viewport/instanceEvaluation.ts',
  'packages/barocss-cad-model/src/team/taskPlan.ts',
  'packages/barocss-cad-model/src/team/taskExecution.ts',
];
const f = await createFlow({ name: 'task-candidate-review', envFrozen: decisionMode ? 'D614_SOURCE_FROZEN' : 'D613_SOURCE_FROZEN',
  output, initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `import assert from 'node:assert/strict';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { userToken } from '@barocss/cad-model/team/ecr';
import { TaskRunHost } from './server/taskRun/host';
import { fixtureDoc, fixturePlan, fixtureLimits } from './test/task-run-fixture';
if (!process.argv[3]) console.log(JSON.stringify({ doc: fixtureDoc(), plan: fixturePlan, limits: fixtureLimits }));
else {
  const { run, task } = JSON.parse(process.argv[3]);
  const host = await TaskRunHost.open(run, async doc => evaluatePart(doc, 1));
  try {
    const until = host.snapshot.state.tasks.find(item => item.id === task)?.attempt?.leaseUntil;
    assert.equal(typeof until, 'number');
    const start = host.snapshot.state.sequence;
    assert.ok(until >= start && until - start < 30);
    for (let step = start; step <= until; step++) {
      assert.equal(host.control('advance-for-review-' + step, 'tick', userToken(new Date().toISOString())).phase, 'completed');
    }
    console.log(JSON.stringify({ start, until, sequence: host.snapshot.state.sequence }));
  } finally { host.close(); }
}`,
  oracleSource: String.raw`
import json, sys
d = json.load(sys.stdin)
base, lid = d['baseline']['instances']
assert base['position'] == [0,0,0] and lid['position'] == [45,0,0]
assert base['doc']['nodes'][0]['min'] == [0,0] and base['doc']['nodes'][0]['max'] == [20,10]
assert base['doc']['nodes'][1]['height'] == 5 and d['candidateHeight'] == 6
assert lid['doc']['nodes'][1]['height'] == 3
assert 20*10*(d['candidateHeight']-5) == 200
print(json.dumps({'status':'PASS','baselineVolumeMm3':1000,'candidateVolumeMm3':1200,'changeMm3':200}))
`,
  qualification: decisionMode ? 'Bind terminal approval to the exact reviewed Studio candidate' :
    'Review a pending local worker candidate in Studio without publishing it',
  limits: ['Two local worker fixture tasks, one independent extrusion-height candidate. The terminal remains the decision authority.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const review = () => panel().getByRole('region', { name: 'Worker candidate review', exact: true });
const notice = message => f.page.getByRole('alert').filter({ hasText: message });
const project = 'D613 candidate review';
const file = 'baseline.bcad';
const localFile = async (name, version = false) => Buffer.from(await f.page.evaluate(async ({ project, name, version }) => {
  const root = await navigator.storage.getDirectory();
  let dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
  if (version) dir = await (await dir.getDirectoryHandle('.barocss')).getDirectoryHandle('versions');
  return Array.from(new Uint8Array(await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer()));
}, { project, name, version }));
async function open(name, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer });
}
async function bounds(height) {
  await f.page.waitForFunction(height => {
    const values = window.__studioInstanceBounds?.();
    return values?.length === 2 && values.find(item => item.id === 'p1')?.max[2] === height &&
      values.find(item => item.id === 'p2')?.max[2] === 3;
  }, height);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin, create = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await create({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const cli = async (label, ...args) => {
    const run = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', ...args],
      { cwd: f.app, encoding: 'utf8', timeout: 30000 });
    await writeFile(join(output, label + '.stdout.json'), run.stdout ?? '');
    await writeFile(join(output, label + '.stderr.txt'), run.stderr ?? '');
    assert.equal(run.status, 0, run.error?.message ?? run.stderr);
    return JSON.parse(run.stdout);
  };
  f.phase = 'stage and export one real pending worker task';
  const fixture = await f.inspect('worker-fixture', {}), source = join(output, 'seed.bcad');
  const config = join(output, 'run-config.json'), run = join(output, 'run'), manifest = join(output, 'base.bcad-candidate');
  await writeFile(source, JSON.stringify(fixture.doc));
  await writeFile(config, JSON.stringify({ ...fixture, source, name: 'studio-candidate', budget: 8, heightsMm: { base: 6, lid: 4 } }));
  const started = await cli('task-start', 'start', run, config);
  assert.deepEqual(started.tasks.map(task => task.phase), ['awaiting-decision', 'awaiting-decision']);
  const recordFile = join(run, 'run.json'), recordBytes = await readFile(recordFile), storeEntries = (await readdir(run)).sort();
  const record = JSON.parse(recordBytes).record;
  assert.deepEqual(record.commits, []);
  const { candidateReview } = await cli('task-review', 'review', run, 'base', manifest);
  assert.deepEqual(candidateReview.baseline, record.accepted);
  assert.equal(candidateReview.candidateDigest, started.tasks[0].candidateDigest);
  const native = join(run, 'native', record.accepted.sha256 + '.bcad'), baselineBytes = await readFile(native), receipt = await readFile(manifest);
  const baseline = JSON.parse(baselineBytes);
  await f.runOracle({ baseline, candidateHeight: candidateReview.submission.heightMm }, 'candidate-geometry');

  f.phase = 'open the exact baseline and save its existing version';
  await f.newPage();
  await open(file, baselineBytes);
  await f.same(baseline);
  await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByRole('textbox', { name: 'Version name', exact: true }).fill('Accepted baseline');
  await panel().getByRole('button', { name: 'Make version', exact: true }).click();
  await panel().getByRole('listitem', { name: 'Version Accepted baseline', exact: true }).waitFor();
  const originalLog = await localFile(file + '.json', true);
  assert.deepEqual(await localFile(file), baselineBytes);

  f.phase = 'show only the candidate occurrence while the working document stays accepted';
  await open('base.bcad-candidate', receipt);
  await review().getByText('Task base · p1/n1', { exact: true }).waitFor();
  await review().getByText(candidateReview.candidateDigest.slice(0, 12), { exact: true }).waitFor();
  await review().getByText(candidateReview.attemptId, { exact: true }).waitFor();
  await review().getByText('Height · 5 mm → 6 mm', { exact: true }).waitFor();
  await review().getByText('Volume change · +200 mm³', { exact: true }).waitFor();
  assert.match(await review().getByRole('list', { name: 'Candidate checks', exact: true }).innerText(), /height · Pass · 6 ± 0\.001 mm/);
  assert.equal(await review().getByRole('button', { name: /Approve|Accept|Reject/ }).count(), 0);
  await f.same(baseline);
  await bounds(5);
  await review().getByRole('button', { name: 'Preview candidate', exact: true }).click();
  await bounds(6);
  await f.same(baseline);
  await f.snapshot('01-placed-candidate');
  await button('Save').click();
  await review().getByRole('button', { name: 'Show accepted model', exact: true }).click();
  await bounds(5);
  await review().getByRole('button', { name: 'Preview candidate', exact: true }).click();
  await bounds(6);
  await panel().getByRole('button', { name: 'Collapse Project & versions', exact: true }).click();
  await review().waitFor({ state: 'hidden' });
  await bounds(5);
  await panel().getByRole('button', { name: 'Expand Project & versions', exact: true }).click();
  await review().getByRole('button', { name: 'Preview candidate', exact: true }).waitFor();
  await review().getByRole('button', { name: 'Preview candidate', exact: true }).click();
  await bounds(6);
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Lid' }).click();
  await button('Display and previews').click();
  await button('Isolate selection').click();
  await bounds(5);
  assert.equal(await review().getByRole('button', { name: 'Preview candidate', exact: true }).isDisabled(), true);
  await button('Restore view').click();
  await button('Display and previews').click();
  assert.equal(await review().getByRole('button', { name: 'Preview candidate', exact: true }).isEnabled(), true);
  await bounds(5);
  await f.snapshot('02-accepted-model');

  f.phase = 'retire a held Worker read when another document opens';
  await f.page.evaluate(async () => {
    const { EngineClient } = await import('/src/engine/client.ts');
    const original = EngineClient.prototype.part, placed = EngineClient.prototype.placed;
    let release, completed = false, armed = true, candidatePlacements = 0;
    EngineClient.prototype.placed = function (doc, ...args) {
      if (doc.nodes.some(node => node.kind === 'extrude' && node.height === 6)) candidatePlacements++;
      return placed.call(this, doc, ...args);
    };
    EngineClient.prototype.part = async function (doc, revision, slot) {
      const capture = armed && slot === 'read';
      if (capture) armed = false;
      const result = await original.call(this, doc, revision, slot);
      if (capture) {
        if (!result?.ok) throw new Error('Expected a decoded native Worker result');
        await new Promise(resolve => { release = resolve; });
        setTimeout(() => { completed = true; }, 0);
      }
      return result;
    };
    window.__d613Hold = { held: () => !!release, release: () => release(), completed: () => completed, candidatePlacements: () => candidatePlacements };
  });
  await open('late.bcad-candidate', receipt);
  await f.page.waitForFunction(() => window.__d613Hold.held());
  const moved = structuredClone(baseline);
  moved.instances[1].doc.nodes[1].height = 5;
  await open('other.bcad', Buffer.from(JSON.stringify(moved)));
  await f.same(moved);
  await f.page.evaluate(() => window.__d613Hold.release());
  await f.page.waitForFunction(() => window.__d613Hold.completed());
  await review().waitFor({ state: 'hidden' });
  await open('stale.bcad-candidate', receipt);
  await notice('Open the exact native baseline of this worker candidate first.').waitFor();
  await f.same(moved);
  await review().waitFor({ state: 'hidden' });
  await f.snapshot('03-moved-baseline-refused');
  await f.undo(); await f.same(baseline); assert.equal(await review().count(), 0);
  assert.deepEqual(await localFile(file), baselineBytes);
  assert.deepEqual(await localFile(file + '.json', true), originalLog);
  assert.deepEqual(await readFile(recordFile), recordBytes);
  assert.deepEqual(await readFile(native), baselineBytes);
  assert.deepEqual((await readdir(run)).sort(), storeEntries);
  assert.equal(await f.page.evaluate(() => window.__d613Hold.candidatePlacements()), 0);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ receiptSHA256: sha256(receipt), recordSHA256: sha256(recordBytes), candidateReview,
    heights: { accepted: 5, candidate: 6, sibling: 3 }, lateReadDiscarded: true, staleBaselineRefused: true,
    projectBytesUnchanged: true, workerStoreUnchanged: true, noApprovalControls: true, isolationStopsPreview: true });

  if (decisionMode) {
    const argv = [process.execPath, join(f.app, 'scripts/cad-cli.mjs'), 'task-run'];
    const challenge = 'approve ' + candidateReview.candidateDigest.slice(0, 12);
    const terminal = async (label, options, ...args) => {
      const result = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'), challenge,
        JSON.stringify(options), ...argv, ...args], { cwd: f.app, encoding: 'utf8', timeout: 90000 });
      await writeFile(join(output, label + '.stdout.jsonl'), result.stdout ?? '');
      await writeFile(join(output, label + '.stderr.txt'), result.stderr ?? '');
      return result;
    };
    f.phase = 'refresh the reviewed task while a terminal confirmation is pending';
    const stale = await terminal('retired-terminal-review', { unchangedRecord: recordFile, beforeAnswer: [
      [process.execPath, f.inspector, source, JSON.stringify({ run, task: 'base' })],
      [...argv, 'refresh', run, 'refresh-reviewed-base', 'base'],
    ] }, 'decide', run, 'declined-review', 'base', 'approve', '--review', manifest);
    assert.equal(stale.status, 1, stale.error?.message ?? stale.stderr);
    assert.match(stale.stderr, /reviewed candidate differs from the current attempt/);
    const pending = JSON.parse(await readFile(recordFile, 'utf8')).record;
    assert.deepEqual(pending.accepted, record.accepted);
    assert.deepEqual(pending.commits, []);
    const refreshedFile = join(output, 'refreshed.bcad-candidate');
    const { candidateReview: freshReview } = await cli('refreshed-review', 'review', run, 'base', refreshedFile);
    assert.notEqual(freshReview.attemptId, candidateReview.attemptId);
    assert.equal(freshReview.candidateDigest, candidateReview.candidateDigest);
    assert.deepEqual(freshReview.submission, candidateReview.submission);
    const freshBytes = await readFile(refreshedFile);
    await open('refreshed.bcad-candidate', freshBytes);
    await review().getByText(freshReview.attemptId, { exact: true }).waitFor();
    await f.page.getByText('Could not review the worker candidate', { exact: true }).waitFor({ state: 'hidden' });
    await f.same(baseline);
    await f.snapshot('04-refreshed-studio-review');

    f.phase = 'approve exactly the refreshed review and reopen the published checkpoint in Studio';
    const approval = await terminal('accepted-terminal-review', {}, 'decide', run, 'accept-reviewed-base', 'base', 'approve', '--review', refreshedFile);
    assert.equal(approval.status, 0, approval.error?.message ?? approval.stderr);
    const [confirmed, result] = approval.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(confirmed.reviewedCandidate, freshReview);
    assert.equal(result.outcome.code, 'RUN_ACCEPTED');
    const published = JSON.parse(await readFile(recordFile, 'utf8')).record;
    assert.equal(published.commits.length, 1);
    assert.deepEqual([published.commits[0].operationId, published.commits[0].candidateDigest], ['accept-reviewed-base', freshReview.candidateDigest]);
    assert.deepEqual(published.commits[0].from, record.accepted);
    const path = join(output, 'reviewed-result.bcad-run');
    await cli('approved-checkpoint', 'export', run, path);
    const acceptedBytes = await readFile(join(run, 'native', published.accepted.sha256 + '.bcad'));
    const approved = JSON.parse(acceptedBytes);
    assert.deepEqual(approved.instances.map(instance => instance.doc.nodes[1].height), [6, 3]);
    await open('reviewed-result.bcad-run', await readFile(path));
    await f.same(approved);
    const checks = panel().getByRole('region', { name: 'Worker checkpoint checks', exact: true });
    await checks.getByText('Task base · p1 · P1 · Revision ' + published.revision, { exact: true }).waitFor();
    assert.deepEqual(await checks.getByRole('cell').allTextContents(), ['Fail · 5 mm', 'Pass · 6 mm']);
    await bounds(6);
    assert.equal(await review().count(), 0);
    await button('Save').click();
    await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('reviewed-result.bcad', { exact: true }).waitFor();
    assert.deepEqual(await localFile('reviewed-result.bcad'), acceptedBytes);
    assert.deepEqual(await localFile(file), baselineBytes);
    assert.deepEqual(await localFile(file + '.json', true), originalLog);
    await f.snapshot('05-published-reviewed-checkpoint');
    f.report.observations.push({ reviewDecision: { previousAttempt: candidateReview.attemptId, refreshedAttempt: freshReview.attemptId,
      candidateDigest: freshReview.candidateDigest, sameGeometryAndSpec: true, oldReceiptDeclined: true, approvals: 1,
      approvedSHA256: sha256(acceptedBytes), originalBaselineUnchanged: true, savedNativeMatches: true, placedHeights: [6, 3] } });
  }
});
