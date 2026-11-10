import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an artifact directory outside the worktree');
const pins = [
  'apps/cad-studio/test/task-run-browser.mjs',
  'apps/cad-studio/test/task-run-fixture.ts',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/server/taskRun/host.ts',
  'apps/cad-studio/server/taskRun/store.ts',
  'apps/cad-studio/server/taskRun/thread.ts',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/app/editInPlace.ts',
  'apps/cad-studio/src/files/useStudioDocumentFiles.ts',
  'apps/cad-studio/src/storage/useProject.ts',
  'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/engine/container.ts',
  'packages/barocss-cad-model/src/team/taskExecution.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { outputOf } from '@barocss/cad-model/api/outputs';
import type { Bom } from '@barocss/cad-model/bom/core';
import { userToken } from '@barocss/cad-model/team/ecr';
import { TaskRunHost } from './server/taskRun/host';
import { serveTaskThread, threadWorker, type ThreadStart, type ThreadFinish } from './server/taskRun/thread';
import { fixtureDoc, fixturePlan, fixtureLimits } from './test/task-run-fixture';

let revision = 0;
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, ++revision);
if (!(await serveTaskThread(evaluate))) {
  const { directory, file, bomFile } = JSON.parse(process.argv[3]);
  const host = await TaskRunHost.create(directory, 'studio-housing', fixtureDoc(), fixturePlan, fixtureLimits, 8, evaluate);
  const initial = host.snapshot.accepted;
  const gate = new SharedArrayBuffer(4), value = new Int32Array(gate);
  const starts: ThreadStart[] = [], finishes: ThreadFinish[] = [];
  let ready!: () => void;
  const both = new Promise<void>(resolve => { ready = resolve; });
  const options = { gate, nativeGate: new SharedArrayBuffer(4), onStart(event: ThreadStart) { starts.push(event); if (starts.length === 2) ready(); },
    onFinish(event: ThreadFinish) { finishes.push(event); } };
  const module = new URL(import.meta.url);
  const a = host.dispatch('base-attempt', 'base', threadWorker(module, 6, options));
  const b = host.dispatch('lid-attempt', 'lid', threadWorker(module, 4, options));
  const approval = (taskId: string, operationId: string) => {
    const record = host.snapshot, task = record.state.tasks.find(t => t.id === taskId)!;
    assert.ok(task.candidate && task.attempt);
    return { taskId, operationId, runId: record.runId, epoch: record.epoch, attemptId: task.attempt.id, specRevision: task.candidate.specRevision,
      candidateDigest: task.candidate.candidateDigest, approved: true };
  };
  try {
    await Promise.race([both, Promise.race([a, b]).then(() => assert.fail('Expected two live worker threads.'))]);
    assert.deepEqual(host.snapshot.accepted, initial);
    assert.equal(new Set(starts.map(event => event.threadId)).size, 2);
    Atomics.store(value, 0, 1); Atomics.notify(value, 0);
    assert.deepEqual((await Promise.all([a, b])).map(result => result.phase), ['completed', 'completed']);
    assert.ok(Math.max(...finishes.map(event => event.nativeStartedAt)) < Math.min(...finishes.map(event => event.finishedAt)));
    const base = approval('base', 'approve-base'), oldLid = approval('lid', 'old-lid');
    assert.equal((await host.decide(base, userToken('2026-11-11T00:00:00Z'))).code, 'RUN_ACCEPTED');
    assert.equal((await host.decide(oldLid, userToken('2026-11-11T00:00:01Z'))).code, 'RUN_DECISION_STALE');
    assert.equal((await host.refresh('rebuild-lid', 'lid')).phase, 'completed');
    assert.equal((await host.decide(approval('lid', 'approve-lid'), userToken('2026-11-11T00:00:02Z'))).code, 'RUN_ACCEPTED');
    assert.deepEqual(host.snapshot.commits.map(commit => commit.taskId), ['base', 'lid']);
  } finally {
    Atomics.store(value, 0, 1); Atomics.notify(value, 0);
    await Promise.allSettled([a, b]);
    host.close();
  }
  const restored = await TaskRunHost.open(directory, evaluate);
  try {
    writeFileSync(file, restored.acceptedBytes);
    const recovered = await readStudioFile(restored.acceptedBytes);
    assert.ok(!('error' in recovered));
    const output = await outputOf(recovered.doc, 'output_bom'), bom = output.bom as Bom;
    const [artifact] = output.files as { path: string; text: string; sha256: string }[];
    assert.equal(bom.totalQty, 2);
    assert.deepEqual(bom.lines.flatMap(line => line.parts).sort(), ['p1', 'p2']);
    assert.deepEqual(bom.lines.map(line => [line.parts[0], line.mass]).sort(), [['p1', 3.24], ['p2', 1.037]]);
    assert.equal(artifact.path, 'bom.json');
    assert.equal(typeof artifact.text, 'string');
    writeFileSync(bomFile, artifact.text);
    console.log(JSON.stringify({ initial, starts, finishes, recovered: restored.snapshot, bom }));
  } finally { restored.close(); }
}
`;
const f = await createFlow({
  name: 'task-run', envFrozen: 'D586_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, inspectorSource,
  qualification: 'D586 two local native worker threads and desktop Studio consumption of the recovered accepted document',
  limits: ['Approvals occur in the local test host.', 'Studio exercises its existing native file, part editor and browser project controls.'],
});
const fileName = 'D586-two-worker-housing.bcad', projectName = 'D586 local run';
const button = name => f.page.getByRole('button', { name, exact: true });
const instance = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name });
async function open(bytes) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: fileName, mimeType: 'application/json', buffer: bytes });
}
async function checkAssembly(label, doc, lidHeight) {
  await instance('Base').waitFor();
  await instance('Lid').waitFor();
  await f.ready();
  await f.page.waitForFunction(height => {
    const bounds = window.__studioInstanceBounds?.();
    return bounds?.length === 2 && bounds.find(item => item.id === 'p1')?.max[2] === 6
      && bounds.find(item => item.id === 'p2')?.max[2] === height;
  }, lidHeight);
  const capture = await f.snapshot(label, () => ({ placed: window.__studioInstanceBounds() }));
  assert.deepEqual(capture.doc, doc);
  assert.deepEqual(capture.placed.map(({ id, min, max }) => [id, min, max]).sort(), [
    ['p1', [0, 0, 0], [20, 10, 6]], ['p2', [45, 0, 0], [57, 8, lidHeight]],
  ]);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  const file = join(f.output, fileName);
  f.phase = 'local run with two native threads';
  const bomFile = join(f.output, 'bom.json');
  const host = await f.inspect('native-task-run', {}, { file, bomFile, directory: join(f.output, 'run') });
  const bytes = await readFile(file), approved = JSON.parse(bytes);
  assert.equal(sha256(bytes), host.recovered.accepted.sha256);
  assert.deepEqual(host.recovered.commits.map(commit => commit.taskId), ['base', 'lid']);
  assert.deepEqual(host.recovered.state.tasks.map(task => task.candidate.geometry.volumeMm3), [1200, 384]);
  f.report.files.push({ file, hash: sha256(bytes), source: 'Recovered TaskRunHost' });
  const bomBytes = await readFile(bomFile), report = JSON.parse(bomBytes);
  assert.equal(report.bom.totalQty, 2);
  const masses = [20 * 10 * 6, 12 * 8 * 4].map(volume => Math.round(volume * 2.7) / 1000);
  assert.deepEqual(report.bom.lines.map(line => [line.parts[0], line.mass]).sort(), [['p1', masses[0]], ['p2', masses[1]]]);
  assert.ok(Math.abs(report.bom.totalMass - (masses[0] + masses[1])) < 1e-9);
  f.report.files.push({ file: bomFile, hash: sha256(bomBytes), source: 'Existing BOM output' });
  f.report.observations.push({ label: 'native worker traces and receipts', ...host });

  f.phase = 'Open the recovered native document';
  await f.newPage();
  await open(bytes);
  await checkAssembly('01-two-accepted-parts', approved, 4);

  f.phase = 'Edit the lid in Studio';
  await instance('Lid').click();
  await f.page.getByRole('complementary', { name: 'Instance', exact: true }).getByRole('button', { name: 'Edit part', exact: true }).click();
  const editing = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
  await editing.waitFor();
  await f.openFeatureEditor(1, 'lid extrusion');
  const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
  assert.equal(await distance.inputValue(), '4');
  await distance.fill('5');
  const before = await f.doc();
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(before);
  await f.closeEditor();
  const lid = await f.snapshot('02-edited-lid');
  assert.equal(lid.bodies.bodies.length, 1);
  assert.ok(Math.abs(lid.bodies.bodies[0].volume - 480) < 1e-8);
  await editing.getByRole('button', { name: 'Finish', exact: true }).click();
  await editing.waitFor({ state: 'hidden' });
  const edited = structuredClone(approved);
  edited.instances[1].doc.nodes[1].height = 5;
  await checkAssembly('03-edited-assembly', edited, 5);

  f.phase = 'Save the edited assembly in the browser project';
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  const saved = Buffer.from(await f.page.evaluate(async ({ projectName, fileName }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await project.getFileHandle(fileName)).getFile()).arrayBuffer())];
  }, { projectName, fileName }));
  assert.deepEqual(JSON.parse(saved), edited);
  const savedFile = join(f.output, 'project-edited.bcad');
  await writeFile(savedFile, saved);
  f.report.files.push({ file: savedFile, hash: sha256(saved), source: 'OPFS', semanticEquality: true });

  f.phase = 'Open the saved project bytes in a fresh session';
  await f.newPage();
  await open(saved);
  await checkAssembly('04-fresh-edited-open', edited, 5);
  assert.deepEqual(f.report.downloads, []);
});
