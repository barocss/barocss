// D615 actual Studio workflow. Run under the heavy gate with source writes frozen.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(mode === undefined || mode === '--plan');
const planned = mode === '--plan';
const tasks = planned ? { base: 'p1', lid: 'p2' } : { base: 'base', lid: 'lid' };
await mkdir(output);
const pins = [
  'apps/cad-studio/test/task-run-delivery-browser.mjs',
  'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/test/fixtures/task-run-terminal.py',
  'apps/cad-studio/scripts/cad-cli.mjs',
  'apps/cad-studio/server/cadCli.ts',
  'apps/cad-studio/server/cadDoc.ts',
  ...['cli', 'store', 'host', 'thread', 'workerEntry', 'localPlan'].map(name => `apps/cad-studio/server/taskRun/${name}.ts`),
  ...['team/taskPlan', 'team/taskExecution', 'versions/approvedRequirements', 'print/export3mf', 'print/threemf']
    .map(name => `packages/barocss-cad-model/src/${name}.ts`),
];
const oracleSource = String.raw`
import collections, json, math, sys, xml.etree.ElementTree as ET, zipfile

d = json.load(sys.stdin)
expected = {'Base': ([0, 0, 0], [20, 10, 6], 1200), 'Lid': ([45, 0, 0], [57, 8, 5], 480)}
for doc, heights in zip(d['stages'], ([5, 3], [6, 3], [6, 4], [6, 5]), strict=True):
    assert len(doc['instances']) == 2
    for item, name, height in zip(doc['instances'], expected, heights, strict=True):
        lo, hi, _ = expected[name]
        rect, extrusion = item['doc']['nodes']
        assert item['name'] == name and item['position'] == lo and item['rotation'] == [0, 0, 0]
        assert rect['profile'] == 'rectangle' and rect['min'] == [0, 0]
        assert rect['max'] == [hi[0] - lo[0], hi[1] - lo[1]]
        assert extrusion['kind'] == 'extrude' and extrusion['height'] == height

with zipfile.ZipFile(d['file']) as archive:
    assert archive.testzip() is None
    root = ET.fromstring(archive.read('3D/3dmodel.model'))
ns = {'c': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
assert root.get('unit') == 'millimeter'
objects = root.findall('c:resources/c:object', ns)
items = root.findall('c:build/c:item', ns)
assert len(objects) == len(items) == 2
assert len({o.get('id') for o in objects}) == 2
assert {i.get('objectid') for i in items} == {o.get('id') for o in objects}
for item in items:
    transform = item.get('transform')
    assert transform is None or list(map(float, transform.split())) == [1,0,0,0,1,0,0,0,1,0,0,0]

measurements = {}
for obj in objects:
    name = obj.get('name').split(' / ')[0]
    assert name not in measurements and name in expected
    mesh = obj.find('c:mesh', ns)
    vs = [tuple(float(v.get(axis)) for axis in 'xyz') for v in mesh.findall('c:vertices/c:vertex', ns)]
    faces = [tuple(int(t.get(k)) for k in ('v1', 'v2', 'v3')) for t in mesh.findall('c:triangles/c:triangle', ns)]
    assert len(set(vs)) == 8 and len(faces) == 12
    edge_use = collections.Counter()
    terms = []
    for face in faces:
        assert len(set(face)) == 3 and all(0 <= k < len(vs) for k in face)
        a, b, c = (vs[k] for k in face)
        edge_use.update([(a, b), (b, c), (c, a)])
        terms.append(a[0]*(b[1]*c[2]-b[2]*c[1]) + a[1]*(b[2]*c[0]-b[0]*c[2]) + a[2]*(b[0]*c[1]-b[1]*c[0]))
    assert all(count == edge_use[b, a] == 1 for (a, b), count in list(edge_use.items()))
    lo, hi = [list(extent(axis) for axis in zip(*vs)) for extent in (min, max)]
    volume = abs(math.fsum(terms) / 6)
    want_lo, want_hi, want_volume = expected[name]
    assert lo == want_lo and hi == want_hi and math.isclose(volume, want_volume, abs_tol=1e-8, rel_tol=0), (name, lo, hi, volume)
    measurements[name] = {'min': lo, 'max': hi, 'volumeMm3': volume, 'triangles': len(faces)}
assert set(measurements) == set(expected)
print(json.dumps({'status': 'PASS', 'unit': root.get('unit'), 'closedMeshObjects': measurements}))
`;
const f = await createFlow({
  name: 'task-run-delivery', envFrozen: planned ? 'D616_SOURCE_FROZEN' : 'D615_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, oracleSource,
  inspectorSource: `import { fixtureDoc, fixturePlan, fixtureLimits } from './test/task-run-fixture';
console.log(JSON.stringify({ doc: fixtureDoc(), plan: fixturePlan, limits: fixtureLimits }));`,
  qualification: planned ? 'Derive a local run from Studio Save and deliver both stated height changes' :
    'Two reviewed local worker tasks through editable Studio delivery and independent 3MF readback',
  limits: ['Two independent top-level extrusion-height tasks and one user edit. Controlled local workers.',
    'The 3MF bytes are captured at Studio’s export boundary before Chrome writes a download. The independent ZIP/XML reader checks the two placed prisms.'],
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = planned ? 'D616 planned delivery' : 'D615 worker delivery';
const argv = () => [process.execPath, join(f.app, 'scripts/cad-cli.mjs'), 'task-run'];
const run = join(output, 'run'), recordFile = join(run, 'run.json');
const record = async () => JSON.parse(await readFile(recordFile, 'utf8')).record;
async function cli(label, args, failure) {
  const [node, ...entry] = argv();
  const result = spawnSync(node, [...entry, ...args], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
  await writeFile(join(output, label + '.stdout.json'), result.stdout ?? '');
  await writeFile(join(output, label + '.stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, failure ? 1 : 0, result.error?.message ?? result.stderr);
  if (failure) { assert.match(result.stderr, failure); return; }
  return JSON.parse(result.stdout);
}
async function approve(task, file, receipt) {
  const result = spawnSync('python3', ['-I', join(f.app, 'test/fixtures/task-run-terminal.py'),
    'approve ' + receipt.candidateDigest.slice(0, 12), '{}', ...argv(), 'decide', run, 'approve-' + task, tasks[task], 'approve', '--review', file],
    { cwd: f.app, encoding: 'utf8', timeout: 90000 });
  await writeFile(join(output, task + '-approval.stdout.jsonl'), result.stdout ?? '');
  await writeFile(join(output, task + '-approval.stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const [confirmation, status] = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(confirmation.reviewedCandidate, receipt);
  assert.equal(status.outcome.code, 'RUN_ACCEPTED');
}
async function open(name, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer });
}
async function bounds(p1, p2) {
  await f.page.waitForFunction(([p1, p2]) => {
    const rows = window.__studioInstanceBounds?.();
    return rows?.length === 2 && rows.find(row => row.id === 'p1')?.max[2] === p1 && rows.find(row => row.id === 'p2')?.max[2] === p2;
  }, [p1, p2]);
}
async function reviewTask(task, file, receipt, baseline, before, after) {
  await open(task + '.bcad-candidate', await readFile(file));
  const review = panel().getByRole('region', { name: 'Worker candidate review', exact: true });
  await review.getByText(`Task ${tasks[task]} · ${receipt.scope.occurrence}/n1`, { exact: true }).waitFor();
  await review.getByText(receipt.attemptId, { exact: true }).waitFor();
  await review.getByText(receipt.candidateDigest.slice(0, 12), { exact: true }).waitFor();
  await review.getByText(`Height · ${before} mm → ${after} mm`, { exact: true }).waitFor();
  await review.getByRole('button', { name: 'Preview candidate', exact: true }).click();
  await bounds(6, task === 'base' ? 3 : 4);
  await f.same(baseline);
  await f.snapshot(task + '-review');
  await review.getByRole('button', { name: 'Show accepted model', exact: true }).click();
  await bounds(task === 'base' ? 5 : 6, 3);
}
async function checkApproval(receipt, accepted, before, after) {
  const region = panel().getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  await region.getByText(`Task ${receipt.taskId} · ${receipt.scope.occurrence} · ${receipt.proposalId} · Revision ${receipt.revision}`, { exact: true }).waitFor();
  assert.deepEqual(await region.getByRole('cell').allTextContents(), [`Fail · ${before} mm`, `Pass · ${after} mm`]);
  const details = region.locator('details');
  if (await details.getAttribute('open') === null) await details.getByText('Evidence revisions', { exact: true }).click();
  const event = accepted.history.find(entry => entry.kind === 'accept' && entry.proposal === receipt.proposalId);
  const actual = await details.locator('dd').allTextContents();
  assert.deepEqual(actual, [event.evidence_revisions.before, event.evidence_revisions.after]);
  return actual;
}
async function native(ref) {
  const bytes = await readFile(join(run, 'native', ref.sha256 + '.bcad'));
  assert.equal(sha256(bytes), ref.sha256);
  return bytes;
}
async function openProject() {
  if (!(await panel().isVisible())) await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}
async function projectFile(fileName = 'housing.bcad') {
  return Buffer.from(await f.page.evaluate(async ({ project, fileName }) => {
    const root = await navigator.storage.getDirectory();
    const directory = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    const file = await (await directory.getFileHandle(fileName)).getFile();
    return [...new Uint8Array(await file.arrayBuffer())];
  }, { project, fileName }));
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

  f.phase = 'start two local workers and review base in Studio';
  const fixture = await f.inspect('fixture', {}), source = join(output, 'seed.bcad'), config = join(output, 'config.json');
  let startArgs, savedSource;
  if (planned) {
    f.phase = 'save the source from Studio and derive its reviewed local run plan';
    await f.newPage();
    await open('seed.bcad', Buffer.from(JSON.stringify(fixture.doc)));
    await f.same(fixture.doc);
    await openProject();
    await button('Save').click();
    await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('seed.bcad', { exact: true }).waitFor();
    savedSource = await projectFile('seed.bcad');
    await writeFile(source, savedSource);
    const proposal = await cli('derived-plan', ['plan', source, tasks.base, tasks.lid]);
    assert.equal(proposal.sourceSHA256, sha256(savedSource));
    assert.deepEqual(proposal.targets.map(t => [t.id, t.requirementId, t.currentHeightMm, t.heightMm, t.toleranceMm]),
      [['p1', 'height', 5, 6, 0.001], ['p2', 'height', 3, 4, 0.001]]);
    await writeFile(config, await readFile(join(output, 'derived-plan.stdout.json')));
    await writeFile(source, Buffer.concat([savedSource, Buffer.from('\n')]));
    startArgs = ['start', run, '--plan', config];
    await cli('stale-plan-refused', startArgs, /native source bytes changed/);
    await assert.rejects(readdir(run), { code: 'ENOENT' });
    await writeFile(source, savedSource);
    f.report.observations.push({ plan: proposal, planSHA256: sha256(await readFile(config)), staleSourceRefusedBeforeWriter: true });
    f.phase = 'start the reviewed plan and preview both authored heights';
  } else {
    await writeFile(source, JSON.stringify(fixture.doc));
    await writeFile(config, JSON.stringify({ ...fixture, source, name: 'editable-delivery', budget: 8, heightsMm: { base: 6, lid: 4 } }));
    startArgs = ['start', run, config];
  }
  const started = await cli('start', startArgs), initial = await record();
  assert.deepEqual(started.tasks.map(task => task.phase), ['awaiting-decision', 'awaiting-decision']);
  if (planned) assert.equal(initial.state.specRevision, f.report.observations[0].plan.specRevision);
  const baselineBytes = await native(initial.accepted), baseline = JSON.parse(baselineBytes);
  const baseFile = join(output, 'base.bcad-candidate'), staleFile = join(output, 'lid-original.bcad-candidate');
  const { candidateReview: base } = await cli('base-export', ['review', run, tasks.base, baseFile]);
  const { candidateReview: stale } = await cli('lid-original-export', ['review', run, tasks.lid, staleFile]);
  assert.deepEqual(base.baseline, initial.accepted);
  assert.deepEqual(stale.baseline, initial.accepted);
  if (!planned) {
    await f.newPage();
    await open('seed.bcad', baselineBytes);
    await button('Project and versions').click();
  } else assert.deepEqual(baselineBytes, savedSource);
  await f.same(baseline);
  await reviewTask('base', baseFile, base, baseline, 5, 6);
  await approve('base', baseFile, base);

  f.phase = 'open first approval and refresh lid against its exact accepted file';
  const first = await record(), baseBytes = await native(first.accepted), approvedBase = JSON.parse(baseBytes);
  assert.deepEqual(first.commits.map(commit => commit.taskId), [tasks.base]);
  assert.deepEqual(first.commits[0].from, initial.accepted);
  assert.deepEqual(approvedBase.instances[1], baseline.instances[1]);
  assert.equal(first.state.tasks[1].phase, 'stale');
  const firstRecord = await readFile(recordFile), firstEntries = (await readdir(run)).sort();
  await cli('old-lid-refused', ['decide', run, 'old-lid', tasks.lid, 'approve', '--review', staleFile], /No current candidate/);
  assert.deepEqual(await readFile(recordFile), firstRecord);
  assert.deepEqual((await readdir(run)).sort(), firstEntries);
  const baseCheckpointFile = join(output, 'base.bcad-run');
  const { checkpoint: baseCheckpoint } = await cli('base-checkpoint', ['export', run, baseCheckpointFile]);
  await open('base.bcad-run', await readFile(baseCheckpointFile));
  await f.same(approvedBase);
  const basePins = await checkApproval(baseCheckpoint, approvedBase, 5, 6);
  await f.dismissToasts();
  await cli('lid-refresh', ['refresh', run, 'refresh-lid', tasks.lid]);
  const lidFile = join(output, 'lid.bcad-candidate');
  const { candidateReview: lid } = await cli('lid-export', ['review', run, tasks.lid, lidFile]);
  assert.deepEqual(lid.baseline, first.accepted);
  assert.notEqual(lid.attemptId, stale.attemptId);
  assert.notEqual(lid.submission.specRevision, stale.submission.specRevision);
  await reviewTask('lid', lidFile, lid, approvedBase, 3, 4);
  await approve('lid', lidFile, lid);

  f.phase = 'open both approvals and edit the working lid in place';
  const final = await record(), finalRecord = await readFile(recordFile), finalEntries = (await readdir(run)).sort();
  assert.deepEqual(final.commits.map(commit => commit.taskId), [tasks.base, tasks.lid]);
  assert.deepEqual(final.commits[0], first.commits[0]);
  assert.deepEqual(final.commits[1].from, first.accepted);
  assert.deepEqual(final.commits[1].to, final.accepted);
  assert.deepEqual(final.state.tasks.map(task => task.phase), ['completed', 'completed']);
  const approvedBytes = await native(final.accepted), approved = JSON.parse(approvedBytes);
  assert.deepEqual(approved.instances[0], approvedBase.instances[0]);
  const finalCheckpointFile = join(output, 'housing.bcad-run');
  const { checkpoint: finalCheckpoint } = await cli('final-checkpoint', ['export', run, finalCheckpointFile]);
  await open('housing.bcad-run', await readFile(finalCheckpointFile));
  await f.same(approved);
  await bounds(6, 4);
  const lidPins = await checkApproval(finalCheckpoint, approved, 3, 4);
  assert.equal(finalCheckpoint.from.sha256, first.accepted.sha256);
  await f.dismissToasts();
  await f.snapshot('both-tasks-approved');
  await button('Project and versions').click();
  await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Lid' }).click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByRole('button', { name: 'Edit part', exact: true }).click();
  const editing = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
  await editing.waitFor();
  await f.openFeatureEditor(1, 'lid extrusion');
  const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
  assert.equal(await distance.inputValue(), '4');
  await distance.fill('5');
  const oldLid = await f.doc();
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(oldLid);
  await f.closeEditor();
  const failing = f.page.locator('.req.fail[aria-label="Requirement height"]');
  await failing.waitFor();
  assert.match(await failing.innerText(), /5 \(want 4 ± 0\.001 mm\)/);
  await f.snapshot('working-lid-fails-at-5mm');
  const edited = structuredClone(approved);
  edited.instances[1].doc.nodes[1].height = 5;
  await editing.getByRole('button', { name: 'Finish', exact: true }).click();
  await editing.waitFor({ state: 'hidden' });
  await f.same(edited);
  await bounds(6, 5);
  if (!planned) await openProject();
  else await button('Project and versions').click();
  assert.deepEqual(await checkApproval(finalCheckpoint, approved, 3, 4), lidPins);
  await f.snapshot('working-edit-with-historical-approval');

  f.phase = 'save, reopen and independently read the edited assembly output';
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('housing.bcad', { exact: true }).waitFor();
  const saved = await projectFile();
  assert.deepEqual(JSON.parse(saved), edited);
  await writeFile(join(output, 'saved-housing.bcad'), saved);
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open housing.bcad', exact: true }).click();
  await f.same(edited);
  await bounds(6, 5);
  assert.equal(await panel().getByRole('region', { name: 'Worker checkpoint checks', exact: true }).count(), 0);
  await f.page.evaluate(() => {
    const makeURL = URL.createObjectURL, blobs = new Map(), click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (blob) {
      const url = makeURL.call(this, blob);
      if (blob.type === 'model/3mf') blobs.set(url, blob);
      return url;
    };
    HTMLAnchorElement.prototype.click = function () {
      const blob = blobs.get(this.href);
      if (!blob || !this.download.endsWith('.3mf')) return click.call(this);
      window.__d615Export = blob.arrayBuffer().then(buffer => ({ name: this.download, bytes: [...new Uint8Array(buffer)] }));
      blobs.delete(this.href);
    };
  });
  await button('Export 3MF').click();
  await f.waitToast(/3MF written: 2 bodies/);
  const emitted = await f.page.evaluate(() => window.__d615Export);
  assert.equal(emitted.name, 'housing.3mf');
  const mesh = Buffer.from(emitted.bytes), file = join(output, emitted.name);
  await writeFile(file, mesh);
  await f.runOracle({ file, stages: [baseline, approvedBase, approved, JSON.parse(saved)] }, 'delivery-oracle');
  assert.deepEqual(await readFile(recordFile), finalRecord);
  assert.deepEqual((await readdir(run)).sort(), finalEntries);
  assert.deepEqual(await native(initial.accepted), baselineBytes);
  assert.deepEqual(await native(first.accepted), baseBytes);
  assert.deepEqual(await native(final.accepted), approvedBytes);
  assert.deepEqual(await projectFile(), saved);
  if (planned) {
    assert.deepEqual(await projectFile('seed.bcad'), savedSource);
    assert.deepEqual(await readFile(source), savedSource);
  }
  assert.deepEqual(f.report.downloads, []);
  await f.snapshot('reopened-working-output');
  f.report.observations.push({ commits: final.commits.map(commit => commit.taskId), priorLidRefused: true,
    firstApprovedSHA256: first.accepted.sha256, finalApprovedSHA256: final.accepted.sha256, editedSHA256: sha256(saved), meshSHA256: sha256(mesh),
    stages: [[5, 3], [6, 3], [6, 4], [6, 5]], basePins, lidPins, originalNativeFilesUnchanged: true, workerStoreUnchangedByStudio: true });
});
