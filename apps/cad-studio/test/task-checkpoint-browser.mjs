import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, runDirectory] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok([output, runDirectory].every(path => path && isAbsolute(path) && relative(repo, path).startsWith('../')));
const pins = [
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/test/reference-open-fixture.ts',
  'apps/cad-studio/scripts/cad-cli.mjs',
  'apps/cad-studio/server/cadCli.ts',
  'apps/cad-studio/server/cadDoc.ts',
  'apps/cad-studio/server/taskRun/cli.ts',
  'apps/cad-studio/server/taskRun/store.ts',
  'apps/cad-studio/src/files/taskCheckpoint.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/team/taskPlan.ts',
  'packages/barocss-cad-model/src/team/taskExecution.ts',
  'packages/barocss-cad-model/src/versions/approvedRequirements.ts',
];
const oracleSource = String.raw`
import json, sys
d = json.load(sys.stdin)
for stage, heights in [('before', [6, 3]), ('accepted', [6, 4])]:
    for i, (part, h) in enumerate(zip(d[stage]['instances'], heights, strict=True)):
        rect, extrusion = part['doc']['nodes']
        assert rect['kind'] == 'sketch' and rect['profile'] == 'rectangle'
        assert extrusion['kind'] == 'extrude' and extrusion['height'] == h
        w, z = (b - a for a, b in zip(rect['min'], rect['max'], strict=True))
        assert [w, z] == ([20, 10] if i == 0 else [12, 8])
        assert w*z*h == (1200 if i == 0 else (288 if stage == 'before' else 384))
print(json.dumps({'status':'PASS', 'independentVolumeChecks':4}))
`;
const f = await createFlow({ name: 'task-checkpoint', envFrozen: 'D611_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  inspectorSource: `import { referenceOpenFixtures } from './test/reference-open-fixture';
console.log(JSON.stringify(referenceOpenFixtures().lost));`,
  qualification: 'Real task-run checkpoint export, verified Studio Open and native project Save/reopen',
  limits: ['D600 local worker store, ordinary rectangular prisms, no external model or provider.'] });
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const project = 'D611 worker intake', name = 'housing';

async function open(file, buffer) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/octet-stream', buffer });
}
async function openProject() {
  if (!(await panel().isVisible())) await button('Project and versions').click();
  await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor();
}
const projectFile = async (file, versions = false) => Buffer.from(await f.page.evaluate(async ({ project, file, versions }) => {
  const opfs = await navigator.storage.getDirectory();
  let dir = await (await opfs.getDirectoryHandle('projects')).getDirectoryHandle(project);
  if (versions) dir = await (await dir.getDirectoryHandle('.barocss')).getDirectoryHandle('versions');
  const saved = await (await dir.getFileHandle(file)).getFile();
  return Array.from(new Uint8Array(await saved.arrayBuffer()));
}, { project, file, versions }));
const notice = title => f.page.getByRole('alert').filter({ hasText: title });
async function dismiss(title) {
  await notice(title).getByRole('button', { name: 'Dismiss', exact: true }).click();
  await notice(title).waitFor({ state: 'hidden' });
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const create = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await create({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'export a real durable worker checkpoint without taking its writer lease';
  const recordPath = join(runDirectory, 'run.json'), recordBytes = await readFile(recordPath);
  const oldEntries = (await readdir(runDirectory)).sort();
  const record = JSON.parse(recordBytes).record, commit = record.commits.at(-1);
  const filename = join(output, name + '.bcad-run');
  const cli = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'export', runDirectory, filename],
    { cwd: f.app, encoding: 'utf8', timeout: 30000 });
  await writeFile(join(output, 'cli.stdout.json'), cli.stdout ?? '');
  await writeFile(join(output, 'cli.stderr.txt'), cli.stderr ?? '');
  assert.equal(cli.status, 0, cli.error?.message ?? cli.stderr);
  const { checkpoint } = JSON.parse(cli.stdout);
  assert.deepEqual([checkpoint.runId, checkpoint.revision, checkpoint.taskId, checkpoint.candidateDigest],
    [record.runId, record.revision, 'lid', commit.candidateDigest]);
  const beforeBytes = await readFile(join(runDirectory, 'native', checkpoint.from.sha256 + '.bcad'));
  const acceptedBytes = await readFile(join(runDirectory, 'native', checkpoint.accepted.sha256 + '.bcad'));
  const before = JSON.parse(beforeBytes), accepted = JSON.parse(acceptedBytes), bytes = await readFile(filename);
  const headEnd = 16 + bytes.readUInt32LE(8), acceptedStart = headEnd + bytes.readUInt32LE(12);
  assert.deepEqual(bytes.subarray(headEnd, acceptedStart), beforeBytes);
  assert.deepEqual(bytes.subarray(acceptedStart), acceptedBytes);
  assert.deepEqual([sha256(beforeBytes), sha256(acceptedBytes)], [commit.from.sha256, commit.to.sha256]);
  await f.runOracle({ before, accepted }, 'checkpoint-oracle');

  f.phase = 'refuse a changed native payload while the existing project and version stay open';
  await f.newPage();
  await open('original.bcad', beforeBytes);
  await f.same(before);
  await openProject();
  await panel().getByRole('textbox', { name: 'Version name', exact: true }).fill('Before checkpoint');
  await panel().getByRole('button', { name: 'Make version', exact: true }).click();
  await panel().getByRole('listitem', { name: 'Version Before checkpoint', exact: true }).waitFor();
  const savedBefore = await projectFile('original.bcad'), logBefore = await projectFile('original.bcad.json', true);
  const corrupt = Buffer.from(bytes);
  corrupt[acceptedStart + 2] ^= 1;
  await open('corrupt.bcad-run', corrupt);
  await notice('The native files do not match the worker checkpoint.').waitFor();
  await f.same(before);
  assert.deepEqual(await projectFile('original.bcad'), savedBefore);
  assert.deepEqual(await projectFile('original.bcad.json', true), logBefore);
  await f.snapshot('01-corrupt-checkpoint-refused');
  await dismiss('Could not open the worker checkpoint');

  f.phase = 'retire a decoded Worker proof when a newer file opens';
  await f.page.evaluate(async () => {
    const { EngineClient } = await import('/src/engine/client.ts');
    const original = EngineClient.prototype.part;
    let release, completed = 0, armed = true;
    EngineClient.prototype.part = async function (doc, revision, slot) {
      const capture = armed && slot === 'read';
      if (capture) armed = false;
      const result = await original.call(this, doc, revision, slot);
      if (capture) {
        if (!result?.ok) throw new Error('Expected a native Worker result');
        await new Promise(resolve => { release = resolve; });
        completed++;
      }
      return result;
    };
    window.__d611Hold = { held: () => !!release, release: () => release(), completed: () => completed };
  });
  await open('retired.bcad-run', bytes);
  await f.page.waitForFunction(() => window.__d611Hold.held());
  const newer = structuredClone(before);
  newer.instances[1].doc.nodes[1].height = 5;
  await open('newer.bcad', Buffer.from(JSON.stringify(newer)));
  await f.same(newer);
  await f.page.evaluate(() => window.__d611Hold.release());
  await f.page.waitForFunction(() => window.__d611Hold.completed() === 1);
  await f.same(newer);
  assert.equal(await notice('Worker checkpoint opened').count(), 0);
  await f.snapshot('02-retired-checkpoint');

  f.phase = 'open the verified task and check its placed geometry';
  const lost = await f.inspect('lost-reference-input', {});
  await open('held-reference.bcad', Buffer.from(JSON.stringify(lost)));
  await f.page.waitForFunction(() => window.__studioDoc?.nodes[4]?.held && window.__studioDoc.nodes[4].suppressed);
  const references = f.page.getByRole('region', { name: 'References', exact: true });
  await references.getByText(/Feature held/).waitFor();
  await open(name + '.bcad-run', bytes);
  const opened = notice('Worker checkpoint opened');
  await opened.getByText('Task lid · Revision ' + record.revision + ' · 1 required checks passed', { exact: true }).waitFor();
  await opened.getByText('Details', { exact: true }).click();
  await opened.getByText('Accepted model SHA-256 ' + checkpoint.accepted.sha256, { exact: true }).waitFor();
  await f.same(accepted);
  await references.waitFor({ state: 'hidden' });
  await f.page.waitForFunction(() => window.__studioInstanceBounds?.().find(item => item.id === 'p2')?.max[2] === 4);
  const image = await f.snapshot('03-checkpoint-opened', () => ({ bounds: window.__studioInstanceBounds?.() }));
  assert.deepEqual(image.bounds.map(({ id, min, max }) => [id, min, max]).sort(),
    [['p1', [0, 0, 0], [20, 10, 6]], ['p2', [45, 0, 0], [57, 8, 4]]]);
  await dismiss('Worker checkpoint opened');

  f.phase = 'save and reopen the exact native model through the existing browser project';
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText('housing.bcad', { exact: true }).waitFor();
  assert.deepEqual(await projectFile('housing.bcad'), acceptedBytes);
  await f.page.reload();
  await f.ready();
  await openProject();
  await panel().getByRole('button', { name: 'Open housing.bcad', exact: true }).click();
  await f.same(accepted);
  assert.deepEqual(await projectFile('original.bcad'), savedBefore);
  assert.deepEqual(await projectFile('original.bcad.json', true), logBefore);
  assert.deepEqual(await readFile(recordPath), recordBytes);
  assert.deepEqual((await readdir(runDirectory)).sort(), oldEntries);
  assert.deepEqual(f.report.downloads, []);
  await f.snapshot('04-reopened-native');
  f.report.observations.push({ checkpointSHA256: sha256(bytes), recordSHA256: sha256(recordBytes), checkpoint,
    payloadBytes: [beforeBytes.length, acceptedBytes.length], originalProjectUnchanged: true, lateReadDiscarded: true,
    nativeReopenEqual: true, previousReferenceRowsCleared: true, workerStoreUnchanged: true });
});
