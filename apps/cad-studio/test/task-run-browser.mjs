import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an artifact directory outside the worktree');
assert.ok(mode === undefined || mode === '--evidence');
const evidenceMode = mode === '--evidence';
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
  'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'packages/barocss-cad-model/src/versions/approvedRequirements.ts',
  'apps/cad-studio/scripts/cad-mcp.mjs',
  'apps/cad-studio/server/cadMcp.ts',
  'packages/barocss-cad-model/src/chat/requirementEvidence.ts',
  'packages/barocss-cad-model/src/chat/outputs.ts',
];
const inspectorSource = String.raw`
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { outputOf } from '@barocss/cad-model/api/outputs';
import type { Bom } from '@barocss/cad-model/bom/core';
import { userToken } from '@barocss/cad-model/team/ecr';
import { TaskRunHost } from './server/taskRun/host';
import { TaskRunStore } from './server/taskRun/store';
import { digestOf } from '@barocss/cad-model/util/digest';
import { serveTaskThread, threadWorker, type ThreadStart, type ThreadFinish } from './server/taskRun/thread';
import { fixtureDoc, fixturePlan, fixtureLimits } from './test/task-run-fixture';

let revision = 0;
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, ++revision);
if (!(await serveTaskThread(evaluate))) {
  const { directory, file, bomFile, beforeLid } = JSON.parse(process.argv[3]);
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
    const snapshot = restored.snapshot;
    if (beforeLid) {
      const checkpoint = readFileSync(join(directory, 'run.json'));
      assert.deepEqual(TaskRunStore.inspect(directory), JSON.parse(JSON.stringify(snapshot)));
      assert.deepEqual(readFileSync(join(directory, 'run.json')), checkpoint);
      assert.equal(digestOf(recovered.doc), snapshot.accepted.modelDigest);
      const ref = snapshot.commits.at(-1)!.from;
      const bytes = readFileSync(join(directory, 'native', ref.sha256 + '.bcad'));
      const before = await readStudioFile(bytes);
      assert.ok(!('error' in before));
      assert.equal(digestOf(before.doc), ref.modelDigest);
      writeFileSync(beforeLid, bytes);
    }
    console.log(JSON.stringify({ initial, starts, finishes, recovered: snapshot, bom }));
  } finally { restored.close(); }
}
`;
const f = await createFlow({
  name: 'task-run', envFrozen: evidenceMode ? 'D600_SOURCE_FROZEN' : 'D586_SOURCE_FROZEN', output, initialFiles: pins, requiredFrozen: pins, inspectorSource,
  qualification: evidenceMode ? 'D600 checkpoint-bound requirement evidence and actual Studio saved version review'
    : 'D586 two local native worker threads and desktop Studio consumption of the recovered accepted document',
  limits: ['Approvals occur in the local test host.', 'Studio exercises its existing native file, part editor and browser project controls.'],
});
const fileName = evidenceMode ? 'D600-two-worker-housing.bcad' : 'D586-two-worker-housing.bcad';
const projectName = evidenceMode ? 'D600 worker evidence' : 'D586 local run';
const beforeVersion = 'Before lid approval', acceptedVersion = 'Lid approved', laterVersion = 'Later lid edit';
const button = name => f.page.getByRole('button', { name, exact: true });
const instance = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name });
const versionsPanel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
const proof = historical => versionsPanel().getByRole('region', {
  name: historical ? 'Saved approval checks' : 'Approved requirement checks', exact: true,
});
async function showVersions() {
  if (!(await versionsPanel().isVisible())) await button('Project and versions').click();
}
async function openProject() {
  await showVersions();
  const panel = versionsPanel();
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(projectName);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
}
async function projectBytes(replacement) {
  return Buffer.from(await f.page.evaluate(async ({ projectName, fileName, replacement }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const project = await projects.getDirectoryHandle(projectName);
    const handle = await project.getFileHandle(fileName);
    if (replacement) {
      const writer = await handle.createWritable();
      await writer.write(Uint8Array.from(replacement));
      await writer.close();
    }
    return [...new Uint8Array(await (await handle.getFile()).arrayBuffer())];
  }, { projectName, fileName, replacement: replacement ? [...replacement] : null }));
}
async function makeVersion(name) {
  await showVersions();
  const panel = versionsPanel();
  await panel.getByRole('textbox', { name: 'Version name', exact: true }).fill(name);
  await panel.getByRole('button', { name: 'Make version', exact: true }).click();
  await panel.getByRole('listitem', { name: 'Version ' + name, exact: true }).waitFor();
}
async function compare(name) {
  const panel = versionsPanel();
  await panel.getByRole('button', { name: 'Compare ' + name, exact: true }).click();
  await panel.getByRole('status', { name: 'Compared changes', exact: true }).waitFor();
}
async function checkRecovery(historical) {
  await proof(historical).getByLabel('Requirement occurrence', { exact: true }).selectOption('p2');
  await proof(historical).getByText('3 mm → 4 mm', { exact: true }).waitFor();
  assert.match(await proof(historical).textContent(), /P2.*height.*Fail → Pass/s);
}
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

