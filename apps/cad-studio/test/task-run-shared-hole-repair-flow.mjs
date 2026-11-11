import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const sourceName = 'worker-baseline.bcad';
const repairName = 'shared-hole-repair.bcad';
const parts = ['p1', 'p2'];
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const model = ({ proposals, history, ...doc }) => doc;
const snapshotExtra = () => ({
  placed: window.__studioInstanceBounds?.() ?? [],
  volume: document.querySelector('[aria-label="Volume change"]')?.textContent ?? null,
});

export async function taskRunSharedHoleRepairFlow({ f, openFile, turn, call, readySummary, choose, incompatible, baseline,
  conflict, attemptedBytes, selected, selection, verifyPriorRuns, sharedHoleDeliveryMode }) {
  const project = sharedHoleDeliveryMode ? 'D638 shared hole delivery' : 'D637 shared hole repair';
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const files = () => versions().getByRole('list', { name: 'Project documents', exact: true });
  const openProject = async () => {
    if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await button(versions(), 'Project in this browser').click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  const save = async name => {
    if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
    await button(f.page, 'Save').click();
    await files().getByText(name, { exact: true }).waitFor();
  };
  const readSaved = async name => Buffer.from(await f.page.evaluate(async ({ project, name }) => {
    const root = await navigator.storage.getDirectory();
    const folder = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return [...new Uint8Array(await (await (await folder.getFileHandle(name)).getFile()).arrayBuffer())];
  }, { project, name }));

  const readHeights = async (stage, doc, heights = [5, 3], verdict = 'fail') => {
    const name = 'shared-hole-height-' + stage;
    const { revision, results } = await turn(name, parts.map(part => ({ tool: 'requirements', args: { action: 'evidence', part } })),
      { requirementEvidence: true });
    const reports = await Promise.all(results.map(async ({ error, body }, index) => {
      const part = parts[index], height = heights[index];
      assert.equal(error, false, JSON.stringify(body));
      const [file] = body.files;
      assert.deepEqual([file.path, file.bytes, file.sha256], ['requirement-evidence.json', Buffer.byteLength(file.text), sha256(file.text)]);
      const report = JSON.parse(file.text);
      assert.deepEqual([report.part, report.revision, report.checker], [part, revision, 'checkSpec']);
      const [row] = report.evidence.filter(row => row.result.kind === 'requirement');
      assert.deepEqual(row.requirement, doc.instances[index].doc.requirements[0]);
      assert.deepEqual([row.requirement.hard, row.result.part, row.result.run, row.result.subject, row.result.status,
        row.result.verdict, row.freshness.state], [true, part, revision, row.requirement.id, 'ok', verdict, 'current']);
      assert.ok(Math.abs(row.result.number - height) < 1e-8, JSON.stringify(row.result));
      await writeFile(join(f.output, name + '-' + part + '.json'), file.text);
      return report;
    }));
    await f.same(doc);
    return { revision, reports };
  };

  f.phase = 'preserve the failed source and measure its two hard height failures';
  await openProject();
  await save(sourceName);
  const originalSaved = await readSaved(sourceName);
  assert.deepEqual(originalSaved, baseline);
  await openFile(repairName, baseline);
  await f.same(incompatible);
  const before = await readHeights('before', incompatible);
  const baselineView = await f.snapshot('34-before-shared-hole-proposal', snapshotExtra);

  f.phase = 'attach the failed check to the same turn as the repair proposal';
  await choose(f, 'reopen', () => openFile('shared-incompatible-run.bcad-task', attemptedBytes));
  const failedRun = f.page.getByRole('region', { name: 'Reopened task run', exact: true });
  const attach = button(failedRun, 'Use failed check for p2 in chat');
  if (!(await attach.isVisible())) await failedRun.getByText('Failed native check · HOLE_OFF_PATTERN', { exact: true }).click();
  await attach.click();
  await f.page.getByLabel('Task evidence for next message', { exact: true }).waitFor();
  await f.same(incompatible);
  await f.page.getByRole('combobox', { name: 'Autonomy', exact: true }).selectOption('4');
  const op = { tool: 'features', args: { action: 'edit', part: 'p2', index: 2, values: { dia: 4 } } };
  const title = 'Restore p2 to the 4 mm shared hole H1';
  const proposed = await turn('shared-hole-proposal', [
    { tool: 'read_selected_native_check', args: {} },
    { tool: 'proposals', args: { action: 'propose', title, ops: [op] } },
    { tool: 'proposals', args: { action: 'accept', id: 'P1' } },
  ], { proposal: true });
  assert.deepEqual(proposed.taskFinding, selection);
  assert.equal(proposed.revision, conflict.baselineDigest);
  const [finding, made, refused] = proposed.results;
  assert.equal(finding.error, false, JSON.stringify(finding.body));
  assert.deepEqual(finding.body.finding, selected);
  assert.equal(finding.body.revision, proposed.revision);
  assert.equal(made.error, false, JSON.stringify(made.body));
  assert.deepEqual([made.body.proposal, made.body.applied, made.body.risk.approval], ['P1', false, ['assembly']]);
  assert.equal(refused.error, true);
  assert.match(refused.body.error, /user.s approval.*assembly/);
  assert.deepEqual(model(proposed.doc), model(incompatible));
  const proposal = () => f.page.getByRole('listitem', { name: 'Proposal P1', exact: true });
  await proposal().getByText(/needs you \(assembly\)/).waitFor();
  const pending = await f.doc();
  assert.deepEqual(model(pending), model(incompatible));
  assert.deepEqual(pending.history.map(entry => entry.kind), ['proposal', 'prompt']);
  assert.deepEqual(pending.proposals, proposed.doc.proposals);
  assert.equal(pending.proposals[0].base_evidence_revision, before.revision);
  assert.equal(pending.proposals[0].status, 'open');
  await verifyPriorRuns();

  f.phase = 'preview the larger hole without changing the working assembly';
  await button(proposal(), 'Preview').click();
  await button(proposal(), 'Hide').waitFor();
  await proposal().getByText('−16.49 mm³', { exact: true }).waitFor();
  await f.same(pending);
  const preview = await f.snapshot('35-shared-hole-proposal-preview', snapshotExtra);
  assert.equal(preview.volume, '−16.49 mm³');
  assert.deepEqual(preview.placed, baselineView.placed);
  assert.deepEqual(await readSaved(sourceName), originalSaved);
  await verifyPriorRuns();

  f.phase = 'accept the proposal explicitly and save the repaired project document';
  await button(proposal(), 'Accept').click();
  await f.page.waitForFunction(() => window.__studioDoc?.proposals?.[0]?.status === 'accepted');
  await f.ready();
  const accepted = await f.doc();
  const expected = structuredClone(incompatible);
  expected.instances[1].doc.nodes[2].radius = 2;
  assert.deepEqual(model(accepted), model(expected));
  assert.deepEqual(accepted.history.slice(0, -1), pending.history);
  const decision = accepted.proposals[0].decided, history = accepted.history.at(-1);
  assert.deepEqual([history.kind, history.proposal, history.by.agent, history.proposed_by.agent, decision.by, decision.at],
    ['accept', 'P1', 'user', 'chat', 'user', history.at]);
  assert.deepEqual(decision.evidence_revisions, history.evidence_revisions);
  assert.equal(history.evidence_revisions.before, before.revision);
  assert.notEqual(history.evidence_revisions.after, before.revision);
  const acceptedView = await f.snapshot('36-shared-hole-explicitly-accepted', snapshotExtra);
  assert.deepEqual(acceptedView.placed, baselineView.placed);
  await save(repairName);
  const repaired = await readSaved(repairName);
  assert.deepEqual(JSON.parse(repaired), accepted);
  await writeFile(join(f.output, 'shared-hole-repaired-source.bcad'), repaired);
  assert.deepEqual(await readSaved(sourceName), originalSaved);
  await verifyPriorRuns();

  f.phase = 'open the repaired document from the browser project in a fresh Studio page';
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
  await f.ready();
  await openProject();
  await button(files(), 'Open ' + repairName).click();
  await f.same(accepted);
  const opened = await f.snapshot('37-shared-hole-fresh-project-open', snapshotExtra);
  assert.deepEqual(opened.placed, baselineView.placed);
  const after = await readHeights('after', accepted);
  assert.equal(after.revision, history.evidence_revisions.after);
  assert.equal(after.reports[0].definitionRevision, before.reports[0].definitionRevision);
  assert.notEqual(after.reports[1].definitionRevision, before.reports[1].definitionRevision);

  f.phase = 'start both held height edits on the exact repaired project bytes';
  const planned = await turn('shared-hole-repaired-plan', [call()]);
  assert.equal(planned.results[0].error, false, JSON.stringify(planned.results[0].body));
  assert.equal(planned.results[0].body.status, 'ready');
  assert.deepEqual(planned.results[0].body.targets.map(target => [target.id, target.currentHeightMm, target.heightMm]),
    [['p1', 5, 6], ['p2', 3, 4]]);
  const row = f.page.locator('details.chat-tool').filter({ hasText: readySummary }).last();
  await row.locator('summary').click();
  const reply = await choose(f, 'start', () => button(row, 'Start local run').click());
  const recheck = await reply.json();
  const bytes = reply.request().postDataBuffer();
  assert.deepEqual(bytes.subarray(12 + bytes.readUInt32LE(8)), repaired);
  const runBytes = await readFile(join(recheck.directory, 'run.json'));
  await writeFile(join(f.output, 'shared-hole-recheck-status.json'), JSON.stringify(recheck));
  await writeFile(join(f.output, 'shared-hole-recheck-run.json'), runBytes);
  assert.deepEqual([recheck.reused, recheck.phase, recheck.baselineDigest], [false, 'active', planned.revision]);
  assert.notEqual(recheck.runId, conflict.runId);
  assert.notEqual(recheck.baselineDigest, conflict.baselineDigest);
  assert.deepEqual(recheck.tasks.map(task => [task.id, task.phase, task.nativeFailure]),
    parts.map(id => [id, 'awaiting-decision', undefined]));
  const { record } = JSON.parse(runBytes);
  assert.deepEqual(record.commits, []);
  assert.equal(record.pending, undefined);
  assert.equal(record.accepted.modelDigest, recheck.baselineDigest);
  assert.equal(record.accepted.sha256, sha256(repaired));
  assert.deepEqual(await readFile(join(recheck.directory, 'native', record.accepted.sha256 + '.bcad')), repaired);
  for (const [index, task] of record.state.tasks.entries()) {
    assert.deepEqual(task.candidate.gates, ['lease', 'validity', 'contract', 'assembly']);
    const expectedVolume = ([200, 96][index] - 4 * Math.PI) * [6, 4][index];
    assert.ok(Math.abs(task.candidate.geometry.volumeMm3 - expectedVolume) < 1e-8, JSON.stringify(task.candidate));
    await row.getByText(task.id + ' · awaiting decision', { exact: true }).waitFor();
  }
  assert.equal(await button(row, 'Open approved checkpoint').count(), 0);
  await f.same(accepted);
  await f.snapshot('38-shared-hole-native-recheck', snapshotExtra);
  assert.deepEqual(await readSaved(repairName), repaired);
  assert.deepEqual(await readSaved(sourceName), originalSaved);
  await verifyPriorRuns();
  f.report.observations.push({ selectedFinding: 'HOLE_OFF_PATTERN', checkedRevision: conflict.baselineDigest,
    repairedRevision: recheck.baselineDigest, originalSHA256: sha256(originalSaved), repairedSHA256: sha256(repaired),
    holeRadiusMm: [1.5, 2], previewVolume: preview.volume, hardHeightVerdicts: ['fail', 'fail'],
    freshProjectOpen: true, priorRunsUnchanged: true, heldHeightTasks: parts, taskPublications: 0 });
  if (sharedHoleDeliveryMode) {
    const { taskRunSharedHoleDeliveryFlow } = await import('./task-run-shared-hole-delivery-flow.mjs');
    const verifyPreserved = async () => {
      assert.deepEqual(await readSaved(sourceName), originalSaved);
      assert.deepEqual(await readSaved(repairName), repaired);
      assert.deepEqual(await readFile(join(f.output, 'shared-hole-repaired-source.bcad')), repaired);
      await verifyPriorRuns();
    };
    await taskRunSharedHoleDeliveryFlow({ f, row, recheck, repaired, accepted, after, baselineView, openProject, files,
      save, readSaved, readHeights, choose, verifyPreserved });
  }
}