const evidenceCall = (part, expectedRevision) => ({ action: 'evidence', part, ...(expectedRevision ? { expectedRevision } : {}) });
async function mcpEvidence(file, label, calls) {
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    ...calls.map((args, index) => ({ jsonrpc: '2.0', id: index + 2, method: 'tools/call', params: { name: 'requirements', arguments: args } })),
  ];
  const before = await readFile(file);
  const run = spawnSync(process.execPath, [join(f.app, 'scripts/cad-mcp.mjs'), '--doc', file], {
    input: requests.map(message => JSON.stringify(message) + '\n').join(''), encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(output, label + '-mcp.jsonl'), run.stdout ?? '');
  await writeFile(join(output, label + '-mcp.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  const replies = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(replies.map(reply => reply.id), requests.map(request => request.id));
  assert.equal(replies[0].result.serverInfo.version, 'barocss-cad-tools-v2');
  assert.deepEqual(await readFile(file), before);
  return replies.slice(1).map(({ result }) => {
    const reply = JSON.parse(result.content[0].text);
    if (result.isError) {
      assert.equal(reply.files, undefined);
      return reply;
    }
    assert.deepEqual(result.structuredContent, reply);
    const [artifact] = reply.files;
    assert.equal(artifact.path, 'requirement-evidence.json');
    assert.equal(artifact.sha256, sha256(artifact.text));
    assert.equal(artifact.bytes, Buffer.byteLength(artifact.text));
    const report = JSON.parse(artifact.text);
    assert.equal(report.revision, reply.revision);
    return report;
  });
}

function checkEvidence(report, part, measurement, target, verdict) {
  assert.deepEqual([report.format, report.version, report.part], ['barocss-requirement-evidence', 1, part]);
  const row = report.evidence.find(row => row.requirement?.id === 'height');
  assert.deepEqual([row.result.part, row.result.run, row.result.status, row.result.number, row.result.verdict, row.freshness.state],
    [part, report.revision, 'ok', measurement, verdict, 'current']);
  assert.deepEqual([row.requirement.check.value, row.requirement.check.unit, row.requirement.check.tol], [target, 'mm', 0.001]);
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
  const runDirectory = join(f.output, 'run'), beforeLid = evidenceMode ? join(f.output, 'before-lid.bcad') : undefined;
  const host = await f.inspect('native-task-run', {}, { file, bomFile, beforeLid, directory: runDirectory });
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

  const checkpoint = evidenceMode ? await readFile(join(runDirectory, 'run.json')) : null;
  const old = evidenceMode ? await readFile(beforeLid) : null;
  let acceptedLid, acceptedBase, beforeReport;
  await f.newPage();
  if (evidenceMode) {
    f.phase = 'bind the durable before and after checkpoints to real MCP reports';
    const [baseCommit, lidCommit] = host.recovered.commits;
    assert.deepEqual(lidCommit.from, baseCommit.to);
    assert.deepEqual(lidCommit.to, host.recovered.accepted);
    assert.equal(sha256(old), lidCommit.from.sha256);
    const lidTask = host.recovered.state.tasks.find(task => task.id === 'lid');
    assert.deepEqual(lidTask.candidate.scope, { occurrence: 'p2', feature: 'n1', field: 'height' });
    assert.equal(lidCommit.candidateDigest, lidTask.candidate.candidateDigest);
    assert.deepEqual([lidTask.candidate.checks[0].id, lidTask.candidate.checks[0].status, lidTask.candidate.checks[0].measured], ['height', 'pass', 4]);
    [beforeReport] = await mcpEvidence(beforeLid, 'before-lid', [evidenceCall('p2')]);
    [acceptedBase, acceptedLid] = await mcpEvidence(file, 'accepted', [evidenceCall('p1'), evidenceCall('p2')]);
    checkEvidence(beforeReport, 'p2', 3, 4, 'fail');
    checkEvidence(acceptedBase, 'p1', 6, 6, 'pass');
    checkEvidence(acceptedLid, 'p2', 4, 4, 'pass');
    assert.equal(acceptedBase.revision, acceptedLid.revision);
    assert.notEqual(beforeReport.revision, acceptedLid.revision);
    const decision = approved.history.find(entry => entry.kind === 'accept' && entry.proposal === lidTask.candidate.proposalId);
    assert.deepEqual(decision.evidence_revisions, { before: beforeReport.revision, after: acceptedLid.revision });

    f.phase = 'save the real pre-approval native checkpoint as a Studio version';
    await open(old);
    await checkAssembly('00-before-lid-approval', JSON.parse(old), 3);
    await openProject();
    await makeVersion(beforeVersion);
    assert.deepEqual(await projectBytes(), old);

    f.phase = 'deliver the accepted native file to the closed project';
    await versionsPanel().getByRole('button', { name: 'Close project', exact: true }).click();
    await versionsPanel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
    // A separate process would copy the accepted output to a local project folder.
    // The browser-project fixture uses OPFS for the same file handoff.
    assert.deepEqual(await projectBytes(bytes), bytes);
    await openProject();
  }

  f.phase = 'Open the recovered native document';
  if (evidenceMode) await versionsPanel().getByRole('button', { name: 'Open ' + fileName, exact: true }).click();
  else await open(bytes);
  await checkAssembly('01-two-accepted-parts', approved, 4);
  if (evidenceMode) {
    f.phase = 'review the worker approval in the existing Versions panel';
    await makeVersion(acceptedVersion);
    assert.deepEqual(await projectBytes(), bytes);
    await compare(beforeVersion);
    await checkRecovery(false);
    await f.same(approved);
    await f.snapshot('01-worker-approval');
    await button('Project and versions').click();
  }

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
  if (evidenceMode) await f.page.locator('.req.fail[aria-label="Requirement height"]').waitFor();
  await editing.getByRole('button', { name: 'Finish', exact: true }).click();
  await editing.waitFor({ state: 'hidden' });
  const edited = structuredClone(approved);
  edited.instances[1].doc.nodes[1].height = 5;
  await checkAssembly('03-edited-assembly', edited, 5);

  f.phase = 'Save the edited assembly in the browser project';
  if (evidenceMode) await makeVersion(laterVersion);
  else { await openProject(); await button('Save').click(); }
  const versions = versionsPanel();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(fileName, { exact: true }).waitFor();
  const saved = await projectBytes();
  assert.deepEqual(JSON.parse(saved), edited);
  const savedFile = join(f.output, 'project-edited.bcad');
  await writeFile(savedFile, saved);
  f.report.files.push({ file: savedFile, hash: sha256(saved), source: 'OPFS', semanticEquality: true });

  if (evidenceMode) {
    f.phase = 'reopen the edited project and reject misattribution of the earlier approval';
    const [stale, currentLid, currentBase] = await mcpEvidence(savedFile, 'edited', [
      evidenceCall('p2', acceptedLid.revision), evidenceCall('p2'), evidenceCall('p1'),
    ]);
    assert.match(stale.error, /OUTPUT_STALE/);
    checkEvidence(currentLid, 'p2', 5, 4, 'fail');
    checkEvidence(currentBase, 'p1', 6, 6, 'pass');
    assert.notEqual(currentLid.revision, acceptedLid.revision);
    assert.equal(currentBase.definitionRevision, acceptedBase.definitionRevision);
    assert.notEqual(currentLid.definitionRevision, acceptedLid.definitionRevision);
    f.report.evidenceRevisions = { before: beforeReport.revision, accepted: acceptedLid.revision, edited: currentLid.revision };
    f.report.checkpointSHA256 = sha256(checkpoint);

    await f.page.reload();
    await f.ready();
    await openProject();
    await versionsPanel().getByRole('button', { name: 'Open ' + fileName, exact: true }).click();
    await checkAssembly('04-reopened-working', edited, 5);
    await compare(beforeVersion);
    assert.equal(await proof(false).count(), 0);
    const target = versionsPanel().getByLabel('Compare to', { exact: true });
    await target.selectOption({ label: acceptedVersion });
    await checkRecovery(true);
    await f.same(edited);
    await f.snapshot('05-saved-approval-with-later-edit');
    await target.selectOption({ label: laterVersion });
    await versionsPanel().getByText(beforeVersion + ' → ' + laterVersion + ' · saved versions', { exact: true }).waitFor();
    assert.equal(await proof(true).count(), 0);
    assert.equal(await proof(false).count(), 0);
    assert.deepEqual(await readFile(join(runDirectory, 'run.json')), checkpoint);
    assert.deepEqual(await readFile(file), bytes);
    assert.deepEqual(await readFile(beforeLid), old);
  }

  f.phase = 'Open the saved project bytes in a fresh session';
  await f.newPage();
  await open(saved);
  await checkAssembly('04-fresh-edited-open', edited, 5);
  assert.deepEqual(f.report.downloads, []);
});
